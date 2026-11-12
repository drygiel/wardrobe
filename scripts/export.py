# Exports the web models from Szafa4.blend into public/models: `yarn export` runs it headless on the saved file;
# Blender's Text Editor (Text > Open, Run Script) exports the scene as it is open, unsaved edits included.
# Wardrobe.glb: every Wardrobe mesh with the "Baked" UV map except the frame pieces, plus the door pivots their clips rotate.
# Frame.glb: the frame pieces P01-P14 and their laid-out copies on the boards (CutPlan).
# Electric.glb: the Electric collection, cables as meshes, no UVs: the site colours it by name, it never enters the atlas.
# Hardware.glb: dowels, hinges, mount blocks and shelf pins, no UVs: the editor colours them by name, they never enter the atlas.
# app/components/grain.json: grain direction of every wooden part, read from its UVMap.
# app/components/cutlist.json: the frame's order list (sizes, boards, 45° cuts, LED grooves, dowel holes) for /rama.
import json
import re
import bmesh
import bpy

models = bpy.path.abspath('//wardrobe/public/models/')
view_layer = bpy.context.view_layer
if bpy.context.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')

wardrobe = bpy.data.collections['Wardrobe'].all_objects
pieces = [o for o in bpy.data.collections['1_Frame'].objects if re.match(r'P\d\d_', o.name)]
parts = [o for o in wardrobe
         if (o.type == 'MESH' and 'Baked' in o.data.uv_layers and o not in pieces) or o.name.endswith('_Pivot')]
plan = [o for o in bpy.data.collections['CutPlan'].all_objects if o.type == 'MESH']
electric = list(bpy.data.collections['Electric'].objects)
hardware = [o for name in ('1a_Dowels', '3_Hinges', '4a_ShelfPins') for o in bpy.data.collections[name].all_objects if o.type == 'MESH']

cut = view_layer.layer_collection.children['CutPlan']


def layers(layer):
    return [layer] + [c for child in layer.children for c in layers(child)]


# Every exported collection must be in the view layer to be selected, also one excluded while editing (2_Fronts)
included = [cut] + layers(view_layer.layer_collection.children['Wardrobe'])
excluded = {layer.name: layer.exclude for layer in included}
for layer in included:
    layer.exclude = False
selection = [o.name for o in bpy.context.selected_objects]
active = view_layer.objects.active
hidden = [o for o in parts + pieces + plan + electric + hardware if o.hide_get()]
scene = bpy.context.scene
frame = scene.frame_current


def export(objs, name, animations, texcoords=True):
    for o in view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=models + name, export_format='GLB', use_selection=True, export_apply=True,
                              export_materials='NONE', export_texcoords=texcoords, export_normals=True,
                              export_vertex_color='NONE', export_draco_mesh_compression_enable=True,
                              export_cameras=False, export_lights=False, export_extras=False,
                              export_animations=animations, export_animation_mode='ACTIONS')
    print('Exported', models + name, len(objs), 'objects')


GLTF_AXIS = 'xzy'  # Blender X, Y, Z become glTF x, -z, y; a grain axis has no sign


def dominant(v):
    return max(range(3), key=lambda i: abs(v[i]))


# {normal axis: grain axis} in the mesh's own glTF axes; '?' when the UVs do not settle it. None for parts without wood.
def grain_of(o):
    me = o.data
    uv = me.uv_layers['UVMap'].data
    areas = {}
    for p in me.polygons:
        material = me.materials[p.material_index]
        if not material or not re.match(r'Desk wood|Wood$', material.name):
            continue
        a, b, c = p.loop_indices[:3]
        p0 = me.vertices[me.loops[a].vertex_index].co
        e1 = me.vertices[me.loops[b].vertex_index].co - p0
        e2 = me.vertices[me.loops[c].vertex_index].co - p0
        du1, dv1 = uv[b].uv - uv[a].uv
        du2, dv2 = uv[c].uv - uv[a].uv
        det = du1 * dv2 - du2 * dv1
        if abs(det) < 1e-12:
            continue
        along_v = (e2 * du1 - e1 * du2) / det  # the desk-wood texture's grain runs along V
        votes = areas.setdefault(dominant(p.normal), {})
        votes[dominant(along_v)] = votes.get(dominant(along_v), 0) + p.area
    if not areas:
        return None

    size = o.dimensions
    longest, middle, thin = sorted(range(3), key=lambda i: -size[i])
    # Long strips and posts have their UVs skewed on some faces, but grain across a strip does not exist
    if size[longest] >= 3 * size[middle]:
        return {GLTF_AXIS[n]: GLTF_AXIS[longest] for n in range(3) if n != longest}

    faces = {}
    for normal, votes in areas.items():
        ranked = sorted(votes.values(), reverse=True)
        settled = len(ranked) == 1 or ranked[1] <= 0.4 * sum(ranked)
        faces[GLTF_AXIS[normal]] = GLTF_AXIS[max(votes, key=votes.get)] if settled else '?'
    if size[thin] < 0.5 * size[middle]:
        faces.setdefault(GLTF_AXIS[thin], '?')  # the board's face has collapsed UVs
    # Every shelf runs along the wardrobe's width. The UVMap of IN_C_Shelf-* is rotated 90 degrees and IN_B_Shelf-07/13
    # are split, so for shelves this rule wins over the UVs.
    if re.match(r'(IN_._|A_)Shelf', o.name):
        faces[GLTF_AXIS[2]] = GLTF_AXIS[1]
    return faces


# Order list of the frame: size, board, 45° cuts, LED groove and dowel holes of every piece P01-P15, from the
# pieces, their CutPlan copies, the LED strips lying in their grooves and the dowels in 1a_Dowels. Directions are
# seen from the front: x+ to the back, y+ to the left, z+ up; positions are millimetres from the piece's own edges.
def cut_list(pieces):
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree

    def box(o):
        ws = [o.matrix_world @ v.co for v in o.data.vertices]
        return [min(w[i] for w in ws) for i in range(3)], [max(w[i] for w in ws) for i in range(3)]

    def mm(v):
        return round(v * 1000, 1)

    # mm drilled past each end of a dowel: room for the glue and the air it pushes, so the joint closes fully.
    # The 8 x 40 dowels (wolfcraft 2908000) sit in 2 x 21 mm holes
    CLEARANCE = 1.0

    sheets = {o.name.split('-')[-1]: box(o) for o in bpy.data.collections['CutPlan'].objects if o.name.startswith('Plan_Sheet')}
    copies = {o.name[5:]: o for o in bpy.data.collections['CutPlan'].objects if re.match(r'Plan_P\d\d$', o.name)}
    strips = [o for o in bpy.data.collections['5_LED'].objects if o.type == 'MESH']
    dowels = list(bpy.data.collections['1a_Dowels'].objects)
    faces = {(0, 0): 'front', (0, 1): 'tył', (1, 0): 'prawy bok', (1, 1): 'lewy bok', (2, 0): 'spód', (2, 1): 'góra'}
    along = {0: 'od frontu', 1: 'od prawej', 2: 'od dołu'}
    rows = []
    for o in sorted(pieces, key=lambda p: p.name):
        lo, hi = box(o)
        world = [o.matrix_world @ v.co for v in o.data.vertices]
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.transform(o.matrix_world)
        bm.normal_update()
        tree = BVHTree.FromBMesh(bm)
        bm.free()
        size = sorted((mm(hi[i] - lo[i]) for i in range(3)), reverse=True)
        copy = copies.get(o.name[:3])
        board = None
        if copy:
            clo, chi = box(copy)
            centre = [(clo[i] + chi[i]) / 2 for i in range(2)]
            board = next((name for name, (slo, shi) in sheets.items() if all(slo[i] <= centre[i] <= shi[i] for i in range(2))), None)
        turn = o.matrix_world.to_3x3()
        mitres = sum(1 for p in o.data.polygons if max(abs(c) for c in (turn @ p.normal).normalized()) < 0.99)

        grooves = []
        for s in strips:
            slo, shi = box(s)
            if not all(slo[i] >= lo[i] - 1e-4 and shi[i] <= hi[i] + 1e-4 for i in range(3)):
                continue
            thin = min(range(3), key=lambda i: shi[i] - slo[i])  # the strip lies flat on the piece's face over its groove
            side = 0 if slo[thin] - lo[thin] < hi[thin] - shi[thin] else 1
            face_at = lo[thin] if side == 0 else hi[thin]
            levels = sorted({round(w[thin], 5) for w in world if abs(w[thin] - face_at) > 1e-5}, key=lambda v: abs(v - face_at))
            bottom = levels[0]  # the groove's floor is the plane next to the face
            length = max(range(3), key=lambda i: shi[i] - slo[i])
            across = 3 - thin - length
            floor = [w for w in world if abs(w[thin] - bottom) < 1e-5 and slo[across] - 1e-4 <= w[across] <= shi[across] + 1e-4]
            start = min(w[length] for w in floor) if floor else slo[length]
            end = max(w[length] for w in floor) if floor else shi[length]
            box_lo = [0.0] * 3
            box_hi = [0.0] * 3
            box_lo[length], box_hi[length] = start, end
            box_lo[across], box_hi[across] = slo[across], shi[across]
            box_lo[thin], box_hi[thin] = min(bottom, face_at), max(bottom, face_at)
            grooves.append({
                'min': [mm(box_lo[i] - lo[i]) for i in range(3)], 'max': [mm(box_hi[i] - lo[i]) for i in range(3)],
                'face': faces[(thin, side)], 'width': mm(shi[across] - slo[across]), 'depth': mm(abs(bottom - face_at)),
                'from': mm(start - lo[length]), 'to': mm(end - lo[length]), 'along': along[length],
                'offset': mm(slo[across] - lo[across]), 'offsetAlong': along[across],
            })

        holes = []
        for d in dowels:
            dlo, dhi = box(d)
            if not all(dhi[i] > lo[i] + 1e-4 and dlo[i] < hi[i] - 1e-4 for i in range(3)):
                continue
            ext = [dhi[i] - dlo[i] for i in range(3)]
            ax = max(range(3), key=lambda i: ext[i])
            c = Vector([(dlo[i] + dhi[i]) / 2 for i in range(3)])
            ends = []
            for t in (dlo[ax], dhi[ax]):
                e = c.copy()
                e[ax] = t
                ends.append(e)
            # the end buried in this piece; from it a ray back along the dowel meets the face the hole is drilled in
            inner = [e for e in ends if all(lo[i] - 1e-4 <= e[i] <= hi[i] + 1e-4 for i in range(3))]
            if not inner:
                continue
            e = inner[0]
            other = ends[1] if e is ends[0] else ends[0]
            direction = (other - e).normalized()
            hit, normal, index, dist = tree.ray_cast(e + direction * 1e-6, direction)
            if hit is None or dist > ext[ax]:
                continue
            n = (turn @ o.data.polygons[index].normal).normalized() if index < len(o.data.polygons) else normal
            square = max(abs(v) for v in normal) > 0.99
            nax = max(range(3), key=lambda i: abs(normal[i]))
            others = [i for i in range(3) if i != ax]
            holes.append({
                'entry': [mm(hit[i] - lo[i]) for i in range(3)], 'axis': ax, 'into': -1 if direction[ax] > 0 else 1,
                'dowel': d.name[:3], 'face': faces[(nax, 0 if normal[nax] < 0 else 1)] if square else 'ścięcie 45°',
                'd': mm(min(ext[i] for i in others)), 'depth': mm(dist) + CLEARANCE,
                'at': [[mm(hit[i] - lo[i]), along[i]] for i in others],
            })
        holes.sort(key=lambda h: (h['dowel'], h['face'], h['at']))
        rows.append({'name': o.name, 'box': [mm(hi[i] - lo[i]) for i in range(3)], 'length': size[0], 'width': size[1], 'thickness': size[2], 'board': board,
                     'mitres': mitres, 'grooves': grooves, 'holes': holes})
    return rows


try:
    export(parts, 'Wardrobe.glb', True)
    export(pieces + plan, 'Frame.glb', False)
    scene.frame_set(scene.frame_start)  # the door magnets and hinge cups are exported where the closed doors hold them
    export(electric, 'Electric.glb', False, texcoords=False)
    export(hardware, 'Hardware.glb', False, texcoords=False)
    grain = {o.name: grain_of(o) for o in pieces + parts if o.type == 'MESH' and 'UVMap' in o.data.uv_layers}
    with open(bpy.path.abspath('//wardrobe/app/components/grain.json'), 'w') as file:
        json.dump({name: faces for name, faces in grain.items() if faces}, file, indent=0, sort_keys=True)
    with open(bpy.path.abspath('//wardrobe/app/components/cutlist.json'), 'w', encoding='utf-8') as file:
        json.dump(cut_list(pieces), file, ensure_ascii=False, indent=1)
finally:
    scene.frame_set(frame)
    for o in hidden:
        o.hide_set(True)
    for o in view_layer.objects:
        o.select_set(o.name in selection)
    view_layer.objects.active = active
    for layer in included:
        layer.exclude = excluded[layer.name]

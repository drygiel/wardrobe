# Exports the web models from Szafa4.blend into public/models: `yarn export` runs it headless on the saved file;
# Blender's Text Editor (Text > Open, Run Script) exports the scene as it is open, unsaved edits included.
# Wardrobe.glb: every Wardrobe mesh with the "Baked" UV map except the frame pieces, plus the door pivots their clips rotate.
# Frame.glb: the frame pieces P01-P14 and their laid-out copies on the boards (CutPlan).
# Electric.glb: the Electric collection, cables as meshes, no UVs: the site colours it by name, it never enters the atlas.
# Hardware.glb: dowels, hinges and mount blocks, no UVs: the editor colours them by name, they never enter the atlas.
# app/components/grain.json: grain direction of every wooden part, read from its UVMap.
import json
import re
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
hardware = [o for name in ('1a_Dowels', '3_Hinges') for o in bpy.data.collections[name].all_objects if o.type == 'MESH']

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


try:
    export(parts, 'Wardrobe.glb', True)
    export(pieces + plan, 'Frame.glb', False)
    scene.frame_set(scene.frame_start)  # the door magnets and hinge cups are exported where the closed doors hold them
    export(electric, 'Electric.glb', False, texcoords=False)
    export(hardware, 'Hardware.glb', False, texcoords=False)
    grain = {o.name: grain_of(o) for o in pieces + parts if o.type == 'MESH' and 'UVMap' in o.data.uv_layers}
    with open(bpy.path.abspath('//wardrobe/app/components/grain.json'), 'w') as file:
        json.dump({name: faces for name, faces in grain.items() if faces}, file, indent=0, sort_keys=True)
finally:
    scene.frame_set(frame)
    for o in hidden:
        o.hide_set(True)
    for o in view_layer.objects:
        o.select_set(o.name in selection)
    view_layer.objects.active = active
    for layer in included:
        layer.exclude = excluded[layer.name]

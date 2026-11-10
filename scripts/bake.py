# Bakes the shared "Baked" atlas of ../Szafa4.blend into public/models/Wardrobe.jpg. Run headless with `yarn bake`;
# it reads the saved .blend, so save it first.
# 1. Everything except the fronts, with the fronts and the hinge parts they carry hidden: the interior as if the doors were open.
# 2. Each drawer alone, slid out as far as on the site, fronts still hidden, so its inside is not lit through a closed slot.
# 3. Outer faces of the fronts and the handles, doors closed.
# 4. Edges and inner faces of the fronts, doors open at the end of their clips.
# Each bake is one temporary joined copy: Blender bakes selected objects one by one and walks the whole
# 8K image for each (~15 s apiece), while a joined copy takes the whole atlas in about a minute.
# With --frame (`yarn bake:frame`) it bakes only the frame pieces P01-P14, alone in the scene and spread apart, into
# Frame.jpg (4096x2048, same "Baked" UVs): the site shows them that way in the frame chapter.
import re
import sys
import bpy
import bmesh
import numpy as np
from mathutils import Vector

if not bpy.app.background:
    raise SystemExit('scripts/bake.py hides and edits scene objects; run it headless with `yarn bake`')

OPEN_FRAME = 40  # the door clips end fully open
MARGIN = 16
# Parts baked over step 1 must not bleed into other islands: the closest gap between islands is ~12 px at 8096x4096.
OVER_MARGIN = 6
RING = 12  # texels around a joint that set the brightness of the texels it covers
SLIDE = 0.7  # drawers slide out by this share of their depth, as in app/components/parts.ts

scene = bpy.context.scene
view_layer = bpy.context.view_layer
view_layer.layer_collection.children['CutPlan'].exclude = True  # the boards laid out for cutting would shade the wardrobe

prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'OPTIX'
prefs.get_devices()
for device in prefs.devices:
    device.use = device.type == 'OPTIX'
scene.cycles.device = 'GPU'
# Bakes ignore adaptive sampling and denoising, so they get more samples; bounces 6 vs 32 changed neither time nor brightness
scene.cycles.samples = 128
scene.cycles.caustics_reflective = scene.cycles.caustics_refractive = False

wardrobe = bpy.data.collections['Wardrobe'].all_objects
fronts = set(bpy.data.collections['2_Fronts'].all_objects)
baked = [o for o in wardrobe if o.type == 'MESH' and 'Baked' in o.data.uv_layers]
electric = set(bpy.data.collections['Electric'].objects)
for o in electric:
    o.hide_render = True  # the wiring is a separate overlay on the site, it must not shade the atlas
bpy.data.objects['Room'].hide_render = True  # the site has no room: its walls darken the atlas and black out the D side panel
for o in baked:
    o.hide_render = False  # Unused_BackPanel and Unused_SidePanel are hidden in renders but are part of the atlas and of the light
panels = [o for o in baked if o in fronts and not o.name.endswith('_Handle')]
handles = [o for o in baked if o.name.endswith('_Handle')]
drawers = [o for o in baked if o.name.startswith('DR_')]
leds = set(bpy.data.collections['5_LED'].all_objects)


def carried_by_front(o):
    while o.parent:
        o = o.parent
        if o in fronts:
            return True
    return False


def evaluated_mesh(o):
    return bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))


# Outer faces point to -X with the doors closed; the evaluated topology is the same when they swing open
scene.frame_set(0)
outer = {}
for o in panels:
    mesh = evaluated_mesh(o)
    turn = o.matrix_world.to_3x3()
    outer[o] = {p.index for p in mesh.polygons if (turn @ p.normal).x < -0.9}
    bpy.data.meshes.remove(mesh)


def bake(objs, use_clear, margin, keep=None, slide=0.0, type='COMBINED', **options):
    """Bakes one joined copy of objs; keep(o, face_index) limits which faces of o get baked, slide moves them to the front (-X)."""
    copies = []
    for o in objs:
        mesh = evaluated_mesh(o)
        if keep:
            bm = bmesh.new()
            bm.from_mesh(mesh)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep(o, f.index)], context='FACES')
            bm.to_mesh(mesh)
            bm.free()
        copy = bpy.data.objects.new(o.name + '_bake', mesh)
        copy.matrix_world = o.matrix_world
        copy.location.x -= slide
        scene.collection.objects.link(copy)
        copies.append(copy)
        o.hide_render = True  # the copy stands in for it
    for o in view_layer.objects:
        o.select_set(o in copies)
    view_layer.objects.active = copies[0]
    bpy.ops.object.join()
    joined = view_layer.objects.active
    joined.data.uv_layers.active = joined.data.uv_layers['Baked']
    bpy.ops.object.bake(type=type, target='IMAGE_TEXTURES', use_selected_to_active=False,
                        use_clear=use_clear, margin=margin, margin_type='ADJACENT_FACES', **options)
    bpy.data.objects.remove(joined)
    for o in objs:
        o.hide_render = False


def world_box(o):
    corners = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return Vector(min(c[i] for c in corners) for i in range(3)), Vector(max(c[i] for c in corners) for i in range(3))


def touch(a, b, tol=0.001):
    return all(a[0][i] - tol <= b[1][i] and b[0][i] - tol <= a[1][i] for i in range(3))


def box(values, radius):
    """Sum of values over a (2 radius + 1) square around each texel."""
    total = np.asarray(values, np.float64)
    for axis in (0, 1):
        size = total.shape[axis]
        running = np.concatenate([np.zeros_like(np.take(total, [0], axis=axis)), np.cumsum(total, axis=axis)], axis=axis)
        index = np.arange(size)
        total = np.take(running, np.minimum(index + radius + 1, size), axis=axis) - np.take(running, np.maximum(index - radius, 0), axis=axis)
    return total


def pixels(image):
    flat = np.empty(len(image.pixels), np.float32)
    image.pixels.foreach_get(flat)
    return flat.reshape(-1, 4)


def probe(image):
    """A material that glows only where a ray from a baked texel lands inside another part: on a back face, or on a
    face lying right on the texel (two boards that share a plane). Its diffuse bake is the share of covered rays."""
    material = bpy.data.materials.new('ContactProbe')
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()
    geometry = tree.nodes.new('ShaderNodeNewGeometry')
    path = tree.nodes.new('ShaderNodeLightPath')
    close = tree.nodes.new('ShaderNodeMath')
    close.operation = 'LESS_THAN'
    close.inputs[1].default_value = 0.001  # boards up to 1 mm apart count as touching
    inside = tree.nodes.new('ShaderNodeMath')
    inside.operation = 'MAXIMUM'
    glow = tree.nodes.new('ShaderNodeEmission')
    add = tree.nodes.new('ShaderNodeAddShader')
    output = tree.nodes.new('ShaderNodeOutputMaterial')
    tree.links.new(path.outputs['Ray Length'], close.inputs[0])
    tree.links.new(geometry.outputs['Backfacing'], inside.inputs[0])
    tree.links.new(close.outputs[0], inside.inputs[1])
    tree.links.new(inside.outputs[0], glow.inputs['Strength'])
    tree.links.new(tree.nodes.new('ShaderNodeBsdfDiffuse').outputs[0], add.inputs[0])
    tree.links.new(glow.outputs[0], add.inputs[1])
    tree.links.new(add.outputs[0], output.inputs['Surface'])
    target = tree.nodes.new('ShaderNodeTexImage')
    target.image = image
    target.select = True
    tree.nodes.active = target
    return material


def uncover(receivers, margin, keep=None):
    """Bakes again the texels of receivers that a touching part covers (black in the atlas), as if that part were gone.

    A probe bake marks the covered texels (their rays start inside the touching part); the receivers are then baked
    in groups that do not touch each other, with the parts touching them hidden, and only the marked texels are copied
    into the atlas. Every other texel keeps its normal bake, contact shadows next to the joints included."""
    atlas = bpy.data.images['Baked']
    width, height = atlas.size
    nodes = [m.node_tree.nodes.active for m in bpy.data.materials if m.node_tree]
    nodes = [n for n in nodes if n and n.type == 'TEX_IMAGE' and n.image == atlas]
    view_layer.update()  # drops the joined copies that bake() removed
    visible = [o for o in view_layer.objects if o.type == 'MESH' and not o.hide_render]
    # LED strips stay: hiding a light would darken the very texels being fixed
    blockers = [o for o in visible if o not in leds]
    boxes = {o: world_box(o) for o in visible}
    near = {o: {b for b in blockers if b != o and touch(boxes[o], boxes[b])} for o in receivers}
    receivers = sorted((o for o in receivers if near[o]), key=lambda o: -len(near[o]))
    groups = []
    for o in receivers:
        group = next((g for g in groups if not any(m in near[o] or o in near[m] for m in g)), None)
        if group is None:
            groups.append(group := [])
        group.append(o)

    mask = bpy.data.images.new('ContactMask', width, height, alpha=False)
    mask.colorspace_settings.is_data = True
    lit = bpy.data.images.new('Uncovered', width, height, alpha=False)
    lit.colorspace_settings.name = atlas.colorspace_settings.name

    material = probe(mask)
    swapped, added = [], []
    for o in visible:
        if not o.material_slots:
            o.data.materials.append(None)
            added.append(o)
        for slot in o.material_slots:
            swapped.append((slot, slot.material))
            slot.material = material
    world, samples, bounces = scene.world, scene.cycles.samples, scene.cycles.max_bounces
    scene.world, scene.cycles.samples, scene.cycles.max_bounces = None, 32, 1
    bake(receivers, use_clear=True, margin=margin, keep=keep, type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'})
    scene.world, scene.cycles.samples, scene.cycles.max_bounces = world, samples, bounces
    for slot, original in swapped:
        slot.material = original
    for o in added:
        o.data.materials.pop()
    bpy.data.materials.remove(material)

    for n in nodes:
        n.image = lit
    for group in groups:
        hidden = set().union(*(near[o] for o in group))
        for o in hidden:
            o.hide_render = True
        bake(group, use_clear=False, margin=margin, keep=keep)
        for o in hidden:
            o.hide_render = False
    for n in nodes:
        n.image = atlas

    # Covered texels see the probe on nearly all rays; open ones right at a joint on well under half
    weight = np.clip((pixels(mask)[:, 0] - 0.25) / 0.5, 0, 1)
    merged, fresh = pixels(atlas), pixels(lit)
    # With every touching part gone the fresh bake sees more light than its neighbours, so it takes the brightness of
    # the open texels around each joint; a face covered whole has no such ring and keeps its own light
    covered = (weight > 0).reshape(height, width)
    ring = (~covered & (box(covered, RING) > 0)).ravel()
    trust = np.clip(box(ring.reshape(height, width), RING).ravel() / (0.3 * (2 * RING + 1) ** 2), 0, 1)
    rows = np.nonzero(weight)[0]
    for c in range(3):
        near_old = box(np.where(ring, merged[:, c], 0).reshape(height, width), RING).ravel()[rows]
        near_new = box(np.where(ring, fresh[:, c], 0).reshape(height, width), RING).ravel()[rows]
        gain = np.where(near_new > 1e-3, near_old / np.maximum(near_new, 1e-3), 1)
        gain = 1 + (np.clip(gain, 0, 4) - 1) * trust[rows]
        old = merged[rows, c]
        merged[rows, c] = old + (fresh[rows, c] * gain - old) * weight[rows]
    atlas.pixels.foreach_set(merged.ravel())
    bpy.data.images.remove(mask)
    bpy.data.images.remove(lit)
    print(f'Uncovered {len(rows)} texels of {len(receivers)} parts in {len(groups)} bakes')


def closed_side(o, i):
    return o not in outer or i in outer[o]  # handles bake whole


def open_side(o, i):
    return i not in outer[o]


if '--frame' in sys.argv:
    pieces = [o for o in baked if re.match(r'P\d\d_', o.name)]
    for o in view_layer.objects:
        if o.type != 'LIGHT' and o not in pieces:
            o.hide_render = True
    # Spread the pieces as far as the site's frame chapter does (`apart` in app/home/HomeScene.tsx, glTF axes turned
    # into Blender's), so no piece shades the joints of its neighbours
    for o in pieces:
        corners = [o.matrix_world @ Vector(c) for c in o.bound_box]
        centre = sum(corners, Vector()) / 8
        moved = o.matrix_world.copy()
        moved.translation += Vector(((centre.x + 0.265) * 1.2, (centre.y - 1.14) * 0.2, (centre.z - 1.33) * 0.14))
        o.matrix_world = moved
    atlas = bpy.data.images['Baked']
    target = bpy.data.images.new('BakedFrame', 4096, 2048, alpha=False)
    # The bake writes into each material's active image node; point those at the new image (never saved to the .blend)
    for material in {m for o in pieces for m in o.data.materials if m and m.node_tree}:
        node = material.node_tree.nodes.active
        if node and node.type == 'TEX_IMAGE' and node.image == atlas:
            node.image = target
    bake(pieces, use_clear=True, margin=4)
    target.file_format = 'JPEG'
    path = bpy.path.abspath('//wardrobe/public/models/Frame.jpg')
    target.save(filepath=path, quality=95)
    print('Saved', path)
    sys.exit(0)

hidden_in_step1 = (fronts | {o for o in wardrobe if carried_by_front(o)}) - electric
for o in hidden_in_step1:
    o.hide_render = True
bake([o for o in baked if o not in fronts], use_clear=True, margin=MARGIN)
uncover([o for o in baked if o not in fronts and o not in drawers], MARGIN)
for drawer in drawers:
    bake([drawer], use_clear=False, margin=OVER_MARGIN, slide=drawer.dimensions.x * SLIDE)
for o in hidden_in_step1:
    o.hide_render = False

bake(panels + handles, use_clear=False, margin=OVER_MARGIN, keep=closed_side)
uncover(panels + handles, OVER_MARGIN, keep=closed_side)

scene.frame_set(OPEN_FRAME)
bake(panels, use_clear=False, margin=OVER_MARGIN, keep=open_side)
uncover(panels, OVER_MARGIN, keep=open_side)

atlas = bpy.data.images['Baked']
atlas.file_format = 'JPEG'
atlas.save(quality=95)
print('Saved', bpy.path.abspath(atlas.filepath))

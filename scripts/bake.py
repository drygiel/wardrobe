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
from mathutils import Vector

if not bpy.app.background:
    raise SystemExit('scripts/bake.py hides and edits scene objects; run it headless with `yarn bake`')

OPEN_FRAME = 40  # the door clips end fully open
MARGIN = 16
# Parts baked over step 1 must not bleed into other islands: the closest gap between islands is ~12 px at 8096x4096.
OVER_MARGIN = 6
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


def bake(objs, use_clear, margin, keep=None, slide=0.0):
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
    bpy.ops.object.bake(type='COMBINED', target='IMAGE_TEXTURES', use_selected_to_active=False,
                        use_clear=use_clear, margin=margin, margin_type='ADJACENT_FACES')
    bpy.data.objects.remove(joined)
    for o in objs:
        o.hide_render = False


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
for drawer in drawers:
    bake([drawer], use_clear=False, margin=OVER_MARGIN, slide=drawer.dimensions.x * SLIDE)
for o in hidden_in_step1:
    o.hide_render = False

bake(panels + handles, use_clear=False, margin=OVER_MARGIN, keep=closed_side)

scene.frame_set(OPEN_FRAME)
bake(panels, use_clear=False, margin=OVER_MARGIN, keep=open_side)

atlas = bpy.data.images['Baked']
atlas.file_format = 'JPEG'
atlas.save(quality=95)
print('Saved', bpy.path.abspath(atlas.filepath))

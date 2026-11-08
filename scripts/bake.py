# Bakes the shared "Baked" atlas of ../Szafa4.blend into public/models/Wardrobe.jpg. Run headless with `yarn bake`;
# it reads the saved .blend, so save it first.
# 1. Everything except the fronts, with the fronts and the hinge parts they carry hidden: the interior as if the doors were open.
# 2. Outer faces of the fronts and the handles, doors closed.
# 3. Edges and inner faces of the fronts, doors open at the end of their clips.
# Each step bakes one temporary joined copy: Blender bakes selected objects one by one and walks the whole
# 8K image for each (~15 s apiece), while a joined copy takes the whole atlas in about a minute.
import bpy
import bmesh

if not bpy.app.background:
    raise SystemExit('scripts/bake.py hides and edits scene objects; run it headless with `yarn bake`')

OPEN_FRAME = 40  # the door clips end fully open
MARGIN = 16
# Fronts must not bleed into other islands: the closest gap front <-> other island is ~12 px at 8096x4096.
FRONT_MARGIN = 6

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
for o in baked:
    o.hide_render = False  # Unused_BackPanel and Unused_SidePanel are hidden in renders but are part of the atlas and of the light
panels = [o for o in baked if o in fronts and not o.name.endswith('_Handle')]
handles = [o for o in baked if o.name.endswith('_Handle')]


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


def bake(objs, use_clear, margin, keep=None):
    """Bakes one joined copy of objs; keep(o, face_index) limits which faces of o get baked."""
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


hidden_in_step1 = fronts | {o for o in wardrobe if carried_by_front(o)}
for o in hidden_in_step1:
    o.hide_render = True
bake([o for o in baked if o not in fronts], use_clear=True, margin=MARGIN)
for o in hidden_in_step1:
    o.hide_render = False

bake(panels + handles, use_clear=False, margin=FRONT_MARGIN, keep=closed_side)

scene.frame_set(OPEN_FRAME)
bake(panels, use_clear=False, margin=FRONT_MARGIN, keep=open_side)

atlas = bpy.data.images['Baked']
atlas.file_format = 'JPEG'
atlas.save(quality=95)
print('Saved', bpy.path.abspath(atlas.filepath))

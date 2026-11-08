# Exports the web models from Szafa4.blend into public/models: `yarn export` runs it headless on the saved file;
# Blender's Text Editor (Text > Open, Run Script) exports the scene as it is open, unsaved edits included.
# Wardrobe.glb: every Wardrobe mesh with the "Baked" UV map except the frame pieces, plus the door pivots their clips rotate.
# Frame.glb: the frame pieces P01-P14 and their laid-out copies on the boards (CutPlan).
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

cut = view_layer.layer_collection.children['CutPlan']
excluded = cut.exclude
cut.exclude = False  # its objects must be in the view layer to be selected
selection = [o.name for o in bpy.context.selected_objects]
active = view_layer.objects.active
hidden = [o for o in parts + pieces + plan if o.hide_get()]


def export(objs, name, animations):
    for o in view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=models + name, export_format='GLB', use_selection=True, export_apply=True,
                              export_materials='NONE', export_texcoords=True, export_normals=True,
                              export_vertex_color='NONE', export_draco_mesh_compression_enable=True,
                              export_cameras=False, export_lights=False, export_extras=False,
                              export_animations=animations, export_animation_mode='ACTIONS')
    print('Exported', models + name, len(objs), 'objects')


try:
    export(parts, 'Wardrobe.glb', True)
    export(pieces + plan, 'Frame.glb', False)
finally:
    for o in hidden:
        o.hide_set(True)
    for o in view_layer.objects:
        o.select_set(o.name in selection)
    view_layer.objects.active = active
    cut.exclude = excluded

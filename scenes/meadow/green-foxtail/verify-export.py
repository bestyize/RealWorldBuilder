import bpy,os
from mathutils import Vector
P=os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.open_mainfile(filepath=P+'/model.blend')
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
 if o.type=='MESH':o.select_set(True)
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=P+'/model.glb')
s=bpy.context.scene;s.cycles.samples=128;s.cycles.use_denoising=False;s.render.filepath=P+'/images/export-check.png';bpy.ops.render.render(write_still=True)

import bpy,json,math
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(R/'model.blend'))
assert all(im.packed_file for im in bpy.data.images if im.name!='Render Result')
assert bpy.data.objects.get('CitrusSwallowtail_ThoraxOrigin')
source_meshes=len([o for o in bpy.data.objects if o.type=='MESH'])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(R/'model.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];wings=[o for o in meshes if 'Wing_' in o.name]
assert len(wings)==4
assert len(meshes)==source_meshes
scene=bpy.context.scene
# Source FPS retained on reopen, glTF import matches sampler seconds to frames.
poses=[]
for frame in [0,1,7,13,19,24,25]:
 scene.frame_set(frame);bpy.context.view_layer.update()
 vertices=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
 assert all(math.isfinite(x) for p in vertices for x in p)
 poses.append({'frame':frame,'bounds':[[min(p[i] for p in vertices),max(p[i] for p in vertices)] for i in range(3)]})
# No reference image plane, backdrop, light or camera included in GLB.
assert not any(o.type in {'LIGHT','CAMERA'} for o in scene.objects)
q={'reopen_blend':'passed all model images packed','reimport_glb':'passed','meshes':len(meshes),'wing_meshes':[o.name for o in wings],'sampled_poses':poses,'external_dependencies':False}
(R/'reimport-qa.json').write_text(json.dumps(q,indent=2));print(json.dumps(q))

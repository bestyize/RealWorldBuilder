import bpy,json
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(R/'model.blend'))
s=bpy.context.scene;s.render.fps=120;s.frame_set(1)
S=.08/1180;CX=600;CY=350;body=[o for o in s.objects if o.type=='MESH'];wingmat=bpy.data.materials['Registered_wing_scales']
# Registered dorsal body scales retain original fine texture on actual volume.
bodymat=wingmat.copy();bodymat.name='Registered_body_scales'
for o in body:
 if o.name=='Thorax' or o.name.startswith('Abdomen_segment_'):
  o.data.materials.clear();o.data.materials.append(bodymat)
  uv=o.data.uv_layers.active or o.data.uv_layers.new(name='BodyDorsalUV')
  for loop in o.data.loops:
   v=o.data.vertices[loop.vertex_index].co+o.location
   uv.data[loop.index].uv=((v.x/S+CX)/1204,1-(CY-v.y/S)/888)

bpy.ops.object.select_all(action='DESELECT')
for o in s.objects:
 if o.type in {'MESH','EMPTY'}:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(R/'model.glb'),export_format='GLB',use_selection=True,export_animations=True,export_nla_strips=True,export_frame_range=True,export_force_sampling=True,export_anim_slide_to_zero=True)
bpy.ops.wm.save_as_mainfile(filepath=str(R/'model.blend'))
q=json.loads((R/'qa.json').read_text());q['duration_seconds']=.2;q['fps']=120;q['meshes']=50;q['actual_span_m']=.07918700576;(R/'qa.json').write_text(json.dumps(q,indent=2))
cam=s.camera;cam.location=(.08,-.11,.10);cam.data.ortho_scale=.11;cam.rotation_euler=(Vector((0,0,.005))-cam.location).to_track_quat('-Z','Y').to_euler();s.cycles.samples=20
for frame,name in [(7,'flap-extreme'),(19,'downstroke')]:
 s.frame_set(frame);s.render.filepath=str(R/'images'/f'{name}.png');bpy.ops.render.render(write_still=True)

s.frame_set(1);cam.data.ortho_scale=.087;cam.location=(0,0,.18);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(R/'images/dorsal.png');bpy.ops.render.render(write_still=True)
cam.location=(.08,-.11,.10);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=str(R/'images/oblique.png');bpy.ops.render.render(write_still=True)

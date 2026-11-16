import bpy,os,json
P=os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.open_mainfile(filepath=P+'/model.blend');bpy.ops.object.select_all(action='DESELECT')
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in meshes:
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 if len(o.data.polygons)>60:
  m=o.modifiers.new('Distance simplification','DECIMATE');m.ratio=.27;bpy.ops.object.modifier_apply(modifier=m.name)
for o in meshes:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=P+'/model-lod.glb',use_selection=True,export_format='GLB',export_yup=True)
tri=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
json.dump({'triangles':tri,'purpose':'Optional distance mesh; primary model remains full detail','decimation_ratio':.27},open(P+'/lod.json','w'),indent=2)

import bpy,os,json,math
from mathutils import Vector
ROOT=os.path.dirname(os.path.abspath(__file__));report={}
bpy.ops.wm.open_mainfile(filepath=ROOT+'/model.blend')
report['blend_reopened']=True
report['images_packed']=all(i.packed_file is not None for i in bpy.data.images if i.source=='FILE')
report['source_mesh_count']=len([o for o in bpy.data.objects if o.type=='MESH'])
for ob in list(bpy.data.objects):
 if ob.type=='MESH':bpy.data.objects.remove(ob,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=ROOT+'/model.glb')
meshes=[o for o in bpy.data.objects if o.type=='MESH'];coords=[o.matrix_world@v.co for o in meshes for v in o.data.vertices]
report['glb_reimported']=True;report['glb_mesh_count']=len(meshes);report['glb_triangles']=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
report['finite_vertices']=all(math.isfinite(x) for p in coords for x in p)
report['bounds_blender_after_import']=[[min(p[i] for p in coords) for i in range(3)],[max(p[i] for p in coords) for i in range(3)]]
report['variant_nodes']=[o.name for o in meshes if o.name.startswith('CloverLeaf')]
for ob in meshes:
 if ob.name.startswith('CloverLeafFour'):ob.hide_render=True
report['glb_bytes']=os.path.getsize(ROOT+'/model.glb');report['blend_bytes']=os.path.getsize(ROOT+'/model.blend')
scene=bpy.context.scene;scene.cycles.use_denoising=False;scene.cycles.samples=32;scene.render.resolution_x=700;scene.render.resolution_y=700;scene.render.filepath=ROOT+'/images/export-check.png';bpy.ops.render.render(write_still=True)
json.dump(report,open(ROOT+'/export-validation.json','w'),indent=2)
print(json.dumps(report))

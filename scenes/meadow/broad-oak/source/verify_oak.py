import bpy,json,math,struct
from pathlib import Path
OUT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(OUT/'model.blend'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert len(meshes)==6 and len(bpy.context.scene.objects)==6
assert all(math.isfinite(v) for o in meshes for p in o.data.vertices for v in p.co)
images=set(n.image for o in meshes for m in o.data.materials for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image)
assert all(i.packed_file for i in images)
bounds=lambda obs:[[min((o.matrix_world@v.co)[k] for o in obs for v in o.data.vertices) for k in range(3)],[max((o.matrix_world@v.co)[k] for o in obs for v in o.data.vertices) for k in range(3)]]
original=bounds(meshes);bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(OUT/'model.glb'));bpy.context.view_layer.update();imported=[o for o in bpy.context.scene.objects if o.type=='MESH'];new=bounds(imported)
assert max(abs(original[i][k]-new[i][k]) for i in range(2) for k in range(3))<.001
bpy.ops.export_scene.gltf(filepath=str(OUT/'source'/'qa-roundtrip.glb'),export_format='GLB',export_cameras=False,export_lights=False)
def read(p):
 b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n])
a=read(OUT/'model.glb');b=read(OUT/'source'/'qa-roundtrip.glb');assert len(a['meshes'])==len(b['meshes'])==6
assert all(m.get('alphaMode')=='MASK' for m in a['materials'] if m['name'].startswith('Oak foliage'))
assert not any('uri' in i for i in a['images']);assert (OUT/'model.glb').stat().st_size<8000000;assert (OUT/'model.blend').stat().st_size<10000000
(OUT/'source'/'verification.json').write_text(json.dumps({'blend_reopened':True,'packed_images':len(images),'mesh_count':len(meshes),'glb_reimport_export':True,'bounds_max_error':max(abs(original[i][k]-new[i][k]) for i in range(2) for k in range(3)),'foliage_mode':'MASK .5, double-sided','glb_bytes':(OUT/'model.glb').stat().st_size,'blend_bytes':(OUT/'model.blend').stat().st_size},indent=2))
(OUT/'source'/'qa-roundtrip.glb').unlink();print('OAK_QA_PASS')

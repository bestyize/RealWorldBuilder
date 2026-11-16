import bpy, os, json
from mathutils import Vector
p=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=p+'/model.blend')
objs=[o for o in bpy.context.scene.objects if o.type=='MESH']
vs=[o.matrix_world@v.co for o in objs for v in o.data.vertices]
dims=[max(v[i] for v in vs)-min(v[i] for v in vs) for i in range(3)]
q=json.load(open(p+'/qa.json'));q['reopened_blend_dimensions_m']=dims;q['blend_missing_external_images']=[im.filepath for im in bpy.data.images if im.source=='FILE' and not im.packed_file and im.filepath and not os.path.exists(bpy.path.abspath(im.filepath))]
q['reopened_blend_dimension_error_m']=max(abs(dims[i]-q['dimensions_m'][i]) for i in range(3));q['root_z_min_m']=min(v.z for v in vs)
assert q['reopened_blend_dimension_error_m']<1e-6
assert not q['blend_missing_external_images']
json.dump(q,open(p+'/qa.json','w'),indent=2)
print('VERIFIED_REOPENED_BLEND',p)

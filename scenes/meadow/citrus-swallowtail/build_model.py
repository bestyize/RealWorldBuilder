"""Papilio xuthus reconstruction from approved generated artwork, not a scan.
Blender 4.3; run blender -b --python build_model.py. All outputs local to this folder.
4 editable curved closed wing surfaces with registered dorsal UVs. Underside inferred.
"""
import bpy,bmesh,math,random,json,os
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
S=.08/1180;CX=600;CY=350

def mat(name,col,rough=.65):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*col,1);p.inputs['Roughness'].default_value=rough;p.inputs['Specular IOR Level'].default_value=.24;return m
black=mat('Charcoal_cuticle',(.018,.016,.012));cream=mat('Ochre_body_scales',(.42,.31,.125),.8);eye=mat('Dark_compound_eyes',(.014,.019,.016),.38)
wingmat=mat('Registered_wing_scales',(.5,.4,.2),.74)
image=bpy.data.images.load(str(ROOT/'references/dorsal-crop.png'));image.pack()
n=wingmat.node_tree.nodes.new('ShaderNodeTexImage');n.image=image;wingmat.node_tree.links.new(n.outputs['Color'],wingmat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
# Baked shallow scale response, not scene-dependent procedural nodes in GLB.
import numpy as np
rng=np.random.default_rng(408);h,w=512,768
noise=rng.normal(0,1,(h,w));rough=np.ones((h,w,4));rough[:,:,0]=1;rough[:,:,1]=np.clip(.73+.035*noise,.62,.84);rough[:,:,2]=0
im=bpy.data.images.new('Wing_fine_roughness',width=w,height=h);im.colorspace_settings.name='Non-Color';im.pixels.foreach_set(rough.astype('float32').ravel());im.pack()
n=wingmat.node_tree.nodes.new('ShaderNodeTexImage');n.image=im;sep=wingmat.node_tree.nodes.new('ShaderNodeSeparateColor');wingmat.node_tree.links.new(n.outputs['Color'],sep.inputs[0]);wingmat.node_tree.links.new(sep.outputs['Green'],wingmat.node_tree.nodes.get('Principled BSDF').inputs['Roughness'])
normal=np.ones((h,w,4));dx=np.gradient(noise,axis=1)*.025;dy=np.gradient(noise,axis=0)*.018;nn=np.stack([-dx,-dy,np.ones_like(dx)],-1);nn/=np.linalg.norm(nn,axis=-1,keepdims=True);normal[:,:,:3]=nn*.5+.5
im=bpy.data.images.new('Wing_micro_scales_normal',width=w,height=h);im.colorspace_settings.name='Non-Color';im.pixels.foreach_set(normal.astype('float32').ravel());im.pack()
n=wingmat.node_tree.nodes.new('ShaderNodeTexImage');n.image=im;nm=wingmat.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.28;wingmat.node_tree.links.new(n.outputs['Color'],nm.inputs['Color']);wingmat.node_tree.links.new(nm.outputs['Normal'],wingmat.node_tree.nodes.get('Principled BSDF').inputs['Normal'])
under=wingmat.copy();under.name='Inferred_ventral_wing_scales';under.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.8

def mesh(name,verts,faces,material):
 me=bpy.data.meshes.new(name+'_mesh');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);me.materials.append(material)
 for f in me.polygons:f.use_smooth=True
 return o

def tube(name,pts,radii,material,sides=7):
 vs=[];fs=[]
 for i,p in enumerate(pts):
  p=Vector(p);t=(Vector(pts[min(i+1,len(pts)-1)])-Vector(pts[max(i-1,0)])).normalized();a=t.cross(Vector((0,0,1)))
  if a.length<.01:a=t.cross(Vector((0,1,0)))
  a.normalize();b=t.cross(a)
  for j in range(sides):vs.append(tuple(p+radii[i]*(a*math.cos(j*2*math.pi/sides)+b*math.sin(j*2*math.pi/sides))))
 for i in range(len(pts)-1):
  for j in range(sides):a=i*sides+j;b=i*sides+(j+1)%sides;fs.append((a,b,b+sides,a+sides))
 fs.extend([tuple(reversed(range(sides))),tuple((len(pts)-1)*sides+j for j in range(sides))]);return mesh(name,vs,fs,material)

def ell(name,loc,scale,material):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=14,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 for p in o.data.polygons:p.use_smooth=True
 return o
# Root origin is thorax; vertices in meters, head +Y, dorsal +Z.
body=[]
body.append(ell('Thorax',(0,0,0),(.0019,.0042,.0020),black))
body.append(ell('Head',(0,.0058,.0001),(.0016,.0017,.0015),black))
body.append(ell('Head_ochre_crown',(0,.0058,.00145),(.00042,.00130,.00017),cream))
for side in (-1,1):
 body.append(ell('CompoundEye_'+str(side),(side*.00135,.0061,.0004),(.0008,.00105,.0011),eye))
 body.append(tube('Thorax_ochre_stripe_'+str(side),[(side*.0011,.0034,.00145),(side*.0015,.0005,.0014),(side*.00105,-.0036,.0011)],[.00021,.00025,.00012],cream))
for i in range(9):
 y=-.0035-i*.0015;r=.0015*(1-i*.085)
 body.append(ell('Abdomen_segment_%02d'%i,(0,y,-.00025-i*.00004),(r,.0010,r*.72),black))
 for side in(-1,1):body.append(ell('Abdomen_ochre_side_%02d_%s'%(i,side),(side*r*.81,y,-.00008),(r*.20,.00065,r*.45),cream))
# Two long gently divergent, club-ended antennae, attached to head.
for side in(-1,1):
 pts=[]
 for i in range(18):
  t=i/17;pts.append((side*(.0007+.0085*t**1.12),.0067+.0144*t,.0008+.0018*math.sin(t*1.7)))
 body.append(tube('Antenna_'+str(side),pts,[.00012*(1-i/30) for i in range(18)],black,7))
 tip=ell('Antenna_club_'+str(side),pts[-1],(.00034,.00085,.00032),black);tip.rotation_euler[2]=-side*.52;body.append(tip)
# Six articulated walking legs, forelegs slightly folded in flight.
for side in(-1,1):
 for i in range(3):
  y=.0025-i*.0025
  pts=[(side*.0011,y,-.0011),(side*.0028,y+(.0015-i*.0004),-.0022),(side*(.0043+i*.0005),y-.0012,-.0044),(side*(.0054+i*.0008),y-.0033,-.0053),(side*(.0058+i*.0008),y-.0038,-.0052)]
  body.append(tube('Leg_%s_%s'%(side,i),pts,[.00021,.00017,.00012,.000085,.000035],black,7))
# Coiled proboscis visible in oblique view.
pts=[(.0008*math.cos(t),.0075+.0008*math.sin(t),-.00135-t*.000013) for t in np.linspace(0,math.pi*3.6,45)]
body.append(tube('Coiled_proboscis',pts,[.000075]*len(pts),black,5))
# Fine thoracic fringe, modeled silhouettes not cards.
rr=random.Random(731);vs=[];fs=[]
for i in range(300):
 y=rr.uniform(-.0039,.0039);theta=rr.uniform(0,math.pi*2);p=Vector((.0018*math.cos(theta),y,.0018*math.sin(theta)));out=Vector((math.cos(theta),-.35,math.sin(theta))).normalized();length=rr.uniform(.00025,.00065);a=out.cross(Vector((0,1,0))).normalized()*.000025;idx=len(vs);vs.extend([tuple(p-a),tuple(p+a),tuple(p+out*length)]);fs.append((idx,idx+1,idx+2))
body.append(mesh('Thorax_scale_fringes',vs,fs,cream))
# Dorsal silhouette coordinates manually traced against approved artwork.
fore=[(585,327),(516,278),(452,222),(375,167),(294,122),(211,86),(136,66),(76,63),(38,72),(18,90),(16,116),(29,145),(51,181),(73,220),(94,262),(114,301),(139,345),(167,393),(193,417),(226,431),(266,432),(309,414),(366,389),(428,365),(496,345)]
hind=[(583,337),(552,426),(541,517),(528,620),(519,678),(504,701),(481,718),(462,751),(447,756),(429,745),(408,744),(386,755),(365,774),(342,805),(320,836),(293,855),(284,847),(289,822),(307,776),(320,735),(317,709),(303,688),(298,662),(281,647),(270,625),(268,599),(247,580),(241,558),(247,528),(246,500),(258,472),(275,448),(302,413),(341,395),(402,372),(468,350)]
wings=[]
for side in(-1,1):
 for kind,outline in [('Fore',fore),('Hind',hind)]:
  pix=[(x if side==-1 else 1200-x,y) for x,y in outline]
  verts=[((x-CX)*S,(CY-y)*S,0) for x,y in pix]
  o=mesh(f'{kind}Wing_'+('L' if side==-1 else 'R'),verts,[tuple(range(len(verts)))],wingmat)
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=bm.faces[:]);bmesh.ops.subdivide_edges(bm,edges=bm.edges[:],cuts=5,use_grid_fill=True);bm.to_mesh(o.data);bm.free()
  for v in o.data.vertices:
   span=min(1,abs(v.co.x)/.04);v.co.z=.0004*math.sin(span*math.pi)+(.00013 if kind=='Fore' else -.00013)
  uv=o.data.uv_layers.new(name='RegisteredDorsalUV')
  for loop in o.data.loops:
   v=o.data.vertices[loop.vertex_index].co;x=v.x/S+CX;y=CY-v.y/S;uv.data[loop.index].uv=(x/1204,1-y/888)
  o.data.materials.append(under)
  bpy.context.view_layer.objects.active=o;o.select_set(True)
  mod=o.modifiers.new('Physical_thin_membrane','SOLIDIFY');mod.thickness=.000018;mod.offset=0;mod.material_offset=1;bpy.ops.object.modifier_apply(modifier=mod.name);o.select_set(False)
  # Move origin to actual thorax attachment without changing rest shape.
  pivot=Vector((side*.0012,.0005 if kind=='Fore' else -.0014,0))
  for v in o.data.vertices:v.co-=pivot
  o.location=pivot;wings.append(o)
# One action per wing with identical name merged by glTF NLA track.
scene=bpy.context.scene;scene.render.fps=120;scene.frame_start=1;scene.frame_end=25
for index,o in enumerate(wings):
 side=-1 if o.name.endswith('_L') else 1;hind='Hind' in o.name
 for frame in range(1,26):
  phase=2*math.pi*(frame-1)/24
  # Starts/ends spread, two half-strokes asymmetric in depth, slight fore/hind lag envelope.
  wave=math.sin(phase)+.16*math.sin(2*phase)
  lag=.07*math.sin(phase*2) if hind else 0
  o.rotation_euler[1]=-side*(.93*wave+lag)*(1 if side<0 else .975)
  o.rotation_euler[0]=.035*math.sin(phase)*(1 if hind else -.5)
  o.keyframe_insert(data_path='rotation_euler',frame=frame)
 action=o.animation_data.action;action.name='FlightLoop_'+o.name
 for fc in action.fcurves:
  for kp in fc.keyframe_points:kp.interpolation='LINEAR'
 track=o.animation_data.nla_tracks.new();track.name='FlightLoop';track.strips.new('FlightLoop',1,action);o.animation_data.action=None
scene.frame_set(1)
# Root to permit placement/flight translation without changing wing local pivots.
root=bpy.data.objects.new('CitrusSwallowtail_ThoraxOrigin',None);bpy.context.collection.objects.link(root)
for o in body+wings:o.parent=root
# Only asset nodes are exported; render setup is excluded through selection.
# Registered dorsal body scales retain original fine texture on actual volume.
bodymat=wingmat.copy();bodymat.name='Registered_body_scales'
for o in body:
 if o.name=='Thorax' or o.name.startswith('Abdomen_segment_'):
  o.data.materials.clear();o.data.materials.append(bodymat)
  uv=o.data.uv_layers.active or o.data.uv_layers.new(name='BodyDorsalUV')
  for loop in o.data.loops:
   v=o.data.vertices[loop.vertex_index].co+o.location
   uv.data[loop.index].uv=((v.x/S+CX)/1204,1-(CY-v.y/S)/888)

asset=body+wings+[root]
def select_asset():
 bpy.ops.object.select_all(action='DESELECT')
 for o in asset:o.select_set(True)
select_asset();bpy.ops.export_scene.gltf(filepath=str(ROOT/'model.glb'),export_format='GLB',use_selection=True,export_animations=True,export_nla_strips=True,export_frame_range=True,export_force_sampling=True,export_anim_slide_to_zero=True)
# Transparent proof with neutral studio light, no floor or scene reference planes.
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False;scene.render.film_transparent=True;scene.world.color=(.35,.35,.35)
for loc,power,size in [((-.06,-.01,.12),.09,.11),((.05,.06,.08),.056,.08)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,0,.18));cam=bpy.context.object;cam.name='ReferenceDorsalCamera';cam.rotation_euler=(0,0,0);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.087;scene.camera=cam
scene.view_settings.view_transform='AgX';scene.render.resolution_x=1200;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'model.blend'))
scene.render.filepath=str(ROOT/'images/dorsal.png');bpy.ops.render.render(write_still=True)
cam.location=(.08,-.11,.10);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ROOT/'images/oblique.png');bpy.ops.render.render(write_still=True)
scene.frame_set(7);cam.data.ortho_scale=.11;cam.rotation_euler=(Vector((0,0,.01))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ROOT/'images/flap-extreme.png');bpy.ops.render.render(write_still=True)
report={'source':'approved generated dual-view concept; not a real photograph','span_m':.08,'meshes':len(body+wings),'vertices':sum(len(o.data.vertices) for o in body+wings),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in body+wings),'animation':'FlightLoop','duration_seconds':.2,'fps':120,'frames':[1,25],'wings':[o.name for o in wings],'origin':'thorax','axes':'Blender Z up, head +Y; glTF Y up','inferred':'underside pattern/relief, leg articulation and physical scale'}
(ROOT/'qa.json').write_text(json.dumps(report,indent=2))

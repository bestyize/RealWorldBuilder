"""Reproducible authored Quercus robur-style broad oak from approved art.
Blender 4.3+: blender -b -t 6 --python source/build_oak.py
All geometry is static and individually editable within named branch/leaf meshes.
"""
import bpy,math,random,json
import numpy as np
from pathlib import Path
from mathutils import Vector
OUT=Path(__file__).resolve().parents[1];rng=random.Random(73189)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.context.preferences.filepaths.save_version=0

def image(name,data,noncolor=False):
 h,w=data.shape[:2];im=bpy.data.images.new(name,w,h,alpha=True)
 if noncolor:im.colorspace_settings.name='Non-Color'
 im.pixels.foreach_set(data.astype('float32').ravel());im.filepath_raw=str(OUT/'source'/('texture-'+name+'.png'));im.file_format='PNG';im.save();im.pack();return im

def material(name,c,rough=.75):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Specular IOR Level'].default_value=.24;return m
N=512;y,x=np.mgrid[0:N,0:N];u=x/N;v=y/N
noise=np.zeros((N,N))
for f,a in [(3,.45),(9,.23),(31,.14),(97,.09)]:noise+=a*np.sin(u*f*6.28+np.sin(v*9)*.5)*np.sin(v*(f*.27+1)*6.28+1.7)
phase=u*26+.15*np.sin(v*21)+.06*np.sin(v*57+u*9)
fissure=np.exp(-(np.sin(phase*math.pi)/.15)**2);cross=np.exp(-(np.sin(v*16+np.floor(phase)*2.2)/.08)**2)*.18
h=noise*.3-fissure*.45-cross;dy,dx=np.gradient(h);normal=np.stack([np.clip(-dx*2,-.5,.5),np.clip(-dy*2,-.5,.5),np.ones_like(h)],-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
# Actual approved generated trunk pixels supply irregular bark, not invented checker ridges.
ref=bpy.data.images.load(str(OUT/'source'/'approved-reference.png'));rw,rh=ref.size;ar=np.empty(rw*rh*4,dtype='float32');ref.pixels.foreach_get(ar);ar=ar.reshape(rh,rw,4)
ix=(505+u*95).astype(int);iy=(rh-1-(800+v*165)).astype(int);rgb=ar[iy,ix,:3].copy()
mean=np.maximum(rgb.mean(axis=(0,1)),.001);rgb=rgb/mean*np.array([.16,.135,.095]);lum=rgb@np.array([.2126,.7152,.0722]);hh=lum-sum(np.roll(lum,i,axis=0) for i in range(-3,4))/7;dy,dx=np.gradient(hh);normal=np.stack([-dx*2,-dy*2,np.ones_like(hh)],-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
col=image('oak-bark-color',np.dstack([np.clip(rgb,.02,.6),np.ones_like(h)]));nor=image('oak-bark-normal',np.dstack([normal*.5+.5,np.ones_like(h)]),True);rough=image('oak-bark-roughness',np.stack([np.ones_like(h),np.clip(.78+fissure*.12-noise*.08,.63,.94),np.zeros_like(h),np.ones_like(h)],-1),True)
bark=material('Oak deeply fissured gray-brown bark',(.2,.17,.13));p=bark.node_tree.nodes.get('Principled BSDF')
for im,kind in [(col,'c'),(nor,'n'),(rough,'r')]:
 node=bark.node_tree.nodes.new('ShaderNodeTexImage');node.image=im
 if kind=='c':bark.node_tree.links.new(node.outputs['Color'],p.inputs['Base Color'])
 elif kind=='n':
  n=bark.node_tree.nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.65;bark.node_tree.links.new(node.outputs['Color'],n.inputs['Color']);bark.node_tree.links.new(n.outputs['Normal'],p.inputs['Normal'])
 else:
  n=bark.node_tree.nodes.new('ShaderNodeSeparateColor');bark.node_tree.links.new(node.outputs['Color'],n.inputs['Color']);bark.node_tree.links.new(n.outputs['Green'],p.inputs['Roughness'])
# Simple leaf pigment and veins with no painted lighting or cutout dependency.
y,x=np.mgrid[0:256,0:128];t=y/255;s=x/127*2-1;mid=np.exp(-(s/.035)**2);vein=np.zeros_like(s)
for k in range(5):vein=np.maximum(vein,np.exp(-((t-(.15+k*.14)-abs(s)*.24)/.012)**2)*np.clip(1-abs(s),0,1))
width=(np.sin(math.pi*np.clip(t,0,1))**.6)*(.70+.22*np.cos(t*math.pi*10))
alpha=(abs(s)<width).astype(float)
lrgb=np.array([.15,.285,.038])*(1-.18*abs(s)[...,None])+(mid*.035+vein*.018)[...,None]*np.array([.8,1,.32])
leafmats=[]
for k,tint in enumerate([(1,1,1),(.76,.85,.67),(1.16,1.10,.78),(.90,.96,1.02)]):
 im=image('oak-leaf-tone%d'%k,np.dstack([lrgb*np.array(tint),alpha]));m=material('Oak foliage tone %d'%k,(.12,.23,.04),.68);m.use_backface_culling=False;m.surface_render_method='DITHERED';m.alpha_threshold=.5
 n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=im;m.node_tree.links.new(n.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color']);m.node_tree.links.new(n.outputs['Alpha'],m.node_tree.nodes.get('Principled BSDF').inputs['Alpha']);leafmats.append(m)

def mesh(name,vs,fs,uv=None,mat=bark):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);me.materials.append(mat)
 if uv:
  l=me.uv_layers.new()
  for q in me.loops:l.data[q.index].uv=uv[q.vertex_index]
 for p in me.polygons:p.use_smooth=True
 return o

def cat(points,t):
 n=len(points)-1;q=t*n;i=min(n-1,int(q));f=q-i;p0=Vector(points[max(0,i-1)]);p1=Vector(points[i]);p2=Vector(points[i+1]);p3=Vector(points[min(n,i+2)]);return .5*((2*p1)+(-p0+p2)*f+(2*p0-5*p1+4*p2-p3)*f*f+(-p0+3*p1-3*p2+p3)*f*f*f)
skeleton=[]
def tube(name,points,radii,sides=12,steps=22,record=False):
 vs=[];fs=[];uv=[];path=[];rads=[];distance=0;last=None
 for i in range(steps):
  t=i/(steps-1);c=cat(points,t);tangent=(cat(points,min(1,t+.001))-cat(points,max(0,t-.001))).normalized();a=tangent.cross(Vector((0,1,0)))
  if a.length<.1:a=tangent.cross(Vector((1,0,0)))
  a.normalize();b=tangent.cross(a).normalized();rad=float(np.interp(t,np.linspace(0,1,len(radii)),radii));path.append(c);rads.append(rad)
  if last is not None:distance+=(c-last).length
  last=c
  for j in range(sides+1):
   theta=j/sides*math.tau;relief=1+.025*math.sin(theta*9+t*12)+.014*math.sin(theta*17-t*6);vs.append(c+rad*relief*(a*math.cos(theta)+b*math.sin(theta)));uv.append((j/sides*max(rad*math.tau*2,1),distance*1.6))
 for i in range(steps-1):
  for j in range(sides):a=i*(sides+1)+j;fs.append((a,a+1,a+sides+2,a+sides+1))
 fs.append(tuple(reversed(range(sides))));fs.append(tuple((steps-1)*(sides+1)+j for j in range(sides)))
 if record:skeleton.append((path,rads))
 return mesh(name,vs,fs,uv)
trunk=tube('Oak_Trunk',[(0,0,.15),(.04,.01,1),(-.10,.05,2.5),(.15,0,4),(.40,.1,5.8),(.0,.2,7.6),(.40,.35,9.6),(.75,.35,10.9)],[.9,.66,.57,.47,.36,.25,.13,.025],20,44,True)
main=[trunk]
for k in range(7):
 a=k*math.tau/7+.14;r=1.35+rng.random()*.45
 main.append(tube('Oak_RootFlare',[(0,0,.65),(math.cos(a)*.65,math.sin(a)*.65,.22),(math.cos(a)*r,math.sin(a)*r,.045)],[.36,.26,.025],10,12,True))
# Hand-directed spreading scaffolds; crown is intentionally not rotationally symmetric.
ends=[(-6.0,-.4,5.4),(5.7,.4,5.6),(-5.2,2.8,6.2),(4.4,-3.4,6.6),(-4.7,-2.4,8.1),(4.5,2.9,8.2),(-3.5,1.5,10.2),(3.1,-1.3,10.9),(-1.4,-2.7,10.5),(1.5,2.4,11.2),(-.8,.7,11.7)]
primarypaths=[]
for i,end in enumerate(ends):
 end=Vector(end);z=2.6+i*.51;start=Vector((.08*math.sin(i),.06*math.cos(i),z));d=end-start
 pts=[start,start+d*.20+Vector((.25*math.sin(i*1.9),.20*math.cos(i),-.40)),start+d*.48+Vector((.38*math.sin(i+.7),.35*math.cos(i),-.65)),start+d*.74+Vector((-.22*math.sin(i),.3*math.sin(i*2),-.15)),end];radius=.38-i*.021
 main.append(tube('Oak_MainBough_%02d'%i,pts,[radius,radius*.83,radius*.46,.055],14,28,True));primarypaths.append(pts)
bpy.ops.object.select_all(action='DESELECT')
for o in main:o.select_set(True)
bpy.context.view_layer.objects.active=trunk;bpy.ops.object.join();trunk.name='Oak_ContinuousRootTrunkBoughs'
mod=trunk.modifiers.new('Continuous organic branch junctions','REMESH');mod.mode='VOXEL';mod.voxel_size=.075;bpy.ops.object.modifier_apply(modifier=mod.name)
mod=trunk.modifiers.new('Soften unions','SMOOTH');mod.factor=.25;mod.iterations=2;bpy.ops.object.modifier_apply(modifier=mod.name)
mod=trunk.modifiers.new('Realtime trunk topology','DECIMATE');mod.ratio=.42;bpy.ops.object.modifier_apply(modifier=mod.name)
# Cylindrical grain frame of nearest scaffold segment, not world-axis bark bands.
segments=[]
for path,rads in skeleton:
 run=0
 for a,b,ra,rb in zip(path,path[1:],rads,rads[1:]):segments.append((a,b,ra,rb,run));run+=(b-a).length
verts=np.array([v.co[:] for v in trunk.data.vertices]);best=np.full(len(verts),1e8);uvs=np.zeros((len(verts),2))
for a,b,ra,rb,run in segments:
 aa=np.array(a);bb=np.array(b);d=bb-aa;length=np.linalg.norm(d);q=np.clip((verts-aa)@d/(length*length),0,1);delta=verts-(aa+q[:,None]*d);dist=np.linalg.norm(delta,axis=1);score=dist/(ra+(rb-ra)*q+.05);sel=score<best
 tangent=Vector(d/length);axis=tangent.cross(Vector((0,1,0)))
 if axis.length<.1:axis=tangent.cross(Vector((1,0,0)))
 axis.normalize();axis2=tangent.cross(axis).normalized();angle=np.arctan2(delta@np.array(axis2),delta@np.array(axis));uvs[sel,0]=angle[sel]/math.tau*max(ra*math.tau*2,1);uvs[sel,1]=(run+q[sel]*length)*1.6;best[sel]=score[sel]
layer=trunk.data.uv_layers.new(name='BarkGrain')
for loop in trunk.data.loops:layer.data[loop.index].uv=uvs[loop.vertex_index]
for p in trunk.data.polygons:p.use_smooth=True
# Secondary branches carry terminal sprays; real voids separate their clustered leaves.
fine=[];leaves=[([],[],[]) for _ in range(4)];leafcount=0
# A lobed polygon with 5 shallow rounded lobe pairs; bent central ridge.
def leaf(pos,direction,size,tone):
 global leafcount
 d=Vector(direction).normalized();axis=d.cross(Vector((0,0,1)))
 if axis.length<.15:axis=d.cross(Vector((0,1,0)))
 axis.normalize();roll=rng.uniform(-1.2,1.2);n=d.cross(axis).normalized();axis=axis*math.cos(roll)+n*math.sin(roll);n=d.cross(axis).normalized();vs,fs,uv=leaves[tone];start=len(vs)
 # Six-vertex gently folded individual leaf, with a real lobed alpha-cut silhouette.
 for tt in [0,1]:
  for ss in [-1,0,1]:
   vs.append(Vector(pos)+d*size*tt+axis*(ss*size*.36)+n*(size*.055*(1-abs(ss))));uv.append(((ss+1)*.5,tt))
 fs.extend([(start,start+1,start+4,start+3),(start+1,start+2,start+5,start+4)])
 leafcount+=1
for pi,pts in enumerate(primarypaths):
 for j in range(5):
  t=.40+j*.13;start=cat(pts,t);out=(Vector(pts[-1])-Vector(pts[0])).normalized();side=Vector((-out.y,out.x,0));sgn=-1 if j%2 else 1
  end=start+out*rng.uniform(.6,1.15)+side*sgn*rng.uniform(.65,1.35)+Vector((0,0,rng.uniform(.3,.85)))
  sec=[start,start.lerp(end,.48)+Vector((0,0,-.12)),end];fine.append(tube('Oak_Secondary',sec,[.075,.041,.012],7,12))
  for k in range(6):
   q=.25+k*.14;origin=cat(sec,q);ang=rng.uniform(0,math.tau);tip=origin+Vector((math.cos(ang)*rng.uniform(.45,.9),math.sin(ang)*rng.uniform(.45,.9),rng.uniform(.25,.75)))
   twig=[origin,origin.lerp(tip,.55)+Vector((0,0,.12)),tip];fine.append(tube('Oak_Twig',twig,[.020,.010,.0015],5,7))
   for l in range(64):
    tt=rng.uniform(.15,1);p=cat(twig,tt)+Vector((rng.uniform(-.52,.52),rng.uniform(-.52,.52),rng.uniform(-.32,.42)));a=l*2.399+rng.uniform(-.45,.45);d=Vector((math.cos(a)*.8,math.sin(a)*.8,rng.uniform(-.35,.65)));leaf(p,d,rng.uniform(.24,.39),rng.choices(range(4),[5,2,2,1])[0])
# Batch wood and foliage by material: editable disconnected twigs/leaves, few draw groups.
bpy.ops.object.select_all(action='DESELECT')
for o in fine:o.select_set(True)
bpy.context.view_layer.objects.active=fine[0];bpy.ops.object.join();fine[0].name='Oak_SecondaryBranchesAndTwigs'
objects=[trunk,fine[0]]
for i,(vs,fs,uv) in enumerate(leaves):
 o=mesh('Oak_LobedLeaves_%d'%i,vs,fs,uv,leafmats[i]);objects.append(o)
# Ground contact, meters; do not create a plane or a pot.
lowest=min(v.co.z for o in objects for v in o.data.vertices)
for o in objects:
 for v in o.data.vertices:
  v.co.x*=1.12;v.co.y*=1.12;v.co.z=(v.co.z-lowest)*.91
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=trunk
bpy.ops.export_scene.gltf(filepath=str(OUT/'model.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False)
# Standard game foliage uses alpha-test depth writing, never blended canopy sorting.
import struct
path=OUT/'model.glb';data=path.read_bytes();size=struct.unpack_from('<I',data,12)[0];gltf=json.loads(data[20:20+size]);binary=data[20+size:]
for mat in gltf['materials']:
 if mat.get('name','').startswith('Oak foliage'):mat['alphaMode']='MASK';mat['alphaCutoff']=.5
payload=json.dumps(gltf,separators=(',',':')).encode();payload+=b' '*((-len(payload))%4);path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(payload)+len(binary))+struct.pack('<II',len(payload),0x4e4f534a)+payload+binary)
bpy.data.orphans_purge(do_recursive=True);bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'model.blend'),compress=True)
coords=[v.co for o in objects for v in o.data.vertices];low=[min(v[k] for v in coords) for k in range(3)];high=[max(v[k] for v in coords) for k in range(3)]
for o in objects:o.data.calc_loop_triangles()
(OUT/'asset-info.json').write_text(json.dumps({'id':'broad-oak','species':'Quercus robur','units':'meters','bounds_blender':[low,high],'leaf_count':leafcount,'triangles':sum(len(o.data.loop_triangles) for o in objects),'mesh_count':len(objects),'assumptions':['generated reference, not scan','hidden crown structure inferred','individual leaves enlarged for realtime crown readability']},indent=2))
bpy.ops.object.light_add(type='SUN',rotation=(.42,-.48,-.35));bpy.context.object.data.energy=2.0;bpy.context.object.data.angle=.20
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=28;s.cycles.use_denoising=False;s.render.resolution_x=1100;s.render.resolution_y=1000;s.render.resolution_percentage=100;s.render.film_transparent=True;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.world.color=(.12,.14,.18);s.view_settings.view_transform='AgX'
for loc,power,size in [((-8,-10,18),2600,8),((8,4,15),2300,7),((0,-8,8),700,6)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,6))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=17.8;s.camera=cam
for name,loc,target,scale in [('front',(0,-28,8),(0,0,6),17.8),('side',(28,0,9),(0,0,6),17.8),('rear',(-4,28,9),(0,0,6),17.8),('bark',(-2,-5,3),(0,0,2),4.1)]:
 cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale;s.render.filepath=str(OUT/'images'/('review-'+name+'.png'));bpy.ops.render.render(write_still=True)
print('OAK_READY',leafcount,'leaves',low,high,flush=True)

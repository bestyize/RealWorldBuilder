"""Cardinal tetra single reusable candidate; no runtime or scene integration.
Run blender -b --python fish/cardinal-tetra/build_model.py
"""
import bpy,math,os,json,struct,numpy as np
from mathutils import Vector
OUT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
source=bpy.data.images.load(OUT+'/concept-generated.png');sw,sh=source.size
pixels=np.empty(sw*sh*4,dtype=np.float32);source.pixels.foreach_get(pixels);photo=pixels.reshape(sh,sw,4)[::-1]
# Source center fish is generated; real photographs govern silhouette, not pixels.
guides=np.array([(504,493,529),(550,482,534),(630,457,548),(710,428,558),(790,412,560),(870,416,550),(940,431,530),(1000,448,504),(1044,460,486),(1057,472,480)],float)
def sample(x,y):
 x=np.clip(x,0,sw-1);y=np.clip(y,0,sh-1);ix=x.astype(int);iy=y.astype(int);fx=(x-ix)[...,None];fy=(y-iy)[...,None]
 return (photo[iy,ix]*(1-fx)+photo[iy,np.minimum(ix+1,sw-1)]*fx)*(1-fy)+(photo[np.minimum(iy+1,sh-1),ix]*(1-fx)+photo[np.minimum(iy+1,sh-1),np.minimum(ix+1,sw-1)]*fx)*fy
W,H=1024,256
u,v=np.meshgrid(np.linspace(0,1,W),np.linspace(0,1,H));a=v*math.tau;px=504+553*u;top=np.interp(px,guides[:,0],guides[:,1]);bot=np.interp(px,guides[:,0],guides[:,2]);py=(top+bot)/2-np.cos(a)*(bot-top)*.47
rgb=sample(px,py)[:,:,:3]
mask=np.clip((1.5-((px-1012)/28)**2-((py-470)/26)**2)*2,0,1)[...,None];replacement=sample(np.maximum(970,px-45),py)[:,:,:3];rgb=rgb*(1-mask)+replacement*mask
# Reconstruct the small head where the generated eye would otherwise duplicate.
headmix=np.clip((px-972)/58,0,1)[...,None]
base=np.zeros_like(rgb)+np.array([.18,.20,.185]);band=np.exp(-((py-453)/7)**2)[...,None]
head=base*(1-band)+np.array([.025,.27,.32])*band
rgb=rgb*(1-headmix)+head*headmix
# V2 regional response: pigment is diffuse; only the blue structural band
# receives restrained thin-film reflection. No emission and no glossy coat.
def blur(a,n=3):
 for _ in range(n):a=(a+np.roll(a,1,0)+np.roll(a,-1,0)+np.roll(a,1,1)+np.roll(a,-1,1))/5
 return a
cyan=np.clip((rgb[:,:,2]-rgb[:,:,0])*7,0,1)*np.clip((rgb[:,:,1]-rgb[:,:,0])*7,0,1)
stripe=np.clip(blur(cyan,5)*1.7,0,1)
red=np.clip((rgb[:,:,0]-np.maximum(rgb[:,:,1],rgb[:,:,2]))*5,0,1)
# Reduce baked bright cyan flecks; angular highlights now come from the BRDF.
rgb*=.78
rgb*=1-.40*stripe[...,None]
rgb*=1+.08*red[...,None]
rgba=np.concatenate([rgb,np.ones((H,W,1))],-1).astype('float32')
def save_image(name,filename,array,noncolor=False):
 image=bpy.data.images.new(name,array.shape[1],array.shape[0],alpha=True)
 if noncolor:image.colorspace_settings.name='Non-Color'
 image.pixels.foreach_set(array.astype('float32').ravel());image.filepath_raw=OUT+'/'+filename;image.file_format='PNG';image.save();return image
im=save_image('Cardinal V2 pigment without luminous stripe','cardinal-albedo.png',rgba)
lum=rgb@np.array([.2126,.7152,.0722]);detail=lum-blur(lum,2)
rng=np.random.default_rng(173);micro=blur(rng.normal(0,1,(H,W)),1)
dy,dx=np.gradient(detail*.14+micro*.010)
nx=np.clip(-dx,-.035,.035);ny=np.clip(-dy,-.035,.035)
normal=np.stack([nx*.5+.5,ny*.5+.5,np.sqrt(1-nx*nx-ny*ny)*.5+.5,np.ones_like(nx)],-1)
nim=save_image('Fine non-repeating microresponse','cardinal-normal.png',normal,True)
rough=np.clip(.64-.11*red-.34*stripe+.025*micro+.035*np.clip(detail,-.3,.3),.26,.71)
metal=.08*stripe
packed=np.stack([np.ones_like(rough),rough,metal,np.ones_like(rough)],-1)
rim=save_image('Regional belly back stripe roughness','cardinal-metallic-roughness.png',packed,True)
# Packed R = iridescence weight, G = normalized 0..420nm thickness.
film=np.stack([.68*stripe,((330+18*blur(micro,5))/420)*stripe,np.zeros_like(stripe),np.ones_like(stripe)],-1)
iim=save_image('Blue stripe angular thin film mask','cardinal-iridescence.png',film,True)
def mat(name,c,rough=.4):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Specular IOR Level'].default_value=.4;return m
bodymat=mat('Pigmented reflective cardinal scales',(1,1,1),.55);p=bodymat.node_tree.nodes.get('Principled BSDF');p.inputs['Coat Weight'].default_value=0;p.inputs['Metallic'].default_value=0;p.inputs['Specular IOR Level'].default_value=.27
nodes=bodymat.node_tree.nodes;links=bodymat.node_tree.links
n=nodes.new('ShaderNodeTexImage');n.image=im;links.new(n.outputs['Color'],p.inputs['Base Color'])
n=nodes.new('ShaderNodeTexImage');n.image=nim;nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.32;links.new(n.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],p.inputs['Normal'])
n=nodes.new('ShaderNodeTexImage');n.image=rim;split=nodes.new('ShaderNodeSeparateColor');links.new(n.outputs['Color'],split.inputs['Color']);links.new(split.outputs['Green'],p.inputs['Roughness']);links.new(split.outputs['Blue'],p.inputs['Metallic'])
n=nodes.new('ShaderNodeTexImage');n.image=iim;split=nodes.new('ShaderNodeSeparateColor');links.new(n.outputs['Color'],split.inputs['Color']);mult=nodes.new('ShaderNodeMath');mult.operation='MULTIPLY';mult.inputs[1].default_value=420;links.new(split.outputs['Green'],mult.inputs[0]);links.new(mult.outputs[0],p.inputs['Thin Film Thickness']);p.inputs['Thin Film IOR'].default_value=1.35
finroot=mat('Opaque buried fin roots',(.16,.19,.17),.44);fin=mat('Thin fin membrane provisional',(.23,.27,.25),.45);fp=fin.node_tree.nodes.get('Principled BSDF');fp.inputs['Alpha'].default_value=.38;fin.surface_render_method='DITHERED';fin.use_backface_culling=False
for m in [finroot,fin]:
 n=m.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='FinColor';m.node_tree.links.new(n.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
# Compact authored ray texture in fan coordinates; no external pixels.
fw,fh=512,128
q,t=np.meshgrid(np.linspace(0,1,fw),np.linspace(0,1,fh))
phase=q*13+.018*np.sin(t*7+q*9);dist=np.abs((phase+.5)%1-.5)
ray=np.exp(-(dist/.045)**2);fine=.012*np.sin(t*160+q*11)
value=.24+.28*ray+fine
farr=np.stack([value*.92,value,value*.96,np.ones_like(value)],-1).astype('float32')
fim=bpy.data.images.new('Subdued anatomically fanned rays',fw,fh,alpha=True);fim.pixels.foreach_set(farr.ravel());fim.filepath_raw=OUT+'/cardinal-fin-rays.png';fim.file_format='PNG';fim.save()
for material in [finroot,fin]:
 p=material.node_tree.nodes.get('Principled BSDF')
 for link in list(p.inputs['Base Color'].links):material.node_tree.links.remove(link)
 n=material.node_tree.nodes.new('ShaderNodeTexImage');n.image=fim;material.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color'])
def mesh(name,vs,fs,material,uv=None,colors=None):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);me.materials.append(material)
 for f in me.polygons:f.use_smooth=True
 if uv:
  l=me.uv_layers.new()
  for loop in me.loops:l.data[loop.index].uv=uv[loop.vertex_index]
 if colors:
  l=me.color_attributes.new(name='FinColor',type='FLOAT_COLOR',domain='POINT')
  for c,val in zip(l.data,colors):c.color=val
 return o
# Closed axial body; taper into a laterally thin caudal base without an open tube.
prof=np.array([[-1.30,.002,.065,.0],[-1.20,.035,.08,.0],[-1.00,.065,.10,.005],[-.70,.105,.16,.02],[-.25,.15,.26,.02],[.20,.17,.31,.035],[.60,.16,.29,.04],[.90,.13,.22,.04],[1.12,.09,.13,.045],[1.24,.045,.07,.045],[1.28,.012,.025,.045]])
def shape(x):return [float(np.interp(x,prof[:,0],prof[:,i])) for i in [1,2,3]]
vs=[];fs=[];uv=[];NX=73;NA=32
for i in range(NX):
 x=-1.3+2.58*i/(NX-1);w,h,c=shape(x)
 for j in range(NA+1):
  a=j/NA*math.tau
  # Round the scaled peduncle into a thin continuous wedge, not a straight cut.
  taper=max(0,min(1,(-1.17-x)/.13));taper=taper*taper*(3-2*taper)
  vx=x-.095*taper*math.sin(a)**2
  vs.append((vx,math.sin(a)*w,c+math.cos(a)*h));uv.append((i/(NX-1),j/NA))
for i in range(NX-1):
 for j in range(NA):
  q=i*(NA+1)+j;fs.append((q+NA+1,q+NA+2,q+1,q))
fs.append(tuple(range(NA)));fs.append(tuple((NX-1)*(NA+1)+j for j in reversed(range(NA))))
body=mesh('CardinalBody',vs,fs,bodymat,uv)
# Low-poly ray fans, opaque proximal rows and light outer membranes.
def fan(name,roots,ends,n=19,steps=7):
 vs=[];fs=[];cs=[];uvs=[]
 for j in range(n):
  q=j/(n-1);r=Vector(roots[0]).lerp(Vector(roots[1]),q);idx=min(len(ends)-2,int(q*(len(ends)-1)));f=q*(len(ends)-1)-idx;p0=Vector(ends[max(0,idx-1)]);p1=Vector(ends[idx]);p2=Vector(ends[idx+1]);p3=Vector(ends[min(len(ends)-1,idx+2)]);e=.5*((2*p1)+(-p0+p2)*f+(2*p0-5*p1+4*p2-p3)*f*f+(-p0+3*p1-3*p2+p3)*f*f*f)
  for k in range(steps+1):
   t=(k/steps)**1.6;v=r.lerp(e,t);v.y+=.012*math.sin(math.pi*t)*math.sin(math.pi*q);vs.append(tuple(v));ray=.20+.065*(.5+.5*math.cos(q*math.pi*26))**5;cs.append((ray*.92,ray,ray*.96,1));uvs.append((q,t))
 for j in range(n-1):
  for k in range(steps):
   a=j*(steps+1)+k;fs.append((a,a+1,a+steps+2,a+steps+1))
 o=mesh(name,vs,fs,finroot,uv=uvs,colors=cs);o.data.materials.append(fin)
 for face in o.data.polygons:face.material_index=0 if face.index%steps==0 else 1
 return o
fan('CardinalTail',[(-1.23,0,-.052),(-1.23,0,.052)],[(-1.82,0,-.32),(-1.53,0,0),(-1.82,0,.34)],n=23)
fan('CardinalDorsal',[(.35,0,.31),(-.25,0,.25)],[(.32,0,.31),(.16,0,.62),(-.30,0,.28)])
fan('CardinalAnal',[(-.05,0,-.25),(-.87,0,-.11)],[(-.04,0,-.26),(-.36,0,-.49),(-.89,0,-.14)])
fan('CardinalAdipose',[(-.78,0,.14),(-.99,0,.105)],[(-.78,0,.14),(-.87,0,.23),(-1.0,0,.105)],n=9,steps=4)
for side in [-1,1]:
 fan('CardinalPelvic'+str(side),[(.12,side*.085,-.24),(-.12,side*.075,-.24)],[(.10,side*.08,-.24),(-.13,side*.18,-.41),(-.29,side*.11,-.30)],n=9,steps=5)
 fan('CardinalPectoral'+str(side),[(.89,side*.10,-.04),(.82,side*.11,-.10)],[(.89,side*.10,-.04),(.43,side*.28,-.08),(.57,side*.19,-.23)],n=9,steps=5)
# Conforming single-surface eyes; no detached sphere or overlapping white rim.
eye=mat('Dark pupil and subdued cyan iris',(.02,.05,.05),.25);n=eye.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='FinColor';eye.node_tree.links.new(n.outputs['Color'],eye.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
for side in [-1,1]:
 vs=[];fs=[];cs=[]
 for rr in [0,.028,.052,.059,.067,.075]:
  for j in range(32):
   a=j/32*math.tau;x=1.06+rr*math.cos(a);z=.065+rr*math.sin(a);w,h,c=shape(x);y=w*math.sqrt(max(.01,1-((z-c)/h)**2))+.003+.007*(1-(rr/.075)**2);vs.append((x,side*y,z));cs.append((.003,.006,.007,1) if rr<=.052 else (.025,.075,.08,1) if rr<.075 else (.08,.10,.095,1))
 for i in range(5):
  for j in range(32):
   a=i*32+j;b=i*32+(j+1)%32;f=(a,b,b+32,a+32);fs.append(f if side>0 else f[::-1])
 mesh('CardinalEye'+str(side),vs,fs,eye,colors=cs)
# Batch small fins and eyes to keep a school inexpensive; shared one model asset.
for target,prefix in [('CardinalFins','Cardinal'),('CardinalEyes','CardinalEye')]:
 objs=[o for o in bpy.context.scene.objects if o.type=='MESH' and ((o.name.startswith('CardinalEye')) if target=='CardinalEyes' else (o.name.startswith(prefix) and o.name not in ['CardinalBody','CardinalTail'] and not o.name.startswith('CardinalEye')))]
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();objs[0].name=target
model=list(bpy.context.scene.objects)
bpy.ops.object.select_all(action='DESELECT');bpy.ops.object.armature_add(enter_editmode=True);rig=bpy.context.object;rig.name='CardinalRig';rig.data.edit_bones.remove(rig.data.edit_bones[0]);xs=[.9,.2,-.55,-1.20,-1.65];prev=None
for i,x in enumerate(xs):
 b=rig.data.edit_bones.new('CardinalSpine_%d'%i);b.head=(x,0,0);b.tail=(x-.45,0,0)
 if prev:b.parent=prev
 prev=b
bpy.ops.object.mode_set(mode='OBJECT')
for ob in model:
 gs=[ob.vertex_groups.new(name='CardinalSpine_%d'%i) for i in range(len(xs))]
 for v in ob.data.vertices:
  (a,i),(b,j)=sorted((abs(v.co.x-x),i) for i,x in enumerate(xs))[:2];d=max(a+b,1e-6);gs[i].add([v.index],b/d,'REPLACE');gs[j].add([v.index],a/d,'REPLACE')
 ob.parent=rig;mod=ob.modifiers.new('Editable skin','ARMATURE');mod.object=rig
for image in [im,nim,rim,iim,fim]:image.pack()
# Keep generated group source external to avoid multiplying the runtime payload.
bpy.ops.object.select_all(action='DESELECT')
for o in model+[rig]:o.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.export_scene.gltf(filepath=OUT+'/cardinal-tetra.glb',export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
# Blender 4.3 does not export Thin Film. Add standard KHR_materials_iridescence
# to the same body material; no runtime recoloring or topology changes.
path=OUT+'/cardinal-tetra.glb';raw=open(path,'rb').read();jn=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+jn]);binary=raw[28+jn:]
imagebytes=open(OUT+'/cardinal-iridescence.png','rb').read();offset=len(binary);binary+=imagebytes;binary+=b'\x00'*((-len(binary))%4)
view=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(imagebytes)})
imageindex=len(j['images']);j['images'].append({'bufferView':view,'mimeType':'image/png','name':'Cardinal stripe thin-film mask'})
texture=len(j['textures']);j['textures'].append({'source':imageindex})
material=next(m for m in j['materials'] if m['name']=='Pigmented reflective cardinal scales')
material.setdefault('extensions',{})['KHR_materials_iridescence']={'iridescenceFactor':1,'iridescenceTexture':{'index':texture},'iridescenceIor':1.35,'iridescenceThicknessMinimum':0,'iridescenceThicknessMaximum':420,'iridescenceThicknessTexture':{'index':texture}}
j.setdefault('extensionsUsed',[]).append('KHR_materials_iridescence');j['buffers'][0]['byteLength']=len(binary)
js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
open(path,'wb').write(struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=48;s.cycles.use_denoising=False;s.render.resolution_x=1280;s.render.resolution_y=720;s.render.resolution_percentage=100;s.world.color=(.04,.05,.06);s.view_settings.view_transform='AgX'
for name,loc,power,size in [('Key',(2,-4,5),400,4),('Fill',(3,2,1),130,3),('Rim',(-3,2,3),350,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=3.9;s.camera=cam
for label,loc in [('oblique',(3,-8,2)),('side',(0,-8,.05)),('front',(8,-.01,.15)),('rear',(-8,-2,.7))]:
 cam.location=loc;cam.rotation_euler=(Vector((-.25,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.image_settings.file_format='PNG';s.render.filepath=OUT+'/review-'+label+'.png'
 if label=='oblique':bpy.ops.wm.save_as_mainfile(filepath=OUT+'/cardinal-tetra.blend')
 bpy.ops.render.render(write_still=True)
print('CARDINAL_COMPLETE',len(model),'meshes',sum(len(o.data.vertices) for o in model),'vertices')

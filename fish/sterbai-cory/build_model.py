"""Sterba's cory candidate. Generated pigment pixels, real-photo anatomy only.
blender -b --python fish/sterbai-cory/build_model.py
"""
import bpy,math,os,numpy as np
from mathutils import Vector
OUT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
source=bpy.data.images.load(OUT+'/concept-generated.png');W,H=source.size
arr=np.empty(W*H*4,dtype=np.float32);source.pixels.foreach_get(arr);arr=arr.reshape(H,W,4);valid=arr[:,:,3]>.94
for row in range(H):
 ids=np.flatnonzero(valid[row])
 if len(ids):
  g=np.arange(W);pos=np.searchsorted(ids,g);l=ids[np.clip(pos-1,0,len(ids)-1)];r=ids[np.clip(pos,0,len(ids)-1)];near=np.where(abs(g-l)<abs(g-r),l,r);arr[row,~valid[row],:3]=arr[row,near[~valid[row]],:3]
soft=sum(np.roll(arr[:,:,:3],i,0) for i in range(-12,13))/25
soft=sum(np.roll(soft,i,1) for i in range(-8,9))/17;arr[:,:,:3]=np.where(valid[:,:,None],arr[:,:,:3],soft)
y,x=np.meshgrid(np.arange(H),np.arange(W),indexing='ij');py=H-1-y
# Remove the concept's painted eye; retain nearby authentic-to-concept head spots.
mask=np.clip((1.5-((x-1380)/67)**2-((py-485)/61)**2)*2,0,1)[...,None]
rep=arr[np.clip(y,0,H-1),np.clip(x-170,0,W-1),:3];arr[:,:,:3]=arr[:,:,:3]*(1-mask)+rep*mask
# Neutralize the source pectoral overlap under the new anatomical paired fins.
mask=(np.clip((x-920)/80,0,1)*np.clip((1240-x)/70,0,1)*np.clip((py-620)/40,0,1))[...,None]
rep=arr[np.clip(H-1-np.minimum(py,610),0,H-1),x,:3];arr[:,:,:3]=arr[:,:,:3]*(1-mask)+rep*mask
arr[:,:,:3]*=.88;arr[:,:,3]=1
im=bpy.data.images.new('Generated Sterbai pigmentation',W,H,alpha=True);im.pixels.foreach_set(arr.ravel());im.filepath_raw=OUT+'/sterbai-albedo.png';im.file_format='PNG';im.save()
def mat(name,c,rough=.43):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Specular IOR Level'].default_value=.32;return m
bodymat=mat('Layered cory armor and living skin',(1,1,1),.46)
p=bodymat.node_tree.nodes.get('Principled BSDF')
p.inputs['Specular IOR Level'].default_value=.29
finmat=mat('Dense patterned fin membranes',(1,1,1),.48);p=finmat.node_tree.nodes.get('Principled BSDF');n=finmat.node_tree.nodes.new('ShaderNodeTexImage');n.image=im;finmat.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color']);finmat.use_backface_culling=False
orange=mat('Orange pectoral leading rays',(.52,.23,.035),.36);barbelmat=mat('Warm living barbel tissue',(.34,.30,.23),.44);cavity=mat('Recessed inferior mouth',(.045,.031,.024),.6)
def world(px,py,y=0):return ((px-1000)/280,y,(550-py)/280)
def mesh(name,vs,fs,material,uv=None):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);me.materials.append(material)
 for face in me.polygons:face.use_smooth=True
 if uv:
  l=me.uv_layers.new()
  for loop in me.loops:l.data[loop.index].uv=uv[loop.vertex_index]
 return ob
guides=np.array([(405,465,610,.002),(440,445,620,.055),(520,410,650,.12),(650,365,685,.21),(800,320,710,.32),(950,280,720,.41),(1090,265,715,.46),(1200,295,711,.46),(1310,350,704,.41),(1400,410,685,.34),(1490,505,665,.25),(1560,595,666,.15),(1610,640,674,.02)],float)
def shape(px):return [float(np.interp(px,guides[:,0],guides[:,i])) for i in [1,2,3]]
vs=[];fs=[];uv=[];NX=133;NA=64
for i in range(NX):
 px=405+1205*i/(NX-1);top,bot,w=shape(px)
 for j in range(NA+1):
  a=j/NA*math.tau;co=math.cos(a);py=(top+bot)/2-(co if co>=0 else -(-co)**.46)*(bot-top)/2
  xx,yy,zz=world(px,py,math.sin(a)*w)
  armor=max(0,min(1,(px-520)/160))*max(0,min(1,(1220-px)/200))
  yy+=math.sin(a)*.0035*armor*math.cos((px-440)*.15+abs(co)*2)
  if px<465:xx-=.12*(1-(px-405)/60)**2*math.sin(a)**2
  if px>1500:
   t=min(1,(px-1500)/110);f=1-(1-t)**1.2
   xx=xx*(1-f)+(2.178-.09*math.sin(a)**2)*f;yy=yy*(1-f)+.12*math.sin(a)*f;zz=zz*(1-f)+(-.47-.012*math.sin(a)**2+.007*math.cos(a))*f
   py=py*(1-f)+638*f
  vs.append((xx,yy,zz));uv.append((min(px,1570)/W,1-py/H))
for i in range(NX-1):
 for j in range(NA):
  q=i*(NA+1)+j;fs.append((q+NA+1,q+NA+2,q+1,q))
fs.append(tuple(range(NA)));oral_start=len(fs)
for depth in [.025,.055]:
 for j in range(NA+1):
  a=j/NA*math.tau;vs.append((2.178-.09*math.sin(a)**2-depth,.12*math.sin(a)*.92,-.47-.012*math.sin(a)**2+.006*math.cos(a)+depth*.5));uv.append((1560/W,1-638/H))
for row in range(2):
 for j in range(NA):
  q=(NX-1+row)*(NA+1)+j;fs.append((q+NA+1,q+NA+2,q+1,q))
fs.append(tuple((NX+1)*(NA+1)+j for j in reversed(range(NA))))
body=mesh('CoryBody',vs,fs,bodymat,uv);body.data.materials.append(cavity)
for face in body.data.polygons:
 if face.index>=oral_start:face.material_index=1
# Crown atlas: physical-width spots instead of side-projection stripes.
# Geometry is untouched; side pigment is resampled identically outside the crown blend.
AW,AH=1536,512
uu,vv=np.meshgrid((np.arange(AW)+.5)/AW,(np.arange(AH)+.5)/AH)
px=405+1205*uu;ang=vv*math.tau;co=np.cos(ang)
top=np.interp(px,guides[:,0],guides[:,1]);bot=np.interp(px,guides[:,0],guides[:,2]);wid=np.interp(px,guides[:,0],guides[:,3])
sy=(top+bot)/2-np.where(co>=0,co,-np.maximum(-co,0)**.46)*(bot-top)/2
f=1-(1-np.clip((px-1500)/110,0,1))**1.2;sy=sy*(1-f)+638*f
ix=np.clip(np.minimum(px,1570).astype(int),0,W-1);iy=np.clip((H-1-sy).astype(int),0,H-1)
base=arr[iy,ix].copy()
# Cumulative arc length of forehead profile avoids spots flattening as snout slopes.
gx=np.linspace(405,1610,2000);gz=(550-np.interp(gx,guides[:,0],guides[:,1]))/280
arc=np.r_[0,np.cumsum(np.sqrt((np.diff(gx)/280)**2+np.diff(gz)**2))]
longitudinal=np.interp(px,gx,arc);cross=np.sin(ang)*wid
rng=np.random.default_rng(2718);spots=np.zeros_like(px)
for ll in np.arange(1.7,arc[-1]+.16,.13):
 for cc in np.arange(-.55,.56,.115):
  cx=ll+rng.uniform(-.052,.052);cy=cc+rng.uniform(-.042,.042);rx=rng.uniform(.030,.050);ry=rng.uniform(.025,.043)
  d=((longitudinal-cx)/rx)**2+((cross-cy)/ry)**2
  spotshape=np.clip((1.23-d+.21*np.sin(longitudinal*95+cross*71)+.12*np.sin(cross*157-longitudinal*69))/.71,0,1)
  spots=np.maximum(spots,spotshape*rng.uniform(.78,1))
grain=.003*np.sin(longitudinal*153+cross*83)*np.sin(cross*197-longitudinal*43)
dark=np.array([.076,.052,.033]);light=np.array([.32,.25,.16]);pigment=dark+(light-dark)*spots[...,None]+grain[...,None]
blend=np.clip((px-950)/200,0,1)*np.clip((co-.32)/.33,0,1)
blend=blend*blend*(3-2*blend)
base[:,:,:3]=base[:,:,:3]*(1-blend[...,None])+pigment*blend[...,None]
# Two serial armor rows wrap each flank; the opposed sides and dorsal seam agree.
# Work in longitudinal/body-angular coordinates, not in the side-projective pigment.
def ramp(v, lo, hi):
 t=np.clip((v-lo)/(hi-lo),0,1)
 return t*t*(3-2*t)
envelope=ramp(px,436,542)*(1-ramp(px,1170,1340))
upper_mask=ramp(co,-.02,.08)*(1-ramp(co,.80,.98))
lower_mask=ramp(co,-.78,-.55)*(1-ramp(co,-.10,.01))
distortion=.17*np.sin((px-430)*.012)+.075*np.sin((px-420)*.041+co*6)
u_upper=(px-442)/(37+4*ramp(px,500,1190))+distortion + .43*co*co
u_lower=(px-442)/(38+4*ramp(px,500,1190))+distortion + .27 + .47*co*co
def tile_phase(t):
 phase=t%1
 # Soft broad face and rounded edge, with no geometric cuts or painted outlines.
 lip=ramp(phase,.0,.23)
 fall=1-ramp(phase,.30,1.0)
 edge=np.exp(-((phase-.17)/.14)**2)
 return lip*fall, edge
tile_a,edge_a=tile_phase(u_upper);tile_b,edge_b=tile_phase(u_lower)
surface=tile_a*upper_mask+tile_b*lower_mask
edge=(edge_a*upper_mask+edge_b*lower_mask)*envelope
join=np.exp(-((co+.045+.018*np.sin(px*.058))/.055)**2)
micro=np.sin(px*.72+np.sin(ang*79))*np.sin(ang*113+px*.19)
fine=np.sin(px*.31+ang*83)*np.sin(px*.22-ang*63)
texture_height=envelope*(.0105*surface-.0030*join)+.00023*micro+.00028*fine
# The sides are nearly cylindrical in the atlas. Correct relief derivatives for texel dimensions.
dy,dx=np.gradient(texture_height)
sx=(1205/280)/AW
sy_metric=np.maximum(.12,wid)*math.tau/AH
nx=np.clip(-dx/sx,-.44,.44)
ny=np.clip(-dy/sy_metric,-.34,.34)
nz=1/np.sqrt(1+nx*nx+ny*ny)
ones=np.ones_like(nx)
anormal=np.stack([nx*nz*.5+.5,ny*nz*.5+.5,nz*.5+.5,ones],axis=-1)
rough=np.clip(.48+.085*join*envelope+.060*(1-envelope)+.023*fine-.115*edge+.026*surface,.34,.63)
packed=np.stack([ones,rough,np.zeros_like(ones),ones],axis=-1)
# Preserve the pigmentation pattern: relief reads mainly in reflected light, not as ink.
# The old lateral projection stretches abruptly under the body's widest line.
# Blend in softly segmented, longitudinal pigmentation across that transition and the abdomen,
# continuing the dark band / pale speckle rhythm without deriving relief from the pattern.
linecoord=co*4.25 + .18*np.sin(px*.008) + .10*np.sin(px*.025+co*11)
stripe=ramp(np.cos(linecoord*math.tau),.05,.82)
mottle=.50+.20*np.sin(px*.077+co*26)*np.sin(px*.11-co*84)+.15*np.sin(px*.035+co*125)
contrast=(.70+.30*np.sin(px*.086+co*27)**2)*(1-ramp(-co,.40,.91))
tone=(.29+.092*mottle+.028*ramp(-co,.25,.93))*(1-.51*stripe*contrast)
belly_pigment=tone[...,None]*np.array([1.03,.84,.63])+(.006*fine)[...,None]
belly_mask=(1-ramp(co,-.10,.34))*(.68+.22*ramp(-co,.00,.65))
belly_mask*=ramp(px,425,550)*(1-ramp(px,1355,1535))
base[:,:,:3]=base[:,:,:3]*(1-belly_mask[...,None])+belly_pigment*belly_mask[...,None]
base[:,:,:3]*=(1+envelope*(.014*surface-.018*join))[...,None]
nodes=bodymat.node_tree.nodes;links=bodymat.node_tree.links
p=nodes.get('Principled BSDF')
atlasuv=nodes.new('ShaderNodeUVMap');atlasuv.uv_map='CrownUV'
for label,pixels in [('crown-albedo',base),('cory-armor-normal',anormal),('cory-armor-roughness',packed)]:
 atlas=bpy.data.images.new(label,AW,AH,alpha=True)
 if not label.endswith('albedo'):atlas.colorspace_settings.name='Non-Color'
 atlas.pixels.foreach_set(pixels.astype('float32').ravel());atlas.filepath_raw=OUT+'/'+label+'.png';atlas.file_format='PNG';atlas.save();atlas.pack()
 tex=nodes.new('ShaderNodeTexImage');tex.image=atlas;links.new(atlasuv.outputs['UV'],tex.inputs['Vector'])
 if label.endswith('albedo'):links.new(tex.outputs['Color'],p.inputs['Base Color'])
 elif label.endswith('normal'):
  nm=nodes.new('ShaderNodeNormalMap');nm.uv_map='CrownUV';nm.inputs['Strength'].default_value=.85
  links.new(tex.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],p.inputs['Normal'])
 else:
  separate=nodes.new('ShaderNodeSeparateColor')
  links.new(tex.outputs['Color'],separate.inputs['Color']);links.new(separate.outputs['Green'],p.inputs['Roughness']);links.new(separate.outputs['Blue'],p.inputs['Metallic'])
crownuv=body.data.uv_layers.new(name="CrownUV")
for loop in body.data.loops:
 vi=loop.vertex_index;ring=vi//(NA+1);col=vi%(NA+1)
 crownuv.data[loop.index].uv=(min(ring,NX-1)/(NX-1),col/NA)

def interp(points,t):
 n=len(points)-1;q=t*n;i=min(n-1,int(q));f=q-i;p0=Vector(points[max(0,i-1)]);p1=Vector(points[i]);p2=Vector(points[i+1]);p3=Vector(points[min(n,i+2)]);return .5*((2*p1)+(-p0+p2)*f+(2*p0-5*p1+4*p2-p3)*f*f+(-p0+3*p1-3*p2+p3)*f*f*f)
def fan(name,roots,ends,n=33,steps=12,side=0,spread=0):
 vs=[];fs=[];uv=[]
 for j in range(n):
  q=j/(n-1);r=interp(roots,q);e=interp(ends,q)
  for k in range(steps+1):
   t=(k/steps)**1.3;pt=r.lerp(e,t);yy=side+spread*t*((1-q) if "Pectoral" in name else math.sin(math.pi*q))+.016*math.sin(math.pi*t)*math.sin(math.pi*q);vs.append(world(pt.x,pt.y,yy));uv.append((pt.x/W,1-pt.y/H))
 for j in range(n-1):
  for k in range(steps):
   a=j*(steps+1)+k;fs.append((a,a+1,a+steps+2,a+steps+1))
 return mesh(name,vs,fs,finmat,uv)
fan('CoryTail',[(430,475),(430,530),(430,590)],[(40,285),(165,530),(62,752)],n=41)
fan('CoryDorsal',[(1070,284),(940,300),(810,340),(715,355)],[(1070,284),(840,46),(730,152),(715,355)],n=41)
fan('CoryAdipose',[(620,391),(535,426)],[(620,391),(493,354),(535,426)],n=17)
fan('CoryAnal',[(670,677),(480,632)],[(670,677),(480,754),(480,632)],n=21)
def tube(name,pts,radii,material):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=12;cu.bevel_depth=1;cu.bevel_resolution=2;sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
 for p,co,r in zip(sp.bezier_points,pts,radii):p.co=co;p.radius=r;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
 ob=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(ob);cu.materials.append(material);return ob
for side in [-1,1]:
 suf='L' if side>0 else 'R'
 fan('CoryPectoral_'+suf,[(1180,650),(1135,675),(1090,686)],[(955,808),(950,760),(1090,686)],n=27,side=side*.30,spread=side*.60)
 tube('CoryPectoral_'+suf+'_spine',[world(1180,650,side*.30),world(1090,718,side*.56),world(955,808,side*.90)],[.023,.018,.005],orange)
 fan('CoryPelvic_'+suf,[(860,700),(770,697)],[(860,700),(748,810),(713,799)],n=21,side=side*.22,spread=side*.22)
 for number,pts,radii in [
 (0,[(2.10,side*.115,-.47),(2.21,side*.22,-.57),(2.28,side*.29,-.70)],[.012,.008,.001]),
 (1,[(2.14,side*.067,-.48),(2.23,side*.10,-.63),(2.22,side*.15,-.82)],[.010,.006,.0008]),
 (2,[(2.09,side*.052,-.49),(2.12,side*.067,-.58),(2.10,side*.085,-.65)],[.007,.004,.0007])]:
  hit,loc,n,idx=body.closest_point_on_mesh(Vector(pts[0]))
  if hit:pts[0]=tuple(loc-n*.008)
  tube('CoryBarbel_'+suf+str(number),pts,radii,barbelmat)
# Single slightly raised conforming eye with thin muted warm iris, no white globe.
eyemat=mat('Small dark cory eye',(.04,.035,.028),.25);p=eyemat.node_tree.nodes.get('Principled BSDF');n=eyemat.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='EyeColor';eyemat.node_tree.links.new(n.outputs['Color'],p.inputs['Base Color'])
def skin(px,py):
 top,bot,w=shape(px);co=((top+bot)/2-py)/((bot-top)/2)
 if co<0:co=-(-co)**(1/.46)
 return w*math.sqrt(max(.01,1-co*co))
for side in [-1,1]:
 vs=[];fs=[];cols=[]
 for rr in [0,.055,.09,.102,.112,.132,.149]:
  for j in range(48):
   a=j/48*math.tau;px=1380+rr*280*math.cos(a);py=485-rr*280*math.sin(a);yy=skin(px,py)+.004+.014*(1-(rr/.149)**2);vs.append(world(px,py,side*yy))
   cols.append((.004,.004,.003,1) if rr<=.09 else (.22,.13,.055,1) if rr<=.112 else (.055,.045,.033,1))
 for i in range(6):
  for j in range(48):
   a=i*48+j;b=i*48+(j+1)%48;f=(a,b,b+48,a+48);fs.append(f if side>0 else f[::-1])
 ob=mesh('CoryEye_'+('L' if side>0 else 'R'),vs,fs,eyemat);l=ob.data.color_attributes.new(name='EyeColor',type='FLOAT_COLOR',domain='POINT')
 for c,v in zip(l.data,cols):c.color=v
for o in list(bpy.context.scene.objects):
 if o.type=='CURVE':bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
# Keep paired pectoral fins one named mesh each despite their orange leading rays.
for suf in ['L','R']:
 bpy.ops.object.select_all(action='DESELECT');ob=bpy.data.objects['CoryPectoral_'+suf];ob.select_set(True);bpy.data.objects['CoryPectoral_'+suf+'_spine'].select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.join()
# Batch all barbels, but preserve six disconnected tapered strands for editing.
bpy.ops.object.select_all(action='DESELECT');bars=[o for o in bpy.context.scene.objects if o.name.startswith('CoryBarbel_')]
for o in bars:o.select_set(True)
bpy.context.view_layer.objects.active=bars[0];bpy.ops.object.join();bars[0].name='CoryBarbels'
model=list(bpy.context.scene.objects)
bpy.ops.object.select_all(action='DESELECT');bpy.ops.object.armature_add(enter_editmode=True);rig=bpy.context.object;rig.name='CoryRig';rig.data.edit_bones.remove(rig.data.edit_bones[0]);xs=[1.8,.8,-.4,-1.5,-2.2,-3];prev=None
for i,x in enumerate(xs):
 b=rig.data.edit_bones.new('CorySpine_%d'%i);b.head=(x,0,0);b.tail=(x-.7,0,0)
 if prev:b.parent=prev
 prev=b
bpy.ops.object.mode_set(mode='OBJECT')
for ob in model:
 gs=[ob.vertex_groups.new(name='CorySpine_%d'%i) for i in range(len(xs))]
 for v in ob.data.vertices:
  (a,i),(b,j)=sorted((abs(v.co.x-x),i) for i,x in enumerate(xs))[:2];d=max(a+b,1e-6);gs[i].add([v.index],b/d,'REPLACE');gs[j].add([v.index],a/d,'REPLACE')
 ob.parent=rig;mod=ob.modifiers.new('Editable cory skin','ARMATURE');mod.object=rig
im.pack()
bpy.ops.object.select_all(action='DESELECT')
for o in model+[rig]:o.select_set(True)
bpy.context.view_layer.objects.active=body;bpy.ops.export_scene.gltf(filepath=OUT+'/sterbai-cory.glb',export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=32;s.cycles.use_denoising=False;s.render.resolution_x=1280;s.render.resolution_y=800;s.render.resolution_percentage=100;s.world.color=(.05,.055,.06);s.view_settings.view_transform='AgX'
for name,loc,power,size in [('Key',(3,-5,6),650,5),('Fill',(3,3,1),160,3),('Rim',(-3,3,4),700,4)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=7;s.camera=cam
for label,loc in [('oblique',(4,-9,3)),('side',(0,-10,.1)),('front',(10,-.01,.5)),('rear',(-9,-3,2)),('under',(4,-6,-5))]:
 cam.location=loc;cam.rotation_euler=(Vector((-.5,0,.15))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.image_settings.file_format='PNG';s.render.filepath=OUT+'/review-'+label+'.png'
 if label=='oblique':bpy.ops.wm.save_as_mainfile(filepath=OUT+'/sterbai-cory.blend')
 bpy.ops.render.render(write_still=True)
print('CORY_COMPLETE',len(model),'meshes',sum(len(o.data.vertices) for o in model),'vertices')
for ob in model:
 print('BOUNDS',ob.name,tuple(min(v.co[k] for v in ob.data.vertices) for k in range(3)),tuple(max(v.co[k] for v in ob.data.vertices) for k in range(3)))

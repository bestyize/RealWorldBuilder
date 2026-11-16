"""Reproducible P. scalare mesh and authored/generated-reference PBR assets.
Run: blender -b --python fish/silver-angelfish/build_model.py
Real photographs informed geometry only; no external photo pixels are used.
"""
import bpy,math,os,numpy as np
from mathutils import Vector
OUT=os.path.dirname(os.path.abspath(__file__))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
src=bpy.data.images.load(OUT+'/concept-generated.png');W,H=src.size
arr=np.empty(W*H*4,dtype=np.float32);src.pixels.foreach_get(arr);arr=arr.reshape(H,W,4)
# Extend generated edge colors outside its cutout before opaque projection.
# This avoids copying black transparent RGB into the closed fin geometry.
valid=arr[:,:,3]>.94
for row in range(H):
 ids=np.flatnonzero(valid[row])
 if len(ids):
  grid=np.arange(W);pos=np.searchsorted(ids,grid);left=ids[np.clip(pos-1,0,len(ids)-1)];right=ids[np.clip(pos,0,len(ids)-1)];nearest=np.where(abs(grid-left)<abs(grid-right),left,right);arr[row,~valid[row],:3]=arr[row,nearest[~valid[row]],:3]
# Soft 2D extension in uncovered membrane regions avoids row-wise ladders.
soft=np.zeros_like(arr[:,:,:3])
for offset in range(-18,19):soft+=np.roll(arr[:,:,:3],offset,axis=0)
soft/=37
smoothed=np.zeros_like(soft)
for offset in range(-10,11):smoothed+=np.roll(soft,offset,axis=1)
smoothed/=21
arr[:,:,:3]=np.where(valid[:,:,None],arr[:,:,:3],smoothed)
y,x=np.meshgrid(np.arange(H),np.arange(W),indexing='ij');py=H-1-y
# Neutralize generated painted eye before a single integrated 3D eye is seated.
e=((x-872)/40)**2+((py-525)/38)**2;mask=np.clip((1.5-e)*2,0,1)[...,None]
replacement=arr[np.clip(y-70,0,H-1),x,:3];arr[:,:,:3]=arr[:,:,:3]*(1-mask)+replacement*mask
arr[:,:,:3]*=.91;arr[:,:,3]=1
im=bpy.data.images.new('Generated angelfish albedo',W,H,alpha=True);im.pixels.foreach_set(arr.ravel());im.filepath_raw=OUT+'/angelfish-albedo.png';im.file_format='PNG';im.save()
def blur(a,r):
 b=np.zeros_like(a)
 for i in range(-r,r+1):b+=np.roll(a,i,axis=0)
 a=b/(2*r+1);b=np.zeros_like(a)
 for i in range(-r,r+1):b+=np.roll(a,i,axis=1)
 return b/(2*r+1)
# Fine staggered overlapping scale margins, not a dark grid in the albedo.
lum=arr[:,:,:3]@np.array([.2126,.7152,.0722]);fine=blur(lum,2)-blur(lum,7)
row=np.floor(y/8.5);v=(y/8.5-row)-.5
u=((x/11.5+.5*(row%2)+.055*np.sin(row*1.73))%1)-.5
edge=u-(-.26+1.12*v*v)
margin=np.exp(-(edge/.075)**2)*np.maximum(0,1-(v/.53)**6)
plate=np.exp(-((u+.03)/.38)**2-(v/.49)**2)
# Taper relief into small head tissue and near top/bottom profile to avoid crown stripes.
gpx=np.array([365,385,420,470,540,610,680,750,820,890,950,978])
gtop=np.array([520,510,487,405,330,292,299,330,380,445,497,527]);gbot=np.array([600,608,630,690,740,765,767,740,690,615,560,538])
top=np.interp(x,gpx,gtop);bot=np.interp(x,gpx,gbot)
mask=np.clip((py-top-4)/24,0,1)*np.clip((bot-py-4)/24,0,1)*np.clip((945-x)/90,0,1)
height=(.42*margin+.16*plate)*mask+.35*fine
dy,dx=np.gradient(height)
nx=np.clip(-dx*1.7,-.45,.45);ny=np.clip(-dy*1.7,-.45,.45)
normal=np.stack([nx*.5+.5,ny*.5+.5,np.sqrt(1-nx*nx-ny*ny)*.5+.5,np.ones_like(nx)],-1).astype('float32')
nim=bpy.data.images.new('Subtle scale normals',W,H,alpha=True);nim.colorspace_settings.name='Non-Color';nim.pixels.foreach_set(normal.ravel());nim.filepath_raw=OUT+'/angelfish-normal.png';nim.file_format='PNG';nim.save()
cell=np.sin(np.floor(x/11.5+.5*(row%2))*12.9898+row*78.233)*43758.5453;cell=cell-np.floor(cell)
rough=np.clip(.47+.065*(cell-.5)*mask+.085*margin*mask+.025*np.sin(x*.39+y*.73)*mask,.39,.61)
packed=np.stack([np.ones_like(rough),rough,np.zeros_like(rough),np.ones_like(rough)],-1).astype('float32')
rim=bpy.data.images.new('Scale roughness G metallic B',W,H,alpha=True);rim.colorspace_settings.name='Non-Color';rim.pixels.foreach_set(packed.ravel());rim.filepath_raw=OUT+'/angelfish-roughness.png';rim.file_format='PNG';rim.save()
def material(name,c,rough=.4):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Specular IOR Level'].default_value=.32;return m
bodymat=material('Fine silver scale tissue',(1,1,1));p=bodymat.node_tree.nodes.get('Principled BSDF');p.inputs['Coat Weight'].default_value=0;p.inputs['Specular IOR Level'].default_value=.26
for image,socket in [(im,'Base Color')]:
 n=bodymat.node_tree.nodes.new('ShaderNodeTexImage');n.image=image;bodymat.node_tree.links.new(n.outputs['Color'],p.inputs[socket])
n=bodymat.node_tree.nodes.new('ShaderNodeTexImage');n.image=nim;nm=bodymat.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.72;bodymat.node_tree.links.new(n.outputs['Color'],nm.inputs['Color']);bodymat.node_tree.links.new(nm.outputs['Normal'],p.inputs['Normal'])
n=bodymat.node_tree.nodes.new('ShaderNodeTexImage');n.image=rim;sep=bodymat.node_tree.nodes.new('ShaderNodeSeparateColor');bodymat.node_tree.links.new(n.outputs['Color'],sep.inputs['Color']);bodymat.node_tree.links.new(sep.outputs['Green'],p.inputs['Roughness'])
finmat=material('Dense ray supported fin membrane',(1,1,1),.48);fp=finmat.node_tree.nodes.get('Principled BSDF');n=finmat.node_tree.nodes.new('ShaderNodeTexImage');n.image=im;finmat.node_tree.links.new(n.outputs['Color'],fp.inputs['Base Color'])
# All membrane interiors write depth; no body-through-fin ghosting.
finmat.use_backface_culling=False
filmat=material('Pearl pelvic filaments',(.48,.49,.45),.42)
def world(px,py,side=0):return ((px-650)/220,side,(550-py)/220)
def mesh(name,vs,fs,mat,uv=None):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);me.materials.append(mat)
 for f in me.polygons:f.use_smooth=True
 if uv:
  layer=me.uv_layers.new()
  for l in me.loops:layer.data[l.index].uv=uv[l.vertex_index]
 return ob
# Anatomical body excludes dorsal/anal sails. Smooth true compressed volume.
guides=np.array([(365,520,600,.002),(385,510,608,.035),(420,487,630,.075),(470,405,690,.135),(540,330,740,.195),(610,292,765,.225),(680,299,767,.235),(750,330,740,.22),(820,380,690,.18),(890,445,615,.125),(950,497,560,.065),(978,527,538,.010)],float)
def profile(px):return [float(np.interp(px,guides[:,0],guides[:,i])) for i in [1,2,3]]
vs=[];fs=[];uv=[];NR=160;NA=80
for i in range(NR):
 px=365+(978-365)*i/(NR-1);top,bot,width=profile(px)
 for j in range(NA+1):
  a=j/NA*math.tau;py=(top+bot)/2-math.cos(a)*(bot-top)/2
  vs.append(world(px,py,math.sin(a)*width));uv.append((px/W,1-py/H))
for i in range(NR-1):
 for j in range(NA):
  q=i*(NA+1)+j;fs.append((q+NA+1,q+NA+2,q+1,q))
fs.append(tuple(range(NA)));fs.append(tuple((NR-1)*(NA+1)+j for j in reversed(range(NA))))
body=mesh('AngelBody',vs,fs,bodymat,uv)
def interpolate(points,t):
 n=len(points)-1;q=t*n;i=min(n-1,int(q));f=q-i;p0=points[max(0,i-1)];p1=points[i];p2=points[i+1];p3=points[min(n,i+2)];return [.5*((2*p1[k])+(-p0[k]+p2[k])*f+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*f*f+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*f*f*f) for k in range(2)]
def fan(name,roots,ends,n=49,steps=20,side=0):
 vs=[];uv=[];fs=[]
 for j in range(n):
  q=j/(n-1);r=interpolate(roots,q);e=interpolate(ends,q)
  for k in range(steps+1):
   t=k/steps;px=r[0]*(1-t)+e[0]*t;py=r[1]*(1-t)+e[1]*t
   yy=side+(.018*math.sin(q*math.pi)*math.sin(t*math.pi));vs.append(world(px,py,yy));uv.append((px/W,1-py/H))
 for j in range(n-1):
  for k in range(steps):
   a=j*(steps+1)+k;fs.append((a,a+1,a+steps+2,a+steps+1))
 return mesh(name,vs,fs,finmat,uv)
# Base points lie slightly inside the opaque body; sail outline follows reference.
fan('AngelDorsal',[(710,325),(625,305),(550,342),(495,385),(455,448),(412,503)],[(710,325),(555,240),(222,24),(330,235),(350,408),(412,503)])
fan('AngelAnal',[(795,702),(710,743),(630,750),(550,723),(480,683),(413,615)],[(795,702),(660,880),(292,1220),(380,1080),(390,825),(413,615)])
fan('AngelTail',[(389,526),(389,568),(389,596)],[(130,443),(181,604),(135,786)],n=43)
# Paired pectorals are separate small swept membranes rather than painted stripes.
for side in [-1,1]:
 name='L' if side>0 else 'R'
 ob=fan('AngelPectoral_'+name,[(778,594),(777,610),(771,625)],[(775,594),(666,566),(687,680)],n=21,steps=12,side=side*.182)
 for v in ob.data.vertices:
  t=max(0,min(1,(.58-v.co.x)/.55));v.co.y+=side*.16*t
 # Two long separate, curved tactile pelvic rays, with tapered geometry.
 pts=[world(780,716,side*.105),world(748,800,side*.13),world(665,1000,side*.18),world(555 if side>0 else 490,1190,side*.22),world(500 if side>0 else 425,1255,side*.20)]
 cu=bpy.data.curves.new('Pelvic','CURVE');cu.dimensions='3D';cu.resolution_u=16;cu.bevel_depth=.024;cu.bevel_resolution=3;sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
 for b,co,rad in zip(sp.bezier_points,pts,[1,.67,.32,.12,.025]):b.co=co;b.radius=rad;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 ob=bpy.data.objects.new('AngelPelvic_'+name,cu);bpy.context.collection.objects.link(ob);cu.materials.append(filmat)
# Single integrated colored eye caps, smoothly conforming to the cheek.
eyemat=material('Muted bronze iris and dark pupil',(.1,.1,.07),.24);p=eyemat.node_tree.nodes.get('Principled BSDF');attr=eyemat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='EyeColor';eyemat.node_tree.links.new(attr.outputs['Color'],p.inputs['Base Color'])
def skin(px,py):
 top,bot,w=profile(px);return w*math.sqrt(max(.01,1-((py-(top+bot)/2)/((bot-top)/2))**2))
for side in [-1,1]:
 vs=[];fs=[];colors=[];rads=[0,.025,.047,.055,.065,.08,.094,.106,.112]
 for r in rads:
  for j in range(64):
   a=j/64*math.tau;px=874+math.cos(a)*r*220;py=526-math.sin(a)*r*220;yy=skin(px,py)+.003+.012*(1-(r/.112)**2);vs.append(world(px,py,side*yy))
   if r<=.055:c=(.005,.007,.007,1)
   elif r<.106:c=(.22,.185,.09,1)
   else:c=(.27,.29,.24,1)
   colors.append(c)
 for i in range(len(rads)-1):
  for j in range(64):
   q=i*64+j;n=i*64+(j+1)%64;f=(q,n,n+64,q+64);fs.append(f if side>0 else f[::-1])
 ob=mesh('AngelEye_'+('L' if side>0 else 'R'),vs,fs,eyemat);layer=ob.data.color_attributes.new(name='EyeColor',type='FLOAT_COLOR',domain='POINT')
 for c,val in zip(layer.data,colors):c.color=val
for ob in list(bpy.context.scene.objects):
 if ob.type=='CURVE':bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');ob.select_set(False)
model=list(bpy.context.scene.objects)
bpy.ops.object.select_all(action='DESELECT');bpy.ops.object.armature_add(enter_editmode=True);rig=bpy.context.object;rig.name='AngelRig';rig.data.edit_bones.remove(rig.data.edit_bones[0]);xs=[1.1,.2,-.6,-1.25,-1.85]
prev=None
for i,x in enumerate(xs):
 b=rig.data.edit_bones.new('AngelSpine_%d'%i);b.head=(x,0,0);b.tail=(x-.55,0,0)
 if prev:b.parent=prev
 prev=b
# Fin control bones preserved for editing, not forced to run by JS.
for name,head,tail in [('Dorsal',(0,0,1),(-1,0,2)),('Anal',(0,0,-.9),(-1,0,-2)),('Pelvic_L',(.59,.105,-.75),(-.5,.2,-2.7)),('Pelvic_R',(.59,-.105,-.75),(-.7,-.2,-2.7))]:
 b=rig.data.edit_bones.new(name);b.head=head;b.tail=tail;b.parent=rig.data.edit_bones['AngelSpine_1']
bpy.ops.object.mode_set(mode='OBJECT')
for ob in model:
 groups=[ob.vertex_groups.new(name='AngelSpine_%d'%i) for i in range(len(xs))]
 for v in ob.data.vertices:
  near=sorted((abs(v.co.x-x),i) for i,x in enumerate(xs))[:2];(a,i),(b,j)=near;d=max(a+b,1e-6);groups[i].add([v.index],b/d,'REPLACE');groups[j].add([v.index],a/d,'REPLACE')
 control={'AngelDorsal':'Dorsal','AngelAnal':'Anal','AngelPelvic_L':'Pelvic_L','AngelPelvic_R':'Pelvic_R'}.get(ob.name)
 if control:
  g=ob.vertex_groups.new(name=control)
  for v in ob.data.vertices:
   w=max(0,min(.85,(abs(v.co.z)-1.05)/1.8))
   if w>0:
    for old in groups:
     try:old.add([v.index],old.weight(v.index)*(1-w),'REPLACE')
     except RuntimeError:pass
    g.add([v.index],w,'REPLACE')
 mod=ob.modifiers.new('Editable angelfish skin','ARMATURE');mod.object=rig;ob.parent=rig
for img in [im,nim,rim,src]:img.pack()
bpy.ops.object.select_all(action='DESELECT')
for ob in model+[rig]:ob.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.export_scene.gltf(filepath=OUT+'/silver-angelfish.glb',export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=64;s.cycles.use_denoising=False;s.render.resolution_x=1280;s.render.resolution_y=960;s.render.resolution_percentage=100;s.world.color=(.055,.06,.07);s.view_settings.view_transform='AgX'
for name,loc,power,size in [('Key',(3,-5,6),650,5),('Rim',(-3,3,3),700,4),('Fill',(3,3,0),120,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3,-9,2));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=8.4;s.camera=cam
for label,loc in [('oblique',(3,-9,1.6)),('side',(0,-10,0)),('front',(10,-.01,.3))]:
 cam.location=loc;cam.rotation_euler=(Vector((-.3,0,-.3))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.image_settings.file_format='PNG';s.render.filepath=OUT+'/review-'+label+'.png'
 if label=='oblique':bpy.ops.wm.save_as_mainfile(filepath=OUT+'/silver-angelfish.blend')
 bpy.ops.render.render(write_still=True)
print('ANGEL_COMPLETE',len(model),'meshes',sum(len(o.data.vertices) for o in model),'vertices')

# Additional grazing-angle macro proof, no geometry or scene-material substitution.
cam.data.ortho_scale=2.5;cam.location=(2,-7,2);cam.rotation_euler=(Vector((.1,0,.15))-cam.location).to_track_quat('-Z','Y').to_euler();s.render.filepath=OUT+'/review-material-close.png';bpy.ops.render.render(write_still=True)

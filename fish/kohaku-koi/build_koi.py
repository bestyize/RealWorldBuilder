import bpy, math, os, numpy as np
from mathutils import Vector
OUT=os.environ.get('KOI_OUT',os.path.dirname(os.path.abspath(__file__)))
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
# Bake source concept pixels around a true 3D flank. Source is ImageGen,
# not a wildlife photograph; original texture detail is retained rather than
# replaced with a synthetic repeated scale pattern.
W,H=2048,1024
source=bpy.data.images.load(OUT+'/concept-side.png');pw,ph=source.size
pixels=np.empty(pw*ph*4,dtype=np.float32);source.pixels.foreach_get(pixels);photo=pixels.reshape(ph,pw,4)[::-1]
def sample(x,y):
 x=np.clip(x,0,pw-1);y=np.clip(y,0,ph-1);ix=x.astype(int);iy=y.astype(int)
 fx=(x-ix)[...,None];fy=(y-iy)[...,None]
 return (photo[iy,ix]*(1-fx)+photo[iy,np.minimum(ix+1,pw-1)]*fx)*(1-fy)+(photo[np.minimum(iy+1,ph-1),ix]*(1-fx)+photo[np.minimum(iy+1,ph-1),np.minimum(ix+1,pw-1)]*fx)*fy
# Deliberately trace body separately from overlapping fins.
guides=np.array([(430,282,467),(530,280,470),(650,261,494),(800,222,545),(1000,175,585),(1200,154,601),(1400,153,600),(1600,171,582),(1780,221,551),(1910,278,524),(2020,341,500),(2090,388,477),(2115,420,451)],dtype=float)
u,v=np.meshgrid(np.linspace(0,1,W),np.linspace(0,1,H));a=v*2*np.pi
px=430+1685*u;top=np.interp(px,guides[:,0],guides[:,1]);bottom=np.interp(px,guides[:,0],guides[:,2]);side=(1-np.cos(a))*.5
py=top+(.035+.93*side)*(bottom-top)
rgba=sample(px,py);rgb=rgba[...,:3]
# Suppress baked iris under the separate 3D globe, retaining the cheek color.
e=((px-1940)/43)**2+((py-401)/38)**2;mask=np.clip((1.6-e)*2,0,1)[...,None]
cheek=sample(px,np.minimum(py+65,bottom-12))[...,:3];rgb=rgb*(1-mask)+cheek*mask
# Pectoral root overlap on source lower right is reconstructed as skin.
mask=(np.clip((px-1390)/90,0,1)*np.clip((1720-px)/70,0,1)*np.clip((py-493)/37,0,1))[...,None]
skin=sample(px,np.minimum(py,486))[...,:3];rgb=rgb*(1-mask)+skin*mask
# Conservative albedo: reduce baked key highlights, lift shaded belly slightly.
lum=rgb@np.array([.2126,.7152,.0722]);rgb*=((.88+.10*side)*(1-.10*np.clip((lum-.75)/.25,0,1)))[...,None]
rgba=np.concatenate([np.clip(rgb,0,1),np.ones((H,W,1))],-1).astype('float32')

def lift_baked_shadows(color, amount):
 red, green, blue = np.moveaxis(color, -1, 0)
 contrast = (red - np.maximum(green, blue)) / np.maximum(.10, red)
 pigment = np.clip((contrast - .18) / .34, 0, 1)
 pigment = pigment * pigment * (3 - 2 * pigment)
 # Brighten ivory independently of the red markings, retaining scale detail.
 bright_red = color * (1 + .14 * pigment * (1 - color.max(axis=-1)))[..., None]
 return np.clip(bright_red + (1 - pigment[..., None]) * amount * (1 - color), 0, 1)

albedo = rgba.copy()
albedo[..., :3] = lift_baked_shadows(rgba[..., :3], .51)
im=bpy.data.images.new('Kohaku photo-derived pigment',W,H,alpha=True);im.pixels.foreach_set(albedo.ravel());im.filepath_raw=OUT+'/kohaku-basecolor.png';im.file_format='PNG';im.save()

# Keep the fin rays and alpha. Give near-transparent texels an ivory edge
# color so the opaque dorsal membrane can sample them without a dark border.
fin_pixels = photo.copy()
visible = np.clip(photo[..., 3:4] / .24, 0, 1)
fin_pixels[..., :3] = lift_baked_shadows(photo[..., :3], .38) * visible + np.array([.82, .80, .76]) * (1 - visible)
fin_image = bpy.data.images.new('Kohaku fin color', pw, ph, alpha=True)
fin_image.pixels.foreach_set(fin_pixels[::-1].ravel())
fin_image.pack()

def mat(name,c,rough=.36,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
bodymat=mat('Kohaku porcelain scales',(1,1,1),.43,0.0)
p=bodymat.node_tree.nodes.get('Principled BSDF');p.inputs['Coat Weight'].default_value=.025;p.inputs['Coat Roughness'].default_value=.32;p.inputs['Specular IOR Level'].default_value=.32
tex=bodymat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;bodymat.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
# PBR normal map retains fine scale relief in glTF rather than Blender-only nodes.
def blur(src,sigma):
 radius=int(math.ceil(sigma*3));weights=np.exp(-.5*(np.arange(-radius,radius+1)/sigma)**2);weights/=weights.sum()
 dst=src
 for axis in [0,1]:
  pads=[(0,0)]*dst.ndim;pads[axis]=(radius,radius);padded=np.pad(dst,pads,mode='edge');out=np.zeros_like(dst)
  for offset,weight in enumerate(weights):
   slices=[slice(None)]*dst.ndim;slices[axis]=slice(offset,offset+dst.shape[axis]);out+=padded[tuple(slices)]*weight
  dst=out
 return dst
lum=rgba[...,:3]@np.array([.2126,.7152,.0722])
# Scale-edge relief derives only from reference detail at scale-sized frequencies.
# Log luminance removes broad lighting and avoids embossing entire pigment islands.
loglum=np.log(lum+.055);fine=blur(loglum,2.4);broad=blur(loglum,8.0);height=fine-broad
chroma=rgba[...,0]-rgba[...,1];cy,cx=np.gradient(blur(chroma,2.0));pigment=np.clip(np.hypot(cx,cy)*35,0,1)
# Soft head skin and underside retain their existing smoothness.
bodymask=(1-np.clip((u-.77)/.10,0,1))*(.65+.35*np.abs(np.sin(a)))
height*=bodymask*(1-.80*pigment)
dy,dx=np.gradient(height)
nx=np.clip(-dx*12,-.20,.20);ny=np.clip(-dy*12,-.20,.20)
n=np.stack([nx,ny,np.sqrt(np.maximum(.001,1-nx*nx-ny*ny))],-1)
nrgba=np.concatenate([n*.5+.5,np.ones((H,W,1))],-1).astype('float32')
nim=bpy.data.images.new('Koi scale normal',W,H,alpha=True);nim.colorspace_settings.name='Non-Color';nim.pixels.foreach_set(nrgba.ravel());nim.filepath_raw=OUT+'/kohaku-normal.png';nim.file_format='PNG';nim.save()
nt=bodymat.node_tree.nodes.new('ShaderNodeTexImage');nt.image=nim;nn=bodymat.node_tree.nodes.new('ShaderNodeNormalMap');nn.inputs['Strength'].default_value=.32;bodymat.node_tree.links.new(nt.outputs['Color'],nn.inputs['Color']);bodymat.node_tree.links.new(nn.outputs['Normal'],p.inputs['Normal'])
# Thin rims scatter light; smoother individual plates still carry wet highlights.
edge=blur(np.hypot(dx,dy),1.0);edge=np.clip(edge*55,0,1)
variation=np.clip(blur(height,2)*1.8,-.09,.09)
rough=np.clip(.34+edge*.15-variation,.28,.59)
rough=rough*bodymask+.39*(1-bodymask)
# glTF metallic-roughness: G = roughness, B = metallic, R reserved occlusion.
packed=np.stack([np.ones_like(rough),rough,np.zeros_like(rough),np.ones_like(rough)],-1).astype('float32')
rim=bpy.data.images.new('Koi metallic roughness',W,H,alpha=True);rim.colorspace_settings.name='Non-Color';rim.pixels.foreach_set(packed.ravel());rim.filepath_raw=OUT+'/kohaku-metallic-roughness.png';rim.file_format='PNG';rim.save()
rt=bodymat.node_tree.nodes.new('ShaderNodeTexImage');rt.image=rim;channels=bodymat.node_tree.nodes.new('ShaderNodeSeparateColor');channels.mode='RGB';bodymat.node_tree.links.new(rt.outputs['Color'],channels.inputs['Color']);bodymat.node_tree.links.new(channels.outputs['Green'],p.inputs['Roughness']);bodymat.node_tree.links.new(channels.outputs['Blue'],p.inputs['Metallic'])
finmat=mat('Photo derived warm fin membrane',(.6,.6,.55),.48,.0)
p=finmat.node_tree.nodes.get('Principled BSDF');p.inputs['Transmission Weight'].default_value=.10;p.inputs['Alpha'].default_value=.68
ft=finmat.node_tree.nodes.new('ShaderNodeTexImage');ft.image=fin_image;finmat.node_tree.links.new(ft.outputs['Color'],p.inputs['Base Color']);alpha_node=finmat.node_tree.nodes.new('ShaderNodeMath');alpha_node.operation='MULTIPLY';alpha_node.inputs[1].default_value=.70;finmat.node_tree.links.new(ft.outputs['Alpha'],alpha_node.inputs[0]);finmat.node_tree.links.new(alpha_node.outputs[0],p.inputs['Alpha'])
finmat.surface_render_method='DITHERED';finmat.use_backface_culling=False
raymat=mat('Fine ivory fin rays',(.53,.52,.44),.48)
eye=mat('Glossy black pupils',(.008,.011,.012),.10)
iris=mat('Antique silver iris',(.34,.39,.33),.25,.40)
lip=mat('Warm ivory lips',(.83,.77,.67),.34)
gill=mat('Gill fold shadow',(.31,.30,.27),.5)
# Dense smoothly tapered body, no squashed flat billboard geometry.
profile=[(-2.15,.075,.13),(-1.8,.12,.19),(-1.35,.24,.34),(-.7,.39,.51),(0,.51,.63),(.65,.56,.67),(1.1,.50,.57),(1.5,.40,.41),(1.85,.29,.26),(2.08,.23,.20),(2.23,.15,.145),(2.30,.005,.005)]
def radius(x,k):
 for i in range(len(profile)-1):
  if profile[i][0]<=x<=profile[i+1][0]:
   t=(x-profile[i][0])/(profile[i+1][0]-profile[i][0]);p0=profile[max(0,i-1)][k];p1=profile[i][k];p2=profile[i+1][k];p3=profile[min(len(profile)-1,i+2)][k]
   return max(.003,.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
 return profile[-1][k]
def mesh(name,verts,faces,material,uvs=None):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);me.materials.append(material)
 for p in me.polygons:p.use_smooth=True
 if uvs:
  uv=me.uv_layers.new()
  for p in me.polygons:
   for li in p.loop_indices:uv.data[li].uv=uvs[me.loops[li].vertex_index]
 return o
verts=[];uv=[];faces=[];NX=145;NA=80
for i in range(NX):
 xx=-2.15+4.45*i/(NX-1);wy=radius(xx,1);hz=radius(xx,2)
 for j in range(NA+1):
  aa=j/NA*2*math.pi;pxx=430+(xx+2.15)/4.45*1685;pt=np.interp(pxx,guides[:,0],guides[:,1]);pb=np.interp(pxx,guides[:,0],guides[:,2]); zz=(390-(pt+pb)*.5)/(1685/4.45)+math.cos(aa)*(pb-pt)*.5/(1685/4.45)
  vx=xx;vy=math.sin(aa)*wy;vz=zz
  # V5: continuous anterior field converges to a narrow subterminal aperture.
  # Keep the same boundary ring and trunk; no separate lip tubes or jaw sphere.
  if xx>2.06:
   t=max(0,min(1,(xx-2.06)/.24))
   bx=2.06;bp=430+(bx+2.15)/4.45*1685;bt=np.interp(bp,guides[:,0],guides[:,1]);bb=np.interp(bp,guides[:,0],guides[:,2])
   bz=(390-(bt+bb)*.5)/(1685/4.45)+math.cos(aa)*(bb-bt)*.5/(1685/4.45);by=math.sin(aa)*radius(bx,1)
   mx=2.30-.14*math.sin(aa)**2;my=.168*math.sin(aa);mz=-.147-.025*math.sin(aa)**2+.006*math.cos(aa)
   # Ease vertical convergence, retaining broad fleshy upper snout/lower jaw.
   f=1-(1-t)**1.2
   vx=bx+(mx-bx)*t+.004*math.sin(math.pi*t)**2
   vy=by*(1-f)+my*f;vz=bz*(1-f)+mz*f
  verts.append((vx,vy,vz))
  uu=i/(NX-1);vv=j/NA
  # Monotonic caudal UVs avoid mirrored tangents at the former open ring.
  if xx<-1.70:
   fade=max(0,min(1,(-1.70-xx)/.45));uu+=.043*fade*fade*(3-2*fade)
  # Locally collapse the final muzzle UVs into clean ivory cheek, avoiding
  # mirrored edge/alpha residue from the concept's terminal nose pixels.
  muzzle=max(0,min(1,(xx-2.13)/.17));muzzle=muzzle*muzzle*(3-2*muzzle)
  uu=uu*(1-muzzle)+(.963*muzzle);targetv=.25 if vv<=.5 else .75;vv=vv*(1-muzzle)+targetv*muzzle
  uv.append((uu,vv))
for i in range(NX-1):
 for j in range(NA):
  a=i*(NA+1)+j;faces.append((a+NA+1,a+NA+2,a+1,a))
# Two connected inward rings form the recessed slit; no floating dark line.
outer_face_count=len(faces)
for depth,scale in [(.024,.96),(.050,.88)]:
 for j in range(NA+1):
  aa=j/NA*math.tau;verts.append((2.30-.14*math.sin(aa)**2-depth,.168*math.sin(aa)*scale,-.147-.025*math.sin(aa)**2+.006*math.cos(aa)*scale));uv.append((.963,.25))
for row in range(2):
 for j in range(NA):
  q=(NX-1+row)*(NA+1)+j;faces.append((q+NA+1,q+NA+2,q+1,q))
faces.append(tuple((NX+1)*(NA+1)+j for j in reversed(range(NA))))
oral_face_end=len(faces)
# V6 continuous scaled caudal wedge extends the formerly open posterior ring.
prev=0
for row in range(1,10):
 t=row/9;start=len(verts)
 for j in range(NA+1):
  aa=j/NA*math.tau
  xx=-2.15-t*(.20+.08*math.sin(aa)**2)
  yy=math.sin(aa)*(.074*(1-t)**1.2+.001)
  zz=(390-(282+467)*.5)/(1685/4.45)+math.cos(aa)*((467-282)*.5/(1685/4.45))*(1-.20*t)
  verts.append((xx,yy,zz));uv.append((.043*(1-t),j/NA))
 for j in range(NA):faces.append((prev+j,prev+j+1,start+j+1,start+j))
 prev=start
faces.append(tuple(prev+j for j in range(NA)))
body=mesh('KoiBody',verts,faces,bodymat,uv)
cavity=mat('Koi recessed oral cavity',(.045,.026,.019),.58);body.data.materials.append(cavity)
for face in body.data.polygons:
 if outer_face_count<=face.index<oral_face_end:face.material_index=1
# Fine tubes for ray filaments, lips, gill curves, and barbels.
def tube(name,pts,r,material):
 cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=12;cu.bevel_depth=r;cu.bevel_resolution=2
 sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
 for b,co in zip(sp.bezier_points,pts):b.co=co;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 ob=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(ob);ob.data.materials.append(material);return ob
# Fans with curved rows and scalloped distal edge, independent names for animation.
def fan(name,roots,ends):
 vs=[];fs=[];steps=12
 for j,end in enumerate(ends):
  root=roots[j]
  for k in range(steps+1):
   t=k/steps
   co=[root[c]*(1-t)+end[c]*t for c in range(3)]
   co[1]+=.028*math.sin(t*math.pi)*math.sin(j/(len(ends)-1)*math.pi)
   co[2]+=.016*math.sin(t*math.pi)*math.sin(j*math.pi)
   vs.append(tuple(co))
 for j in range(len(ends)-1):
  for k in range(steps):
   n=j*(steps+1)+k;fs.append((n,n+1,n+steps+2,n+steps+1))
 uvs=[]
 # Each anatomical fin samples its actual photo patch, preventing white fan panels.
 for j,end in enumerate(ends):
  q=j/(len(ends)-1)
  for k in range(steps+1):
   t=k/steps
   if name=='KoiTail':
    px0=432;py0=282+185*q;px1=65+145*(1-abs(q*2-1))**2;py1=157+466*q
   elif name=='KoiDorsal':
    px0=1370-710*q;py0=float(np.interp(px0,guides[:,0],guides[:,1]));px1=px0;py1=float(np.interp(px0,[660,800,1000,1150,1250,1370],[240,175,105,29,58,143]))+4
   elif 'Pectoral' in name:
    px0=1683-44*q;py0=506+20*q;px1=1660-245*q;py1=510+148*math.sin(math.pi*q)**.7
   elif 'Pelvic' in name:
    px0=1245-135*q;py0=589;px1=1230-200*q;py1=596+91*math.sin(math.pi*q)
   else:
    px0=800-164*q;py0=528-30*q;px1=800-210*q;py1=550+47*math.sin(math.pi*q)
   sx=px0*(1-t)+px1*t;sy=py0*(1-t)+py1*t
   uvs.append((sx/pw,1-sy/ph))
 material=finmat
 if name=='KoiDorsal':
  # Opaque depth-writing interior stops the opposite flank showing through.
  material=finmat.copy();material.name='Koi dorsal dense membrane'
  dp=material.node_tree.nodes.get('Principled BSDF')
  for link in list(dp.inputs['Alpha'].links):material.node_tree.links.remove(link)
  dp.inputs['Alpha'].default_value=1.0;dp.inputs['Transmission Weight'].default_value=0.0
 ob=mesh(name,vs,fs,material,uvs)
 return ob
# Rounded lobes and a soft caudal notch, rather than pointed triangular panels.
ends=[];roots=[]
for j in range(39):
 t=j/38;aa=(t-.5)*math.pi;zz=.64*math.sin(aa);xx=-2.61-.44*math.sin(math.pi*abs(2*t-1))**.6-.12*abs(2*t-1)
 ends.append((xx,.015*math.cos(aa),zz));roots.append((-2.105,0,(t-.5)*.35+.041))
fan('KoiTail',roots,ends)
ends=[];roots=[]
for j in range(28):
 t=j/27;xx=.87-2.13*t;pxx=430+(xx+2.15)/4.45*1685; root=(xx,0,(390-float(np.interp(pxx,guides[:,0],guides[:,1])))/(1685/4.45)-.02)
 roots.append(root);ends.append((xx-.09*math.sin(math.pi*t),0,root[2]+.31*math.sin(math.pi*t)**.7))
fan('KoiDorsal',roots,ends)
for side in [-1,1]:
 suffix='L' if side>0 else 'R';ends=[];roots=[]
 for j in range(25):
  t=j/24;roots.append((1.12-.32*t,side*.40,-.22-.07*t));ends.append((.98-.90*t,side*(.42+.50*math.sin(math.pi*t)**.65),-.24-.19*math.sin(math.pi*t)))
 fan('KoiPectoral_'+suffix,roots,ends)
 ends=[];roots=[]
 for j in range(17):
  t=j/16;roots.append((-.64-.25*t,side*.24,-.39));ends.append((-.62-.65*t,side*(.25+.26*math.sin(math.pi*t)), -.39-.13*math.sin(math.pi*t)))
 fan('KoiPelvic_'+suffix,roots,ends)
roots=[];ends=[]
for j in range(17):
 t=j/16;xx=-1.12-.53*t;roots.append((xx,0,-radius(xx,2)*.91));ends.append((xx-.06,0,-radius(xx,2)-.21*math.sin(math.pi*t)))
fan('KoiAnal',roots,ends)
def sphere(name,loc,scale,material):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=28,ring_count=16,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(material)
 for p in o.data.polygons:p.use_smooth=True
 return o
# V4: small inset carp eyes, fleshy subterminal mouth, two unequal
# tapered pairs of barbels. References are anatomy only, never texture sources.
headskin=mat('Koi warm head tissue',(.56,.49,.41),.44)
barbelmat=mat('Koi living barbel skin',(.53,.43,.32),.43)
lipmat=mat('Koi soft lip tissue',(.56,.44,.35),.43)
seammat=mat('Koi narrow mouth recess',(.095,.056,.043),.56)
# Radially varied warm iris uses vertex color, not a bright metal ring.
irismat=mat('Koi inset amber iris',(.20,.16,.10),.30)
ip=irismat.node_tree.nodes.get('Principled BSDF');ip.inputs['Coat Weight'].default_value=.09
attr=irismat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='IrisColor';irismat.node_tree.links.new(attr.outputs['Color'],ip.inputs['Base Color'])
# Cross-section helper anchors each eye precisely on the current forehead.
def skin_y(xx,zz):
 pxx=430+(xx+2.15)/4.45*1685;pt=float(np.interp(pxx,guides[:,0],guides[:,1]));pb=float(np.interp(pxx,guides[:,0],guides[:,2]));cz=(390-(pt+pb)*.5)/(1685/4.45);hz=(pb-pt)*.5/(1685/4.45)
 return radius(xx,1)*math.sqrt(max(.02,1-((zz-cz)/hz)**2))
def tapered(name,pts,radii,material):
 ob=tube(name,pts,1.0,material)
 for point,r in zip(ob.data.splines[0].bezier_points,radii):point.radius=r
 return ob
for side in [-1,1]:
 suffix='L' if side>0 else 'R';ex=1.82;ez=.025;ey=skin_y(ex,ez)
 # Single continuous conforming corneal cap: no overlapping spheres or clipped iris.
 verts=[];faces=[];colors=[];na=64
 rings=[0,.012,.025,.029,.031,.037,.044,.049,.053,.057,.060]
 for j,rr in enumerate(rings):
  for k in range(na):
   ang=k*math.tau/na;xx=ex+math.cos(ang)*rr;zz=ez+math.sin(ang)*rr*.94
   yy=skin_y(xx,zz)+.003+.010*(1-(rr/.060)**2)
   verts.append((xx,side*yy,zz))
   fiber=.90+.07*math.sin(ang*27)+.03*math.sin(ang*43)
   if rr<=.029:base=np.array([.004,.004,.003])
   elif rr<.053:base=np.array([.15,.108,.047])*fiber
   else:
    t=(rr-.053)/.007;base=np.array([.15,.108,.047])*(1-t)+np.array([.46,.39,.30])*t
   colors.append((*base,1))
 for j in range(len(rings)-1):
  for k in range(na):
   q=j*na+k;qn=j*na+(k+1)%na;f=(q,qn,qn+na,q+na);faces.append(f if side>0 else f[::-1])
 ob=mesh('KoiEye_'+suffix,verts,faces,irismat);ca=ob.data.color_attributes.new(name='IrisColor',type='FLOAT_COLOR',domain='POINT')
 for c,value in zip(ca.data,colors):c.color=value
 # Long pair emerges from the mouth corners and hangs softly down/back.
 tapered('KoiBarbel_'+suffix+'0',[(2.16,side*.166,-.145),(2.17,side*.207,-.185),(2.14,side*.225,-.245),(2.115,side*.223,-.285)],[.013,.010,.005,.0008],barbelmat)
 # Upper-lip pair is distinctly shorter and finer, not a parallel duplicate.
 tapered('KoiBarbel_'+suffix+'1',[(2.235,side*.108,-.112),(2.246,side*.147,-.130),(2.225,side*.166,-.171)],[.0085,.005,.0007],barbelmat)
 tube('KoiGill_'+suffix,[(1.26,side*.26,.41),(1.21,side*.46,.16),(1.22,side*.45,-.17),(1.40,side*.28,-.34)],.0018,gill)
# Re-seat existing barbel roots after anterior reconstruction; retain all tips.
for ob in list(bpy.context.scene.objects):
 if ob.name.startswith('KoiBarbel_'):
  point=ob.data.splines[0].bezier_points[0];co=point.co.copy()
  hit,loc,normal,index=body.ray_cast(Vector((3.0,co.y,co.z)),Vector((-1,0,0)))
  if hit:point.co.x=loc.x-.010
# V5 mouth is part of KoiBody topology, not added tube/sphere components.
# Convert curves for universal glTF; export model only.
for o in list(bpy.context.scene.objects):
 if o.type=='CURVE':
  bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
# Merge ray geometry into each fin to keep real-time draw calls modest.
for name in ['KoiTail','KoiDorsal','KoiPectoral_L','KoiPectoral_R','KoiPelvic_L','KoiPelvic_R','KoiAnal']:
 bpy.ops.object.select_all(action='DESELECT')
 ob=bpy.data.objects[name];ob.select_set(True)
 for ray in bpy.data.objects:
  if ray.name.startswith(name+'_ray_'):ray.select_set(True)
 bpy.context.view_layer.objects.active=ob;bpy.ops.object.join()
model=list(bpy.context.scene.objects)
# Editable skin skeleton. Browser controller deforms bind-pose vertices; skeleton is
# preserved for hand-authored Blender animation and future rig-based playback.
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.object.armature_add(enter_editmode=True,location=(0,0,0))
rig=bpy.context.object;rig.name='KohakuRig';arm=rig.data;arm.name='KohakuSkeleton'
arm.edit_bones.remove(arm.edit_bones[0]);xs=[1.9,1.0,0.0,-1.0,-1.9,-2.7]
prev=None
for i,xx in enumerate(xs):
 b=arm.edit_bones.new('KoiSpine_%d'%i);b.head=(xx,0,0);b.tail=(xx-.65,0,0)
 if prev:b.parent=prev
 prev=b
bpy.ops.object.mode_set(mode='OBJECT')
for ob in model:
 if ob.type!='MESH':continue
 # all meshes have coordinates in world space except eyes, whose transforms
 # are applied before skinning to keep one coherent deformation basis.
 bpy.context.view_layer.objects.active=ob;ob.select_set(True)
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);ob.select_set(False)
 groups=[ob.vertex_groups.new(name='KoiSpine_%d'%i) for i in range(len(xs))]
 for ve in ob.data.vertices:
  distances=sorted([(abs(ve.co.x-q),i) for i,q in enumerate(xs)])[:2]
  a,ia=distances[0];b,ib=distances[1];total=max(a+b,1e-6)
  groups[ia].add([ve.index],b/total,'REPLACE');groups[ib].add([ve.index],a/total,'REPLACE')
 mod=ob.modifiers.new('Kohaku Skin','ARMATURE');mod.object=rig;ob.parent=rig
model.append(rig)
for img in [im,nim,rim,source]:img.pack()

for o in model:o.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.export_scene.gltf(filepath=OUT+'/kohaku-koi.glb',export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
# Render presentation with neutral dark water-like background. Not part of exported mesh.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=False;scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.world.color=(.045,.055,.065)
def area(name,loc,power,size):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=((Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler())
area('Softbox', (1,-4,6),650,5);area('Rim',(-2,3,4),900,4);area('Fill',(2,-4,-2),180,5)
bpy.ops.object.camera_add(location=(3,-8,4.7));cam=bpy.context.object;cam.rotation_euler=((Vector((-.3,0,0))-cam.location).to_track_quat('-Z','Y').to_euler());cam.data.type='ORTHO';cam.data.ortho_scale=6.8;scene.camera=cam
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=OUT+'/kohaku-review.png';bpy.ops.wm.save_as_mainfile(filepath=OUT+'/kohaku-koi.blend');bpy.ops.render.render(write_still=True)
scene.render.filepath=OUT+'/kohaku-side.png';cam.location=(0,-9,1.0);cam.rotation_euler=((Vector((-.3,0,0))-cam.location).to_track_quat('-Z','Y').to_euler());bpy.ops.render.render(write_still=True)
print('KOI_MODEL_COMPLETE',OUT,'mesh_count',len(model),'vertices',sum(len(o.data.vertices) for o in model if o.type=='MESH'))

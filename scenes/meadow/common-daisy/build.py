import bpy, math, random, os, json, sys
from mathutils import Vector
from math import sin,cos,pi,sqrt
random.seed(162)
ROOT=os.path.dirname(os.path.abspath(__file__)); SPECIES=os.path.basename(ROOT); CLOVER=SPECIES=='white-clover'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
# All surface buffers are editable meshes, grouped by botanical part rather than per floret.
buffers={}
def material(name,color,rough=.68,texture=False):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Specular IOR Level'].default_value=.22
 if texture:
  for suffix,socket,space in [('basecolor','Base Color','sRGB'),('roughness','Roughness','Non-Color'),('normal','Normal','Non-Color')]:
   im=bpy.data.images.load(ROOT+'/textures/leaf-'+suffix+'.png');im.colorspace_settings.name=space;im.pack();n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=im
   if suffix=='normal':
    normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.48;m.node_tree.links.new(n.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],p.inputs[socket])
   else:m.node_tree.links.new(n.outputs['Color'],p.inputs[socket])
 return m
mats=[material('Leaf cuticle • subtle venation',(.12,.25,.05),texture=True),material('Young stem',(.23,.32,.072),.76),material('Stolon and papery stipules',(.21,.105,.047),.82),material('Ivory white petals',(.86,.85,.73),.6),material('Petal shaded cream',(.69,.72,.52),.65),material('Petal blush reverse',(.64,.38,.39),.67),material('Golden disc florets',(.85,.49,.015),.77),material('Fresh disc florets',(.95,.66,.024),.78),material('Calyx olive',(.18,.29,.055),.8)]
def buf(name):return buffers.setdefault(name,{'v':[],'f':[],'uv':[],'mi':[]})
def meshpart(name,verts,faces,uvs,mi):
 b=buf(name);off=len(b['v']);b['v'].extend(verts);b['uv'].extend(uvs)
 for f in faces:b['f'].append(tuple(off+i for i in f));b['mi'].append(mi)
def tube(name,points,radius,mi=1,sides=7):
 points=[Vector(p) for p in points];vs=[];uv=[];fs=[]
 for j,p in enumerate(points):
  t=(points[min(j+1,len(points)-1)]-points[max(j-1,0)]).normalized();a=t.cross(Vector((0,0,1)))
  if a.length<.1:a=t.cross(Vector((0,1,0)))
  a.normalize();b=t.cross(a).normalized();r=radius*(1-.30*j/(len(points)-1))
  for i in range(sides):vs.append(p+r*(a*cos(i*2*pi/sides)+b*sin(i*2*pi/sides)));uv.append((i/sides,j/(len(points)-1)))
 for j in range(len(points)-1):
  for i in range(sides):fs.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
 fs.extend([tuple(reversed(range(sides))),tuple((len(points)-1)*sides+i for i in range(sides))]);meshpart(name,vs,fs,uv,mi)
def curved(a,b,bend=.005,N=13):
 a=Vector(a);b=Vector(b);return [a.lerp(b,t/N)+Vector((bend*sin(pi*t/N),-bend*.45*sin(pi*t/N),0)) for t in range(N+1)]
def leaf(name,base,theta,length,width,rise=.25,kind='clover',mi=0,roll=0):
 # Sheet has folded midrib, mildly toothed edges, convex interveinal panels and curved tip.
 base=Vector(base);axis=Vector((cos(theta),sin(theta),rise)).normalized();side=Vector((-sin(theta),cos(theta),roll)).normalized();up=axis.cross(side).normalized()
 N=28;W=12;verts=[];uv=[];faces=[]
 for j in range(N+1):
  t=j/N
  if kind=='clover':shape=max(.018,sin(pi*t)**.40)*(0.78+.22*t)
  elif kind=='daisy':shape=max(.018,sin(pi*t)**.35)*(.20+.8*t)
  else:shape=max(.015,sin(pi*t)**.70)
  for k in range(W+1):
   s=(k/W-.5)*2;edge=1+(.045 if kind=='daisy' else .018)*cos(t*pi*(16 if kind=='daisy' else 36))*(abs(s)**4)
   z=length*(.065*sin(pi*t)-.10*t**4)+width*(.09*abs(s)**1.3+.025*sin(t*21+abs(s)*5)*abs(s))
   z+=width*.008*sin(t*65+abs(s)*9)*sin(pi*t)
   verts.append(base+axis*length*t+side*s*width*.5*shape*edge+up*z);uv.append((k/W,t))
 for j in range(N):
  for k in range(W):a=j*(W+1)+k;faces.append((a,a+1,a+W+2,a+W+1))
 meshpart(name,verts,faces,uv,mi)
 # The midrib is a thin connected tapered strand on the same anatomical surface.
 if kind in ('clover','daisy'):
  pts=[base+axis*length*t+up*(length*(.065*sin(pi*t)-.10*t**4)+.000035) for t in [i/12 for i in range(13)]];tube(name,pts,.000095 if kind=='clover' else .00012,1,5)
def petal(name,base,axis,side,length,width,mi=3,cup=.15,tip=-.05):
 base=Vector(base);axis=Vector(axis).normalized();side=Vector(side).normalized();normal=axis.cross(side).normalized();vs=[];uv=[];fs=[];N=10;W=4
 for j in range(N+1):
  t=j/N;shape=max(.015,sin(pi*t)**.40)*(.65+.35*t)
  for k in range(W+1):
   s=(k/W-.5)*2;z=length*(cup*sin(pi*t)+tip*t*t)+width*(.14*s*s+.027*cos(s*7*pi)*sin(pi*t))
   vs.append(base+axis*length*t+side*s*width*.5*shape+normal*z);uv.append((k/W,t))
 for j in range(N):
  for k in range(W):a=j*(W+1)+k;fs.append((a,a+1,a+W+2,a+W+1))
 meshpart(name,vs,fs,uv,mi)
def ellipsoid(name,center,radii,mi,N=10,M=6):
 vs=[];uv=[];fs=[];center=Vector(center)
 for j in range(M+1):
  p=pi*j/M
  for i in range(N):
   a=2*pi*i/N;vs.append(center+Vector((radii[0]*sin(p)*cos(a),radii[1]*sin(p)*sin(a),radii[2]*cos(p))));uv.append((i/N,j/M))
 for j in range(M):
  for i in range(N):fs.append((j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i))
 meshpart(name,vs,fs,uv,mi)
def cloverhead(center,scale=1,index=0):
 center=Vector(center);rad=.006*scale
 ellipsoid('Flower receptacles',center,(rad,rad,rad*.8),8)
 # 66 individual papilionaceous florets: upright upper buds, open lateral standards, aging pendent lower flowers.
 for i in range(66):
  z=1-2*(i+.5)/66;phi=i*2.399963+index;rr=sqrt(1-z*z);d=Vector((rr*cos(phi),rr*sin(phi),z));base=center+d*rad*.78
  axis=(d*.65+Vector((0,0,.6))).normalized();side=Vector((-sin(phi),cos(phi),0));l=(.0048+random.random()*.0018)*scale
  mi=3 if z>-.45 else (4 if i%3 else 5)
  petal('White pea-shaped florets',base,axis,side,l,.0022*scale,mi,cup=.18,tip=.10)
  for s in [-1,1]:petal('White pea-shaped florets',base+side*s*.00045*scale,axis-side*s*.13,side,l*.62,.0009*scale,mi,cup=.1,tip=0)
  # Five lobed green calyx represented by narrow organic sepals.
  for q in range(3):
   ang=phi+q*2*pi/3;sd=Vector((cos(ang),sin(ang),0));petal('Green calyx',base-axis*.0006*scale,axis*.8+sd*.3,side,l*.42,.0006*scale,8,cup=.01,tip=0)
if CLOVER:
 nodes=[(-.074,.006,.0015),(-.042,-.004,.002),(-.012,.005,.002),(.019,-.002,.002),(.049,.009,.002),(.081,.021,.0015)]
 for i in range(len(nodes)-1):tube('Creeping stolon',curved(nodes[i],nodes[i+1],.002),.00105,1,9)
 leafspec=[(0,(-.076,-.005,.030),3.7,.022),(1,(-.048,.013,.065),2.3,.025),(1,(-.028,-.023,.041),4.5,.025),(2,(-.010,.030,.055),1.5,.022),(2,(.008,-.034,.079),4.3,.028),(3,(.043,-.022,.043),5.5,.021),(4,(.057,.023,.087),.8,.027),(5,(.087,.028,.029),.1,.019)]
 for j,(idx,top,angle,L) in enumerate(leafspec):
  tube('Leaf petioles',curved(nodes[idx],top,.003),.00055,1)
  for sideangle in [-.55,.55]:leaf('Papery stipules',nodes[idx],angle+sideangle,.006,.002,1.5,'sepal',2)
  def triple(name,n):
   for k in range(n):
    a=angle+2*pi*k/n;offset=Vector(top)+Vector((cos(a),sin(a),.15))*.0013
    tube(name,[top,offset],.00025,1,5);leaf(name,offset,a,L*(.94+.09*random.random()),L*.83,rise=.05+random.random()*.19,roll=(random.random()-.5)*.2)
  if j==6:
   state=random.getstate();triple('CloverLeafThree',3);random.setstate(state);triple('CloverLeafFour',4)
  else:triple('Trifoliate foliage',3)
 for i,(idx,top,s) in enumerate([(1,(-.043,.018,.099),.85),(2,(.003,.014,.132),1.0),(3,(.034,.016,.077),.65)]):
  tube('Flower peduncles',curved(nodes[idx],top,.006),.00065,1,9);cloverhead(top,s,i)
else:
 # Rosette leaves merge into winged petiole bases; no leafy flowering stems.
 crown=(0,0,.0025)
 for i in range(15):
  a=i*2.399963;L=random.uniform(.033,.055);rise=random.uniform(.04,.32) if i<10 else random.uniform(.45,.9)
  leaf('Basal spoon-leaf rosette',crown,a,L,random.uniform(.013,.022),rise,'daisy',0,random.uniform(-.12,.12))
 def daisyhead(center,normal,radius,index,openfactor=1):
  c=Vector(center);n=Vector(normal).normalized();u=n.cross(Vector((0,1,0))).normalized();v=n.cross(u);r=radius
  # Involucre of 2 rows, lobes contact the receptacle under each ray.
  ellipsoid('Flower receptacles',c-n*.001,(r*.34,r*.34,.0024),8,16,8)
  for k in range(22):
   a=k*2*pi/22;d=u*cos(a)+v*sin(a);sd=-u*sin(a)+v*cos(a);petal('Green involucre',c-n*.002,d+n*.12,sd,r*.54,r*.16,8,cup=.2,tip=-.08)
  for row in range(2):
   count=24 if row==0 else 20
   for k in range(count):
    a=k*2*pi/count+row*.13+random.uniform(-.025,.025);d=u*cos(a)+v*sin(a);sd=-u*sin(a)+v*cos(a)
    d=(d*openfactor+n*(1-openfactor)).normalized();l=r*random.uniform(.75,.92)*(1-.10*row)
    petal('White ray florets',c+d*r*.24+n*row*.0002,d,sd,l,r*random.uniform(.105,.15),3 if k%8 else 4,cup=random.uniform(.06,.14),tip=random.uniform(-.12,.04))
    if k%3==0:petal('Pink backed young rays',c+d*r*.24-n*.00006,d,sd,l*.96,r*.07,5,cup=.08,tip=-.09)
  # Golden dome composed of 180 real tiny tubular 5-lobed disc florets.
  disc=r*.32
  for k in range(180):
   rr=disc*sqrt((k+.5)/180);a=k*2.399963;d=u*cos(a)+v*sin(a);p=c+d*rr+n*(.0015+.0015*(1-(rr/disc)**2));fr=r*.025;h=r*.065
   pts=[p,p+n*h];tube('Golden tubular disc florets',pts,fr,6 if k%4 else 7,5)
   vs=[];uv=[];fs=[]
   for ring in range(2):
    for q in range(10):
     ad=a+q*2*pi/10;dr=u*cos(ad)+v*sin(ad)
     vs.append(p+n*(h+ring*fr*(.55 if q%2==0 else .20))+dr*fr*(.78+ring*.40));uv.append((q/10,ring))
   for q in range(10):fs.append((q,(q+1)%10,10+(q+1)%10,10+q))
   meshpart('Golden tubular disc florets',vs,fs,uv,7)
 for i,(top,n,r,o) in enumerate([((-.018,.004,.139),(-.12,-.34,.94),.013,1),((.031,.012,.115),(.45,-.12,.88),.0115,.88),((-.033,-.008,.079),(-.25,-.15,.96),.008,.55)]):
  tube('Leafless flower scapes',curved(crown,top,.006),.0009,1,10);daisyhead(top,n,r,i,o)
 # sparse true hairs on stem / leaf edges rather than a flat wool texture
 for k in range(240):
  t=random.random();a=random.random()*2*pi;p=Vector(crown).lerp(Vector((-.018,.004,.139)),t)+Vector((.006*sin(pi*t),-.0027*sin(pi*t),0));d=Vector((cos(a),sin(a),.3));tube('Sparse scape pubescence',[p+d*.0008,p+d*.0011],.000022,4,3)
# Mesh construction, object origins all at ground world origin.
objects=[]
for name,b in buffers.items():
 me=bpy.data.meshes.new(name);me.from_pydata(b['v'],[],b['f']);me.materials.clear()
 for m in mats:me.materials.append(m)
 ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);objects.append(ob)
 layer=me.uv_layers.new(name='BotanicalUV')
 for poly,mi in zip(me.polygons,b['mi']):
  poly.material_index=mi;poly.use_smooth=True
  for li in poly.loop_indices:layer.data[li].uv=b['uv'][me.loops[li].vertex_index]
 ob['anatomy']=name;ob['units']='metres'
 if name=='CloverLeafFour':ob.hide_render=True;ob.hide_set(True);ob['variant']='four-leaf';ob['defaultVisible']=False
 if name=='CloverLeafThree':ob['variant']='three-leaf';ob['defaultVisible']=True
# Camera framing is matched to isolated approved concept, slightly elevated front three-quarter.
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=False;scene.render.film_transparent=True
scene.render.resolution_x=1100;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.world.color=(.30,.30,.30)
scene.view_settings.view_transform='AgX'
world=scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.72,.85,1);world.node_tree.nodes['Background'].inputs[1].default_value=.4
for name,loc,energy,size in [('Softbox key',(-.20,-.24,.36),12,.22),('Softbox fill',(.22,-.08,.18),5,.18),('Rim',(.05,.20,.27),9,.18)]:
 bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.name=name;light.data.energy=energy*.065;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,.07))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(.08,-.35,.30));camera=bpy.context.object;scene.camera=camera;camera.name='Reference Camera';target=Vector((.008,0,.067));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=.23 if CLOVER else .19
# A record of the approval source, without putting image planes into the model.
scene['reference']='User-approved generated concept 02-草甸小花与羊茅-参考.png, top middle / top right; not a photograph.'
scene['license']='Original procedural mesh and generated texture maps; external botanical pages used for factual structure only.'
# Both variant meshes exported deliberately; root viewer must switch the named nodes.
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.hide_set(False);o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=ROOT+'/model.glb',export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_materials='EXPORT')
if CLOVER:bpy.data.objects['CloverLeafFour'].hide_set(True)
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/model.blend',compress=True)
coords=[Vector(v.co) for o in objects if o.name!='CloverLeafFour' for v in o.data.vertices];mins=[min(p[i] for p in coords) for i in range(3)];maxs=[max(p[i] for p in coords) for i in range(3)]
triangles=sum(len(p.vertices)-2 for o in objects for p in o.data.polygons)
json.dump({'species':SPECIES,'dimensions_m':[maxs[i]-mins[i] for i in range(3)],'bounds_blender':[mins,maxs],'triangles':triangles,'vertices':sum(len(o.data.vertices) for o in objects),'objects':[o.name for o in objects],'materials':len(mats)},open(ROOT+'/qa.json','w'),indent=2)
for label,loc in [('cover',(.08,-.35,.30)),('side',(.34,-.08,.13)),('rear',(-.12,.35,.18)),('top',(.025,-.02,.42))]:
 camera.location=loc;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=ROOT+'/images/'+label+'.png';scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';bpy.ops.render.render(write_still=True)

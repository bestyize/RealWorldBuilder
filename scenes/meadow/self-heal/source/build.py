import bpy, math, random, os, sys, json
from mathutils import Vector
from math import sin,cos,pi
random.seed(7031)
S=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'persian-speedwell'
OUT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(OUT+'/images',exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
G={}; M={}
def mat(name,col,rough=.78):
 m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*col,1);p.inputs['Roughness'].default_value=rough;p.inputs['Specular IOR Level'].default_value=.25;M[name]=m;return m
def texmat(name,kind):
 m=mat(name,(.3,.4,.1));n=256;im=bpy.data.images.new(name+'_albedo',width=n,height=n);pixels=[]
 for y in range(n):
  t=y/(n-1)
  for x in range(n):
   v=x/(n-1)*2-1;noise=random.uniform(-.035,.035)
   if kind=='leaf':
    branch=abs((t-abs(v)*.23)*9-round((t-abs(v)*.23)*9));vein=math.exp(-(v/.026)**2)+.5*math.exp(-(branch/.045)**2);c=(.095+vein*.045+noise*.4,.235+vein*.075+noise,.025+vein*.025+noise*.25)
   elif kind=='blue':
    white=max(0,1-t/.35);vein=(.5+.5*cos(v*19+sin(t*8)*.5))**18*.20*t;c=(.22+white*.5-vein,.34+white*.43-vein,.76+white*.1-vein*.2)
   elif kind=='red':
    basal=max(0,1-t/.24);stri=(sin(v*80+sin(t*22)*2)*.5+.5)*.08;c=(.63-basal*.59+noise+stri,.014-basal*.008+stri*.1,.009+basal*.012)
   else:c=(.31+noise,.075+noise*.4,.48+noise)
   pixels.extend((*[max(.001,min(.99,q)) for q in c],1))
 im.pixels[:]=pixels;im.pack();node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=im;m.node_tree.links.new(node.outputs['Color'],m.node_tree.nodes.get('Principled BSDF').inputs['Base Color']);return m
mat('stem',(.13,.22,.035));mat('vein',(.20,.30,.065));mat('bract',(.08,.12,.025));mat('bract-edge',(.055,.022,.027));mat('anther',(.025,.018,.027));mat('pollen',(.53,.50,.21));mat('hair',(.30,.38,.13));mat('white',(.78,.82,.59));texmat('leaf','leaf');texmat('blue-petal','blue');texmat('red-petal','red');texmat('purple-petal','purple')
def mesh(name,verts,faces,material,uv=None):
 key=(name,material)
 if key not in G:G[key]=[[],[],[]]
 a,b,c=G[key];i=len(a);a.extend(verts);b.extend([[j+i for j in f] for f in faces]);c.extend(uv or [(0,0)]*len(verts))
def tube(name,pts,r,material='stem',sides=7):
 pts=[Vector(p) for p in pts];vs=[];fs=[]
 for i,p in enumerate(pts):
  d=pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)];d.normalize();u=d.cross(Vector((0,1,0)))
  if u.length<.01:u=d.cross(Vector((1,0,0)))
  u.normalize();v=d.cross(u);rr=r[i] if isinstance(r,list) else r
  vs.extend([p+rr*(cos(j*2*pi/sides)*u+sin(j*2*pi/sides)*v) for j in range(sides)])
 for i in range(len(pts)-1):
  for j in range(sides):a=i*sides+j;b=i*sides+(j+1)%sides;fs.append((a,b,b+sides,a+sides))
 fs.append(tuple(reversed(range(sides))));fs.append(tuple((len(pts)-1)*sides+j for j in range(sides)));mesh(name,vs,fs,material)
def ball(name,p,sc,material):
 vs=[];fs=[]
 for i in range(9):
  t=pi*i/8
  for j in range(12):a=j*2*pi/12;vs.append(Vector(p)+Vector((sin(t)*cos(a)*sc[0],sin(t)*sin(a)*sc[1],cos(t)*sc[2])))
 for i in range(8):
  for j in range(12):a=i*12+j;b=i*12+(j+1)%12;fs.append((a,b,b+12,a+12))
 mesh(name,vs,fs,material)
def leaf(p,d,L,W,kind='oval',material='leaf',veins=True):
 p=Vector(p);d=Vector(d).normalized();side=d.cross(Vector((0,0,1))).normalized();up=side.cross(d).normalized();twist=random.uniform(-.7,.7);side,up=side*cos(twist)+up*sin(twist),up*cos(twist)-side*sin(twist);N=22;K=12;vs=[];uv=[];fs=[]
 def point(t,v):
  shape=sin(pi*t)**.75
  if kind=='scallop':shape*=.87+.13*cos(t*10*pi)
  if kind=='cut':shape*=.38+.62*abs(sin(t*6*pi))**1.4
  return p+d*(L*t)+side*(v*W*.5*shape)+up*(L*(.095*sin(pi*t)-.14*t*t)+abs(v)*W*.12*sin(pi*t)+W*.025*sin(t*45+v*5)*abs(v))
 for i in range(N+1):
  for j in range(K+1):t=i/N;v=j/K*2-1;vs.append(point(t,v));uv.append((j/K,t))
 for i in range(N):
  for j in range(K):a=i*(K+1)+j;fs.append((a,a+1,a+K+2,a+K+1))
 mesh('leaves' if material=='leaf' else 'petals',vs,fs,material,uv)
 if veins:
  tube('leaf_midribs',[point(t,0)+up*.00008 for t in [0,.2,.4,.6,.8,1]],L*.004,'vein',5)
  for t in [.18,.32,.46,.60,.74]:
   for sg in [-1,1]:tube('leaf_secondary_veins',[point(t+k*.028,sg*k/4*.84)+up*.00009 for k in range(5)],L*.0018,'vein',4)
 return point(1,0)
def stem(points,r=.001):tube('stems',points,r)
def flowerspeed(c,tilt=.45):
 c=Vector(c);u=Vector((1,0,0));v=Vector((0,.68,.73));normal=u.cross(v)
 for j in range(4):
  a=j*pi/2+.17;direction=u*cos(a)+v*sin(a);side=-u*sin(a)+v*cos(a);L=.0055*(.76 if j==3 else 1);vs=[];fs=[];uv=[]
  for i in range(17):
   t=i/16
   for k in range(13):s=k/12*2-1;w=.0026*sin(pi*t)**.52;vs.append(c+direction*(L*t)+side*s*w+normal*(.00035*sin(pi*t)+.0001*sin(s*15)*t));uv.append((k/12,t))
  for i in range(16):
   for k in range(12):a=i*13+k;fs.append((a,a+1,a+14,a+13))
  mesh('four_lobed_corollas',vs,fs,'blue-petal',uv)
 ball('white_throats',c,(.0007,.00065,.00065),'white')
 for sg in [-1,1]:
  end=c+normal*.0015+u*sg*.00065;tube('two_stamens',[c,end],.00010,'white',5);ball('two_anthers',end,(.00022,.00018,.0002),'pollen')
if S=='persian-speedwell':
 for b in range(3):
  a=[3.7,1.7,.15][b];end=Vector((cos(a)*.055,sin(a)*.030,.055+b*.011));pts=[Vector((0,0,0)),Vector((cos(a)*.023,sin(a)*.012,.012)),end];stem(pts,.00065)
  for j in range(1,5):
   t=j/5;p=pts[1].lerp(end,t);phi=a+(1 if j%2 else -1)*1.1;d=Vector((cos(phi),sin(phi),.35));q=p+d*.004;stem([p,q],.00032);leaf(q,d,.019+random.random()*.003,.017,'scallop')
  c=end+Vector((.003,-.002,.014));stem([end,end+Vector((.001,-.001,.007)),c],.00030);flowerspeed(c)
  q=end+Vector((-.008,.004,.008));stem([end,q],.00026);ball('buds',q,(.001,.001,.002),'bract')
if S=='self-heal':
 for b,(x,y,h) in enumerate([(-.038,.008,.155),(0,.013,.235),(.044,-.004,.173)]):
  base=Vector((x,y,h-.038));stem([(0,0,0),base,(x,y,h)],.0011)
  for j in range(1,5):
   p=base*(j/5);ang=j*1.18+b
   for sg in [-1,1]:
    d=Vector((cos(ang)*sg,sin(ang)*sg,.16));q=p+d*.008;stem([p,q],.0005);leaf(q,d,.055*(1-j*.065),.033*(1-j*.06))
  for layer in range(7):
   z=base.z+layer*.0055;rad=.0065*(1-.035*layer)
   for j in range(4):
    a=j*pi/2+(layer%2)*pi/4;p=Vector((x+cos(a)*rad*.25,y+sin(a)*rad*.25,z));d=Vector((cos(a),sin(a),.48));leaf(p,d,.010,.009,'oval','bract-edge' if layer>4 else 'bract',False)
    if layer in [1,3,5] and (j+layer+b)%3!=0:
     c=Vector((x+cos(a)*rad*.75,y+sin(a)*rad*.75,z+.002));out=Vector((cos(a),sin(a),.16));up=Vector((0,0,1));sd=Vector((-sin(a),cos(a),0));vs=[];fs=[];uv=[]
     for k in range(13):
      t=k/12;center=c+out*(.010*t)+up*(.002*sin(t*pi*.8));r=.0011+.0012*t
      for m in range(12):
       ang=m*2*pi/12;vs.append(center+sd*cos(ang)*r+up*sin(ang)*r);uv.append((m/11,t))
     for k in range(12):
      for m in range(12):a0=k*12+m;a1=k*12+(m+1)%12;fs.append((a0,a1,a1+12,a0+12))
     mesh('hooded_corolla_tubes',vs,fs,'purple-petal',uv)
     tip=c+out*.01+up*.0012
     leaf(tip-up*.0014,out+Vector((0,0,-.4)),.0045,.004,'scallop','purple-petal',False)
     leaf(tip+up*.002,out+Vector((0,0,-.12)),.0035,.0038,'oval','purple-petal',False)
if S=='field-poppy':
 def stem_at(z):
  path=[Vector(p) for p in [(0,0,0),(.003,.001,.13),(-.012,.001,.27),(-.019,0,.425)]]
  for a,b in zip(path,path[1:]):
   if z<=b.z:return a.lerp(b,(z-a.z)/(b.z-a.z))
  return path[-1]
 c=Vector((-.019,.0,.425));stem([(0,0,0),(.003,.001,.13),(-.012,.001,.27),c],.0014)
 for j in range(6):
  z=.025+j*.042;p=stem_at(z);a=j*2.4;d=Vector((cos(a),sin(a),.35));q=p+d*.006;stem([p,q],.00055);leaf(q,d,.075-j*.005,.026,'cut')
 # single four-petal shallow dish, slightly inclined toward reference camera
 u=Vector((1,0,0));v=Vector((0,.80,.60));n=u.cross(v)
 for j in range(4):
  ang=j*pi/2+.18;axis=u*cos(ang)+v*sin(ang);side=-u*sin(ang)+v*cos(ang);vs=[];fs=[];uv=[]
  for i in range(41):
   t=i/40
   for k in range(41):
    s=k/40*2-1;w=.036*sin(pi*t*.98)**.58
    wrinkle=(.0006*sin(t*68+s*5)+.0004*sin(t*121+s*24)+.0012*sin(s*22+t*5))*t
    p=c+axis*(.048*t)+side*s*w+n*(.020*t*t+.006*s*s*t+wrinkle+.0015*j*t)
    vs.append(p);uv.append((k/40,t))
  for i in range(40):
   for k in range(40):a=i*41+k;fs.append((a,a+1,a+42,a+41))
  mesh('four_crinkled_papery_petals',vs,fs,'red-petal',uv)
 ball('ovary',c+n*.007,(.004,.004,.006),'bract')
 for j in range(12):
  a=j*2*pi/12;tube('stigmatic_disc_rays',[c+n*.013,c+n*.012+u*cos(a)*.0037+v*sin(a)*.0037],.00018,'pollen',5)
 for j in range(75):
  a=j*2.399;rr=.005+random.random()*.004;p=c+(u*cos(a)+v*sin(a))*rr+n*(.005+random.random()*.004);tube('stamens',[c,p],.00016,'anther',5);ball('dark_anthers',p,(.00055,.0004,.0009),'anther')
 bud=Vector((.070,.012,.306));stem([stem_at(.19)]+[(-.00343+.07343*(2*t-t*t),.001+.011*t,.19+.145*sin(t*pi*.66)) for t in [i/24 for i in range(1,25)]]+[bud],.0011);ball('nodding_bud',bud,(.006,.005,.012),'leaf')
 for j in range(100):
  a=random.random()*2*pi;t=random.random()*pi;p=bud+Vector((.006*sin(t)*cos(a),.005*sin(t)*sin(a),.012*cos(t)));d=(p-bud).normalized();tube('bud_hairs',[p,p+d*.0015],.000055,'hair',4)
# instantiate grouped editable meshes
for (name,material),(vs,fs,uv) in G.items():
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(ob);me.materials.append(M[material]);layer=me.uv_layers.new(name='UVMap')
 for poly in me.polygons:
  poly.use_smooth=True
  for li in poly.loop_indices:layer.data[li].uv=uv[me.loops[li].vertex_index]
# clamp all geometry root pivot, compute exact bounds
objs=[o for o in bpy.context.scene.objects if o.type=='MESH'];coords=[o.matrix_world@v.co for o in objs for v in o.data.vertices];lo=Vector(tuple(min(v[i] for v in coords) for i in range(3)));hi=Vector(tuple(max(v[i] for v in coords) for i in range(3)))
for o in objs:
 for v in o.data.vertices:v.co.z-=lo.z
hi.z-=lo.z;lo.z=0
center=(hi+lo)*.5;radius=max(hi.z,(hi.x-lo.x)*1.15,(hi.y-lo.y)*1.15)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=False;scene.render.resolution_x=768;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.world.color=(.17,.17,.17);scene.view_settings.view_transform='AgX'
def camera(angle=0):
 pos=center+Vector((sin(angle)*radius*1.7,-cos(angle)*radius*1.7,radius*.5));cam.location=pos;cam.rotation_euler=(center-pos).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='Reference_matched_camera';cam.data.type='ORTHO';cam.data.ortho_scale=radius*1.35;scene.camera=cam;camera()
for name,pos,power,size in [('Key',(-1,-1,2),90,1.2),('Fill',(1,-.3,1),35,1.4),('Rim',(.3,1,1.5),55,.8)]:
 bpy.ops.object.light_add(type='AREA',location=center+Vector(pos)*radius);ob=bpy.context.object;ob.name=name;ob.data.energy=power*radius*radius;ob.data.shape='DISK';ob.data.size=size*radius;ob.rotation_euler=(center-ob.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/model.blend',compress=True)
bpy.ops.object.select_all(action='DESELECT')
for ob in objs:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT+'/model.glb',export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
metrics={'species':S,'dimensions_m':list(hi-lo),'origin':'ground centre, Blender Z up, glTF Y up','vertices':sum(len(o.data.vertices) for o in objs),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objs),'mesh_objects':len(objs),'source_seed':7031}
open(OUT+'/qa.json','w').write(json.dumps(metrics,indent=2))
for name,angle in [('cover',0),('side',pi/2),('rear',pi),('three-quarter',-.65)]:
 camera(angle);scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.filepath=OUT+'/images/'+name+'.png';bpy.ops.render.render(write_still=True)
# true reimport verification, compare bounds after importer restores Blender orientation
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=OUT+'/model.glb');ob=[o for o in bpy.context.scene.objects if o.type=='MESH'];vv=[o.matrix_world@v.co for o in ob for v in o.data.vertices];bounds=[max(v[i] for v in vv)-min(v[i] for v in vv) for i in range(3)];metrics['reimport_dimensions_m']=bounds;metrics['reimport_meshes']=len(ob);metrics['reimport_materials']=len(bpy.data.materials);metrics['reimport_dimension_max_error_m']=max(abs(bounds[i]-(hi-lo)[i]) for i in range(3));open(OUT+'/qa.json','w').write(json.dumps(metrics,indent=2));print('ASSET_COMPLETE',S,metrics)

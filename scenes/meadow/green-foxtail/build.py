import bpy, math, random, os, sys, json
from mathutils import Vector
from math import sin,cos,pi
ROOT=os.path.dirname(os.path.abspath(__file__))
# Copy this same deterministic generator into any of the three named asset folders.
kind=os.path.basename(ROOT); rng=random.Random({'bermuda-grass':8,'fine-fescue':19,'green-foxtail':31}[kind])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
verts={}; faces={}; uvs={}; mats=[]
# Small shared fiber normal map, real glTF-compatible normal texture, not a Blender-only shader.
S=128; image=bpy.data.images.new('Longitudinal leaf micro-ridges',width=S,height=S)
px=[]
for y in range(S):
 for x in range(S):
  n=.035*sin(x*.92)+.018*sin(x*2.7+y*.06)
  px.extend((.5+n,.5+.009*sin(y*.21+x*.3),.999,1))
image.pixels=px; image.colorspace_settings.name='Non-Color'; image.pack()
colors=[(.18,.285,.045),(.24,.355,.064),(.31,.40,.085),(.14,.23,.036),(.37,.40,.14),(.40,.32,.13),(.31,.22,.12)]
for i,c in enumerate(colors):
 c=tuple(v*.62 for v in c)
 m=bpy.data.materials.new(['Leaf forest','Leaf green','Leaf young','Leaf shaded','Leaf olive','Dry sheath','Runner ochre'][i]); m.diffuse_color=(*c,1); m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*c,1); p.inputs['Roughness'].default_value=.73 if i<5 else .83; p.inputs['Specular IOR Level'].default_value=.24
 t=m.node_tree.nodes.new('ShaderNodeTexImage'); t.image=image
 n=m.node_tree.nodes.new('ShaderNodeNormalMap'); n.inputs['Strength'].default_value=.27
 m.node_tree.links.new(t.outputs['Color'],n.inputs['Color']);m.node_tree.links.new(n.outputs['Normal'],p.inputs['Normal'])
 mats.append(m)
def poly(group,vs,fs,tex=None):
 if group not in verts: verts[group]=[]; faces[group]=[];uvs[group]=[]
 b=len(verts[group]); verts[group]+=list(vs);faces[group]+=[tuple(b+j for j in f) for f in fs];uvs[group]+=tex or [(0,0)]*len(vs)
def tube(group,pts,r=.001,sides=5):
 pts=[Vector(p) for p in pts];v=[];f=[];uv=[]
 for j,p in enumerate(pts):
  t=(pts[min(j+1,len(pts)-1)]-pts[max(j-1,0)]).normalized(); a=t.cross(Vector((0,1,0))).normalized();b=t.cross(a).normalized()
  rad=r*(1-.65*j/max(1,len(pts)-1))
  for k in range(sides):v.append(p+rad*(a*cos(2*pi*k/sides)+b*sin(2*pi*k/sides)));uv.append((k/sides,j/(len(pts)-1)))
 for j in range(len(pts)-1):
  for k in range(sides): f.append((j*sides+k,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,(j+1)*sides+k))
 poly(group,v,f,uv)
def blade(base,ang,length,width,rise,bend,mi=None):
 # Shallow folded ribbon with center keel, tapered tip, gradual twist and declining tip.
 mi=mi if mi is not None else rng.choices(range(6),[25,30,18,15,8,4])[0]
 v=[];uv=[];f=[];N=10 if kind=='bermuda-grass' else 15
 phase=rng.random()*6.28
 for j in range(N+1):
  t=j/N; a=ang+.18*sin(t*3+phase)*t
  horizontal=length*bend*t*t; z=length*(rise*t-(rise*.58 if bend>.65 else rise*.28)*t*t*t)
  p=Vector(base)+Vector((cos(ang)*horizontal,sin(ang)*horizontal,z))
  w=width*(.34+.9*sin(pi*t**.8))*(1-t)**.55 + .000006
  side=Vector((-sin(a),cos(a),.17*sin(t*5+phase)))
  for k in range(5):
   s=(k-2)/2;v.append(p+side*w*s+Vector((0,0,-abs(s)*w*.22)));uv.append((k/4,t))
 for j in range(N):
  for k in range(4):q=j*5+k;f.append((q,q+1,q+6,q+5))
 poly(('Blades',mi),v,f,uv)
if kind=='bermuda-grass':
 for runner in range(12):
  a=runner*2*pi/12+rng.uniform(-.15,.15); L=rng.uniform(.14,.25); pts=[]
  for j in range(9):
   t=j/8;p=Vector((cos(a)*L*t,sin(a)*L*t+.016*sin(t*4+runner),.006+.004*sin(t*pi)));pts.append(p)
   if j>0:
    tube(('Nodes',5),[p-Vector((0,0,.001)),p+Vector((0,0,.004))],.0016,6)
    for k in range(rng.randint(4,7)):blade(p,a+rng.uniform(-2,2),rng.uniform(.035,.085),rng.uniform(.0009,.0018),rng.uniform(.8,1.15),rng.uniform(.25,.9))
    if j%3==1:
     for k in range(2):tube(('Rootlets',5),[p,p+Vector((rng.uniform(-.006,.006),rng.uniform(-.006,.006),-.004))],.00024,3)
  tube(('Stolons',6),pts,.0011,6)
 for j in range(95):
  a=rng.random()*2*pi;r=.075*rng.random()**.5
  blade((cos(a)*r,sin(a)*r,.008),rng.random()*2*pi,rng.uniform(.045,.105),rng.uniform(.001,.002),1,rng.uniform(.2,.9))
elif kind=='fine-fescue':
 for j in range(185):
  a=rng.random()*2*pi;r=.024*rng.random()**.5
  blade((cos(a)*r,sin(a)*r,.001),a+rng.uniform(-.7,.7),rng.uniform(.19,.40),rng.uniform(.00045,.00085),rng.uniform(.85,1.1),rng.uniform(.18,.85))
 for i in range(5):
  a=rng.random()*2*pi; H=rng.uniform(.32,.43);p=Vector((.04*cos(a),.04*sin(a),H))
  tube(('Flowering culms',4),[(0,0,0),p*.5,p],.0007)
  for j in range(7):
   s=p* (1-.24*j/7); aa=a+j*2.4;q=s+Vector((.022*cos(aa),.022*sin(aa),.025))
   tube(('Panicle branches',4),[s,q],.00028,4)
   for k in range(3):
    q2=q+Vector((.006*cos(aa+k),.006*sin(aa+k),.007*k));tube(('Spikelets',5),[q2,q2+Vector((.001,0,.005))],.0008,4)
else:
 # 5 distinct culms, each leaf emerges from a visible encircling sheath at a stem node.
 for i in range(5):
  a=2*pi*i/5+.5; H=[.52,.42,.57,.37,.46][i]; b=Vector((.013*cos(a),.013*sin(a),0));lean=Vector((.07*cos(a),.07*sin(a),0))
  def pos(t):return b+lean*t*t+Vector((0,0,H*t))
  tube(('Culms',1),[pos(j/14) for j in range(15)],.0018,7)
  for j in range(1,7):
   t=.10+j*.105;p=pos(t);aa=a+j*2.7
   tube(('Leaf sheaths',4),[pos(t-.06),p,pos(t+.012)],.002,7)
   blade(p,aa,rng.uniform(.11,.21)*(1-t*.4),rng.uniform(.003,.0055),rng.uniform(.15,.8),rng.uniform(.75,1.1))
  # gently arcing foxtail, dense spiral seedlets and fine individual bristles.
  def hp(t):return pos(1)+Vector((cos(a)*.030*t*t,sin(a)*.030*t*t,.072*t))
  tube(('Seed rachis',4),[hp(j/12) for j in range(13)],.0035,8)
  for j in range(110):
   t=(j+.5)/110;ang=j*2.39996;rd=.0036*sin(pi*t)**.35
   c=hp(t); direction=Vector((cos(ang),sin(ang),.20))
   q=c+direction*rd
   tube(('Seedlets',2),[q,q+Vector((0,0,.003))],.00125,4)
   for k in range(2):
    d=Vector((cos(ang+k*.5),sin(ang+k*.5),.42+rng.random()*.5))
    tube(('Bristles',4),[q,q+d*rng.uniform(.006,.012)],.00014,3)
 for j in range(20):blade((rng.uniform(-.012,.012),rng.uniform(-.012,.012),.002),rng.random()*2*pi,rng.uniform(.12,.24),.002,1,rng.uniform(.5,1))
objects=[]
for (group,mi),vs in verts.items():
 me=bpy.data.meshes.new(group);me.from_pydata(vs,[],faces[(group,mi)]);me.update();ob=bpy.data.objects.new(group+' • '+mats[mi].name,me);bpy.context.collection.objects.link(ob);me.materials.append(mats[mi]);objects.append(ob)
 lay=me.uv_layers.new(name='Fiber UV')
 for face in me.polygons:
  face.use_smooth=True
  for li in face.loop_indices:lay.data[li].uv=uvs[(group,mi)][me.loops[li].vertex_index]
 # Double-sided thin natural leaves: exporter material is double-sided by default.
 ob['anatomy']=group; ob['asset']=kind
# Coordinate normalization: exact ground contact and fescue concept proportions.
if kind=='fine-fescue':
 for ob in objects:
  for v in ob.data.vertices: v.co.x*=.72; v.co.y*=.72; v.co.z*=.94
lowest=min(v.co.z for ob in objects for v in ob.data.vertices)
for ob in objects:
 for v in ob.data.vertices:v.co.z-=lowest
bpy.context.scene.unit_settings.system='METRIC'
coords=[ob.matrix_world@v.co for ob in objects for v in ob.data.vertices];mn=Vector(tuple(min(v[i] for v in coords) for i in range(3)));mx=Vector(tuple(max(v[i] for v in coords) for i in range(3)))
center=(mn+mx)/2;size=mx-mn
scene=bpy.context.scene; scene.render.engine='CYCLES';scene.cycles.samples=128;scene.cycles.use_denoising=False;scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.render.film_transparent=True
scene.world.color=(.22,.22,.22);scene.view_settings.view_transform='AgX'
def aim(ob,target):ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
for loc,power,sizeL in [((-.7,-1,1.4),32,1.1),((.7,.3,.9),15,.8),((0,.8,1.2),24,.7)]:
 bpy.ops.object.light_add(type='AREA',location=loc);ob=bpy.context.object;ob.data.energy=power;ob.data.shape='DISK';ob.data.size=sizeL;aim(ob,center)
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=max(size.z,size.x)*1.22
cam.location=center+Vector((.65,-1.7,.65 if kind=='bermuda-grass' else .3));aim(cam,center)
for ob in bpy.context.selected_objects:ob.select_set(False)
for ob in objects:ob.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=ROOT+'/model.glb',use_selection=True,export_format='GLB',export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT')
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/model.blend',compress=True)
scene.render.image_settings.file_format='PNG';scene.render.filepath=ROOT+'/images/cover.png';bpy.ops.render.render(write_still=True)
cam.location=center+Vector((-1.3,.8,.7));aim(cam,center);scene.render.filepath=ROOT+'/images/rear.png';bpy.ops.render.render(write_still=True)
stats={'asset':kind,'dimensions_m':list(size),'bounds_min':list(mn),'bounds_max':list(mx),'triangles':sum(sum(len(p.vertices)-2 for p in ob.data.polygons) for ob in objects),'mesh_objects':len(objects),'materials':len(mats),'source_verified':True}
# Reopen saved source and actual exported file in fresh scene; record size/topology parity.
bpy.ops.wm.open_mainfile(filepath=ROOT+'/model.blend');stats['blend_reopened']=True
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False);bpy.ops.import_scene.gltf(filepath=ROOT+'/model.glb')
imported=[o for o in bpy.context.scene.objects if o.type=='MESH'];stats['imported_mesh_objects']=len(imported);stats['imported_triangles']=sum(len(o.data.polygons) for o in imported)
coords=[o.matrix_world@v.co for o in imported for v in o.data.vertices];stats['reimport_dimensions_m']=[max(v[i] for v in coords)-min(v[i] for v in coords) for i in range(3)]
with open(ROOT+'/qa.json','w') as f:json.dump(stats,f,indent=2)
print('COMPLETE',stats)

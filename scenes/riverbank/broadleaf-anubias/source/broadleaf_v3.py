"""Anubias-like broadleaf clump, v3. Only make_broadleaf_v3 creates objects.
Reference: approved 04 concept + official Tropica Anubias barteri var. nana
https://tropica.com/en/plants/plantdetails/4545/4545 (shape only, no copied pixels).
Local Z up, horizontal exposed rhizome, short attached roots, closed leaf meshes.
Opaque lighter undersides approximate soft light-through coloration without scene
transparency/transmission. This is not physical subsurface scattering in glTF.
"""
import math
import random
import bpy
import numpy as np
from mathutils import Vector
from plants import _mesh, _tube, _image, _plain


def _materials():
    w,h=256,512
    yy,xx=np.mgrid[0:h,0:w];t=yy/(h-1);s=xx/(w-1)*2-1
    colors=[];bottoms=[];normals=[];roughs=[]
    rng=np.random.default_rng(6043)
    for k,base in enumerate([(.12,.29,.060),(.15,.32,.070),(.10,.255,.055),(.28,.42,.090)]):
        # Irregular, low-frequency cells, no ruler-straight repeating vein grid.
        mot=np.zeros((h,w))
        for _ in range(12):
            mot+=np.sin(t*rng.uniform(8,80)+s*rng.uniform(3,20)+rng.uniform(0,6.28))/12
        center=np.exp(-(s/(.020+.010*(1-t)))**2)
        lateral=np.zeros((h,w))
        for r in range(7):
            origin=.12+r*.112+rng.uniform(-.015,.015)
            for sign in (-1,1):
                x=s*sign
                distance=t-origin-.22*x+.07*x*x
                lateral=np.maximum(lateral,np.exp(-(distance/.006)**2)*(x>0)*np.clip(1-x*.55,0,1))
        height=.5*center+.23*lateral+.035*mot
        gy,gx=np.gradient(height)
        normal=np.ones((h,w,4));normal[:,:,:3]=np.stack([-gx*1.4,-gy*.8,np.ones_like(t)],-1)
        normal[:,:,:3]/=np.linalg.norm(normal[:,:,:3],axis=-1,keepdims=True)
        normal[:,:,:3]=normal[:,:,:3]*.5+.5
        rgba=np.ones((h,w,4));rgba[:,:,:3]=np.array(base)*(1+.34*mot-.045*abs(s))[:,:,None]
        rgba[:,:,:3]+=(.040*center+.024*lateral)[:,:,None]*np.array([.6,.8,.24])
        # Restrained uneven olive ageing near one edge, not large brown holes.
        if k==2:
            age=np.exp(-((s-.86)/.15)**2-((t-.64)/.11)**2)
            rgba[:,:,:3]=rgba[:,:,:3]*(1-.10*age[:,:,None])+age[:,:,None]*np.array([.011,.005,0])
        under=rgba.copy();under[:,:,:3]=np.clip(rgba[:,:,:3]*1.12+np.array([.016,.022,.006]),0,1)
        rough=np.ones((h,w,4));rough[:,:,0]=1;rough[:,:,1]=np.clip(.59+.095*mot+.035*abs(s)-.035*center,.49,.72);rough[:,:,2]=0
        colors.append(rgba);bottoms.append(under);normals.append(normal);roughs.append(rough)
    color=_image('BroadleafV3_age_venation_atlas',np.concatenate(colors,axis=1))
    under=_image('BroadleafV3_opaque_lighter_underside',np.concatenate(bottoms,axis=1))
    normal=_image('BroadleafV3_shallow_veins',np.concatenate(normals,axis=1),True)
    rough=_image('BroadleafV3_regional_roughness',np.concatenate(roughs,axis=1),True)
    mats=[]
    for label,col in [('upper',color),('underside',under)]:
        m=bpy.data.materials.new('RiverV3_leaf_'+label);m.use_nodes=True;m.use_backface_culling=False
        nodes=m.node_tree.nodes;links=m.node_tree.links;p=nodes.get('Principled BSDF')
        p.inputs['Specular IOR Level'].default_value=.32;p.inputs['Roughness'].default_value=.53
        p.inputs['Coat Weight'].default_value=0;p.inputs['Transmission Weight'].default_value=0
        a=nodes.new('ShaderNodeTexImage');a.image=col;links.new(a.outputs['Color'],p.inputs['Base Color'])
        a=nodes.new('ShaderNodeTexImage');a.image=rough;sep=nodes.new('ShaderNodeSeparateColor');links.new(a.outputs['Color'],sep.inputs['Color']);links.new(sep.outputs['Green'],p.inputs['Roughness'])
        a=nodes.new('ShaderNodeTexImage');a.image=normal;n=nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.42;links.new(a.outputs['Color'],n.inputs['Color']);links.new(n.outputs['Normal'],p.inputs['Normal'])
        mats.append(m)
    return mats


def _blade(name,start,direction,length,width,rise,drop,twist,seed,tile,mats):
    rng=random.Random(seed);ns=32;nw=10
    start=Vector(start);d=Vector((math.cos(direction),math.sin(direction),0));cross=Vector((-d.y,d.x,0));up=Vector((0,0,1))
    phase=rng.uniform(0,6.28);asym=rng.uniform(-.10,.10);exponent=rng.uniform(.51,.72)
    leftfull=rng.uniform(.92,1.08);rightfull=rng.uniform(.92,1.08)
    verts=[];uv=[];faces=[]
    def center(t):
        return start+d*(length*t)+cross*(length*.065*math.sin(t*2.7+phase)*t)+up*(rise*t+length*.16*math.sin(t*math.pi)-drop*t**3)
    for side in (1,-1):
        for i in range(ns+1):
            t=i/ns;c=center(t);tangent=(center(min(1,t+.001))-center(max(0,t-.001))).normalized()
            axis=(cross*math.cos(twist*t)+up*math.sin(twist*t)).normalized();normal=tangent.cross(axis).normalized()
            # Rounded shoulders and independently varying left/right outlines.
            profile=max(.004,math.sin(math.pi*t)**exponent*(1-.15*t))
            for j in range(nw+1):
                s=j/nw*2-1;full=leftfull if s<0 else rightfull
                outline=1+.028*math.sin(t*13+phase)+.018*math.sin(t*23+seed)
                if seed%3==0 and s>0:outline-=.045*math.exp(-((t-.70)/.045)**2)
                lateral=s*width*.5*profile*full*outline*(1+asym*(t-.4))
                # Very shallow fold / soft unequal edge roll, never accordion ribs.
                fold=-width*.060*abs(s)**1.6*math.sin(math.pi*t)
                fold+=width*.025*s*s*math.sin(t*7+phase)*math.sin(math.pi*t)
                p=c+axis*lateral+normal*(fold+side*.0010)
                verts.append(tuple(p));uv.append(((tile+.012+.976*j/nw)/4,.012+.976*t))
    count=(ns+1)*(nw+1)
    for side in range(2):
        for i in range(ns):
            for j in range(nw):
                a=side*count+i*(nw+1)+j;q=(a,a+1,a+nw+2,a+nw+1);faces.append(q if side==0 else tuple(reversed(q)))
    border=list(range(nw+1))+[i*(nw+1)+nw for i in range(1,ns+1)]+[ns*(nw+1)+j for j in range(nw-1,-1,-1)]+[i*(nw+1) for i in range(ns-1,0,-1)]
    for a,b in zip(border,border[1:]+border[:1]):faces.append((a,a+count,b+count,b))
    obj=_mesh(name,verts,faces,mats[0],uv);obj.data.materials.append(mats[1])
    for p in obj.data.polygons:
        if ns*nw<=p.index<ns*nw*2:p.material_index=1
    return obj


def make_broadleaf_v3():
    """Return mesh objects at local origin; placement/export remain caller-owned.
    Deterministic 11 individually shaped leaves, 3 younger at growing rhizome end.
    All imagery generated/packed in memory, no filesystem/network side effects.
    """
    mats=_materials();stem=_plain('RiverV3_petiole',(.14,.25,.045),.57);root=_plain('RiverV3_root',(.145,.125,.075),.82)
    rhizomemat=_plain('RiverV3_rhizome',(.065,.085,.037),.84)
    objects=[]
    points=[Vector((-.27+i*.045,.021*math.sin(i*.55)+.009*math.sin(i*1.8),.075+.013*math.sin(i*.8)+.004*math.cos(i*2.1))) for i in range(13)]
    objects.append(_tube('BroadleafV3_horizontal_rhizome',points,[(.005 if i in (0,12) else .021)+.010*math.sin(i*1.45+.3)**2+.003*math.cos(i*.7) for i in range(13)],rhizomemat,10))
    # Hand-directed staggered canopy prevents identical radial rosette arrangement.
    specs=[
      (-.23,-2.55,.20,.51,.31,.11,.19,-.28,0),
      (-.18,.95,.32,.50,.34,.19,.07,.18,1),
      (-.13,-1.15,.24,.53,.35,.18,.20,.24,2),
      (-.08,2.65,.31,.49,.30,.25,.06,-.21,0),
      (-.025,-.18,.30,.49,.32,.15,.12,-.30,1),
      (.03,1.75,.39,.47,.29,.28,.055,.18,0),
      (.08,-2.0,.29,.46,.30,.16,.14,-.15,2),
      (.13,.5,.36,.42,.27,.22,.06,.28,1),
      (.19,-.82,.23,.30,.20,.16,.045,-.17,3),
      (.24,1.30,.30,.28,.17,.17,.025,.46,3),
      (.28,-.15,.19,.23,.115,.20,.020,.66,3)]
    for i,(x,angle,pet,L,W,rise,drop,twist,tile) in enumerate(specs):
        base=Vector((x,.018*math.sin((x+.27)/.045*.55),.078));d=Vector((math.cos(angle),math.sin(angle),0))
        start=base+d*(.075 if i<8 else .045)+Vector((0,0,pet))
        pp=[base.lerp(start,j/7)+d*(.025*math.sin(j/7*math.pi)) for j in range(8)]
        objects.append(_tube(f'BroadleafV3_petiole_{i:02}',pp,[.011*(1-j/14) for j in range(8)],stem,8))
        objects.append(_blade(f'BroadleafV3_leaf_{i:02}_'+('young' if tile==3 else 'mature'),start,angle,L,W,rise,drop,twist,121+i*37,tile,mats))
    rng=random.Random(117)
    for i in range(18):
        x=-.25+i*.030+rng.uniform(-.008,.008);side=-1 if i%2 else 1;reach=rng.uniform(.06,.16);points=[]
        for j in range(9):
            t=j/8;points.append(Vector((x+.025*math.sin(t*4+i),side*reach*t,.064*(1-t)**2+.006)))
        objects.append(_tube(f'BroadleafV3_attached_root_{i:02}',points,[.0045*(1-j/9)**1.3+.0006 for j in range(9)],root,6))
    # Apply a single normalization to keep the approved scene-scale envelope.
    highest=max(v.co.z for o in objects for v in o.data.vertices)
    scale=.76/highest
    for o in objects:
        for v in o.data.vertices:v.co*=scale
    return objects

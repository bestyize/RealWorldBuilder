"""Geometry-only V4 Anubias blade/petiole seating. No scene effects on import.
apply_leaf_joints_v4(objs) preserves leaf topology, UVs and material slots.
Only blade rows 0..3 and the petiole terminal section are changed. Inputs are
unaltered make_broadleaf_v3 meshes before scene placement. Returns the same list.
"""
import math
import bpy
from mathutils import Vector

def _mean(points):
    return sum(points,Vector())/len(points)

def apply_leaf_joints_v4(objs):
    lookup={o.name:o for o in objs}
    for leaf in objs:
        if not leaf.name.startswith('BroadleafV3_leaf_'):continue
        if leaf.get('leaf_joint_v4'):continue
        index=leaf.name.split('_')[2]
        stem=lookup.get('BroadleafV3_petiole_'+index)
        if stem is None:continue
        me=leaf.data;ns=32;nw=10;stride=11;count=363
        if len(me.vertices)!=726 or len(stem.data.vertices)!=64:
            raise ValueError('V4 joints require original V3 leaf/petiole topology')
        original=[v.co.copy() for v in me.vertices]
        centers=[];normals=[];axes=[]
        for i in range(5):
            top=original[i*stride+5];bottom=original[count+i*stride+5]
            centers.append((top+bottom)*.5);normals.append((top-bottom).normalized())
            axes.append((original[i*stride+10]-original[i*stride]).normalized())
        thickness=(original[5]-original[count+5]).length*.5
        old=[v.co.copy() for v in stem.data.vertices]
        oldcenters=[_mean(old[i*8:(i+1)*8]) for i in range(8)]
        radius=(old[5*8]-oldcenters[5]).length
        neckwidth=radius*.60
        # Root is rounded to the petiole width; adjacent lamina opens gradually.
        for i in range(4):
            for side in range(2):
                for j in range(11):
                    vi=side*count+i*stride+j;s=j/5-1;delta=original[vi]-centers[i]
                    lateral=delta.dot(axes[i]);normalpart=delta-axes[i]*lateral
                    if i==0:
                        lateral=s*neckwidth
                        # Gentle convex crown, not a circular knob.
                        normalpart=normals[i]*(thickness*(1 if side==0 else -1))
                    else:lateral*= [.0,.42,.74,.94][i]
                    me.vertices[vi].co=centers[i]+axes[i]*lateral+normalpart
        me.update()
        # Keep the first six original rings byte-for-byte, then smoothly flatten
        # the terminal petiole into a small underside midrib. Its final cap lies
        # strictly inside the blade slab, never projecting through the top.
        verts=old[:48];rings=[oldcenters[5]]
        base=centers[0]-normals[0]*(thickness*.30)
        start=oldcenters[5];startdir=(oldcenters[5]-oldcenters[4]).normalized()
        enddir=(centers[1]-centers[0]).normalized();distance=(base-start).length
        oldaxis=(old[40]-start).normalized();oldnormal=(old[42]-start).normalized()
        orientation=1 if oldaxis.dot(axes[0])+oldnormal.dot(normals[0])>=0 else -1
        for k in range(1,7):
            t=k/6;omt=1-t
            p=omt**3*start+3*omt*omt*t*(start+startdir*distance*.48)+3*omt*t*t*(base-enddir*distance*.16)+t**3*base
            axis=oldaxis.lerp(axes[0]*orientation,t).normalized();normal=oldnormal.lerp(normals[0]*orientation,t).normalized();across=radius*(1-t)+neckwidth*.86*t;depth=radius*(1-t)**1.8+thickness*.52*t
            for j in range(8):
                a=math.tau*j/8;verts.append(p+axis*math.cos(a)*across+normal*math.sin(a)*depth)
        for k in range(1,5):
            t=k/4;f=t*2;i=min(1,int(f));q=f-i
            center=centers[i].lerp(centers[i+1],q);normal=normals[i].lerp(normals[i+1],q).normalized();axis=axes[i].lerp(axes[i+1],q).normalized()
            center-=normal*(thickness*.30);axis*=orientation;normal*=orientation;across=neckwidth*(.86-.44*t);depth=thickness*(.52-.16*t)
            for j in range(8):
                a=math.tau*j/8;verts.append(center+axis*math.cos(a)*across+normal*math.sin(a)*depth)
        nr=len(verts)//8;faces=[]
        for i in range(nr-1):
            for j in range(8):a=i*8+j;b=i*8+(j+1)%8;faces.append((a,b,b+8,a+8))
        faces.extend([tuple(reversed(range(8))),tuple((nr-1)*8+j for j in range(8))])
        replacement=bpy.data.meshes.new(stem.data.name+'_V4_seated');replacement.from_pydata(verts,[],faces);replacement.update()
        for mat in stem.data.materials:replacement.materials.append(mat)
        for p in replacement.polygons:p.use_smooth=True
        stem.data=replacement
        leaf['leaf_joint_v4']=True;stem['leaf_joint_v4']=True
        stem['tip_top_clearance']=thickness*(1+.30-.36)
        stem['tip_embedded_depth']=thickness*(1-.30+.36)
        stem['joint_method']='flattened underside midrib; terminal cross-section contained within blade slab'
    return objs

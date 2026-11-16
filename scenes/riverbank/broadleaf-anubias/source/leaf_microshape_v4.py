"""Large-scale blade interior response, retaining the previous V3 perimeter.
Used with the separate portable V4 normal and roughness maps.
"""
import math
import re
from mathutils import Vector

def apply_leaf_microshape_v4(objects):
    nx,nt=10,32
    stride=nx+1
    side=(nt+1)*stride
    for obj in objects:
        name=re.search(r'_leaf_(\d+)_',obj.name)
        if not name or len(obj.data.vertices)!=2*side:
            continue
        idx=int(name[1])
        mid=[(obj.data.vertices[j].co+obj.data.vertices[side+j].co)*.5 for j in range(side)]
        for row in range(7,nt):
            t=row/nt
            aft=(t-6/nt)/(1-6/nt)
            weight=math.sin(math.pi*aft)**1.10
            for col in range(1,nx):
                j=row*stride+col
                signed=2*col/nx-1
                x=abs(signed)
                dt=mid[j+stride]-mid[j-stride]
                dx=mid[j+1]-mid[j-1]
                n=dt.cross(dx).normalized()
                hand=-1 if signed<0 else 1
                # Broad elastic cushions between veins. The rhythm bends toward
                # the margin and is slightly different on the two halves.
                phase=(t-.18*x+.055*x*x)*math.tau*(4.6+.32*math.sin(idx))
                phase+=.46*math.sin(t*12+idx*.51)+hand*.19
                lobes=math.sin(phase)+.26*math.sin(phase*1.7+idx*.82)
                lobes*=.72+.25*math.sin(t*9+idx*1.21+hand*.67)
                away=math.sin(math.pi*x)**.8
                center=math.exp(-(signed/.19)**2)
                lift=(.0056*lobes*away+.0009*center)*weight
                v=n*lift
                obj.data.vertices[j].co+=v
                obj.data.vertices[j+side].co+=v
        obj.data.update()

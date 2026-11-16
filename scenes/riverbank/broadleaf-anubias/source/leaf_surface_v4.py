"""Material-only V4 surface for make_broadleaf_v3() output.
apply_leaf_surface_v4(objs) replaces only the two blade materials' normal and
roughness images. Meshes, UVs, pigment/age atlases, stems and roots are untouched.
All maps are packed Non-Color standard glTF inputs, no transparency or shaders.
Reference morphology: S. Tanaka photograph of Anubias barteri var. nana
with blackwood (Commons), inspected for shallow wrinkles and scattered glints.
Earlier Tropica product art is a shape illustration, not photographic evidence.
No photographic pixels used. Relief is texture-scale, not sculpted geometry.
"""
import bpy
import numpy as np


def _smooth_noise(rng, h, w, radius):
    """Low-pass random field without SciPy, with periodic boundary filtered out by UV gutter."""
    n=rng.normal(0,1,(h,w))
    fy=np.fft.fftfreq(h)[:,None];fx=np.fft.fftfreq(w)[None,:]
    n=np.fft.ifft2(np.fft.fft2(n)*np.exp(-2*np.pi**2*radius**2*(fx*fx+fy*fy))).real
    return n/(np.std(n)+1e-8)


def _packed_image(name, values):
    h,w=values.shape[:2]
    image=bpy.data.images.new(name,width=w,height=h,alpha=True)
    image.colorspace_settings.name='Non-Color'
    image.pixels.foreach_set(values.astype(np.float32).ravel());image.pack()
    return image


def _maps():
    h,w=512,256;yy,xx=np.mgrid[0:h,0:w];t=yy/(h-1);s=xx/(w-1)*2-1
    normals=[];roughness=[]
    # Match V3 branching origins exactly; independent noise RNG avoids changing that sequence.
    origins_rng=np.random.default_rng(6043)
    for tile in range(4):
        for _ in range(12):
            origins_rng.uniform(8,80);origins_rng.uniform(3,20);origins_rng.uniform(0,6.28)
        origins=[.12+r*.112+origins_rng.uniform(-.015,.015) for r in range(7)]
        rng=np.random.default_rng(4409+tile*109)
        broad=_smooth_noise(rng,h,w,15);medium=_smooth_noise(rng,h,w,4.5);fine=_smooth_noise(rng,h,w,1.0)
        mid=np.exp(-(s/(.022+.012*(1-t)))**2)
        ridge=np.zeros((h,w));terrace=np.zeros((h,w))
        # Individually curved/asymmetric secondary ribs; shallow tissue cushions between them.
        for side in (-1,1):
            x=s*side;mask=x>0
            coord=t-.22*x+.07*x*x
            warp=.0015*medium*np.clip(x,0,1)
            coord+=warp
            for idx,o in enumerate(origins):
                dist=coord-o
                amp=.00034*(.82+.18*np.cos(idx*1.7+tile))
                ridge+=amp*np.exp(-(dist/.0075)**2)*mask*np.clip(1-x*.60,0,1)
            for lo,hi in zip(origins[:-1],origins[1:]):
                q=(coord-lo)/(hi-lo)
                cushion=np.sin(np.pi*np.clip(q,0,1))**1.45
                terrace+=.00058*cushion*(q>0)*(q<1)*mask*np.clip(x*7,0,1)*(1-.60*x)
        # Small connected cell relief; fine pores not white flecks in albedo.
        grain=.000045*medium+.000018*fine
        boundary=np.clip((1-abs(s))/.12,0,1)*np.clip(t/.045,0,1)*np.clip((1-t)/.07,0,1)
        height=(.0011*mid+ridge+terrace+grain)*boundary
        # Derivatives in representative leaf-space units, NOT raw pixels or 4-tile atlas UV.
        # Older leaves ~.3 wide × .5 long. This fixes V3's sub-pixel tiny normal response.
        dv,du=np.gradient(height,.50/(h-1),.30/(w-1))
        du=np.clip(du,-.46,.46);dv=np.clip(dv,-.46,.46)
        n=np.stack([-du,-dv,np.ones_like(du)],axis=-1);n/=np.linalg.norm(n,axis=-1,keepdims=True)
        rgba=np.ones((h,w,4));rgba[:,:,:3]=n*.5+.5;normals.append(rgba)
        # Smooth vein crowns retain narrower highlights; interveinal cells break them up.
        r=.655+.038*np.tanh(broad)+.026*np.tanh(medium)+.010*np.tanh(fine)
        r-=.105*mid+.055*np.clip(ridge/.00034,0,1)
        r+=.025*abs(s)**3
        if tile==3:r-=.035 # younger smoother skin, not a different pigmentation
        packed=np.ones((h,w,4));packed[:,:,0]=1;packed[:,:,1]=np.clip(r,.46,.77);packed[:,:,2]=0
        roughness.append(packed)
    return (_packed_image('LeafV4_coherent_tissue_tangent_normal',np.concatenate(normals,axis=1)),
            _packed_image('LeafV4_regional_surface_roughness',np.concatenate(roughness,axis=1)))


def apply_leaf_surface_v4(objs):
    """Apply opaque microrelief to two existing blade materials, return those materials.
    Only target names RiverV3_leaf_upper / RiverV3_leaf_underside are accepted.
    Existing albedo images and geometry are not modified. Call once per fresh clump.
    """
    mats={m.name:m for o in objs if o.type=='MESH' for m in o.data.materials if m and
          (m.name.startswith('RiverV3_leaf_upper') or m.name.startswith('RiverV3_leaf_underside'))}
    if len(mats)!=2:raise ValueError('Expected exactly two V3 opaque blade materials')
    normal,rough=_maps()
    for material in mats.values():
        nodes=material.node_tree.nodes
        principled=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
        normals=[n for n in nodes if n.type=='NORMAL_MAP']
        if len(normals)!=1:raise ValueError('Expected existing tangent-space normal node')
        node=normals[0];node.space='TANGENT';node.inputs['Strength'].default_value=.9
        node.inputs['Color'].links[0].from_node.image=normal
        sep=principled.inputs['Roughness'].links[0].from_node
        sep.inputs[0].links[0].from_node.image=rough
        principled.inputs['Specular IOR Level'].default_value=.22
        principled.inputs['Coat Weight'].default_value=0
        principled.inputs['Transmission Weight'].default_value=0
        principled.inputs['Alpha'].default_value=1
        material['surface_revision']='V4: coherent microrelief; unchanged pigment/geometry; opaque'
    return list(mats.values())

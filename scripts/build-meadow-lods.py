"""Create low-density composition-only meshes from the editable asset exports.

From repository root:
  blender -b -t 2 --python scripts/build-meadow-lods.py
Optional: after -- pass staging source dir, then destination, then individual IDs.
Publisher still ships full game GLBs and Blender sources in each separate pack.
"""
from pathlib import Path
import bpy
import sys

root=Path(__file__).absolute().parents[1]
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
source=Path(args[0]).absolute() if args else root/'scenes/meadow'
dest=Path(args[1]).absolute() if len(args)>1 else root/'scenes/meadow/lod'
dest.mkdir(parents=True,exist_ok=True)
# Preserve the silhouette at placement scale. Low ratios mostly remove
# subdivisions (not whole stems or leaflets) on the dense small flower meshes.
targets={'bermuda-grass':4100,'fine-fescue':2100,'green-foxtail':2800,
         'white-clover':5900,'common-daisy':8300,'persian-speedwell':3600,
         'self-heal':7200,'field-poppy':13800}
selection=args[2:] if len(args)>2 else list(targets)
for name in selection:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    f=source/name/'model.glb'
    if not f.exists(): raise RuntimeError(f'Missing model: {f}')
    bpy.ops.import_scene.gltf(filepath=str(f))
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    for o in meshes: o.data.calc_loop_triangles()
    before=sum(len(o.data.loop_triangles) for o in meshes)
    total=max(1,before)
    for o in meshes:
        tri=len(o.data.loop_triangles)
        if tri<90: continue
        # Small visible geometry groups have a small guaranteed triangle budget
        # rather than disappearing because another node has far more triangles.
        cap=targets[name]*tri/total
        cap=max(min(tri,60),cap)
        if cap>=tri: continue
        bpy.context.view_layer.objects.active=o
        m=o.modifiers.new('Meadow composition simplification','DECIMATE')
        m.decimate_type='COLLAPSE'
        m.ratio=cap/tri
        m.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=m.name)
    for o in meshes:
        o.data.validate(verbose=False,clean_customdata=False); o.data.calc_loop_triangles()
    num=sum(len(o.data.loop_triangles) for o in meshes)
    out=dest/(name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_yup=True,
                            export_animations=False,export_cameras=False,export_lights=False)
    print(f'MEADOW_LOD {name}: {before} -> {num} triangles, {out.stat().st_size} bytes',flush=True)

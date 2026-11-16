# Silver angelfish model candidate

Species: **Pterophyllum scalare**, silver/black-barred freshwater angelfish, not P. altum. This is an authored 3D approximation, not a photogrammetric scan or a guarantee of photographic equivalence.

## Reference and construction

`concept-generated.png` is the user's generated transparent concept. Only this generated image supplies color/scale/fin pixels. Its alpha is used to extend edge colors before opaque projection, preventing black transparent-RGB fringes. V2 uses an authored overlapping-scale normal map and distributed G-channel roughness texture; see the material refinement section below. No external photograph pixels are included.

Actual anatomy photographs inspected:

- Citron, February 2014, adult P. scalare broadside aquarium photograph: https://commons.wikimedia.org/wiki/File:Pterophyllum_scalare_adult.jpg . The compact diamond body, long dorsal/anal sail extensions, paired pelvic filaments, small forward mouth and rounded iris informed geometry.
- DeniZka, 15 November 2010, oblique P. scalare (gold variant, anatomy only): https://commons.wikimedia.org/wiki/File:P_scalare.JPG . Used for cheek thickness, forward mouth and separated pelvic attachment.
- Gérard Lacz, near-front diamond angelfish: https://www.superstock.com/asset/diamond-angelfish-pterophyllum-scalare/4273-20355416 . Used solely to judge compressed chest thickness, opposite-side fins and pelvic roots; stock pixels are not redistributed.
- Taxonomic cross-check: https://www.fishbase.se/summary/Pterophyllum-scalare .

The longitudinal body is a closed compressed volume, not a billboard. Dorsal/anal membranes are independent curved ray-supported surfaces rooted inside it. The caudal peduncle closes and narrows into the tail base. Two separate tapered pelvic filaments and two pectorals are named independently. Eyes use one colored conforming cap each rather than intersecting iris/pupil spheres. The tiny mouth is integrated into the anterior silhouette; feeding/opening animation is not implemented.

All membrane interiors are deliberately OPAQUE and double-sided with no transmission, so the opposite body cannot ghost through them. Thinness is conveyed by geometry and ray texture. Outer translucency is not claimed until separately validated at runtime.

## Rebuild / runtime contract

From repository root:

```sh
blender -b --python fish/silver-angelfish/build_model.py
```

Outputs `silver-angelfish.blend`, self-contained `silver-angelfish.glb`, three generated texture PNGs and neutral `review-side.png`, `review-oblique.png`, `review-front.png`. The .blend packs its images. Only this species directory is modified.

Axes: Blender +X head / +Z up, exported glTF +X head / +Y up. Coordinates are centered around the trunk. Main meshes: `AngelBody`, `AngelTail`, `AngelDorsal`, `AngelAnal`, `AngelPectoral_L/R`, `AngelPelvic_L/R`, `AngelEye_L/R`. The editable 9-bone `AngelRig` contains five spine bones and four fin controls; rest pose is exported, with no baked animation.

Suggested runtime: nearly rigid trunk, slow hovering/drifting, gentle continuous tail yaw after x=-1.15, low-amplitude dorsal/anal edge flutter beyond |Y|=1.15, pelvic tip sway below Y=-0.76 with fixed roots, restrained paired pectoral sculling. Full fin and filament silhouette must fit the camera. Browser assessment is separate from Blender and required before delivery.

## V2 material refinement: overlapping scale response

The V1 close view looked continuously glazed. V2 leaves albedo, broad silver/black-bar colors, geometry, UVs, skin weights, rig and swim unchanged. A deterministic staggered scale-margin height field now creates shallow directional overlapping edges in the normal map. Margins have rounded varying placement rather than a rectangular dark grid; no grid is painted into the color map. Relief tapers near the crown/ventral boundary and small head tissue. These are shader-scale surface details, not individually modeled scales or a biological scan.

- Body normal texture: OpenGL tangent-space RGB, shader strength .72; bounded XY slopes ±.45 before that strength.
- Body metallic-roughness texture: non-color, G roughness distributed over scale faces/edges (bounded .39–.61), B metalness 0. The body remains nonmetallic. Per-scale variation breaks uniform highlights.
- Body clearcoat 0; Blender specular IOR-level .26, exported KHR_materials_specular factor approximately .52. Wet response remains through the ordinary surface lobe, not a continuous clearcoat layer.
- Fin and eye material behavior unchanged.

`review-material-close.png` adds a grazing-angle Blender macro. Three standard whole-fish renders are still generated. Actual standalone build and six swim tests passed. GLTFLoader runtime tests decode embedded WebP maps, retain body normalScale ±.72 and a non-color roughnessMap, and verify 22 poses/independent instances/loop continuity. Geometry attribute and index buffer bytes, and albedo PNG hash, were compared unchanged to preserved V1.

Matched browser proof is kept separately from the asset package. Its near-distance test lowers the camera clamp only in temporary QA HTML (minimum distance 5 versus production 14), using identical lighting, pose and controls in both versions. The initial V2 distributed `preview.html` retained that framing. The final production page now permits minimum distance 7.5 for real close inspection, while unchanged desktop/mobile initial distances and Reset restore the full silhouette. Fine relief is clearest nearby or under grazing light; full-fish distant views intentionally remain restrained. Generated pigmentation still contains baked illumination, so this is improved material realism, not a guarantee of photo equivalence.

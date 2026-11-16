# 红白锦鲤 / Kohaku koi · V2

Original 3D asset made for RealWorldBuilder, November 16, 2026.

## Reference and appearance

`concept-side.png` is a generated photographic-style side reference, made with the built-in ImageGen tool from the user's red-and-white top-view koi concept. It is **not a real wildlife photograph**. The model follows the repository's vermilion-arowana workflow: trace the body silhouette separately from the fins, wrap image-derived pigmentation and scale detail around three-dimensional geometry, and sample fin membrane detail separately.

The V1 procedural material looked too synthetic in the browser. V2 replaces the repeated procedural scales and geometric color islands with the actual generated side-reference pixels. It reconstructs the forehead, shoulder and belly from traced stations, keeps the back/flanks volumetric, and uses source fin rays instead of bright repeated rods. The original source eye is neutralized beneath the separate small 3D eye. The opaque photographic pectoral overlap is removed from body color. The reference's outer halo is avoided in body sampling and source alpha is retained on the fins.

Anatomy reference: USGS Fish Health Program, *Koi (Cyprinus carpio koi)*, https://www.usgs.gov/labs/fish-health-program/science/koi-cyprinus-carpio-koi-fhp . The model has a tapered carp body, paired barbels at each mouth corner, small paired eyes, chest/pelvic fins, dorsal/anal fins and an organically rounded forked caudal fin. No external wildlife photograph or commercially licensed fish asset is embedded in the model or textures.

The generated concept cannot provide hidden-side measurements. The far flank and unseen geometry are inferred; this is an original real-time reconstruction, not a scan or exact inverse reconstruction.

## Rebuild

Run `blender -b --python fish/kohaku-koi/build_koi.py` from the repository root. The original model used Blender 4.3.2. This material build used Blender 5.3.0. Optional `KOI_OUT` overrides the asset output directory, which must also contain `concept-side.png`. No add-ons or network service are required.

Outputs: editable `kohaku-koi.blend`, `kohaku-koi.glb`, body base-color/normal PNGs, and oblique/side review renders. The GLB embeds the texture maps. The Blender source packs the maps, including the corrected fin color and its original alpha. `preview-still.png` uses the reviewed oblique render.

## Coordinate and animation contract

- Head +X. Blender +Z up; glTF +Y up.
- Full length approximately 5.5 units; body spans x=-2.15 to +2.30.
- `KohakuRig` contains six weighted `KoiSpine_0` through `KoiSpine_5` bones. Export is the unposed bind state, without a baked animation clip. The editable rig is preserved while the current browser controller deforms a root-space geometry copy.
- Anatomical meshes: KoiBody, KoiTail, KoiDorsal, KoiAnal, KoiPectoral_L/R, KoiPelvic_L/R, iris/eye pairs, subtle gill folds, barbels and mouth creases.
- V2 has 17,409 source vertices and 20 exported meshes, significantly fewer than V1 because fin rays are now material detail.

## Material and validation

Color images use sRGB; the bounded fine normal texture uses Non-Color. Mild roughness, very low metalness and restrained coat preserve pearl-like rather than chrome-like reflection. Fin membrane alpha is source alpha multiplied by 0.70; preserve double-sided rendering and blending at runtime.

Validated in Blender: complete side and oblique renders; no bright geometric ray stripes or black source-background fragments on the reviewed fins. GLB structure checked: one six-joint skin, three embedded textures, no external image dependency. Runtime lighting and movement must additionally be checked in the actual Three.js viewer; Blender appearance alone is not browser acceptance.

## V3 material refinement

User feedback: V2 looked too smooth. V3 is material-only: source geometry positions and base-color PNG are byte-identical to V2. The new reference-derived normal map isolates scale-sized detail with a 2.4–8 pixel band, suppresses pigment-island edges and softens head skin. Effective normal strength is 0.32 after rejecting an overly rough prototype.

`kohaku-metallic-roughness.png` contains spatial roughness in **G**, zero metallic in **B**, and an unused white R channel, exported through the actual glTF metallicRoughnessTexture field. Roughness varies by thin reference edges and plate interior rather than random grain. Clearcoat falls from 0.10 to 0.025, with rougher coat and reduced specular. The goal is discontinuous wet scale highlights, not a single uninterrupted plastic stripe. Paired matched-camera Blender closeups were rendered with the same grazing light; final browser acceptance is separate.

## V4 head anatomy

User feedback identified unrealistic barbels, mouth and eyes. V4 preserves V3 body pigmentation, normal/roughness textures, trunk and fin geometry, rig and swimming controller. It replaces only the head accessory meshes and locally adjusts terminal-muzzle UVs (x > 2.13) to prevent mirrored source-edge residue at the nose.

- Eyes: one shallow continuous cap per side with vertex-colored dark pupil, muted warm radial iris and a narrow blended tissue edge. This avoids clipping between separate overlapping eyeball, pupil and socket spheres.
- Barbels: four total, rooted at the upper lip and mouth corners. The upper pair is shorter; the corner pair hangs farther down with tapering, softly curved tips. The two pairs no longer read as equal parallel sticks.
- Mouth: a nearly closed, slightly subterminal/oblique seam with soft upper and lower lips and understated lower-jaw volume. The lips are continuous corner-to-corner curves, and the terminal nose ring is closed to avoid a central crack. It is not a large circular suction disc. In-motion mouth opening is outside this iteration's scope.

Observed references (anatomy only, no pixels copied or distributed):

1. Stan Shebs, live koi head in frontal/oblique view, July 2001: https://commons.wikimedia.org/wiki/File:Koi_head_closeup.jpg . The photograph clearly shows small embedded eyes, fleshy near-closed lips, the longer corner barbels and smaller upper pair.
2. NCFishes, common carp side-head identification photograph: https://ncfishes.com/freshwater-fishes-of-north-carolina/cyprinus-carpio/ ; detail https://ncfishes.com/wp-content/uploads/2021/10/Carp-Barbels.png . Used for side placement and tapered barbel roots, not coloration.
3. FAO common carp species profile: https://www.fao.org/fishery/docs/CDrom/aquaculture/I1129m/file/en/en_commoncarp.htm . Describes two pairs of barbels at the mouth angle, the shorter ones on the upper lip.

Koi color/eye appearance varies by individual. This is a visually grounded approximation of an adult Kohaku head, not a measured anatomical scan. Reference renders use matched neutral side, oblique and frontal cameras; final Three.js captures are required separately.

## V5 continuous mouth reconstruction

User rejected V4's visible parallel lip strips. V5 removes all separate upper/lower lip curves, dark seam curve and lower-jaw sphere. Instead, original anterior body columns beyond x = 2.06 transition continuously into a narrow, slightly downturned mouth aperture. The corners extend to the long-barbel anchors; two connected inward rings make a recessed cavity. Upper snout and lower jaw share the body material and mesh rather than a contrasting outlined ring. No additional tubular lip is layered on top.

The same live Stan Shebs koi head and NCFishes side anatomy references above were visually rechecked. They inform the resting curved crease and soft lower tissue; no real-photo pixels are copied. V4 eye caps, torso, fins, texture images, rig and swimming code are unchanged. All four barbel tips remain fixed; their roots are raycast onto the reconstructed surface and buried slightly to avoid floating attachment ends. This is a resting mouth approximation, not an opening/feeding animation. Matched frontal and oblique closeups are checked before browser validation.

## V6 caudal attachment and dorsal opacity

The V5 posterior body ring was open and met a broad planar tail root, exposing a cut-tube silhouette from behind. V6 extends that exact ring through nine continuously connected tapering rings into a closed, laterally thin caudal wedge. The tail membrane's proximal fan is narrowed and buried inside this tissue; the outer tail contour is unchanged. Existing scale texture is sampled over the extension (rather than stretched from one texel column). No source image pixels are modified.

The common-carp side photograph by Kaitlin Kovacs / USGS was visually inspected for the scaled peduncle's transition into the fin: https://www.usgs.gov/media/images/common-carp-cyprinus-carpio . Reference only, no copied pixels.

The dorsal fin now has its own OPAQUE material with alpha 1 and transmission 0, retaining its original texture, geometry and UVs. This intentionally prioritizes depth-writing and removal of opposite-flank ghosting over literal edge transparency. Thinness remains texture/lighting detail; no transparent edge band is claimed. Other fin materials, the V5 mouth/eyes, trunk and swim controller are unchanged. Final animated seam/depth behavior is checked separately in Three.js.

V6 final seam correction: the short existing caudal segment (x < -1.70) smoothly shifts U by up to 0.043 at the old posterior ring. The new wedge then decreases U monotonically to zero. This removes the mirrored tangent direction at the former join without changing geometry or texture-image bytes.

## Color and swimming refinement

The body color lifts the shaded ivory independently of the red markings. The fin map preserves its rays and alpha and supplies an ivory edge color at nearly transparent texels. Scale normals and roughness retain the same pixel values.

The preview now uses wider turns. The head looks along the curve ahead, and the spine and tail follow the route at successive points along the body. The inner paired fins adjust during turns. A stronger push leads into a quieter glide. The shape of the bend and the change in effort are based on [recorded turns](https://pubmed.ncbi.nlm.nih.gov/18055627/) and [burst-and-coast observations](https://pubmed.ncbi.nlm.nih.gov/17562892/).

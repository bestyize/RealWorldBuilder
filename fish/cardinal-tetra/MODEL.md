# Cardinal tetra: anatomical study and first model candidate

**Paracheirodon axelrodi / 宝莲灯**, not neon tetra P. innesi. Stage: local model candidate, not a browser-accepted or photo-equivalent finished asset.

## Real reference findings

All three real photographs below were opened and their actual image pixels inspected. They are anatomy references only and are not bundled or copied into texture images.

1. Lerdsuwa, 16 November 2006, approximately 2 cm standard-length cardinal: https://commons.wikimedia.org/wiki/File:Cardinal_tetra.jpg . Side profile establishes the modest body depth, small terminal mouth, relatively large eye, long red lower flank beginning behind the gill, narrow reflective blue stripe and small, clear fins.
2. National Institute of Ecology, 26 October 2012: https://commons.wikimedia.org/wiki/File:Paracheirodon_axelrodi.jpg . The school includes oblique silhouettes: fish do not all present identical broadside color and their transparent fins are much less conspicuous than the generated design's white fins.
3. Juan R. Lascorz, April 2010, genuine near-front view: https://commons.wikimedia.org/wiki/File:02.Paracheirodon_axelrodi.JPG . This constrains the oval chest, small forward mouth, widely separated side eyes and paired small pectorals. The model is not a measured scan and references show different individuals.

`concept-generated.png` is the user's generated school design, not a real photo. The center fish supplies authored/generated albedo detail only. The generated glow/background and white fins are not modeled as emission. Its painted eye is neutralized and the small head region reconstructed before applying integrated 3D eyes. No external photographic texture pixels are copied.

## Candidate construction

- Closed longitudinal body and narrow closed caudal terminus, monotonically increasing body UVs. No open tail tube.
- Red lower stripe extends close to the gill, not only the rear half. The cyan stripe has **zero emission** and a moderately glossy PBR response; no light, bloom or emissive glow is attached to the fish.
- Small dorsal, anal, paired pectoral/pelvic fins and adipose fin. Fin roots are opaque; outer membranes use a provisional 0.38 alpha material. This is deliberately less white/opaque than the generated design. Runtime back-face/depth/overlap testing is still required before accepting transparency.
- Two low convex, integrated dark-eye caps. Tiny mouth is part of the tapered closed anterior body, with no floating lip tubes or feeding animation.
- Four render meshes: `CardinalBody`, `CardinalTail`, `CardinalFins`, `CardinalEyes`; small fins/eyes batched to avoid one draw call per appendage. Five-bone editable rest rig `CardinalRig`. One shared GLB is intended for a school, not separate payloads per fish.

## Build and contract

```sh
blender -b --python fish/cardinal-tetra/build_model.py
```

Outputs `cardinal-tetra.blend`, `cardinal-tetra.glb`, generated albedo/normal PNGs, and `review-side/front/oblique/rear.png`. Texture images used by the model are packed in Blender and embedded in GLB. The generated group source is kept once for reproducibility, not exported into GLB.

+X head, Blender Z up → glTF Y up. Body x -1.30…1.28; caudal tips x -1.82; maximum torso depth ≈0.62, width≈0.34. Rig rest pose is exported. For swimming keep head x>0.4 stable, smoothly increase tail sway toward x<-1.2 with independent fish phases. This model alone does not establish multi-fish performance or animation acceptance.

## Review status / limitations

Neutral side, near-front, oblique and rear Blender renders are provided for shape review. Initial duplicate-eye/head sampling artifacts were corrected. Fine fin-ray textures and small lip/gill relief remain simplified for a lightweight school candidate. Transparent outer fins, extremal bending, two phase-independent fish, complete loop, offline interactions and actual draw-call/memory/frame-rate checks are not certified by these Blender renders. Those are separate browser gates in `realism-acceptance.md`.

## Bounded fidelity pass after first browser proof

Actual single-fish browser views exposed a blunt tail cut and flat triangular membranes. The posterior body columns now terminate in a rounded thin caudal wedge; tail membrane roots and their opaque proximal row are buried inside it. Main trunk/head geometry, pigmentation and eye response are unchanged. Fin outer curves are smoothly interpolated and a shared 512×128 authored texture supplies fine, subdued root-to-edge rays. Geometry remains 3,542 source vertices across four render meshes; no geometry ray rods or extra draw groups are added. The ray texture adds a single small shared image. Fin alpha is still 0.38 outside opaque roots, and requires the same live depth/overlap acceptance gate.

Final navy-background readability adjustment lifts only the neutral fin-ray image (membrane baseline 0.16→0.24, ray peak approximately 0.38→0.52). Alpha, depth behavior, all geometry and body/eye response stay unchanged; no scene exposure or light change is involved. This is not a white-fin or emissive treatment.

## V2 regional body response (material-only)

The close-range ceramic-like body highlight is reduced without changing any mesh, UV, index, skin weight, skeleton, eye, fin or swimming route. `cardinal-metallic-roughness.png` uses glTF packed channels (G roughness / B metalness): the dark back is approximately 0.64 roughness, red belly 0.53, reflective blue region 0.30, with restrained irregular variation. Metalness is limited to 0.08 in the blue region. Coat is zero. `cardinal-normal.png` supplies low-amplitude irregular microresponse rather than engraved scale tiles. Blue base pigment is reduced so bright blue is less baked into every viewing angle; emission remains zero.

`cardinal-iridescence.png` stores blue-region film strength in R and film thickness in G (0–420 nm mapping, typically around 330 nm in the stripe). The Blender source connects this same thickness image to Principled Thin Film, IOR 1.35. Blender 4.3's glTF exporter does not serialize thin film, so the generator deterministically embeds that image and adds standard `KHR_materials_iridescence` to the exported body material. GLTFLoader consumes it directly; there is no custom runtime color override. Rebuild through the generator to preserve this export step. Blender and glTF thin-film strength conventions differ, so their appearance is approximate rather than pixel-identical. This is a lightweight optical approximation, not measured multilayer iridophore optics.

Matched offline WebGL review used unchanged camera, time, lighting and exposure for normal-distance, close side and oblique views. The broad white back highlight is visibly restrained; the blue stripe is subtler and the red response more diffuse. The painted source still contributes visible scale-like color marks, so this is a bounded material improvement, not a claim of photographic realism or newly modeled scales. All geometric accessor bytes and skin metadata were verified identical to V1. Desktop/mobile shader compilation, controls and 49 route samples passed; school remains ten fish in six instanced draw groups. Embedded web GLB is 712,460 bytes (V1: 576,020), with five shared image decodes. No device frame-rate benchmark is claimed.

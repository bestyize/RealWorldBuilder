# 斯氏鼠鱼 · Sterba’s cory

Local model candidate, not a claim of photographic accuracy. Historical aquarium name Corydoras sterbai; often now placed in Hoplisoma. No existing fish or aquarium asset is changed.

## Reference basis and authorship
- Tino Strauss, [real side photograph](https://commons.wikimedia.org/wiki/File:Corydoras_sterbai_02.jpg): shoulder dome, sloping forehead, lower cheek, closed narrow caudal peduncle and orange pectoral leading ray.
- D. W., [real head macro](https://commons.wikimedia.org/wiki/File:Corydoras_sterbai_-_Kopf.jpeg): inferior small mouth, short tapering barbels, small dark eye with thin warm iris.
- Wippy, [real oblique fish](https://commons.wikimedia.org/wiki/File:Corydoras_Sterbai.jpg): head width, elevated lateral eyes, cream head spots and armor-row pattern.
All three photographs were visually inspected for anatomy only. No pixels from them are copied or distributed. `concept-generated.png` is the previously generated design, not a real photograph. Its pigmentation is projected and locally corrected to remove its painted eye/fin overlap. Generated source lighting remains a limitation. The broad flattened abdomen and exact ventral mouth surface are an anatomical approximation, not a traced authenticated underside photograph.

## Assets and reproducibility
Run from the repository root:

```sh
blender -b -t 6 --python fish/sterbai-cory/build_model.py
```

This regenerates `sterbai-cory.blend`, `sterbai-cory.glb`, pigment, relief-normal and roughness PNGs, and five `review-*.png` neutral renders. Blender and NumPy bundled with Blender are the only build dependencies. The editable blend retains a six-bone weighted rest rig. The GLB packs its textures and exports that rest pose without animation. The concept source remains alongside the script.

## Construction and runtime contract
- +X head, -X tail; Blender Z up becomes glTF Y up. No animated bind-pose transformations.
- `CoryBody`: tapered closed posterior wedge; integrated small recessed inferior mouth with connected cavity, no separate external lip rods. Low flattened belly. Two shallow curved rows per flank suggest dermal armor rather than scales; their relief and roughness are independent from the spotted pigment.
- `CoryEye_L/R`: one continuous conforming colored cap each; dark pupil, thin warm iris, no floating white globes.
- `CoryBarbels`: six individually tapered editable strands batched into one mesh, roots seated on nearest mouth tissue.
- Fins: `CoryTail`, `CoryDorsal`, `CoryAdipose`, `CoryAnal`, `CoryPectoral_L/R`, `CoryPelvic_L/R`. Orange leading rays are joined into the respective pectoral mesh, sharing its deformation.
- All fin membranes deliberately opaque and double-sided. Thinness is expressed by pigment and restrained sheen, not whole-fin alpha that can reveal the opposite side through the torso.
- Bones `CorySpine_0` through `CorySpine_5`. Runtime can bake the rest mesh and deform it once, rather than apply skinning and procedural motion twice.
- Body roughly X -2.245…2.178, Y -0.607…1.018 in glTF; maximum body half-width .462. Full tail reaches X -3.429, dorsal Y 1.814. Fin tips reach Y -.947743 (pelvics), pectorals -.925817 and barbel tips -.821. Floor collision must use posed vertices, not just body bounds.
- Pectoral roots around (.64,-.357,±.30); pelvic roots (-.5,-.536,±.22), glTF coordinates. Keep their roots planted. Keep head rigid; restrained tail motion begins behind X -1.5 with a continuous field shared by caudal fin and body.

## Acceptance state
Neutral side, oblique, true-front, rear-oblique and underside renders accompany the source. Actual WebGL depth, near-camera mouth, dynamic floor clearance, rear tail joint and mobile framing are a separate integration gate. Paired-fin geometry is intentionally lean; close-range ventral anatomy, source-lighting neutralization and precise armor topology remain approximations. Do not label this candidate photoreal merely from its patterned texture.

### V2 flank armor and forehead pigment

The V1 forehead fix remains: a cylindrical color atlas uses artist-authored irregular dots on the front crown, blended into the flank pigment. V2 uses this atlas for all exterior body faces, avoiding a material boundary between flank and crown. In its physical longitudinal/angular coordinates, two rows of slightly curved and staggered scute rims feed `cory-armor-normal.png` and `cory-armor-roughness.png`. The rounded rims and the shallow join control how highlights move; the pigment uses only a faint value change there. The forehead and belly taper out of the armor field and retain subtle texture. The lower flank blends in independently authored mottled longitudinal pigment to soften the old side projection’s stretched stripe seam. These are renderable surface maps shared by Blender and GLB, not a new geometry layer and not an anatomical count of individual scutes. The orange spines, fins, eyes, mouth, movement and absence of a rendered reference plane remain unchanged. A frozen close view at matched camera distance and lighting is the review gate; actual glTF glancing angles depend on scene lighting.

# 柑橘凤蝶 / Citrus swallowtail (Papilio xuthus)

<!-- ASSET-PACK START -->
## 独立资产包

- [在线预览](https://bestyize.github.io/RealWorldBuilder/scenes/meadow/citrus-swallowtail/preview.html)：直接用 Chrome、Edge 或支持 WebGL 2 的 Safari 打开。默认折叠，画面右侧中部按钮展开管理面板。拖动旋转、滚轮或双指缩放；`#overlay` 隐藏面板按钮。
- [离线 HTML 文件](preview.html)：在 GitHub 点击「Download raw file」，保存后用浏览器打开。
- [Blender 工程](model.blend)：编辑源模型。贴图由项目文件管理。
- [游戏模型 GLB](model.glb)：正式导入用此文件，模型与贴图在 GLB 内，不需要将预览 HTML 导进游戏。GLB +Y 向上，Blender +Z 向上；鱼头约定 +X。
- [模型预览图](images/cover.webp)：实际模型渲染，非生成概念。

单独建模的前后翅、触角与身体。GLB 保留可重用的翅动；单体预览慢放，方便近看翅根。

预览 HTML 内嵌本资产和运行脚本，不需要起服务、连网、下载 CDN 或加载其他品种。仓库中重建：`node scripts/build-asset-packs.mjs citrus-swallowtail`。
<!-- ASSET-PACK END -->


An editable, scene-scale butterfly built from the **approved generated concept**, not a real specimen photograph or a scan. The approved meadow concept establishes the intended naturalistic context; no meadow ground, image plane, camera or light is exported in the GLB.

## Files

- `model.blend`: editable meshes, UVs, packed textures, four wing pivots/NLA tracks, reference dorsal camera and transparent-render lighting.
- `model.glb`: embedded textures, clean spread rest pose, one `FlightLoop` clip.
- `images/cover.webp`: alpha-bearing actual oblique Blender render; no painted stand-in.
- `images/dorsal.png`, `oblique.png`, `flap-extreme.png`, `downstroke.png`: actual model renders.
- `images/reference-vs-model.jpg`: matching dorsal-angle comparison, approved concept left / model right. Subjects framed to comparable wing span; studio illumination differs from the concept.
- `references/approved-dual-view.png`: unchanged approved artwork.
- `references/dorsal-crop.png`: registered source crop, used for UV color texture.
- `references/dorsal-clean-view.png`: presentation crop with unrelated antenna/leg fragments of the second butterfly removed, without modifying the dorsal butterfly.
- `build_model.py`: reproducible Blender construction/export/render script.
- `verify_model.py`, `qa.json`, `reimport-qa.json`: reopen/import and pose checks.

## Geometry and axes

Actual spread span approximately **79.19 mm**; nominal design span 80 mm. Thorax-centered root `CitrusSwallowtail_ThoraxOrigin`. Blender Z up, head +Y; standard glTF conversion gives Y up and head -Z. Four physically thin, curved, separately editable wing meshes: `ForeWing_L`, `ForeWing_R`, `HindWing_L`, `HindWing_R`. Wing thickness 18 micrometers is a scene-scale approximation. Concave hindwing scallops and tails are actual silhouette geometry, not a rectangular transparency card. Wing pivots sit inside the thorax attachment region.

Head, two compound eyes, thorax, overlapping abdomen segments, six articulated legs, two club-ended antennae, coiled proboscis and small thoracic fringe geometry are separate editable parts. Fine patterned body scales use registered texture on actual body volumes. Approximately 50 meshes / 17k vertices / 33k triangles. For large meadow populations, reuse the asset; a lower-detail body/leg LOD is a future optimization, not provided here.

## Materials

Black/cream markings, blue hindwing spots and orange tornal spots use the original approved dorsal pattern, spatially registered to the traced wing mesh. Packed tangent normal and roughness maps provide restrained scale-sized response. Standard Principled/glTF opaque materials, no emission, metallic coating, custom shaders or environmental image planes. The thin wing is deliberately not alpha-blended: it does not leak other objects through its surface. Ventral markings are inferred from the approved second view and reuse the dorsal palette/UV image; they are **not** an independently verified underside specimen reconstruction. Relief and scale density are visual approximations, not microscopic measurement.

## Animation

One glTF animation, **`FlightLoop`**, duration **0.2 seconds** (5 Hz), 25 baked samples at 120 fps, four wing-rotation channels. First and last poses are spread; the model also loads spread without animation. Left/right amplitude varies slightly, with small fore/hind differential pitch. This is a compact representative flight cycle, not measured aerodynamics or a landing/feeding behavior. Slow playback to 0.2–0.4× for inspection. Translation/orientation through the meadow belongs to the scene, not the clip.

## Verification and limits

- Reopened `.blend`: all model image dependencies packed.
- Reimported GLB into an empty scene: four wings and all body meshes retained, no lights/cameras/reference planes.
- Spread, upward and downward extrema checked for finite transforms/vertices; loop endpoints agree.
- Dorsal and oblique renders inspected for original pattern/silhouette registration; attachment slivers corrected.
- Transparent cover alpha checked for both 0 and 255 values.
- Root integration owns final offline HTML/WebGL and scene-level lighting validation. Blender proof does not claim every renderer has been tested.

Rebuild: `/usr/bin/blender -b --python build_model.py` from any directory. Verify: `/usr/bin/blender -b --python verify_model.py`. Outputs remain beside the source script. No Git commits, uploads or publication are part of this asset stage.

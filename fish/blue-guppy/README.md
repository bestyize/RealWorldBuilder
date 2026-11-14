# 蓝扇尾孔雀鱼

以用户提供的蓝色扇尾孔雀鱼侧视图为形态和配色参考，保留青蓝细鳞、银亮的眼圈、透蓝的放射状鳍条和深靛色尾缘。用户只提供了一个角度，因此背腹横截面和另一侧的鳞片排布按侧视轮廓推定。左右保留独立的眼球与胸鳍。

[独立游动预览](preview.html)支持暂停和拖动进度。[Blender 源文件](blue-guppy.blend)和[游戏模型](blue-guppy.glb)都内嵌了贴图。鱼头朝 +X，Blender 中 +Z 向上，GLB 中 +Y 向上。中立姿态下吻端至尾柄约 1.7 模型单位，整鱼约 3.04 单位。放入水族箱时由场景确定比例和游动路线。

## 贴图

| 部位 | 分辨率 | 通道与效果 |
| --- | --- | --- |
| 鱼身与鳃盖 | 2048 × 1024 | 环绕鱼身的底色、鳞缘法线和粗糙度。鳞片细节避开眼窝，薄膜反射随观察角度改变 |
| 扇尾 | 1024 × 2048 | RGBA 鳍膜、鳍条法线、粗糙度。另有 256 × 512 方向图，指引高光沿鳍条从尾柄向外展开 |
| 背鳍 | 1024 × 512 | RGBA 鳍膜、法线、粗糙度 |
| 臀鳍与腹鳍 | 512 × 256 | 各自的 RGBA 鳍膜、法线、粗糙度 |
| 胸鳍 | 512 × 256 | 左右共用 RGBA 鳍膜和鳍条法线，分别驱动 |
| 眼部 | 512 × 512 | 银白虹膜与瞳孔底色，贴在双侧有弧度的角膜网格上 |

底色用 sRGB。法线是 OpenGL 切线空间，粗糙度和反光方向图按线性数据读取。GLB 保留标准 PBR 底色、法线与 Alpha，并支持 glTF 的清漆、薄膜虹彩与各向异性扩展。

## 重建

从仓库根目录运行。纹理脚本需要 Python 的 NumPy、Pillow 和 OpenCV。建模脚本使用 Blender 5.3，生成的模型也可直接在 Blender 中编辑。游动由 [swim.js](swim.js) 按时间和路线驱动。

```sh
python3 fish/blue-guppy/bake_textures.py
blender --background --factory-startup --python fish/blue-guppy/build_model.py
npm ci
npm run build
```

## 验收

GLB 包含 24,424 个三角面、8 根骨骼和 19 张内嵌贴图，通过 glTF Validator 校验（0 错误、0 警告）。在 Blender 重新打开工程并渲染核对了打包贴图。在桌面 Chromium 检查了正反侧视、深浅背景和不同方向的主光。独立页面直接打开本地 HTML 可播放，暂停、拖动和循环接缝通过。

两条孔雀鱼可以共享网格和贴图，各自独立变形。本轮交付独立鱼种预览，尚未与龙鱼同缸验收。移动端与多鱼同时游动的渲染性能待入缸时验证。

## 概念图

[首版](concept-v1.png)和[降低颗粒感后的版本](concept.png)来自 Codex 内置 ImageGen。质感版作为烘焙输入。实拍参考为本对话中用户提供的孔雀鱼广告图。

<details>
<summary>ImageGen 提示词</summary>

**首版**

> Use case: identity-preserve. Input Image 1 is the image to edit. Recreate the exact fish as a clean photorealistic side-profile game asset, freely swimming alone on genuine transparent alpha. Remove all poster lettering, logo, rocks, plants, and aquarium water background. Preserve the existing right-facing eye-level side pose and carefully match the reference silhouette: large tall delta fan tail that reaches far to the left with a nearly vertical rounded outer edge, vivid fine azure and cyan radiating fin rays, a soft dark ink-blue to almost-black band on the trailing outer rim, darker sapphire fin membrane that transmits a little light, and a distinctly swept small blue dorsal sail near the tail. Compact slim cyan-blue fish body with fine curved rows of individually visible scales, metallic turquoise at the tail root and sky blue along flank, a much paler cool silver cheek and belly, real black pupil with pale silver and warm-white iris ring, and subtle narrow translucent bluish ventral and pectoral fins. A faithful aquarium macro photograph, sharp natural small scales and thin fin rays, soft diffuse fill, restrained glints, visible texture in the dim tail edge. Match relative original dimensions: tail region roughly 45% of the total length and its height nearly 80% of total length, body anterior to tail only about 60% of total length, slim and compact with a slightly pointed gray snout. Place whole fish centered, plenty of alpha margin behind the tail and all sides; landscape 4:3 if available. No shadow, text, other objects, floating particles, extra fins, artificial neon glow, color gradients behind the fish, decorative framing, or opaque matte.

**质感版**

> Image 1 is the EDIT TARGET: refine this exact right-facing isolated blue guppy. Image 2 is a visual reference for the amount of surface sheen and natural softness only. Keep the silhouette and proportions, the silvery iris and cheek, the turquoise body, the large dark navy rim of the tall delta tail, and the overall fish position and scale of Image 1. Selectively reduce the high-frequency grain, sparkly blue flecks, and sand-like metallic noise across the tail, dorsal fin and scales by about half. Use continuous soft blue satin iridescence, gently darker indigo between rays, and long smooth blue-cyan highlights following the real tapered fin rays. Keep anatomically defined fine fin rays and readable curved edges of the small overlapping scales. Match the macro photograph quality and natural thin translucent fin membranes of the reference; avoid smoothing into wax or flat plastic. Keep one whole fish pointing right with the same straight side view and generous clear edge space. Export on real transparent alpha. No water, rocks, plants, shadows, text, logos, glow, white edge or opaque matte.

</details>

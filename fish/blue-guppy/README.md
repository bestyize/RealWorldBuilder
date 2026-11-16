# 蓝扇尾孔雀鱼

<!-- ASSET-PACK START -->
## 独立资产包

- [在线预览](https://bestyize.github.io/RealWorldBuilder/fish/blue-guppy/asset-preview.html)：直接用 Chrome、Edge 或支持 WebGL 2 的 Safari 打开。默认折叠，画面右侧中部按钮展开管理面板。拖动旋转、滚轮或双指缩放；`#overlay` 隐藏面板按钮。
- [离线 HTML 文件](asset-preview.html)：在 GitHub 点击「Download raw file」，保存后用浏览器打开。
- [Blender 工程](blue-guppy.blend)：编辑源模型。贴图由项目文件管理。
- [游戏模型 GLB](blue-guppy.glb)：正式导入用此文件，模型与贴图在 GLB 内，不需要将预览 HTML 导进游戏。GLB +Y 向上，Blender +Z 向上；鱼头约定 +X。
- [模型预览图](images/cover.webp)：实际模型渲染，非生成概念。

GLB 有骨骼，无烘焙泳姿。单条与六鱼群复用同一份模型，鱼群保留原有花色；实时动作见游动源码。

预览 HTML 内嵌本资产和运行脚本，不需要起服务、连网、下载 CDN 或加载其他品种。仓库中重建：`node scripts/build-asset-packs.mjs blue-guppy`。
<!-- ASSET-PACK END -->


以用户提供的蓝色扇尾孔雀鱼侧视图为形态和配色参考，保留青蓝细鳞、银亮的眼圈、透蓝的放射状鳍条和深靛色尾缘。用户只提供了一个角度，因此背腹横截面和另一侧的鳞片排布按侧视轮廓推定。左右保留独立的眼球与胸鳍。

[独立游动预览](https://bestyize.github.io/RealWorldBuilder/fish/blue-guppy/preview.html)支持暂停和拖动进度。[Blender 源文件](blue-guppy.blend)和[游戏模型](blue-guppy.glb)都内嵌了贴图。鱼头朝 +X，Blender 中 +Z 向上，GLB 中 +Y 向上。中立姿态下吻端至尾柄约 1.7 模型单位，整鱼约 3.04 单位。放入水族箱时由场景确定比例和游动路线。

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

GLB 包含 24,424 个三角面、10 根骨骼（8 根体轴骨和 2 根胸鳍骨）和 19 张内嵌贴图，通过 glTF Validator 校验（0 错误、0 警告）。本轮重绑保留原网格与贴图。在桌面 Chromium 检查独立预览与鱼群的离线播放、暂停、拖动和循环接缝。

鱼体几何和贴图可共享，每条孔雀鱼的尾鳍表面独立更新。[水族箱](https://bestyize.github.io/RealWorldBuilder/aquarium.html)复用同一鱼群，在龙鱼路线下方安排游动空间。单鱼和鱼群仍可各自预览。

## 鱼群预览

[打开六条孔雀鱼](https://bestyize.github.io/RealWorldBuilder/fish/blue-guppy/school-preview.html)。鱼群中有蓝扇尾、红尾、黄黑豹纹和银白四种花色。它们共用 GLB 和贴图，转向、摆尾和推进时机各自独立。鱼群的引导路线提供大致方向，邻鱼影响转向与间距。每条鱼沿途的加速来自自己的拨水力度。约 43 秒的循环保留模拟轨迹，支持暂停和拖动查看交会与转弯。[孔雀鱼群游中距离与朝向的研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC11110457/)

## 游动与鳍膜

独立预览包含向两侧的转弯。鱼头先朝向前方，体轴沿一条连续的弧线弯曲，摆尾波从前往后延迟并放大。拨水时增加前进速度，收力后留一点余速再慢下来。小鳍的弯曲由形状键驱动。[鱼类日常转弯的运动学观测](https://doi.org/10.1002/jez.2398) [孔雀鱼的躯干和尾鳍推进研究](https://pubmed.ncbi.nlm.nih.gov/23737561/)

尾鳍的 GLB 顶点带有沿鳍条的索引。运行时用尾柄的迎水速度驱动阻尼弹簧，让鳍缘受到拖曳后回弹。滑行时鳍条向下弯曲，越靠外缘垂得越明显。重新拨水时，鳍缘随张力回升。每段鳍条的弯曲通过旋转实现。水阻与下垂采用实时近似，下垂幅度按这条鱼的画面效果调校。[尾鳍弹性实验](https://doi.org/10.1088/1748-3190/10/3/036002)

## 概念图

[首版](concept-v1.png)和[降低颗粒感后的版本](concept.png)来自 Codex 内置 ImageGen。质感版作为烘焙输入。实拍参考为本对话中用户提供的孔雀鱼广告图。

<details>
<summary>ImageGen 提示词</summary>

**首版**

> Use case: identity-preserve. Input Image 1 is the image to edit. Recreate the exact fish as a clean photorealistic side-profile game asset, freely swimming alone on genuine transparent alpha. Remove all poster lettering, logo, rocks, plants, and aquarium water background. Preserve the existing right-facing eye-level side pose and carefully match the reference silhouette: large tall delta fan tail that reaches far to the left with a nearly vertical rounded outer edge, vivid fine azure and cyan radiating fin rays, a soft dark ink-blue to almost-black band on the trailing outer rim, darker sapphire fin membrane that transmits a little light, and a distinctly swept small blue dorsal sail near the tail. Compact slim cyan-blue fish body with fine curved rows of individually visible scales, metallic turquoise at the tail root and sky blue along flank, a much paler cool silver cheek and belly, real black pupil with pale silver and warm-white iris ring, and subtle narrow translucent bluish ventral and pectoral fins. A faithful aquarium macro photograph, sharp natural small scales and thin fin rays, soft diffuse fill, restrained glints, visible texture in the dim tail edge. Match relative original dimensions: tail region roughly 45% of the total length and its height nearly 80% of total length, body anterior to tail only about 60% of total length, slim and compact with a slightly pointed gray snout. Place whole fish centered, plenty of alpha margin behind the tail and all sides; landscape 4:3 if available. No shadow, text, other objects, floating particles, extra fins, artificial neon glow, color gradients behind the fish, decorative framing, or opaque matte.

**质感版**

> Image 1 is the EDIT TARGET: refine this exact right-facing isolated blue guppy. Image 2 is a visual reference for the amount of surface sheen and natural softness only. Keep the silhouette and proportions, the silvery iris and cheek, the turquoise body, the large dark navy rim of the tall delta tail, and the overall fish position and scale of Image 1. Selectively reduce the high-frequency grain, sparkly blue flecks, and sand-like metallic noise across the tail, dorsal fin and scales by about half. Use continuous soft blue satin iridescence, gently darker indigo between rays, and long smooth blue-cyan highlights following the real tapered fin rays. Keep anatomically defined fine fin rays and readable curved edges of the small overlapping scales. Match the macro photograph quality and natural thin translucent fin membranes of the reference; avoid smoothing into wax or flat plastic. Keep one whole fish pointing right with the same straight side view and generous clear edge space. Export on real transparent alpha. No water, rocks, plants, shadows, text, logos, glow, white edge or opaque matte.

</details>

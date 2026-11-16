# Vermilion Arowana · 朱红龙鱼

<!-- ASSET-PACK START -->
## 独立资产包

- [透明在线预览](https://bestyize.github.io/RealWorldBuilder/fish/vermilion-arowana/asset-preview.html)：直接用 Chrome、Edge 或支持 WebGL 2 的 Safari 打开。默认折叠，画面右侧中部按钮展开管理面板。拖动旋转、滚轮或双指缩放；`#overlay` 隐藏面板按钮。
- [离线 HTML 文件](asset-preview.html)：在 GitHub 点击「Download raw file」，保存后用浏览器打开。
- [Blender 工程](vermilion-arowana.blend)：编辑源模型。贴图由项目文件管理。
- [游戏模型 GLB](vermilion-arowana.glb)：正式导入用此文件，模型与贴图在 GLB 内，不需要将预览 HTML 导进游戏。GLB +Y 向上，Blender +Z 向上；鱼头约定 +X。
- [模型预览图](images/cover.webp)：实际模型渲染，非生成概念。

GLB 有骨骼和烘焙动作。独立预览使用原项目游动路线。

预览 HTML 内嵌本资产和运行脚本，不需要起服务、连网、下载 CDN 或加载其他品种。仓库中重建：`node scripts/build-asset-packs.mjs vermilion-arowana`。
<!-- ASSET-PACK END -->


这条鱼按用户提供的[侧面照片](reference.jpg)设计。腹侧从带灰的中段过渡到亮青蓝，冷紫黑背鳞带细粉紫鳞缘，鳃盖呈橙金色。尾鳍、背鳍和臀鳍分别按原照的红橙色校准。鳞片保持细薄的叠合边和柔和的缎面反光。

[侧视建模参考](concept.png)是带 Alpha 的 1983 × 793 PNG。[俯视与正面补图](form-study.png)用来估算横截面和成对鳍的角度。照片只展示一侧，另一侧和真实厚度按相对比例推定。Blender 模型以 +X 为头部方向、+Z 向上，GLB 以 +Y 向上。

- [独立游动预览](https://bestyize.github.io/RealWorldBuilder/fish/vermilion-arowana/preview.html)内嵌模型和渲染代码，可以离线打开。约 29 秒游完一圈，支持暂停、拖动进度、旋转和缩放。在[水族箱](https://bestyize.github.io/RealWorldBuilder/aquarium.html)里使用 90% 的模型比例，32 秒一圈。直游时躯干接近水平，掉头时鱼头先入弯，躯干和尾鳍依次跟进。
- [Blender 工程](vermilion-arowana.blend)和[带贴图的 GLB](vermilion-arowana.glb)包含 12 个网格、11 根骨骼和一个原地摆尾循环。鱼身的底色、法线和粗糙度与鳍膜的纹理分开烘焙，方便继续调整鳞面质感。
- [原照与新版实时对照](side-comparison.webp)和[当前预览截图](preview-still.png)可用来核对配色和亮度。鱼身按原照的背线、腹线和鳃盖位置烘焙。中间调和柔和的鳞面反光让暗处的鳞纹更清楚。鳍膜在鳍条之间略微透光，尾鳍保留原照的红橙色。独立预览和 Blender 均用宽范围补光照亮鱼体侧面。
- [背鳍与鳞片近景对照](detail-comparison.webp)使用相同的视角、灯光和动作时刻。背鳍根部的颜色与透明度沿鱼背渐变。鱼身底色和法线使用 4096 × 2048 贴图，从原照提取细薄的鳞缘，鳞面保持平滑的色调。

在空白 Blender 场景重新导入 GLB 后核对了网格、骨骼、贴图及动作。glTF Validator 报告为 0 错误、0 警告。在断网的 Edge 中打开独立预览，验证播放、暂停、拖动进度、旋转、缩放和循环首尾帧，并复查了高分屏的近景。沿一圈游动采样 161 个姿势，背鳍的 59 个根部顶点均位于鱼体内。

从仓库根目录重建：

```sh
blender --background --factory-startup --python-exit-code 1 --python fish/vermilion-arowana/build_model.py
npm run build
```

<details>
<summary>内置 ImageGen 提示词</summary>

**侧视构图**

Use case: identity-preserve image edit and production concept reference for a new realistic game fish, the Vermilion Arowana. Image 1 is the identity and anatomy reference. Recreate the SAME fish cleanly isolated, in a strict right-facing, horizontal, orthographic-style side profile. Correct the slight tank-camera tilt while preserving the balance of the very long but notably deep compressed body, wedge snout with slanted upturned mouth, the two very short chin barbels, eye size and position, rearward fan-like dorsal and anal fins with the higher dorsal forward of the rounded fan tail, narrow tail stalk, and long slender translucent pectoral tips bent back below the gill. Keep the exact overall fin arrangement and believable root attachments. The rounded tail, dorsal and anal fins are vivid vermilion grading into warmer burnt orange near the roots, with very fine radial fin rays showing through the translucent membranes. Body plates are large, overlapping and ordered as in the source; deep plum-charcoal along the back, warm copper or bronze at the rims, soft petrol turquoise and teal through the lower flank and silvery belly, warm orange on the gill plate. Preserve the black wet eye with a thin reflective blue-green iris and red-tinged lips. Color should read as lightly iridescent fish scales and subtle moist flesh under soft balanced light, not luminous paint or uniformly chromed armor. Preserve natural uneven scale tones, fine fish skin, and soft edges. Make this read as a crisp aquarium macro photograph of the real anatomical subject, neutral, clean and well resolved for modeling. Whole fish visible including both barbels and fin tips, occupying most of the landscape canvas with generous transparent margin on all sides. True transparent alpha around the fish, with naturally soft semitransparent fin edges. Remove the tank, rocks, reflections, cast shadow, water surface, bubbles, background, text, labels, and checkerboard. Only one fish.

**鳞面细化**

Use case: subtle identity-preserving material refinement for a 3D fish reference. Edit this exact isolated right-facing fish. Lock the camera, placement, canvas shape, silhouette, anatomy, scale count and placement, colors, fins, fine barbels, and iris. The changes are local to the BODY SCALE SURFACES. Smooth the distracting fine blotches, sparkly points, and coarse grain inside the large scale plates, restoring clean continuous color transitions with a soft wet satin reflection. Retain fine hairline overlapping scale edges, delicate faint directional scale striations, dark plum scale centers, subtle bronze rims, lower teal and silvery blue, and realistic very subtle texture. Scale outlines must remain sharp and fine, with no crunchy edge halo, artificial haze or plastic smoothing. Preserve the amber gill and every facial detail. Keep the red-orange fan fins and pale pink paired fins as they are, with clear fine rays. Full fish on true transparent alpha, smallest practical soft edge and generous clear margins. Fish remains horizontal, strict right-facing near-orthographic side view. No cast shadow, scene, checkerboard, text or graphics.

**俯视与正面参考**

Use case: anatomy reference sheet for modeling the exact arowana from the supplied right-facing side view. Keep the same fish, dark copper back, teal belly and relaxed red-orange fins. Generate two separated camera-calibration views on a clean matte dark neutral gray canvas: a strict orthographic top-down view with the length horizontal and nose toward the right in the upper half, and a strict orthographic front view facing the camera, centered underneath. Match the source's head, realistic slim laterally compressed cross section, rounded narrow tail stalk and paired fin attachments. Keep the body at a neutral straight pose in both views, fins naturally angled away from body. Top view must specifically make clear the head and shoulder width versus the taper at both ends. Front view must make clear the depth compared with width, paired eyes and two chin barbels. Neutral even studio light, fish completely visible with margin, distinct separation between the two views. This is a production reference sheet with exact directions, no perspective, lettering, diagram marks, background scenery, or border.

</details>

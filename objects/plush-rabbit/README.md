# 碎花垂耳兔

<!-- ASSET-PACK START -->
## 独立资产包

- [在线预览](https://bestyize.github.io/RealWorldBuilder/objects/plush-rabbit/asset-preview.html)：直接用 Chrome、Edge 或支持 WebGL 2 的 Safari 打开。默认折叠，画面右侧中部按钮展开管理面板。拖动旋转、滚轮或双指缩放；`#overlay` 隐藏面板按钮。
- [离线 HTML 文件](asset-preview.html)：在 GitHub 点击「Download raw file」，保存后用浏览器打开。
- [Blender 工程](plush-rabbit.blend)：编辑源模型。贴图由项目文件管理。
- [游戏模型 GLB](plush-rabbit.glb)：正式导入用此文件，模型与贴图在 GLB 内，不需要将预览 HTML 导进游戏。GLB +Y 向上，Blender +Z 向上；鱼头约定 +X。
- [模型预览图](images/cover.webp)：实际模型渲染，非生成概念。

静态。GLB 使用 EXT_meshopt_compression；预览内置解码并保留实时短绒，没有布台、接触阴影或摄影布景。

预览 HTML 内嵌本资产和运行脚本，不需要起服务、连网、下载 CDN 或加载其他品种。仓库中重建：`node scripts/build-asset-packs.mjs plush-rabbit`。
<!-- ASSET-PACK END -->


以会话中用内置 ImageGen 生成并选定的[参考图](reference.jpg)为准，制作一只坐姿垂耳布偶。正面保留圆脸、小椭圆眼、棕色刺绣鼻口、浅米色短绒、碎花棉布耳衬和右耳上的蝴蝶结。参考只展示正面，侧面的耳朵厚度、坐姿体积及背面的小尾巴根据布偶结构补足。Blender 里的坐姿高度为 0.30 m，+Z 向上、-Y 为正面，GLB 为 +Y 向上、+Z 为正面。

- [独立预览](https://bestyize.github.io/RealWorldBuilder/objects/plush-rabbit/preview.html)直接打开实时 3D，可以拖动旋转和缩放，也可以点击「材质近看」后继续转动观察毛向。GLB、贴图和渲染代码均嵌入同一文件。
- `plush-rabbit.blend` 包含模型、布面接缝、可编辑的分区短绒曲线、打包贴图、相机和窗光。由 `render_photos.py` 生成的三张照片渲染位于 `photos/`。
- `plush-rabbit.glb` 包含坐姿模型、UV、纹理、材质和每块布面的毛向，使用 `EXT_meshopt_compression`，预览页内置解码器。
- `textures/` 保存 [ImageGen 短绒与碎花棉布源图及提示词](textures/material-sources.md)。新版预览可和原图做[等高全身对照](../../output/plush-rabbit/fine-pile-comparison.png)及[同倍率脸颊近景对照](../../output/plush-rabbit/fine-pile-detail.png)。

在仓库根目录运行 `npm run build` 更新 HTML。用 Blender 5.3 执行 `blender -b --factory-startup --python-exit-code 1 --python objects/plush-rabbit/create_model.py` 可重新生成模型和贴图。照片渲染命令为 `blender -b objects/plush-rabbit/plush-rabbit.blend --python-exit-code 1 --python objects/plush-rabbit/render_photos.py -- --output objects/plush-rabbit/photos`。

照片渲染和实时 3D 共用一份布面毛向：额头往两侧梳开，耳背沿布面往下，脚掌顺到脚尖。照片渲染使用独立纤维。实时 3D 的 `nap-detail.js` 生成绒束起伏、毛根暗部和控制局部光泽的纹理，`nap-fibers.js` 从 GLB 布面生成随距离渐显的细纤维。转动时，窗光主要在梳顺的毛尖上移动，贴伏的毛根和凌乱的小片绒仍偏哑光。实时场景的亚麻台面有织纹与褶皱，脚掌下有接触阴影，耳朵、头和躯干之间也会互相遮光。

参考图由内置 ImageGen 生成。选定图保存为 `reference.jpg`，并嵌入 `.blend`。

<details>
<summary>参考图提示词的外观描述</summary>

Pale oatmeal cream with a tiny hint of pink-beige, low-pile silky plush, a rounded, subtly oval stuffed head, two tiny dark oval eyes set wide apart, warm terracotta-brown small triangular embroidered nose, short brown thread down to a tiny shallow curved closed mouth. Two long narrow floppy ears originate at the top sides of the head and drape past the wrists toward the hips. The fabric on the inner side of each ear is cream cotton printed with small dusty rose and coral wildflower sprigs and softly muted sage leaves. A small subtle matching floral cotton bow by the base of one ear. A round lightly stuffed belly, naturally drooping plush arms, two gently extended long stuffed legs with big rounded paws. No clothes. Pose just one plush toy seated, mostly front-facing with feet slightly forward, head relaxed, both ears and the floral linings plainly visible. Full body centered in a near-square frame. Place it on off-white linen against a softly blurred warm ivory studio backdrop, with gentle diffuse side daylight and natural contact shadows. Soft tactile microtexture and fine seams, subtly endearing and understated. No props, no logos, no lettering, no watermark.

</details>

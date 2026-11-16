# RealWorldBuilder

## 目录导航

[主水族箱](aquarium.html) · [原展厅](index.html) · [图文资产总览](asset-packs.html) · [资产包格式与重建](docs/asset-packs.md) · [背景素材](#背景素材)

| 分类 | 资产包 | 透明离线预览 |
|---|---|---|
| 鱼类 | [蓝色龙鱼](fish/arowana/README.md) | [HTML](fish/arowana/asset-preview.html) |
| 鱼类 | [朱红龙鱼](fish/vermilion-arowana/README.md) | [HTML](fish/vermilion-arowana/asset-preview.html) |
| 鱼类 | [蓝扇尾孔雀鱼](fish/blue-guppy/README.md) | [HTML](fish/blue-guppy/asset-preview.html) |
| 鱼类 | [红白锦鲤 · V6](fish/kohaku-koi/README.md) | [HTML](fish/kohaku-koi/asset-preview.html) |
| 鱼类 | [银身神仙鱼 · V2](fish/silver-angelfish/README.md) | [HTML](fish/silver-angelfish/asset-preview.html) |
| 鱼类 | [宝莲灯 · V2](fish/cardinal-tetra/README.md) | [HTML](fish/cardinal-tetra/asset-preview.html) |
| 鱼类 | [斯氏鼠鱼 · V2](fish/sterbai-cory/README.md) | [HTML](fish/sterbai-cory/asset-preview.html) |
| 静物 | [碎花垂耳兔](objects/plush-rabbit/README.md) | [HTML](objects/plush-rabbit/asset-preview.html) |
| 造景 | [暖米色浅砂床 · V2](scenes/riverbank/sand-bed/README.md) | [HTML](scenes/riverbank/sand-bed/preview.html) |
| 造景 | [河卵石 · 五种变体](scenes/riverbank/river-pebbles/README.md) | [HTML](scenes/riverbank/river-pebbles/preview.html) |
| 造景 | [茶褐分叉沉木](scenes/riverbank/driftwood/README.md) | [HTML](scenes/riverbank/driftwood/preview.html) |
| 造景 | [卷窄叶水草](scenes/riverbank/java-fern/README.md) | [HTML](scenes/riverbank/java-fern/preview.html) |
| 造景 | [细长带叶水草](scenes/riverbank/tape-grass/README.md) | [HTML](scenes/riverbank/tape-grass/preview.html) |
| 造景 | [宽叶水草 · V4](scenes/riverbank/broadleaf-anubias/README.md) | [HTML](scenes/riverbank/broadleaf-anubias/preview.html) |

资产包链接进入该模型的说明；HTML 下载后可直接离线打开。

![龙鱼在山水客厅水族箱中游动](./docs/aquarium.gif)

### 45 秒 macOS 桌面水族箱演示

https://github.com/user-attachments/assets/458e246b-0db0-42d4-ad5e-4866ff1ede2e

实时 3D 展厅。可以观赏一条龙鱼和六条不同花色的孔雀鱼共游，也可以单独看鱼或打开碎花垂耳兔的 3D 预览。

[打开 GitHub Pages](https://bestyize.github.io/RealWorldBuilder/)

打开 [index.html](index.html) 浏览展厅，或直接打开 [aquarium.html](aquarium.html) 离线观赏。首次打开水族箱或从展厅进入时，默认在「山水客厅」中单独展示朱红龙鱼，并开启砂石水草。直接打开水族箱会恢复这个浏览器已保存的选择。点击右上角「设置」可切换单条龙鱼、单条孔雀鱼、孔雀鱼群或同缸，也可以独立开关砂石水草造景。在「同缸」或「单条龙鱼」模式下，可以通过「龙鱼品种」切换蓝色龙鱼和朱红龙鱼。

「鱼类观察」的三个预览打开即铺满视窗。用鼠标或手指拖动画面可旋转视角，点击「重置视角」可回到正面。手机竖持时，画面和控件会一起旋转到横向。点击「全屏」可在浏览器支持时收起地址栏并锁定横屏。水族箱在触屏设备上也可点击「全屏」切到横向布局。

「背景」页可以切换六套预设，或选择本机的 JPG、PNG、WebP 图片。「灯光」页可以调节水族箱的灯光和反射。按 D、B 或 L 可以直接打开对应页面。

在「背景」里选「透明」，可以在透明底上显示当前选中的鱼和造景。点击「打开龙鱼透明播放页」可进入 `aquarium.html#overlay`，单独叠加龙鱼，保留鳍和轮廓的透明度。

把播放页用作 OBS 浏览器源时，可在仓库目录运行 `python3 -m http.server 8000 --bind 127.0.0.1`，再填入 `http://127.0.0.1:8000/aquarium.html#overlay`。嵌入网页时，把 iframe 放到画面图层上方。

```html
<iframe
  title="龙鱼"
  src="./aquarium.html#overlay"
  style="position: absolute; inset: 0; width: 100%; height: 100%; border: 0; color-scheme: light; pointer-events: none;"
></iframe>
```

预设以山水客厅为初始背景。自定义图按原比例居中裁切成 16∶9，画面最长边保留至 2560 像素。浏览器允许本地存储时，同一地址重新打开会恢复所选背景和最近一张自定义图。

每个鱼种在各自目录维护 Blender 工程、GLB 和游动代码。可以分别打开[蓝色龙鱼](fish/arowana/preview.html)、[朱红龙鱼](fish/vermilion-arowana/preview.html)、[单条蓝扇尾孔雀鱼](fish/blue-guppy/preview.html)和[六条孔雀鱼群](fish/blue-guppy/school-preview.html)的独立预览。[碎花垂耳兔](objects/plush-rabbit/preview.html)可以拖动旋转和缩放。

展厅使用 `index.html`、`src/gallery.css` 和 `assets/gallery/` 中的素材。修改预览源码或模型后，用 Node.js 20.9 或更新版本运行 `npm ci` 和 `npm run build`。构建会将模型贴图和预设背景转换为 WebP，并内嵌到可离线打开的 HTML 中。PNG 贴图使用无损编码并保留透明度，JPEG 背景和底色贴图使用高质量编码。Blender 工程及原始素材仍是编辑和导出的来源。

## 背景素材

原山水客厅使用 `assets/aquarium.jpg`。另外三张用内置 ImageGen 生成，生成提示词如下。

<details>
<summary>雨林黑水 · assets/blackwater.jpg</summary>

Photorealistic 16:9 background plate for an aquarium. An Asian blackwater river viewed from under the surface, as a wildlife documentary still. Dark amber water, an old submerged piece of dark driftwood and a few roots on the far left, sparse fallen brown leaves on the sandy bed at the bottom, soft tea-colored shafts of sun from the upper left. Keep central and right midwater spacious and relatively dark, with subtle suspended texture and warm depth. Natural amber and umber, little saturation, true underwater optics. Landscape 16:9 fixed eye-level documentary camera, natural realistic textures, clean screen-filling composition with calm uncluttered midtones across the middle and extra detail along the outer edges. This will be the background plate behind a moving bright silver-blue Asian arowana with coral fins. Leave room for the fish. Absolutely no fish, animal, person, lettering, visible aquarium frame, text, watermark or UI.

</details>

<details>
<summary>清绿水草 · assets/aquascape.jpg</summary>

Photorealistic 16:9 background plate of a planted freshwater aquarium in the style of a refined Japanese nature aquarium. The aquascape has tall emerald aquatic leaves and fine grasses framing the left and right, a few slate stones and moss low at the edges, and a pale gravel path receding into a spacious midwater opening. Soft daylight from above, clear warm green water with subtle natural light falloff, fine leaf detail, measured contrast, quiet editorial photography. Keep the middle of the frame softly receding so a long blue and red fish can swim past. Landscape 16:9 fixed eye-level documentary camera, natural realistic textures, clean screen-filling composition with calm uncluttered midtones across the middle and extra detail along the outer edges. This will be the background plate behind a moving bright silver-blue Asian arowana with coral fins. Leave room for the fish. Absolutely no fish, animal, person, lettering, visible aquarium frame, text, watermark or UI.

</details>

<details>
<summary>月下湖景 · assets/moon-window.jpg</summary>

Photorealistic 16:9 atmospheric architecture photograph for a transparent aquarium backdrop. At blue hour, view from a quiet contemporary Japanese room toward a broad dark wood framed picture window. Across the window beyond are a still lake, low mist, a layered blue-gray mountain ridge, and a small soft pale moon high on the right. A single subtle amber lantern low at the left edge provides a warm point, with spare wood sill and calm clean horizontal lines. Keep the central area dark blue, calm and open, avoiding any very bright feature behind the moving fish. Luxurious natural film photography, never stylized. Landscape 16:9 fixed eye-level documentary camera, natural realistic textures, clean screen-filling composition with calm uncluttered midtones across the middle and extra detail along the outer edges. This will be the background plate behind a moving bright silver-blue Asian arowana with coral fins. Leave room for the fish. Absolutely no fish, animal, person, lettering, visible aquarium frame, text, watermark or UI.

</details>

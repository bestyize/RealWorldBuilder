# RealWorldBuilder

实时 3D 水族箱。一条龙鱼和六条不同花色的孔雀鱼同缸游动，支持切换背景、自定义图片、调节灯光和透明叠加。

[打开在线水族箱](https://bestyize.github.io/RealWorldBuilder/)

打开 [aquarium.html](aquarium.html) 即可离线运行。点击右上角「设置」进入控制面板。「背景」页可以切换六套预设，或选择本机的 JPG、PNG、WebP 图片。「灯光」页可以调节水族箱的灯光和反射。按 B 或 L 可以直接打开对应页面。

在「背景」里选「透明」可以观看透明背景下的同缸画面。点击「打开龙鱼透明播放页」可进入 `aquarium.html#overlay`，单独叠加龙鱼，保留鳍和轮廓的透明度。

把播放页用作 OBS 浏览器源时，可在仓库目录运行 `python3 -m http.server 8000 --bind 127.0.0.1`，再填入 `http://127.0.0.1:8000/aquarium.html#overlay`。嵌入网页时，把 iframe 放到画面图层上方。

```html
<iframe
  title="龙鱼"
  src="./aquarium.html#overlay"
  style="position: absolute; inset: 0; width: 100%; height: 100%; border: 0; color-scheme: light; pointer-events: none;"
></iframe>
```

预设以山水客厅为初始背景。自定义图按原比例居中裁切成 16∶9，画面最长边保留至 2560 像素。浏览器允许本地存储时，同一地址重新打开会恢复所选背景和最近一张自定义图。

每个鱼种在各自目录维护 Blender 工程、GLB 和游动代码。可以分别打开[龙鱼](fish/arowana/preview.html)、[单条蓝扇尾孔雀鱼](fish/blue-guppy/preview.html)和[六条孔雀鱼群](fish/blue-guppy/school-preview.html)的独立预览。

修改源码或素材后，在仓库根目录运行 `npm ci` 和 `npm run build`，重新生成水族箱和三个可离线打开的独立预览。

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

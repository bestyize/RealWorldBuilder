# 独立 3D 资产包

[打开独立资产目录](https://bestyize.github.io/RealWorldBuilder/asset-packs.html)。这里另开入口，不改现有展厅和主鱼缸。

每个包只维护自己的 Blender、游戏 GLB、实际模型渲染封面、说明与可离线打开的纯模型 HTML。现有鱼与兔子的原文件名、原展厅入口不改名；独立预览使用新增的 `asset-preview.html`。新造景部件使用 `model.blend`、`model.glb` 和 `preview.html`。

资产名、目录和正式交付文件不加版本号；迭代记录保留在 Git 历史和历史素材说明中。

| 类别 | 独立目录 |
|---|---|
| 鱼 | `fish/arowana`、`fish/vermilion-arowana`、`fish/blue-guppy`、`fish/kohaku-koi`、`fish/silver-angelfish`、`fish/cardinal-tetra`、`fish/sterbai-cory` |
| 静物 | `objects/plush-rabbit` |
| 造景 | `scenes/riverbank/{sand-bed,river-pebbles,driftwood,java-fern,tape-grass,broadleaf-anubias}` |

## 预览与游戏导入

- 模型始终渲染在透明画布上，不加辅助地板或接触阴影。砂床自身的厚度是资产，不是辅助地板。
- 右侧中部只有一个管理按钮，默认折叠；ESC 收回。拖动、滚轮、双指操作或键盘可检查模型。URL 加 `#overlay` 后强制透明，只绘制模型且隐藏面板。
- 「背景」默认透明，可切纯黑、纯白、清绿水草缸、雨林黑水、月下湖景，或选本地 JPG、PNG、WebP、AVIF 图片（不超过 24 MB）。背景只用于预览，不改变模型或灯光。浏览器可记住预设；本地图片不上传，关闭页面后需重新选择。
- 鱼可播放、暂停和拖进度；蓝扇尾孔雀鱼和宝莲灯额外支持单鱼／鱼群。它们各只解码一次本品种 GLB。卵石的一个预览可切换五种石形，导入游戏时可以选对应的 `variant-01.glb` 至 `variant-05.glb`。
- 游戏使用原始 GLB；浏览器版进行无损 WebP 优化，不把扩展或厂商渲染条件强加给原始 GLB。兔子原始 GLB 本身使用网格压缩扩展，见包内说明。所有新鱼的编辑骨骼和浏览器动作不等于 GLB 已带动画，逐包看 README。
- 旧版比较图、参考图和实验资产不进入预览。封面是当前模型渲染，保留 alpha；概念图只作参考。

## 重建

从仓库根目录安装已有 npm 依赖后：

```sh
node scripts/build-asset-packs.mjs --list
node scripts/build-asset-packs.mjs cardinal-tetra
node scripts/build-asset-packs.mjs --index
```

独立构建脚本不写入主鱼缸或经典展厅文件。模型构建与预览代码、原始游戏资产和 HTML 分开；每页只内嵌一份自己的 GLB。分发单包不需要同时带走全套资源。未来如果接入在线展厅，优先按点击加载独立预览，不重新造一个大内嵌页。

# 疏花草甸

[打开实时 3D 草甸](https://bestyize.github.io/RealWorldBuilder/meadow.html) · [浏览陆地独立资产](https://bestyize.github.io/RealWorldBuilder/asset-packs.html?category=land)

这组首批陆地资产以晚春到初夏的开阔草甸为视觉方向。草地是主体，小花主要集中在小径一侧的近处；虞美人是零星红点，宽冠栎树负责中景构图，柑橘凤蝶是可暂停的运动细节。不把概念图或场景截图作为环境模型或运行时背景。

- [实际实时总览](cover.webp) · [目前的实时近景](detail.webp) · [原始场景方向及单体参考](references/README.md)
- 3 种草：狗牙根、细叶羊茅、狗尾草。
- 5 种小花：白车轴草（含四叶变体）、雏菊、阿拉伯婆婆纳、夏枯草、虞美人。
- 宽冠栎树、柑橘凤蝶。

## 使用和交付

各资产是独立的 Blender、米制 GLB 和离线单页 HTML，不含场景背景、辅助地面或灯光。单页的背景选项和 `#overlay` 行为与其它资产一致。白车轴草默认三出叶，预览可切换四叶；导入游戏时 `CloverLeafThree` 与 `CloverLeafFour` 是互斥节点。独立凤蝶播放器为方便看翼根采用慢放；GLB 内是原速翅动循环。整片草甸只用它做低飞示例，不是完整觅食或停栖模拟。

源文件是按照批准概念和植物/昆虫形态重建，不是扫描；各包的对照图标注了推定结构。栎树以中景为目标，在极近距离看树皮仍可能见到贴图拼接痕迹。草木第一批是静态游戏资产。

## 构建

```sh
npm run build:assets
blender -b -t 2 --python scripts/build-meadow-lods.py
npm run build:meadow
```

场景在线加载栎树、凤蝶完整模型与其余 8 个资产的轻量场景网格。近看的独立预览与游戏 GLB 保留各自更完整的几何和材质；轻量场景网格使用更简单的漫反射材质与批量实例化。草地高度、疏密和相机组合是可重复生成的布置，而非打包成一整张地景。整个场景需网页方式加载，本地可用 `python3 -m http.server --bind 127.0.0.1 8000`；十个单体预览可直接打开文件，不需要服务器。

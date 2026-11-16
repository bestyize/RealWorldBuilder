# 宽冠栎树 · broad-oak

<!-- ASSET-PACK START -->
## 独立资产包

- [在线预览](https://bestyize.github.io/RealWorldBuilder/scenes/meadow/broad-oak/preview.html)：直接用 Chrome、Edge 或支持 WebGL 2 的 Safari 打开。默认折叠，画面右侧中部按钮展开管理面板。拖动旋转、滚轮或双指缩放；`#overlay` 隐藏面板按钮。
- [离线 HTML 文件](preview.html)：在 GitHub 点击「Download raw file」，保存后用浏览器打开。
- [Blender 工程](model.blend)：编辑源模型。贴图由项目文件管理。
- [游戏模型 GLB](model.glb)：正式导入用此文件，模型与贴图在 GLB 内，不需要将预览 HTML 导进游戏。GLB +Y 向上，Blender +Z 向上；鱼头约定 +X。
- [模型预览图](images/cover.webp)：实际模型渲染，非生成概念。

低处分叉、展开的主枝和疏密相间的树冠，是草甸中远处的构图锚点。

预览 HTML 内嵌本资产和运行脚本，不需要起服务、连网、下载 CDN 或加载其他品种。仓库中重建：`node scripts/build-asset-packs.mjs broad-oak`。
<!-- ASSET-PACK END -->


静态、可编辑的 *Quercus robur* 风格游戏资产。根据已批准的生成参考图制作，不是实拍扫描，也不代表某一棵真实树的精确复原。树冠背面与细枝分布为推断。

## 内容
- `model.blend`：压缩 Blender 工程，6 个可编辑网格，所有使用中的贴图已内嵌；无地面、花盆、灯光或相机混入资产。
- `model.glb`：标准 glTF 2.0，贴图内嵌，适用于 Three.js / 常见游戏引擎。
- `images/cover.webp`：实际模型透明背景渲染，不是概念图。
- `images/comparison.webp`：批准的树木概念裁剪与实际模型近正面角度对照。
- `source/concept-tree-crop.webp` 与 `source/approved-reference.png`：原始批准图和仅树木部分裁剪，均为生成图。
- `source/build_oak.py`：可重复生成模型、PBR 贴图及多角度渲染。
- `source/verify_oak.py`、`source/verification.json`：实际文件重新打开、GLB 导入再导出与材质检查。

```sh
blender -b -t 6 --python source/build_oak.py
blender -b -t 3 --python source/verify_oak.py
```

## 尺度和构造
Blender 为米制 Z 向上，GLB 为 Y 向上，地面接触最低点为零。高度约 12.8m，正面宽约 15.6m。原图没有测量尺度，属于合理的美术估计，准确范围见 `asset-info.json`。

主干、根张和粗枝经过体积融合，消除相互叠放圆木式接头；次级枝与细枝独立成批，保留真实三维深度。主枝不等长、不等角，树冠由多个不规则枝叶团构成，团间留有可透过天空的空隙，没有用球体模拟树冠。

约 21,120 片叶子使用固定在三维空间中的折弯叶面和圆裂叶缘 Alpha 裁切。它们不是始终朝向相机的总树冠广告牌。为实时观看的可读性，单叶尺寸有适度放大，基部耳状结构与叶柄连接有所简化。叶片合批为 4 种色调，树皮为另外 2 个网格，总计 6 个网格、5 种材质，约 135k 三角面。静态版本没有骨骼或风动画。

## 材质
- 树皮颜色细节来自已批准生成图的树干局部，不使用外部照片像素；粗糙度、法线为可导出的 PNG 数据贴图。
- 叶片使用原创色素/叶脉图，色彩未绘制环境投影阴影。
- GLB 叶片为双面 `MASK`、阈值 0.5，写入深度，不使用整冠透明混合。导出脚本显式把 Blender 的透明叶片导出结果规范化为标准 MASK。
- 法线与粗糙度贴图按非颜色数据处理；粗糙度在 G 通道，金属度 B 为 0。

## 参考与差异
[Kew：Oak tree / Quercus robur](https://www.kew.org/plants/oak-tree) 用于物种形态核对，公开索引可读取；直接页面读取曾返回 403。
[Royal Botanic Gardens Sydney PlantNET](https://plantnet.rbgsyd.nsw.gov.au/cgi-bin/NSWfl.pl?lvl=sp&name=Quercus~robur&page=nswfl) 描述宽展树冠、灰色沟裂树皮；[Oregon State University](https://landscapeplants.oregonstate.edu/plants/quercus-robur) 提供宽冠与粗短主干的形态依据。没有复制这些网站的图像到材质。

这是受批准图启发的实时近似：没有逐叶重现概念图，没有建模所有细叶柄或树皮深裂缝。树皮来源仍保留少量生成图光照；特别近的检查可能看到投影接缝和重复。适合单株或少量中景树，密集森林应另做 LOD/实例与性能调优。真实网页效果、光照和移动端性能仍由场景集成验收，不以 Blender 渲染代替网页验证。

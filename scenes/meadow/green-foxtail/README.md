# 狗尾草 / Setaria viridis

<!-- ASSET-PACK START -->
## 独立资产包

- [在线预览](https://bestyize.github.io/RealWorldBuilder/scenes/meadow/green-foxtail/preview.html)：直接用 Chrome、Edge 或支持 WebGL 2 的 Safari 打开。默认折叠，画面右侧中部按钮展开管理面板。拖动旋转、滚轮或双指缩放；`#overlay` 隐藏面板按钮。
- [离线 HTML 文件](preview.html)：在 GitHub 点击「Download raw file」，保存后用浏览器打开。
- [Blender 工程](model.blend)：编辑源模型。贴图由项目文件管理。
- [游戏模型 GLB](model.glb)：正式导入用此文件，模型与贴图在 GLB 内，不需要将预览 HTML 导进游戏。GLB +Y 向上，Blender +Z 向上；鱼头约定 +X。
- [模型预览图](images/cover.webp)：实际模型渲染，非生成概念。

细秆托起有芒刺的圆柱形穗，适合零星放在草丛边缘。

预览 HTML 内嵌本资产和运行脚本，不需要起服务、连网、下载 CDN 或加载其他品种。仓库中重建：`node scripts/build-asset-packs.mjs green-foxtail`。
<!-- ASSET-PACK END -->


独立自然草甸资产。五根错落的具节茎，叶鞘和叶片从同一节位连接；真实三维穗粒和细芒，不使用圆柱贴图假穗。

## 文件
- `model.blend`：可编辑源文件，按叶片、茎、叶鞘/节、花序等逻辑组保存，含摄影机和灯光。无底板。
- `model.glb`：纯模型、PBR、内嵌法线贴图；无背景、灯光或相机。
- `images/cover.webp`：透明底实际渲染；`rear.webp`：后侧实际渲染。
- `images/export-check.webp`：将 GLB 重新导入 Blender 后渲染。
- `images/comparison.webp`：批准概念裁剪与模型对照。
- `images/reference-original.png`、`reference-crop.png`：原始批准图及不重绘的目标区域。
- `build.py`：固定随机种子的完整建模/导出/渲染脚本。`verify-export.py`：独立导出回读渲染。`qa.json`：数值检查。

## 造型与材质
叶片不是透明平面广告牌，而是分段弯曲、有中央折槽、渐尖和轻微扭转的薄片网格。近看保留分层遮挡；表面使用 7 种低饱和叶绿/枯叶/茎色变体，粗糙度 0.73–0.83、非金属、低镜面反射。128×128 内嵌法线纹理表述纵向微细脉纹。无烘焙高光，无透明排序依赖，采用双面材质。

## 比例与坐标
尺寸约 0.309 × 0.396 × 0.650 m（Blender X/Y/Z），原点在地面中心区域，最低顶点 Z=0。Blender 米制/Z-up；GLB 标准 Y-up。三角面 19,780，逻辑网格 11 个。适合近中景单丛；大面积草甸应实例化，并进一步生成 LOD/远景替代，不应复制成大量独立高模。

## 参考与推断
参考是用户批准的 AI 概念图，而非摄影测量。保留物种的主要轮廓、细叶比例、茎叶连接和疏密节奏；背面、精确节点分布和绝对尺度是建模推断，未宣称植物学标本级精确复原。对照使用相近三分之四观察方向，但并非精确相机标定。

## 验证
已重新打开保存的 .blend，并将实际 GLB 导入空场景，对比网格数、三角面数和尺寸（见 qa.json）；导出文件没有场景背景或地板。检查透明正面与后侧轮廓、完整入画和材质表现。GLB 回读渲染为额外可视验收。最终 HTML 与 Pages 由主集成任务生成，本文不代表已上线。

## 重建
在本目录执行：
```sh
blender -b -t 4 --python build.py
blender -b -t 4 --python verify-export.py
```
渲染使用 Cycles；为兼容当前 Blender 构建不启用 OpenImageDenoise。原始图像本身没有修改。

## 中远景可选简化网格
`model-lod.glb` 由 `build-lod.py` 自动简化生成，共 5423 三角面；保留材质与 UV，适用于中远景，不替代近景模型，也未添加自动距离切换。当前静态网格未绑定风动画。

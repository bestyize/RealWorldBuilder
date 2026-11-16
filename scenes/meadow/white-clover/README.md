# 白车轴草 · White clover

<!-- ASSET-PACK START -->
## 独立资产包

- [在线预览](https://bestyize.github.io/RealWorldBuilder/scenes/meadow/white-clover/preview.html)：直接用 Chrome、Edge 或支持 WebGL 2 的 Safari 打开。默认折叠，画面右侧中部按钮展开管理面板。拖动旋转、滚轮或双指缩放；`#overlay` 隐藏面板按钮。
- [离线 HTML 文件](preview.html)：在 GitHub 点击「Download raw file」，保存后用浏览器打开。
- [Blender 工程](model.blend)：编辑源模型。贴图由项目文件管理。
- [游戏模型 GLB](model.glb)：正式导入用此文件，模型与贴图在 GLB 内，不需要将预览 HTML 导进游戏。GLB +Y 向上，Blender +Z 向上；鱼头约定 +X。
- [模型预览图](images/cover.webp)：实际模型渲染，非生成概念。

低矮白色花团。管理面板可对比普通三出叶和四叶变体；场景里四叶不是默认状态。

预览 HTML 内嵌本资产和运行脚本，不需要起服务、连网、下载 CDN 或加载其他品种。仓库中重建：`node scripts/build-asset-packs.mjs white-clover`。
<!-- ASSET-PACK END -->


学名 **Trifolium repens**。按已批准的自然草甸概念制作的独立植物资产；不是照片扫描，也不将生成概念称为实拍。

## 文件
- `model.blend`：可编辑分件网格、打包贴图、参考相机、柔光灯；米制、Z 向上。
- `model.glb`：标准 glTF 2.0 / Y 向上，原点位于地面，不含灯光、相机、底板。
- `images/cover.webp`：模型实际渲染，真正 RGBA 透明背景。
- `images/reference-concept.png` 与 `images/comparison.webp`：原批准概念局部及同方向比较。
- `images/side.webp`、`rear.webp`、`top.webp`：实际模型的侧后顶视；`export-check.webp` 是重新导入 GLB 的渲染。
- `build.py`、`build_textures.py`：确定性重建；`textures/` 原创程序贴图。
- `qa.json`、`export-validation.json`：实际尺寸、几何数量、重开检查。

## 结构与变体
地面匍匐茎、节部托叶、与茎相接的长叶柄，8 组有浅色 V 纹的复叶，3 个不同发育阶段的白色花头。每个花头 66 个有旗瓣与翼瓣的微小蝶形花，不用光滑白球代替。叶片具有弧度、微皱、叶缘变化、主脉与纹理次脉；粗糙度、法线分离，不烘焙强光。

`CloverLeafThree` 和 `CloverLeafFour` 是同一根高位叶柄上的互斥叶片节点。Blender 默认隐藏 Four。**GLB 包含两者，使用方必须默认隐藏 `CloverLeafFour`；切四叶时隐藏 Three、显示 Four。** 这只是罕见四小叶变体，不把普通白车轴草全部做成四叶。

## 参考与推断
批准图：`02-草甸小花与羊茅-参考.png` 上排中间；场景方向：`01-自然草甸-场景方向.png`。局部图保留原始像素。镜头为相近的稍俯视三分之四方向，并非像素级照片拟合。背部、叶片厚度、茎节弯曲由植物结构推断；尺度为典型小型草甸株的美术选择，不是概念测量值。实际尺寸见 qa.json。

植物结构校核来源（只参考形态事实，不复制图片/贴图）：
- [USDA 白车轴草植物指南](https://plants.usda.gov/DocumentLibrary/plantguide/pdf/pg_trre3.pdf)
- [华盛顿大学 Burke Herbarium](https://www.burkeherbarium.org/imagecollection/taxon.php?Taxon=Trifolium+repens)
- [UT Austin 白车轴草花部描述](https://w3.biosci.utexas.edu/prc/K12/pages/Trifolium%20repens.html)

## 验证与重建
Blender 4.3.2 命令行生成并导出；重开 .blend 确认贴图打包；在新网格场景中重新导入实际 GLB，检查有限坐标、包围盒和双变体，并实际渲染。无地面网格。GLB 是可通用渲染的双面网格材质，不依赖 Blender 专用程序节点。近看模型，不承诺微距照片扫描级重建；尚无风动绑定。

运行 `python build_textures.py`，再 `blender -b -t 4 -P build.py`；检查 `blender -b -t 4 -P verify.py`。封面及比较图由真实渲染转换为 WebP，不用概念图代替模型渲染。HTML 和 Pages 由主项目集成流程生成。

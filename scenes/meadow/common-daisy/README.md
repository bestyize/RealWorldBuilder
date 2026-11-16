# 雏菊 · Common daisy

<!-- ASSET-PACK START -->
## 独立资产包

- [在线预览](https://bestyize.github.io/RealWorldBuilder/scenes/meadow/common-daisy/preview.html)：直接用 Chrome、Edge 或支持 WebGL 2 的 Safari 打开。默认折叠，画面右侧中部按钮展开管理面板。拖动旋转、滚轮或双指缩放；`#overlay` 隐藏面板按钮。
- [离线 HTML 文件](preview.html)：在 GitHub 点击「Download raw file」，保存后用浏览器打开。
- [Blender 工程](model.blend)：编辑源模型。贴图由项目文件管理。
- [游戏模型 GLB](model.glb)：正式导入用此文件，模型与贴图在 GLB 内，不需要将预览 HTML 导进游戏。GLB +Y 向上，Blender +Z 向上；鱼头约定 +X。
- [模型预览图](images/cover.webp)：实际模型渲染，非生成概念。

小花盘、短花梗与根生叶丛，适合放在较矮草地。

预览 HTML 内嵌本资产和运行脚本，不需要起服务、连网、下载 CDN 或加载其他品种。仓库中重建：`node scripts/build-asset-packs.mjs common-daisy`。
<!-- ASSET-PACK END -->


学名 **Bellis perennis**。短花葶、基生匙形叶的草地雏菊，不是高茎滨菊。按已批准生成概念制作，不是照片扫描。

## 文件
- `model.blend`：可编辑分件网格、打包叶片贴图、相机与柔光；米制、Z 向上。
- `model.glb`：标准 glTF 2.0，Y 向上，地面原点，无背景、底板、相机或灯光。
- `images/cover.webp`：实际模型 RGBA 渲染；`reference-concept.png` / `comparison.webp`：批准概念局部和同方向比较。
- `images/side.webp`、`rear.webp`、`top.webp` 和 `export-check.webp`：侧、后、顶与重新导入 GLB 后的真实渲染。
- `build.py`、`build_textures.py`、`textures/`：原创网格与贴图重建来源。
- `qa.json`、`export-validation.json`：包围盒、数量、导出验证。

## 结构
15 片略有齿缘的匙形基生叶组成不对称莲座；叶片窄基部连续接入冠部。3 根无叶花葶承载不同大小、开合与倾斜方向的花。两圈错位细长白色舌状花有浅沟、卷曲和少量背部粉色；黄色花盘不是平圆片，而是每头 180 个五裂管口小花。绿色总苞承托花头，茎上稀疏细毛由真实几何构成。

叶色、粗糙度与法线使用分离贴图；主脉为贴合曲面的几何，次脉与细胞级变化由法线实现。材质低镜面，不靠湿亮高光营造细节。模型无隐藏地面、展示台或背景。

## 参考与推断
批准图 `02-草甸小花与羊茅-参考.png` 上排右侧，及 `01-自然草甸-场景方向.png`。它们是批准的生成图，不是实拍；本包保留局部作为基准。采用相近三分之四观察方向，非像素级对齐。典型草地株尺度、不可见背部、细小花部均按植物形态合理补足。

事实校核：[World Flora Online — Bellis perennis](https://www.worldfloraonline.org/taxon/wfo-0000072578)，基生匙形叶、齿状至圆齿叶缘及总苞结构。未下载或复制该站照片或纹理。网格与三张叶片贴图均为此次原创。

## 验证与重建
Blender 4.3.2 生成，实际重开打包 .blend，重新导入 GLB 检查有限顶点、尺寸和材质，再渲染核对。完整叶片、花头多角度检查。运行 `python build_textures.py`、`blender -b -t 4 -P build.py`，验证 `blender -b -t 4 -P verify.py`。尚无骨骼或风动。HTML/Pages 的离线预览检查由主项目整合完成，不能以 Blender 检查代替浏览器验收。

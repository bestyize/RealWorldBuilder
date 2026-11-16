# 花园地表材质

这三个目录是可单独下载的 PBR 贴图，不含 Blender、GLB、灯光或背景。GitHub 中打开某个文件后可用 **Download raw file** 下载；也可以在仓库中用 `git pull` 同步。

## 矮草叶片

| 用途 | 文件 |
|---|---|
| 底色（2K） | [grass_bermuda_01_diff_2k.jpg](short-turf/grass_bermuda_01_diff_2k.jpg) |
| 轮廓 Alpha（2K） | [grass_bermuda_01_alpha_2k.png](short-turf/grass_bermuda_01_alpha_2k.png) |
| OpenGL 法线（1K） | [grass_bermuda_01_nor_gl_1k.exr](short-turf/grass_bermuda_01_nor_gl_1k.exr) |
| 粗糙度（1K） | [grass_bermuda_01_rough_1k.exr](short-turf/grass_bermuda_01_rough_1k.exr) |

这是叶片 UV 图集，不是铺在地上的无缝草地。用于双面叶片，Alpha 建议用裁切，阈值从 0.45 起调。图集来自 Rico Cilliers / Poly Haven 的 [Grass Bermuda 01](https://polyhaven.com/a/grass_bermuda_01)，[CC0](https://polyhaven.com/license)。

## 小石子

| 用途 | 文件 |
|---|---|
| 底色（512） | [mineral-basecolor.png](micro-pebbles/mineral-basecolor.png) |
| OpenGL 法线（512） | [mineral-normal.png](micro-pebbles/mineral-normal.png) |
| 粗糙度（512） | [mineral-roughness.png](micro-pebbles/mineral-roughness.png) |

这是石头表面的矿物颗粒，不是把一整层石子拍成地表纹理。三张图由项目程序生成，未把实拍参考或光照烘入底色。颜色可在各变体材质中再单独调整。

## 花园泥土

| 用途 | 文件 |
|---|---|
| 底色（1K） | [soil-diff.png](garden-soil/soil-diff.png) |
| OpenGL 法线（1K） | [soil-nor_gl.png](garden-soil/soil-nor_gl.png) |
| 哑光粗糙度（1K） | [soil-matte-roughness.png](garden-soil/soil-matte-roughness.png) |
| 位移（1K） | [soil-disp.png](garden-soil/soil-disp.png) |

扫描来自 Amal Kumar / Poly Haven 的 [Farm Soil](https://polyhaven.com/a/farm_soil)，[CC0](https://polyhaven.com/license)。图集取原始 4K 扫描中心约 0.5 m 的区域，裁剪后不保证无缝。需大面积平铺时，优先使用上游完整图。原图地址和裁剪范围见 [provenance.json](garden-soil/provenance.json)。

## 材质设置

底色按 sRGB 读取；Alpha、法线、粗糙度、位移按线性数据读取。默认金属度为 0。法线是 OpenGL（+Y），若目标引擎按 DirectX 法线读取，应翻转绿色通道。

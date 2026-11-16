# 虞美人 · Papaver rhoeas

<!-- ASSET-PACK START -->
## 独立资产包

- [在线预览](https://bestyize.github.io/RealWorldBuilder/scenes/meadow/field-poppy/preview.html)：直接用 Chrome、Edge 或支持 WebGL 2 的 Safari 打开。默认折叠，画面右侧中部按钮展开管理面板。拖动旋转、滚轮或双指缩放；`#overlay` 隐藏面板按钮。
- [离线 HTML 文件](preview.html)：在 GitHub 点击「Download raw file」，保存后用浏览器打开。
- [Blender 工程](model.blend)：编辑源模型。贴图由项目文件管理。
- [游戏模型 GLB](model.glb)：正式导入用此文件，模型与贴图在 GLB 内，不需要将预览 HTML 导进游戏。GLB +Y 向上，Blender +Z 向上；鱼头约定 +X。
- [模型预览图](images/cover.webp)：实际模型渲染，非生成概念。

纤细花梗、下垂花苞与起伏的薄红花瓣。草甸里只少量成簇使用。

预览 HTML 内嵌本资产和运行脚本，不需要起服务、连网、下载 CDN 或加载其他品种。仓库中重建：`node scripts/build-asset-packs.mjs field-poppy`。
<!-- ASSET-PACK END -->


自然草甸独立游戏资产；无底板、无环境背景、米制尺寸。植物自身不包含镜头或灯光；Blender 工程保留预览相机及摄影棚灯光但导出的 GLB 只有模型。

## 文件
- `model.blend`：可编辑解剖结构分组、UV 和打包纹理；Blender 4.3。
- `model.glb`：glTF 2.0，标准 PBR、嵌入底色贴图，双面薄片，无透明贴片剪影。
- `images/cover.webp`：真实 3D 渲染，透明 Alpha，无底板。
- `images/side.png` / `rear.png` / `three-quarter.png`：实际模型角度检查。
- `images/reference-comparison.webp`：左为批准概念裁剪，右为模型近似同方向实渲染。概念非正交摄影，因此不是像素级复刻。
- `reference/approved-concept.png`、`reference/ORIGIN.md`：原始设计来源与局限。
- `source/build.py`：完整可重现构建、打包、渲染和 GLB 再导入验证。
- `qa.json`：精确尺寸、网格数量、三角形数及再导入误差。

## 结构与材质
四片相互覆叠的薄红花瓣，真实波褶轮廓与起伏；深色基部、75枚雄蕊、柱头盘放射纹；垂头有毛花苞、深裂叶。

叶片不是平面剪影：叶缘起伏、弯曲和轻微扭转为几何，叶脉具有细几何主脉与支脉，叶柄与主茎连续相接。纹理包含色素与微弱非方向性变化，不包含烘焙高光或阴影。粗糙度 0.78；非金属、低镜面反射；不靠透明度伪造厚度。模型按结构分组，不逐叶膨胀为大量绘制对象。

## 复现
```sh
blender -b -t 4 --python source/build.py -- field-poppy
```
在此目录运行即可。脚本输出相邻父目录，随机种子固定 7031；所有纹理由脚本生成并打包，不依赖外部付费素材或网络。预览渲染使用 Cycles CPU，48 samples。若最终放大近景需更高质量，可提高 samples；无需改变模型。

## 比例与推定
Blender Z 向上，根部触地 Z=0；GLB 按标准导出 Y 向上。尺寸见 qa.json，属于面向组合草甸场景的代表性植株，不是实物扫描测量。概念图提供整体形态、色彩和枝条层次；侧面、背面、叶片厚度、不可见节点均为植物学约束下的人工推定。保留自然不对称，非严格对称标本。

## 参考与验收
批准 AI 概念图：`02-草甸小花与羊茅-参考.png` 下排及 `01-自然草甸-场景方向.png`。植物结构资料：[Papaver rhoeas](https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A306058-2/general-information)，2026-11-17 查阅，仅用于结构校核；未复制该站图片。

已进行实际导出后重新导入 GLB 的尺寸/网格/材质检查，误差见 qa.json。相同正面相机渲染及侧、背、斜视角用于检查轮廓。透明图有真实 alpha。根部、花冠、叶柄为静态模型；未提供风动骨架。浏览器离线预览和总场景由主任务集成后验收，本资产不冒称已经完成网站发布。

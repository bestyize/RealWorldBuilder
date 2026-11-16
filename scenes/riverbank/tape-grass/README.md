# 细长带叶水草

<!-- ASSET-PACK START -->
## 独立资产包

- [透明离线预览](preview.html)：直接用 Chrome、Edge 或支持 WebGL 2 的 Safari 打开。默认折叠，画面右侧中部按钮展开管理面板。拖动旋转、滚轮或双指缩放；`#overlay` 隐藏面板按钮。
- [Blender 工程](model.blend)：编辑源模型。贴图由项目文件管理。
- [游戏模型 GLB](model.glb)：正式导入用此文件，模型与贴图在 GLB 内，不需要将预览 HTML 导进游戏。GLB +Y 向上，Blender +Z 向上；鱼头约定 +X。
- [模型预览图](images/cover.webp)：实际模型渲染，非生成概念。

静态。独立叶片为实网格，叶脉贴图已内嵌；此为原河岸分件，未经过宽叶 V4 的写实迭代。

预览 HTML 内嵌本资产和运行脚本，不需要起服务、连网、下载 CDN 或加载其他品种。仓库中重建：`node scripts/build-asset-packs.mjs tape-grass`。
<!-- ASSET-PACK END -->

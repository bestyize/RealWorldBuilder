# 银身神仙鱼

<!-- ASSET-PACK START -->
## 独立资产包

- [透明在线预览](https://bestyize.github.io/RealWorldBuilder/fish/silver-angelfish/asset-preview.html)：直接用 Chrome、Edge 或支持 WebGL 2 的 Safari 打开。默认折叠，画面右侧中部按钮展开管理面板。拖动旋转、滚轮或双指缩放；`#overlay` 隐藏面板按钮。
- [离线 HTML 文件](asset-preview.html)：在 GitHub 点击「Download raw file」，保存后用浏览器打开。
- [Blender 工程](silver-angelfish.blend)：编辑源模型。贴图由项目文件管理。
- [游戏模型 GLB](silver-angelfish.glb)：正式导入用此文件，模型与贴图在 GLB 内，不需要将预览 HTML 导进游戏。GLB +Y 向上，Blender +Z 向上；鱼头约定 +X。
- [模型预览图](images/cover.webp)：实际模型渲染，非生成概念。

GLB 有骨骼，无烘焙泳姿；预览用实时动作。贴图保留细鳞与不同区域的反光差异。

预览 HTML 内嵌本资产和运行脚本，不需要起服务、连网、下载 CDN 或加载其他品种。仓库中重建：`node scripts/build-asset-packs.mjs silver-angelfish`。
<!-- ASSET-PACK END -->

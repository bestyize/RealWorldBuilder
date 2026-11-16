# 还原资产的项目接入

参考图、材质、建模与对照可用 Skill [`$photo-to-3d`](../../photo-to-3d/SKILL.md)。需要把模型作为 RealWorldBuilder 的资产交付时，按本轮目标接入。

- 鱼种用 `fish/<species>/`，配好独立预览所需的模型与游动代码。动画、路线与入缸验收见[鱼种制作与接入](fish-production.md)。
- 展厅物件可沿用 `objects/<asset>/` 的分包。用同一份 GLB 接独立预览，需要展厅入口时再登记。可参考[碎花垂耳兔工程](../../../../objects/plush-rabbit/README.md)的材质、可旋转预览和近景。
- 按已有独立预览将 GLB 与渲染依赖接入项目构建。在仓库根目录执行 `npm run build`，新工作树需要依赖时先运行 `npm ci`。打开生成的预览验证离线加载和所需交互。需要进缸时，同时打开生成的 `aquarium.html` 检查尺寸、路线、灯光与遮挡。
- 用实际交付的浏览器画面取对照帧。可参考[垂耳兔等高对照](../../../../output/plush-rabbit/fine-pile-comparison.png)和[同倍率近景](../../../../output/plush-rabbit/fine-pile-detail.png)。跨会话交接时用[任务与交接模板](brief-template.md)记录模型、接入点与验收结果。

# RealWorldBuilder

将照片或定稿图还原成通用 3D 模型时，可用 Skill [`$photo-to-3d`](.agents/skills/photo-to-3d/SKILL.md)。为 RealWorldBuilder 创作鱼种、场景或展厅物件时，使用项目 Skill [`$aquarium-creation`](.agents/skills/aquarium-creation/SKILL.md) 处理概念图、游戏资产、建模绑定、实时交互和项目接入。从当前任务所处的阶段开始，按用户要求的范围交付。用户只想讨论时，交付设计方案和待定的选择。

- 以 [`fish/arowana/`](fish/arowana/) 为第一个可运行的鱼种参考。新鱼种在 `fish/<species>/` 中维护自己的模型、材质、骨骼动作及独立预览，水族箱提供路线、灯光和场景。
- 并行设计时，从包含本文件和龙鱼加载器的同一个提交开工作树。每条任务有自己的鱼种或资产目录。共用加载器、主场景和构建入口的修改在集成时合并，HTML 由已合并的源码重新生成。
- 需要验证网页时，在仓库根目录执行 `npm run build`。第一次使用该工作树时可先运行 `npm ci`。用构建出的独立预览或 `aquarium.html` 检查实际效果。

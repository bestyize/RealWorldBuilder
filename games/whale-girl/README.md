# 潮汐书房

月亮升上海湾时，鲸鱼娘会带着书到窗边，靠在小鲸抱枕旁读几页。进门的靛蓝地毯上绣着一对母子鲸，右手书桌的贝壳灯下，是她写给来访朋友的一封信。

直接用浏览器打开 [preview.html](preview.html)。页面已内嵌角色、动画、海湾夜景、鲸纹地毯与 Three.js，支持离线运行。修改源码后，在仓库根目录执行 `npm run build`。

- 点地板或按住方向键散步。点长椅坐下读书，点书桌去写信，也可以用下方按钮。点另一处地板或另选活动就会起身。
- 拖动画面环顾，滚轮或双指缩放。「全景」看整间书房，「跟随」近看角色。R 切换读书，E 切换写信，V 切换镜头。

## 模型与署名

使用 PekolandBBQ 的女仆版 `dafeiyu-maid.glb`。文件与 v1.0.2 发布包一致，SHA-256 为 `54f8e2b295f8a0998ae42ff8b1a1e13632ec24f715d1aba284461570eb1634ab`。此场景播放文件中的 `idle`、`walk`、`bench-read` 和 `write`，打开的书也随模型动画出现。[作者发布页](https://github.com/PekolandBBQ/Deepseek-Dafeiyu-Chibi-3D-Model/releases/tag/v1.0.2)

原型「溟月」由上善无形创作，DeepSeek 女仆鲸鱼娘由 ZipZipPipe 设计，Q 版三维造型、服装和动画由 PekolandBBQ 项目制作。作者注明动作及部分外观参考 merzlin 的 shenshen 桌宠及 PC2005-cloud 的 dsh-pet，早期后发和脸部投影使用的一张转身参考动图作者待考。围裙上的 DeepSeek 标志归相应权利人所有。[上游来源说明](https://github.com/PekolandBBQ/Deepseek-Dafeiyu-Chibi-3D-Model/blob/v1.0.2/THIRD_PARTY_NOTICES.md)

角色资产按 [CC BY-NC-SA 4.0](MODEL-LICENSE.txt) 提供，限非商业使用。书房原样嵌入 GLB，播放时沿用模型的眨眼时机，在同一个头部网格上绘制眼睑，表情改编沿用相同许可。[眼睑绘制与播放](eyelids.js)

## 书房美术

三扇拱窗共用的[月升海湾](moonrise-harbor.jpg)由原来的[白昼港景](harbor.jpg)改绘，保留了同一座灯塔和海岸线。[母子鲸地毯](whale-tapestry.jpg)采用靛蓝、灰蓝、珍珠白和少量旧金色。

窗帘上的蝴蝶结取自鲸鱼娘的发饰，珍珠扣和扇贝花边呼应她的女仆围裙。窗台上的贝壳小夜灯、长椅上的鲸鱼靠枕和月牙风铃见 [furnishings.js](furnishings.js)。书房布局见 [room.js](room.js)，潮汐手记、信纸和墙纸的绘制见 [surfaces.js](surfaces.js)。

<details>
<summary>内置 ImageGen 使用的两组提示词</summary>

**月升海湾**（以白昼港景为参考图）

Edit the supplied illustration of the seaside village into the same bay at blue hour, shortly after sunset, for the windows of a chibi whale girl's reading room. Preserve the single continuous 3:1 panoramic composition, coastline, little lighthouse on the left, schooner on the right and the painterly gouache finish. Deep periwinkle sky grading into a narrow shell-pink horizon, quiet layered indigo islands, still luminous blue water. A single clearly readable slender warm ivory crescent at 43 percent of image width, about one quarter of the way down, with a broken column of silver ripples beneath. A handful of bright stars, a few warm cottage windows and a soft beam in the lighthouse lantern. Calm and intimate, clear medium values, softly textured hand-painted animation background, landscape all the way to the edges. No indoor elements, frames, text or characters.

**鲸纹地毯**

Create an albedo texture of an heirloom woven rug for a gentle whale girl's seaside reading room. Strict perpendicular top-down, flat rectangular 1.85:1 wide composition. Textile fills the entire image edge to edge, outside edge of binding aligned to image edges, no floor, no fringe extending off the rug, no perspective, lighting gradient, lettering or cast shadow. Elegant Japanese storybook textile design. A large supple silver and powder-blue humpback whale with sweeping flukes swims upward toward the right across a muted deep ink-indigo field, with a smaller calf curling on the lower left. Expressive curved bodies, delicate stitched baleen grooves and pale flippers. Curving shoals of tiny stitches suggest the tide. Quiet breathing room around the animals. Narrow pearl and antique gold double border of scallop shells and wave crests with graceful corner ornaments. Restricted yarn palette of weathered French blue, periwinkle, indigo, pearl ivory and just a little antique gold. Convincing jacquard and fine embroidery texture, sophisticated handmade object, crisp and legible from a distance, not a photograph of a room.

</details>

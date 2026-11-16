from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json,shutil
ROOT=Path(__file__).resolve().parent
name=ROOT.name
source=Path('/workspace/scratch/0725a0f109cf')
spec={'bermuda-grass':('狗牙根','Cynodon dactylon','陆地草类-写实对照.png',(0,735,580,1010),'低矮匍匐枝条、连续茎节、密疏变化的尖叶小簇；叶片带中央浅折槽与卷曲。'), 'fine-fescue':('细叶羊茅','Fine fescue / Festuca rubra concept','land-assets-approval/02-草甸小花与羊茅-参考.png',(0,0,490,505),'细长、松散下弯叶束，基部聚拢，少量轻盈分枝花序；避免宽叶芦苇形态。'),'green-foxtail':('狗尾草','Setaria viridis','陆地草类-写实对照.png',(550,270,900,985),'五根错落的具节茎，叶鞘和叶片从同一节位连接；真实三维穗粒和细芒，不使用圆柱贴图假穗。')}
cn,latin,src,box,desc=spec[name]
original=source/src if (source/src).exists() else ROOT/'images/reference-original.png'
if original.resolve() != (ROOT/'images/reference-original.png').resolve():shutil.copy2(original,ROOT/'images/reference-original.png')
ref=Image.open(original).crop(box);ref.save(ROOT/'images/reference-crop.png')
for filename in ['cover','rear','export-check']:
 p=ROOT/'images'/f'{filename}.png'
 if p.exists():Image.open(p).save(p.with_suffix('.webp'),lossless=True,exact=True,method=6)
def panel(im):
 im=im.convert('RGBA');a=im.getchannel('A');bb=a.getbbox();im=im.crop(bb) if bb else im;im.thumbnail((560,740),Image.Resampling.LANCZOS)
 out=Image.new('RGBA',(600,800),(228,231,222,255));out.alpha_composite(im,((600-im.width)//2,70+(700-im.height)//2));return out
board=Image.new('RGB',(1200,800),(228,231,222));board.paste(panel(ref).convert('RGB'),(0,0));board.paste(panel(Image.open(ROOT/'images/cover.png')).convert('RGB'),(600,0));d=ImageDraw.Draw(board);d.text((25,25),'APPROVED CONCEPT (crop)',fill=(30,35,30));d.text((625,25),'ACTUAL MODEL / Blender render',fill=(30,35,30));board.save(ROOT/'images/comparison.webp',quality=94)
qa=json.load(open(ROOT/'qa.json')); dims=' × '.join(f'{x:.3f}' for x in qa['dimensions_m'])
(ROOT/'README.md').write_text(f'''# {cn} / {latin}

独立自然草甸资产。{desc}

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
尺寸约 {dims} m（Blender X/Y/Z），原点在地面中心区域，最低顶点 Z=0。Blender 米制/Z-up；GLB 标准 Y-up。三角面 {qa['triangles']:,}，逻辑网格 {qa['mesh_objects']} 个。适合近中景单丛；大面积草甸应实例化，并进一步生成 LOD/远景替代，不应复制成大量独立高模。

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
''',encoding='utf-8')
print(name,qa['triangles'],dims)

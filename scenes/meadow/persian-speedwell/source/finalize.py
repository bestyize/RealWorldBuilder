from pathlib import Path
from PIL import Image, ImageDraw
import json
p=Path(__file__).resolve().parent.parent
for name in ['cover','side','rear','three-quarter']:
 im=Image.open(p/'images'/f'{name}.png').convert('RGBA');im.save(p/'images'/f'{name}.webp',lossless=True)
cover=Image.open(p/'images/cover.png').convert('RGBA');ref=Image.open(p/'reference/approved-concept.png').convert('RGB')
canvas=Image.new('RGB',(1100,720),(31,36,31));dr=ImageDraw.Draw(canvas)
for img,x in [(ref.copy(),15),(cover.copy(),565)]:
 img.thumbnail((520,650));y=50+(650-img.height)//2
 if img.mode=='RGBA':canvas.paste(img,(x+(520-img.width)//2,y),img)
 else:canvas.paste(img,(x+(520-img.width)//2,y))
dr.text((20,18),'APPROVED CONCEPT / GENERATED, NOT A PHOTOGRAPH',fill='white');dr.text((575,18),'ACTUAL 3D / APPROXIMATE MATCHED FRONT VIEW',fill='white');canvas.save(p/'images/reference-comparison.webp',quality=92)
# contact sheet: same asset, side and rear checks, no reference renders generated
sheet=Image.new('RGB',(1200,600),(36,41,39));d=ImageDraw.Draw(sheet)
for i,name in enumerate(['cover','side','rear','three-quarter']):
 im=Image.open(p/'images'/f'{name}.png').convert('RGBA');im.thumbnail((290,550));sheet.paste(im,(i*300+(300-im.width)//2,40+(550-im.height)//2),im);d.text((i*300+15,15),name,fill='white')
sheet.save(p/'images/angle-checks.webp',quality=92)
q=json.loads((p/'qa.json').read_text());alpha=cover.getchannel('A');q['cover_alpha_extrema']=alpha.getextrema();q['cover_alpha_nonzero_bbox']=alpha.getbbox();q['blend_bytes']=(p/'model.blend').stat().st_size;q['glb_bytes']=(p/'model.glb').stat().st_size;(p/'qa.json').write_text(json.dumps(q,indent=2))

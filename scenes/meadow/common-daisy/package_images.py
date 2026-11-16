from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
p=Path(__file__).resolve().parent
for name in ['cover','side','rear','top','export-check']:
 f=p/'images'/f'{name}.png'
 if f.exists():Image.open(f).save(f.with_suffix('.webp'),quality=94,method=6)
ref=Image.open(p/'images/reference-concept.png').convert('RGB')
render=Image.open(p/'images/cover.png').convert('RGBA');box=render.getchannel('A').getbbox();render=render.crop(box)
canvas=Image.new('RGB',(1200,690),(226,230,220));d=ImageDraw.Draw(canvas)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',19)
d.text((28,20),'APPROVED GENERATED CONCEPT',font=font,fill=(45,56,38));d.text((626,20),'ACTUAL 3D MODEL / REFERENCE VIEW',font=font,fill=(45,56,38))
for i,im in enumerate([ref,render]):
 im.thumbnail((540,555),Image.Resampling.LANCZOS);x=30+i*600+(540-im.width)//2;y=70+(555-im.height)//2
 canvas.paste(im,(x,y),im if im.mode=='RGBA' else None)
d.text((28,650),'Original concept crop; anatomy and concealed surfaces inferred. No photo scan.',font=font,fill=(45,56,38))
canvas.save(p/'images/comparison.webp',quality=94)

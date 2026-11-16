from PIL import Image,ImageOps,ImageDraw
from pathlib import Path
p=Path(__file__).resolve().parents[1]
im=Image.open(p/'images/review-front.png').convert('RGBA')
im.save(p/'images/cover.webp',lossless=True)
print('cover alpha',im.getchannel('A').getextrema(),'bbox',im.getchannel('A').getbbox())
board=Image.new('RGB',(1600,850),(225,229,220))
ref=Image.open(p/'source/concept-tree-crop.webp').convert('RGBA')
for src,x in [(ref,0),(im,800)]:
 src=ImageOps.contain(src,(780,760))
 board.paste(src,(x+(800-src.width)//2,65+(760-src.height)//2),src)
d=ImageDraw.Draw(board)
d.text((25,24),'APPROVED GENERATED CONCEPT (not a photograph)',fill=(30,40,30))
d.text((825,24),'ACTUAL 3D MODEL - frontal approximation',fill=(30,40,30))
board.save(p/'images/comparison.webp',quality=93)

from PIL import Image
import numpy as np, os, shutil
base=os.path.dirname(__file__)
rng=np.random.default_rng(82)
for species in [os.path.basename(base)]:
 out=os.path.join(base,'textures');os.makedirs(out,exist_ok=True)
 n=768;y,x=np.mgrid[0:n,0:n];u=(x/(n-1)-.5)*2;v=y/(n-1)
 fine=rng.normal(0,1,(n,n))
 # Main and secondary veins follow oblique branches, finer reticulum.
 mid=np.exp(-(u/.019)**2)
 phase=(v-abs(u)*.22)*12
 minor=np.exp(-(np.sin(phase*np.pi)/.11)**2)*(1-np.exp(-(u/.06)**2))
 net=np.sin(u*95+np.sin(v*108))*np.sin(v*104+u*38)
 wrinkle=np.sin(v*85+abs(u)*19)*.1
 h=mid*.6+minor*.34+net*.035+fine*.025+wrinkle
 chevron=np.exp(-((v-(.50+.20*abs(u)))/.055)**4) if species=='white-clover' else np.zeros_like(v)
 tone=.93+.07*np.sin(v*7+u*3)+fine*.028+net*.025
 rgb=np.stack([tone*61+chevron*60+mid*17+minor*12,tone*107+chevron*62+mid*13+minor*18,tone*37+chevron*47+mid*7+minor*7],axis=2)
 Image.fromarray(np.uint8(np.clip(rgb,0,255))).save(out+'/leaf-basecolor.png')
 gy,gx=np.gradient(h);norm=np.stack([-gx*3.2,-gy*3.2,np.ones_like(gx)],axis=2);norm/=np.linalg.norm(norm,axis=2)[...,None]
 Image.fromarray(np.uint8((norm*.5+.5)*255)).save(out+'/leaf-normal.png')
 Image.fromarray(np.uint8(np.clip(195+fine*8+net*6,0,255))).save(out+'/leaf-roughness.png')

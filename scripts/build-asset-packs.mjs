import { access,writeFile,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import sharp from 'sharp';
import { webpModel } from './webp-assets.mjs';
import { assets } from './asset-packs.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const file=p=>resolve(root,p), ui='src/asset-pack';
const pagesBase='https://bestyize.github.io/RealWorldBuilder/';
const repoDocs='https://github.com/bestyize/RealWorldBuilder/blob/main/';
const args=process.argv.slice(2);
if(args.includes('--list')){
  console.log(assets.map(a=>[a.id,a.dir,a.preview].join('\t')).join('\n'));process.exit(0);
}
const index=args.includes('--index'), positions=args.filter(a=>!a.startsWith('--'));
for(const id of positions)if(!assets.some(a=>a.id===id))throw new Error('Unknown asset ID: '+id);
const selection=positions.length?assets.filter(a=>positions.includes(a.id)):assets;
const esc=s=>s.replace(/[<>&"]/g,m=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'})[m]);
const template=await readFile(file(ui+'/template.html'),'utf8');
const check=async a=>{try{await access(a);return true;}catch{return false;}};
const backgrounds=args.includes('--index-only')?{}:Object.fromEntries(await Promise.all(
  Object.entries({planted:'aquascape.jpg',blackwater:'blackwater.jpg',moon:'moon-window.jpg'}).map(async ([id,name])=>{
    const data=await sharp(file('assets/'+name)).resize({width:1440,withoutEnlargement:true})
      .webp({quality:73,smartSubsample:true}).toBuffer();
    return [id,'data:image/webp;base64,'+data.toString('base64')];
  })
));
async function render(a){
  const path=file(a.dir),origin=resolve(path,a.model);
  if(!await check(origin))throw new Error(`${a.id}: missing ${a.model}`);
  if(!await check(resolve(path,a.blend)))throw new Error(`${a.id}: missing ${a.blend}`);
  const adapter=a.adapter??'staticAdapter';
  const moduleName=adapter==='staticAdapter'?'static-adapter':adapter==='rabbitAdapter'?'rabbit-adapter':'fish-adapters';
  const runtime={id:a.id,name:a.name,variants:a.variants,modeLabel:a.modeLabel,backgrounds};
  const entry=`import {openAsset} from "./src/asset-pack/viewer.js"; import {${adapter}} from "./src/asset-pack/${moduleName}.js"; openAsset(${JSON.stringify(runtime)},${adapter});`;
  const [asset,code]=await Promise.all([
    webpModel(pathToFileURL(origin)),
    build({stdin:{contents:entry,resolveDir:root,sourcefile:`${a.id}-entry.js`},bundle:true,minify:true,write:false,format:'iife',legalComments:'inline'}),
  ]);
  if(asset.length>11_000_000) console.warn(`${a.id}: embedded asset over 11 MB; distribute as a separate pack`);
  const html=template.replaceAll('%%NAME%%',()=>esc(a.name)).replace('%%UI_STATE%%','')
    .replace('%%MODEL%%',()=>`<script id="model-data" type="application/octet-stream">${asset.toString('base64')}</script>`)
    .replace('%%SCRIPT%%',()=>code.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
  await writeFile(resolve(path,a.preview),html);
  const filename=resolve(path,'README.md');
  const current=await check(filename)?await readFile(filename,'utf8'):'';
  const keep=current.replace(/<!-- ASSET-PACK START -->[\s\S]*?<!-- ASSET-PACK END -->\s*/g,'').trim();
  const entryDocs=`<!-- ASSET-PACK START -->
## 独立资产包

- [在线预览](${pagesBase}${a.dir}/${a.preview})：直接用 Chrome、Edge 或支持 WebGL 2 的 Safari 打开。默认折叠，画面右侧中部按钮展开管理面板。拖动旋转、滚轮或双指缩放；\`#overlay\` 隐藏面板按钮。
- [离线 HTML 文件](${a.preview})：在 GitHub 点击「Download raw file」，保存后用浏览器打开。
- [Blender 工程](${a.blend})：编辑源模型。贴图由项目文件管理。
- [游戏模型 GLB](${a.model})：正式导入用此文件，模型与贴图在 GLB 内，不需要将预览 HTML 导进游戏。GLB +Y 向上，Blender +Z 向上；鱼头约定 +X。
- [模型预览图](images/cover.webp)：实际模型渲染，非生成概念。

${a.notes}

预览 HTML 内嵌本资产和运行脚本，不需要起服务、连网、下载 CDN 或加载其他品种。仓库中重建：\`node scripts/build-asset-packs.mjs ${a.id}\`。
<!-- ASSET-PACK END -->`;
  const legacy=keep?keep.split('\n'):[`# ${a.name}`];
  legacy.splice(1,0,'',entryDocs,'');
  await writeFile(filename,legacy.join('\n').replace(/\s+$/,'')+'\n');
  const info={id:a.id,name:a.name,category:a.category,files:{preview:a.preview,blender:a.blend,game:a.model,cover:'images/cover.webp',readme:'README.md'},gameNotes:a.notes,previewBytes:Buffer.byteLength(html),embeddedGlbBytes:asset.length};
  await writeFile(resolve(path,'asset-pack.json'),JSON.stringify(info,null,2)+'\n');
  console.log(a.id,html.length,`${a.dir}/${a.preview}`);
}
async function catalogue(){
  const cards=await Promise.all(assets.map(async a=>{
    const art=await check(file(`${a.dir}/images/cover.webp`))?`<img src="${a.dir}/images/cover.webp" alt="" loading="lazy">`:'';
    const exists=await check(file(`${a.dir}/${a.preview}`));
    if(!exists)throw new Error('Build missing asset before making catalogue: '+a.id);
    return `<article>${art}<div><small>${a.category}</small><h2>${esc(a.name)}</h2><a href="${a.dir}/${a.preview}">独立预览</a><a href="${repoDocs}${a.dir}/README.md">资产说明</a></div></article>`;
  }));
  await writeFile(file('asset-packs.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RealWorldBuilder 资产包</title><style>
*{box-sizing:border-box}body{margin:auto;max-width:1160px;padding:24px 20px;color:#252921;background:#f3efe5;font:15px/1.55 system-ui,-apple-system,"PingFang SC",sans-serif}
h1{font:600 clamp(31px,5vw,54px)/1.18 "Songti SC",Georgia,serif;margin:6px 0 13px}p{color:#4c5448;margin:0 0 23px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:13px}article{min-height:115px;background:#fffbf1;border:1px solid #cbc7b7;border-radius:10px;overflow:hidden}article div{padding:12px}img{aspect-ratio:1.65;width:100%;object-fit:contain;background:#e6e4d8;display:block}small{color:#626a59}h2{font-size:17px;margin:1px 0 7px}a{color:#314739;margin-right:15px}
</style></head><body><div><a href="index.html">返回微观展厅</a><a href="aquarium.html">打开主水族箱</a><a href="${repoDocs}README.md#目录导航">GitHub 目录</a></div><h1>独立 3D 资产包</h1><p>各包只加载自己的模型，不会把其他资产塞进同一个 HTML。</p><main>${cards.join('\n')}</main></body></html>\n`);
}
if(!args.includes('--index-only')){
  // Two workers limit peak memory with large source Blender-derived textures.
  let i=0;
  await Promise.all(Array.from({length:Math.min(2,selection.length)},async()=>{while(i<selection.length)await render(selection[i++]);}));
}
if(index||args.includes('--index-only'))await catalogue();

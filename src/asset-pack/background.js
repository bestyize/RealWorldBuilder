const storageKey='rwb.assetPreview.background';
const presetIds=new Set(['transparent','black','white','planted','blackwater','moon']);
const $=id=>document.getElementById(id);

export function installBackground(pictures){
  const stage=$('stage'), ui=$('pack-ui'), panel=$('panel'), toggle=$('pack-toggle');
  const select=$('pack-background'), file=$('pack-background-file'), replace=$('pack-background-replace');
  const message=$('pack-background-message');
  let preset='transparent', current, localUrl='', request=0;
  try{
    const saved=localStorage.getItem(storageKey);
    if(presetIds.has(saved))preset=saved;
  }catch{}
  current=preset;
  function apply(){
    const overlay=location.hash==='#overlay';
    ui.hidden=overlay;
    if(overlay&&!panel.hidden)toggle.click(); // Close before returning from overlay.
    const visible=overlay?'transparent':current;
    const image=visible==='local'?localUrl:pictures[visible];
    stage.dataset.background=visible;
    stage.style.backgroundImage=image?`url("${image}")`:'';
    select.value=current;
    replace.hidden=current!=='local';
  }
  function tell(text){message.textContent=text;message.hidden=!text;}
  function choose(openPicker=false){
    const next=select.value;
    request++;tell('');
    if(next==='local'){
      if(localUrl)current=next;
      apply();
      if(!localUrl||openPicker)file.click();
      return;
    }
    if(!presetIds.has(next)){apply();return;}
    preset=next;current=preset;
    try{localStorage.setItem(storageKey,preset);}catch{}
    apply();
  }
  select.addEventListener('change',()=>choose());
  replace.addEventListener('click',()=>choose(true));
  file.addEventListener('change',async()=>{
    const selected=file.files?.[0];file.value='';
    if(!selected)return;
    const token=++request;
    if(selected.size>24*1024*1024){
      tell('请选择小于 24 MB 的图片。');return;
    }
    if(!/\.(jpe?g|png|webp|avif)$/i.test(selected.name)){
      tell('请选择 JPG、PNG、WebP 或 AVIF 图片。');return;
    }
    const url=URL.createObjectURL(selected);
    const image=new Image();image.src=url;
    try{await image.decode();}
    catch{
      URL.revokeObjectURL(url);
      if(token===request)tell('无法打开这张图片，请试试其他图片。');
      return;
    }
    if(token!==request){URL.revokeObjectURL(url);return;}
    const previous=localUrl;localUrl=url;current='local';
    tell('');apply();
    if(previous)URL.revokeObjectURL(previous);
  });
  window.addEventListener('hashchange',apply);
  apply();
}

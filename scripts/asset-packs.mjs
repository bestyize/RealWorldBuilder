// Single catalogue. Source originals retain their established paths.
const fish=(id,name,adapter,notes)=>({id,name,adapter,category:'鱼类',dir:`fish/${id}`,blend:`${id}.blend`,model:`${id}.glb`,preview:'asset-preview.html',notes});
const scene=(id,name,notes,extra={})=>({id,name,category:'造景',dir:`scenes/riverbank/${id}`,blend:'model.blend',model:'model.glb',preview:'preview.html',notes,...extra});
export const assets=[
 fish('arowana','蓝色龙鱼','arowanaAdapter','GLB 有骨骼和烘焙动作。独立预览使用原项目游动路线。'),
 fish('vermilion-arowana','朱红龙鱼','vermilionArowanaAdapter','GLB 有骨骼和烘焙动作。独立预览使用原项目游动路线。'),
 fish('blue-guppy','蓝扇尾孔雀鱼','blueGuppyAdapter','GLB 有骨骼，无烘焙泳姿。单条与六鱼群复用同一份模型，鱼群保留原有花色；实时动作见游动源码。'),
 fish('kohaku-koi','红白锦鲤 · V6','kohakuKoiAdapter','GLB 有骨骼，无烘焙泳姿；预览用项目实时游动，保留 V6 尾根和不透明背鳍。'),
 fish('silver-angelfish','银身神仙鱼 · V2','silverAngelfishAdapter','GLB 有骨骼，无烘焙泳姿；预览用实时动作。保留细鳞、区域反光的 V2 贴图。'),
 fish('cardinal-tetra','宝莲灯 · V2','cardinalTetraAdapter','GLB 有骨骼，无烘焙泳姿。单条与 10 鱼群共用一个资产；虹彩用 KHR_materials_iridescence，不支持扩展的引擎使用基础材质。'),
 fish('sterbai-cory','斯氏鼠鱼 · V2','sterbaiCoryAdapter','GLB 有骨骼，无烘焙泳姿；模型和预览都没有地面，贴底姿态仍通过虚拟高度基准驱动。'),
 {id:'plush-rabbit',name:'碎花垂耳兔',category:'静物',dir:'objects/plush-rabbit',blend:'plush-rabbit.blend',model:'plush-rabbit.glb',preview:'asset-preview.html',adapter:'rabbitAdapter',notes:'静态。GLB 使用 EXT_meshopt_compression；预览内置解码并保留实时短绒，没有布台、接触阴影或摄影布景。'},
 scene('sand-bed','暖米色浅砂床 · V2','静态。砂本身就是有厚度的模型，不是背景；不含草、石、木根。'),
 scene('river-pebbles','河卵石 · 五种变体','静态。模型总览和独立变体都可用；包内五种石头只共用一个展示目录。',{modeLabel:'石头变体',variants:[1,2,3,4,5].map(i=>({id:`stone-${i}`,label:`卵石 ${i}`,node:`RiverPebble_0${i}`}))}),
 scene('driftwood','茶褐分叉沉木','静态。只含根木；枝条背侧为重建，不是扫描。'),
 scene('java-fern','卷窄叶水草','静态。独立叶片为实网格，叶脉贴图已内嵌；此为原河岸分件，未经过宽叶 V4 的写实迭代。'),
 scene('tape-grass','细长带叶水草','静态。独立叶片为实网格，叶脉贴图已内嵌；此为原河岸分件，未经过宽叶 V4 的写实迭代。'),
 scene('broadleaf-anubias','宽叶水草 · V4','静态。独立包仅使用 V4 的叶面和接点修订版；不从旧对照页带进 V3。GLB 保持不透明。'),
];

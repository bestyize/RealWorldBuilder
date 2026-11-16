const groups={grass:'草类',flower:'草地花',tree:'树木',insect:'昆虫'};
const asset=(id,name,group,notes,aliases='')=>({id,name,group:groups[group],category:'陆地',dir:`scenes/meadow/${id}`,blend:'model.blend',model:'model.glb',preview:'preview.html',adapter:'terrestrialAdapter',notes,aliases});
export const meadowAssets=[
 asset('bermuda-grass','狗牙根','grass','匍匐茎与细叶组成低矮底层草片。适合旋转、疏密变化后重复铺设。','草毯 Cynodon dactylon bermudagrass'),
 asset('fine-fescue','细叶羊茅','grass','细长弧形叶成丛，用于草毯与高草之间。','红羊茅 Festuca rubra'),
 asset('green-foxtail','狗尾草','grass','细秆托起有芒刺的圆柱形穗，适合零星放在草丛边缘。','Setaria viridis foxtail'),
 asset('white-clover','白车轴草','flower','低矮白色花团。管理面板可对比普通三出叶和四叶变体；场景里四叶不是默认状态。','四叶草 三叶草 白三叶 Trifolium repens'),
 asset('common-daisy','雏菊','flower','小花盘、短花梗与根生叶丛，适合放在较矮草地。','Bellis perennis'),
 asset('persian-speedwell','阿拉伯婆婆纳','flower','贴地细枝和带细纹的小蓝花，用作路边的低矮点缀。','Veronica persica'),
 asset('self-heal','夏枯草','flower','短花穗上的紫色小花和层叠苞片，用于近处的局部色点。','Prunella vulgaris'),
 asset('field-poppy','虞美人','flower','纤细花梗、下垂花苞与起伏的薄红花瓣。草甸里只少量成簇使用。','Papaver rhoeas'),
 asset('broad-oak','宽冠栎树','tree','低处分叉、展开的主枝和疏密相间的树冠，是草甸中远处的构图锚点。','栎树 橡树 Quercus robur'),
 asset('citrus-swallowtail','柑橘凤蝶','insect','单独建模的前后翅、触角与身体。GLB 保留可重用的翅动；单体预览慢放，方便近看翅根。','蝴蝶 凤蝶 Papilio xuthus'),
];

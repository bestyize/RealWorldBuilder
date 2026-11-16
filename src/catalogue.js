(() => {
  const search=document.getElementById('asset-query');
  const cards=[...document.querySelectorAll('#asset-grid [data-category]')];
  const filters=[...document.querySelectorAll('[data-filter]')];
  const count=document.getElementById('result-count');
  const empty=document.getElementById('empty-results');
  const clear=document.getElementById('search-clear');
  const normalize=text=>text.normalize('NFKC').toLowerCase().replace(/[\s_-]+/g,'');
  const matchers=cards.map(card=>normalize(card.dataset.search));
  const linkedCategory=new URLSearchParams(location.search).get('category');
  let category=filters.some(b=>b.dataset.filter===linkedCategory)?linkedCategory:'all';
  function update(){
    const query=normalize(search.value), active=category!=='all'||!!query;
    let shown=0;
    for(const [i,card] of cards.entries()){
      const show=(category==='all'||card.dataset.category===category)&&matchers[i].includes(query);
      card.hidden=!show;
      shown+=Number(show);
    }
    for(const button of filters)button.setAttribute('aria-pressed',String(button.dataset.filter===category));
    count.textContent=active?`显示 ${shown} / ${cards.length} 件资产`:`共 ${cards.length} 件资产`;
    empty.hidden=shown!==0;
    clear.hidden=!search.value;
  }
  for(const button of filters)button.addEventListener('click',()=>{category=button.dataset.filter;update();});
  search.addEventListener('input',update);
  clear.addEventListener('click',()=>{search.value='';search.focus();update();});
  document.getElementById('reset-filters').addEventListener('click',()=>{
    category='all';search.value='';
    update();filters[0].focus();
  });
  document.getElementById('catalogue-tools').hidden=false;
  update();
})();

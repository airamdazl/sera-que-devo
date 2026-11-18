/* Será Que Devo? · Beta 3.0 | Tour guiado, somente interface.
   Sem chamadas Supabase, coleta de dados ou alteração de registros financeiros.
   Exibição apenas após scd-auth-ready (perfil, idade e aceite concluídos).
*/
(()=>{'use strict';
  const VERSION='beta3-tour-v1';
  const STEPS=[
    {view:'dashboard',target:'#view-dashboard .hero',title:'Seu dinheiro em perspectiva',
     body:'Este é o Resumo Financeiro: entradas, saídas, pendências e resultados do mês. Escolha o mês para acompanhar seus registros.'},
    {view:'dashboard',target:'#scd-quick-actions',fallback:'#view-dashboard .stats',title:'Atalhos que facilitam',
     body:'Use os atalhos para chegar rapidamente aos lançamentos, contas, cartões e sonhos. No celular, a barra inferior mostra as ações principais.'},
    {view:'transactions',target:'#view-transactions .view-intro',title:'Registre entradas e despesas',
     body:'Anote o que recebeu, gastou ou ainda vai pagar. Confira a data, a categoria e o status. Você pode registrar sem ter conta ou cartão cadastrado.'},
    {view:'bi-accounts',target:'#view-bi-accounts .view-intro',title:'Contas e carteiras',
     body:'Cadastre bancos e carteiras apenas se desejar. Os saldos são informados por você; o aplicativo não se conecta ao banco.'},
    {view:'bi-cards',target:'#view-bi-cards .view-intro',title:'Cartões, faturas e benefícios',
     body:'Acompanhe faturas e parcelas dos cartões. VR, VA e outros benefícios ficam separados do dinheiro livre e não têm fatura de crédito.'},
    {view:'market',target:'#view-market .view-intro',title:'Mercado com calculadora e OCR',
     body:'Planeje produtos, compare preços por unidade, kg ou litro e confira o total. O leitor de cupom sugere itens, mas você deve revisar tudo antes de registrar a compra.'},
    {view:'goals',target:'#view-goals .view-intro',title:'Metas e sonhos',
     body:'Defina objetivos e acompanhe o progresso. Um valor pequeno e frequente também ajuda a transformar planos em metas concretas.'},
    {view:'reports',target:'#view-reports .view-intro',title:'Relatórios para conferir',
     body:'Use os filtros e exporte CSV ou PDF. São arquivos com informações financeiras privadas: guarde-os com cuidado.'},
    {view:'dashboard',target:'.scd-pandora-header',fallback:'#pandora-fab',title:'Pandora, sua companhia financeira',
     body:'A Pandora oferece comentários e dicas de organização baseadas nos dados informados. Ela não substitui orientação profissional nem calcula impostos que não estejam no cupom.'},
    {view:'bi-help',target:'#scd-faq-tour',title:'O tour mora no FAQ',
     body:'Na Central de ajuda, abra “Perguntas frequentes” e toque em “Refazer tour pelo aplicativo” sempre que quiser. Também há orientações de segurança e suporte.'}
  ];
  let root,mask,card,progress,heading,copy,prev,next,skip;
  let step=0,active=false,storedKey='',returnView='dashboard',returnFocus=null;
  let frame=0,firstOpenPending=false;
  const $=selector=>document.querySelector(selector);
  const knownUser=()=>window.SCD_BRIDGE?.user?.id||null;
  const isReady=()=>Boolean(knownUser() && window.SCD_ONBOARDING_COMPLETE===true && $('#app') && !$('#app').hidden);
  const storageKey=id=>`sqd-tour:${VERSION}:${id}`;
  const seen=key=>{try{return localStorage.getItem(key)==='done'}catch{return false}};
  const markSeen=()=>{if(!storedKey)return;try{localStorage.setItem(storedKey,'done')}catch{}};
  const visible=el=>Boolean(el&&el.getClientRects().length);
  const reduceMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function setup(){
    if(root)return;
    root=document.createElement('div');root.id='scd-tour';root.className='scd-tour-layer';root.hidden=true;
    root.innerHTML=`<div class="scd-tour-intercept" aria-hidden="true"></div>
      <div class="scd-tour-highlight" aria-hidden="true"></div>
      <section class="scd-tour-card" role="dialog" aria-modal="true" aria-labelledby="scd-tour-heading" aria-describedby="scd-tour-text" tabindex="-1">
        <div class="scd-tour-top"><span class="scd-tour-identity"><img src="./pandora-satisfeita.PNG" alt="" onerror="this.hidden=true"/><span>🐾 PANDORA APRESENTA</span></span>
          <button type="button" class="scd-tour-dismiss" aria-label="Pular tour" id="scd-tour-dismiss">Pular tour ×</button></div>
        <div class="scd-tour-count" id="scd-tour-count" aria-live="polite"></div>
        <h2 id="scd-tour-heading"></h2><p id="scd-tour-text"></p>
        <div class="scd-tour-progress" id="scd-tour-progress" role="progressbar" aria-label="Progresso do tour" aria-valuemin="1" aria-valuemax="${STEPS.length}"></div>
        <div class="scd-tour-controls"><button type="button" class="scd-tour-btn ghost" id="scd-tour-previous">Voltar</button>
          <button type="button" class="scd-tour-btn primary" id="scd-tour-next">Próximo</button></div>
        <p class="scd-tour-small">Tour explicativo, sem criar ou alterar lançamentos.</p>
      </section>`;
    document.body.append(root);
    mask=$('#scd-tour .scd-tour-highlight');card=$('#scd-tour .scd-tour-card');
    progress=$('#scd-tour-progress');heading=$('#scd-tour-heading');copy=$('#scd-tour-text');
    prev=$('#scd-tour-previous');next=$('#scd-tour-next');skip=$('#scd-tour-dismiss');
    prev.addEventListener('click',()=>showStep(step-1));next.addEventListener('click',()=>{
      if(step===STEPS.length-1)finish();else showStep(step+1);
    });
    skip.addEventListener('click',finish);
    root.addEventListener('keydown',e=>{
      if(!active)return;
      if(e.key==='Escape'){e.preventDefault();finish();return}
      if(e.key==='Tab'){
        const focusables=[skip,prev,next].filter(b=>!b.disabled);
        const pos=focusables.indexOf(document.activeElement);
        if(e.shiftKey && (pos<=0)){e.preventDefault();focusables.at(-1)?.focus()}
        else if(!e.shiftKey && pos===focusables.length-1){e.preventDefault();focusables[0]?.focus()}
      }
    });
    document.addEventListener('keydown',e=>{
      if(active && !root.contains(e.target) && (e.key==='Tab'||e.key==='Escape')){
        e.preventDefault();if(e.key==='Escape')finish();else next.focus();
      }
    });
    document.addEventListener('click',e=>{
      const btn=e.target.closest('#scd-tour-replay');
      if(btn){e.preventDefault();start(true)}
    });
    window.addEventListener('resize',updateHighlight,{passive:true});
    window.addEventListener('scroll',updateHighlight,{passive:true});
  }
  function targetFor(s){
    let el=$(s.target);
    if(!visible(el) && s.fallback)el=$(s.fallback);
    if(!visible(el))el=$(`#view-${s.view} .view-intro`)||$(`#view-${s.view}`);
    return visible(el)?el:null;
  }
  function updateHighlight(){
    if(!active||!mask)return;
    if(frame)cancelAnimationFrame(frame);
    frame=requestAnimationFrame(()=>{
      frame=0;
      const el=targetFor(STEPS[step]);
      if(!el){mask.style.visibility='hidden';return}
      mask.style.visibility='visible';
      const r=el.getBoundingClientRect(),pad=8;
      const left=Math.max(6,r.left-pad),top=Math.max(6,r.top-pad);
      const right=Math.min(innerWidth-6,r.right+pad),bottom=Math.min(innerHeight-6,r.bottom+pad);
      if(right<=left||bottom<=top){mask.style.visibility='hidden';return}
      Object.assign(mask.style,{left:`${left}px`,top:`${top}px`,width:`${right-left}px`,height:`${bottom-top}px`});
    });
  }
  function showStep(i){
    if(!active)return;
    step=Math.max(0,Math.min(STEPS.length-1,i));
    const s=STEPS[step];
    try{window.SCD_BRIDGE?.navigate(s.view,false)}catch(err){console.warn('[SCD TOUR] Navegação indisponível',err)}
    const faq=$('#scd-faq-tour');
    if(s.view==='bi-help' && faq)faq.open=true;
    heading.textContent=s.title;copy.textContent=s.body;
    $('#scd-tour-count').textContent=`Passo ${step+1} de ${STEPS.length}`;
    progress.setAttribute('aria-valuenow',String(step+1));
    progress.style.setProperty('--scd-tour-progress',`${Math.round(100*(step+1)/STEPS.length)}%`);
    prev.disabled=step===0;next.textContent=step===STEPS.length-1?'Concluir tour':'Próximo';
    const el=targetFor(s);
    if(el){
      // Target goes above the fixed card, especially on mobile screens.
      const r=el.getBoundingClientRect(),desiredTop=Math.min(105,Math.max(55,innerHeight*.12));
      if(r.top<25 || r.top>innerHeight*.48){
        window.scrollBy({top:r.top-desiredTop,behavior:reduceMotion()?'instant':'instant'});
      }
    }
    updateHighlight();
    next.focus({preventScroll:true});
  }
  function start(force=false){
    setup();if(!isReady()||active)return false;
    storedKey=storageKey(knownUser());
    if(!force && seen(storedKey))return false;
    const current=$('.view.active');returnView=current?.id?.replace(/^view-/,'')||'dashboard';
    returnFocus=force?document.activeElement:null;
    active=true;root.hidden=false;
    document.body.classList.add('scd-tour-is-open');
    step=0;showStep(0);
    return true;
  }
  function finish(){
    if(!active)return;
    markSeen();active=false;root.hidden=true;
    document.body.classList.remove('scd-tour-is-open');
    mask.style.visibility='hidden';
    try{window.SCD_BRIDGE?.navigate(returnView,false)}catch{}
    if(returnFocus?.isConnected)try{returnFocus.focus({preventScroll:true})}catch{}
    else $('#menu-toggle')?.focus({preventScroll:true});
    returnFocus=null;
  }
  function ready(){
    setup();if(firstOpenPending)return;
    if(!isReady())return;
    firstOpenPending=true;
    // Defer one frame to allow other UI widgets to finish composing after the login gate.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{firstOpenPending=false;start(false)}));
  }
  window.SCD_TOUR={open:()=>start(true),close:finish,isOpen:()=>active};
  window.addEventListener('load',setup);
  window.addEventListener('scd-auth-ready',ready);
})();

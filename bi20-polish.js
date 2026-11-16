/* Será Que Devo? — Beta 2.0 | Apresentação, privacidade visual e resumos.
 * Não altera lançamentos ou estrutura do Supabase. Evita simular auditorias de segurança.
 */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const go=(view)=>{const b=window.SCD_BRIDGE;if(b?.user)b.navigate(view);};
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
let privateView=false;
function make(t,c,txt){const el=document.createElement(t);if(c)el.className=c;if(txt!==undefined)el.textContent=txt;return el}
function goTx(){go('transactions');const d=$('#transaction-form');if(d){const wrap=d.closest('details');if(wrap)wrap.open=true;d.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});d.querySelector('[name="amount"]')?.focus({preventScroll:true})}}
function init(){
 if(!$('#view-dashboard')||$('#scd-quick-actions'))return;
 // Shortcuts stay available even after collapsing the long sidebar.
 const actions=[['✍️','Novo lançamento','transactions',true],['🏦','Contas','bi-accounts'],['💳','Cartões','bi-cards'],['🧾','Dívidas','bi-debts'],['🎯','Sonhos','goals'],['🛒','Mercado','market']];
 const grid=make('div','scd-quick-actions');grid.id='scd-quick-actions';grid.setAttribute('aria-label','Atalhos do seu painel');
 for(const [icon,label,view,primary] of actions){const b=make('button','scd-action'+(primary?' primary':''));b.type='button';b.append(make('span','scd-glyph',icon),make('span','',label));b.addEventListener('click',()=>primary?goTx():go(view));grid.append(b)}
 const dashboard=$('#view-dashboard'),hero=dashboard.querySelector('.hero');hero?.after(grid);
 const help=make('button','icon-btn','?');help.type='button';help.title='Ajuda e perguntas frequentes';help.setAttribute('aria-label','Ajuda e perguntas frequentes');help.addEventListener('click',()=>go('bi-help'));
 const eye=make('button','icon-btn','◉');eye.type='button';eye.title='Ocultar valores financeiros';eye.setAttribute('aria-label','Ocultar valores financeiros');eye.setAttribute('aria-pressed','false');eye.addEventListener('click',()=>{privateView=!privateView;$('#app').classList.toggle('scd-private',privateView);eye.textContent=privateView?'◌':'◉';eye.setAttribute('aria-pressed',String(privateView));eye.setAttribute('aria-label',privateView?'Mostrar valores financeiros':'Ocultar valores financeiros');});
 const shield=make('button','icon-btn','♢');shield.type='button';shield.title='Informações de segurança da sessão';shield.setAttribute('aria-label','Informações de segurança da sessão');
 const utility=make('div','scd-utility');utility.append(eye,shield,help);$('.topright')?.prepend(utility);
 // No invented 'verified' claim: only observable browser/runtime facts.
 const dialog=make('dialog','scd-dialog');dialog.id='scd-security-dialog';dialog.innerHTML='<h2>♢ Segurança da sua sessão</h2><p id="scd-security-info"></p><p class="scd-data-note">Esta informação não é antivírus nem auditoria completa do Supabase. Consulte o suporte em caso de suspeita.</p><div class="scd-actions"><button type="button" class="btn ghost" id="scd-security-close">Fechar</button><button type="button" class="btn primary" id="scd-security-settings">Minha conta</button></div>';
 document.body.append(dialog);shield.addEventListener('click',()=>{$('#scd-security-info').textContent=(location.protocol==='https:'?'Conexão HTTPS ativa.':'Ambiente local de demonstração.')+' A autenticação e as permissões são fornecidas pelo Supabase. Esta tela não consegue examinar vírus nem provar ausência de acessos indevidos.';dialog.showModal()});dialog.querySelector('#scd-security-close').addEventListener('click',()=>dialog.close());dialog.querySelector('#scd-security-settings').addEventListener('click',()=>{dialog.close();go('profile')});
 const storyButton=make('button','btn ghost','✦ Resumo visual do mês');storyButton.type='button';storyButton.id='scd-monthly-story';storyButton.addEventListener('click',openStory);grid.after(storyButton);
 const modal=make('dialog','scd-dialog');modal.id='scd-story-dialog';modal.innerHTML='<h2>✦ Sua jornada do mês</h2><div id="scd-story-content" class="scd-story-screen" aria-live="polite"></div><div class="scd-story-controls"><button type="button" class="btn ghost" id="scd-story-back">Anterior</button><button type="button" class="btn primary" id="scd-story-next">Próximo</button><button type="button" class="btn ghost" id="scd-story-exit">Fechar</button></div>';
 document.body.append(modal);modal.querySelector('#scd-story-exit').addEventListener('click',()=>modal.close());modal.querySelector('#scd-story-back').addEventListener('click',()=>{storyIndex=Math.max(0,storyIndex-1);renderStory()});modal.querySelector('#scd-story-next').addEventListener('click',()=>{storyIndex=Math.min(storyScreens.length-1,storyIndex+1);renderStory()});
 // Prefer major destinations on the sidebar; secondary destinations stay in accessible groups.
 const side=$('#side-nav');if(side){
  const groups=[['Ferramentas e organização',['market','calendar','notes','goals','calculators','reports']],['Minhas finanças',['bi-accounts','bi-cards','bi-debts','bi-recurring']]];
  for(const [label,ids] of groups){const buttons=ids.map(id=>side.querySelector('button[data-view="'+id+'"]')).filter(Boolean);if(!buttons.length)continue;const box=make('details','scd-nav-group');const head=make('summary','',label+' ▾');box.append(head);for(const b of buttons)box.append(b);side.append(box)}
  const profile=side.querySelector('button[data-view="profile"]');if(profile)side.append(profile);
  const icons={dashboard:'🏠',transactions:'💸',market:'🛒',mimos:'💝',calendar:'📅',notes:'📝',goals:'🎯',calculators:'🧮',reports:'📊',profile:'⚙️','bi-accounts':'🏦','bi-cards':'💳','bi-debts':'🧾','bi-recurring':'🔁','bi-help':'🛟'};
  for(const btn of side.querySelectorAll('button[data-view]')){const glyph=btn.querySelector('span');if(glyph&&icons[btn.dataset.view]){glyph.textContent=icons[btn.dataset.view];glyph.setAttribute('aria-hidden','true');glyph.classList.add('scd-nav-glyph')}}

 }
 // Fixed primary action within thumb reach on small screens.
 const fab=make('button','scd-fab','+');fab.type='button';fab.setAttribute('aria-label','Novo lançamento');fab.addEventListener('click',goTx);document.body.append(fab);
 // Accessible export help; original PDF and CSV exporter remain unchanged.
 const exports=$('#view-reports .panel');if(exports)exports.insertAdjacentHTML('beforeend','<p class="scd-data-note">Os relatórios refletem os dados manuais e filtros selecionados. Confira os valores antes de tomar decisões. Guarde os arquivos em local privado.</p>');
 // Clear source attribution, no claim of a live banking connection.
 $('#view-dashboard .bi-panel')?.insertAdjacentHTML('beforeend','<p class="scd-data-note">BI pessoal autodeclarado • estimativas sujeitas a dados incompletos • nenhuma integração bancária.</p>');
}
let storyScreens=[],storyIndex=0;
function openStory(){const bridge=window.SCD_BRIDGE,state=bridge?.state;if(!bridge?.user||!state)return;const chosen=$('#dashboard-month')?.value||new Date().toISOString().slice(0,7);const rows=(state.transactions||[]).filter(t=>t.date?.startsWith(chosen));const paid=rows.filter(t=>t.status==='paid');const inc=paid.filter(t=>t.type==='income').reduce((a,t)=>a+Number(t.amount||0),0),out=paid.filter(t=>t.type==='expense').reduce((a,t)=>a+Number(t.amount||0),0);const pending=rows.filter(t=>t.status!=='paid'&&t.type==='expense').reduce((a,t)=>a+Number(t.amount||0),0);const goals=state.goals?.length||0;
 storyScreens=[['Seu mês em números',`${money(inc-out)} de resultado realizado`,'Baseado apenas nos lançamentos informados.'],['Entradas e saídas',`${money(inc)} entrou · ${money(out)} saiu`,'Valores realizados; obrigações pendentes são separadas.'],['Próximos compromissos',`${money(pending)} em saídas pendentes`,'Consulte as datas antes de assumir novos gastos.'],['Pequenos passos',`${goals} sonhos e metas cadastrados`,'Constância importa mais do que perfeição.']];storyIndex=0;renderStory();$('#scd-story-dialog').showModal();}
function renderStory(){const d=storyScreens[storyIndex];if(!d)return;const box=$('#scd-story-content');box.replaceChildren(make('span','scd-status',`${storyIndex+1} de ${storyScreens.length}`),make('h3','',d[0]),make('strong','',d[1]),make('p','',d[2]));$('#scd-story-back').disabled=storyIndex===0;$('#scd-story-next').disabled=storyIndex===storyScreens.length-1}
window.addEventListener('load',init);
})();

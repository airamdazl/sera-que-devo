/* Será Que Devo? Beta 2.0.4 — interface e integração dos lançamentos.
 * Não utiliza chaves privadas nem altera o esquema Supabase.
 * Compra no cartão cria UMA compra com parcelas na fatura; não é saída imediata da conta.
 */
(()=>{'use strict';
const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bridge=()=>window.SCD_BRIDGE;
const notify=(message,isError=false)=>bridge()?.toast?.(message,isError);
let accounts=[],cards=[],busy=false,lastRefresh=0;

/* Caixa de confirmação controlada pelo próprio aplicativo — não mostra o hostname do navegador. */
function buildDialog(){
 if($('#ux04-dialog'))return;
 const d=document.createElement('dialog');d.id='ux04-dialog';d.className='ux04-dialog';
 d.innerHTML='<form method="dialog" class="ux04-dialog-body"><div class="ux04-dialog-icon" aria-hidden="true">✦</div><h2 id="ux04-dialog-title">Confirmar ação</h2><p id="ux04-dialog-message"></p><div id="ux04-dialog-field"></div><div class="ux04-dialog-actions"><button value="cancel" type="submit" formnovalidate class="btn ghost">Cancelar</button><button id="ux04-dialog-accept" value="ok" type="submit" class="btn primary">Confirmar</button></div></form>';
 document.body.append(d);
}
function showDialog({title,message,kind='confirm',items=[],selected='',confirmLabel='Confirmar'}){
 buildDialog();const dialog=$('#ux04-dialog');if(dialog.open)dialog.close('cancel');
 $('#ux04-dialog-title').textContent=title;$('#ux04-dialog-message').textContent=message;
 $('#ux04-dialog-accept').textContent=confirmLabel;
 const field=$('#ux04-dialog-field');field.replaceChildren();
 let control;
 if(kind==='choice'){
  const label=document.createElement('label');label.textContent='Escolha uma opção';control=document.createElement('select');control.required=true;control.setAttribute('aria-label','Escolher opção');
  const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Selecione';control.append(placeholder);
  for(const opt of items){const node=document.createElement('option');node.value=String(opt.value);node.textContent=opt.label;control.append(node)}
  control.value=selected||'';label.append(control);field.append(label);
 } else if(kind==='text'){
  const label=document.createElement('label');label.textContent='Confirmação';control=document.createElement('input');control.type='text';control.autocomplete='off';control.required=true;control.placeholder='Digite aqui';label.append(control);field.append(label);
 }
 return new Promise(resolve=>{
  const onClose=()=>{dialog.removeEventListener('close',onClose);const value=dialog.returnValue;resolve(value==='ok'?(kind==='confirm'?true:(control?.value||'')):(kind==='confirm'?false:null))};
  dialog.addEventListener('close',onClose,{once:true});
  dialog.showModal();control?.focus();
 });
}
window.SCD_UI={
 confirm:(message,title='Confirmar ação')=>showDialog({title,message,confirmLabel:'Continuar'}),
 askText:(message,title='Confirmação')=>showDialog({title,message,kind:'text'}),
 choose:(message,items,selected='')=>showDialog({title:'Selecionar conta',message,kind:'choice',items,selected,confirmLabel:'Escolher'})
};

function installSidebar(){
 const nav=$('#side-nav');if(!nav)return;
 // Turn collapsible groups into persistent sections. No detail can be accidentally closed.
 for(const group of $$('.scd-nav-group',nav)){
  const heading=document.createElement('h3');heading.className='ux04-nav-title';heading.textContent=(group.querySelector('summary')?.textContent||'').replace(/\s*▾\s*$/,'');
  const section=document.createElement('section');section.className='scd-nav-group ux04-nav-permanent';section.setAttribute('aria-label',heading.textContent);
  section.append(heading,...$$('button[data-view]',group));group.replaceWith(section);
 }
 // The legacy Mimos category remains accessible without disturbing current records.
 const mimo=nav.querySelector('[data-view="mimos"]');if(mimo){mimo.hidden=false;const tools=$$('.ux04-nav-permanent',nav).find(el=>/Ferramentas/i.test(el.getAttribute('aria-label')||''));if(tools)tools.append(mimo)}
 const headings=$$('.ux04-nav-title',nav);
 for(const h of headings){if(/Ferramentas/i.test(h.textContent))h.textContent='Ferramentas e Organização';if(/Finan/i.test(h.textContent))h.textContent='Minhas Finanças'}
 nav.classList.add('ux04-nav-expanded');
}
function buildSummary(){
 const dash=$('#view-dashboard');if(!dash||$('#ux04-summary'))return;
 const hero=$('.hero',dash);const actions=$('.scd-quick-actions',dash);const story=$('#scd-monthly-story');const stats=$('.stats',dash);
 const analytics=$('.scd-analytics-grid',dash);const trend=$('#trend-chart')?.closest('article');const category=$('#category-donut')?.closest('article');
 const otherGrid=$$('#view-dashboard > .grid.two').find(el=>el!==analytics&&el.querySelector('#recent-items'));
 const recent=$('#recent-items')?.closest('article');const upcoming=$('#upcoming-items')?.closest('article');const goals=$('#dashboard-goals')?.closest('article');
 const bankPanel=$('#bi-bank-overview')?.closest('.bi-panel');const insightPanel=$('#bi-insights-mini')?.closest('.bi-panel');
 if(!hero||!stats||!category||!trend)return;
 hero.classList.add('ux04-hero-controls');
 const intro=hero.querySelector(':scope > div:first-child');
 // HOTFIX UX06: #hello continua necessario ao login; oculte sem destruir o no.
 if(intro){intro.hidden=true;intro.style.display='none';}
 const section=document.createElement('section');section.id='ux04-summary';section.className='ux04-summary';
 const heading=document.createElement('div');heading.className='ux04-section-heading';heading.innerHTML='<div><span class="eyebrow">SEU DINHEIRO EM UM SÓ LUGAR</span><h2>📊 Resumo Financeiro</h2></div><span class="ux04-summary-note">Dados informados por você</span>';
 section.append(heading,stats);
 // Unificar cinco indicadores existentes aos seis indicadores BI; preservar IDs e lógica de atualização.
 const emojis=['💰','💸','📊','⏳','🧮'];
 [...stats.querySelectorAll(':scope > .stat')].forEach((tile,i)=>{
  const text=tile.querySelector('span');if(text&&!text.dataset.ux07Emoji){text.textContent=emojis[i]+' '+text.textContent;text.dataset.ux07Emoji='1'}
 });
 if(insightPanel){
  const biGrid=insightPanel.querySelector('#bi-insights-mini');
  if(biGrid){biGrid.classList.add('ux07-bi-inline');stats.append(biGrid)}
  const estimate=insightPanel.querySelector('#bi-estimate-note');
  if(estimate){estimate.classList.add('ux07-estimate');section.append(estimate)}
  // Reutilizar texto institucional, sem duplicar o título "Resumo Financeiro".
  const disclaimer=[...insightPanel.querySelectorAll('p.fine')].find(el=>el.id!=='bi-estimate-note');
  if(disclaimer){disclaimer.classList.add('ux07-estimate');section.append(disclaimer)}
  insightPanel.remove();
 }
 const intel=document.createElement('section');intel.className='ux04-stage';intel.id='ux04-intelligence';intel.append(category);
 const compare=document.createElement('section');compare.className='ux04-stage';compare.id='ux04-comparison';compare.append(trend);
 const movements=document.createElement('section');movements.className='ux04-stage';movements.append(recent);
 const commitments=document.createElement('section');commitments.className='ux04-stage';commitments.append(upcoming);
 const dreams=document.createElement('section');dreams.className='ux04-stage';dreams.append(goals);
 if(analytics&&analytics.children.length===0)analytics.remove();if(otherGrid&&!otherGrid.children.length)otherGrid.remove();
 // Requested order: visual story, summary, intelligence, comparison, accounts, recent movements, commitments, goals.
 dash.append(hero);
 if(actions)dash.append(actions);if(story)dash.append(story);
 dash.append(section,intel,compare);
 if(bankPanel){bankPanel.classList.add('ux04-accounts-panel');dash.append(bankPanel)}
 dash.append(movements,commitments,dreams);
}
function enhancePandora(){const p=$('.scd-pandora-header');if(!p)return;p.classList.add('ux04-pandora');const name=$('.scd-pandora-heading strong',p);if(name)name.textContent='Pandora tá de olho';
 const img=$('.ux04-pandora-avatar',p);if(img){img.alt='Avatar da Pandora';img.loading='eager';}
 const hint=$('.scd-pandora-hint',p);if(hint)hint.textContent='Dicas baseadas nos seus lançamentos';
}

function installSourceSelector(){
 const form=$('#transaction-form');if(!form||$('#ux04-source'))return;
 const old=$('#bi-tx-account');if(!old)return;
 const wrap=old.closest('label');if(wrap)wrap.classList.add('ux04-original-source');
 const label=document.createElement('label');label.className='ux04-source-field';label.textContent='Origem / Destino do recurso';
 const select=document.createElement('select');select.id='ux04-source';select.setAttribute('aria-describedby','ux04-source-hint');select.required=false;
 label.append(select);const hint=document.createElement('small');hint.id='ux04-source-hint';hint.className='ux04-source-hint';hint.textContent='Escolha a conta usada. Compras no cartão vão para a fatura, sem débito bancário imediato.';label.append(hint);
 wrap.after(label);
 const type=form.elements.type;
 const typeLabel=type?.closest('label');
 if(typeLabel){
  typeLabel.classList.add('ux04-original-type');
  const types=document.createElement('div');types.className='ux04-quick-type';types.setAttribute('role','group');types.setAttribute('aria-label','Tipo do lançamento');
  types.innerHTML='<button type="button" data-ux04-type="expense" aria-pressed="true">↘ Saída</button><button type="button" data-ux04-type="income" aria-pressed="false">↗ Entrada</button>';
  typeLabel.before(types);
  types.addEventListener('click',ev=>{const button=ev.target.closest('button[data-ux04-type]');if(!button)return;type.value=button.dataset.ux04Type;type.dispatchEvent(new Event('change',{bubbles:true}));});
  type.addEventListener('change',()=>{for(const button of $$('[data-ux04-type]',types))button.setAttribute('aria-pressed',String(button.dataset.ux04Type===type.value))});
 }
 const installments=form.elements.installments,installmentLabel=installments?.closest('label');
 if(installmentLabel){
  const fast=document.createElement('div');fast.className='ux04-fast-installments';fast.setAttribute('role','group');fast.setAttribute('aria-label','Parcelamento rápido');
  fast.innerHTML='<span>Parcelas rápidas:</span>'+[1,2,3,6,10,12].map(n=>`<button type="button" data-ux04-installments="${n}" aria-pressed="${n===1}">${n}×</button>`).join('');
  installmentLabel.after(fast);
  fast.addEventListener('click',ev=>{const button=ev.target.closest('[data-ux04-installments]');if(!button)return;installments.value=button.dataset.ux04Installments;installments.dispatchEvent(new Event('input',{bubbles:true}));});
  installments.addEventListener('input',()=>{for(const btn of $$('[data-ux04-installments]',fast))btn.setAttribute('aria-pressed',String(btn.dataset.ux04Installments===installments.value))});
 }
 type?.addEventListener('change',()=>{refreshSources();syncSource();});
 select.addEventListener('change',syncSource);
 // Intercept credit card purchases before legacy and BI20 form listeners (capture on document).
 document.addEventListener('submit',ev=>{
  if(ev.target!==form||!select.value.startsWith('card:'))return;
  ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();saveCreditPurchase(form,select.value.slice(5));
 },true);
 refreshSources();
}
async function loadSources(force=false){
 const b=bridge();if(!b?.user?.id||!b.db)return;
 if(busy)return;if(!force&&Date.now()-lastRefresh<2500)return;
 busy=true;try{
  const uid=b.user.id;
  const [a,c]=await Promise.all([
   b.db.from('scd_accounts').select('id,name,institution,active').eq('user_id',uid),
   b.db.from('scd_cards').select('id,name,institution,active').eq('user_id',uid)
  ]);
  if(a.error)throw a.error;if(c.error)throw c.error;
  accounts=(a.data||[]).filter(x=>x.active!==false);cards=(c.data||[]).filter(x=>x.active!==false);lastRefresh=Date.now();refreshSources();
 }catch(error){notify(window.SCD_USER_ERROR?.(error)||'Não foi possível carregar contas e cartões.',true)}finally{busy=false}
}
function refreshSources(){
 const select=$('#ux04-source');const f=$('#transaction-form');if(!select||!f)return;
 const last=select.value,kind=f.elements.type?.value||'expense';
 const options=[];
 const empty=document.createElement('option');empty.value='';empty.textContent='Escolha uma conta ou cartão';options.push(empty);
 const makeGroup=(label,items,prefix,emoji)=>{const g=document.createElement('optgroup');g.label=label;for(const item of items){const o=document.createElement('option');o.value=prefix+item.id;o.textContent=`${emoji} ${item.name}${item.institution?' · '+item.institution:''}`;g.append(o)}if(items.length)options.push(g)};
 makeGroup('Contas e carteiras',accounts,'account:','🏦');if(kind==='expense')makeGroup('Cartões de crédito · faturas futuras',cards,'card:','💳');
 select.replaceChildren(...options);
 const old=$('#bi-tx-account')?.value;
 if([...select.options].some(o=>o.value===last))select.value=last;
 else if(old&&accounts.some(a=>a.id===old))select.value='account:'+old;
 else {try{const u=bridge()?.user?.id,save=u&&localStorage.getItem('scd-ux04-source-'+u);if(save&&[...select.options].some(o=>o.value===save))select.value=save}catch{}}
 syncSource();
}
function syncSource(){
 const select=$('#ux04-source');const f=$('#transaction-form');const old=$('#bi-tx-account');if(!select||!f||!old)return;
 const isCard=select.value.startsWith('card:');const account=select.value.startsWith('account:')?select.value.slice(8):'';
 old.value=account;old.dispatchEvent(new Event('change',{bubbles:false}));
 const status=f.elements.status?.closest('label');if(status)status.classList.toggle('ux04-credit-status',isCard);
 const hint=$('#ux04-source-hint');if(hint)hint.textContent=isCard?'Compra no crédito: o valor será dividido nas faturas. A conta bancária só é movimentada ao pagar a fatura.':'Pix, débito, dinheiro e receitas ajustam o saldo da conta quando marcados como realizados.';
 const interest=f.elements.interest?.closest('label');if(interest){interest.classList.remove('ux04-credit-interest');interest.querySelector('.ux07-interest-hint')?.remove();const hint=document.createElement('small');hint.className='ux07-interest-hint';hint.textContent=isCard?'Opcional · informe a porcentagem total de juros sobre a compra. Sem juros? Deixe 0.':'Opcional · porcentagem total de juros da compra.';interest.append(hint)}
 try{const uid=bridge()?.user?.id;if(uid&&select.value)localStorage.setItem('scd-ux04-source-'+uid,select.value)}catch{}
}
async function saveCreditPurchase(form,cardId){
 const b=bridge();if(!b?.user||!b.db){notify('Entre na sua conta para registrar.',true);return}
 if(form.elements.edit_id?.value){notify('A edição de uma compra antiga deve ser feita no histórico. Use Novo lançamento para registrar uma compra no crédito.',true);return}
 if(form.elements.type.value!=='expense'){notify('Cartão de crédito só pode ser usado para registrar despesas.',true);return}
 const amount=Number(form.elements.amount.value),n=Number(form.elements.installments.value);
 const rate=Number(form.elements.interest?.value||0);
 if(!Number.isFinite(rate)||rate<0||rate>300){notify('Informe juros entre 0% e 300%. Se não houver juros, deixe 0.',true);return}
 const totalCents=Math.round(Math.round(amount*100)*(1+rate/100));
 if(!Number.isFinite(amount)||amount<=0||!Number.isInteger(n)||n<1||n>60){notify('Confira o valor e escolha entre 1 e 60 parcelas.',true);return}
 if(!Number.isSafeInteger(totalCents)||totalCents<n){notify('O total com juros é inválido ou pequeno demais para essa quantidade de parcelas.',true);return}
 if(!form.elements.description.value.trim()||!form.elements.date.value){notify('Preencha descrição e data da compra.',true);return}
 const button=form.querySelector('button[type="submit"]');if(button?.disabled)return;button.disabled=true;
 try{
  const payload={user_id:b.user.id,card_id:cardId,description:form.elements.description.value.trim(),category:form.elements.category.value||'Compras',total:totalCents/100,installments:n,purchase_date:form.elements.date.value};
  const {error}=await b.db.from('scd_card_purchases').insert(payload);if(error)throw error;
  notify(`Compra registrada no cartão! ${n} ${n===1?'parcela':'parcelas'} com total de ${money(totalCents/100)}${rate>0?' (juros de '+rate+'% incluídos)':''}, sem débito imediato na conta.`);
  form.reset();form.elements.installments.value='1';form.elements.interest.value='0';
  await window.SCD_BI20?.fetchExtra?.();await b.fetchAll?.();
  refreshSources();
 }catch(error){notify(window.SCD_USER_ERROR?.(error)||'Não foi possível registrar a compra no cartão.',true)}finally{button.disabled=false}
}
function initialize(){buildDialog();installSidebar();enhancePandora();buildSummary();installSourceSelector();
 // Navigation / data loading are handled by the existing app; refresh visible options when entering the form.
 document.addEventListener('click',ev=>{if(ev.target.closest('[data-view="transactions"],[data-goto="transactions"],.scd-fab'))loadSources(true)});
 document.addEventListener('focusin',ev=>{if(ev.target?.id==='ux04-source')loadSources(false)});
 window.addEventListener('scd-auth-ready',()=>loadSources(true));window.addEventListener('scd-data-refreshed',()=>loadSources(false));
 if(bridge()?.user)loadSources(true);
 const p=new URLSearchParams(location.search);if(p.get('email_confirmed')==='1'){
  notify('E-mail confirmado! Entre com sua conta para continuar. ✨');p.delete('email_confirmed');const q=p.toString();history.replaceState(history.state,'',location.pathname+(q?'?'+q:'')+location.hash);
 }
}
window.addEventListener('load',initialize);
})();

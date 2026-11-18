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
 choose:(message,items,selected='',title='Escolher opção')=>showDialog({title,message,kind:'choice',items,selected,confirmLabel:'Escolher'})
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

/* ARQUIVO HISTÓRICO: implementação do seletor único UX04 — preservada.
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
FIM DO HISTÓRICO UX04 */
/* BETA 3.0 — LANÇAMENTOS CLAROS, MÍNIMA INTERVENÇÃO.
 * Forma (Pix/débito/etc.) != destino financeiro (conta/cartão).
 * Sem campo novo no banco: a forma é armazenada como anotação legível no campo note.
 * Cartão cadastrado usa EXCLUSIVAMENTE scd_card_purchases, nunca transactions.
 */
const UX_PAYMENT_METHODS={
 expense:[['pix','📱 Pix'],['debit','💳 Débito'],['money','💵 Dinheiro'],['credit','💳 Crédito'],['boleto','🧾 Boleto'],['transfer','🏦 Transferência'],['vr','🍽️ VR · Refeição'],['va','🛒 VA · Alimentação'],['other','✦ Outra forma']],
 income:[['pix','📱 Pix'],['transfer','🏦 Transferência'],['money','💵 Dinheiro'],['deposit','🏧 Depósito'],['benefit','🎫 Crédito em benefício'],['other','✦ Outra forma']]
};
const UX_METHOD_DESCRIPTIONS={
 pix:'Pix',debit:'Débito',money:'Dinheiro',credit:'Crédito (sem fatura vinculada)',boleto:'Boleto',transfer:'Transferência',vr:'VR',va:'VA',deposit:'Depósito',benefit:'Crédito de benefício',other:'Outra forma'
};
function uxPaymentIsBenefit(a){return a?.kind==='wallet'&&['VR','VA','Benefício'].includes(String(a.institution||''));}
function uxPaymentCleanNote(value){return String(value||'').replace(/^\[Forma: [^\]]{1,90}\]\s*/,'').trim();}
function uxPaymentExistingMethod(note){const match=String(note||'').match(/^\[Forma: ([^\]]+)\]/);if(!match)return null;return Object.keys(UX_METHOD_DESCRIPTIONS).find(x=>UX_METHOD_DESCRIPTIONS[x]===match[1])||'other';}
function uxPaymentTypeControls(){const f=$('#transaction-form'),group=$('.ux04-quick-type',f);if(!f||!group)return;
 for(const b of $$('[data-ux04-type]',group))b.setAttribute('aria-pressed',String(b.dataset.ux04Type===f.elements.type.value));
}
function uxPaymentMethodChoices(preferred=''){
 const f=$('#transaction-form'),method=$('#ux04-method');if(!f||!method)return;
 const allowed=UX_PAYMENT_METHODS[f.elements.type.value]||UX_PAYMENT_METHODS.expense;
 const choices=[new Option('Selecione a forma',''),...allowed.map(([value,label])=>new Option(label,value))];
 method.replaceChildren(...choices);
 if(preferred&&allowed.some(([v])=>v===preferred))method.value=preferred;
}
function installSourceSelector(){
 const form=$('#transaction-form');if(!form||$('#ux04-source'))return;
 const old=$('#bi-tx-account');if(!old)return;
 const wrap=old.closest('label');if(wrap)wrap.classList.add('ux04-original-source');
 const methodLabel=document.createElement('label');methodLabel.className='ux04-method-field';methodLabel.textContent='1. Como foi pago?';
 const method=document.createElement('select');method.id='ux04-method';method.setAttribute('aria-describedby','ux04-method-help');method.required=true;
 methodLabel.append(method);const methodHelp=document.createElement('small');methodHelp.id='ux04-method-help';methodHelp.textContent='Primeiro escolha Pix, dinheiro, cartão ou outra forma.';methodLabel.append(methodHelp);
 const label=document.createElement('label');label.className='ux04-source-field';label.hidden=true;label.textContent='2. Onde registrar?';
 const select=document.createElement('select');select.id='ux04-source';select.setAttribute('aria-describedby','ux04-source-hint');select.required=false;
 label.append(select);const hint=document.createElement('small');hint.id='ux04-source-hint';hint.className='ux04-source-hint';label.append(hint);
 const preview=document.createElement('div');preview.className='ux04-payment-preview';preview.id='ux04-payment-preview';preview.setAttribute('role','status');preview.setAttribute('aria-live','polite');
 const type=form.elements.type;const typeLabel=type?.closest('label');
 if(typeLabel){typeLabel.classList.add('ux04-original-type');const types=document.createElement('div');types.className='ux04-quick-type';types.setAttribute('role','group');types.setAttribute('aria-label','Tipo do lançamento');
  types.innerHTML='<button type="button" data-ux04-type="expense" aria-pressed="true">↘ Saída</button><button type="button" data-ux04-type="income" aria-pressed="false">↗ Entrada</button>';
  typeLabel.before(types);types.addEventListener('click',ev=>{const button=ev.target.closest('button[data-ux04-type]');if(!button)return;type.value=button.dataset.ux04Type;type.dispatchEvent(new Event('change',{bubbles:true}));});
 }
 wrap.after(methodLabel,label,preview);
 // Mais espaço para a decisão importante, menos para juros/parcelas opcionais.
 const installments=form.elements.installments,installmentLabel=installments?.closest('label'),interestLabel=form.elements.interest?.closest('label');
 if(installmentLabel&&interestLabel){
  const details=document.createElement('details');details.id='ux04-plan-details';details.className='ux04-plan-details';
  const summary=document.createElement('summary');summary.textContent='＋ Parcelamento e juros (opcional)';
  const content=document.createElement('div');content.className='ux04-plan-fields';details.append(summary,content);
  installmentLabel.before(details);content.append(installmentLabel);
  const fast=document.createElement('div');fast.className='ux04-fast-installments';fast.setAttribute('role','group');fast.setAttribute('aria-label','Parcelamento rápido');
  fast.innerHTML='<span>Parcelas rápidas:</span>'+[1,2,3,6,10,12].map(n=>`<button type="button" data-ux04-installments="${n}" aria-pressed="${n===1}">${n}×</button>`).join('');
  content.append(fast,interestLabel);
  fast.addEventListener('click',ev=>{const button=ev.target.closest('[data-ux04-installments]');if(!button)return;installments.value=button.dataset.ux04Installments;installments.dispatchEvent(new Event('input',{bubbles:true}));});
  installments.addEventListener('input',()=>{for(const b of $$('[data-ux04-installments]',fast))b.setAttribute('aria-pressed',String(b.dataset.ux04Installments===installments.value));});
 }
 type?.addEventListener('change',()=>{uxPaymentTypeControls();uxPaymentMethodChoices();if(type.value==='income'){form.elements.installments.value='1';form.elements.interest.value='0';form.elements.installments.dispatchEvent(new Event('input',{bubbles:true}));}refreshSources();});
 method.addEventListener('change',()=>{refreshSources();if(method.value==='credit'&&!select.value&&!form.elements.edit_id?.value){form.elements.status.value='pending';}});select.addEventListener('change',syncSource);
 // Importante: mesmo sem cartão/conta cadastrada, nunca bloquear um lançamento manual.
 // O fluxo de crédito COM cartão cadastrado não cria transação: cria compra na fatura.
 document.addEventListener('submit',ev=>{
  if(ev.target!==form)return;
  const value=method.value;const edit=!!form.elements.edit_id?.value;
  if(!value){ev.preventDefault();ev.stopImmediatePropagation();notify('Escolha como recebeu ou pagou: Pix, débito, dinheiro ou outra forma.',true);method.focus();return;}
  if(value==='benefit'&&!select.value){ev.preventDefault();ev.stopImmediatePropagation();notify('Para registrar crédito de benefício, selecione uma carteira VR/VA ou cadastre-a em Cartões e benefícios.',true);return;}
  if(value==='credit'&&select.value.startsWith('card:')){
   ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();saveCreditPurchase(form,select.value.slice(5));return;
  }
  const note=form.elements.note;const clean=uxPaymentCleanNote(note.value);
  const tag='[Forma: '+UX_METHOD_DESCRIPTIONS[value]+']';
  const stored=tag+(clean?' '+clean:'');
  if(stored.length>300){ev.preventDefault();ev.stopImmediatePropagation();notify('Observação muito longa. Reduza o texto para salvar a forma de pagamento.',true);return;}
  note.value=stored;
 },true);
 // Se um registro antigo for editado, sincronizar a interface com seu tipo real.
 document.addEventListener('click',ev=>{
  const edit=ev.target.closest('[data-action="edit"][data-table="transactions"]');const cancel=ev.target.closest('.cancel-edit[data-form="transaction-form"]');
  if(!edit&&!cancel)return;
  setTimeout(()=>{
   const f=$('#transaction-form');if(!f)return;const raw=f.elements.note?.value||'';
   const existing=uxPaymentExistingMethod(raw);if(existing)f.elements.note.value=uxPaymentCleanNote(raw);
   const account=f.elements.account_id?.value||'';
   uxPaymentTypeControls();uxPaymentMethodChoices(existing||(edit?'other':''));refreshSources();
   if(account&&[...select.options].some(x=>x.value==='account:'+account))select.value='account:'+account;
   if(edit){$('#ux04-plan-details').open=false;}
   syncSource();
  },0);
 },true);
 uxPaymentTypeControls();uxPaymentMethodChoices();refreshSources();
}
async function loadSources(force=false){
 const b=bridge();if(!b?.user?.id||!b.db)return;
 if(busy)return;if(!force&&Date.now()-lastRefresh<2500)return;
 busy=true;try{
  const uid=b.user.id;
  const [a,c]=await Promise.all([
   b.db.from('scd_accounts').select('id,name,institution,kind,active').eq('user_id',uid),
   b.db.from('scd_cards').select('id,name,institution,active').eq('user_id',uid)
  ]);
  if(a.error)throw a.error;if(c.error)throw c.error;
  accounts=(a.data||[]).filter(x=>x.active!==false);cards=(c.data||[]).filter(x=>x.active!==false);lastRefresh=Date.now();refreshSources();
 }catch(error){notify(window.SCD_USER_ERROR?.(error)||'Não foi possível carregar contas e cartões.',true)}finally{busy=false}
}
/* HISTÓRICO: seletor misto anterior preservado, não executado.
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
 if(account&&![...old.options].some(o=>o.value===account))old.append(new Option('',account));
 old.value=account;old.dispatchEvent(new Event('change',{bubbles:false}));
 const status=f.elements.status?.closest('label');if(status)status.classList.toggle('ux04-credit-status',isCard);
 const hint=$('#ux04-source-hint');if(hint)hint.textContent=isCard?'Compra no crédito: o valor será dividido nas faturas. A conta bancária só é movimentada ao pagar a fatura.':'Pix, débito, dinheiro e receitas ajustam o saldo da conta quando marcados como realizados.';
 const interest=f.elements.interest?.closest('label');if(interest){interest.classList.remove('ux04-credit-interest');interest.querySelector('.ux07-interest-hint')?.remove();const hint=document.createElement('small');hint.className='ux07-interest-hint';hint.textContent=isCard?'Opcional · informe a porcentagem total de juros sobre a compra. Sem juros? Deixe 0.':'Opcional · porcentagem total de juros da compra.';interest.append(hint)}
 try{const uid=bridge()?.user?.id;if(uid&&select.value)localStorage.setItem('scd-ux04-source-'+uid,select.value)}catch{}
}
FIM HISTÓRICO */
function refreshSources(){
 const select=$('#ux04-source'),f=$('#transaction-form'),method=$('#ux04-method');if(!select||!f||!method)return;
 const keep=select.value,choice=method.value,kind=f.elements.type.value;
 const label=$('.ux04-source-field',f),methodLabel=$('.ux04-method-field',f);
 if(methodLabel)methodLabel.firstChild.textContent=kind==='income'?'1. Como recebeu?':'1. Como pagou?';
 if(label)label.hidden=!choice;
 const preview=$('#ux04-payment-preview');if(!choice){select.replaceChildren(new Option('Escolha a forma primeiro',''));if(preview)preview.textContent='Escolha a forma de pagamento ou recebimento para continuar.';syncSource();return;}
 const list=[];
 if(choice==='credit'&&kind==='expense'){
  list.push(...cards.map(c=>({id:'card:'+c.id,label:'💳 '+c.name+(c.institution?' · '+c.institution:'')})));
 }else if(choice==='vr'||choice==='va'||choice==='benefit'){
  list.push(...accounts.filter(a=>uxPaymentIsBenefit(a)&&(choice==='benefit'||a.institution.toLowerCase()===choice)).map(a=>({id:'account:'+a.id,label:'🎫 '+a.name+' · '+a.institution})));
 }else if(choice==='money'){
  list.push(...accounts.filter(a=>!uxPaymentIsBenefit(a)&&(a.kind==='cash'||a.kind==='wallet')).map(a=>({id:'account:'+a.id,label:'💵 '+a.name})));
 }else{
  list.push(...accounts.filter(a=>!uxPaymentIsBenefit(a)).map(a=>({id:'account:'+a.id,label:'🏦 '+a.name+(a.institution?' · '+a.institution:'')})));
 }
 const empty=choice==='credit'?'Sem cartão cadastrado · não gera fatura':'Sem vincular · não altera saldo de conta';
 select.replaceChildren(new Option(empty,''),...list.map(x=>new Option(x.label,x.id)));
 if(keep&&list.some(x=>x.id===keep))select.value=keep;
 const sourceLabel=label?.childNodes[0];if(sourceLabel?.nodeType===Node.TEXT_NODE)sourceLabel.textContent=choice==='credit'?'2. Qual cartão de crédito?':(choice==='vr'||choice==='va'||choice==='benefit'?'2. Qual carteira de benefício?':kind==='income'?'2. Em qual conta entrou?':'2. De qual conta saiu?');
 syncSource();
}
function syncSource(){
 const select=$('#ux04-source'),f=$('#transaction-form'),old=$('#bi-tx-account'),method=$('#ux04-method');if(!select||!f||!old||!method)return;
 const value=method.value,kind=f.elements.type.value;
 const isCard=value==='credit'&&select.value.startsWith('card:');
 const account=select.value.startsWith('account:')?select.value.slice(8):'';
 if(account&&![...old.options].some(o=>o.value===account))old.append(new Option('',account));
 old.value=account; // Campo legado oculto, consumido pela função financeira original.
 const status=f.elements.status?.closest('label');if(status)status.classList.toggle('ux04-credit-status',isCard);
 const plans=$('#ux04-plan-details');if(plans)plans.hidden=kind==='income';
 const hint=$('#ux04-source-hint'),preview=$('#ux04-payment-preview');
 const withoutAccount=!select.value;
 const messages={
  pix:'Pix é a forma de transferência. A conta é o local onde o saldo será atualizado.',
  debit:'Débito desconta da conta vinculada quando o lançamento for realizado.',
  money:'Dinheiro pode ser registrado sem conta ou vinculado a uma carteira de dinheiro.',
  credit:isCard?'A compra entra na fatura do cartão, sem débito bancário imediato. Não cria lançamento duplicado.':'Sem cartão cadastrado: registro manual pendente, sem geração de fatura ou limite. Marque como pago somente quando quitar.',
  vr:'VR é benefício de refeição. Não é cartão de crédito nem dinheiro livre.',
  va:'VA é benefício de alimentação. Não entra no saldo livre das contas.',
  benefit:'Crédito de benefício fica separado do saldo bancário geral.',
  transfer:'Transferência externa informada manualmente. Entre duas contas SUAS, use Transferir em Contas para não contar receita ou despesa.',
  other:'Registre como outra forma, com ou sem conta vinculada.',
  boleto:'Boleto pago pode ser vinculado à conta de onde saiu o valor.',
  deposit:'Depósito pode ser vinculado à conta que recebeu o dinheiro.'
 };
 if(hint)hint.textContent=value?messages[value]||'': 'Escolha primeiro a forma de recebimento ou pagamento.';
 if(preview)preview.textContent=!value?'Escolha como recebeu ou pagou para continuar.':isCard?'💳 Vai para a fatura do cartão selecionado; o saldo bancário só muda ao pagar a fatura.':value==='credit'&&withoutAccount?'⚠ Crédito sem cartão cadastrado: lança manualmente como pendente, mas não cria fatura. Confirme o pagamento depois.':value==='benefit'&&withoutAccount?'⚠ Cadastre uma carteira de benefício antes de registrar um crédito VR/VA.':withoutAccount?'✦ Sem vínculo: o valor entra no histórico geral, mas não muda o saldo de uma conta específica.':'✓ Conta vinculada: o valor realizado será considerado no saldo dessa conta.';
 const button=f.querySelector('button[type="submit"]');if(button)button.textContent=isCard?'Registrar compra no cartão':'Salvar lançamento';
 if(!isCard){const interest=f.elements.interest?.closest('label');const h=interest?.querySelector('.ux07-interest-hint');if(h)h.textContent='Opcional · percentual total de juros sobre o valor informado.';}
 try{const u=bridge()?.user?.id;if(u&&value)localStorage.setItem('scd-ux04-method-'+u,value)}catch{}
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

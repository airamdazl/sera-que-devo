/* SCD BI 2.0 - módulo complementar. Não contém chaves privadas. */
(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const day=()=>{const x=new Date();return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};
const B=()=>window.SCD_BRIDGE;
const db=()=>B()?.db, uid=()=>B()?.user?.id;
const info=(msg,err=false)=>{if(B()?.toast)B().toast(msg,err);else console.warn('[Será Que Devo?]',String(msg).slice(0,150))};
const store={accounts:[],transfers:[],debts:[],cards:[],card_purchases:[],card_installments:[],card_payments:[],cash_movements:[],recurring_rules:[],market_purchases:[],market_purchase_items:[],tickets:[],preferences:[]};
const names={accounts:'scd_accounts',transfers:'scd_transfers',debts:'scd_debts',cards:'scd_cards',card_purchases:'scd_card_purchases',card_installments:'scd_card_installments',card_payments:'scd_card_payments',cash_movements:'scd_cash_movements',recurring_rules:'scd_recurring_rules',market_purchases:'scd_market_purchases',market_purchase_items:'scd_market_purchase_items',tickets:'scd_tickets',preferences:'scd_preferences'};
let ready=false,loadVersion=0,mode='normal';
function optionalChangeStatus(){return mode==='maintenance'}
async function fetchExtra(){
 if(!uid()||!db())return;
 const v=++loadVersion;
 const results=await Promise.allSettled(Object.entries(names).map(async([key,table])=>{
  const {data,error}=await db().from(table).select('*').eq('user_id',uid()).limit(2000);
  if(error)throw error;return [key,data||[]];
 }));
 if(v!==loadVersion)return;
 const failures=[];
 results.forEach((x,i)=>{if(x.status==='fulfilled')store[x.value[0]]=x.value[1];else failures.push(Object.keys(names)[i])});
 const warning=$('#bi-modules-warning');if(warning){warning.hidden=!failures.length;warning.textContent=failures.length?'Módulos ainda não habilitados no banco: '+failures.join(', ')+'. Consulte o SQL versionado antes de usar.':''}
 renderExtras();renderAccountDropdowns();
}
async function updateMaint(){try{
 const {data,error}=await db().rpc('scd_maintenance_status');if(error)throw error;
 const s=Array.isArray(data)?data[0]:data;
 mode=s?.mode||'normal';
 const el=$('#bi-maint-status');if(el){el.hidden=mode==='normal';el.textContent=(mode==='scheduled'?'Manutenção programada: ':'Atualização em andamento: ')+(s.message||'Verifique o aviso de atualização.');}
 $('#bi-main-maint-overlay').hidden=mode!=='maintenance';
}catch{mode='normal'}}
async function action(promise,success){if(optionalChangeStatus()){info('O app está em manutenção. Tente novamente depois.',true);return false}
 try{const res=await promise();if(res?.error)throw res.error;info(success||'Salvo!');await fetchExtra();await B()?.fetchAll();return true}
 catch(e){console.warn('[SCD BI20] Erro na ação:',e?.code||'sem código');info(window.SCD_USER_ERROR?.(e)||'Não foi possível concluir. Confira a conexão e tente novamente.',true);return false}}
function inputAccount(name='account_id',includeEmpty=true){return `<select name="${name}" ${includeEmpty?'':'required'}>${includeEmpty?'<option value="">Outra forma / sem conta cadastrada</option>':''}${store.accounts.filter(a=>a.active).map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select>`}
function balances(){let data={};for(const a of store.accounts)data[a.id]=Number(a.opening_balance)||0;
 for(const t of B()?.state?.transactions||[]){if(!t.account_id||t.status!=='paid'||!(t.account_id in data))continue;
 const a=store.accounts.find(x=>x.id===t.account_id);if(t.date<(a?.opening_date||'0000')||t.date>day())continue;
 data[t.account_id]+=(t.type==='income'?1:-1)*Number(t.amount||0);
 }
 for(const t of store.transfers){if(t.date>day())continue;if(t.source_account_id in data)data[t.source_account_id]-=Number(t.amount);if(t.destination_account_id in data)data[t.destination_account_id]+=Number(t.amount)}
 for(const t of store.cash_movements)if(t.movement_date<=day()&&t.account_id in data)data[t.account_id]+=Number(t.amount);
 return data}
function optionList(items,field='name'){return items.map(a=>`<option value="${esc(a.id)}">${esc(a[field])}</option>`).join('')}
function bankIcon(a){const n=String(a.institution||'').toLocaleLowerCase('pt-BR');return n.includes('nubank')?'💜':n.includes('itaú')||n.includes('itau')?'🟧':n.includes('santander')?'🔴':n.includes('inter')?'🟠':n.includes('caixa')?'🔵':n.includes('bradesco')?'🔴':a.kind==='cash'?'💵':a.kind==='wallet'?'👛':'🏦'}
// Beta 3.0: saldos de VR/VA são recursos de uso restrito; não são dinheiro livre nem cartões de crédito.
function isBenefitWallet(a){return a?.kind==='wallet' && ['VR','VA','Benefício'].includes(String(a.institution||''));}
function benefitLabel(a){return a.institution==='VR'?'🍽️ VR (refeição)':a.institution==='VA'?'🛒 VA (alimentação)':'🎫 Outro benefício';}
function renderBenefits(){const box=$('#bi-benefits-list');if(!box)return;const accounts=store.accounts.filter(isBenefitWallet),values=balances();box.innerHTML=accounts.length?accounts.map(a=>`<article class="bi-item"><div><strong>${benefitLabel(a)} · ${esc(a.name)}</strong><small>Saldo informado · ${a.active?'ativo':'arquivado'} · uso conforme regras do benefício</small></div><b>${money(values[a.id])}</b></article>`).join(''):'<p class="muted">Nenhum VR, VA ou outro benefício cadastrado ainda.</p>';}
function remember(kind,value){try{if(uid()&&value)localStorage.setItem(`scd_bi20_last_${kind}_${uid()}`,value)}catch{}}
function remembered(kind){try{return uid()?localStorage.getItem(`scd_bi20_last_${kind}_${uid()}`)||'':''}catch{return ''}}
function fillOptions(n,items,empty='Selecionar'){if(!n)return;const previous=n.value||remembered(n.name==='card_id'?'card':'account');n.innerHTML=`<option value="">${esc(empty)}</option>`+optionList(items);if(items.some(x=>x.id===previous))n.value=previous;else if(items.length===1)n.value=items[0].id;}
function renderAccounts(){const box=$('#bi-accounts-list');if(!box)return;const vals=balances();box.innerHTML=store.accounts.length?store.accounts.map(a=>`<article class="bi-item bi-bank-card"><div><strong>${bankIcon(a)} ${esc(a.name)}</strong><small>${esc(a.institution||a.kind)} · ${a.active?'Ativa':'Arquivada'}</small><small>Saldo inicial: ${money(a.opening_balance)} em ${esc(a.opening_date)}</small></div><b>${money(vals[a.id])}</b><button type="button" class="btn ghost bi-reconcile-shortcut" data-account="${esc(a.id)}">⚖️ Conciliar</button></article>`).join(''):'<p class="muted">Cadastre sua primeira conta para vincular Pix, dinheiro, débito e receitas.</p>';
 const summary=$('#bi-accounts-summary');if(summary)summary.textContent=money(store.accounts.filter(a=>!isBenefitWallet(a)).reduce((sum,a)=>sum+Number(vals[a.id]||0),0));
 const overview=$('#bi-bank-overview');if(overview)overview.innerHTML=store.accounts.filter(a=>a.active&&!isBenefitWallet(a)).slice(0,8).map(a=>`<article class="bi-bank-mini"><span>${bankIcon(a)} ${esc(a.name)}</span><strong>${money(vals[a.id])}</strong></article>`).join('')||'<p class="fine">Cadastre uma conta para visualizar seu saldo por banco.</p>';
 fillOptions($('#bi-account-select'),store.accounts.filter(x=>x.active),'Outra forma / sem conta cadastrada');
 const tx=$('#bi-tx-account');fillOptions(tx,store.accounts.filter(x=>x.active),'Outra forma / sem conta cadastrada');
 fillOptions($('#bi-reconcile-account'),store.accounts.filter(x=>x.active),'Selecionar conta');
 fillOptions($('#bi-card-form [name="payment_account_id"]'),store.accounts.filter(x=>x.active&&!isBenefitWallet(x)),'Selecionar conta de pagamento');
}
function renderDebts(){const box=$('#bi-debts-list');if(!box)return;box.innerHTML=store.debts.length?store.debts.map(d=>`<article class="bi-item"><div><strong>${esc(d.creditor)}</strong><small>${esc(d.status)} · ${d.updated_amount_at?'Atualização: '+esc(d.updated_amount_at):'Valor não atualizado'}</small></div><b>${d.current_amount===null?'Valor desconhecido':money(d.current_amount)}</b></article>`).join(''):'<p class="muted">Sem pendências cadastradas. Registre somente o que quiser acompanhar.</p>';
 $('#bi-debts-total').textContent=money(store.debts.reduce((s,d)=>s+Number(d.current_amount||0),0));
 $('#bi-debt-pay-select').innerHTML='<option value="">Escolha a dívida</option>'+store.debts.filter(d=>d.status!=='paid'&&d.current_amount!==null).map(d=>`<option value="${esc(d.id)}">${esc(d.creditor)} · ${money(d.current_amount)}</option>`).join('');
}
function monthLabel(ym){const [y,m]=String(ym).slice(0,7).split('-');return `${m}/${y}`;}
function cardInvoiceRows(cardId){const invoices=new Map();for(const i of store.card_installments.filter(x=>x.card_id===cardId)){const k=String(i.invoice_month).slice(0,7),entry=invoices.get(k)||{month:k,due_on:i.due_on,total:0,lines:[]};entry.total+=Number(i.amount)||0;entry.lines.push(i);invoices.set(k,entry)}for(const p of store.card_payments.filter(x=>x.card_id===cardId)){const k=String(p.invoice_month||'').slice(0,7);if(!invoices.has(k))continue;const entry=invoices.get(k);entry.paid=(entry.paid||0)+Number(p.amount||0)}return [...invoices.values()].sort((a,b)=>a.month.localeCompare(b.month));}
function renderCards(){const box=$('#bi-cards-list');if(!box)return;box.innerHTML=store.cards.length?store.cards.map(c=>{const inv=cardInvoiceRows(c.id);const due=inv.reduce((n,i)=>n+Math.max(0,i.total-(i.paid||0)),0);const acct=store.accounts.find(a=>a.id===c.payment_account_id);const invoices=inv.map(v=>`<details class="bi-invoice"><summary>📅 ${monthLabel(v.month)} · vence ${esc(v.due_on)} <strong>${money(Math.max(0,v.total-(v.paid||0)))}</strong></summary><p class="fine">Fatura ${money(v.total)} · pago ${money(v.paid||0)}</p><ul>${v.lines.map(i=>{const pur=store.card_purchases.find(p=>p.id===i.purchase_id);return `<li>${esc(pur?.description||'Compra')} — ${i.installment_index}/${i.installment_count} — ${money(i.amount)}</li>`}).join('')}</ul></details>`).join('');return `<article class="bi-card-summary"><div class="bi-item"><div><strong>💳 ${esc(c.name)}</strong><small>${esc(c.institution||'Cartão')} · fecha dia ${c.closing_day} · vence dia ${c.due_day}</small><small>Pagamento sugerido: ${esc(acct?.name||'Conta a escolher')} · limite informado ${money(c.credit_limit)}</small></div><b>Pendente ${money(due)}</b></div><div class="bi-invoices">${invoices||'<p class="fine">Nenhuma parcela cadastrada.</p>'}</div></article>`}).join(''):'<p class="muted">Cadastre cartões para acompanhar cada parcela na fatura correta, sem alterar o saldo das contas antes de pagar.</p>';
 for(const id of ['#bi-card-purchase-select','#bi-card-pay-select'])fillOptions($(id),store.cards.filter(c=>c.active),'Selecionar cartão');
 const duePanel=$('#bi-upcoming-invoices');if(duePanel){const future=store.cards.flatMap(c=>cardInvoiceRows(c.id).map(i=>({...i,card:c.name}))).filter(i=>i.total-(i.paid||0)>0).sort((a,b)=>a.due_on.localeCompare(b.due_on)).slice(0,8);duePanel.innerHTML=future.length?future.map(i=>`<article class="bi-mini-invoice"><span>💳 ${esc(i.card)} · ${monthLabel(i.month)} <small>Vence ${esc(i.due_on)}</small></span><b>${money(i.total-(i.paid||0))}</b></article>`).join(''):'<p class="fine">Nenhuma fatura pendente cadastrada.</p>';}
 updateInvoicesSelector();const picked=store.cards.find(c=>c.id===$('#bi-card-pay-select')?.value);const acc=$('#bi-card-pay-form [name="account_id"]');if(picked?.payment_account_id&&acc)acc.value=picked.payment_account_id;
}
function updateInvoicesSelector(){const select=$('#bi-card-pay-form [name="invoice_month"]');if(!select)return;const card=$('#bi-card-pay-select')?.value;const prev=select.value;select.innerHTML='<option value="">Selecionar fatura</option>'+cardInvoiceRows(card).filter(x=>x.total-(x.paid||0)>0.005).map(x=>`<option value="${esc(x.month)}-01">${monthLabel(x.month)} · a pagar ${money(x.total-(x.paid||0))}</option>`).join('');if([...select.options].some(o=>o.value===prev))select.value=prev;}
function renderRecurring(){const box=$('#bi-recurring-list');if(!box)return;box.innerHTML=store.recurring_rules.length?store.recurring_rules.map(r=>`<article class="bi-item"><div><strong>${esc(r.description)}</strong><small>Todo dia ${r.day_of_month} · ${r.active?'Ativa':'Pausada'}</small></div><b>${money(r.amount)}</b><button class="btn ghost bi-gen" type="button" data-rule="${esc(r.id)}">Gerar 3 vencimentos</button></article>`).join(''):'<p class="muted">Cadastre seus pagamentos e recebimentos mensais.</p>'}
async function renderMarketHistory(){const box=$('#bi-market-history');if(!box)return;let html='';for(const x of store.market_purchases.slice().sort((a,b)=>String(b.purchase_date).localeCompare(a.purchase_date))){const lines=store.market_purchase_items.filter(i=>i.purchase_id===x.id);
 html+=`<details class="bi-item"><summary><strong>🛒 ${esc(x.purchase_date)} · ${esc(x.store||'Mercado')}</strong><b>${money(x.total)}</b></summary><ul>${lines.map(i=>`<li>${esc(i.name)} — ${sqdMarketQty(i.quantity)} ${esc(i.unit||'un')} × ${money(i.unit_price)}</li>`).join('')||'<li>Compra sem detalhamento disponível.</li>'}</ul></details>`;}
 box.innerHTML=html||'<p class="muted">As próximas compras ficarão registradas aqui, com todos os produtos.</p>';
}
/* UX09 Mercado: relatório exclusivo do histórico registrado. Sem tocar em lista ativa ou transações. */
let sqdMarketHistoryOwner=null;
let sqdMarketReceipts=[];
let sqdMarketReceiptLines=[];
const sqdMarketAmount=value=>Number(value)||0;
const sqdMarketDate=iso=>/^\d{4}-\d{2}-\d{2}$/.test(String(iso||''))?String(iso).split('-').reverse().join('/'):'Data não informada';
const sqdMarketQty=value=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(sqdMarketAmount(value));
async function sqdMarketPagedRead(table,owner){
 const all=[];
 for(let offset=0;offset<10000;offset+=500){
  const {data,error}=await db().from(table).select('*').eq('user_id',owner).order('id',{ascending:true}).range(offset,offset+499);
  if(error)throw error;
  const batch=data||[];all.push(...batch);
  if(batch.length<500)return all;
 }
 throw Error('Seu histórico é grande demais para esta exportação. Entre em contato com o suporte para exportação completa.');
}
function sqdMarketSearchText(value){
 return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
}
function sqdMarketFilteredReceipts(){
 const f=$('#sqd-market-pdf-filters');if(!f)return [];
 const from=f.elements.start_date.value,to=f.elements.end_date.value,storeName=f.elements.store.value;
 const category=f.elements.category.value,product=sqdMarketSearchText(f.elements.product.value);
 if(from&&to&&from>to)throw Error('A data inicial precisa ser anterior ou igual à data final.');
 return sqdMarketReceipts.filter(p=>{
  const d=String(p.purchase_date||'');
  const purchaseItems=sqdMarketReceiptLines.filter(i=>String(i.purchase_id)===String(p.id));
  const itemMatch=!category&&!product||purchaseItems.some(i=>(!category||String(i.category||'')===category)&&(!product||sqdMarketSearchText(i.name).includes(product)));
  return (!from||d>=from)&&(!to||d<=to)&&(!storeName||(storeName==='__SEM_NOME__'?!String(p.store||'').trim():String(p.store||'').trim()===storeName))&&itemMatch;
 }).sort((a,b)=>String(b.purchase_date).localeCompare(String(a.purchase_date))||String(a.id).localeCompare(String(b.id)));
}
function sqdMarketPdfStats(){
 const out=$('#sqd-market-pdf-result');if(!out)return;
 try{const rows=sqdMarketFilteredReceipts();const value=rows.reduce((n,x)=>n+sqdMarketAmount(x.total),0);
  out.textContent=rows.length?`${rows.length} compra(s) encontrada(s) · Total integral das compras: ${money(value)}. Cada compra será exibida com todos os itens.`:'Nenhuma compra encontrada. Revise o período, mercado, categoria ou produto.';
  for(const btn of $$('#sqd-market-pdf-download,#sqd-market-xlsx-download'))btn.disabled=!rows.length;
 }catch(e){out.textContent=e.message;for(const btn of $$('#sqd-market-pdf-download,#sqd-market-xlsx-download'))btn.disabled=true;}
}
let sqdMarketExportType='pdf';
async function sqdMarketOpenPdf(type='pdf'){
 sqdMarketExportType=(type==='xlsx'||type==='csv')?'xlsx':'pdf';
 const modal=$('#sqd-market-pdf-dialog');if(!modal)return info('Filtros do relatório indisponíveis. Reabra o aplicativo.',true);
 if(!uid())return info('Entre na sua conta para exportar o histórico.',true);
 const form=$('#sqd-market-pdf-filters');form.reset();
 sqdMarketPreset('all');
 for(const btn of $$('#sqd-market-pdf-download,#sqd-market-xlsx-download'))btn.disabled=true;
 const status=$('#sqd-market-pdf-result');if(status)status.textContent='Consultando suas compras registradas…';
 if(!modal.open){if(typeof modal.showModal==='function')modal.showModal();else modal.setAttribute('open','');}
 const owner=uid();sqdMarketHistoryOwner=null;sqdMarketReceipts=[];sqdMarketReceiptLines=[];
 try{
  const [purchases,lines]=await Promise.all([
   sqdMarketPagedRead('scd_market_purchases',owner),
   sqdMarketPagedRead('scd_market_purchase_items',owner)
  ]);
  if(owner!==uid())throw Error('Sua sessão mudou. Entre novamente para exportar.');
  sqdMarketHistoryOwner=owner;sqdMarketReceipts=purchases;sqdMarketReceiptLines=lines;
  const stores=[...new Set(purchases.map(p=>String(p.store||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const select=form.elements.store;
  select.replaceChildren(new Option('Todos os estabelecimentos',''),new Option('Sem nome informado (compras antigas)','__SEM_NOME__'),...stores.map(x=>new Option(x,x)));
  const categories=[...new Set(lines.map(i=>String(i.category||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  form.elements.category.replaceChildren(new Option('Todas as categorias',''),...categories.map(x=>new Option(x,x)));
  $('#sqd-market-pdf-format').textContent=sqdMarketExportType==='xlsx'?'Exportação de histórico · Excel (.xlsx)':'Exportação de histórico · PDF';
  sqdMarketPdfStats();
 }catch(e){sqdMarketHistoryOwner=null;sqdMarketReceipts=[];sqdMarketReceiptLines=[];if(status)status.textContent='Não foi possível consultar o histórico de compras. Verifique a conexão e tente novamente.';
  info(window.SCD_USER_ERROR?.(e)||'Falha ao consultar o histórico de compras.',true);
 }
}
function sqdMarketPreset(preset){
 const f=$('#sqd-market-pdf-filters');if(!f)return;
 const today=day();const date=new Date(today+'T12:00:00');let start='',end='';
 if(preset==='month'){start=today.slice(0,7)+'-01';end=today;}
 if(preset==='30d'){date.setDate(date.getDate()-29);start=dayFromDate(date);end=today;}
 if(preset==='today'){start=today;end=today;}
 if(preset!=='custom'){f.elements.start_date.value=start;f.elements.end_date.value=end;}
 f.dataset.preset=preset;
 for(const b of $$('#sqd-market-pdf-dialog [data-market-preset]'))b.setAttribute('aria-pressed',String(b.dataset.marketPreset===preset));
 $('#sqd-market-custom-dates').hidden=preset!=='custom';
 sqdMarketPdfStats();
}
function dayFromDate(dt){return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`}
/* Histórico Beta 3.0: versão CSV mantida para referência, sem execução pela interface.
function sqdMarketDownloadCsv(){
 if(!uid()||uid()!==sqdMarketHistoryOwner)return info('Sua sessão mudou. Consulte o histórico novamente.',true);
 try{
  const receipts=sqdMarketFilteredReceipts();if(!receipts.length)return info('Nenhuma compra corresponde aos filtros.',true);
  const columns=['Data','Estabelecimento','Produto','Categoria','Quantidade','Unidade','Preço unitário (R$)','Subtotal (R$)','Total da compra (R$)','ID da compra'];
  const fmtDec=v=>Number(v||0).toFixed(2).replace('.',',');const quoted=value=>'"'+String(value??'').replace(/"/g,'""').replace(/[\r\n]/g,' ').replace(/^[=+@-]/,x=>'\''+x)+'"';
  const result=[columns];
  for(const purchase of receipts){const items=sqdMarketReceiptLines.filter(x=>String(x.purchase_id)===String(purchase.id));
   if(!items.length)result.push([purchase.purchase_date,purchase.store||'Não informado','Sem detalhamento','','','','','',fmtDec(purchase.total),purchase.id]);
   else for(const item of items)result.push([purchase.purchase_date,purchase.store||'Não informado',item.name,item.category||'',item.quantity,item.unit||'un',fmtDec(item.unit_price),fmtDec(item.line_total??Number(item.quantity)*Number(item.unit_price)),fmtDec(purchase.total),purchase.id]);
  }
  const content='\ufeff'+result.map(row=>row.map(quoted).join(';')).join('\r\n');
  const blob=new Blob([content],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='sera-que-devo-historico-mercado-'+day()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  $('#sqd-market-pdf-dialog')?.close();info('CSV de compras finalizadas gerado.');
 }catch(e){info(e.message||'Não foi possível exportar o CSV.',true)}
}
*/
function sqdMarketDownloadExcel(){
 if(!uid()||uid()!==sqdMarketHistoryOwner)return info('Sua sessão mudou. Consulte o histórico novamente.',true);
 try{
  if(!window.SCD_EXCEL?.saveWorkbook)throw Error('Exportação Excel indisponível. Reabra o aplicativo e tente novamente.');
  const receipts=sqdMarketFilteredReceipts();
  if(!receipts.length)return info('Nenhuma compra corresponde aos filtros.',true);
  const rows=[];
  for(const purchase of receipts){
   const items=sqdMarketReceiptLines.filter(x=>String(x.purchase_id)===String(purchase.id));
   if(!items.length)rows.push([purchase.purchase_date,purchase.store||'Não informado','Sem detalhamento','','','','','',Number(purchase.total)||0,String(purchase.id)]);
   else for(const item of items)rows.push([
    purchase.purchase_date,purchase.store||'Não informado',item.name,item.category||'',
    Number(item.quantity)||0,item.unit||'un',Number(item.unit_price)||0,
    Number(item.line_total??Number(item.quantity)*Number(item.unit_price))||0,
    Number(purchase.total)||0,String(purchase.id)
   ]);
  }
  window.SCD_EXCEL.saveWorkbook('sera-que-devo-historico-mercado-'+day()+'.xlsx',[{
   name:'Histórico do Mercado',
   headers:['Data','Estabelecimento','Produto','Categoria','Quantidade','Unidade','Preço unitário (R$)','Subtotal (R$)','Total da compra (R$)','ID da compra'],
   rows,dateColumns:[0],currencyColumns:[6,7,8],widths:[17,35,43,22,16,16,21,20,23,40]
  }]);
  $('#sqd-market-pdf-dialog')?.close();info('Planilha Excel de compras finalizadas gerada.');
 }catch(e){info(e.message||'Não foi possível exportar o Excel.',true)}
}

function sqdMarketCreatePdf(receipts){
 if(!window.jspdf?.jsPDF)throw Error('Biblioteca PDF indisponível. Verifique a conexão e recarregue o aplicativo.');
 const doc=new window.jspdf.jsPDF({unit:'mm',format:'a4',compress:true});
 const left=15,width=180,footerY=288;let y=15;
 const navy=[24,31,52],purple=[180,93,223],cyan=[66,196,218],muted=[100,107,123];
 const safe=str=>String(str??'').replace(/\s+/g,' ').trim();
 const text=(str,x,yy,opts)=>doc.text(safe(str),x,yy,opts);
 const fill=(r,g,b)=>doc.setFillColor(r,g,b);
 const newPage=()=>{doc.addPage();y=20;doc.setFont('helvetica','normal');doc.setTextColor(...navy);doc.setFontSize(10);text('SERÁ QUE DEVO? · CONTINUAÇÃO DO HISTÓRICO',left,y);y+=12;};
 const ensure=need=>{if(y+need>footerY-14)newPage()};
 fill(...navy);doc.rect(0,0,210,38,'F');fill(...purple);doc.rect(0,38,105,2,'F');fill(...cyan);doc.rect(105,38,105,2,'F');
 doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(19);text('Será Que Devo?',15,17);
 doc.setFontSize(11);doc.setFont('helvetica','normal');text('RELATÓRIO DE COMPRAS REGISTRADAS',15,28);
 y=49;doc.setTextColor(...navy);doc.setFontSize(9);
 const f=$('#sqd-market-pdf-filters');const dt1=f?.elements.start_date.value||'',dt2=f?.elements.end_date.value||'',storeName=f?.elements.store.value||'';
 const period=dt1||dt2?`${dt1?sqdMarketDate(dt1):'Início'} a ${dt2?sqdMarketDate(dt2):'Hoje'}`:'Todas as datas';
 text(`Período: ${period}`,left,y);y+=6;
 const storeLines=doc.splitTextToSize(`Estabelecimento: ${storeName==='__SEM_NOME__'?'Sem nome informado':storeName||'Todos'}`,width);doc.text(storeLines,left,y);y+=storeLines.length*5+2;
 const criteria=doc.splitTextToSize(`Categoria: ${f.elements.category.value||'Todas'} · Produto: ${f.elements.product.value||'Todos'}`,width);doc.text(criteria,left,y);y+=criteria.length*5+3;
 const total=receipts.reduce((a,x)=>a+sqdMarketAmount(x.total),0);
 fill(244,247,251);doc.roundedRect(left,y,width,19,3,3,'F');doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(...muted);
 text(`${receipts.length} compra(s) finalizada(s)`,left+7,y+8);doc.setTextColor(...navy);doc.setFontSize(13);text(money(total),left+width-7,y+12,{align:'right'});
 y+=27;
 const byPurchase=new Map();for(const it of sqdMarketReceiptLines){const key=String(it.purchase_id||'');if(!byPurchase.has(key))byPurchase.set(key,[]);byPurchase.get(key).push(it);}
 for(const p of receipts){
  const lines=byPurchase.get(String(p.id))||[];
  ensure(33);
  fill(...navy);doc.roundedRect(left,y,width,15,2,2,'F');doc.setTextColor(255,255,255);doc.setFontSize(10);doc.setFont('helvetica','bold');
  const name=doc.splitTextToSize(`${sqdMarketDate(p.purchase_date)}  •  ${safe(p.store)||'Mercado não informado'}`,117)[0];
  text(name,left+5,y+9);doc.setFontSize(10);text(money(p.total),left+width-5,y+9,{align:'right'});y+=19;
  const x=[left+2,left+88,left+116,left+146];
  fill(237,241,248);doc.rect(left,y,width,9,'F');doc.setTextColor(...navy);doc.setFontSize(8);doc.setFont('helvetica','bold');
  for(const [i,h] of ['Produto / categoria','Quantidade','Preço un.','Subtotal'].entries())text(h,x[i],y+5.9);
  y+=9;doc.setFont('helvetica','normal');
  if(!lines.length){ensure(13);doc.setTextColor(...muted);text('Compra sem detalhamento de itens disponível.',left+3,y+7);y+=13;}
  for(const line of lines){
   const names=doc.splitTextToSize(safe(line.name)||'Produto não informado',80);
   const category=doc.splitTextToSize(safe(line.category)||'Sem categoria',80);
   const rowH=Math.max(12,6+Math.min(3,names.length)*4+Math.min(2,category.length)*3);
   if(y+rowH>footerY-17){newPage();fill(237,241,248);doc.rect(left,y,width,8,'F');doc.setTextColor(...navy);doc.setFont('helvetica','bold');doc.setFontSize(8);['Produto / categoria','Quantidade','Preço un.','Subtotal'].forEach((h,i)=>text(h,x[i],y+5.5));y+=8;doc.setFont('helvetica','normal');}
   fill(250,251,254);doc.rect(left,y,width,rowH,'F');doc.setDrawColor(224,230,237);doc.line(left,y+rowH,left+width,y+rowH);
   doc.setTextColor(...navy);doc.setFontSize(8.6);doc.text(names.slice(0,3),x[0],y+5);
   doc.setTextColor(...muted);doc.setFontSize(7.5);doc.text(category.slice(0,2),x[0],y+5+Math.min(3,names.length)*4);
   doc.setTextColor(...navy);doc.setFontSize(8.1);text(`${sqdMarketQty(line.quantity)} ${safe(line.unit)||'un'}`,x[1],y+6);
   text(money(line.unit_price),x[2],y+6);text(money(line.line_total??sqdMarketAmount(line.quantity)*sqdMarketAmount(line.unit_price)),left+width-4,y+6,{align:'right'});
   y+=rowH;
  }
  ensure(15);doc.setFont('helvetica','bold');doc.setTextColor(...navy);doc.setFontSize(9.5);
  text(`Total registrado da compra: ${money(p.total)}`,left+width-3,y+8,{align:'right'});y+=17;
 }
 const count=doc.getNumberOfPages();for(let p=1;p<=count;p++){
  doc.setPage(p);doc.setDrawColor(223,228,238);doc.line(left,282,195,282);doc.setTextColor(...muted);doc.setFont('helvetica','normal');doc.setFontSize(7.2);
  text('Dados informados pelo usuário. Relatório pessoal, não é documento fiscal.',left,287);
  text(`${p} / ${count}`,195,287,{align:'right'});
 }
 return doc;
}
function sqdMarketDownloadPdf(){
 if(!uid()||uid()!==sqdMarketHistoryOwner)return info('Sua sessão mudou. Consulte o histórico novamente.',true);
 try{const rows=sqdMarketFilteredReceipts();if(!rows.length)return info('Não há compras registradas com os filtros escolhidos.',true);
  const doc=sqdMarketCreatePdf(rows),f=$('#sqd-market-pdf-filters');
  const part=s=>String(s||'').replace(/[^0-9a-z-]/gi,'-').slice(0,35);
  const filename=`sera-que-devo-mercado-historico-${part(f.elements.start_date.value||'inicio')}-${part(f.elements.end_date.value||'fim')}.pdf`;
  doc.save(filename);$('#sqd-market-pdf-dialog')?.close();info('Relatório de compras registradas gerado.');
 }catch(e){info(e?.message||'Não foi possível gerar o PDF do histórico.',true);}
}
function sqdMarketSetupPdf(){
 const host=$('#view-market');if(!host||$('#sqd-market-pdf-dialog'))return;
 host.insertAdjacentHTML('beforeend',`<dialog id="sqd-market-pdf-dialog" class="sqd-market-report-dialog" aria-labelledby="sqd-market-pdf-title"><div class="sqd-market-report-form"><div class="sqd-market-modal-top"><div><span id="sqd-market-pdf-format" class="sqd-market-eyebrow">EXPORTAR HISTÓRICO</span><h3 id="sqd-market-pdf-title">📊 Suas compras registradas</h3><p>Somente compras finalizadas. Sua lista atual não entra no relatório.</p></div><button id="sqd-market-pdf-cancel" type="button" class="sqd-market-icon-close" aria-label="Fechar filtros">×</button></div><form id="sqd-market-pdf-filters" class="sqd-market-report-controls"><fieldset class="sqd-market-period-choices"><legend>1. Escolha o período</legend><div class="sqd-market-segments"><button type="button" data-market-preset="all" aria-pressed="true">Tudo</button><button type="button" data-market-preset="month">Este mês</button><button type="button" data-market-preset="30d">30 dias</button><button type="button" data-market-preset="today">Hoje</button><button type="button" data-market-preset="custom">Datas</button></div></fieldset><div class="sqd-market-report-fields" id="sqd-market-custom-dates" hidden><label>De<input name="start_date" type="date"></label><label>Até<input name="end_date" type="date"></label></div><label class="sqd-market-report-full">2. Estabelecimento<select name="store"><option value="">Todos os estabelecimentos</option></select></label><details class="sqd-market-advanced"><summary>⚙️ Filtros avançados · categoria e produto</summary><div class="sqd-market-report-fields"><label class="sqd-market-report-full">Categoria<select name="category"><option value="">Todas as categorias</option></select></label><label class="sqd-market-report-full">Nome do produto<input name="product" type="search" maxlength="100" placeholder="Ex.: café, arroz, pão"></label></div><p class="sqd-market-filter-note">Filtra compras que contenham os produtos ou categorias escolhidos. O relatório mostra todos os itens dessas compras e seus valores originais.</p></details></form><div class="sqd-market-result-block"><span class="sqd-market-result-caption">PRÉVIA DA EXPORTAÇÃO</span><p id="sqd-market-pdf-result" class="sqd-market-report-preview" role="status" aria-live="polite">Consultando o histórico…</p></div><div class="sqd-market-report-actions"><button type="button" id="sqd-market-xlsx-download" class="btn ghost" disabled>↓ Baixar Excel (.xlsx)</button><button type="button" id="sqd-market-pdf-download" class="btn primary" disabled>▤ Gerar PDF</button></div></div></dialog>`);
 const form=$('#sqd-market-pdf-filters');form.addEventListener('input',sqdMarketPdfStats);form.addEventListener('change',sqdMarketPdfStats);
 $('#sqd-market-pdf-cancel').addEventListener('click',()=>$('#sqd-market-pdf-dialog').close());
 $$('#sqd-market-pdf-dialog [data-market-preset]').forEach(b=>b.addEventListener('click',()=>sqdMarketPreset(b.dataset.marketPreset)));
 $$('#sqd-market-custom-dates input').forEach(el=>el.addEventListener('change',()=>sqdMarketPdfStats()));
 $('#sqd-market-pdf-download').addEventListener('click',sqdMarketDownloadPdf);
 $('#sqd-market-xlsx-download').addEventListener('click',sqdMarketDownloadExcel);
}
window.SCD_MARKET_PDF={open:sqdMarketOpenPdf};

function renderTickets(){const box=$('#bi-ticket-list');if(!box)return;box.innerHTML=store.tickets.length?store.tickets.map(t=>`<article class="bi-item"><div><strong>${esc(t.subject)}</strong><small>${esc(t.category)} · ${esc(t.status)}</small></div><small>${esc(t.created_at?.slice(0,10)||'')}</small></article>`).join(''):'<p class="muted">Nenhuma solicitação registrada.</p>'}

function easter(Y){const a=Y%19,b=Math.floor(Y/100),c=Y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day1=(h+l-7*m+114)%31+1;return new Date(Y,month-1,day1,12)}
function holidayOf(date){const [y,m,d]=date.split('-').map(Number),key=`${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 const fixed={'01-01':['Ano Novo','official'],'04-21':['Tiradentes','official'],'05-01':['Dia do Trabalho','official'],'09-07':['Independência do Brasil','official'],'10-12':['Nossa Senhora Aparecida / Dia das Crianças','official'],'11-02':['Finados','official'],'11-15':['Proclamação da República','official'],'11-20':['Dia da Consciência Negra','official'],'12-25':['Natal','official'],'06-24':['São João','festive'],'12-31':['Véspera de Ano Novo','festive']};
 if(fixed[key])return fixed[key];const p=easter(y);const as=(offset)=>{const x=new Date(p);x.setDate(x.getDate()+offset);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};
 if(date===as(0))return ['Páscoa','festive'];if(date===as(-47))return ['Carnaval (terça-feira; não é feriado nacional)','festive'];if(date===as(60))return ['Corpus Christi (ponto facultativo federal)','festive'];return null;
}
function paintHolidays(){for(const btn of $$('#calendar-grid [data-date]')){const h=holidayOf(btn.dataset.date);if(!h)continue;btn.classList.add(h[1]==='official'?'bi-holiday-official':'bi-holiday-festive');btn.title=(btn.title?btn.title+' · ':'')+h[0];btn.setAttribute('aria-label',(btn.getAttribute('aria-label')||'')+' · '+h[0])}
 const details=$('#calendar-day-details'),date=$('#calendar-grid .day.selected')?.dataset.date;if(details&&date){const h=holidayOf(date);if(h&&!details.querySelector('.bi-holiday-desc'))details.insertAdjacentHTML('afterbegin',`<p class="bi-holiday-desc">${h[1]==='official'?'🇧🇷 Feriado nacional':'🎉 Data festiva'}: ${esc(h[0])}</p>`)}
}
function renderBI(){const box=$('#bi-insights-mini');if(!box)return;
 const vals=balances(),bal=store.accounts.filter(a=>!isBenefitWallet(a)).reduce((sum,a)=>sum+Number(vals[a.id]||0),0),future=(B()?.state?.transactions||[]).filter(t=>t.status==='pending'&&t.type==='expense').reduce((s,t)=>s+Number(t.amount||0),0);
 const debts=store.debts.reduce((s,d)=>s+Number(d.current_amount||0),0);
 const horizon=new Date(day()+'T12:00:00');horizon.setDate(horizon.getDate()+90);const until=horizon.toISOString().slice(0,10);
 const cardDue=store.cards.reduce((s,c)=>s+cardInvoiceRows(c.id).filter(x=>x.due_on<=until&&x.total-(x.paid||0)>0).reduce((a,x)=>a+Math.max(0,x.total-(x.paid||0)),0),0);
 const selectedMonth=$('#dashboard-month')?.value||day().slice(0,7);const creditSpent=store.card_purchases.filter(x=>String(x.purchase_date).startsWith(selectedMonth)).reduce((s,x)=>s+Number(x.total||0),0);
 const essential=(B()?.state?.transactions||[]).filter(t=>t.status==='paid'&&t.type==='expense'&&/moradia|mercado|transporte|saúde|contas mensais/i.test(t.category||'')).reduce((s,t)=>s+Number(t.amount||0),0);
 const days=essential>0?Math.floor(Math.max(0,bal)/(essential/Math.max(1,30))):null;
 box.innerHTML=`<article class="bi-kpi"><small>💼 Saldo em contas</small><strong>${money(bal)}</strong></article><article class="bi-kpi"><small>⏳ Despesas pendentes</small><strong>${money(future)}</strong></article><article class="bi-kpi"><small>💳 Faturas até 90 dias</small><strong>${money(cardDue)}</strong></article><article class="bi-kpi"><small>🛍️ Compras no crédito (${esc(selectedMonth)})</small><strong>${money(creditSpent)}</strong></article><article class="bi-kpi"><small>🔗 Dívidas cadastradas</small><strong>${money(debts)}</strong></article><article class="bi-kpi"><small>🫧 Fôlego estimado*</small><strong>${days===null?'Dados insuficientes':days+' dias'}</strong></article>`;
 $('#bi-estimate-note').textContent='*Valores informados manualmente. Compras no crédito e faturas são mostradas separadamente; pagar a fatura não duplica o gasto. O app não consulta os bancos.';
}
function renderExtras(){renderAccounts();renderBenefits();renderDebts();renderCards();renderRecurring();renderMarketHistory();renderTickets();renderBI();renderPandora()}
function renderPandora(){const e=$('#pandora-insight'),b=B();if(!e||!b?.state)return;
 const month=$('#dashboard-month')?.value||day().slice(0,7),tx=(b.state.transactions||[]).filter(x=>String(x.date||'').startsWith(month)), paid=tx.filter(x=>x.status==='paid'),bal=store.accounts.filter(a=>!isBenefitWallet(a)).reduce((sum,a)=>sum+Number(balances()[a.id]||0),0);
 const expenses=paid.filter(x=>x.type==='expense').reduce((s,x)=>s+Number(x.amount||0),0),incomes=paid.filter(x=>x.type==='income').reduce((s,x)=>s+Number(x.amount||0),0);
 const pending=tx.filter(x=>x.status==='pending'&&x.type==='expense').reduce((s,x)=>s+Number(x.amount||0),0);
 const tone=store.preferences[0]?.pandora_tone||'balanced';let msg='Seus dados ainda estão chegando. Registre entradas e saídas para eu dar dicas úteis.';
 if(tx.length&&expenses>incomes&&incomes>0)msg='O resultado dos seus lançamentos está negativo. Vamos priorizar o essencial e olhar os próximos vencimentos com calma.';
 else if(pending>0)msg=`Você possui ${money(pending)} em despesas pendentes. Vale conferir o calendário antes de comprometer mais dinheiro.`;
 else if(tx.length&&incomes>expenses)msg='Seu resultado registrado está positivo. Que tal cuidar de um sonho ou reforçar uma reserva?';
 if(store.accounts.length&&bal<0)msg=`Seu saldo informado está negativo (${money(bal)}). Bora revisar os pagamentos prioritários — um passo de cada vez.`;
 if(tone==='fun'&&tx.length&&bal>=0&&incomes>=expenses)msg+=' A diva tá aprendendo a comandar o próprio orçamento! ✨';
 if(tone==='gentle')msg=msg.replace('A diva tá aprendendo a comandar o próprio orçamento! ✨','Um cuidado de cada vez.');
 e.textContent=msg;
}
async function submit(table,payload,msg){if(!uid())return info('Entre na sua conta.',true);payload.user_id=uid();return await action(()=>db().from(table).insert(payload),msg)}
function form(id){return document.getElementById(id)}
function get(id){return Object.fromEntries(new FormData(form(id)).entries())}
function validateAmount(v){const n=Number(v);if(!Number.isFinite(n)||n<=0||n>999999999999.99)throw Error('Informe um valor positivo válido.');return Math.round(n*100)/100}
async function send(id,fn){const f=form(id);if(!f)return;let saving=false;f.addEventListener('submit',async ev=>{ev.preventDefault();if(saving)return;saving=true;const b=f.querySelector('button[type=submit],button:not([type])');if(b)b.disabled=true;try{await fn(get(id));}catch(err){info(window.SCD_USER_ERROR?.(err)||'Confira os dados informados e tente novamente.',true)}finally{saving=false;if(b)b.disabled=false}})}
function compose(){
 const app=$('#app'),main=$('#main'),nav=$('#side-nav');if(!app||!main||!nav)return;
 // Slim navigation: Mimos remains historically accessible via reports, not a top-level destination.
 $$('[data-view="mimos"]').forEach(n=>n.hidden=true);
 const addNav=(name,label,icon)=>{const b=document.createElement('button');b.type='button';b.dataset.view=name;b.innerHTML=`<span>${icon}</span>${label}`;nav.insertBefore(b,nav.querySelector('[data-view="profile"]'));};
 addNav('bi-accounts','Contas e bancos','🏦');addNav('bi-cards','Cartões','💳');addNav('bi-debts','Minhas dívidas','🧩');addNav('bi-recurring','Despesas fixas','📆');addNav('bi-help','Central de ajuda','🛡️');
 const html=`
 <section id="view-bi-accounts" class="view"><header class="view-intro"><h2>🏦 Minhas contas e carteiras</h2><p>Cadastre onde seu dinheiro está. Nenhum banco será conectado automaticamente.</p></header><div class="bi-spotlight">💰 Saldo em contas e dinheiro (sem VR/VA) <strong id="bi-accounts-summary">R$ 0,00</strong></div><div id="bi-accounts-list" class="bi-stack"></div>
 <details class="bi-edit"><summary>＋ Adicionar conta</summary><form class="bi-form" id="bi-account-form"><label>Apelido<input name="name" minlength="2" maxlength="80" placeholder="Conta principal" required></label><label>Instituição (somente nome, opcional)<select name="institution"><option value="">Sem instituição</option><option>Nubank</option><option>Itaú</option><option>Santander</option><option>Banco do Brasil</option><option>Caixa</option><option>Inter</option><option>Bradesco</option><option>C6 Bank</option><option>PicPay</option><option>Mercado Pago</option><option>Outro</option></select></label><label>Tipo<select name="kind"><option value="checking">Conta corrente</option><option value="savings">Poupança</option><option value="wallet">Carteira digital</option><option value="cash">Dinheiro físico</option><option value="investment">Reserva</option><option value="other">Outro</option></select></label><label>Saldo inicial (R$)<input name="opening_balance" type="number" step="0.01" value="0" required></label><label>Data de referência<input name="opening_date" type="date" required></label><button class="btn primary">Salvar conta</button></form></details>
 <details class="bi-edit" id="bi-reconcile-panel"><summary>⚖️ Conciliar / ajustar saldo</summary><form class="bi-form" id="bi-reconcile-form"><label>Conta<select id="bi-reconcile-account" name="account_id" required></select></label><label>Saldo que aparece no banco (R$)<input name="observed_balance" type="number" step="0.01" required></label><label>Data conferida<input type="date" name="observed_on" required></label><label>Motivo (opcional)<input name="reason" maxlength="180" placeholder="Tarifa que não registrei"></label><p class="fine">O ajuste cria um movimento de conciliação. Não altera o saldo inicial nem apaga lançamentos. Use somente após comparar com o banco real.</p><button class="btn primary">Salvar ajuste</button></form></details>
 <details class="bi-edit"><summary>⇄ Transferir entre minhas contas</summary><form class="bi-form" id="bi-transfer-form"><label>De<select name="source"></select></label><label>Para<select name="target"></select></label><label>Valor (R$)<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Data<input type="date" name="date" required></label><button class="btn primary">Registrar transferência</button></form></details></section>
 <section id="view-bi-cards" class="view"><header class="view-intro"><h2>💳 Cartões e faturas</h2><p>Controle manual: compras parceladas criam compromissos; o banco só é debitado quando você confirmar o pagamento. Cada parcela aparece na fatura do seu vencimento.</p></header><div class="bi-stack" id="bi-cards-list"></div><details class="bi-edit"><summary>＋ Cadastrar cartão</summary><form class="bi-form" id="bi-card-form"><label>Apelido<input name="name" maxlength="80" required></label><label>Instituição (opcional)<select name="institution"><option value="">Sem instituição</option><option>Nubank</option><option>Itaú</option><option>Santander</option><option>Inter</option><option>Bradesco</option><option>Banco do Brasil</option><option>Caixa</option><option>Outro</option></select></label><label>Conta sugerida para pagamento<select name="payment_account_id"></select></label><label>Limite informado<input name="credit_limit" type="number" step="0.01" min="0" value="0"></label><label>Dia de fechamento<input name="closing_day" type="number" min="1" max="28" required></label><label>Dia de vencimento<input name="due_day" type="number" min="1" max="28" required></label><button class="btn primary">Cadastrar</button></form></details>
 <details class="bi-edit scd-benefit-register"><summary>＋ VR, VA ou outro benefício</summary><form id="bi-benefit-form" class="bi-form"><p class="fine">Benefícios são carteiras de uso restrito, não cartões de crédito: sem fatura, limite ou juros. Você pode usar a carteira no Mercado e conciliar o saldo quando receber créditos.</p><label>Tipo de benefício<select name="benefit_type"><option value="VA">VA · Vale-alimentação</option><option value="VR">VR · Vale-refeição</option><option value="Benefício">Outro benefício</option></select></label><label>Apelido<input name="name" minlength="2" maxlength="80" placeholder="Ex.: Vale da empresa" required></label><label>Saldo disponível informado (R$)<input name="opening_balance" type="number" min="0" max="999999999999.99" step="0.01" value="0" required></label><label>Data de referência<input name="opening_date" type="date" required></label><button class="btn primary" type="submit">Salvar benefício</button></form></details><div id="bi-benefits-list" class="bi-stack" aria-live="polite"></div>
 <div class="scd-card-fallback"><p><strong>Não tem cartão cadastrado?</strong> Registre a compra como lançamento comum, com parcelas se necessário e a forma de pagamento <em>Outra / sem conta</em>. Isso não cria uma fatura fictícia.</p><button type="button" class="btn ghost" id="scd-credit-other">＋ Lançar sem cartão cadastrado</button></div>
 <details class="bi-edit"><summary>＋ Registrar compra no cartão</summary><form id="bi-card-purchase-form" class="bi-form"><label>Cartão<select id="bi-card-purchase-select" name="card_id" required></select></label><label>Descrição<input name="description" required maxlength="120"></label><label>Categoria<input name="category" value="Compras" maxlength="100"></label><label>Valor da compra sem juros (R$)<input name="total" type="number" min="0.01" step="0.01" required></label><label>Juros totais da compra (%) · opcional<input name="interest" type="number" min="0" max="300" step="0.01" value="0" inputmode="decimal"><small class="ux07-interest-hint">Sem juros? Deixe 0. O percentual é aplicado uma vez ao total da compra.</small></label><label>Parcelas<input name="installments" type="number" min="1" max="60" value="1" required></label><output id="bi-card-interest-preview" class="ux07-interest-preview" aria-live="polite">Informe o valor e a quantidade de parcelas para visualizar o total.</output><label>Data da compra<input name="purchase_date" type="date" required></label><button class="btn primary">Registrar compromisso</button></form></details>
 <details class="bi-edit"><summary>✓ Registrar pagamento de fatura</summary><form id="bi-card-pay-form" class="bi-form"><label>Cartão<select id="bi-card-pay-select" name="card_id" required></select></label><label>Fatura (mês de vencimento)<select name="invoice_month" required></select></label><label>Conta de pagamento<span class="bi-pay-accounts"></span></label><label>Valor pago<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Data<input name="paid_on" type="date" required></label><button class="btn primary">Confirmar pagamento</button></form></details></section>
 <section id="view-bi-debts" class="view"><header class="view-intro"><h2>🧩 Minhas dívidas</h2><p>Aqui cabem dívidas antigas, inclusive sem pagamento ativo. Nada será descontado da sua conta até registrar um pagamento.</p></header><div class="bi-spotlight">Dívidas com valores informados: <strong id="bi-debts-total">R$ 0,00</strong></div><div class="bi-stack" id="bi-debts-list"></div>
 <details class="bi-edit"><summary>＋ Cadastrar dívida</summary><form class="bi-form" id="bi-debt-form"><label>Credor (apelido)<input name="creditor" required maxlength="100"></label><label>Descrição<input name="description" maxlength="300"></label><label>Valor original conhecido<input name="original_amount" type="number" min="0" step="0.01" placeholder="Opcional"></label><label>Saldo atual conhecido<input name="current_amount" type="number" min="0" step="0.01" placeholder="Se não souber, deixe vazio"></label><label>Última consulta do valor<input type="date" name="updated_amount_at"></label><button class="btn primary">Salvar dívida</button></form></details>
 <details class="bi-edit"><summary>✓ Registrar pagamento da dívida</summary><form id="bi-debt-pay-form" class="bi-form"><label>Dívida<select id="bi-debt-pay-select" name="debt_id" required></select></label><label>Conta de pagamento<span class="bi-pay-accounts"></span></label><label>Valor pago (principal)<input name="amount" type="number" step="0.01" min="0.01" required></label><label>Data<input name="paid_on" type="date" required></label><button class="btn primary">Confirmar pagamento</button></form></details>
 <details class="bi-edit" open><summary>🧮 Simulador educativo de quitação</summary><div class="bi-form"><label>Valor informado<input id="bi-sim-debt" type="number" min="0" step="0.01" value="5200"></label><label>Desconto hipotético (%)<input id="bi-sim-discount" type="range" min="0" max="95" value="50"></label><label>Número de parcelas<input id="bi-sim-months" type="number" min="1" max="48" value="12"></label><output class="bi-spotlight" id="bi-sim-result"></output><p class="fine">Simulação sem juros, multas, tarifas ou oferta vinculante. Confirme sempre as condições com o credor.</p><a href="https://www.serasa.com.br/limpa-nome-online/" target="_blank" rel="noopener noreferrer">Serasa Limpa Nome (canal oficial)</a> · <a href="https://www.consumidor.gov.br/" target="_blank" rel="noopener noreferrer">Consumidor.gov.br</a></div></details></section>
 <section id="view-bi-recurring" class="view"><header class="view-intro"><h2>📆 Fixos, assinaturas e recorrências</h2><p>Programar não é pagar. Os próximos vencimentos serão lançados como pendentes.</p></header><div id="bi-recurring-list" class="bi-stack"></div><details class="bi-edit"><summary>＋ Nova recorrência</summary><form class="bi-form" id="bi-recurring-form"><label>Descrição<input name="description" maxlength="120" required></label><label>Categoria<input name="category" value="Contas mensais"></label><label>Tipo<select name="type"><option value="expense">Despesa</option><option value="income">Receita</option></select></label><label>Valor<input name="amount" type="number" step="0.01" min="0.01" required></label><label>Dia do mês<input name="day_of_month" type="number" min="1" max="28" required></label><label>Primeiro vencimento<input name="next_due" type="date" required></label><button class="btn primary">Salvar recorrência</button></form></details></section>
 <section id="view-bi-help" class="view"><header class="view-intro"><h2>🛡️ Ajuda, direitos e segurança</h2><p>Seu dinheiro é privado. Não solicitamos senhas bancárias, CPF ou número completo de cartão.</p></header><article class="panel"><h3>Responsável e canal oficial</h3><p>Contato de suporte, moderação e privacidade: <a href="mailto:ayranalmeidads@gmail.com">ayranalmeidads@gmail.com</a>.</p><p class="fine">Identificação legal do controlador depende da revisão e publicação final dos termos.</p></article><details class="bi-edit"><summary>＋ Registrar ocorrência ou sugestão</summary><form class="bi-form" id="bi-ticket-form"><label>Assunto<input name="subject" maxlength="120" required></label><label>Tipo<select name="category"><option value="bug">Erro no aplicativo</option><option value="privacy">Privacidade / LGPD</option><option value="security">Segurança</option><option value="complaint">Denúncia</option><option value="suggestion">Sugestão</option><option value="other">Outro</option></select></label><label>Descrição<textarea name="description" minlength="5" maxlength="2000" required></textarea></label><button class="btn primary">Enviar ocorrência</button></form></details><h3>Minhas solicitações</h3><div id="bi-ticket-list" class="bi-stack"></div>
 <details class="bi-edit" id="scd-faq-tour"><summary>❓ Perguntas frequentes</summary><div class="bi-copy"><div class="scd-faq-tour-box"><p><b>Quer conhecer o aplicativo?</b> Faça o passeio guiado pelas principais telas, no seu ritmo. Pode pular qualquer momento.</p><button type="button" id="scd-tour-replay" class="btn ghost">▶ Refazer tour pelo aplicativo</button></div><p><b>O app acessa meu banco?</b> Não. Todos os dados são informados manualmente.</p><p><b>O que é saldo projetado?</b> Estimativa considerando obrigações e receitas futuras cadastradas.</p><p><b>Como excluir ou exportar meus dados?</b> Use as opções de Conta e Privacidade; também é possível solicitar atendimento por e-mail.</p><p><b>O app oferece empréstimo?</b> Não. Simulações são educativas.</p></div></details>
 <details class="bi-edit"><summary>⚙️ Preferências de privacidade e Pandora</summary><form class="bi-form" id="bi-preferences-form"><label>Tom da Pandora<select name="pandora_tone"><option value="balanced">Equilibrado</option><option value="gentle">Acolhedor</option><option value="fun">Pop e divertido</option></select></label><label class="checkline"><input type="checkbox" name="reduce_motion"> Reduzir movimento</label><label class="checkline"><input type="checkbox" name="enlarged_text"> Texto maior</label><label class="checkline"><input type="checkbox" name="private_amounts"> Ocultar valores na tela principal</label><button class="btn primary">Salvar preferências</button></form></details>
 <article class="panel"><h3>Relatórios e dados</h3><p>Na área Relatórios você pode exportar Excel (.xlsx) e PDF. Não compartilhe seus arquivos financeiros com desconhecidos.</p><a href="./legal/termos.html" target="_blank">Termos de uso</a> · <a href="./legal/privacidade.html" target="_blank">Política de privacidade</a></article></section>`;
 main.insertAdjacentHTML('beforeend',html);
 // Reinsert before footer to retain original footer at bottom.
 const foot=main.querySelector('.footer');if(foot)$$('#view-bi-accounts,#view-bi-cards,#view-bi-debts,#view-bi-recurring,#view-bi-help').forEach(el=>foot.before(el));
 $('#view-dashboard').insertAdjacentHTML('beforeend','<section class="bi-panel"><div class="bi-panel-title"><h2>🏦 Contas e faturas</h2><small>Controle manual, sem conexão bancária</small></div><div id="bi-bank-overview" class="bi-bank-overview"></div><h3>💳 Próximos compromissos do cartão</h3><div id="bi-upcoming-invoices" class="bi-upcoming-invoices"></div></section><section class="bi-panel"><div class="bi-panel-title"><h2>📊 Resumo Financeiro</h2><small>Baseado nos seus registros manuais</small></div><div id="bi-insights-mini" class="bi-kpis"></div><p class="fine" id="bi-estimate-note"></p><p class="fine">Não conectamos contas bancárias e não oferecemos crédito.</p></section>');
 $('#view-market').insertAdjacentHTML('beforeend','<section class="bi-panel sqd-market-history-panel"><div class="sqd-market-history-head"><div><h2>📚 Histórico de compras detalhadas</h2><p class="fine">Compras concluídas · exporte somente o que já foi registrado.</p></div><div class="sqd-market-history-actions"></div></div><div id="bi-market-history" class="bi-stack"></div></section>');
 // Reuse the original controls to preserve registered click listeners.
 const historyActions=$('#view-market .sqd-market-history-actions');
 const exportActions=$('#view-market .sqd-market-export-actions');
 if(historyActions&&exportActions){for(const button of [...exportActions.querySelectorAll('button')])historyActions.append(button);exportActions.remove();}
 if($('#market-export'))$('#market-export').textContent='↓ Excel do histórico (.xlsx)';
 if($('#market-export-pdf'))$('#market-export-pdf').textContent='▤ PDF do histórico';
 $('#market-items').insertAdjacentHTML('beforebegin','<div class="bi-inline"><label>Como foi pago?<select id="bi-account-select"><option value="">Outra forma / sem conta cadastrada</option></select><small class="fine">Pode registrar em dinheiro, Pix, cartão não cadastrado ou outra forma. Se usar VR/VA, escolha a carteira cadastrada.</small></label><button type="button" id="bi-select-all" class="btn ghost">☑ Selecionar tudo</button><button type="button" id="bi-select-none" class="btn ghost">Desmarcar tudo</button><label class="sqd-market-store-label">Nome do mercado <span class="sqd-market-required">(obrigatório ao registrar)</span><input id="bi-market-store" maxlength="120" autocomplete="organization" placeholder="Ex.: Mercado do bairro" required></label><label class="scd-tax-box">Tributos aproximados informados no cupom (R$) · opcional<input id="scd-market-tax" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Não consta? Deixe em branco"><small class="fine">Informe somente o valor destacado na nota. Não estimamos alíquotas nem somamos impostos ao gasto.</small></label></div>');
 const chooseAll=$('#bi-select-all'),chooseNone=$('#bi-select-none');if(chooseAll&&chooseNone){const group=document.createElement('div');group.className='sqd-market-select-actions';chooseAll.before(group);group.append(chooseAll,chooseNone)}
 const txForm=$('#transaction-form');if(txForm){const target=txForm.querySelector('[name="date"]')?.closest('label');target?.insertAdjacentHTML('afterend','<label>Conta de recebimento/pagamento<select id="bi-tx-account" name="account_id"><option value="">Sem conta vinculada</option></select></label>');}
 const alerts=document.createElement('div');alerts.id='bi-maint-status';alerts.className='bi-maint-banner';alerts.hidden=true;$('#main').insertBefore(alerts,$('#app-banner'));
 $('#app-banner').insertAdjacentHTML('afterend','<div id="bi-modules-warning" class="notice error" hidden></div>');
 const tip=document.createElement('dialog');tip.id='scd-purchase-education';tip.className='modal scd-purchase-education';tip.innerHTML='<div class="modal-top"><h3>🐾 Pandora explica a compra</h3><button type="button" id="scd-education-close" class="icon-btn" aria-label="Fechar">×</button></div><div class="modal-body"><p id="scd-purchase-education-text"></p><p id="scd-education-tip"></p><p class="fine">Educação financeira geral, não cálculo tributário nem recomendação profissional. <a href="https://www.bcb.gov.br/meubc/faqs/s/educacao-financeira-sub" target="_blank" rel="noopener noreferrer">Banco Central: educação financeira</a> · <a href="https://www2.camara.leg.br/legin/fed/lei/2012/lei-12741-8-dezembro-2012-774745-normaatualizada-pl.html" target="_blank" rel="noopener noreferrer">Lei 12.741/2012</a></p></div><button type="button" class="btn primary" id="scd-education-done">Entendi</button>';document.body.append(tip);
 for(const id of ['scd-education-close','scd-education-done'])document.getElementById(id)?.addEventListener('click',()=>tip.close());
 const overlay=document.createElement('div');overlay.id='bi-main-maint-overlay';overlay.hidden=true;overlay.innerHTML='<div class="bi-maint-dialog"><h2>🛠️ Será Que Devo? em atualização</h2><p>Seus dados continuam armazenados. Os lançamentos estão temporariamente indisponíveis enquanto verificamos a nova versão.</p><a href="mailto:ayranalmeidads@gmail.com">Preciso de suporte</a></div>';app.append(overlay);
 const legal=$('#view-profile');legal?.insertAdjacentHTML('beforeend','<article class="panel"><h3>🛡️ Central de controle da conta</h3><p>Ajuda, ocorrências, preferências e direitos de privacidade.</p><button class="btn primary" type="button" data-view="bi-help">Abrir central de ajuda</button></article>');
 // Report filters are an extension of the existing filters, not replacement of export function.
 const filters=$('#view-reports .filters');if(filters)filters.insertAdjacentHTML('beforeend','<label>Tipo<select id="bi-report-type"><option value="all">Todos</option><option value="income">Entradas</option><option value="expense">Despesas</option></select></label><label>Categoria contém<input id="bi-report-category" placeholder="Opcional"></label>');
 // Color-coded stickies and emoji goals are stored in columns added by SQL 01.
 $('#note-form [name="body"]')?.closest('label')?.insertAdjacentHTML('afterend','<label>Cor do post-it<select name="color"><option value="yellow">Amarelo</option><option value="pink">Rosa</option><option value="blue">Azul</option><option value="green">Verde</option><option value="purple">Lilás</option></select></label>');
 $('#goal-form [name="title"]')?.closest('label')?.insertAdjacentHTML('afterend','<label>Ícone do sonho<select name="icon"><option value="🎯">🎯 Objetivo</option><option value="✈️">✈️ Viagem</option><option value="🏠">🏠 Casa</option><option value="🎓">🎓 Estudos</option><option value="💻">💻 Tecnologia</option><option value="💝">💝 Meu sonho</option></select></label>');
 const dateSelectors=['#bi-reconcile-form [name="observed_on"]','#bi-account-form [name="opening_date"]','#bi-benefit-form [name="opening_date"]','#bi-transfer-form [name="date"]','#bi-debt-form [name="updated_amount_at"]','#bi-card-purchase-form [name="purchase_date"]','#bi-card-pay-form [name="paid_on"]','#bi-debt-pay-form [name="paid_on"]','#bi-recurring-form [name="next_due"]'];for(const s of dateSelectors){if($(s))$(s).value=day()}
}
function renderAccountDropdowns(){const active=store.accounts.filter(a=>a.active&&!isBenefitWallet(a));
 for(const q of ['#bi-transfer-form [name="source"]','#bi-transfer-form [name="target"]'])fillOptions($(q),active,'Selecionar conta');
 $$('.bi-pay-accounts').forEach(el=>{const old=el.querySelector('select')?.value||remembered('account');const n=document.createElement('select');n.name='account_id';n.required=true;el.replaceChildren(n);fillOptions(n,active);if(active.some(a=>a.id===old))n.value=old;});
 fillOptions($('#bi-card-form [name="payment_account_id"]'),active,'Conta (opcional)');
 fillOptions($('#bi-reconcile-account'),store.accounts.filter(a=>a.active),'Selecionar conta');
}
function calcDebt(){const v=Math.max(0,Number($('#bi-sim-debt')?.value)||0),p=Math.min(95,Math.max(0,Number($('#bi-sim-discount')?.value)||0)),n=Math.max(1,Math.min(48,Number($('#bi-sim-months')?.value)||1));$('#bi-sim-result').textContent=`Total hipotético: ${money(v*(1-p/100))} · ${n}× de ${money(v*(1-p/100)/n)} sem juros adicionais.`}
// Juros opcionais são incorporados ao campo total já existente no banco.
// A função SQL atual distribui esse total em centavos e gera a fatura sem duplicar a despesa.
function cardPurchaseWithInterest(baseValue,rateValue,installmentsValue){
 const base=Number(baseValue),rate=Number(rateValue||0),installments=Number(installmentsValue);
 if(!Number.isFinite(base)||base<=0||!Number.isSafeInteger(Math.round(base*100)))throw Error('Informe um valor de compra válido.');
 if(!Number.isFinite(rate)||rate<0||rate>300)throw Error('Informe juros totais entre 0% e 300%.');
 if(!Number.isInteger(installments)||installments<1||installments>60)throw Error('Escolha entre 1 e 60 parcelas.');
 const principalCents=Math.round(base*100),totalCents=Math.round(principalCents*(1+rate/100));
 if(!Number.isSafeInteger(totalCents)||totalCents<installments)throw Error('Total insuficiente para a quantidade de parcelas.');
 return {total:totalCents/100,interest:rate,installments,interestValue:(totalCents-principalCents)/100};
}
function updateCardInterestPreview(){
 const form=$('#bi-card-purchase-form'),preview=$('#bi-card-interest-preview');if(!form||!preview)return;
 const base=Number(form.elements.total?.value||0);if(!(base>0)){preview.textContent='Informe o valor da compra para visualizar as parcelas.';return}
 try{const result=cardPurchaseWithInterest(base,form.elements.interest?.value,form.elements.installments?.value);preview.textContent=`Compra ${money(base)} · Juros ${money(result.interestValue)} (${result.interest}%) · Total ${money(result.total)} · ${result.installments}× de aproximadamente ${money(result.total/result.installments)}.`}
 catch(e){preview.textContent=e.message}
}
function setup(){
 if(ready)return;ready=true;compose();sqdMarketSetupPdf();
 $('#bi-card-pay-select')?.addEventListener('change',()=>{updateInvoicesSelector();const id=$('#bi-card-pay-select').value;const card=store.cards.find(c=>c.id===id);const account=$('#bi-card-pay-form [name="account_id"]');if(account&&card?.payment_account_id)account.value=card.payment_account_id;remember('card',id)});
 $('#bi-card-purchase-select')?.addEventListener('change',ev=>remember('card',ev.target.value));
 const buyForm=$('#bi-card-purchase-form');if(buyForm){for(const name of ['total','interest','installments'])buyForm.elements[name]?.addEventListener('input',updateCardInterestPreview);updateCardInterestPreview()}
 $('#bi-tx-account')?.addEventListener('change',ev=>remember('account',ev.target.value));
 document.addEventListener('click',ev=>{const b=ev.target.closest('.bi-reconcile-shortcut');if(b){const panel=$('#bi-reconcile-panel');panel.open=true;$('#bi-reconcile-account').value=b.dataset.account;panel.scrollIntoView({behavior:'smooth',block:'start'})}},false);
 for(const q of ['#bi-sim-debt','#bi-sim-discount','#bi-sim-months'])$(q)?.addEventListener('input',calcDebt);calcDebt();
 const txform=$('#transaction-form');txform?.addEventListener('submit',e=>{const f=e.currentTarget,acc=f.elements.account_id?.value||'',status=f.elements.status?.value||'paid',amt=Number(f.elements.amount?.value)||0,kind=f.elements.type?.value; /* Beta 3.0: conta não vinculada é forma válida. Histórico do bloqueio antigo preservado:
if(status==='paid'&&!acc){e.preventDefault();e.stopImmediatePropagation();info('Para registrar um valor pago, escolha uma conta ou cadastre uma em Contas e Bancos. Você também pode deixar o lançamento como pendente.',true);return;} 
*/ if(status==='paid'&&acc&&kind==='expense'){const saldo=balances()[acc]||0;const old=B()?.state?.transactions?.find(t=>t.id===f.elements.edit_id?.value);const oldAdjustment=old&&old.status==='paid'&&old.account_id===acc&&old.type==='expense'?Number(old.amount||0):0; if(saldo+oldAdjustment-amt<0){e.preventDefault();e.stopImmediatePropagation();info(`A conta pode ficar negativa (${money(saldo+oldAdjustment-amt)}). Confira o saldo e use o ajuste manual se necessário.`,true);return;}}if(acc)remember('account',acc);},true);
 send('bi-account-form',async d=>{if(await submit('scd_accounts',{name:d.name,kind:d.kind,institution:d.institution||null,opening_balance:Number(d.opening_balance),opening_date:d.opening_date},'Conta cadastrada.'))form('bi-account-form').reset()});
 send('bi-reconcile-form',async d=>{const balance=Number(d.observed_balance);if(!Number.isFinite(balance))throw Error('Digite o saldo informado no seu banco.');await action(()=>db().rpc('scd_reconcile_account',{p_account_id:d.account_id,p_observed_balance:balance,p_observed_on:d.observed_on,p_request_key:crypto.randomUUID(),p_reason:d.reason||''}),'Saldo conciliado sem apagar o histórico.');});
 send('bi-transfer-form',async d=>{if(d.source===d.target)throw Error('Escolha duas contas diferentes.');const current=balances()[d.source]||0;if(current-Number(d.amount)<0&&!await window.SCD_UI.confirm('A conta de origem ficará negativa após a transferência. Deseja registrar mesmo assim?','Saldo insuficiente'))return;await action(()=>db().rpc('scd_transfer',{p_source:d.source,p_target:d.target,p_amount:validateAmount(d.amount),p_date:d.date,p_request_key:crypto.randomUUID(),p_note:''}),'Transferência registrada sem contar receita ou despesa.')});
 send('bi-debt-form',async d=>{if(await submit('scd_debts',{creditor:d.creditor,description:d.description,original_amount:d.original_amount===''?null:Number(d.original_amount),current_amount:d.current_amount===''?null:Number(d.current_amount),updated_amount_at:d.updated_amount_at||null},'Dívida registrada, sem desconto no saldo.'))form('bi-debt-form').reset()});
 send('bi-benefit-form',async d=>{const allowed=['VR','VA','Benefício'];if(!allowed.includes(d.benefit_type))throw Error('Tipo de benefício inválido.');const balance=Number(d.opening_balance);if(!Number.isFinite(balance)||balance<0||balance>999999999999.99)throw Error('Informe um saldo válido.');const saved=await submit('scd_accounts',{name:d.name,kind:'wallet',institution:d.benefit_type,opening_balance:Math.round(balance*100)/100,opening_date:d.opening_date},'Benefício salvo como carteira separada, sem fatura ou crédito.');if(saved){form('bi-benefit-form').reset();form('bi-benefit-form').elements.opening_date.value=day()}});
 document.getElementById('scd-credit-other')?.addEventListener('click',()=>{B()?.navigate?.('transactions');document.querySelector('#transaction-form')?.scrollIntoView({behavior:'smooth',block:'start'});});
 send('bi-card-form',async d=>{await submit('scd_cards',{name:d.name,institution:d.institution||null,payment_account_id:d.payment_account_id||null,credit_limit:Number(d.credit_limit||0),closing_day:Number(d.closing_day),due_day:Number(d.due_day)},'Cartão cadastrado.');form('bi-card-form').reset()});
 send('bi-card-purchase-form',async d=>{const result=cardPurchaseWithInterest(d.total,d.interest,d.installments);const saved=await submit('scd_card_purchases',{card_id:d.card_id,description:d.description,category:d.category,total:result.total,installments:result.installments,purchase_date:d.purchase_date},`Compra registrada. ${result.installments} parcela(s) de um total de ${money(result.total)}${result.interest>0?' com juros incluídos':''}.`);if(saved)remember('card',d.card_id);});
 send('bi-card-pay-form',async d=>{await action(()=>db().rpc('scd_pay_card_invoice',{p_card_id:d.card_id,p_account_id:d.account_id,p_invoice_month:d.invoice_month,p_amount:validateAmount(d.amount),p_paid_on:d.paid_on,p_request_key:crypto.randomUUID()}),'Pagamento abatido da fatura e da conta, sem duplicar despesas.')});
 send('bi-debt-pay-form',async d=>{await action(()=>db().rpc('scd_pay_debt',{p_debt_id:d.debt_id,p_account_id:d.account_id,p_amount:validateAmount(d.amount),p_paid_on:d.paid_on,p_request_key:crypto.randomUUID()}),'Pagamento registrado no saldo da dívida e da conta.')});
 send('bi-recurring-form',async d=>{await submit('scd_recurring_rules',{description:d.description,category:d.category,type:d.type,amount:validateAmount(d.amount),day_of_month:Number(d.day_of_month),next_due:d.next_due},'Regra recorrente salva. Clique em gerar vencimentos.')});
 send('bi-ticket-form',async d=>{if(await submit('scd_tickets',{subject:d.subject,category:d.category,description:d.description},'Ocorrência registrada.'))form('bi-ticket-form').reset()});
 send('bi-preferences-form',async d=>{await action(()=>db().from('scd_preferences').upsert({user_id:uid(),pandora_tone:d.pandora_tone,reduce_motion:!!d.reduce_motion,enlarged_text:!!d.enlarged_text,private_amounts:!!d.private_amounts},{onConflict:'user_id'}),'Preferências atualizadas.')});
 // Checkout V2 preserves every receipt line (legacy RPC deleted it). Capture before original button handler.
 document.addEventListener('click',ev=>{if(ev.target.closest('[data-action="pay"][data-table="transactions"]')){ev.preventDefault();ev.stopImmediatePropagation();ev.stopPropagation();const target=ev.target.closest('[data-id]');payLegacy(target.dataset.id,true)}
 if(ev.target.closest('[data-action="unpay"][data-table="transactions"]')){ev.preventDefault();ev.stopImmediatePropagation();ev.stopPropagation();const target=ev.target.closest('[data-id]');payLegacy(target.dataset.id,false)}
 if(ev.target.closest('#checkout-market')){ev.preventDefault();ev.stopImmediatePropagation();ev.stopPropagation();checkoutV2()}
 if(ev.target.closest('#bi-select-all'))setAll(true);if(ev.target.closest('#bi-select-none'))setAll(false);
 const g=ev.target.closest('.bi-gen');if(g)action(()=>db().rpc('scd_generate_recurring',{p_rule:g.dataset.rule,p_cycles:3}),'Próximos compromissos criados como pendentes.');
 const go=ev.target.closest('[data-view^="bi-"]');if(go){setTimeout(()=>{renderExtras();renderAccountDropdowns()},100)};
 },true);
 // editing styles retain legacy forms, but store note-color/goal-icon through modified core handlers.
 window.addEventListener('scd-auth-ready',async()=>{await fetchExtra();await updateMaint();renderAccountDropdowns();applyPreferences()});
 window.addEventListener('scd-data-refreshed',()=>{renderExtras()});
 window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#bi-')){setTimeout(()=>{renderExtras();renderAccountDropdowns()},100)}});
}
function applyPreferences(){const p=store.preferences[0]||{};document.documentElement.classList.toggle('bi-large-text',!!p.enlarged_text);document.documentElement.classList.toggle('bi-less-motion',!!p.reduce_motion);document.documentElement.classList.toggle('bi-hide-amounts',!!p.private_amounts);
 const f=form('bi-preferences-form');if(f){f.elements.pandora_tone.value=p.pandora_tone||'balanced';f.elements.reduce_motion.checked=!!p.reduce_motion;f.elements.enlarged_text.checked=!!p.enlarged_text;f.elements.private_amounts.checked=!!p.private_amounts}}
/* Histórico da função anterior à Beta 3.0 (não executado):
async function payLegacy(id,paid){const t=B()?.state?.transactions?.find(x=>x.id===id);if(!t)return;
 let account=t.account_id||null;
 if(paid){const active=store.accounts.filter(a=>a.active);if(!active.length)return info('Cadastre uma conta para confirmar o pagamento ou recebimento.',true);
 account=await window.SCD_UI.choose('Qual conta foi usada?',active.map(a=>({value:a.id,label:`${bankIcon(a)} ${a.name}`})),account||remembered('account'));
 if(!account)return;remember('account',account);
 }
 if(!await window.SCD_UI.confirm(paid?'Confirmar pagamento ou recebimento?':'Devolver este lançamento para pendente?','Confirmar alteração'))return;
 await action(()=>db().from('transactions').update({status:paid?'paid':'pending',paid_at:paid?day():null,account_id:account}).eq('id',id).eq('user_id',uid()),paid?'Pagamento confirmado.':'Lançamento pendente novamente.');}
*/
/* Histórico de pagamento por seleção de conta apenas — preservado.
async function payLegacy(id,paid){const t=B()?.state?.transactions?.find(x=>x.id===id);if(!t)return;
 let account=t.account_id||null;
 if(paid){const options=[{value:'__other__',label:'Outra forma / não vincular conta'},...store.accounts.filter(a=>a.active).map(a=>({value:a.id,label:`${bankIcon(a)} ${a.name}`}))];
  const chosen=await window.SCD_UI.choose('Como o valor foi pago ou recebido?',options,account||'__other__');
  if(chosen===null||chosen===undefined||chosen==='')return;
  account=chosen==='__other__'?null:chosen;if(account)remember('account',account);
 }
 if(!await window.SCD_UI.confirm(paid?'Confirmar pagamento ou recebimento?':'Devolver este lançamento para pendente?','Confirmar alteração'))return;
 await action(()=>db().from('transactions').update({status:paid?'paid':'pending',paid_at:paid?day():null,account_id:account}).eq('id',id).eq('user_id',uid()),paid?'Pagamento confirmado.':'Lançamento pendente novamente.');}
FIM DO HISTÓRICO */
// Beta 3.0: confirmar um lançamento pendente distingue meio usado e conta vinculada.
// O registro já existe; esta função muda status e anotação, sem criar novo lançamento.
async function payLegacy(id,paid){
 const t=B()?.state?.transactions?.find(x=>x.id===id);if(!t)return;
 let account=t.account_id||null, note=t.note||'';
 if(paid){
  const methods=t.type==='income'?
   [{value:'pix',label:'📱 Pix'},{value:'transfer',label:'🏦 Transferência bancária'},{value:'money',label:'💵 Dinheiro'},{value:'deposit',label:'🏧 Depósito'},{value:'benefit',label:'🎫 Crédito em benefício'},{value:'other',label:'✦ Outra forma'}]:
   [{value:'pix',label:'📱 Pix'},{value:'debit',label:'💳 Débito'},{value:'money',label:'💵 Dinheiro'},{value:'credit',label:'💳 Crédito sem fatura cadastrada'},{value:'boleto',label:'🧾 Boleto'},{value:'transfer',label:'🏦 Transferência'},{value:'vr',label:'🍽️ VR'},{value:'va',label:'🛒 VA'},{value:'other',label:'✦ Outra forma'}];
  const names={pix:'Pix',debit:'Débito',money:'Dinheiro',credit:'Crédito (sem fatura vinculada)',boleto:'Boleto',transfer:'Transferência',vr:'VR',va:'VA',deposit:'Depósito',benefit:'Crédito de benefício',other:'Outra forma'};
  const original=note.match(/^\[Forma: ([^\]]+)\]\s*/);
  const previous=original?Object.keys(names).find(k=>names[k]===original[1])||'other':'other';
  const method=await window.SCD_UI.choose('Escolha como o valor foi recebido ou pago.',methods,previous,'Forma do lançamento');
  if(!method)return;
  const eligible=store.accounts.filter(a=>a.active&&(method==='vr'?isBenefitWallet(a)&&a.institution==='VR':method==='va'?isBenefitWallet(a)&&a.institution==='VA':method==='benefit'?isBenefitWallet(a):method==='money'?(a.kind==='cash'||(a.kind==='wallet'&&!isBenefitWallet(a))):!isBenefitWallet(a)));
  if(method==='benefit'&&!eligible.length){info('Cadastre uma carteira de benefício antes de registrar crédito VR/VA.',true);return;}
  const choices=[{value:'__other__',label:'Sem vincular uma conta (não atualiza saldo bancário)'},...eligible.map(a=>({value:a.id,label:`${bankIcon(a)} ${a.name}${isBenefitWallet(a)?' · '+a.institution:''}`}))];
  const selected=eligible.some(a=>a.id===account)?account:'__other__';
  const chosen=await window.SCD_UI.choose('Agora escolha onde o valor entrou ou saiu. É opcional vincular uma conta.',choices,selected,'Conta ou carteira');
  if(!chosen)return;
  account=chosen==='__other__'?null:chosen;
  if(method==='benefit'&&!account){info('Para registrar crédito de benefício, selecione a carteira correspondente.',true);return;}
  if(account)remember('account',account);
  const raw=note.replace(/^\[Forma: [^\]]+\]\s*/,'').trim();note=`[Forma: ${names[method]}]${raw?' '+raw:''}`;
  if(note.length>300){info('Observação muito longa para incluir a forma do lançamento.',true);return;}
 }
 if(!await window.SCD_UI.confirm(paid?'Confirmar pagamento ou recebimento?':'Devolver este lançamento para pendente?','Confirmar alteração'))return;
 await action(()=>db().from('transactions').update({status:paid?'paid':'pending',paid_at:paid?day():null,account_id:account,note}).eq('id',id).eq('user_id',uid()),paid?'Pagamento confirmado.':'Lançamento pendente novamente.');
}
async function setAll(checked){await action(()=>db().from('market_items').update({checked}).eq('user_id',uid()),checked?'Todos os itens selecionados.':'Itens desmarcados.')}
// Dicas educativas consistentes com o material de orçamento do Banco Central; não inferem dados não informados.
const MARKET_EDUCATION_TIPS=[
 'Registrar as despesas e comparar com as receitas ajuda a entender para onde o dinheiro vai. Compare o Mercado com o orçamento do mês.',
 'Planejar antes de comprar e acompanhar o preço por kg, litro ou unidade ajuda a comparar opções. Observe também a quantidade usada.',
 'Ao acompanhar gastos recorrentes, você reconhece padrões e pode estabelecer prioridades para seus objetivos, sem culpa por cada compra.',
 'Se houver sobra no orçamento, planejar uma reserva para imprevistos pode melhorar sua segurança financeira. Comece pelo valor possível.'
];
function showPurchaseEducation(total,tax){const dialog=$('#scd-purchase-education');if(!dialog)return;
 const t=$('#scd-purchase-education-text');
 t.textContent=tax===null?`Compra de ${money(total)} registrada! 🧾 O cupom não teve tributos aproximados informados no app. Não vou inventar porcentagens: verifique a nota fiscal ou consulte o estabelecimento.`:`Compra de ${money(total)} registrada! 🧾 Tributos aproximados informados no cupom: ${money(tax)}, equivalentes a ${(tax/total*100).toFixed(1).replace('.',',')}% do valor pago. Isso já está incluído no preço, não é uma despesa extra.`;
 $('#scd-education-tip').textContent='💡 '+MARKET_EDUCATION_TIPS[new Date().getDate()%MARKET_EDUCATION_TIPS.length];
 try{dialog.showModal()}catch{info(t.textContent)}
}
/* Histórico checkoutV2 anterior à Beta 3.0 (não executado):
async function checkoutV2(){const items=B()?.state?.market_items||[],chosen=items.filter(x=>x.checked);if(!chosen.length)return info('Selecione ao menos um produto.',true);
 const storeName=String($('#bi-market-store')?.value||'').trim();
 if(!storeName)return info('Informe o nome do mercado antes de registrar a compra. Ex.: Mercado do bairro.',true);
 if(storeName.length>120)return info('O nome do mercado pode ter no máximo 120 caracteres.',true);
 const sum=chosen.reduce((v,x)=>v+Number(x.quantity)*Number(x.unit_price),0);
 if(!await window.SCD_UI.confirm(`Registrar ${chosen.length} item(ns) em ${storeName} por ${money(sum)}? A compra ficará no histórico detalhado e gerará uma despesa.`,`Confirmar compra`))return;
 const selected=$('#bi-account-select')?.value||null;if(!selected)return info('Selecione a conta usada no mercado. Se não tiver uma, cadastre em Contas e Bancos.',true);if(selected)remember('account',selected);
 await action(()=>db().rpc('scd_checkout_market_v2',{p_ids:chosen.map(x=>x.id),p_date:day(),p_account_id:selected,p_request_key:crypto.randomUUID(),p_store:storeName}),'Compra registrada com itens e total.');}
*/
let checkoutMarketBusy=false;
async function checkoutV2(){if(checkoutMarketBusy)return;
 const items=B()?.state?.market_items||[],chosen=items.filter(x=>x.checked);if(!chosen.length)return info('Selecione ao menos um produto.',true);
 const storeName=String($('#bi-market-store')?.value||'').trim();if(!storeName)return info('Informe o nome do mercado antes de registrar a compra.',true);if(storeName.length>120)return info('Nome do mercado: limite de 120 caracteres.',true);
 const total=Math.round(chosen.reduce((v,x)=>v+Number(x.quantity)*Number(x.unit_price),0)*100)/100;
 if(!Number.isFinite(total)||total<=0)return info('Revise os preços e quantidades.',true);
 const taxField=$('#scd-market-tax'),rawTax=taxField?.value?.trim()||'';let tax=null;
 if(rawTax!==''){tax=Number(rawTax.replace(',','.'));if(!Number.isFinite(tax)||tax<0||tax>total)return info('Confira os tributos do cupom: o valor deve estar entre R$ 0,00 e o total da compra.',true);tax=Math.round(tax*100)/100;}
 const selected=$('#bi-account-select')?.value||null;
 if(!await window.SCD_UI.confirm(`Registrar ${chosen.length} item(ns) em ${storeName} por ${money(total)}? ${selected?'Pagamento vinculado à conta escolhida.':'Forma de pagamento: outra / sem conta cadastrada.'} Isso gera uma única despesa.`, 'Confirmar compra'))return;
 checkoutMarketBusy=true;const btn=$('#checkout-market');if(btn)btn.disabled=true;
 try{const ok=await action(()=>db().rpc('scd_checkout_market_v2',{p_ids:chosen.map(x=>x.id),p_date:day(),p_account_id:selected,p_request_key:crypto.randomUUID(),p_store:storeName}),'Compra registrada com itens e total.');if(ok){if(selected)remember('account',selected);if(taxField)taxField.value='';showPurchaseEducation(total,tax)}}finally{checkoutMarketBusy=false;if(btn)btn.disabled=false}
}
window.SCD_BI20={renderPandora,renderBI,fetchExtra,renderExtras,paintHolidays,balances,cardInvoiceRows};
/* Histórico UX12 (preservado em comentário):
window.addEventListener('load',()=>{setup();if(uid()){fetchExtra().then(()=>{renderAccountDropdowns();applyPreferences()});updateMaint()}});
*/
window.addEventListener('load',()=>{setup();if(uid() && window.SCD_ONBOARDING_COMPLETE===true){fetchExtra().then(()=>{renderAccountDropdowns();applyPreferences()});updateMaint()}});
})();

/* SCD BI 2.0 - módulo complementar. Não contém chaves privadas. */
(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const day=()=>{const x=new Date();return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`};
const B=()=>window.SCD_BRIDGE;
const db=()=>B()?.db, uid=()=>B()?.user?.id;
const info=(msg,err=false)=>{if(B()?.toast)B().toast(msg,err);else window.alert(msg)};
const store={accounts:[],transfers:[],debts:[],cards:[],card_purchases:[],card_payments:[],cash_movements:[],recurring_rules:[],market_purchases:[],market_purchase_items:[],tickets:[],preferences:[]};
const names={accounts:'scd_accounts',transfers:'scd_transfers',debts:'scd_debts',cards:'scd_cards',card_purchases:'scd_card_purchases',card_payments:'scd_card_payments',cash_movements:'scd_cash_movements',recurring_rules:'scd_recurring_rules',market_purchases:'scd_market_purchases',market_purchase_items:'scd_market_purchase_items',tickets:'scd_tickets',preferences:'scd_preferences'};
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
 renderExtras();
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
 catch(e){info('Não foi possível concluir: '+(e.message||'verifique sua conexão.'),true);return false}}
function inputAccount(name='account_id',includeEmpty=true){return `<select name="${name}" ${includeEmpty?'':'required'}>${includeEmpty?'<option value="">Conta não informada</option>':''}${store.accounts.filter(a=>a.active).map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select>`}
function balances(){let data={};for(const a of store.accounts)data[a.id]=Number(a.opening_balance)||0;
 for(const t of B()?.state?.transactions||[]){if(!t.account_id||t.status!=='paid'||!(t.account_id in data))continue;
 const a=store.accounts.find(x=>x.id===t.account_id);if(t.date<(a?.opening_date||'0000'))continue;
 data[t.account_id]+=(t.type==='income'?1:-1)*Number(t.amount||0);
 }
 for(const t of store.transfers){if(t.source_account_id in data)data[t.source_account_id]-=Number(t.amount);if(t.destination_account_id in data)data[t.destination_account_id]+=Number(t.amount)}
 for(const t of store.cash_movements)if(t.account_id in data)data[t.account_id]+=Number(t.amount);
 return data}
function optionList(items,field='name'){return items.map(a=>`<option value="${esc(a.id)}">${esc(a[field])}</option>`).join('')}
function renderAccounts(){const box=$('#bi-accounts-list');if(!box)return;const vals=balances();box.innerHTML=store.accounts.length?store.accounts.map(a=>`<article class="bi-item"><div><strong>🏦 ${esc(a.name)}</strong><small>${esc(a.kind)} · ${a.active?'Ativa':'Arquivada'}</small></div><b>${money(vals[a.id])}</b></article>`).join(''):'<p class="muted">Cadastre sua primeira conta. Seus lançamentos antigos continuarão preservados.</p>';
 const summary=$('#bi-accounts-summary');if(summary)summary.textContent=money(Object.values(vals).reduce((s,n)=>s+n,0));
 const select=$('#bi-account-select');if(select){const old=select.value;select.innerHTML='<option value="">Conta não informada</option>'+optionList(store.accounts.filter(x=>x.active));select.value=old||''}
 const txSelect=$('#bi-tx-account');if(txSelect){const old=txSelect.value;txSelect.innerHTML='<option value="">Sem conta vinculada</option>'+optionList(store.accounts.filter(x=>x.active));txSelect.value=old||''}
}
function renderDebts(){const box=$('#bi-debts-list');if(!box)return;box.innerHTML=store.debts.length?store.debts.map(d=>`<article class="bi-item"><div><strong>${esc(d.creditor)}</strong><small>${esc(d.status)} · ${d.updated_amount_at?'Atualização: '+esc(d.updated_amount_at):'Valor não atualizado'}</small></div><b>${d.current_amount===null?'Valor desconhecido':money(d.current_amount)}</b></article>`).join(''):'<p class="muted">Sem pendências cadastradas. Registre somente o que quiser acompanhar.</p>';
 $('#bi-debts-total').textContent=money(store.debts.reduce((s,d)=>s+Number(d.current_amount||0),0));
 $('#bi-debt-pay-select').innerHTML='<option value="">Escolha a dívida</option>'+store.debts.filter(d=>d.status!=='paid'&&d.current_amount!==null).map(d=>`<option value="${esc(d.id)}">${esc(d.creditor)} · ${money(d.current_amount)}</option>`).join('');
}
function renderCards(){const box=$('#bi-cards-list');if(!box)return;box.innerHTML=store.cards.length?store.cards.map(c=>{
 const total=store.card_purchases.filter(p=>p.card_id===c.id).reduce((s,p)=>s+Number(p.total),0);
 const paid=store.card_payments.filter(p=>p.card_id===c.id).reduce((s,p)=>s+Number(p.amount),0);
 return `<article class="bi-item"><div><strong>💳 ${esc(c.name)}</strong><small>Vencimento dia ${c.due_day} · limite informado ${money(c.credit_limit)}</small></div><b>Compromissos: ${money(total-paid)}</b></article>`}).join(''):'<p class="muted">Cadastre cartões para organizar seus compromissos.</p>';
 $('#bi-card-purchase-select').innerHTML=optionList(store.cards.filter(c=>c.active));$('#bi-card-pay-select').innerHTML=optionList(store.cards.filter(c=>c.active));
}
function renderRecurring(){const box=$('#bi-recurring-list');if(!box)return;box.innerHTML=store.recurring_rules.length?store.recurring_rules.map(r=>`<article class="bi-item"><div><strong>${esc(r.description)}</strong><small>Todo dia ${r.day_of_month} · ${r.active?'Ativa':'Pausada'}</small></div><b>${money(r.amount)}</b><button class="btn ghost bi-gen" type="button" data-rule="${esc(r.id)}">Gerar 3 vencimentos</button></article>`).join(''):'<p class="muted">Cadastre seus pagamentos e recebimentos mensais.</p>'}
async function renderMarketHistory(){const box=$('#bi-market-history');if(!box)return;let html='';for(const x of store.market_purchases.slice().sort((a,b)=>String(b.purchase_date).localeCompare(a.purchase_date))){const lines=store.market_purchase_items.filter(i=>i.purchase_id===x.id);
 html+=`<details class="bi-item"><summary><strong>🛒 ${esc(x.purchase_date)} · ${esc(x.store||'Mercado')}</strong><b>${money(x.total)}</b></summary><ul>${lines.map(i=>`<li>${esc(i.name)} — ${Number(i.quantity)} ${esc(i.unit||'un')} × ${money(i.unit_price)}</li>`).join('')||'<li>Compra sem detalhamento disponível.</li>'}</ul></details>`;}
 box.innerHTML=html||'<p class="muted">As próximas compras ficarão registradas aqui, com todos os produtos.</p>';
}
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
 const vals=balances(),bal=Object.values(vals).reduce((s,n)=>s+n,0),future=(B()?.state?.transactions||[]).filter(t=>t.status==='pending'&&t.type==='expense').reduce((s,t)=>s+Number(t.amount||0),0);
 const debts=store.debts.reduce((s,d)=>s+Number(d.current_amount||0),0);
 const essential=(B()?.state?.transactions||[]).filter(t=>t.status==='paid'&&t.type==='expense'&&/moradia|mercado|transporte|saúde|contas mensais/i.test(t.category||'')).reduce((s,t)=>s+Number(t.amount||0),0);
 const days=essential>0?Math.floor(Math.max(0,bal)/(essential/Math.max(1,30))):null;
 box.innerHTML=`<article class="bi-kpi"><small>💼 Saldo em contas</small><strong>${money(bal)}</strong></article><article class="bi-kpi"><small>⏳ Contas pendentes registradas</small><strong>${money(future)}</strong></article><article class="bi-kpi"><small>🔗 Dívidas cadastradas</small><strong>${money(debts)}</strong></article><article class="bi-kpi"><small>🫧 Fôlego estimado*</small><strong>${days===null?'Dados insuficientes':days+' dias'}</strong></article>`;
 $('#bi-estimate-note').textContent='*Estimativa baseada apenas nos dados informados. Saldo bancário não é consultado. Valores de contas sem histórico podem não representar seu patrimônio real.';
}
function renderExtras(){renderAccounts();renderDebts();renderCards();renderRecurring();renderMarketHistory();renderTickets();renderBI();renderPandora()}
function renderPandora(){const e=$('#pandora-insight'),b=B();if(!e||!b?.state)return;
 const month=$('#dashboard-month')?.value||day().slice(0,7),tx=(b.state.transactions||[]).filter(x=>String(x.date||'').startsWith(month)), paid=tx.filter(x=>x.status==='paid'),bal=Object.values(balances()).reduce((s,v)=>s+v,0);
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
async function submit(table,payload,msg){if(!uid())return info('Entre na sua conta.',true);payload.user_id=uid();await action(()=>db().from(table).insert(payload),msg)}
function form(id){return document.getElementById(id)}
function get(id){return Object.fromEntries(new FormData(form(id)).entries())}
function validateAmount(v){const n=Number(v);if(!Number.isFinite(n)||n<=0||n>999999999999.99)throw Error('Informe um valor positivo válido.');return Math.round(n*100)/100}
async function send(id,fn){const f=form(id);if(!f)return;f.addEventListener('submit',async ev=>{ev.preventDefault();try{await fn(get(id));}catch(err){info(err.message,true)}})}
function compose(){
 const app=$('#app'),main=$('#main'),nav=$('#side-nav');if(!app||!main||!nav)return;
 // Slim navigation: Mimos remains historically accessible via reports, not a top-level destination.
 $$('[data-view="mimos"]').forEach(n=>n.hidden=true);
 const addNav=(name,label,icon)=>{const b=document.createElement('button');b.type='button';b.dataset.view=name;b.innerHTML=`<span>${icon}</span>${label}`;nav.insertBefore(b,nav.querySelector('[data-view="profile"]'));};
 addNav('bi-accounts','Contas e bancos','🏦');addNav('bi-cards','Cartões','💳');addNav('bi-debts','Minhas dívidas','🧩');addNav('bi-recurring','Despesas fixas','📆');addNav('bi-help','Central de ajuda','🛡️');
 const html=`
 <section id="view-bi-accounts" class="view"><header class="view-intro"><h2>🏦 Minhas contas e carteiras</h2><p>Cadastre onde seu dinheiro está. Nenhum banco será conectado automaticamente.</p></header><div class="bi-spotlight">💰 Saldo informado e movimentado <strong id="bi-accounts-summary">R$ 0,00</strong></div><div id="bi-accounts-list" class="bi-stack"></div>
 <details class="bi-edit"><summary>＋ Adicionar conta</summary><form class="bi-form" id="bi-account-form"><label>Apelido<input name="name" minlength="2" maxlength="80" placeholder="Conta principal" required></label><label>Tipo<select name="kind"><option value="checking">Conta corrente</option><option value="savings">Poupança</option><option value="wallet">Carteira digital</option><option value="cash">Dinheiro físico</option><option value="investment">Reserva</option><option value="other">Outro</option></select></label><label>Saldo inicial (R$)<input name="opening_balance" type="number" step="0.01" value="0" required></label><label>Data de referência<input name="opening_date" type="date" required></label><button class="btn primary">Salvar conta</button></form></details>
 <details class="bi-edit"><summary>⇄ Transferir entre minhas contas</summary><form class="bi-form" id="bi-transfer-form"><label>De<select name="source"></select></label><label>Para<select name="target"></select></label><label>Valor (R$)<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Data<input type="date" name="date" required></label><button class="btn primary">Registrar transferência</button></form></details></section>
 <section id="view-bi-cards" class="view"><header class="view-intro"><h2>💳 Cartões e faturas</h2><p>Controle manual: compras parceladas criam compromissos; o banco só é debitado no pagamento da fatura.</p></header><div class="bi-stack" id="bi-cards-list"></div><details class="bi-edit"><summary>＋ Cadastrar cartão</summary><form class="bi-form" id="bi-card-form"><label>Apelido<input name="name" maxlength="80" required></label><label>Limite informado<input name="credit_limit" type="number" step="0.01" min="0" value="0"></label><label>Dia de fechamento<input name="closing_day" type="number" min="1" max="28" required></label><label>Dia de vencimento<input name="due_day" type="number" min="1" max="28" required></label><button class="btn primary">Cadastrar</button></form></details>
 <details class="bi-edit"><summary>＋ Registrar compra no cartão</summary><form id="bi-card-purchase-form" class="bi-form"><label>Cartão<select id="bi-card-purchase-select" name="card_id" required></select></label><label>Descrição<input name="description" required maxlength="120"></label><label>Categoria<input name="category" value="Compras" maxlength="100"></label><label>Valor total (R$)<input name="total" type="number" min="0.01" step="0.01" required></label><label>Parcelas<input name="installments" type="number" min="1" max="60" value="1" required></label><label>Data da compra<input name="purchase_date" type="date" required></label><button class="btn primary">Registrar compromisso</button></form></details>
 <details class="bi-edit"><summary>✓ Registrar pagamento de fatura</summary><form id="bi-card-pay-form" class="bi-form"><label>Cartão<select id="bi-card-pay-select" name="card_id" required></select></label><label>Conta de pagamento<span class="bi-pay-accounts"></span></label><label>Valor pago<input name="amount" type="number" min="0.01" step="0.01" required></label><label>Data<input name="paid_on" type="date" required></label><button class="btn primary">Confirmar pagamento</button></form></details></section>
 <section id="view-bi-debts" class="view"><header class="view-intro"><h2>🧩 Minhas dívidas</h2><p>Aqui cabem dívidas antigas, inclusive sem pagamento ativo. Nada será descontado da sua conta até registrar um pagamento.</p></header><div class="bi-spotlight">Dívidas com valores informados: <strong id="bi-debts-total">R$ 0,00</strong></div><div class="bi-stack" id="bi-debts-list"></div>
 <details class="bi-edit"><summary>＋ Cadastrar dívida</summary><form class="bi-form" id="bi-debt-form"><label>Credor (apelido)<input name="creditor" required maxlength="100"></label><label>Descrição<input name="description" maxlength="300"></label><label>Valor original conhecido<input name="original_amount" type="number" min="0" step="0.01" placeholder="Opcional"></label><label>Saldo atual conhecido<input name="current_amount" type="number" min="0" step="0.01" placeholder="Se não souber, deixe vazio"></label><label>Última consulta do valor<input type="date" name="updated_amount_at"></label><button class="btn primary">Salvar dívida</button></form></details>
 <details class="bi-edit"><summary>✓ Registrar pagamento da dívida</summary><form id="bi-debt-pay-form" class="bi-form"><label>Dívida<select id="bi-debt-pay-select" name="debt_id" required></select></label><label>Conta de pagamento<span class="bi-pay-accounts"></span></label><label>Valor pago (principal)<input name="amount" type="number" step="0.01" min="0.01" required></label><label>Data<input name="paid_on" type="date" required></label><button class="btn primary">Confirmar pagamento</button></form></details>
 <details class="bi-edit" open><summary>🧮 Simulador educativo de quitação</summary><div class="bi-form"><label>Valor informado<input id="bi-sim-debt" type="number" min="0" step="0.01" value="5200"></label><label>Desconto hipotético (%)<input id="bi-sim-discount" type="range" min="0" max="95" value="50"></label><label>Número de parcelas<input id="bi-sim-months" type="number" min="1" max="48" value="12"></label><output class="bi-spotlight" id="bi-sim-result"></output><p class="fine">Simulação sem juros, multas, tarifas ou oferta vinculante. Confirme sempre as condições com o credor.</p><a href="https://www.serasa.com.br/limpa-nome-online/" target="_blank" rel="noopener noreferrer">Serasa Limpa Nome (canal oficial)</a> · <a href="https://www.consumidor.gov.br/" target="_blank" rel="noopener noreferrer">Consumidor.gov.br</a></div></details></section>
 <section id="view-bi-recurring" class="view"><header class="view-intro"><h2>📆 Fixos, assinaturas e recorrências</h2><p>Programar não é pagar. Os próximos vencimentos serão lançados como pendentes.</p></header><div id="bi-recurring-list" class="bi-stack"></div><details class="bi-edit"><summary>＋ Nova recorrência</summary><form class="bi-form" id="bi-recurring-form"><label>Descrição<input name="description" maxlength="120" required></label><label>Categoria<input name="category" value="Contas mensais"></label><label>Tipo<select name="type"><option value="expense">Despesa</option><option value="income">Receita</option></select></label><label>Valor<input name="amount" type="number" step="0.01" min="0.01" required></label><label>Dia do mês<input name="day_of_month" type="number" min="1" max="28" required></label><label>Primeiro vencimento<input name="next_due" type="date" required></label><button class="btn primary">Salvar recorrência</button></form></details></section>
 <section id="view-bi-help" class="view"><header class="view-intro"><h2>🛡️ Ajuda, direitos e segurança</h2><p>Seu dinheiro é privado. Não solicitamos senhas bancárias, CPF ou número completo de cartão.</p></header><article class="panel"><h3>Responsável e canal oficial</h3><p>Contato de suporte, moderação e privacidade: <a href="mailto:ayranalmeidads@gmail.com">ayranalmeidads@gmail.com</a>.</p><p class="fine">Identificação legal do controlador depende da revisão e publicação final dos termos.</p></article><details class="bi-edit"><summary>＋ Registrar ocorrência ou sugestão</summary><form class="bi-form" id="bi-ticket-form"><label>Assunto<input name="subject" maxlength="120" required></label><label>Tipo<select name="category"><option value="bug">Erro no aplicativo</option><option value="privacy">Privacidade / LGPD</option><option value="security">Segurança</option><option value="complaint">Denúncia</option><option value="suggestion">Sugestão</option><option value="other">Outro</option></select></label><label>Descrição<textarea name="description" minlength="5" maxlength="2000" required></textarea></label><button class="btn primary">Enviar ocorrência</button></form></details><h3>Minhas solicitações</h3><div id="bi-ticket-list" class="bi-stack"></div>
 <details class="bi-edit"><summary>❓ Perguntas frequentes</summary><div class="bi-copy"><p><b>O app acessa meu banco?</b> Não. Todos os dados são informados manualmente.</p><p><b>O que é saldo projetado?</b> Estimativa considerando obrigações e receitas futuras cadastradas.</p><p><b>Como excluir ou exportar meus dados?</b> Use as opções de Conta e Privacidade; também é possível solicitar atendimento por e-mail.</p><p><b>O app oferece empréstimo?</b> Não. Simulações são educativas.</p></div></details>
 <details class="bi-edit"><summary>⚙️ Preferências de privacidade e Pandora</summary><form class="bi-form" id="bi-preferences-form"><label>Tom da Pandora<select name="pandora_tone"><option value="balanced">Equilibrado</option><option value="gentle">Acolhedor</option><option value="fun">Pop e divertido</option></select></label><label class="checkline"><input type="checkbox" name="reduce_motion"> Reduzir movimento</label><label class="checkline"><input type="checkbox" name="enlarged_text"> Texto maior</label><label class="checkline"><input type="checkbox" name="private_amounts"> Ocultar valores na tela principal</label><button class="btn primary">Salvar preferências</button></form></details>
 <article class="panel"><h3>Relatórios e dados</h3><p>Na área Relatórios você pode exportar CSV, PDF e JSON. Não compartilhe seus arquivos financeiros com desconhecidos.</p><button type="button" class="text-link" data-legal="terms">Termos de uso</button> · <button type="button" class="text-link" data-legal="privacy">Política de privacidade</button></article></section>`;
 main.insertAdjacentHTML('beforeend',html);
 // Reinsert before footer to retain original footer at bottom.
 const foot=main.querySelector('.footer');if(foot)$$('#view-bi-accounts,#view-bi-cards,#view-bi-debts,#view-bi-recurring,#view-bi-help').forEach(el=>foot.before(el));
 $('#view-dashboard').insertAdjacentHTML('beforeend','<section class="bi-panel"><div class="bi-panel-title"><h2>🎮 Seu cockpit financeiro</h2><small>Baseado nos seus registros manuais</small></div><div id="bi-insights-mini" class="bi-kpis"></div><p class="fine" id="bi-estimate-note"></p><p class="fine">Não conectamos contas bancárias e não oferecemos crédito.</p></section>');
 $('#view-market').insertAdjacentHTML('beforeend','<section class="bi-panel"><h2>📚 Histórico de compras detalhadas</h2><div id="bi-market-history" class="bi-stack"></div></section>');
 $('#market-items').insertAdjacentHTML('beforebegin','<div class="bi-inline"><label>Conta da compra<select id="bi-account-select"><option value="">Conta não informada</option></select></label><button type="button" id="bi-select-all" class="btn ghost">☑ Selecionar tudo</button><button type="button" id="bi-select-none" class="btn ghost">Desmarcar tudo</button><label>Estabelecimento (opcional)<input id="bi-market-store" maxlength="120" placeholder="Mercado do bairro"></label></div>');
 const txForm=$('#transaction-form');if(txForm){const target=txForm.querySelector('[name="date"]')?.closest('label');target?.insertAdjacentHTML('afterend','<label>Conta de recebimento/pagamento<select id="bi-tx-account" name="account_id"><option value="">Sem conta vinculada</option></select></label>');}
 const alerts=document.createElement('div');alerts.id='bi-maint-status';alerts.className='bi-maint-banner';alerts.hidden=true;$('#main').insertBefore(alerts,$('#app-banner'));
 $('#app-banner').insertAdjacentHTML('afterend','<div id="bi-modules-warning" class="notice error" hidden></div>');
 const overlay=document.createElement('div');overlay.id='bi-main-maint-overlay';overlay.hidden=true;overlay.innerHTML='<div class="bi-maint-dialog"><h2>🛠️ Será Que Devo? em atualização</h2><p>Seus dados continuam armazenados. Os lançamentos estão temporariamente indisponíveis enquanto verificamos a nova versão.</p><a href="mailto:ayranalmeidads@gmail.com">Preciso de suporte</a></div>';app.append(overlay);
 const legal=$('#view-profile');legal?.insertAdjacentHTML('beforeend','<article class="panel"><h3>🛡️ Central de controle da conta</h3><p>Ajuda, ocorrências, preferências e direitos de privacidade.</p><button class="btn primary" type="button" data-view="bi-help">Abrir central de ajuda</button></article>');
 // Report filters are an extension of the existing filters, not replacement of export function.
 const filters=$('#view-reports .filters');if(filters)filters.insertAdjacentHTML('beforeend','<label>Tipo<select id="bi-report-type"><option value="all">Todos</option><option value="income">Entradas</option><option value="expense">Despesas</option></select></label><label>Categoria contém<input id="bi-report-category" placeholder="Opcional"></label>');
 // Color-coded stickies and emoji goals are stored in columns added by SQL 01.
 $('#note-form [name="body"]')?.closest('label')?.insertAdjacentHTML('afterend','<label>Cor do post-it<select name="color"><option value="yellow">Amarelo</option><option value="pink">Rosa</option><option value="blue">Azul</option><option value="green">Verde</option><option value="purple">Lilás</option></select></label>');
 $('#goal-form [name="title"]')?.closest('label')?.insertAdjacentHTML('afterend','<label>Ícone do sonho<select name="icon"><option value="🎯">🎯 Objetivo</option><option value="✈️">✈️ Viagem</option><option value="🏠">🏠 Casa</option><option value="🎓">🎓 Estudos</option><option value="💻">💻 Tecnologia</option><option value="💝">💝 Meu sonho</option></select></label>');
 const dateSelectors=['#bi-account-form [name="opening_date"]','#bi-transfer-form [name="date"]','#bi-debt-form [name="updated_amount_at"]','#bi-card-purchase-form [name="purchase_date"]','#bi-card-pay-form [name="paid_on"]','#bi-debt-pay-form [name="paid_on"]','#bi-recurring-form [name="next_due"]'];for(const s of dateSelectors){if($(s))$(s).value=day()}
}
function renderAccountDropdowns(){
 const options=optionList(store.accounts.filter(a=>a.active));
 ['#bi-transfer-form [name="source"]','#bi-transfer-form [name="target"]'].forEach(s=>{const n=$(s);if(n)n.innerHTML=options});
 $$('.bi-pay-accounts').forEach(n=>n.innerHTML=`<select name="account_id" required><option value="">Selecionar</option>${options}</select>`);
}
function calcDebt(){const v=Math.max(0,Number($('#bi-sim-debt')?.value)||0),p=Math.min(95,Math.max(0,Number($('#bi-sim-discount')?.value)||0)),n=Math.max(1,Math.min(48,Number($('#bi-sim-months')?.value)||1));$('#bi-sim-result').textContent=`Total hipotético: ${money(v*(1-p/100))} · ${n}× de ${money(v*(1-p/100)/n)} sem juros adicionais.`}
function setup(){
 if(ready)return;ready=true;compose();
 for(const q of ['#bi-sim-debt','#bi-sim-discount','#bi-sim-months'])$(q)?.addEventListener('input',calcDebt);calcDebt();
 send('bi-account-form',async d=>{await submit('scd_accounts',{name:d.name,kind:d.kind,opening_balance:Number(d.opening_balance),opening_date:d.opening_date},'Conta cadastrada.');form('bi-account-form').reset()});
 send('bi-transfer-form',async d=>{await action(()=>db().rpc('scd_transfer',{p_source:d.source,p_target:d.target,p_amount:validateAmount(d.amount),p_date:d.date,p_request_key:crypto.randomUUID(),p_note:''}),'Transferência registrada sem contar receita ou despesa.')});
 send('bi-debt-form',async d=>{await submit('scd_debts',{creditor:d.creditor,description:d.description,original_amount:d.original_amount===''?null:Number(d.original_amount),current_amount:d.current_amount===''?null:Number(d.current_amount),updated_amount_at:d.updated_amount_at||null},'Dívida registrada, sem desconto no saldo.');form('bi-debt-form').reset()});
 send('bi-card-form',async d=>{await submit('scd_cards',{name:d.name,credit_limit:Number(d.credit_limit||0),closing_day:Number(d.closing_day),due_day:Number(d.due_day)},'Cartão cadastrado.');form('bi-card-form').reset()});
 send('bi-card-purchase-form',async d=>{await submit('scd_card_purchases',{card_id:d.card_id,description:d.description,category:d.category,total:validateAmount(d.total),installments:Number(d.installments),purchase_date:d.purchase_date},'Compra adicionada à obrigação do cartão.');});
 send('bi-card-pay-form',async d=>{await action(()=>db().rpc('scd_pay_card_bill',{p_card_id:d.card_id,p_account_id:d.account_id,p_amount:validateAmount(d.amount),p_paid_on:d.paid_on,p_request_key:crypto.randomUUID()}),'Fatura paga, sem nova despesa duplicada.')});
 send('bi-debt-pay-form',async d=>{await action(()=>db().rpc('scd_pay_debt',{p_debt_id:d.debt_id,p_account_id:d.account_id,p_amount:validateAmount(d.amount),p_paid_on:d.paid_on,p_request_key:crypto.randomUUID()}),'Pagamento registrado no saldo da dívida e da conta.')});
 send('bi-recurring-form',async d=>{await submit('scd_recurring_rules',{description:d.description,category:d.category,type:d.type,amount:validateAmount(d.amount),day_of_month:Number(d.day_of_month),next_due:d.next_due},'Regra recorrente salva. Clique em gerar vencimentos.')});
 send('bi-ticket-form',async d=>{await submit('scd_tickets',{subject:d.subject,category:d.category,description:d.description},'Ocorrência registrada.');form('bi-ticket-form').reset()});
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
async function payLegacy(id,paid){const t=B()?.state?.transactions?.find(x=>x.id===id);if(!t)return;
 let account=t.account_id||null;
 if(paid&&store.accounts.length){const active=store.accounts.filter(a=>a.active);const idx=window.prompt('De qual conta saiu/entrou? Digite o número, ou deixe vazio para não informar:\n'+active.map((a,i)=>(i+1)+' — '+a.name).join('\n'),'');
 if(idx===null)return;if(idx.trim()!==''){const n=Number(idx);if(!Number.isInteger(n)||n<1||n>active.length)return info('Número de conta inválido.',true);account=active[n-1].id}}
 if(!window.confirm(paid?'Confirmar pagamento/recebimento?':'Devolver este lançamento ao estado pendente?'))return;
 await action(()=>db().from('transactions').update({status:paid?'paid':'pending',paid_at:paid?day():null,account_id:account}).eq('id',id).eq('user_id',uid()),paid?'Pagamento confirmado.':'Lançamento pendente novamente.');}
async function setAll(checked){await action(()=>db().from('market_items').update({checked}).eq('user_id',uid()),checked?'Todos os itens selecionados.':'Itens desmarcados.')}
async function checkoutV2(){const items=B()?.state?.market_items||[],chosen=items.filter(x=>x.checked);if(!chosen.length)return info('Selecione ao menos um produto.',true);
 const sum=chosen.reduce((v,x)=>v+Number(x.quantity)*Number(x.unit_price),0);
 if(!window.confirm(`Finalizar ${chosen.length} itens por ${money(sum)}? A compra ficará no histórico detalhado.`))return;
 const selected=$('#bi-account-select')?.value||null;
 await action(()=>db().rpc('scd_checkout_market_v2',{p_ids:chosen.map(x=>x.id),p_date:day(),p_account_id:selected,p_request_key:crypto.randomUUID(),p_store:$('#bi-market-store')?.value||''}),'Compra registrada com itens e total.');}
window.SCD_BI20={renderPandora,fetchExtra,renderExtras,paintHolidays};
window.addEventListener('load',()=>{setup();if(uid()){fetchExtra().then(()=>{renderAccountDropdowns();applyPreferences()});updateMaint()}});
})();

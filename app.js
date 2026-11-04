/*
 * Será Que Devo? Pro Lite
 * Supabase Auth + tabelas com RLS + navegação SPA.
 */
const SUPABASE_URL = "https://prrnpotfbaoiruduymky.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_KlKmR2NFxpmZx84yyf0ZhA_nEcOesUi";
const supabaseReady = window.supabase?.createClient &&
  SUPABASE_URL.startsWith("https://prrnpotfbaoiruduymky.supabase.co") &&
  !SUPABASE_URL.includes("placeholder") &&
  SUPABASE_ANON_KEY.length > 20;

const db = supabaseReady
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = value => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
const isoToday = () => new Date().toLocaleDateString("en-CA");

// SEGURANÇA: Prevenção básica contra XSS criando text nodes seguros via textContent
const safeText = value => {
  const str = String(value ?? "");
  const div = document.createElement('div');
  div.textContent = str;
  return div.textContent;
};

let currentUser = null;
let profile = null;
let activeView = "dashboard";
let cache = { transactions: [], reminders: [], notes: [], goals: [], market_items: [], mimos: [] };
let authMode = "login";

const TABLES = {
  transactions: "transactions",
  reminders: "reminders",
  notes: "notes",
  goals: "goals",
  market_items: "market_items",
  mimos: "mimos"
};

const PANDORA_IMAGES = {
  satisfied: "./Pandora-satisfeita.png",
  alert: "./Pandora-alerta.png",
  ironic: "./Pandora-irônica.png",
  rich: "./Pandora-rica.png",
  desperate: "./Pandora-desesperada.png",
  birthday: "./Pandora-aniversario1.png"
};

const PANDORA_LINES = {
  welcome: [
    ["satisfied", "Painel aberto! Vamos fazer esse dinheiro trabalhar a seu favor."],
    ["ironic", "Abri seus números. Prometo julgar só um pouquinho."],
    ["satisfied", "Organização financeira: o verdadeiro glow up."]
  ],
  income: [
    ["rich", "Entrou dinheiro? Elegância financeira é dar um destino pra ele."],
    ["satisfied", "Receita registrada. Que essa energia de entrada se repita!"]
  ],
  expense: [
    ["ironic", "Saída registrada. Foi necessidade, planejamento ou um mimo que venceu?"],
    ["alert", "Anotei a despesa. O importante é enxergar o padrão, não se culpar."]
  ],
  market: [
    ["alert", "Lista de mercado na tela. Olho no total e nada de comprar com fome!"],
    ["ironic", "O carrinho não tem sentimentos. O orçamento tem."]
  ],
  mimo: [
    ["satisfied", "Mimo anotado. Aproveitar também faz parte do plano."],
    ["ironic", "Autocuidado com orçamento? Chiquérrimo."]
  ],
  reminder: [
    ["alert", "Lembrete salvo. Agora não vale dizer que esqueceu!"],
    ["satisfied", "Agenda organizada, mente mais leve."]
  ],
  note: [
    ["satisfied", "Anotado! A sua memória merece uma assistente."],
    ["ironic", "Ideia salva antes que ela fugisse pela janela."]
  ],
  goal: [
    ["rich", "Meta criada. Um passo de cada vez também chega longe."],
    ["satisfied", "Objetivo no radar. Bora acompanhar o progresso."]
  ],
  delete: [
    ["alert", "Item removido. Confira se era isso mesmo que queria."],
    ["ironic", "Apagado. Até os dados têm direito a recomeçar."]
  ],
  error: [
    ["alert", "Ops! Não consegui concluir essa ação. Confira os dados e tente novamente."],
    ["desperate", "Deu um probleminha técnico. Respira que vamos resolver."]
  ],
  theme: [
    ["satisfied", "Novo tema ativado. A beleza também precisa ser acessível."],
    ["ironic", "Troquei a iluminação. A situação financeira continua sendo sua responsabilidade."]
  ],
  export: [
    ["alert", "Arquivo exportado. Cuide dele: contém informações pessoais."],
    ["satisfied", "Backup pronto. Organização é poder."]
  ],
  login: [
    ["satisfied", "Que bom te ver por aqui! Este painel é só seu."],
    ["rich", "Seu espaço financeiro pessoal está pronto."]
  ]
};

function toast(message, type = "info") {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  if (type === "error") el.style.borderLeftColor = "var(--danger)";
  $("#toast-region")?.append(el);
  window.setTimeout(() => el.remove(), 4200);
}

function pandora(category = "welcome", detail = "") {
  const choices = PANDORA_LINES[category] || PANDORA_LINES.welcome;
  const selected = choices[Math.floor(Math.random() * choices.length)];
  const img = $("#pandora-mascot");
  const message = $("#mood-message");
  if (img) {
    img.onerror = () => { img.hidden = true; };
    img.hidden = false;
    img.src = PANDORA_IMAGES[selected[0]] || PANDORA_IMAGES.satisfied;
  }
  if (message) message.textContent = detail ? `${selected[1]} ${detail}` : selected[1];
  const authMsg = $("#auth-pandora-message");
  if (authMsg && !currentUser) authMsg.textContent = selected[1];
}

function setTheme(theme, announce = true) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("sqd-theme", next); } catch {}
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = next === "light" ? "#f3f5fb" : "#11101a";
  if (announce) pandora("theme");
}

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem("sqd-theme"); } catch {}
  const preferred = saved || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  setTheme(preferred, false);
}

function showAuthMessage(message, isError = false) {
  const el = $("#auth-message");
  if (el) { el.textContent = message; el.style.color = isError ? "var(--danger)" : "var(--muted)"; }
}

function setAuthMode(mode) {
  authMode = mode === "signup" ? "signup" : "login";
  $$("[data-auth-mode]").forEach(btn => btn.classList.toggle("active", btn.dataset.authMode === authMode));
  $("#auth-name").hidden = authMode !== "signup";
  $("#auth-name-label").hidden = authMode !== "signup";
  $("#terms-label").hidden = authMode !== "signup";
  $("#auth-password").autocomplete = authMode === "signup" ? "new-password" : "current-password";
  $("#auth-submit").textContent = authMode === "signup" ? "Criar conta segura" : "Entrar com segurança";
  showAuthMessage("");
}

function showApp(user) {
  currentUser = user;
  $("#auth-screen").hidden = true;
  $("#app-shell").hidden = false;
  $("#user-email").textContent = user.email || "";
  $("#user-avatar").textContent = (profile?.display_name || user.email || "?").trim().charAt(0).toUpperCase();
  $("#user-name").textContent = profile?.display_name || user.email?.split("@")[0] || "Meu perfil";
  $("#welcome-title").textContent = `Olá, ${(profile?.display_name || user.email?.split("@")[0] || "pessoa").split(" ")[0]}!`;
  const form = $("#profile-form");
  if (form) {
    form.elements.display_name.value = profile?.display_name || user.user_metadata?.display_name || "";
    form.elements.birthday.value = profile?.birthday || "";
  }
}

function showLoggedOut() {
  currentUser = null; profile = null;
  $("#app-shell").hidden = true;
  $("#auth-screen").hidden = false;
}

async function loadProfile() {
  if (!db || !currentUser) return;
  const { data, error } = await db.from("profiles").select("id, display_name, birthday").eq("id", currentUser.id).maybeSingle();
  if (error) throw error;
  profile = data;
  if (!profile) {
    const fallback = { id: currentUser.id, display_name: currentUser.user_metadata?.display_name || currentUser.email?.split("@")[0] || "Meu perfil" };
    const result = await db.from("profiles").upsert(fallback).select().single();
    if (result.error) throw result.error;
    profile = result.data;
  }
}

async function authSubmit(event) {
  event.preventDefault();
  if (!db) {
    showAuthMessage("Configure SUPABASE_URL e SUPABASE_ANON_KEY corretos em app.js.", true);
    toast("Supabase não configurado.", "error");
    return;
  }
  const form = event.currentTarget;
  const email = form.elements.email.value.trim().toLowerCase();
  const password = form.elements.password.value;
  const submit = $("#auth-submit");
  submit.disabled = true;
  showAuthMessage("Aguarde…");
  try {
    if (authMode === "signup") {
      if (!form.elements.displayName.value.trim()) throw new Error("Informe seu nome de exibição.");
      if (!$("#terms-check").checked) throw new Error("É necessário aceitar os termos.");
      if (password.length < 8) throw new Error("Use uma senha com pelo menos 8 caracteres.");
      const { data, error } = await db.auth.signUp({
        email, password,
        options: { data: { display_name: form.elements.displayName.value.trim() } }
      });
      if (error) throw error;
      if (!data.session) {
        showAuthMessage("Cadastro iniciado. Confirme seu e-mail pelo link enviado.");
        pandora("welcome");
        return;
      }
      currentUser = data.user;
    } else {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      currentUser = data.user;
    }
    await loadProfile();
    showApp(currentUser);
    await loadAllData();
    navigate("dashboard");
    pandora("login");
    toast("Acesso realizado com sucesso.");
  } catch (error) {
    showAuthMessage(error.message || "Não foi possível autenticar.", true);
  } finally {
    submit.disabled = false;
  }
}

async function signOut() {
  if (db) {
    const { error } = await db.auth.signOut();
    if (error) { toast(error.message, "error"); return; }
  }
  cache = { transactions: [], reminders: [], notes: [], goals: [], market_items: [], mimos: [] };
  showLoggedOut();
  showAuthMessage("Você saiu da conta.");
  pandora("welcome");
}

function navigate(view) {
  if (!$(`#view-${view}`)) view = "dashboard";
  activeView = view;
  $$(".view").forEach(section => section.classList.toggle("active", section.id === `view-${view}`));
  $$(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
  const titles = {dashboard:"Painel", transactions:"Lançamentos", market:"Modo Mercado", mimos:"Mimos & lazer", calendar:"Calendário", notes:"Notas", goals:"Metas", calculators:"Calculadoras", reports:"Relatórios", profile:"Meu perfil"};
  $("#view-title").textContent = titles[view] || "Painel";
  history.replaceState(null, "", `#${view}`);
  if (view === "dashboard") renderDashboard();
  pandora("welcome");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function queryTable(table, orderColumn = "created_at") {
  if (!db || !currentUser) return [];
  const { data, error } = await db.from(table).select("*").order(orderColumn, { ascending: false });
  if (error) throw error;
  return data || [];
}

async function loadAllData() {
  if (!db || !currentUser) return;
  $("#online-status").textContent = navigator.onLine ? "Conectado" : "Offline";
  try {
    const [transactions, reminders, notes, goals, market, mimos] = await Promise.all([
      queryTable("transactions", "date"), queryTable("reminders", "date"),
      queryTable("notes"), queryTable("goals"), queryTable("market_items"), queryTable("mimos", "date")
    ]);
    cache = { transactions, reminders, notes, goals, market_items: market, mimos };
    renderAll();
  } catch (error) {
    toast(`Não foi possível carregar os dados: ${error.message}`, "error");
    pandora("error");
  }
}

async function insertRow(table, row) {
  if (!db || !currentUser) throw new Error("Entre na sua conta para salvar.");
  const { data, error } = await db.from(table).insert({ ...row, user_id: currentUser.id }).select().single();
  if (error) throw error;
  return data;
}

async function deleteRow(table, id) {
  if (!db || !currentUser) throw new Error("Sessão não encontrada.");
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) throw error;
}

async function runAction(fn, successMessage, reaction = "welcome") {
  try {
    await fn();
    await loadAllData();
    if (successMessage) toast(successMessage);
    pandora(reaction);
  } catch (error) {
    toast(error.message || "A ação falhou.", "error");
    pandora("error");
  }
}

function renderAll() {
  renderDashboard(); renderTransactions(); renderMarket(); renderMimos();
  renderReminders(); renderNotes(); renderGoals();
}

function renderDashboard() {
  const month = isoToday().slice(0, 7);
  const list = cache.transactions.filter(t => (t.date || "").startsWith(month));
  const income = list.filter(t => t.type === "income").reduce((s,t)=>s+Number(t.amount),0);
  const expense = list.filter(t => t.type === "expense").reduce((s,t)=>s+Number(t.amount),0);
  $("#stat-income").textContent = money(income);
  $("#stat-expense").textContent = money(expense);
  $("#stat-balance").textContent = money(income-expense);
  $("#stat-goals").textContent = cache.goals.length;
  const recent = $("#recent-transactions");
  const rows = [...cache.transactions].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,6);
  recent.replaceChildren();
  if (!rows.length) { recent.innerHTML = '<p class="empty-state">Nenhum lançamento ainda. Comece registrando uma entrada ou saída.</p>'; return; }
  rows.forEach(item => recent.append(makeListItem(item.description, `${item.date || ""} · ${item.category || "Sem categoria"}`, `${item.type === "income" ? "+" : "−"} ${money(item.amount)}`, item.type === "income" ? "positive" : "negative")));
}

function makeListItem(title, subtitle, trailing, valueClass = "") {
  const item = document.createElement("div"); item.className = "list-item";
  const main = document.createElement("div"); main.className = "item-main";
  const strong = document.createElement("strong"); strong.textContent = safeText(title);
  const small = document.createElement("small"); small.textContent = safeText(subtitle);
  const value = document.createElement("strong"); value.textContent = safeText(trailing); if(valueClass) value.className=valueClass;
  main.append(strong, small); item.append(main, value); return item;
}

function renderTransactions() {
  const tbody = $("#transactions-table"); tbody.replaceChildren();
  const month = $("#transaction-filter").value;
  const list = cache.transactions.filter(t => !month || (t.date||"").startsWith(month));
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="6">Nenhum lançamento encontrado.</td></tr>'; return; }
  list.forEach(t => {
    const tr = document.createElement("tr");
    [t.date, t.type === "income" ? "Entrada" : "Saída", t.description, t.category || "—", money(t.amount)].forEach((value, i) => {
      const td = document.createElement("td"); td.textContent = safeText(value);
      if (i === 4) td.className = t.type === "income" ? "positive" : "negative";
      tr.append(td);
    });
    const action = document.createElement("td"); const btn = document.createElement("button");
    btn.className="ghost row-action"; btn.textContent="Excluir"; btn.dataset.deleteTable="transactions"; btn.dataset.deleteId=t.id; btn.setAttribute("aria-label",`Excluir ${t.description}`);
    action.append(btn); tr.append(action); tbody.append(tr);
  });
}

function renderMarket() {
  const root = $("#market-list"); root.replaceChildren();
  const total = cache.market_items.reduce((sum,x)=>sum+Number(x.quantity)*Number(x.unit_price),0);
  $("#market-total").textContent = money(total);
  if (!cache.market_items.length) { root.innerHTML='<p class="empty-state">Sua lista está vazia.</p>'; return; }
  cache.market_items.forEach(item => {
    const row = makeListItem(item.name, `${item.quantity} × ${money(item.unit_price)} · ${item.category||"Sem categoria"}`, money(Number(item.quantity)*Number(item.unit_price)));
    const btn=document.createElement("button"); btn.className="ghost row-action"; btn.textContent="Excluir"; btn.dataset.deleteTable="market_items"; btn.dataset.deleteId=item.id; row.append(btn); root.append(row);
  });
}

function renderMimos() {
  const root=$("#mimos-list"); root.replaceChildren();
  const total=cache.mimos.reduce((sum,x)=>sum+Number(x.amount),0); $("#mimos-total").textContent=money(total);
  if(!cache.mimos.length){root.innerHTML='<p class="empty-state">Nenhum mimo registrado.</p>';return;}
  cache.mimos.forEach(item=>{const row=makeListItem(item.description,`${item.date} · ${item.category}`,money(item.amount),"negative"); const b=document.createElement("button");b.className="ghost row-action";b.textContent="Excluir";b.dataset.deleteTable="mimos";b.dataset.deleteId=item.id;row.append(b);root.append(row);});
}

function renderReminders() {
  const root=$("#reminders-list"); root.replaceChildren();
  if(!cache.reminders.length){root.innerHTML='<p class="empty-state">Sem lembretes por enquanto.</p>';return;}
  [...cache.reminders].sort((a,b)=>(a.date||"").localeCompare(b.date||"")).forEach(item=>{const row=makeListItem(item.title,`${item.date}${item.end_date && item.end_date!==item.date ? " até "+item.end_date:""} · ${item.details||item.kind}`,item.kind==="event"?"Evento":"Lembrete");const b=document.createElement("button");b.className="ghost row-action";b.textContent="Excluir";b.dataset.deleteTable="reminders";b.dataset.deleteId=item.id;row.append(b);root.append(row);});
}

function renderNotes() {
  const root=$("#notes-list");root.replaceChildren();
  if(!cache.notes.length){root.innerHTML='<p class="empty-state">Nenhuma nota salva.</p>';return;}
  cache.notes.forEach(item=>{const card=document.createElement("article");card.className="note-card";const h=document.createElement("h3");h.textContent=item.title;const p=document.createElement("p");p.textContent=item.body;const b=document.createElement("button");b.className="ghost row-action";b.textContent="Excluir nota";b.dataset.deleteTable="notes";b.dataset.deleteId=item.id;card.append(h,p,b);root.append(card);});
}

function renderGoals() {
  const root=$("#goals-list");root.replaceChildren();
  if(!cache.goals.length){root.innerHTML='<p class="empty-state">Crie uma meta para acompanhar seu progresso.</p>';return;}
  cache.goals.forEach(goal=>{const card=document.createElement("article");card.className="note-card";const target=Number(goal.target),current=Number(goal.current),pct=target>0?Math.min(100,Math.round(current/target*100)):0;const h=document.createElement("h3");h.textContent=goal.title;const p=document.createElement("p");p.textContent=`${money(current)} de ${money(target)} · ${pct}%`;const bar=document.createElement("div");bar.className="progress";const span=document.createElement("span");span.style.width=`${pct}%`;bar.append(span);const b=document.createElement("button");b.className="ghost row-action";b.textContent="Excluir meta";b.dataset.deleteTable="goals";b.dataset.deleteId=goal.id;card.append(h,p,bar,b);root.append(card);});
}

function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }

function setTodayDefaults() {
  $$('input[type="date"]').forEach(input => { if (!input.value && input.form?.id !== "profile-form") input.value = isoToday(); });
  $("#report-month").value = isoToday().slice(0,7);
  $("#transaction-filter").value = isoToday().slice(0,7);
}

function handleForms() {
  $("#transaction-form").addEventListener("submit", e => {
    e.preventDefault(); const f=e.currentTarget, d=formObject(f);
    const amount=Number(d.amount); if(!Number.isFinite(amount)||amount<=0){toast("Informe um valor maior que zero.","error");return;}
    runAction(()=>insertRow("transactions",{type:d.type,description:d.description.trim(),category:d.category.trim(),amount,date:d.date,note:d.note.trim()}),"Lançamento salvo.",d.type==="income"?"income":"expense").then(()=>f.reset());
  });
  $("#market-form").addEventListener("submit", e => {
    e.preventDefault();const f=e.currentTarget,d=formObject(f);
    if(Number(d.quantity)<=0||Number(d.unit_price)<0){toast("Confira quantidade e preço.","error");return;}
    runAction(()=>insertRow("market_items",{name:d.name.trim(),quantity:Number(d.quantity),unit_price:Number(d.unit_price),category:d.category.trim(),date:isoToday()}),"Produto adicionado.","market").then(()=>{f.reset();f.elements.quantity.value=1;});
  });
  $("#market-checkout").addEventListener("click", async () => {
    const total=cache.market_items.reduce((sum,x)=>sum+Number(x.quantity)*Number(x.unit_price),0);
    if(total<=0){toast("Adicione produtos antes de registrar a compra.","error");return;}
    if(!confirm(`Registrar ${money(total)} como despesa e limpar a lista de mercado?`))return;
    await runAction(async()=>{await insertRow("transactions",{type:"expense",description:"Compra de mercado",category:"Mercado",amount:Math.round(total*100)/100,date:isoToday(),note:"Total calculado pela lista de mercado."});for(const item of cache.market_items)await deleteRow("market_items",item.id);},"Compra registrada.","expense");
  });
  $("#mimo-form").addEventListener("submit",e=>{e.preventDefault();const f=e.currentTarget,d=formObject(f);if(Number(d.amount)<=0){toast("Informe um valor maior que zero.","error");return;}runAction(async()=>{await insertRow("mimos",{description:d.description.trim(),category:d.category,amount:Number(d.amount),date:d.date});await insertRow("transactions",{type:"expense",description:`Mimo: ${d.description.trim()}`,category:`Mimos · ${d.category}`,amount:Number(d.amount),date:d.date,note:"Gerado pelo módulo Mimos & lazer."});},"Mimo registrado e lançado como despesa.","mimo").then(()=>f.reset());});
  $("#reminder-form").addEventListener("submit",e=>{e.preventDefault();const f=e.currentTarget,d=formObject(f);if(d.end_date && d.end_date<d.date){toast("A data final precisa ser igual ou posterior à inicial.","error");return;}runAction(()=>insertRow("reminders",{kind:d.kind,title:d.title.trim(),date:d.date,end_date:d.end_date||d.date,details:d.details.trim()}),"Item adicionado ao calendário.","reminder").then(()=>f.reset());});
  $("#note-form").addEventListener("submit",e=>{e.preventDefault();const f=e.currentTarget,d=formObject(f);runAction(()=>insertRow("notes",{title:d.title.trim(),body:d.body.trim()}),"Nota salva.","note").then(()=>f.reset());});
  $("#goal-form").addEventListener("submit",e=>{e.preventDefault();const f=e.currentTarget,d=formObject(f);if(Number(d.target)<=0||Number(d.current)<0){toast("Confira os valores da meta.","error");return;}runAction(()=>insertRow("goals",{title:d.title.trim(),target:Number(d.target),current:Number(d.current)}),"Meta criada.","goal").then(()=>f.reset());});
  $("#profile-form").addEventListener("submit",async e=>{e.preventDefault();const d=formObject(e.currentTarget);if(!db||!currentUser)return;try{const {error}=await db.from("profiles").upsert({id:currentUser.id,display_name:d.display_name.trim(),birthday:d.birthday||null});if(error)throw error;await loadProfile();showApp(currentUser);toast("Perfil atualizado.");pandora("welcome");}catch(err){toast(err.message,"error");pandora("error");}});
  $("#calc-financing").addEventListener("submit",e=>{e.preventDefault();const d=formObject(e.currentTarget),p=Number(d.principal),r=Number(d.rate)/100,n=Number(d.months);const payment=r===0?p/n:p*r/(1-Math.pow(1+r,-n));$("#financing-result").textContent=`Parcela aproximada: ${money(payment)} · Total: ${money(payment*n)}. Não inclui tarifas, seguros ou impostos.`;pandora("welcome","Simulação concluída.");});
  $("#calc-vacation").addEventListener("submit",e=>{e.preventDefault();const d=formObject(e.currentTarget),salary=Number(d.salary),days=Number(d.days);const gross=salary/30*days,third=gross/3;$("#vacation-result").textContent=`Estimativa bruta simplificada: ${money(gross+third)} (férias ${money(gross)} + 1/3 ${money(third)}).`;pandora("welcome","Cálculo estimado concluído.");});
  $("#calc-bmi").addEventListener("submit",e=>{e.preventDefault();const d=formObject(e.currentTarget),bmi=Number(d.weight)/(Number(d.height)**2);$("#bmi-result").textContent=`IMC estimado: ${bmi.toFixed(1)}.`;pandora("welcome","Resultado informativo.");});
}

function csvEscape(value) { const s=String(value??""); return `"${s.replaceAll('"','""')}"`; }
function downloadBlob(name, blob) { const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }

function exportCSV() {
  const month=$("#report-month").value;
  const rows=cache.transactions.filter(t=>!month||(t.date||"").startsWith(month));
  const csv=[["Data","Tipo","Descrição","Categoria","Valor","Observação"],...rows.map(t=>[t.date,t.type,t.description,t.category,t.amount,t.note])].map(row=>row.map(csvEscape).join(";")).join("\r\n");
  downloadBlob(`sera-que-devo-lancamentos-${month||"geral"}.csv`,new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"}));
  pandora("export");
}

function exportBackup() {
  const backup={exportedAt:new Date().toISOString(),profile:{display_name:profile?.display_name,birthday:profile?.birthday},data:cache};
  downloadBlob(`sera-que-devo-backup-${isoToday()}.json`,new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}));
  pandora("export");
}

function setupEvents() {
  $("#auth-form").addEventListener("submit",authSubmit);
  $$("[data-auth-mode]").forEach(btn=>btn.addEventListener("click",()=>setAuthMode(btn.dataset.authMode)));
  $("#main-nav").addEventListener("click",e=>{const btn=e.target.closest("[data-view]");if(btn)navigate(btn.dataset.view);});
  $$("[data-go]").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.go)));
  $("#theme-toggle").addEventListener("click",()=>setTheme(document.documentElement.dataset.theme==="light"?"dark":"light"));
  $("#mobile-theme-toggle").addEventListener("click",()=>setTheme(document.documentElement.dataset.theme==="light"?"dark":"light"));
  $("#logout-btn").addEventListener("click",signOut);
  $("#pandora-refresh").addEventListener("click",()=>pandora("welcome"));
  $("#transaction-filter").addEventListener("change",renderTransactions);
  $("#export-csv").addEventListener("click",exportCSV);
  $("#export-backup").addEventListener("click",exportBackup);
  $("#delete-account-info").addEventListener("click",()=>toast("Solicite a exclusão por um canal seguro do administrador."));
  document.addEventListener("click",e=>{
    const b=e.target.closest("[data-delete-table][data-delete-id]");
    if(!b)return;
    const table=b.dataset.deleteTable,id=b.dataset.deleteId;
    if(!Object.values(TABLES).includes(table))return;
    if(!confirm("Deseja excluir este item? Esta ação não pode ser desfeita."))return;
    runAction(()=>deleteRow(table,id),"Item excluído.","delete");
  });
  window.addEventListener("online",()=>$("#online-status").textContent="Conectado");
  window.addEventListener("offline",()=>{$("#online-status").textContent="Offline";toast("Sem conexão. Dados locais em cache.");});
}

async function init() {
  initTheme(); setupEvents(); handleForms(); setTodayDefaults(); setAuthMode("login");
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./service-worker.js").catch(err=>console.warn("SW não registrado:",err));
  }
  if (!db) {
    $("#online-status").textContent="Configuração pendente";
    showAuthMessage("Configure o Supabase em app.js.");
    pandora("welcome");
    return;
  }
  $("#online-status").textContent=navigator.onLine?"Conectado":"Offline";
  const {data:{session},error}=await db.auth.getSession();
  if(error){showAuthMessage(error.message,true);return;}
  if(session?.user){
    currentUser=session.user;
    try{await loadProfile();showApp(currentUser);await loadAllData();navigate(location.hash.replace("#","")||"dashboard");pandora("login");}
    catch(err){toast(err.message,"error");}
  }
  db.auth.onAuthStateChange(async(event,session)=>{
    if(event==="SIGNED_OUT"){showLoggedOut();return;}
    if(session?.user && !currentUser){
      currentUser=session.user;
      try{await loadProfile();showApp(currentUser);await loadAllData();}catch(err){toast(err.message,"error");}
    }
  });
}

init();
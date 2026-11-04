/*
 * Será Que Devo? Pro Lite - Core Completo Integrado
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

let chartIncomeObj = null;
let chartExpenseObj = null;
let chartOverallObj = null;
let chartMimosObj = null;

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
    ["ironic", "Saída registrada. Foi necessidade, planejamento ou um mimo?"],
    ["alert", "Anotei a despesa. O importante é enxergar o padrão."]
  ],
  market: [
    ["alert", "Lista de mercado na tela. Olho no total e nada de comprar com fome!"],
    ["ironic", "O carrinho não tem sentimentos. O orçamento tem."]
  ],
  mimo: [
    ["satisfied", "Mimo anotado. Aproveitar também faz parte do plano."],
    ["ironic", "Autocuidado com orçamento? Chiquérrimo."]
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
  checkBirthdayPopup();
}

function showLoggedOut() {
  currentUser = null; profile = null;
  $("#app-shell").hidden = true;
  $("#auth-screen").hidden = false;
}

function checkBirthdayPopup() {
  if (!profile?.birthday) return;
  const today = new Date();
  const currentMD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const parts = profile.birthday.split('-');
  if (parts.length === 3 && `${parts[1]}-${parts[2]}` === currentMD) {
    $("#birthday-message").textContent = `Parabéns, ${profile.display_name}! 🎉 Hoje é seu dia especial!`;
    $("#birthday-modal").style.display = "flex";
  }
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
    showAuthMessage("Configure SUPABASE_URL e SUPABASE_ANON_KEY.", true);
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
      if (!$("#terms-check").checked) throw new Error("Aceite os termos.");
      if (password.length < 8) throw new Error("Mínimo de 8 caracteres na senha.");
      const { data, error } = await db.auth.signUp({
        email, password,
        options: { data: { display_name: form.elements.displayName.value.trim() } }
      });
      if (error) throw error;
      if (!data.session) {
        showAuthMessage("Cadastro iniciado. Confirme seu e-mail.");
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
    toast("Acesso realizado.");
  } catch (error) {
    showAuthMessage(error.message || "Erro na autenticação.", true);
  } finally {
    submit.disabled = false;
  }
}

async function signOut() {
  if (db) await db.auth.signOut();
  cache = { transactions: [], reminders: [], notes: [], goals: [], market_items: [], mimos: [] };
  showLoggedOut();
}

function navigate(view) {
  if (!$(`#view-${view}`)) view = "dashboard";
  activeView = view;
  $$(".view").forEach(section => section.classList.toggle("active", section.id === `view-${view}`));
  $$(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
  const titles = {
    dashboard:"Painel", transactions:"Lançamentos", market:"Modo Mercado", 
    mimos:"Mimos & lazer", calendar:"Calendário", notes:"Notas & Post-it", 
    goals:"Metas", calculators:"Calculadoras", reports:"Relatórios", profile:"Meu perfil"
  };
  $("#view-title").textContent = titles[view] || "Painel";
  history.replaceState(null, "", `#${view}`);
  if (view === "dashboard") { renderDashboard(); renderGraficos(); }
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
    toast(`Erro ao carregar dados: ${error.message}`, "error");
  }
}

async function insertRow(table, row) {
  if (!db || !currentUser) throw new Error("Faça login para salvar.");
  const { data, error } = await db.from(table).insert({ ...row, user_id: currentUser.id }).select().single();
  if (error) throw error;
  return data;
}

async function deleteRow(table, id) {
  if (!db || !currentUser) throw new Error("Sessão expirada.");
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
  }
}

function renderAll() {
  renderDashboard(); renderTransactions(); renderMarket(); renderMimos();
  renderReminders(); renderNotes(); renderGoals(); renderGraficos();
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
  if (!rows.length) { recent.innerHTML = '<p class="empty-state">Nenhum lançamento ainda.</p>'; return; }
  rows.forEach(item => recent.append(makeListItem(item.description, `${item.date || ""} · ${item.category || "Geral"}`, `${item.type === "income" ? "+" : "−"} ${money(item.amount)}`, item.type === "income" ? "positive" : "negative")));
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
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="6">Nenhum lançamento.</td></tr>'; return; }
  list.forEach(t => {
    const tr = document.createElement("tr");
    [t.date, t.type === "income" ? "Entrada" : "Saída", t.description, t.category || "—", money(t.amount)].forEach((val, i) => {
      const td = document.createElement("td"); td.textContent = safeText(val);
      if (i === 4) td.className = t.type === "income" ? "positive" : "negative";
      tr.append(td);
    });
    const action = document.createElement("td"); const btn = document.createElement("button");
    btn.className="ghost row-action"; btn.textContent="Excluir"; btn.dataset.deleteTable="transactions"; btn.dataset.deleteId=t.id;
    action.append(btn); tr.append(action); tbody.append(tr);
  });
}

function renderMarket() {
  const root = $("#market-list"); root.replaceChildren();
  const total = cache.market_items.reduce((sum,x)=>sum+Number(x.quantity)*Number(x.unit_price),0);
  $("#market-total").textContent = money(total);
  if (!cache.market_items.length) { root.innerHTML='<p class="empty-state">Lista vazia.</p>'; return; }
  cache.market_items.forEach(item => {
    const row = makeListItem(item.name, `${item.quantity} × ${money(item.unit_price)} · ${item.category||"Geral"}`, money(Number(item.quantity)*Number(item.unit_price)));
    const btn=document.createElement("button"); btn.className="ghost row-action"; btn.textContent="Excluir"; btn.dataset.deleteTable="market_items"; btn.dataset.deleteId=item.id; row.append(btn); root.append(row);
  });
}

function renderMimos() {
  const root=$("#mimos-list"); root.replaceChildren();
  const total=cache.mimos.reduce((sum,x)=>sum+Number(x.amount),0); $("#mimos-total").textContent=money(total);
  if(!cache.mimos.length){root.innerHTML='<p class="empty-state">Nenhum mimo.</p>';return;}
  cache.mimos.forEach(item=>{
    const row=makeListItem(item.description,`${item.date} · ${item.category}`,money(item.amount),"negative");
    const b=document.createElement("button");b.className="ghost row-action";b.textContent="Excluir";b.dataset.deleteTable="mimos";b.dataset.deleteId=item.id;row.append(b);root.append(row);
  });
}

function renderReminders() {
  const root=$("#reminders-list"); root.replaceChildren();
  if(!cache.reminders.length){root.innerHTML='<p class="empty-state">Sem lembretes.</p>';return;}
  [...cache.reminders].sort((a,b)=>(a.date||"").localeCompare(b.date||"")).forEach(item=>{
    const row=makeListItem(item.title,`${item.date}${item.end_date && item.end_date!==item.date ? " até "+item.end_date:""} · ${item.details||item.kind}`,item.kind==="event"?"Evento":"Lembrete");
    const b=document.createElement("button");b.className="ghost row-action";b.textContent="Excluir";b.dataset.deleteTable="reminders";b.dataset.deleteId=item.id;row.append(b);root.append(row);
  });
}

function renderNotes() {
  const root=$("#notes-list");root.replaceChildren();
  if(!cache.notes.length){root.innerHTML='<p class="empty-state">Nenhuma nota.</p>';return;}
  cache.notes.forEach(item=>{
    const card=document.createElement("article");card.className="note-card";
    const h=document.createElement("h3");h.textContent=item.title;
    const p=document.createElement("p");p.textContent=item.body;
    const b=document.createElement("button");b.className="ghost row-action";b.textContent="Excluir";b.dataset.deleteTable="notes";b.dataset.deleteId=item.id;
    card.append(h,p,b);root.append(card);
  });
}

function renderGoals() {
  const root=$("#goals-list");root.replaceChildren();
  if(!cache.goals.length){root.innerHTML='<p class="empty-state">Nenhuma meta.</p>';return;}
  cache.goals.forEach(goal=>{
    const card=document.createElement("article");card.className="note-card";
    const target=Number(goal.target),current=Number(goal.current),pct=target>0?Math.min(100,Math.round(current/target*100)):0;
    const h=document.createElement("h3");h.textContent=goal.title;
    const p=document.createElement("p");p.textContent=`${money(current)} de ${money(target)} · ${pct}%`;
    const bar=document.createElement("div");bar.className="progress";const span=document.createElement("span");span.style.width=`${pct}%`;bar.append(span);
    const b=document.createElement("button");b.className="ghost row-action";b.textContent="Excluir";b.dataset.deleteTable="goals";b.dataset.deleteId=goal.id;
    card.append(h,p,bar,b);root.append(card);
  });
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
    const amount=Number(d.amount); if(!Number.isFinite(amount)||amount<=0){toast("Valor inválido.","error");return;}
    runAction(()=>insertRow("transactions",{type:d.type,description:d.description.trim(),category:d.category,amount,date:d.date,note:d.note.trim()}),"Lançamento salvo.",d.type==="income"?"income":"expense").then(()=>f.reset());
  });

  $("#market-form").addEventListener("submit", e => {
    e.preventDefault();const f=e.currentTarget,d=formObject(f);
    runAction(()=>insertRow("market_items",{name:d.name.trim(),quantity:Number(d.quantity),unit_price:Number(d.unit_price),category:d.category.trim(),date:isoToday()}),"Produto adicionado.","market").then(()=>{f.reset();f.elements.quantity.value=1;});
  });

  $("#market-checkout").addEventListener("click", async () => {
    const total=cache.market_items.reduce((sum,x)=>sum+Number(x.quantity)*Number(x.unit_price),0);
    if(total<=0){toast("Carrinho vazio.","error");return;}
    if(!confirm(`Registrar ${money(total)} como despesa de mercado?`))return;
    await runAction(async()=>{
      await insertRow("transactions",{type:"expense",description:"Compra de mercado",category:"Alimentação / Mercado",amount:Math.round(total*100)/100,date:isoToday(),note:"Checkout automático do mercado."});
      for(const item of cache.market_items) await deleteRow("market_items",item.id);
    },"Compra registrada e limpa do carrinho.","expense");
  });

  $("#mimo-form").addEventListener("submit",e=>{
    e.preventDefault();const f=e.currentTarget,d=formObject(f);
    const amount=Number(d.amount);
    runAction(async()=>{
      await insertRow("mimos",{description:d.description.trim(),category:d.category,amount,date:d.date});
      await insertRow("transactions",{type:"expense",description:`Mimo: ${d.description.trim()}`,category:"Lazer / Mimos",amount,date:d.date,note:"Mimo & Lazer"});
    },"Mimo registrado!","mimo").then(()=>f.reset());
  });

  $("#reminder-form").addEventListener("submit",e=>{
    e.preventDefault();const f=e.currentTarget,d=formObject(f);
    runAction(()=>insertRow("reminders",{kind:d.kind,title:d.title.trim(),date:d.date,end_date:d.end_date||d.date,details:d.details.trim()}),"Lembrete salvo.","reminder").then(()=>f.reset());
  });

  $("#note-form").addEventListener("submit",e=>{
    e.preventDefault();const f=e.currentTarget,d=formObject(f);
    runAction(()=>insertRow("notes",{title:d.title.trim(),body:d.body.trim()}),"Nota salva.","note").then(()=>f.reset());
  });

  $("#goal-form").addEventListener("submit",e=>{
    e.preventDefault();const f=e.currentTarget,d=formObject(f);
    runAction(()=>insertRow("goals",{title:d.title.trim(),target:Number(d.target),current:Number(d.current)}),"Meta criada.","goal").then(()=>f.reset());
  });

  $("#profile-form").addEventListener("submit",async e=>{
    e.preventDefault();const d=formObject(e.currentTarget);
    if(!db||!currentUser)return;
    try{
      const {error}=await db.from("profiles").upsert({id:currentUser.id,display_name:d.display_name.trim(),birthday:d.birthday||null});
      if(error)throw error;
      await loadProfile(); showApp(currentUser); toast("Perfil atualizado.");
    }catch(err){toast(err.message,"error");}
  });

  // Calculadoras avançadas restauradas
  $("#calc-financing").addEventListener("submit",e=>{
    e.preventDefault();const d=formObject(e.currentTarget),p=Number(d.principal),r=Number(d.rate)/100,n=Number(d.months);
    const payment=r===0?p/n:p*r/(1-Math.pow(1+r,-n));
    $("#financing-result").textContent=`Parcela aproximada: ${money(payment)} · Total: ${money(payment*n)}`;
  });

  $("#calc-vacation").addEventListener("submit",e=>{
    e.preventDefault();const d=formObject(e.currentTarget),salary=Number(d.salary),days=Number(d.days);
    const gross=salary/30*days,third=gross/3;
    $("#vacation-result").textContent=`Férias brutas: ${money(gross+third)} (Férias ${money(gross)} + 1/3 ${money(third)})`;
  });

  $("#calc-rescisao").addEventListener("submit",e=>{
    e.preventDefault();const d=formObject(e.currentTarget),sal=Number(d.salary);
    const admissao = new Date(d.admissao), desligamento = new Date(d.desligamento);
    const meses = Math.max(1, (desligamento.getFullYear() - admissao.getFullYear()) * 12 + (desligamento.getMonth() - admissao.getMonth()));
    const saldo = (sal/30)*desligamento.getDate();
    const decimo = (sal/12)*(desligamento.getMonth()+1);
    $("#rescisao-result").textContent=`Estimativa Rescisão: Saldo Salário ${money(saldo)} + 13º Prop. ${money(decimo)} (Total aprox: ${money(saldo+decimo)})`;
  });

  $("#calc-mei").addEventListener("submit",e=>{
    e.preventDefault();const d=formObject(e.currentTarget),fat=Number(d.faturamento),limite=6750*Number(d.meses);
    $("#mei-result").textContent=fat>limite ? `Ultrapassou o limite proporcional de ${money(limite)}!` : `Dentro do limite MEI proporcional (${money(limite)}).`;
  });
}

// Gráficos Analytics com Chart.js restaurados
const slicePercentagePlugin = {
  id: 'slicePercentage',
  afterDraw(chart) {
    const { ctx } = chart;
    if (chart.config.type !== 'doughnut') return;
    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      const total = dataset.data.reduce((acc, curr) => acc + curr, 0);
      meta.data.forEach((element, index) => {
        const value = dataset.data[index];
        if (!value || total === 0) return;
        const pct = ((value / total) * 100).toFixed(0) + '%';
        if (((value / total) * 100) < 4) return;
        const { x, y } = element.tooltipPosition();
        ctx.save(); ctx.fillStyle = '#fff'; ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(pct, x, y);
        ctx.restore();
      });
    });
  }
};

function renderGraficos() {
  if (typeof Chart === "undefined") return;
  if (!Chart.registry.plugins.get('slicePercentage')) Chart.register(slicePercentagePlugin);

  const incCanvas = $("#chart-income"), expCanvas = $("#chart-expense"), overCanvas = $("#chart-overall"), mimCanvas = $("#chart-mimos");
  if (!incCanvas || !expCanvas || !overCanvas) return;

  const catsInc = {}, catsExp = {}, catsMim = {};
  let totInc = 0, totExp = 0;

  cache.transactions.forEach(t => {
    const amt = Number(t.amount);
    if (t.type === 'income') { catsInc[t.category] = (catsInc[t.category]||0) + amt; totInc += amt; }
    else { catsExp[t.category] = (catsExp[t.category]||0) + amt; totExp += amt; }
  });
  cache.mimos.forEach(m => { catsMim[m.category] = (catsMim[m.category]||0) + Number(m.amount); });

  if (chartIncomeObj) chartIncomeObj.destroy();
  if (chartExpenseObj) chartExpenseObj.destroy();
  if (chartOverallObj) chartOverallObj.destroy();
  if (chartMimosObj) chartMimosObj.destroy();

  const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };

  chartIncomeObj = new Chart(incCanvas, {
    type: 'doughnut',
    data: { labels: Object.keys(catsInc).length ? Object.keys(catsInc) : ['Sem dados'], datasets: [{ data: Object.values(catsInc).length ? Object.values(catsInc) : [1], backgroundColor: ['#10b981','#00d2ff','#34d399'] }] },
    options: opts
  });

  chartExpenseObj = new Chart(expCanvas, {
    type: 'doughnut',
    data: { labels: Object.keys(catsExp).length ? Object.keys(catsExp) : ['Sem dados'], datasets: [{ data: Object.values(catsExp).length ? Object.values(catsExp) : [1], backgroundColor: ['#a855f7','#f43f5e','#d946ef'] }] },
    options: opts
  });

  chartOverallObj = new Chart(overCanvas, {
    type: 'bar',
    data: { labels: ['Entradas', 'Saídas'], datasets: [{ data: [totInc, totExp], backgroundColor: ['#00f0ff', '#ff007f'] }] },
    options: { ...opts, scales: { x: { ticks: { color: '#a7abc2' } }, y: { ticks: { color: '#a7abc2' } } } }
  });

  if (mimCanvas) {
    chartMimosObj = new Chart(mimCanvas, {
      type: 'doughnut',
      data: { labels: Object.keys(catsMim).length ? Object.keys(catsMim) : ['Sem dados'], datasets: [{ data: Object.values(catsMim).length ? Object.values(catsMim) : [1], backgroundColor: ['#fb7185','#fbbf24','#c084fc'] }] },
      options: opts
    });
  }
}

function exportCSV() {
  const month = $("#report-month").value;
  const rows = cache.transactions.filter(t => !month || (t.date||"").startsWith(month));
  const csv = [["Data","Tipo","Descrição","Categoria","Valor","Observação"], ...rows.map(t=>[t.date,t.type,t.description,t.category,t.amount,t.note])].map(r=>r.join(";")).join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `lancamentos-${month||'geral'}.csv`; a.click(); a.remove();
  toast("CSV exportado.");
}

function exportPDF() {
  if (!window.jspdf) { toast("Biblioteca PDF indisponível.", "error"); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16); doc.text("Relatório Financeiro - Será Que Devo?", 14, 20);
  const body = cache.transactions.map(t => [t.date, t.type, t.category, t.description, money(t.amount)]);
  doc.autoTable({ startY: 28, head: [['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor']], body });
  doc.save("relatorio-financeiro.pdf");
  toast("PDF gerado com sucesso.");
}

function setupEvents() {
  $("#auth-form").addEventListener("submit", authSubmit);
  $$("[data-auth-mode]").forEach(btn => btn.addEventListener("click", () => setAuthMode(btn.dataset.authMode)));
  $("#main-nav").addEventListener("click", e => { const btn = e.target.closest("[data-view]"); if (btn) navigate(btn.dataset.view); });
  $$("[data-go]").forEach(btn => btn.addEventListener("click", () => navigate(btn.dataset.go)));
  $("#theme-toggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme==="light"?"dark":"light"));
  $("#mobile-theme-toggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme==="light"?"dark":"light"));
  $("#logout-btn").addEventListener("click", signOut);
  $("#pandora-refresh").addEventListener("click", () => pandora("welcome"));
  $("#transaction-filter").addEventListener("change", renderTransactions);
  $("#export-csv").addEventListener("click", exportCSV);
  $("#export-pdf").addEventListener("click", exportPDF);
  $("#export-backup").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(cache, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `backup-${isoToday()}.json`; a.click(); a.remove();
  });
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-delete-table][data-delete-id]");
    if (!b) return;
    if (!confirm("Excluir este item?")) return;
    runAction(() => deleteRow(b.dataset.deleteTable, b.dataset.deleteId), "Item excluído.", "delete");
  });
}

async function init() {
  initTheme(); setupEvents(); handleForms(); setTodayDefaults(); setAuthMode("login");
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./service-worker.js").catch(err => console.warn("SW erro:", err));
  }
  if (!db) {
    $("#online-status").textContent = "Configuração pendente";
    return;
  }
  const { data: { session } } = await db.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    await loadProfile();
    showApp(currentUser);
    await loadAllData();
    navigate(location.hash.replace("#","") || "dashboard");
  }
  db.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_OUT") { showLoggedOut(); return; }
    if (session?.user && !currentUser) {
      currentUser = session.user;
      await loadProfile(); showApp(currentUser); await loadAllData();
    }
  });
}

init();
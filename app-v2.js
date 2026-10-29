(() => {
  "use strict";

  const EXPENSE_CATEGORIES = ["Alimentação", "Moradia", "Transporte", "Saúde", "Lazer", "Compras", "Família", "Viagens", "Educação", "Contas e serviços", "Assinaturas", "Impostos e taxas", "Pets", "Outros"];
  const INCOME_CATEGORIES = ["Salário", "Renda extra", "Investimentos", "Reembolso", "Venda", "Presente", "Outros"];
  const COLORS = ["#216e50", "#75a98a", "#d69a51", "#6c91a5", "#bd6b58", "#8c80b8", "#94aa60", "#4d9b9b", "#c17d9c", "#7d8a81"];
  const ICONS = {"Alimentação":"◉","Moradia":"⌂","Transporte":"↗","Saúde":"✚","Lazer":"✦","Compras":"▤","Família":"♡","Viagens":"✈","Educação":"▣","Contas e serviços":"≋","Assinaturas":"↻","Impostos e taxas":"▧","Pets":"♧","Salário":"＋","Renda extra":"↗","Investimentos":"⌁","Reembolso":"↩","Venda":"◇","Presente":"♡","Outros":"•"};
  const $ = (id) => document.getElementById(id);
  const state = { user: null, transactions: [], unsubscribe: null, editingId: null, pendingWrites: false, deferredInstall: null, persistenceReady: false, persistencePromise: Promise.resolve(), demoMode: false, hiddenMoney: false, shortcutDraft: [], amountDigits: "" };
  const money = (cents) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((Number(cents) || 0) / 100);
  const localDate = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-"); };
  const currentMonth = () => localDate().slice(0,7);
  const niceDate = (value) => { if (!value) return "Sem data"; const [y,m,d] = value.split("-").map(Number); return new Date(y,m-1,d).toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"}).replace(".",""); };
  const monthName = (value) => { if (!value) return ""; const [y,m] = value.split("-").map(Number); return new Date(y,m-1,1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"}); };
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const showToast = (message) => { const toast=$("toast"); toast.textContent=message; toast.classList.remove("hidden"); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>toast.classList.add("hidden"),3400); };
  const setNotice = (message, kind="") => { const el=$("notice"); el.textContent=message; el.className = message ? "notice"+(kind ? " "+kind : "") : "notice hidden"; };
  const setConnection = (kind, text) => { const el=$("connection-status"); el.className="connection-status "+kind; el.querySelector("span").textContent=text; };
  const activeMonth = () => $("month-filter").value || currentMonth();
  const categoryOptions = (type, selected) => (type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c=>'<option value="'+escapeHTML(c)+'"'+(c===selected?' selected':'')+'>'+escapeHTML(c)+'</option>').join("");

  const HOME_SHORTCUTS=[{id:"expense",label:"Lançar despesa",icon:"−",tone:"expense",action:"expense"},{id:"income",label:"Lançar receita",icon:"+",tone:"income",action:"income"},{id:"transactions",label:"Movimentações",icon:"☷",tone:"blue",action:"transactions"},{id:"search",label:"Buscar lançamento",icon:"⌕",tone:"purple",action:"search"},{id:"reports",label:"Relatórios",icon:"▥",tone:"blue",action:"reports"},{id:"categories",label:"Categorias",icon:"◇",tone:"slate",action:"categories"},{id:"budgets",label:"Orçamentos",icon:"◎",tone:"green",action:"budgets"},{id:"accounts",label:"Contas",icon:"▣",tone:"slate",action:"accounts"}];
  const SHORTCUTS_KEY="meu-bolso-home-shortcuts-v1",HIDDEN_MONEY_KEY="meu-bolso-hidden-money-v1";
  function selectedShortcuts(){try{const saved=JSON.parse(localStorage.getItem(SHORTCUTS_KEY)||'["expense","income","transactions","search"]');return HOME_SHORTCUTS.filter(item=>Array.isArray(saved)&&saved.includes(item.id));}catch(_){return HOME_SHORTCUTS.slice(0,4);}}
  function renderHomeShortcuts(){const target=$("home-shortcuts");target.innerHTML=selectedShortcuts().map(item=>'<button type="button" class="home-shortcut" data-shortcut="'+item.action+'"><span class="shortcut-icon '+item.tone+'">'+item.icon+'</span><span>'+escapeHTML(item.label)+'</span></button>').join("");if(!target.children.length)target.innerHTML='<p class="shortcut-empty">Nenhum atalho selecionado. Use “Personalizar” para adicionar opções.</p>';}
  function renderHomeSummary(){$("home-balance-total").textContent=$("balance-total").textContent;$("home-income-total").textContent=$("income-total").textContent;$("home-expense-total").textContent=$("expense-total").textContent;applyMoneyVisibility();}
  function applyMoneyVisibility(){document.body.classList.toggle("money-hidden",state.hiddenMoney);const b=$("toggle-balance-visibility");if(!b)return;b.setAttribute("aria-pressed",String(state.hiddenMoney));b.setAttribute("aria-label",state.hiddenMoney?"Mostrar valores financeiros":"Ocultar valores financeiros");b.title=state.hiddenMoney?"Mostrar valores":"Ocultar valores";$("eye-icon").innerHTML=state.hiddenMoney?'<path d="M3 3l18 18M10.6 5.7A10.8 10.8 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5s-1.1 2-3.2 3.7M6.2 6.2C3.5 8 2 12 2 12s3.6 6.5 10 6.5c1.5 0 2.8-.3 4-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>' : '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>';}
  function openCustomizer(){state.shortcutDraft=selectedShortcuts().map(x=>x.id);renderCustomizerOptions();$("home-screen").classList.add("hidden");$("legacy-content").classList.add("hidden");$("more-menu").classList.add("hidden");$("shortcut-customizer").classList.remove("hidden");}
  function renderCustomizerOptions(){$("shortcut-options").innerHTML=HOME_SHORTCUTS.map(item=>'<label class="shortcut-option"><span class="shortcut-option-icon '+item.tone+'">'+item.icon+'</span><span>'+escapeHTML(item.label)+'</span><input type="checkbox" data-shortcut-choice="'+item.id+'" '+(state.shortcutDraft.includes(item.id)?"checked":"")+'></label>').join("");}
  function closeCustomizer(){$("shortcut-customizer").classList.add("hidden");$("home-screen").classList.remove("hidden");}
  function showLegacy(section){$("home-screen").classList.add("hidden");$("shortcut-customizer").classList.add("hidden");$("more-menu").classList.add("hidden");$("legacy-content").classList.remove("hidden");document.body.classList.toggle("legacy-search",section==="search");document.body.classList.toggle("legacy-transactions",section==="transactions");if(section==="search"){$("search-filter").focus();}else if(section==="reports"||section==="categories")$("category-panel").scrollIntoView({behavior:"smooth",block:"start"});else if(section==="export")exportCSV();else $("legacy-content").scrollIntoView({behavior:"smooth",block:"start"});document.querySelectorAll("[data-home-nav]").forEach(b=>b.classList.toggle("active",b.dataset.homeNav===(section==="reports"?"reports":"transactions")));}
  function showHome(){document.body.classList.remove("legacy-search","legacy-transactions");$("home-screen").classList.remove("hidden");$("shortcut-customizer").classList.add("hidden");$("more-menu").classList.add("hidden");$("legacy-content").classList.add("hidden");document.querySelectorAll("[data-home-nav]").forEach(b=>b.classList.toggle("active",b.dataset.homeNav==="home"));}
  function updateCategoryOptions(type, selected) {
    $("transaction-category").innerHTML = categoryOptions(type, selected || (type==="income" ? "Salário" : "Alimentação"));
    $("category-filter").innerHTML = '<option value="all">Todas as categorias</option>'+[...new Set([...EXPENSE_CATEGORIES,...INCOME_CATEGORIES])].map(c=>'<option value="'+escapeHTML(c)+'">'+escapeHTML(c)+'</option>').join("");
  }

  function showLogin() {
    $("auth-loading").classList.add("hidden");
    $("login-view").classList.remove("hidden"); $("app-view").classList.add("hidden");
    $("sign-out-button").classList.add("hidden"); $("login-error").classList.add("hidden");
    $("welcome-message").textContent="Acompanhe suas movimentações.";
    if (state.unsubscribe) { state.unsubscribe(); state.unsubscribe=null; }
    state.transactions=[]; render();
  }

  function showApp(user) {
    $("auth-loading").classList.add("hidden");
    $("login-view").classList.add("hidden"); $("app-view").classList.remove("hidden");
    showHome();
    $("sign-out-button").classList.remove("hidden");
    const name = (user.displayName || user.email || "Olá").split(" ")[0];
    $("welcome-message").textContent = state.demoMode
      ? "Modo demonstração: os dados ficam somente neste navegador."
      : "Olá, "+name+". Aqui está o resumo das suas finanças.";
    if (state.demoMode) {
      $("sign-out-button").classList.remove("hidden");
      state.transactions = loadDemoTransactions();
      setConnection("offline", "Demonstração local");
      setNotice("Modo de demonstração ativo. Não use dados financeiros reais: os registros não são enviados ao Firebase nem sincronizados.", "");
      render();
    } else {
      subscribeTransactions(user.uid);
    }
  }

  const DEMO_STORAGE_KEY = "meu-bolso-demo-transactions-v1";
  function loadDemoTransactions() {
    try {
      const saved = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch (_) { return []; }
  }
  function saveDemoTransactions() {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state.transactions));
  }
  function startDemoMode() {
    try {
    state.demoMode = true;
    state.user = { uid: "demo-local", displayName: "Demonstração" };
    $("login-error").classList.add("hidden");
    showApp(state.user);
    } catch (error) {
      console.error("Erro ao iniciar demonstração:", error);
      const loginError = $("login-error");
      loginError.textContent = "A demonstração não iniciou: " + (error && error.message ? error.message : "erro inesperado");
      loginError.classList.remove("hidden");
    }
  }
  window.startMeuBolsoDemo = startDemoMode;

  function subscribeTransactions(uid) {
    if (state.unsubscribe) state.unsubscribe();
    setConnection(navigator.onLine ? "pending" : "offline", navigator.onLine ? "Conectando…" : "Offline");
    const collection = firebase.firestore().collection("users").doc(uid).collection("transactions");
    state.unsubscribe = collection.orderBy("date","desc").onSnapshot({includeMetadataChanges:true}, snapshot => {
      state.transactions = snapshot.docs.map(doc => ({id:doc.id,...doc.data()}));
      state.pendingWrites = snapshot.metadata.hasPendingWrites;
      if (!navigator.onLine) setConnection("offline","Offline — alterações salvas no aparelho");
      else if (state.pendingWrites || snapshot.docs.some(d=>d.metadata.hasPendingWrites)) setConnection("pending","Sincronizando…");
      else if (snapshot.metadata.fromCache && !state.persistenceReady) setConnection("pending","Carregando dados…");
      else setConnection("online",snapshot.metadata.fromCache ? "Dados em cache" : "Sincronizado");
      render();
    }, error => {
      setConnection("offline","Sem sincronização");
      if (error.code === "permission-denied") setNotice("O Firebase recusou o acesso. Verifique se as regras do Firestore foram publicadas corretamente.","error");
      else setNotice("Não foi possível carregar os lançamentos. Verifique a conexão e tente novamente.","error");
    });
  }

  function filteredTransactions() {
    const month=activeMonth(), search=$("search-filter").value.trim().toLocaleLowerCase("pt-BR"), category=$("category-filter").value;
    return state.transactions.filter(t => (!month || String(t.date||"").startsWith(month)) && (category==="all" || t.category===category) && (!search || [t.description,t.category,t.paymentMethod,t.cardName].some(v=>String(v||"").toLocaleLowerCase("pt-BR").includes(search))));
  }

  function render() {
    const month=activeMonth();
    const allInMonth=state.transactions.filter(t=>String(t.date||"").startsWith(month));
    const expenses=allInMonth.filter(t=>t.type==="expense"), incomes=allInMonth.filter(t=>t.type==="income");
    const sum=arr=>arr.reduce((n,t)=>n+Math.max(0,Number(t.amountCents)||0),0);
    const expenseTotal=sum(expenses), incomeTotal=sum(incomes), net=incomeTotal-expenseTotal;
    $("balance-total").textContent=money(net); $("expense-total").textContent=money(expenseTotal); $("income-total").textContent=money(incomeTotal);
    $("balance-total").style.color=net<0?"#ffbdab":"#ffffff";
    $("balance-subtitle").textContent = net<0 ? "Despesas superaram as receitas" : "Receitas menos despesas";
    $("expense-count").textContent=expenses.length+" "+(expenses.length===1?"lançamento":"lançamentos");
    $("income-count").textContent=incomes.length+" "+(incomes.length===1?"lançamento":"lançamentos");
    const shown=filteredTransactions(); $("transaction-count-badge").textContent=shown.length;
    $("transactions-list").innerHTML=shown.map(t=>{
      const income=t.type==="income", symbol=ICONS[t.category]||"•", amount=money(t.amountCents);
      return '<article class="transaction-row"><span class="transaction-symbol '+(income?"income":"expense")+'">'+symbol+'</span><div class="transaction-main"><span class="transaction-title">'+escapeHTML(t.description||t.category||"Movimentação")+'</span><span class="transaction-meta">'+escapeHTML(t.category||"Sem categoria")+' · '+escapeHTML(niceDate(t.date))+(t.paymentMethod?" · "+escapeHTML(t.paymentMethod):"")+(t.cardName?" · "+escapeHTML(t.cardName):"")+'</span></div><span class="transaction-amount '+(income?"income":"expense")+'">'+(income?"+":"−")+amount+'</span><div class="row-actions"><button class="icon-action" type="button" data-edit="'+escapeHTML(t.id)+'" aria-label="Editar lançamento" title="Editar">✎</button><button class="icon-action" type="button" data-delete="'+escapeHTML(t.id)+'" aria-label="Excluir lançamento" title="Excluir">×</button></div></article>';
    }).join("");
    $("empty-state").classList.toggle("show",shown.length===0); $("transactions-list").classList.toggle("hidden",shown.length===0);
    renderCategoryChart(expenses,expenseTotal);
    renderInsights(month,allInMonth,expenses,incomes,expenseTotal,incomeTotal,net);
    renderHomeSummary();
  }

  function renderCategoryChart(expenses,total) {
    const grouped={}; expenses.forEach(t=>{const name=t.category||"Outros"; grouped[name]=(grouped[name]||0)+(Number(t.amountCents)||0);});
    const entries=Object.entries(grouped).sort((a,b)=>b[1]-a[1]);
    if (!entries.length || total<=0) {
      $("category-chart").style.background="#edf2ee";
      $("category-chart").innerHTML='<div class="chart-center"><strong>R$ 0</strong><span>sem despesas</span></div>';
      $("category-legend").innerHTML='<p class="muted">As categorias aparecem depois dos primeiros lançamentos.</p>';
      return;
    }
    let cursor=0; const slices=entries.map(([name,value],i)=>{const start=cursor;cursor+=value/total*100;return COLORS[i%COLORS.length]+" "+start.toFixed(2)+"% "+cursor.toFixed(2)+"%";});
    $("category-chart").style.background="conic-gradient("+slices.join(", ")+")";
    $("category-chart").innerHTML='<div class="chart-center"><strong>'+money(total)+'</strong><span>em despesas</span></div>';
    $("category-legend").innerHTML=entries.slice(0,6).map(([name,value],i)=>'<div class="legend-row"><span class="legend-dot" style="background:'+COLORS[i%COLORS.length]+'"></span><span class="legend-name">'+escapeHTML(name)+'</span><span class="legend-value">'+Math.round(value/total*100)+'% · '+money(value)+'</span></div>').join("");
  }

  function renderInsights(month,all,expenses,incomes,expenseTotal,incomeTotal,net) {
    const items=[];
    if (!all.length) {
      items.push(["✦","Comece pelos pequenos registros","Anote despesas e receitas ao longo do mês. Com dados reais, os insights ficam mais úteis."]);
    } else {
      if (expenseTotal===0) items.push(["✓","Nenhuma despesa registrada","Não há despesas lançadas para "+monthName(month)+". Confirme se os gastos foram registrados."]);
      if (expenses.length) {
        const groups={}; expenses.forEach(t=>{const cat=t.category||"Outros";groups[cat]=(groups[cat]||0)+(Number(t.amountCents)||0);});
        const top=Object.entries(groups).sort((a,b)=>b[1]-a[1])[0];
        if(top) items.push(["◎","Maior categoria: "+top[0], "Representa "+Math.round(top[1]/Math.max(expenseTotal,1)*100)+"% das despesas ("+money(top[1])+")."]);
        const sorted=[...expenses].sort((a,b)=>(Number(b.amountCents)||0)-(Number(a.amountCents)||0));
        if(sorted[0]) items.push(["↗","Maior despesa",escapeHTML(sorted[0].description||sorted[0].category)+" · "+money(sorted[0].amountCents)+"."]);
      }
      if (incomes.length && expenses.length) {
        const rate=incomeTotal>0?Math.round((expenseTotal/incomeTotal)*100):null;
        if(rate!==null) items.push([rate>100?"!":"↘",rate>100?"Despesas acima das receitas":"Relação entre despesas e receitas",rate>100?"Os lançamentos de despesas superam as receitas em "+money(expenseTotal-incomeTotal)+".":"Você registrou despesas equivalentes a "+rate+"% das receitas do período."]);
      } else if(incomes.length && !expenses.length) {
        items.push(["＋","Receita registrada sem despesas","Confira se todas as despesas do período já foram lançadas."]);
      }
      if(expenses.length>=5) {
        const recurring={}; expenses.forEach(t=>{const key=(t.description||"").trim().toLocaleLowerCase("pt-BR");if(key.length>2)recurring[key]=(recurring[key]||0)+1;});
        const repeat=Object.entries(recurring).filter(([_,n])=>n>=2).sort((a,b)=>b[1]-a[1])[0];
        if(repeat) items.push(["↻","Descrição repetida","“"+repeat[0]+"” aparece "+repeat[1]+" vezes no mês. Verifique se é um gasto recorrente."]);
      }
      if(net>=0 && incomes.length && expenses.length) items.push(["✓","Saldo parcial positivo","Até agora, as receitas registradas superam as despesas em "+money(net)+"."]);
      if(!expenses.length && !incomes.length) items.push(["✦","Complete seus registros","A análise considera apenas os lançamentos cadastrados."]);
    }
    $("insights-list").innerHTML=items.slice(0,4).map(([icon,title,description])=>'<article class="insight-item"><span class="insight-icon">'+icon+'</span><div><strong>'+escapeHTML(title)+'</strong><p>'+description+'</p></div></article>').join("");
  }

  function openDialog(transaction) {
    state.editingId=transaction?.id||null;
    $("dialog-title").textContent=transaction?"Editar movimentação":"Nova movimentação";
    $("transaction-form").reset();
    const type=transaction?.type||"expense"; $("transaction-type").value=type;
    document.querySelectorAll(".type-option").forEach(btn=>btn.classList.toggle("selected",btn.dataset.type===type));
    state.amountDigits=transaction ? String(Math.max(0,Math.round(Number(transaction.amountCents)||0))) : "";
    $("amount-input").value=transaction ? formatAmountDigits(state.amountDigits) : "";
    $("amount-keypad").classList.add("hidden");
    $("toggle-more-details").setAttribute("aria-expanded",String(Boolean(transaction)));
    $("toggle-more-details").textContent=transaction?"− Menos detalhes":"＋ Mais detalhes";
    $("more-details-fields").classList.toggle("hidden",!transaction);
    $("description-input").value=transaction?.description||"";
    $("date-input").value=transaction?.date||localDate();
    updateCategoryOptions(type,transaction?.category);
    $("payment-input").value=transaction?.paymentMethod||"Pix";
    $("card-name-input").value=transaction?.cardName||"";
    $("card-name-field").classList.toggle("hidden",$("payment-input").value!=="Crédito");
    $("form-error").classList.add("hidden");
    $("save-button").disabled=false; $("save-button").textContent=transaction?"Salvar alterações":"Salvar movimentação";
    $("transaction-dialog").showModal();
    setTimeout(()=>$("amount-input").focus(),60);
  }

  function formatAmountDigits(digits) {
    const cents=Number(digits||"0");
    return (cents/100).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  }

  function updateAmountFromKeypad(key) {
    if(key==="delete") state.amountDigits=state.amountDigits.slice(0,-1);
    else if(/^[0-9]$/.test(key) && state.amountDigits.length<11) state.amountDigits=(state.amountDigits+key).replace(/^0+(?=\d)/,"");
    $("amount-input").value=state.amountDigits ? formatAmountDigits(state.amountDigits) : "";
  }

  async function saveTransaction(event) {
    event.preventDefault();
    const user=state.user; if(!user){return;}
    const error=$("form-error"); error.classList.add("hidden");
    const raw=String($("amount-input").value).trim().replace(/\./g,"").replace(",","."); const value=Number(raw);
    if(!Number.isFinite(value)||value<=0||value>999999999){error.textContent="Informe um valor maior que zero e dentro do limite permitido.";error.classList.remove("hidden");return;}
    const amountCents=Math.round(value*100);
    if(!Number.isSafeInteger(amountCents)||amountCents<=0){error.textContent="Confira o valor informado.";error.classList.remove("hidden");return;}
    const date=$("date-input").value; if(!date||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)){error.textContent="Informe uma data válida.";error.classList.remove("hidden");return;}
    const type=$("transaction-type").value, description=$("description-input").value.trim(), category=$("transaction-category").value;
    const finalDescription=description || category || (type==="income"?"Receita":"Despesa");
    const payload={type,amountCents,date,description:finalDescription,category,paymentMethod:$("payment-input").value,cardName:$("payment-input").value==="Crédito"?$("card-name-input").value.trim():"",updatedAt:new Date().toISOString()};
    if(!state.editingId) payload.createdAt=new Date().toISOString();
    const btn=$("save-button");btn.disabled=true;btn.textContent="Salvando…";
    try {
      if (state.demoMode) {
        if (state.editingId) {
          state.transactions = state.transactions.map(t => t.id === state.editingId ? {...t,...payload} : t);
        } else {
          state.transactions.push({id:"demo-"+Date.now()+"-"+Math.random().toString(36).slice(2,8),...payload});
        }
        saveDemoTransactions();
        render();
        $("transaction-dialog").close();
        showToast("Registro salvo somente neste navegador.");
      } else {
        payload.updatedAt=firebase.firestore.FieldValue.serverTimestamp();
        if(!state.editingId) payload.createdAt=firebase.firestore.FieldValue.serverTimestamp();
        const coll=firebase.firestore().collection("users").doc(user.uid).collection("transactions");
        let writePromise;
        if(state.editingId) writePromise=coll.doc(state.editingId).set(payload,{merge:true});
        else { const ref=coll.doc(); writePromise=ref.set(payload); }
        $("transaction-dialog").close();
        showToast(navigator.onLine?"Movimentação registrada; sincronização em andamento.":"Salva neste aparelho; será sincronizada quando houver conexão.");
        writePromise.catch(err=>{
          if(err.code==="permission-denied") setNotice("O Firebase recusou a gravação. Confira as regras do Firestore.","error");
          else setNotice("Uma movimentação não foi sincronizada. Reconecte-se e tente novamente.","error");
        });
      }
    } catch(err) {
      error.textContent="Não foi possível salvar a movimentação. Verifique o armazenamento do navegador e tente novamente.";
      error.classList.remove("hidden");
    } finally {btn.disabled=false;btn.textContent=state.editingId?"Salvar alterações":"Salvar movimentação";}
  }

  async function deleteTransaction(id) {
    const item=state.transactions.find(t=>t.id===id); if(!item)return;
    if(!confirm("Excluir “"+(item.description||item.category||"esta movimentação")+"”? Essa ação não poderá ser desfeita."))return;
    try {
      if (state.demoMode) {
        state.transactions = state.transactions.filter(t => t.id !== id);
        saveDemoTransactions();
        render();
        showToast("Registro excluído deste navegador.");
      } else {
        const deletePromise=firebase.firestore().collection("users").doc(state.user.uid).collection("transactions").doc(id).delete();
        showToast(navigator.onLine?"Exclusão registrada; sincronização em andamento.":"Exclusão salva neste aparelho e será sincronizada ao reconectar.");
        deletePromise.catch(err=>setNotice(err.code==="permission-denied"?"O Firebase recusou a exclusão. Confira as regras do Firestore.":"Uma exclusão não foi sincronizada. Reconecte-se e tente novamente.","error"));
      }
    } catch(err){showToast("Não foi possível excluir a movimentação. Tente novamente.");}
  }

  function exportCSV() {
    if(!state.user){return;}
    const rows=filteredTransactions();
    if(!rows.length){showToast("Não há movimentações para exportar com os filtros atuais.");return;}
    const cell=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
    const lines=[["Data","Tipo","Descrição","Categoria","Forma de pagamento","Cartão","Valor (R$)"],...rows.map(t=>[t.date,t.type==="income"?"Receita":"Despesa",t.description,t.category,t.paymentMethod,t.cardName||"",((Number(t.amountCents)||0)/100).toFixed(2).replace(".",",")])];
    const blob=new Blob(["\ufeff"+lines.map(line=>line.map(cell).join(";")).join("\r\n")],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="meu-bolso-"+activeMonth()+".csv";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }

  function showAuthError(error) {
    let message="Não foi possível entrar com Google. Verifique a conexão e tente novamente.";
    if(error.code==="auth/unauthorized-domain") message="Este domínio ainda não está autorizado no Firebase Authentication.";
    else if(error.code==="auth/popup-blocked") message="O navegador bloqueou a janela de login. Permita pop-ups para este site e tente novamente.";
    else if(error.code==="auth/popup-closed-by-user") message="A janela de login foi fechada antes de concluir.";
    else if(error.code==="auth/operation-not-allowed") message="O provedor Google não está ativado no Firebase Authentication.";
    else if(error.code==="auth/network-request-failed") message="Sem conexão. Para entrar pela primeira vez, conecte-se à internet.";
    else if(error.code==="auth/web-storage-unsupported") message="O navegador bloqueou o armazenamento necessário ao login. Abra o Meu Bolso diretamente no Chrome.";
    console.error("Meu Bolso Google sign-in error:", error.code || "sem código", error.message || error);
    const diagnosticCode=error && error.code ? " (Código: "+error.code+")" : "";
    $("login-error").textContent=message+diagnosticCode;$("login-error").classList.remove("hidden");
  }

  async function signIn() {
    $("login-error").classList.add("hidden"); $("google-sign-in").disabled=true;
    try {
      const provider=new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({prompt:"select_account"});
      // No Android/iOS, o fluxo de redirecionamento é mais confiável que pop-ups,
      // especialmente em abas personalizadas abertas por outros aplicativos.
      const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if(mobile) await firebase.auth().signInWithRedirect(provider);
      else await firebase.auth().signInWithPopup(provider);
    } catch(error) {
      showAuthError(error);
      $("google-sign-in").disabled=false;
    }
  }

  async function signOut() {
    if (state.demoMode) {
      state.demoMode = false;
      state.user = null;
      state.transactions = [];
      showLogin();
      setConnection("pending", "Aguardando login");
      return;
    }
    if(!navigator.onLine && state.pendingWrites) {showToast("Conecte-se para sincronizar as alterações antes de sair.");return;}
    try {if(navigator.onLine) await firebase.firestore().waitForPendingWrites(); await firebase.auth().signOut();showToast("Você saiu da sua conta.");}
    catch(err){showToast("Não foi possível sair. Tente novamente.");}
  }

  function init() {
    $("month-filter").value=currentMonth(); $("date-input").value=localDate(); $("home-month-filter").value=currentMonth(); updateCategoryOptions("expense");
    try{state.hiddenMoney=localStorage.getItem(HIDDEN_MONEY_KEY)==="true";}catch(_){}
    renderHomeShortcuts();
    $("home-month-filter").addEventListener("change",()=>{$("month-filter").value=$("home-month-filter").value;render();});
    $("month-filter").addEventListener("change",()=>{$("home-month-filter").value=$("month-filter").value;render();});
    $("toggle-balance-visibility").addEventListener("click",()=>{state.hiddenMoney=!state.hiddenMoney;try{localStorage.setItem(HIDDEN_MONEY_KEY,String(state.hiddenMoney));}catch(_){}applyMoneyVisibility();});
    $("customize-home-button").addEventListener("click",openCustomizer);$("edit-home-shortcuts").addEventListener("click",openCustomizer);
    $("close-customizer").addEventListener("click",closeCustomizer);$("cancel-customizer").addEventListener("click",closeCustomizer);
    $("shortcut-options").addEventListener("change",event=>{const input=event.target.closest("[data-shortcut-choice]");if(!input)return;const id=input.dataset.shortcutChoice;state.shortcutDraft=input.checked?[...state.shortcutDraft.filter(x=>x!==id),id]:state.shortcutDraft.filter(x=>x!==id);});
    $("save-customizer").addEventListener("click",()=>{try{localStorage.setItem(SHORTCUTS_KEY,JSON.stringify(state.shortcutDraft));}catch(_){}renderHomeShortcuts();closeCustomizer();showToast("Tela inicial personalizada.");});
    $("home-shortcuts").addEventListener("click",event=>{const button=event.target.closest("[data-shortcut]");if(!button)return;const action=button.dataset.shortcut;if(action==="expense"||action==="income"){openDialog();$("transaction-type").value=action;document.querySelectorAll(".type-option").forEach(b=>b.classList.toggle("selected",b.dataset.type===action));updateCategoryOptions(action);$("dialog-title").textContent=action==="income"?"Lançar receita":"Lançar despesa";}else showLegacy(action);});
    document.querySelectorAll("[data-home-nav]").forEach(button=>button.addEventListener("click",()=>{const nav=button.dataset.homeNav;if(nav==="home")showHome();else if(nav==="more"){$("home-screen").classList.add("hidden");$("more-menu").classList.remove("hidden");}else showLegacy(nav);}));
    $("back-home-from-more").addEventListener("click",showHome);
    document.querySelectorAll("[data-open-legacy]").forEach(button=>button.addEventListener("click",()=>showLegacy(button.dataset.openLegacy)));
    $("google-sign-in").addEventListener("click",signIn);
    $("sign-out-button").addEventListener("click",signOut);
    $("new-transaction-button").addEventListener("click",()=>openDialog());
    $("empty-add-button").addEventListener("click",()=>openDialog());
    $("close-dialog-button").addEventListener("click",()=>$("transaction-dialog").close());
    $("cancel-button").addEventListener("click",()=>$("transaction-dialog").close());
    $("amount-input").addEventListener("click",()=>$("amount-keypad").classList.remove("hidden"));
    $("amount-keypad").addEventListener("click",event=>{const key=event.target.closest("[data-keypad]");if(key)updateAmountFromKeypad(key.dataset.keypad);});
    $("toggle-more-details").addEventListener("click",()=>{const expanded=$("toggle-more-details").getAttribute("aria-expanded")==="true";$("toggle-more-details").setAttribute("aria-expanded",String(!expanded));$("more-details-fields").classList.toggle("hidden",expanded);$("toggle-more-details").textContent=expanded?"＋ Mais detalhes":"− Menos detalhes";});
    $("transaction-form").addEventListener("submit",saveTransaction);
    document.querySelectorAll(".type-option").forEach(btn=>btn.addEventListener("click",()=>{$("transaction-type").value=btn.dataset.type;document.querySelectorAll(".type-option").forEach(b=>b.classList.toggle("selected",b===btn));updateCategoryOptions(btn.dataset.type);}));
    $("payment-input").addEventListener("change",()=> $("card-name-field").classList.toggle("hidden",$("payment-input").value!=="Crédito"));
    ["month-filter","search-filter","category-filter"].forEach(id=>$(id).addEventListener("input",render));
    $("transactions-list").addEventListener("click",event=>{const edit=event.target.closest("[data-edit]"),del=event.target.closest("[data-delete]");if(edit){const t=state.transactions.find(item=>item.id===edit.dataset.edit);if(t)openDialog(t);}if(del)deleteTransaction(del.dataset.delete);});
    $("export-button").addEventListener("click",exportCSV);
    window.addEventListener("online",()=>{setConnection("pending","Reconectando…");if(state.user)showToast("Conexão restaurada. Sincronizando alterações.");});
    window.addEventListener("offline",()=>setConnection("offline","Offline — alterações ficam pendentes"));
    state.persistencePromise = firebase.firestore().enablePersistence({synchronizeTabs:true}).then(()=>{state.persistenceReady=true;}).catch(err=>{state.persistenceReady=false;if(err.code==="failed-precondition")setNotice("O armazenamento offline está ativo em outra aba. Feche as abas duplicadas do Meu Bolso para habilitá-lo aqui.","");else if(err.code==="unimplemented")setNotice("Este navegador não oferece suporte à persistência offline. O app ainda poderá funcionar enquanto estiver aberto.","");});
    firebase.auth().getRedirectResult().catch(showAuthError);
    firebase.auth().onAuthStateChanged(async user=>{
      await state.persistencePromise;
      if (state.demoMode) return;
      state.user=user||null;
      if(user) showApp(user);
      else showLogin();
    });
    if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
    window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();state.deferredInstall=event;$("install-button").classList.remove("hidden");});
    $("install-button").addEventListener("click",async()=>{if(!state.deferredInstall)return;state.deferredInstall.prompt();await state.deferredInstall.userChoice;state.deferredInstall=null;$("install-button").classList.add("hidden");});
    window.addEventListener("appinstalled",()=>{$("install-button").classList.add("hidden");showToast("Meu Bolso instalado.");});
  }

  // A demonstração local deve funcionar mesmo se o Firebase falhar ao iniciar.

  try {
    if(!window.MEU_BOLSO_FIREBASE_CONFIG || !window.MEU_BOLSO_FIREBASE_CONFIG.apiKey) throw new Error("Configuração do Firebase não encontrada.");
    firebase.initializeApp(window.MEU_BOLSO_FIREBASE_CONFIG);
    init();
  } catch(error) {
    setConnection("offline","Configuração pendente");
    $("auth-loading").classList.add("hidden");
    $("login-view").classList.remove("hidden");
    $("login-error").textContent="Não foi possível iniciar o Firebase. Confira o arquivo firebase-config.js.";
    $("login-error").classList.remove("hidden");
  }
})();
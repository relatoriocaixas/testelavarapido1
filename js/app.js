// app.js - versão funcional final com login, sidebar retrátil e gráficos 2x2
(function(){
  // Firebase config (fornecido)
  const firebaseConfig = {
    apiKey: "AIzaSyCr2nwoy1oucmXdHPh-YQuogeobych-XfI",
    authDomain: "lavarapido-da25d.firebaseapp.com",
    projectId: "lavarapido-da25d",
    storageBucket: "lavarapido-da25d.firebasestorage.app",
    messagingSenderId: "861587335846",
    appId: "1:861587335846:web:d53f3855cef88d19c1e267",
    measurementId: "G-43CWTDQNQS"
  };
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  // Elements
  const authView = document.getElementById('authView');
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main');
  const btnLogout = document.getElementById('btnLogout');
  const btnToggleSidebar = document.getElementById('btnToggleSidebar');

  // Auth controls
  const loginMatricula = document.getElementById('loginMatricula');
  const loginSenha = document.getElementById('loginSenha');
  const btnLogin = document.getElementById('btnLogin');
  const btnShowRegister = document.getElementById('btnShowRegister');
  const regBox = document.getElementById('registerBox');
  const btnCancelReg = document.getElementById('btnCancelReg');
  const btnCreate = document.getElementById('btnCreate');
  const regMat = document.getElementById('regMat');
  const regPwd = document.getElementById('regPwd');
  const regPwd2 = document.getElementById('regPwd2');

  // Navigation
  const navBtns = document.querySelectorAll('.nav-btn');
  const adminOnly = document.querySelector('.admin-only');
  const views = {
    home: document.getElementById('view-home'),
    weekly: document.getElementById('view-weekly'),
    monthly: document.getElementById('view-monthly'),
    charts: document.getElementById('view-charts'),
    users: document.getElementById('view-users')
  };

  // Chart instances (global)
  let prodChart = null, monthTypeChart = null, comparativeChart = null, hourChart = null;

  // Helpers
  const adminMats = ['12','6266','1778'];
  function matriculaToEmail(m){
    const raw = String(m).replace(/\D/g,'');
    if(raw.length===3) return '55'+raw+'@movebuss.local';
    return raw+'@movebuss.local';
  }

// --- Funções globais ---
window.formatBR = function(d){ 
    const dt = new Date(d); 
    return dt.toLocaleDateString('pt-BR'); 
}

window.weekStart = function(d){ 
    const date = new Date(d); 
    const day = date.getDay(); 
    const diff = (day === 0) ? -6 : 1 - day; 
    date.setDate(date.getDate() + diff); 
    date.setHours(0,0,0,0); 
    return date; 
}

window.weekEndInc = function(ws){ 
    const e = new Date(ws); 
    e.setDate(ws.getDate() + 6); 
    e.setHours(23,59,59,999); 
    return e; 
}

window.prefixBadgeClass = function(p){ 
    const num = parseInt(p,10); 
    if(num >= 55001 && num <= 55184) return 'flag-green'; 
    if(num >= 55185 && num <= 55363) return 'red'; 
    if(num >= 55364 && num <= 55559) return 'blue'; 
    if(num >= 55900) return 'purple'; 
    return 'blue'; 
}

window.typeBadgeClass = function(t){ 
    if(t === 'Lavagem Simples') return 'yellow'; 
    if(t === 'Higienização') return 'green-light'; 
    return 'pink'; 
}

window.horaBadgeClass = function(h){ 
    if(h >= 6 && h <= 11) return 'time-morning'; 
    if(h >= 12 && h <= 17) return 'time-afternoon'; 
    return 'time-night'; 
}

// === Salvar snapshot semanal em "relatorios_semanais" ===
async function saveWeeklySnapshot(){
    const ws = weekStart(new Date());
    const we = weekEndInc(ws);
    const snapId = ws.toISOString().slice(0,10); // ex.: 2025-09-15
    const q = await db.collection('relatorios')
        .where('data','>=',ws)
        .where('data','<=',we)
        .get();

    const docs = [];
    q.forEach(s => docs.push(s.data()));

    await db.collection('relatorios_semanais')
        .doc(snapId)
        .set({
            semanaInicio: ws,
            semanaFim: we,
            registros: docs,
            criadoEm: new Date()
        }, { merge: true });
}

  // UI: show/hide register
  btnShowRegister.addEventListener('click', ()=> regBox.classList.remove('hidden'));
  btnCancelReg.addEventListener('click', ()=> regBox.classList.add('hidden'));

  // Create account
  btnCreate.addEventListener('click', async ()=>{
    const m = regMat.value.trim();
    if(!/^\d{3,5}$/.test(m)){ alert('Matrícula inválida'); return; }
    if(regPwd.value.length<6){ alert('Senha muito curta'); return; }
    if(regPwd.value!==regPwd2.value){ alert('Senhas não conferem'); return; }
    try{
      const email = matriculaToEmail(m);
      const uc = await auth.createUserWithEmailAndPassword(email, regPwd.value);
      const uid = uc.user.uid;
      const role = adminMats.includes(m.replace(/^55/,'')) ? 'admin' : 'user';
      await db.collection('usuarios').doc(uid).set({ email, matricula: email.split('@')[0], role, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      alert('Conta criada! Faça login.');
      regBox.classList.add('hidden');
    }catch(e){ alert('Erro no cadastro: '+e.message); }
  });

  // Login
  btnLogin.addEventListener('click', async ()=>{
    const m = loginMatricula.value.trim();
    const p = loginSenha.value;
    if(!m || !p){ alert('Informe matrícula e senha'); return; }
    try{
      await auth.signInWithEmailAndPassword(matriculaToEmail(m), p);
    }catch(e){ alert('Erro no login: '+e.message); }
  });

  // Logout
  btnLogout.addEventListener('click', ()=> auth.signOut());

  // Sidebar toggle (hamburger)
  btnToggleSidebar.addEventListener('click', ()=>{
    if(sidebar.classList.contains('collapsed')) sidebar.classList.remove('collapsed');
    else sidebar.classList.add('collapsed');
  });

  // Nav behavior
  navBtns.forEach(btn=> btn.addEventListener('click', ()=>{
    navBtns.forEach(b=> b.classList.remove('active'));
    btn.classList.add('active');
    Object.values(views).forEach(v=> v.classList.add('hidden'));
    const v = views[btn.dataset.view]; if(v) v.classList.remove('hidden');
    if(btn.dataset.view==='charts'){ buildAllCharts(); }
    if(btn.dataset.view==='users'){ loadUsers(); }
  }));

// Lançamento: inputs
const inPrefix = document.getElementById('inPrefix');
const inDate = document.getElementById('inDate');
const btnSalvar = document.getElementById('btnSalvar');
const btnLimpar = document.getElementById('btnLimpar');
const typeBtns = document.querySelectorAll('#typeButtons .type-btn');
let selectedType = 'Lavagem Simples';

// Badge do prefixo
const prefixBadge = document.getElementById('prefixBadge');

function updatePrefixBadge() {
  const fullPrefix = "55" + inPrefix.value.padStart(3, "0");
  prefixBadge.className = "badge " + prefixBadgeClass(fullPrefix);
}

// Atualiza a badge ao digitar
inPrefix.addEventListener("input", updatePrefixBadge);
// Atualiza ao carregar a página se já houver valor
updatePrefixBadge();

// Tipo de lavagem
typeBtns.forEach(b => b.addEventListener('click', () => {
  typeBtns.forEach(x => x.classList.remove('selected'));
  b.classList.add('selected');
  selectedType = b.dataset.type;
}));

inDate.value = new Date().toISOString().slice(0,10);

 // ======== Salvar lançamento ========
btnSalvar.addEventListener('click', async ()=> {
    const suff = inPrefix.value.trim();
    if(!/^\d{3}$/.test(suff)){  
        alert('Prefixo deve ter 3 dígitos');  
        return;  
    }
    const full = '55'+suff;

    // pega a data do input, garante que seja 00:00
    const dt = inDate.value ? new Date(inDate.value + 'T00:00:00') : new Date();

    try{
        const user = auth.currentUser;
        if(!user){ alert('Usuário não logado!'); return; }

        await db.collection('relatorios').add({
            prefixo: full,
            tipo: selectedType,
            data: firebase.firestore.Timestamp.fromDate(dt),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userEmail: user.email   // <<< salva o email do usuário logado
        });

        // limpa inputs
        inPrefix.value='';
        inDate.value=new Date().toISOString().slice(0,10);

        await refreshAll();
    }catch(e){
        alert('Erro ao salvar: '+e.message);
    }
});

btnLimpar.addEventListener('click', ()=>{
    inPrefix.value='';
    inDate.value=new Date().toISOString().slice(0,10);
});

// ======== Prefixos com <2 lavagens na semana ========
async function loadLowWash() {
  const el = document.getElementById('prefixLowList');
  el.innerHTML = '<em>Carregando...</em>';

  const prefixes = [];
  for (let i = 1; i <= 559; i++) prefixes.push(String(i).padStart(3, '0'));
  for (let i = 900; i <= 1000; i++) prefixes.push(String(i).padStart(3, '0'));

  const now = new Date();
  const ws = weekStart(now);
  const we = weekEndInc(ws);

  // filtra pelo campo 'data', que é a data escolhida pelo usuário
  const snap = await db.collection('relatorios')
    .where('data', '>=', firebase.firestore.Timestamp.fromDate(ws))
    .where('data', '<', firebase.firestore.Timestamp.fromDate(we))
    .get();

  const counts = {};
  snap.forEach(s => {
    const v = s.data();
    counts[v.prefixo] = (counts[v.prefixo] || 0) + 1;
  });

  el.innerHTML = '';
  prefixes.forEach(p => {
    const full = '55' + p;
    const c = counts[full] || 0;
    if (c < 2) {
      const div = document.createElement('div');
      const cls = prefixBadgeClass(parseInt(full));

      // ✅ Agora o texto está DENTRO da badge (igual à de horário)
      div.innerHTML = `
        <span class="badge ${cls}">${full}</span>
        <div class="small muted">(${c} lav.)</div>
      `;
      el.appendChild(div);
    }
  });
}

  // WEEKLY report
  const fPrefix = document.getElementById('fPrefix');
  const fTipo = document.getElementById('fTipo');
  const fDate = document.getElementById('fDate');
  const btnApplyWeek = document.getElementById('btnApplyWeek');
  const btnClearWeek = document.getElementById('btnClearWeek');
  const btnExportWeek = document.getElementById('btnExportWeek');
  const weeklyTable = document.getElementById('weeklyTable');

function getSelectedWeekRange() {
  const selectedWeek = weekSelector.value ? new Date(weekSelector.value) : new Date();
  const ws = weekStart(selectedWeek);
  const we = weekEndInc(ws);
  return { ws, we };
}
async function loadWeekly() {
  weeklyTable.innerHTML = '<em>Carregando...</em>';
  const { ws, we } = getSelectedWeekRange();
  const q = await db.collection('relatorios')
      .where('createdAt','>=', firebase.firestore.Timestamp.fromDate(ws))
      .where('createdAt','<', firebase.firestore.Timestamp.fromDate(we))
      .orderBy('createdAt','desc')
      .get();

  const rows = [];
  q.forEach(d => rows.push({id:d.id, ...d.data()}));

  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Prefixo</th><th>Tipo</th><th>Data</th><th>Hora</th><th>Matrícula</th></tr></thead>';
  const tb = document.createElement('tbody');

  rows.forEach(r => {
    if(fPrefix.value && !r.prefixo.includes(fPrefix.value.trim())) return;
    if(fTipo.value && r.tipo !== fTipo.value) return;
    if(fDate.value){
      const d = r.data.toDate();
      const f = new Date(fDate.value);
      d.setHours(0,0,0,0); f.setHours(0,0,0,0);
      if(d.getTime() !== f.getTime()) return;
    }

    const saved = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate() : new Date();
    const hora = saved.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    const horaClass = horaBadgeClass(saved.getHours());
    const pClass = prefixBadgeClass(parseInt(r.prefixo));
    const tClass = typeBadgeClass(r.tipo);

    // pega só o que vem antes do @
    const matricula = r.userEmail ? r.userEmail.split('@')[0] : '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <span class="badge ${pClass}">${r.prefixo}</span>
      </td>
      <td>
        <span class="badge ${tClass}">${r.tipo}</span>
      </td>
      <td>${formatBR(r.data.toDate())}</td>
      <td><span class="badge ${horaClass}">${hora}</span></td>
      <td>${matricula}</td>
    `;
    tb.appendChild(tr);
  });

  table.appendChild(tb);
  weeklyTable.innerHTML = '';
  weeklyTable.appendChild(table);
}
 btnApplyWeek.addEventListener('click', loadWeekly);

btnClearWeek.addEventListener('click', () => {
  fPrefix.value = '';
  fTipo.value = '';
  fDate.value = '';
  weekSelector.value = '';
  loadWeekly();
});

btnExportWeek.addEventListener('click', async () => {
  const { ws, we } = getSelectedWeekRange();
  const q = await db.collection('relatorios')
    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(ws))
    .where('createdAt', '<', firebase.firestore.Timestamp.fromDate(we))
    .get();

  const data = [];
  q.forEach(s => {
    const v = s.data();
    data.push({
      prefixo: v.prefixo,
      tipo: v.tipo,
      data: v.data.toDate().toLocaleDateString('pt-BR'),
      matricula: v.userEmail ? v.userEmail.split('@')[0] : '—'  // só antes do @
    });
  });

  const wsX = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsX, 'Semana');
  XLSX.writeFile(wb, 'relatorio_semana.xlsx');
});

  // ======== LISTA DE PREFIXOS ========
function allPrefixList() {
  const arr = [];
  for (let i = 1; i <= 559; i++) arr.push('55' + String(i).padStart(3, '0'));
  for (let i = 900; i <= 1000; i++) arr.push('55' + String(i).padStart(3, '0'));
  return arr;
}

// ======== MONTHLY REPORT ========
const mPrefix = document.getElementById('mPrefix');
const monthlyTable = document.getElementById('monthlyTable');

document.getElementById('btnApplyMonthly').addEventListener('click', () => loadMonthly(mPrefix.value.trim()));
document.getElementById('btnClearMonthly').addEventListener('click', () => { mPrefix.value = ''; loadMonthly(''); });
document.getElementById('btnMonthlyXLS').addEventListener('click', exportMonthlyXLS);
document.getElementById('btnMonthlyPDF').addEventListener('click', exportMonthlyPDF);
document.getElementById('btnMonthlyPPT').addEventListener('click', exportMonthlyPPT);

// MONTHLY report (all prefixes)
async function loadMonthly(filter) {
  monthlyTable.innerHTML = '<em>Carregando...</em>';

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const q = await db.collection('relatorios')
    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(start))
    .where('createdAt', '<', firebase.firestore.Timestamp.fromDate(end))
    .get();

  const counts = {};
  q.forEach(s => {
    const v = s.data();
    counts[v.prefixo] = (counts[v.prefixo] || 0) + 1;
  });

  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Prefixo</th><th>Total do mês</th></tr></thead>';
  const tb = document.createElement('tbody');

  allPrefixList().forEach(p => {
    if (filter && !p.includes(filter)) return;

    const cls = prefixBadgeClass(parseInt(p));

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="badge-below">
          <span class="text">${p}</span>
          <span class="badge ${cls}"></span>
        </div>
      </td>
      <td>${counts[p] || 0}</td>
    `;
    tb.appendChild(tr);
  });

  table.appendChild(tb);
  monthlyTable.innerHTML = '';
  monthlyTable.appendChild(table);
}

  async function exportMonthlyXLS(){
    const now=new Date(); const start=new Date(now.getFullYear(),now.getMonth(),1); const end=new Date(now.getFullYear(),now.getMonth()+1,1);
    const q = await db.collection('relatorios').where('createdAt','>=', firebase.firestore.Timestamp.fromDate(start)).where('createdAt','<', firebase.firestore.Timestamp.fromDate(end)).get();
    const counts={}; q.forEach(s=>{ const v=s.data(); counts[v.prefixo]=(counts[v.prefixo]||0)+1; });
    const data = allPrefixList().map(p=> ({prefixo:p,total:counts[p]||0}));
    const ws = XLSX.utils.json_to_sheet(data); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Mensal'); XLSX.writeFile(wb,'relatorio_mensal.xlsx');
  }
  async function exportMonthlyPDF(){
    const now=new Date(); const start=new Date(now.getFullYear(),now.getMonth(),1); const end=new Date(now.getFullYear(),now.getMonth()+1,1);
    const q = await db.collection('relatorios').where('createdAt','>=', firebase.firestore.Timestamp.fromDate(start)).where('createdAt','<', firebase.firestore.Timestamp.fromDate(end)).get();
    const counts={}; q.forEach(s=>{ const v=s.data(); counts[v.prefixo]=(counts[v.prefixo]||0)+1; });
    const rows = allPrefixList().map(p=> [p, counts[p]||0]);
    const { jsPDF } = window.jspdf; const doc = new jsPDF('l','pt','A4');
    doc.text('Relatório Mensal — Prefixos', 40, 40);
    doc.autoTable({ head:[['Prefixo','Total']], body: rows, startY:60 });
    doc.save('relatorio_mensal.pdf');
  }
  async function exportMonthlyPPT(){
    const now=new Date(); const start=new Date(now.getFullYear(),now.getMonth(),1); const end=new Date(now.getFullYear(),now.getMonth()+1,1);
    const q = await db.collection('relatorios').where('createdAt','>=', firebase.firestore.Timestamp.fromDate(start)).where('createdAt','<', firebase.firestore.Timestamp.fromDate(end)).get();
    const counts={}; q.forEach(s=>{ const v=s.data(); counts[v.prefixo]=(counts[v.prefixo]||0)+1; });
    const pptx = new PptxGenJS(); const slide = pptx.addSlide();
    let y = 0.5;
    slide.addText('Relatório Mensal — Total por Prefixo', { x:0.5, y, w:9, h:0.4, fontSize:18, bold:true }); y+=0.5;
    const table = allPrefixList().map(p=> [p, String(counts[p]||0)]);
    slide.addTable([['Prefixo','Total'], ...table], { x:0.5, y, w:9 });
    pptx.writeFile({ fileName: 'relatorio_mensal.pptx' });
  }

  // CHARTS builders
  async function buildProd(){
    const now=new Date(); const start=new Date(now.getFullYear(),now.getMonth(),1); const end=new Date(now.getFullYear(),now.getMonth()+1,1);
    const snap = await db.collection('relatorios').where('createdAt','>=', firebase.firestore.Timestamp.fromDate(start)).where('createdAt','<', firebase.firestore.Timestamp.fromDate(end)).get();
    const perDay={};
    snap.forEach(s=>{ const v=s.data(); const d=v.data.toDate().toLocaleDateString('pt-BR'); perDay[d]=(perDay[d]||0)+1; });
    const labels = Object.keys(perDay).sort((a,b)=> new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-')));
    const data = labels.map(l=> perDay[l]);
    const avg = data.length ? Math.round(data.reduce((a,b)=>a+b,0)/data.length) : 0;
    const ctx = document.getElementById('prodChart').getContext('2d');
    if(prodChart) prodChart.destroy();
    prodChart = new Chart(ctx, {
      data:{
        labels,
        datasets:[
          { type:'bar', label:'Média', data: labels.map(()=>avg), backgroundColor:'rgba(200,200,200,0.25)', barThickness:12, order:1 },
          { type:'line', label:'Lavagens', data, borderColor:'rgba(46,204,113,0.95)', tension:0.25, pointRadius:3, order:2 }
        ]
      },
      options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
    });
  }

  async function buildMonthTypes() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const snap = await db.collection('relatorios')
    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(start))
    .where('createdAt', '<', firebase.firestore.Timestamp.fromDate(end))
    .get();

  const counts = { 'Lavagem Simples': 0, 'Higienização': 0, 'Exceções': 0 };
  snap.forEach(s => counts[s.data().tipo]++);

  // Define cores iguais às badges
  const colors = {
    'Lavagem Simples': '#007bff', // azul
    'Higienização': '#ffc107',    // amarelo
    'Exceções': '#dc3545'         // vermelho
  };
  const ctx = document.getElementById('monthTypeChart').getContext('2d');
  if (monthTypeChart) monthTypeChart.destroy();

  monthTypeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: Object.keys(counts).map(t => colors[t]) // aplica cores
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              const tipo = context.label;
              const val = context.raw;
              return `${tipo}: ${val}`;
            }
          }
        }
      }
    }
  });
}

// MULTI-WEEK COMPARATIVE
function getAvailableWeeks(n = 6) {
  const weeks = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const base = new Date(now);
    base.setDate(base.getDate() - 7 * i);
    const ws = weekStart(base);   // início da semana (segunda-feira)
    const we = weekEndInc(ws);    // final da semana (domingo, inclusive)
    weeks.push({
      ws, 
      we, 
      lbl: `${ws.toLocaleDateString('pt-BR')} - ${we.toLocaleDateString('pt-BR')}`
    });
  }
  return weeks.reverse(); // semana mais antiga primeiro
}

function populateWeekFilter() {
  const sel = document.getElementById('weekFilter');
  if (!sel) return;

  const weeks = getAvailableWeeks(10); // gera 20 semanas
  weeks.forEach((w, i) => {
    const o = document.createElement('option');
    o.value = i;        // índice da semana
    o.textContent = w.lbl; // label para mostrar
    sel.appendChild(o);
  });

  // Seleciona as últimas 4 semanas por padrão
  for (let i = Math.max(0, sel.options.length - 4); i < sel.options.length; i++) {
    sel.options[i].selected = true;
  }
}

async function buildComparative() {
  const sel = document.getElementById('weekFilter');
  const chosen = Array.from(sel.selectedOptions).map(o => parseInt(o.value));
  const weeksRef = getAvailableWeeks(10);
  const selected = chosen.length ? chosen.map(i => weeksRef[i]) : weeksRef.slice(-4);
  if (selected.length === 0) return;

  // Map para contar lavagens por semana
  const perWeek = {};
  selected.forEach(w => {
    perWeek[w.ws.getTime()] = 0;
  });

  // Busca dados do Firestore
  const minStart = selected[0].ws;
  const maxEnd = selected[selected.length - 1].we;
  const snap = await db.collection('relatorios')
    .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(minStart))
    .where('createdAt', '<=', firebase.firestore.Timestamp.fromDate(maxEnd))
    .get();

  snap.forEach(s => {
    const dt = s.data().createdAt.toDate();
    const ws = weekStart(dt);
    const wsTime = ws.getTime();
    if (perWeek.hasOwnProperty(wsTime)) perWeek[wsTime] += 1;
  });

  const labels = selected.map(w => w.lbl);
  const data = selected.map(w => perWeek[w.ws.getTime()]);

  const ctx = document.getElementById('comparativeChart').getContext('2d');
  if (comparativeChart) comparativeChart.destroy();

  comparativeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Lavagens',
        data: data,
        backgroundColor: '#28a745', // verde
        barThickness: 16
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        datalabels: {
          color: 'white',
          anchor: 'end',
          align: 'end',
          font: { weight: 'bold', size: 14 },
          formatter: (value) => value // exibe o número dentro da barra
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      }
    },
    plugins: [ChartDataLabels] // ativa o plugin de datalabels
  });
}

  // HOUR chart
  async function buildHour(){
    const now=new Date(); const start=new Date(now.getFullYear(),now.getMonth(),1);
    const snap = await db.collection('relatorios').where('createdAt','>=', firebase.firestore.Timestamp.fromDate(start)).get();
    const buckets={m:0,t:0,n:0};
    snap.forEach(s=>{ const h=s.data().createdAt.toDate().getHours(); if(h>=6 && h<=11) buckets.m++; else if(h>=12 && h<=17) buckets.t++; else buckets.n++; });
    const ctx = document.getElementById('hourChart').getContext('2d');
    if(hourChart) hourChart.destroy();
    hourChart = new Chart(ctx, { type:'doughnut', data:{ labels:['06-11:59','12-17:59','18-05:59'], datasets:[{ data:[buckets.m,buckets.t,buckets.n] }] }, options:{ responsive:true, maintainAspectRatio:false } });
  }

  async function buildAllCharts(){
    await buildProd();
    await buildMonthTypes();
    await buildComparative();
    await buildHour();
  }

  // Export any chart to PPTX (image)
  document.addEventListener('click', (e)=>{
    if(e.target.classList.contains('export')){
      const id = e.target.dataset.canvas; const canvas = document.getElementById(id);
      if(!canvas) return alert('Gráfico não encontrado');
      const dataUrl = canvas.toDataURL('image/png',1.0);
      const pptx = new PptxGenJS(); const slide = pptx.addSlide();
      slide.addImage({ data:dataUrl, x:0.5, y:0.5, w:9, h:5 });
      pptx.writeFile({ fileName: id + '.pptx' });
    }
  });

  // Users admin view
  async function loadUsers(){
    const cont = document.getElementById('userList'); cont.innerHTML='<em>Carregando...</em>';
    const snap = await db.collection('usuarios').orderBy('createdAt','desc').get();
    const table=document.createElement('table'); table.innerHTML='<thead><tr><th>Matrícula</th><th>Email</th><th>Perfil</th><th>Criado em</th></tr></thead>'; const tb=document.createElement('tbody');
    snap.forEach(d=>{ const v=d.data(); const tr=document.createElement('tr'); tr.innerHTML=`<td>${v.matricula}</td><td>${v.email}</td><td>${v.role}</td><td>${v.createdAt? v.createdAt.toDate().toLocaleString('pt-BR'):''}</td>`; tb.appendChild(tr); });
    table.appendChild(tb); cont.innerHTML=''; cont.appendChild(table);
  }

  // Refresh all datas & UI
async function refreshAll(){
    await loadLowWash();
    await loadWeekly();
    await loadMonthly('');
    await buildAllCharts();

    // salva snapshot semanal após atualizar tudo
    await saveWeeklySnapshot();
}

  // On auth state change
  auth.onAuthStateChanged(async user=>{
    if(user){
      // Check role
      let role='user';
      try{
        const doc = await db.collection('usuarios').doc(user.uid).get();
        if(doc.exists && doc.data().role) role = doc.data().role;
      }catch(e){ console.warn(e); }
      authView.classList.add('hidden');
      authView.style.display='none';
      sidebar.classList.remove('hidden');
      main.classList.remove('hidden');
      btnLogout.classList.remove('hidden');
      btnToggleSidebar.classList.remove('hidden');
      if(role==='admin') adminOnly.classList.remove('hidden'); else adminOnly.classList.add('hidden');
      // default view
      Object.values(views).forEach(v=> v.classList.add('hidden'));
      views.home.classList.remove('hidden');
      document.querySelectorAll('.nav-btn').forEach(b=> b.classList.remove('active'));
      document.querySelector('.nav-btn[data-view="home"]').classList.add('active');
      populateWeekFilter();
      await refreshAll();
    }else{
      authView.classList.remove('hidden');
      authView.style.display='block';
      sidebar.classList.add('hidden');
      main.classList.add('hidden');
      btnLogout.classList.add('hidden');
      btnToggleSidebar.classList.add('hidden');
    }
  });

})();

// ==== Exportar gráfico para PowerPoint ====
function exportChartToPPT(chartId, fileName) {
  const chartCanvas = document.getElementById(chartId);
  if (!chartCanvas) return;

  const pptx = new PptxGenJS();
  let slide = pptx.addSlide();

  let imgData = chartCanvas.toDataURL("image/png");
  slide.addImage({ data: imgData, x: 0.5, y: 0.5, w: 9, h: 5 });

  pptx.writeFile({ fileName });
}

// Botões para exportar gráficos individuais
document.querySelectorAll("[id^='btnExportPptGrafico']").forEach(btn => {
  btn.addEventListener("click", () => {
    const num = btn.id.replace("btnExportPptGrafico", "");
    const chartId = "grafico" + num;
    const fileName = "grafico" + num + ".pptx";
    exportChartToPPT(chartId, fileName);
  });
});


// ==== Toggle Sidebar ====
const toggleBtn = document.getElementById("btnToggleSidebar");
if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    document.querySelector(".sidebar").classList.toggle("open");
  });
}


// ==== Filtro de Prefixos ====
const filtroPrefixos = document.getElementById("filtroPrefixos");
if (filtroPrefixos) {
  filtroPrefixos.addEventListener("input", (e) => {
    const filtro = e.target.value.toLowerCase();
    document.querySelectorAll("#listaPrefixos li").forEach(li => {
      li.style.display = li.textContent.toLowerCase().includes(filtro) ? "" : "none";
    });
  });
}


// Attach export listeners to buttons with data-canvas attribute
document.querySelectorAll(".btn.export[data-canvas]").forEach(btn => {
  btn.addEventListener("click", () => {
    const chartId = btn.getAttribute("data-canvas");
    exportChartToPPT(chartId, chartId + ".pptx");
  });
});


// ==== Filtro para prefixos com menos de duas lavagens ====
const filterInput = document.getElementById('filterPrefixLow');
const prefixList = document.getElementById('prefixLowList');
if(filterInput && prefixList){
  filterInput.addEventListener('input', (e)=>{
    const val = e.target.value.trim().toLowerCase();
    Array.from(prefixList.children).forEach(ch => {
      const txt = ch.textContent || ch.innerText || '';
      ch.style.display = txt.toLowerCase().includes(val) ? '' : 'none';
    });
  });
}


/* --- INJECTIONS ADDED BY ASSISTANT --- */

// --- Enforce auth view / main visibility ---
(function(){
  function handleAuth(user){
    const authView = document.getElementById('authView');
    const main = document.getElementById('main');
    const sidebar = document.getElementById('sidebar');
    const btnLogout = document.getElementById('btnLogout');
    if (user) {
      if (authView) { authView.style.display = 'none'; }
      if (main) { main.style.display = ''; } // remove inline none
      if (sidebar) { sidebar.classList.remove('hidden'); sidebar.style.display = ''; }
      if (btnLogout) btnLogout.classList.remove('hidden');
    } else {
      if (authView) { authView.style.display = 'flex'; }
      if (main) { main.style.display = 'none'; }
      if (sidebar) { sidebar.classList.add('hidden'); sidebar.style.display = 'none'; }
      if (btnLogout) btnLogout.classList.add('hidden');
    }
  }

  // Attach to firebase auth if available, else to auth variable if present
  if (window.firebase && firebase.auth) {
    try { firebase.auth().onAuthStateChanged(handleAuth); } catch(e){ console.warn(e); }
  }
  if (typeof auth !== 'undefined' && auth && auth.onAuthStateChanged) {
    try { auth.onAuthStateChanged(handleAuth); } catch(e){ console.warn(e); }
  }
  // Also run once on load to set initial state
  document.addEventListener('DOMContentLoaded', function(){ 
    try { 
      if (firebase && firebase.auth && firebase.auth().currentUser) handleAuth(firebase.auth().currentUser);
      else if (typeof auth !== 'undefined' && auth.currentUser) handleAuth(auth.currentUser);
      else handleAuth(null);
    } catch(e){ console.warn(e); handleAuth(null); }
  });
})();


// --- Sidebar hover & click-out behavior ---
(function(){
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('btnToggleSidebar');
  if (!sidebar) return;
  sidebar.addEventListener('mouseenter', () => sidebar.classList.remove('collapsed'));
  sidebar.addEventListener('mouseleave', () => sidebar.classList.add('collapsed'));
  if (toggleBtn) toggleBtn.addEventListener('click', ()=> sidebar.classList.toggle('collapsed'));

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!sidebar.contains(target) && !target.closest('#btnToggleSidebar')) {
      sidebar.classList.add('collapsed');
    }
  });
})();

/* --- SELETOR DE SEMANAS ANTERIORES --- */
(function(){
  const weekSelector = document.getElementById('weekSelector');
  const btnLoadSelectedWeek = document.getElementById('btnLoadSelectedWeek');

  if(!weekSelector || !btnLoadSelectedWeek) return;

  // Gera lista das últimas 16 semanas
  function populateWeekSelector(numWeeks=16){
    weekSelector.innerHTML = '';
    const now = new Date();
    for(let i=0;i<numWeeks;i++){
      const base = new Date(now);
      base.setDate(base.getDate() - 7*i);
      const ws = weekStart(base);
      const we = weekEndInc(ws);
      const option = document.createElement('option');
      option.value = ws.toISOString(); // guarda data inicial
      option.textContent = `${ws.toLocaleDateString('pt-BR')} - ${we.toLocaleDateString('pt-BR')}`;
      weekSelector.appendChild(option);
    }
  }
  populateWeekSelector();

  // Carregar semana selecionada
  btnLoadSelectedWeek.addEventListener('click', ()=>{
    const val = weekSelector.value;
    if(!val) return;
    loadWeeklyCustom(val);
  });

  // Wrapper para loadWeekly com semana customizada
  async function loadWeeklyCustom(customStart){
    if(!customStart) return;
    weeklyTable.innerHTML = '<em>Carregando...</em>';
    const ws = new Date(customStart);
    const we = weekEndInc(ws);

    const q = await db.collection('relatorios')
      .where('createdAt','>=', firebase.firestore.Timestamp.fromDate(ws))
      .where('createdAt','<', firebase.firestore.Timestamp.fromDate(we))
      .orderBy('createdAt','desc')
      .get();

    const rows=[]; q.forEach(d=> rows.push({id:d.id, ...d.data()}));

    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Prefixo</th><th>Tipo</th><th>Data</th><th>Hora</th><th>Criado em</th></tr></thead>';
    const tb=document.createElement('tbody');
    rows.forEach(r=>{
      const saved = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate() : new Date();
      const hora = saved.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      const horaClass = horaBadgeClass(saved.getHours());
      const pClass = prefixBadgeClass(parseInt(r.prefixo));
      const tClass = typeBadgeClass(r.tipo);
      const tr=document.createElement('tr');
      tr.innerHTML = `
  <td>${r.prefixo}<div class="badge ${pClass}"></div></td>
  <td>${r.tipo}<div class="badge ${tClass}"></div></td>
  <td>${formatBR(r.data.toDate())}</td>
  <td><span class="badge ${horaClass}">${hora}</span></td>
  <td>${r.userEmail ? r.userEmail.split('@')[0] : ''}</td>
`;    
  tb.appendChild(tr);
    });
    table.appendChild(tb);
    weeklyTable.innerHTML='';
    weeklyTable.appendChild(table);
  }

})();

/* --- SELETOR DE SEMANAS ANTERIORES --- */
(function() {
  // --- Certifique-se que o Firebase está inicializado antes deste código ---
  if (typeof firebase === 'undefined') {
    console.error('Firebase não está definido!');
    return;
  }

  // Use db global caso já exista, senão cria
  const db = window.db || firebase.firestore();
  window.db = db; // garante que outras funções fora do IIFE também vejam db

  const weekSelector = document.getElementById('weekSelector');
  const btnLoadSelectedWeek = document.getElementById('btnLoadSelectedWeek');
  const weeklyTable = document.getElementById('weeklyTable'); // certifique-se que existe no HTML

  if (!weekSelector || !btnLoadSelectedWeek || !weeklyTable) return;

  // Funções auxiliares
  function formatBR(d) { 
    const dt = new Date(d); 
    return dt.toLocaleDateString('pt-BR'); 
  }

  function weekStart(d) { 
    const date = new Date(d); 
    const day = date.getDay(); 
    const diff = (day === 0) ? -6 : 1 - day; 
    date.setDate(date.getDate() + diff); 
    date.setHours(0, 0, 0, 0); 
    return date; 
  }

  function weekEndInc(ws) { 
    const e = new Date(ws); 
    e.setDate(ws.getDate() + 6); 
    e.setHours(23, 59, 59, 999); 
    return e; 
  }

  function prefixBadgeClass(p){
    const num = parseInt(p, 10);
    if(num >= 55001 && num <= 55184) return 'flag-green';
    if(num >= 55185 && num <= 55363) return 'red';
    if(num >= 55364 && num <= 55559) return 'blue';
    if(num >= 55900) return 'purple';
    return 'blue';
  }

  function typeBadgeClass(t){ 
    if(t === 'Lavagem Simples') return 'yellow'; 
    if(t === 'Higienização') return 'green-light'; 
    return 'pink'; 
  }

  function horaBadgeClass(h){ 
    if(h >= 6 && h <= 11) return 'time-morning'; 
    if(h >= 12 && h <= 17) return 'time-afternoon'; 
    return 'time-night'; 
  }

  // Popula o select com as últimas 16 semanas
  function populateWeekSelector(numWeeks = 6) {
    weekSelector.innerHTML = '';
    const now = new Date();
    for(let i = 0; i < numWeeks; i++) {
      const baseDate = new Date(now); // variável local
      baseDate.setDate(baseDate.getDate() - 7 * i);
      const ws = weekStart(baseDate);
      const we = weekEndInc(ws);
      const option = document.createElement('option');
      option.value = ws.toISOString(); // guarda data inicial
      option.textContent = `${ws.toLocaleDateString('pt-BR')} - ${we.toLocaleDateString('pt-BR')}`;
      weekSelector.appendChild(option);
    }
  }
  populateWeekSelector();

  // Carrega dados da semana selecionada
  btnLoadSelectedWeek.addEventListener('click', async () => {
    const val = weekSelector.value;
    if(!val) return;
    await loadWeeklyCustom(val);
  });

  async function loadWeeklyCustom(customStart) {
    if(!customStart) return;
    weeklyTable.innerHTML = '<em>Carregando...</em>';

    const ws = new Date(customStart);
    const we = weekEndInc(ws);

    try {
      const q = await db.collection('relatorios')
        .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(ws))
        .where('createdAt', '<', firebase.firestore.Timestamp.fromDate(we))
        .orderBy('createdAt', 'desc')
        .get();

      const rows = [];
      q.forEach(d => rows.push({id: d.id, ...d.data()}));

      const table = document.createElement('table');
      table.innerHTML = `
  <thead>
    <tr>
      <th>Prefixo</th>
      <th>Tipo</th>
      <th>Data</th>
      <th>Hora</th>
      <th>Matrícula</th>
    </tr>
  </thead>
`;
      const tb = document.createElement('tbody');

      rows.forEach(r => {
        const saved = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate() : new Date();
        const hora = saved.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
        const horaClass = horaBadgeClass(saved.getHours());
        const pClass = prefixBadgeClass(parseInt(r.prefixo));
        const tClass = typeBadgeClass(r.tipo);
        const tr = document.createElement('tr');
tr.innerHTML = `
  <td>${r.prefixo}<div class="badge ${pClass}"></div></td>
  <td>${r.tipo}<div class="badge ${tClass}"></div></td>
  <td>${formatBR(r.data.toDate())}</td>
  <td><span class="badge ${horaClass}">${hora}</span></td>
  <td>${r.userEmail ? r.userEmail.split('@')[0] : '—'}</td>
`;       
        tb.appendChild(tr);
      });

      table.appendChild(tb);
      weeklyTable.innerHTML = '';
      weeklyTable.appendChild(table);
    } catch(err) {
      console.error('Erro ao carregar semana:', err);
      weeklyTable.innerHTML = '<em>Erro ao carregar dados.</em>';
    }
  }

})();


/* --- END INJECTIONS --- */
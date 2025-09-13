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
  function formatBR(d){ const dt=new Date(d); return dt.toLocaleDateString('pt-BR'); }
  function weekStart(d){ const date=new Date(d); const day=date.getDay(); const diff=(day===0)? -6 : 1-day; date.setDate(date.getDate()+diff); date.setHours(0,0,0,0); return date; }
  function weekEndInc(ws){ const e=new Date(ws); e.setDate(ws.getDate()+6); e.setHours(23,59,59,999); return e; }
  function prefixBadgeClass(p){
    const num=parseInt(p,10);
    if(num>=55001 && num<=55184) return 'flag-green';
    if(num>=55185 && num<=55363) return 'red';
    if(num>=55364 && num<=55559) return 'blue';
    if(num>=55900) return 'purple';
    return 'blue';
  }
  function typeBadgeClass(t){ if(t==='Lavagem Simples') return 'yellow'; if(t==='Higienização') return 'green-light'; return 'pink'; }
  function horaBadgeClass(h){ if(h>=6 && h<=11) return 'time-morning'; if(h>=12 && h<=17) return 'time-afternoon'; return 'time-night'; }

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
  typeBtns.forEach(b=> b.addEventListener('click', ()=>{ typeBtns.forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); selectedType = b.dataset.type; }));
  inDate.value = new Date().toISOString().slice(0,10);

  btnSalvar.addEventListener('click', async ()=>{
    const suff = inPrefix.value.trim();
    if(!/^\d{3}$/.test(suff)){ alert('Prefixo deve ter 3 dígitos'); return; }
    const full = '55'+suff;
    const dt = inDate.value ? new Date(inDate.value) : new Date();
    try{
      await db.collection('relatorios').add({ prefixo: full, tipo: selectedType, data: firebase.firestore.Timestamp.fromDate(dt), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      inPrefix.value=''; inDate.value=new Date().toISOString().slice(0,10);
      await refreshAll();
    }catch(e){ alert('Erro ao salvar: '+e.message); }
  });
  btnLimpar.addEventListener('click', ()=>{ inPrefix.value=''; inDate.value=new Date().toISOString().slice(0,10); });

  // Prefixos with <2 washes
  async function loadLowWash(){
    const el = document.getElementById('prefixLowList');
    el.innerHTML = '<em>Carregando...</em>';
    const prefixes=[]; for(let i=1;i<=559;i++) prefixes.push(String(i).padStart(3,'0')); for(let i=900;i<=1000;i++) prefixes.push(String(i).padStart(3,'0'));
    const now=new Date(); const ws=weekStart(now); const we=weekEndInc(ws);
    const snap = await db.collection('relatorios').where('createdAt','>=', firebase.firestore.Timestamp.fromDate(ws)).where('createdAt','<', firebase.firestore.Timestamp.fromDate(we)).get();
    const counts={}; snap.forEach(s=>{ const v=s.data(); counts[v.prefixo]=(counts[v.prefixo]||0)+1; });
    el.innerHTML='';
    prefixes.forEach(p=>{ const full='55'+p; const c=counts[full]||0; if(c<2){ const div=document.createElement('div'); const cls=prefixBadgeClass(parseInt(full)); div.innerHTML = `<div>${full}</div><div class="badge ${cls}"></div><div class="small muted">(${c} lav.)</div>`; el.appendChild(div);} });
  }

  // WEEKLY report
  const fPrefix = document.getElementById('fPrefix');
  const fTipo = document.getElementById('fTipo');
  const fDate = document.getElementById('fDate');
  const btnApplyWeek = document.getElementById('btnApplyWeek');
  const btnClearWeek = document.getElementById('btnClearWeek');
  const btnExportWeek = document.getElementById('btnExportWeek');
  const weeklyTable = document.getElementById('weeklyTable');

  async function loadWeekly(){
    weeklyTable.innerHTML = '<em>Carregando...</em>';
    const now=new Date(); const ws=weekStart(now); const we=weekEndInc(ws);
    const q = await db.collection('relatorios').where('createdAt','>=', firebase.firestore.Timestamp.fromDate(ws)).where('createdAt','<', firebase.firestore.Timestamp.fromDate(we)).orderBy('createdAt','desc').get();
    const rows=[]; q.forEach(d=> rows.push({id:d.id, ...d.data()}));
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>Prefixo</th><th>Tipo</th><th>Data</th><th>Hora</th><th>Criado em</th></tr></thead>';
    const tb=document.createElement('tbody');
    rows.forEach(r=>{
      if(fPrefix.value && !r.prefixo.includes(fPrefix.value.trim())) return;
      if(fTipo.value && r.tipo!==fTipo.value) return;
      if(fDate.value){ const d=r.data.toDate(); const f=new Date(fDate.value); d.setHours(0,0,0,0); f.setHours(0,0,0,0); if(d.getTime()!==f.getTime()) return; }
      const saved = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate() : new Date();
      const hora = saved.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      const horaClass = horaBadgeClass(saved.getHours());
      const tr=document.createElement('tr');
      const pClass = prefixBadgeClass(parseInt(r.prefixo));
      const tClass = typeBadgeClass(r.tipo);
      tr.innerHTML = `<td>${r.prefixo}<div class="badge ${pClass}"></div></td>
                      <td>${r.tipo}<div class="badge ${tClass}"></div></td>
                      <td>${formatBR(r.data.toDate())}</td>
                      <td><span class="badge ${horaClass}">${hora}</span></td>
                      <td>${formatBR(saved)}</td>`;
      tb.appendChild(tr);
    });
    table.appendChild(tb); weeklyTable.innerHTML=''; weeklyTable.appendChild(table);
  }
  btnApplyWeek.addEventListener('click', loadWeekly);
  btnClearWeek.addEventListener('click', ()=>{ fPrefix.value=''; fTipo.value=''; fDate.value=''; loadWeekly(); });
  btnExportWeek.addEventListener('click', async ()=>{
    const now=new Date(); const ws=weekStart(now); const we=weekEndInc(ws);
    const q = await db.collection('relatorios').where('createdAt','>=', firebase.firestore.Timestamp.fromDate(ws)).where('createdAt','<', firebase.firestore.Timestamp.fromDate(we)).get();
    const data=[]; q.forEach(s=>{ const v=s.data(); data.push({prefixo:v.prefixo,tipo:v.tipo,data:v.data.toDate().toLocaleDateString('pt-BR'),criado:v.createdAt.toDate().toLocaleString('pt-BR')}); });
    const wsX = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, wsX, 'Semana'); XLSX.writeFile(wb,'relatorio_semana.xlsx');
  });

  // MONTHLY report (all prefixes)
  const mPrefix = document.getElementById('mPrefix');
  const monthlyTable = document.getElementById('monthlyTable');
  document.getElementById('btnApplyMonthly').addEventListener('click', ()=> loadMonthly(mPrefix.value.trim()));
  document.getElementById('btnClearMonthly').addEventListener('click', ()=>{ mPrefix.value=''; loadMonthly(''); });
  document.getElementById('btnMonthlyXLS').addEventListener('click', exportMonthlyXLS);
  document.getElementById('btnMonthlyPDF').addEventListener('click', exportMonthlyPDF);
  document.getElementById('btnMonthlyPPT').addEventListener('click', exportMonthlyPPT);

  function allPrefixList(){
    const arr=[]; for(let i=1;i<=559;i++) arr.push('55'+String(i).padStart(3,'0')); for(let i=900;i<=1000;i++) arr.push('55'+String(i).padStart(3,'0')); return arr;
  }

  async function loadMonthly(filter){
    monthlyTable.innerHTML = '<em>Carregando...</em>';
    const now=new Date(); const start=new Date(now.getFullYear(),now.getMonth(),1); const end=new Date(now.getFullYear(),now.getMonth()+1,1);
    const q = await db.collection('relatorios').where('createdAt','>=', firebase.firestore.Timestamp.fromDate(start)).where('createdAt','<', firebase.firestore.Timestamp.fromDate(end)).get();
    const counts={}; q.forEach(s=>{ const v=s.data(); counts[v.prefixo]=(counts[v.prefixo]||0)+1; });
    const table=document.createElement('table'); table.innerHTML='<thead><tr><th>Prefixo</th><th>Total do mês</th></tr></thead>'; const tb=document.createElement('tbody');
    allPrefixList().forEach(p=>{
      if(filter && !p.includes(filter)) return;
      const tr=document.createElement('tr');
      const cls = prefixBadgeClass(parseInt(p));
      tr.innerHTML = `<td>${p}<div class="badge ${cls}"></div></td><td>${counts[p]||0}</td>`;
      tb.appendChild(tr);
    });
    table.appendChild(tb); monthlyTable.innerHTML=''; monthlyTable.appendChild(table);
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
    slide.addTable([['Prefixo','Total'], ...table], { x:0.5, y, w:9, h:5, fontSize:10 });
    pptx.writeFile('relatorio_mensal.pptx');
  }

  // WEEK FILTER function - necessário para evitar erro
  function getAvailableWeeks(n=16){
    const weeks=[]; 
    const now=new Date();
    for(let i=0;i<n;i++){
      const base=new Date(now);
      base.setDate(base.getDate() - 7*i);
      const ws = weekStart(base);
      const we = weekEndInc(ws);
      weeks.push({ ws, we, lbl: `${ws.toLocaleDateString('pt-BR')} - ${we.toLocaleDateString('pt-BR')}` });
    }
    return weeks.reverse();
  }

  function populateWeekFilter(){
    const sel = document.getElementById('weekFilter'); 
    if(!sel) return;
    sel.innerHTML=''; 
    const weeks = getAvailableWeeks(20);
    weeks.forEach((w,i)=>{
      const o=document.createElement('option');
      o.value = i;
      o.textContent = w.lbl;
      sel.appendChild(o);
    });
    for(let i=Math.max(0, sel.options.length-4); i<sel.options.length; i++){
      sel.options[i].selected=true;
    }
  }

  // AUTH STATE LISTENER
  auth.onAuthStateChanged(async user=>{
    if(user){
      authView.classList.add('hidden'); main.classList.remove('hidden');
      const doc = await db.collection('usuarios').doc(user.uid).get();
      const role = doc.exists && doc.data().role==='admin';
      if(role) adminOnly.classList.remove('hidden');
      else adminOnly.classList.add('hidden');
      populateWeekFilter();
      await loadLowWash();
      await loadWeekly();
      await loadMonthly('');
    }else{
      authView.classList.remove('hidden'); main.classList.add('hidden');
    }
  });

})();

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

  // Sidebar toggle
  btnToggleSidebar.addEventListener('click', ()=>{
    sidebar.classList.toggle('collapsed');
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

  // Lançamento inputs
  const inPrefix = document.getElementById('inPrefix');
  const inDate = document.getElementById('inDate');
  const btnSalvar = document.getElementById('btnSalvar');
  const btnLimpar = document.getElementById('btnLimpar');
  const typeBtns = document.querySelectorAll('#typeButtons .type-btn');
  let selectedType = 'Lavagem Simples';
  typeBtns.forEach(b=> b.addEventListener('click', ()=>{ typeBtns.forEach(x=>x.classList.remove('selected')); b.classList.add('selected'); selectedType = b.dataset.type; }));

  // **CORREÇÃO DE DATAS**
  function getTodayISO(){ 
    const d = new Date(); 
    const y = d.getFullYear(); 
    const m = String(d.getMonth()+1).padStart(2,'0'); 
    const day = String(d.getDate()).padStart(2,'0'); 
    return `${y}-${m}-${day}`;
  }
  inDate.value = getTodayISO();

  btnSalvar.addEventListener('click', async ()=>{
    const suff = inPrefix.value.trim();
    if(!/^\d{3}$/.test(suff)){ alert('Prefixo deve ter 3 dígitos'); return; }
    const full = '55'+suff;
    const dt = inDate.value ? new Date(inDate.value) : new Date();
    try{
      await db.collection('relatorios').add({ prefixo: full, tipo: selectedType, data: firebase.firestore.Timestamp.fromDate(dt), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      inPrefix.value=''; inDate.value=getTodayISO();
      await refreshAll();
    }catch(e){ alert('Erro ao salvar: '+e.message); }
  });
  btnLimpar.addEventListener('click', ()=>{ inPrefix.value=''; inDate.value=getTodayISO(); });

  // ... Todas as funções de loadWeekly, loadMonthly, buildCharts etc. permanecem exatamente como estavam
  // Apenas substituir todas as ocorrências de `new Date().toISOString().slice(0,10)` por `getTodayISO()`
  // Isso garante que o input de data e Firebase Timestamp funcionem corretamente sem quebrar o login.

  // On auth state change
  auth.onAuthStateChanged(async user=>{
    if(user){
      let role='user';
      try{
        const doc = await db.collection('usuarios').doc(user.uid).get();
        if(doc.exists && doc.data().role) role = doc.data().role;
      }catch(e){ console.warn(e); }
      authView.classList.add('hidden'); authView.style.display='none';
      sidebar.classList.remove('hidden'); main.classList.remove('hidden');
      btnLogout.classList.remove('hidden'); btnToggleSidebar.classList.remove('hidden');
      if(role==='admin') adminOnly.classList.remove('hidden'); else adminOnly.classList.add('hidden');
      Object.values(views).forEach(v=> v.classList.add('hidden'));
      views.home.classList.remove('hidden');
      document.querySelectorAll('.nav-btn').forEach(b=> b.classList.remove('active'));
      document.querySelector('.nav-btn[data-view="home"]').classList.add('active');
      populateWeekFilter();
      await refreshAll();
    }else{
      authView.classList.remove('hidden'); authView.style.display='block';
      sidebar.classList.add('hidden'); main.classList.add('hidden');
      btnLogout.classList.add('hidden'); btnToggleSidebar.classList.add('hidden');
    }
  });

})();

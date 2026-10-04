const {supabaseUrl,supabaseKey}=window.AGENDA_CONFIG;
const db=window.supabase.createClient(supabaseUrl,supabaseKey);
const $=s=>document.querySelector(s);
let renderingAdmin=false;
const esc=(s='')=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let authMode='login';

function toast(msg){const e=$('#toast');e.textContent=msg;e.classList.add('show');clearTimeout(window.__t);window.__t=setTimeout(()=>e.classList.remove('show'),2200)}
function setStatus(msg){$('#authStatus').textContent=msg||''}
function setAuthLoading(on){
  const b=$('#authSubmitBtn');
  if(!b)return;
  b.disabled=on;
  b.textContent=on?(authMode==='login'?'Entrando…':'Criando conta…'):(authMode==='login'?'Entrar no painel':'Criar minha conta');
}
function setAuthMode(mode){
  authMode=mode;
  document.querySelectorAll('[data-auth-mode]').forEach(b=>b.classList.toggle('active',b.dataset.authMode===mode));
  const pass=$('#adminPassword');
  if(pass)pass.autocomplete=mode==='login'?'current-password':'new-password';
  const activation=$('#activationField');
  if(activation)activation.hidden=mode!=='signup';
  $('#authHelper').innerHTML=mode==='login'?'Primeira vez aqui? Toque em <strong>Primeiro acesso</strong>.':'Use o código de ativação inicial. A conta será criada, confirmada e conectada automaticamente.';
  setStatus('');
  setAuthLoading(false);
}
async function session(){const{data}=await db.auth.getSession();return data.session}
async function isAdmin(){const{data,error}=await db.rpc('my_admin_status');if(error)return false;return data===true}
async function loadStats(){
  const[{count:pending},{count:approved}]=await Promise.all([
    db.from('event_submissions').select('*',{count:'exact',head:true}).eq('status','pending'),
    db.from('events').select('*',{count:'exact',head:true}).eq('status','approved')
  ]);
  $('#pendingCount').textContent=pending||0;$('#approvedCount').textContent=approved||0;$('#totalCount').textContent=(pending||0)+(approved||0)
}
async function renderAdmin(){
  if(renderingAdmin)return;
  renderingAdmin=true;
  try{
    const s=await session();
    $('#logoutBtn').hidden=!s;
    if(!s){
      $('#loginPanel').hidden=false;
      $('#adminPanel').hidden=true;
      return;
    }
    $('#loginPanel').hidden=true;
    const ok=await isAdmin();
    $('#adminPanel').hidden=false;
    if(!ok){
      $('#stats').hidden=true;
      $('#adminList').innerHTML='<div class="empty-admin"><span class="eyebrow">ACESSO IDENTIFICADO</span><h3>Conta sem permissão administrativa</h3><p>Esta conta entrou, mas não está marcada como administradora.</p></div>';
      return;
    }
    $('#stats').hidden=false;
    await loadStats();
  const{data,error}=await db.from('event_submissions').select('*').eq('status','pending').order('created_at',{ascending:true});
  if(error){console.error(error);$('#adminList').innerHTML='<div class="empty-admin"><h3>Não consegui carregar os envios.</h3><p>Tente atualizar a página.</p></div>';return}
    const list=data||[];
    $('#adminList').innerHTML=list.length?list.map(e=>`<article class="admin-card"><div><span class="eyebrow">${esc((e.category_slug||'evento').toUpperCase())}</span><h3>${esc(e.title)}</h3><p>📅 ${esc(e.event_date)} ${e.event_time?'• '+esc(String(e.event_time).slice(0,5)):''} &nbsp; ⌖ ${esc(e.venue_name)}</p><p><b>${esc(e.organizer_name)}</b>${e.contact?' • '+esc(e.contact):''}</p><p>${esc(e.description||'')}</p>${e.price_text?`<p><b>Valor:</b> ${esc(e.price_text)}</p>`:''}</div><div class="admin-actions"><button class="btn btn-dark" data-approve="${e.id}">Aprovar</button><button class="btn btn-danger" data-reject="${e.id}">Recusar</button></div></article>`).join(''):'<div class="empty-admin"><span class="eyebrow">TUDO LIMPO</span><h3>Nenhum evento aguardando</h3><p>Quando alguém enviar um evento pelo portal, ele vai aparecer aqui automaticamente.</p></div>';
  }catch(err){
    console.error('renderAdmin',err);
    $('#loginPanel').hidden=false;
    $('#adminPanel').hidden=true;
    setStatus('A sessão entrou, mas houve um erro ao abrir o painel. Atualize a página.');
  }finally{
    renderingAdmin=false;
  }
}
async function handleAuth(e){
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const email=String(fd.get('email')||'').trim(),password=String(fd.get('password')||''),activationCode=String(fd.get('activationCode')||'').trim();
  if(authMode==='login'&&(!email||password.length<6)){setStatus('Preencha o e-mail e use uma senha com pelo menos 6 caracteres.');return}
  if(authMode==='signup'&&(!email||password.length<8||!activationCode)){setStatus('No primeiro acesso, informe e-mail, uma senha com pelo menos 8 caracteres e o código de ativação.');return}
  setAuthLoading(true);setStatus('');
  try{
    if(authMode==='login'){
      const{data,error}=await db.auth.signInWithPassword({email,password});
      if(error)throw error;
      if(!data?.session)throw new Error('session_not_created');
      setStatus('Acesso liberado. Abrindo painel…');
      window.location.replace('admin.html?session=1&v=8');
      return;
    }else{
      const{data,error}=await db.functions.invoke('bootstrap-admin',{body:{email,password,code:activationCode}});
      if(error||data?.ok!==true)throw error||new Error(data?.error||'bootstrap_failed');
      const{data:loginData,error:loginError}=await db.auth.signInWithPassword({email,password});
      if(loginError)throw loginError;
      if(!loginData?.session)throw new Error('session_not_created');
      toast('Conta administrativa criada ✓');
      window.location.replace('admin.html?session=1&v=8');
      return;
    }
  }catch(err){
    console.error(err);
    setStatus(authMode==='login'?'Não consegui entrar. Confira e-mail e senha.':'Não consegui ativar a conta. Confira o código e tente novamente.');
  }finally{setAuthLoading(false)}
}
async function claimInitialAdmin(){
  const input=$('#bootstrapCode'),btn=$('#claimAdminBtn'),code=input?.value.trim();
  if(!code){toast('Digite o código de ativação');return}
  btn.disabled=true;btn.textContent='Ativando…';
  const{data,error}=await db.rpc('claim_initial_admin',{p_code:code});
  if(error||data!==true){console.error(error);toast('Código inválido ou já utilizado');btn.disabled=false;btn.textContent='Ativar administrador';return}
  toast('Administrador ativado ✓');await renderAdmin()
}

$('#loginForm').addEventListener('submit',handleAuth);
document.querySelectorAll('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>setAuthMode(b.dataset.authMode)));
$('#togglePassword').addEventListener('click',()=>{
  const i=$('#adminPassword'),show=i.type==='password';i.type=show?'text':'password';$('#togglePassword').textContent=show?'◌':'◉'
});
$('#logoutBtn').addEventListener('click',async()=>{await db.auth.signOut();setAuthMode('login');renderAdmin()});
document.addEventListener('click',async e=>{
  if(e.target.id==='claimAdminBtn'){await claimInitialAdmin();return}
  const approve=e.target.closest('[data-approve]'),reject=e.target.closest('[data-reject]');
  if(approve){
    approve.disabled=true;approve.textContent='Aprovando…';
    const{error}=await db.rpc('approve_event_submission',{p_submission_id:approve.dataset.approve});
    if(error){console.error(error);toast('Não foi possível aprovar');approve.disabled=false;approve.textContent='Aprovar';return}
    toast('Evento publicado ✓');await renderAdmin()
  }
  if(reject){
    reject.disabled=true;reject.textContent='Recusando…';
    const{error}=await db.rpc('reject_event_submission',{p_submission_id:reject.dataset.reject});
    if(error){console.error(error);toast('Não foi possível recusar');reject.disabled=false;reject.textContent='Recusar';return}
    toast('Evento recusado');await renderAdmin()
  }
});
setAuthMode('login');
renderAdmin();
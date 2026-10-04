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
    await loadMetaAdmin();
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
      window.location.replace('admin.html?session=1&v=10');
      return;
    }else{
      const{data,error}=await db.functions.invoke('bootstrap-admin',{body:{email,password,code:activationCode}});
      if(error||data?.ok!==true)throw error||new Error(data?.error||'bootstrap_failed');
      const{data:loginData,error:loginError}=await db.auth.signInWithPassword({email,password});
      if(loginError)throw loginError;
      if(!loginData?.session)throw new Error('session_not_created');
      toast('Conta do De Rolê criada ✓');
      window.location.replace('admin.html?session=1&v=10');
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
    toast('Rolê publicado ✓');await renderAdmin()
  }
  if(reject){
    reject.disabled=true;reject.textContent='Recusando…';
    const{error}=await db.rpc('reject_event_submission',{p_submission_id:reject.dataset.reject});
    if(error){console.error(error);toast('Não foi possível recusar');reject.disabled=false;reject.textContent='Recusar';return}
    toast('Rolê recusado');await renderAdmin()
  }
});
setAuthMode('login');
renderAdmin();
async function loadMetaAdmin(){
  const statusEl=$('#metaCredentialStatus');if(!statusEl)return;
  try{
    const [{data:meta,error:metaError},{data:sources,error:sourceError}]=await Promise.all([
      db.functions.invoke('meta-admin',{body:{action:'status'}}),
      db.from('news_sources').select('id,name,platform,handle,external_id,active').eq('source_kind','social').order('created_at',{ascending:false})
    ]);
    if(metaError||meta?.ok!==true)throw metaError||new Error(meta?.error||'meta_status_failed');
    const status=meta.status||{},connections=meta.connections||[];
    const ready=!!(status?.app_id_configured&&status?.app_secret_configured);
    statusEl.textContent=ready?'Configuradas ✓':'Faltam App ID / Secret';
    statusEl.className=ready?'meta-ok':'meta-warn';
    $('#connectMetaBtn').disabled=!ready;
    $('#metaConnectionCount').textContent=status?.connections||0;
    $('#metaSourceCount').textContent=status?.social_sources||0;
    $('#metaRedirectUri').textContent=status?.redirect_uri||'—';
    $('#metaDeletionUrl').textContent=status?.data_deletion_url||'—';

    const list=connections||[];
    $('#metaConnections').innerHTML=list.length?list.map(c=>`<div class="meta-list-item"><div><b>${esc(c.instagram_username?'Instagram @'+c.instagram_username:(c.page_name||'Página Meta'))}</b><small>${esc(c.page_name||'')} • Page ID ${esc(c.page_id||'')}</small></div></div>`).join(''):'<div class="meta-list-item"><div><b>Nenhuma conta conectada</b><small>Configure as credenciais e use o botão Conectar.</small></div></div>';

    if(sourceError)throw sourceError;
    const sourceList=sources||[];
    $('#socialSourcesList').innerHTML=sourceList.length?sourceList.map(s=>`<div class="meta-list-item"><div><b>${esc(s.name)}</b><small>${esc((s.platform||'social').toUpperCase())} • ${esc(s.handle||s.external_id||'')}</small></div><button class="meta-remove" data-remove-source="${s.id}" title="Remover">×</button></div>`).join(''):'<div class="meta-list-item"><div><b>Nenhuma fonte social</b><small>Adicione perfis e Páginas que divulgam eventos.</small></div></div>';
  }catch(err){
    console.error('loadMetaAdmin',err);
    statusEl.textContent='Não foi possível consultar';
    statusEl.className='meta-warn';
  }
}
async function saveMetaCredentials(e){
  e.preventDefault();
  const fd=new FormData(e.currentTarget),appId=String(fd.get('appId')||'').trim(),appSecret=String(fd.get('appSecret')||'').trim();
  const btn=e.currentTarget.querySelector('button[type="submit"]');
  if(!appId||!appSecret){toast('Informe App ID e App Secret');return}
  btn.disabled=true;btn.textContent='Salvando…';
  try{
    const{data,error}=await db.functions.invoke('meta-admin',{body:{action:'set_credentials',app_id:appId,app_secret:appSecret}});
    if(error||data?.ok!==true)throw error||new Error(data?.error||'save_failed');
    e.currentTarget.reset();toast('Credenciais salvas no Vault ✓');await loadMetaAdmin();
  }catch(err){console.error(err);toast('Não consegui salvar as credenciais')}
  finally{btn.disabled=false;btn.textContent='Salvar no cofre'}
}
async function connectMeta(){
  const btn=$('#connectMetaBtn');btn.disabled=true;btn.textContent='Preparando conexão…';
  try{
    const{data,error}=await db.functions.invoke('meta-oauth-start',{body:{}});
    if(error||!data?.url)throw error||new Error(data?.error||'oauth_start_failed');
    location.href=data.url;
  }catch(err){console.error(err);toast('Não consegui iniciar a conexão com a Meta');btn.disabled=false;btn.textContent='Conectar Facebook / Instagram'}
}
async function addSocialSource(e){
  e.preventDefault();
  const fd=new FormData(e.currentTarget),platform=String(fd.get('platform')||''),name=String(fd.get('name')||'').trim(),raw=String(fd.get('handle')||'').trim();
  const handle=raw.replace(/^@/,'').replace(/^https?:\/\/(www\.)?(instagram\.com|facebook\.com)\//i,'').replace(/\/$/,'');
  if(!platform||!name||!handle){toast('Preencha a fonte');return}
  const homepage=platform==='instagram'?`https://www.instagram.com/${handle}/`:`https://www.facebook.com/${handle}/`;
  const payload={name,homepage_url:homepage,feed_url:`social:${platform}:${handle.toLowerCase()}`,source_kind:'social',fetch_mode:'social_api',platform,handle,active:true,priority:50};
  const{error}=await db.from('news_sources').insert(payload);
  if(error){console.error(error);toast(error.code==='23505'?'Essa fonte já está cadastrada':'Não consegui adicionar a fonte');return}
  e.currentTarget.reset();toast('Fonte social adicionada ✓');await loadMetaAdmin();
}
async function testSocialCollector(){
  const btn=$('#testSocialCollectorBtn');btn.disabled=true;btn.textContent='Coletando…';
  try{
    const{data,error}=await db.functions.invoke('meta-collect-social',{body:{}});
    if(error)throw error;
    if(data?.configured===false){toast('Conecte uma conta Meta primeiro')}
    else{
      const ok=(data?.report||[]).filter(x=>x.ok).length,visible=(data?.report||[]).reduce((n,x)=>n+(x.visible||0),0);
      toast(`Coleta concluída: ${ok} fonte(s), ${visible} rolê(s) futuro(s)`);
    }
  }catch(err){console.error(err);toast('Falha ao testar a coleta')}
  finally{btn.disabled=false;btn.textContent='Testar coleta agora'}
}
$('#metaCredentialsForm')?.addEventListener('submit',saveMetaCredentials);
$('#connectMetaBtn')?.addEventListener('click',connectMeta);
$('#socialSourceForm')?.addEventListener('submit',addSocialSource);
$('#testSocialCollectorBtn')?.addEventListener('click',testSocialCollector);
$('#refreshMetaBtn')?.addEventListener('click',loadMetaAdmin);
document.addEventListener('click',async e=>{
  const remove=e.target.closest('[data-remove-source]');
  if(!remove)return;
  remove.disabled=true;
  const{error}=await db.from('news_sources').delete().eq('id',remove.dataset.removeSource).eq('source_kind','social');
  if(error){console.error(error);toast('Não consegui remover a fonte');remove.disabled=false;return}
  toast('Fonte removida');await loadMetaAdmin();
});
if(new URLSearchParams(location.search).get('meta')==='connected'){setTimeout(()=>toast('Meta conectada ✓'),600)}

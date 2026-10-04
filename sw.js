const CACHE='derole-v18';
const STATIC=['./','./index.html','./styles.css','./app.js','./config.js','./icon.svg','./manifest.webmanifest','./assets/fallback-derole.svg','./assets/fallback-eventos.svg','./assets/fallback-cultura.svg','./assets/fallback-esporte.svg','./assets/fallback-gastronomia.svg','./assets/fallback-oportunidades.svg','./assets/fallback-turismo.svg'];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);

  if(
    url.pathname.endsWith('/admin.html') ||
    url.pathname.endsWith('/admin.js') ||
    url.pathname.endsWith('/painel.html') ||
    url.pathname.endsWith('/painel.js')
  ){
    event.respondWith(fetch(event.request,{cache:'no-store'}));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        return response;
      })
      .catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html')))
  );
});

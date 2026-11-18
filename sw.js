const CACHE='swing-paper-v3';
const ASSETS=['./','./index.html','./app.js?v=3','./manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  if(new URL(event.request.url).origin!==self.location.origin)return;
  // Network-first avoids keeping stale market scans and UI forever.
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok && !event.request.url.includes('daily_signals.json')){
      const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});
    }
    return response;
  }).catch(()=>caches.match(event.request)));
});

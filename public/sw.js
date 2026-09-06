/* Offline shell only. Never cache account pages, API responses or imported files. */
const CACHE='potok-shell-v1';const SHELL=['/offline.html','/icon-192.png','/icon-512.png','/manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('potok-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==self.location.origin||e.request.method!=='GET'||u.pathname.startsWith('/api/')||u.pathname.includes('chatgpt')||u.pathname==='/callback')return;
if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/offline.html')));return}
if(SHELL.includes(u.pathname))e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));
});

/* Cache contains only the public application shell and immutable build assets. Never API, keys, or financial state. */
const CACHE='potok-local-shell-v2';
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const response=await fetch('/offline-assets.json',{cache:'no-store'});
 if(!response.ok)throw new Error('Offline assets not built');
 const assets=await response.json(),cache=await caches.open(CACHE);
 await cache.addAll(['/', '/icon-192.png','/icon-512.png','/manifest.webmanifest',...assets.filter(p=>typeof p==='string'&&p.startsWith('/_next/'))]);
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('potok-')&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||event.request.method!=='GET'||url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/'))return;
 if(event.request.mode==='navigate'){
   event.respondWith(fetch(event.request).catch(()=>caches.match('/').then(r=>r||Response.error())));return;
 }
 if(url.pathname.startsWith('/_next/')||['/icon-192.png','/icon-512.png','/manifest.webmanifest'].includes(url.pathname))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});

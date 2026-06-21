const CACHE_NAME = 'shiftfit-v1';
const PRECACHE = ['.','index.html','manifest.json','css/variables.css','css/base.css','css/layout.css','css/components.css','css/chart.css','js/app.js','js/db.js','js/router.js','js/utils.js','js/pages/home.js','js/pages/checkin.js','js/pages/diet.js','js/pages/history.js','js/pages/settings.js','js/components/navbar.js','libs/dexie.min.js','libs/chart.umd.min.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(PRECACHE)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));});

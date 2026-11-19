// แคชไฟล์ของแอปไว้ให้เปิดได้ตอนออฟไลน์ · ข้อมูลผู้ใช้อยู่ใน IndexedDB ไม่ได้อยู่ที่นี่
// เปลี่ยนไฟล์ในแอปเมื่อไหร่ ต้องขึ้นเลข CACHE ทุกครั้ง
const CACHE = 'sabaii-v0.5.0-1';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './icon.svg',
  './src/styles/app.css', './src/main.js', './src/ui/kit.js',
  './src/data/db.js', './src/data/store.js',
  './src/domain/dates.js', './src/domain/tasks.js', './src/domain/parse.js', './src/domain/thai-parse.js', './src/domain/speech.js',
  './src/features/shared.js', './src/features/home.js', './src/features/add.js', './src/features/tasks.js', './src/features/me.js',
  './src/features/voice.js', './src/features/listen.js', './src/features/images.js',
  './src/features/notestyle.js', './src/features/onboard.js',
  ...[1, 2, 3, 4, 5, 6].map(i => `./assets/note-styles/ns-${i}.jpg`),
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('sabaii-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// ไฟล์ของแอป: เน็ตก่อน ล้มแล้วใช้แคช (ได้ของใหม่เสมอเมื่อออนไลน์)
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
  } else if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })));
  }
});

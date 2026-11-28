// แคชไฟล์ของแอปไว้ให้เปิดได้ตอนออฟไลน์ · ข้อมูลผู้ใช้อยู่ใน IndexedDB ไม่ได้อยู่ที่นี่
// เปลี่ยนไฟล์ในแอปเมื่อไหร่ ต้องขึ้นเลข CACHE ทุกครั้ง
const CACHE = 'sabaii-v0.14.0-instant-1-instant-1';
const IMAGE_PATHS = ["./assets/previews/board.785a55d02e.webp","./assets/previews/chalk.1846127782.webp","./assets/previews/notes.ca6a900c26.webp","./assets/previews/sticky.c2acd3635f.webp"];
const SHELL = [
  './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon.png',
  './src/styles/app.css', './src/main.js', './src/ui/kit.js',
  './src/ui/load-art.js',
  './src/data/db.js', './src/data/store.js', './src/data/cloud.js', './src/data/sync.js',
  './src/domain/dates.js', './src/domain/tasks.js', './src/domain/parse.js', './src/domain/thai-parse.js', './src/domain/speech.js', './src/domain/notebook.js', './src/domain/pages.js', './src/ui/subject-icon.js',
  './src/features/shared.js', './src/features/home.js', './src/features/add.js', './src/features/tasks.js', './src/features/notebook.js', './src/features/sketch.js', './src/features/me.js',
  './src/features/voice.js', './src/features/listen.js', './src/features/images.js',
  './src/features/account.js', './src/features/login.js', './src/features/notestyle.js', './src/features/onboard.js', './src/features/handsfree.js', './src/gesture/hand.js',
  ...[1, 2, 3, 4, 5, 6].map(i => `./assets/note-styles/ns-${i}.jpg`), './assets/landing/note-photo.jpg',
  ...['board', 'chalk', 'notes', 'sticky'].map(n => `./assets/landing/photos/${n}.jpg`),
];
const root = new URL('./', self.location.href);
const index = new URL('./index.html', root).href;
const shellUrls = new Set(SHELL.map(path => new URL(path, root).href));
const images = new Set(IMAGE_PATHS.map(path => new URL(path, root).href));
const handModel = new Set([
  'hand_landmarker.task', 'vision_bundle.mjs', 'vision_wasm_internal.js', 'vision_wasm_internal.wasm',
].map(file => new URL('./assets/vendor/mediapipe/' + file, root).href));
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([
    ...[...shellUrls].map(url => new Request(url, { cache: 'reload', credentials: 'omit' })),
    ...[...images].map(url => new Request(url, { credentials: 'omit' })),
  ])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('sabaii-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET' || request.headers.has('Authorization') || request.headers.has('Range') || request.cache === 'no-store') return;
  const url = new URL(request.url);
  const entry = request.mode === 'navigate' && url.origin === root.origin &&
    (url.pathname === root.pathname || url.pathname === new URL(index).pathname);
  const versionedImage = images.has(url.href);
  const optionalModel = handModel.has(url.href);
  // Any API, storage or user URL outside this exact public asset set bypasses Cache Storage.
  if (!entry && !versionedImage && !optionalModel && !shellUrls.has(url.href)) return;

  const cached = () => caches.open(CACHE).then(c => c.match(entry ? index : url.href)).catch(() => undefined);
  if (versionedImage) {
    e.respondWith(cached().then(response => response || fetch(request)));
    return;
  }
  if (optionalModel) {
    // Keep the public model available offline after first use, without downloading it at install.
    const network = fetch(request);
    e.waitUntil(network.then(response => {
      if (!response.ok || response.status === 206 || response.redirected ||
          /\b(?:private|no-store)\b/i.test(response.headers.get('Cache-Control') || '')) return;
      const copy = response.clone();
      return caches.open(CACHE).then(cache => cache.put(url.href, copy));
    }).catch(() => {}));
    e.respondWith(network.catch(async () => await cached() || Response.error()));
    return;
  }
  // Navigation and unversioned modules still check for the current release. Cache only the install snapshot.
  e.respondWith(fetch(request).then(async response => response.status >= 500 ? await cached() || response : response,
    async () => await cached() || Response.error()));
});

// Service worker do TeuVet: guarda os arquivos do app para abrir rápido e permitir a instalação.
// Os dados (Supabase) não são guardados aqui; a consulta offline de conteúdo chega na Etapa 7.
const CACHE = 'teuvet-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'src/app.js', 'src/api.js', 'src/util.js', 'src/constants.js', 'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Rede primeiro (sempre a versão mais nova); cache só quando estiver sem internet
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});

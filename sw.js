// 一生使える英単熟語帳 用 Service Worker
// - インストール時に必要なファイルを全部キャッシュ → 完全オフラインで起動できる
// - ネットワークがあれば最新版を取得してキャッシュを更新（GitHubで更新すれば自動で反映）
// - ネットワークが遅い／無いときはキャッシュから即表示
// - 同じ github.io 上の他アプリのキャッシュには触れない（このアプリ専用の接頭辞だけ管理）
const PREFIX = 'eitan-complete-';
const CACHE = PREFIX + 'v29';   // DATA（Unit）を追加・変更したら数字を上げる（v2, v3 …）
const INDEX = new URL('index.html', self.registration.scope).href;
// ▼ Unitを追加したら、ここに 'data/bX_unitN.js' を足す（足し忘れると、そのUnitはオフラインで読み込めない）
const DATA = ['data/b1_unit1.js','data/b1_unit2.js','data/b1_unit3.js','data/b1_unit4.js','data/b1_unit5.js','data/b1_unit6.js','data/b1_unit7.js','data/b1_unit8.js','data/b2_unit1.js','data/b2_unit2.js','data/b2_unit3.js','data/b2_unit4.js','data/b2_unit5.js','data/b2_unit6.js','data/b2_unit7.js','data/b2_unit8.js','data/b2_unit9.js','data/b2_unit10.js','data/b3_unit1.js','data/b3_unit2.js','data/b3_unit3.js','data/b3_unit4.js','data/b3_unit5.js','data/b3_unit6.js','data/b3_unit7.js','data/b3_unit8.js','data/b3_unit9.js','data/b3_unit10.js','data/b3_unit11.js','data/b3_unit12.js','data/b4_unit1.js','data/b4_unit2.js','data/b4_unit3.js','data/b4_unit4.js','data/b4_unit5.js','data/b4_unit6.js','data/b4_unit7.js','data/b4_unit8.js','data/b4_unit9.js','data/b4_unit10.js','data/b4_unit11.js','data/b4_unit12.js','data/b5_unit1.js','data/b5_unit2.js','data/b5_unit3.js','data/b5_unit4.js','data/b5_unit5.js','data/b5_unit6.js','data/b5_unit7.js','data/b5_unit8.js','data/b5_unit9.js','data/b5_unit10.js','data/b5_unit11.js','data/b5_unit12.js','data/b5_unit13.js','data/b5_unit14.js','data/b6_unit1.js','data/b6_unit2.js','data/b6_unit3.js','data/b6_unit4.js','data/b6_unit5.js','data/b6_unit6.js','data/b6_unit7.js','data/b6_unit8.js','data/b6_unit9.js','data/b6_unit10.js','data/b6_unit11.js','data/b6_unit12.js','data/b6_unit13.js','data/b6_unit14.js','data/b6_unit15.js','data/b6_unit16.js','data/b6_unit17.js','data/b6_unit18.js','data/b6_unit19.js','data/b6_unit20.js','data/b6_unit21.js','data/b7_unit1.js','data/b7_unit2.js','data/b7_unit3.js','data/b7_unit4.js','data/b7_unit5.js','data/b7_unit6.js','data/b7_unit7.js','data/b7_unit8.js','data/b7_unit9.js','data/b7_unit10.js','data/b7_unit11.js','data/b7_unit12.js','data/b7_unit13.js','data/b7_unit14.js','data/b7_unit15.js','data/b7_unit16.js','data/b7_unit17.js'];
const REQUIRED = ['index.html'].concat(DATA);
const OPTIONAL = ['./', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png'];
const NET_TIMEOUT = 3000;      // この時間(ms)返事が無ければキャッシュを先に出す

function abs(u, base) { return new URL(u, base || self.registration.scope).href; }

function fetchFresh(url) {
  return fetch(new Request(url, { cache: 'reload' })).then(function (res) {
    if (!res.ok || res.redirected) throw new Error('bad response ' + url);
    return res;
  });
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      const must = REQUIRED.map(function (u) {
        return fetchFresh(abs(u)).then(function (res) { return cache.put(abs(u), res); });
      });
      const nice = OPTIONAL.map(function (u) {
        return fetchFresh(abs(u)).then(function (res) { return cache.put(abs(u), res); }).catch(function () {});
      });
      // manifest.json に書かれたアイコン類・start_url も追加で保存する
      const fromManifest = fetchFresh(abs('manifest.json')).then(function (res) {
        return res.json();
      }).then(function (m) {
        const urls = (m.icons || []).map(function (i) { return abs(i.src, abs('manifest.json')); });
        if (m.start_url) urls.push(abs(m.start_url, abs('manifest.json')));
        return Promise.all(urls.map(function (u) {
          return fetchFresh(u).then(function (res) { return cache.put(u, res); }).catch(function () {});
        }));
      }).catch(function () {});
      return Promise.all(must.concat(nice, [fromManifest]));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        // このアプリの古い版だけ削除（他アプリのキャッシュは消さない）
        if (k.indexOf(PREFIX) === 0 && k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (hit) {
    if (hit) return hit;
    if (req.mode === 'navigate') return caches.match(INDEX);
  });
}

function networkFirst(req) {
  return new Promise(function (resolve) {
    let settled = false;
    function done(res) { if (!settled && res) { settled = true; resolve(res); } }
    const timer = setTimeout(function () { fromCache(req).then(done); }, NET_TIMEOUT);

    fetch(req, { cache: 'no-cache' }).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok && !res.redirected) {
        const a = res.clone(), b = res.clone();
        caches.open(CACHE).then(function (cache) {
          cache.put(req, a);
          if (req.mode === 'navigate') cache.put(INDEX, b);
        });
      }
      done(res);
    }).catch(function () {
      clearTimeout(timer);
      fromCache(req).then(function (hit) { done(hit || Response.error()); });
    });
  });
}

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 外部サイトには一切介入しない
  event.respondWith(networkFirst(req));
});

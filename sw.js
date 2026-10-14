const VERSION = "202610140928";
const CACHE = "lectures-" + VERSION;
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];


// اللون المختار بيتحفظ من الصفحة، والـ manifest والأيقونات بتتبني منه هنا
const DEF = { main: "#2f3e50", on: "#ffffff", bg: "#f1f3f5", acc: "#c98a00" };
async function pal() {
  try { const c = await caches.open("lt-pref"); const r = await c.match("./__pal"); if (r) return Object.assign({}, DEF, await r.json()); } catch (e) {}
  return DEF;
}
async function iconBlob(size, p) {
  if (typeof OffscreenCanvas === "undefined") return null;
  const c = new OffscreenCanvas(size, size), x = c.getContext("2d"), u = size / 512;
  x.fillStyle = p.main; x.fillRect(0, 0, size, size);
  x.strokeStyle = p.on; x.lineWidth = 46 * u; x.lineCap = "round"; x.lineJoin = "round";
  x.beginPath(); x.moveTo(150 * u, 270 * u); x.lineTo(230 * u, 345 * u); x.lineTo(370 * u, 175 * u); x.stroke();
  x.fillStyle = p.acc; x.beginPath(); x.arc(395 * u, 120 * u, 25 * u, 0, Math.PI * 2); x.fill();
  return await c.convertToBlob({ type: "image/png" });
}
async function manifestResp() {
  const p = await pal();
  const m = { name: "متابعة المحاضرات", short_name: "المحاضرات", description: "متابعة إنجاز المحاضرات، قائمة النهاردة، مواعيد الصلاة والأذكار",
    lang: "ar", dir: "rtl", start_url: "./index.html", scope: "./", display: "standalone", orientation: "portrait",
    background_color: p.bg, theme_color: p.bg,
    icons: [{ src: "dyn-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "dyn-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "dyn-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] };
  return new Response(JSON.stringify(m), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-cache" } });
}
async function iconResp(url) {
  const size = /192/.test(url.pathname) ? 192 : 512;
  try { const b = await iconBlob(size, await pal()); if (b) return new Response(b, { headers: { "Content-Type": "image/png", "Cache-Control": "no-cache" } }); } catch (e) {}
  return fetch(size === 192 ? "icon-192.png" : "icon-512.png");
}

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== "lt-pref").map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  // طلبات جوجل (تسجيل الدخول والـ Drive) تعدّي من غير تخزين؛ الخطوط بس هي اللي بتتخزّن
  if (!same && url.hostname !== "fonts.googleapis.com" && url.hostname !== "fonts.gstatic.com") return;
  if (same && url.pathname.endsWith("/manifest.webmanifest")) { e.respondWith(manifestResp()); return; }
  if (same && /\/dyn-icon-(192|512|maskable-512)\.png$/.test(url.pathname)) { e.respondWith(iconResp(url)); return; }
  const isDoc = req.mode === "navigate" || (same && (url.pathname.endsWith("/") || url.pathname.endsWith("index.html") || url.pathname.endsWith("manifest.webmanifest")));

  // الصفحة نفسها: الأحدث من الإنترنت أولاً، ولو مفيش نت تفتح آخر نسخة محفوظة
  if (isDoc) {
    e.respondWith(
      fetch(req, { cache: "no-store" })
        .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })
        .catch(() => caches.match(req).then(h => h || caches.match("./index.html")))
    );
    return;
  }

  // باقي الملفات (الأيقونات والخطوط): من الحفظ أولاً
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r && (r.status === 200 || r.type === "opaque")) {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return r;
    }))
  );
});

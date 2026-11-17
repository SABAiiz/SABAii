// โครงแอปแบบเรียกรถ — แผนที่เต็มจอ + แผ่นล่าง 3 ระดับ + ขั้นตอน ค้นหา → เลือกรถ → หาคนขับ → คนขับมารับ → เดินทาง → ให้คะแนน
// เป็นโครงสำหรับต่อยอดเป็น SABAii: ทุกอย่างจำลองในเครื่อง ไม่มีเซิร์ฟเวอร์ ไม่มีแผนที่จริง ไม่มีการจ่ายเงินจริง
// ไม่มี framework · ไม่มี build · ข้อความผู้ใช้ผ่าน textContent เสมอ

const SVGNS = 'http://www.w3.org/2000/svg';
const $ = s => document.querySelector(s);

/* ---------------- ตัวช่วย DOM ---------------- */
function h(tag, props, ...kids) {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (props != null && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) { kids.unshift(props); props = null; }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v; // ใช้กับไอคอนคงที่เท่านั้น
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false && c !== '') el.append(c instanceof Node ? c : String(c));
  return el;
}
function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of kids) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const ic = (name, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
const ICON = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  locate: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
  pin: '<path d="M12 21s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  school: '<path d="M3 9l9-5 9 5-9 5z"/><path d="M7 11.5V16c0 1.5 2.5 3 5 3s5-1.5 5-3v-4.5"/>',
  cart: '<path d="M3 4h2l2.4 11h10.2L20 8H6.2"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>',
  train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l2-4M16 21l-2-4"/>',
  hosp: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  tree: '<path d="M12 3l6 9h-4l4 6H6l4-6H6z"/><path d="M12 18v3"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
  cash: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  history: '<path d="M3 12a9 9 0 103-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 .5c0 1.7-2.5 2-2.5 3.5M12 17h.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.5 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 21h4l.5-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/>',
  car: '<path d="M5 16l1.5-5.2A2 2 0 018.4 9.4h7.2a2 2 0 011.9 1.4L19 16"/><rect x="3" y="14" width="18" height="4" rx="1.5"/><circle cx="7" cy="18.5" r="1.5"/><circle cx="17" cy="18.5" r="1.5"/>',
  moto: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l4-6h4l4 6M13 11l-1-4h3"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M17 5l2 2M15 7l2 2"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/>',
  map: '<path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
};

const toast = (() => { let t; return msg => { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(t); t = setTimeout(() => el.classList.remove('show'), 2200); }; })();
const baht = n => '฿' + Math.round(n).toLocaleString('th-TH');
const clockAt = mins => new Date(Date.now() + mins * 60000).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

/* ---------------- โลกจำลอง ---------------- */
const W = 2400, G = 200, MAJOR = 600;
const VROADS = ['ถ.ร่มไม้', 'ถ.สายลม', 'ถ.ทางเพลิน', 'ถ.ใบเตย', 'ถ.สุขใจ', 'ถ.ศรีเมือง', 'ถ.นาคร', 'ถ.ฟ้าใส', 'ถ.ทองหลาง', 'ถ.ดอกแก้ว', 'ถ.เรือนไทย', 'ถ.ริมบึง', 'ถ.ท้ายเมือง'];
const HROADS = ['ซ.เหนือ', 'ถ.ราชพฤกษ์', 'ถ.ชมดาว', 'ถ.ประตูเมือง', 'ถ.กลางเมือง', 'ถ.สามแยก', 'ถ.ตลาดเก่า', 'ถ.สะพานยาว', 'ถ.ริมน้ำ', 'ถ.โรงสี', 'ถ.สวนผัก', 'ถ.นาใต้', 'ซ.ใต้'];
const ME = { id: 'me', name: 'ตำแหน่งปัจจุบัน', sub: 'ใกล้แยกสุขใจ × กลางเมือง', x: 1130, y: 860, icon: 'locate' };
const PLACES = [
  { id: 'home', name: 'บ้าน', sub: 'ถ.ริมน้ำ ซอย 4', x: 1690, y: 1640, icon: 'home', saved: true },
  { id: 'school', name: 'โรงเรียน', sub: 'ถ.ราชพฤกษ์ ใกล้ประตูเมือง', x: 520, y: 330, icon: 'school', saved: true },
  { id: 'mall', name: 'ศูนย์การค้ากลางเมือง', sub: 'ถ.ฟ้าใส × ถ.ชมดาว', x: 1500, y: 470, icon: 'cart' },
  { id: 'station', name: 'สถานีรถไฟฟ้าตลาดเก่า', sub: 'ถ.ตลาดเก่า', x: 880, y: 1300, icon: 'train' },
  { id: 'hosp', name: 'โรงพยาบาลประจำเมือง', sub: 'ถ.ทองหลาง', x: 1900, y: 1060, icon: 'hosp' },
  { id: 'park', name: 'สวนสาธารณะบึงใหญ่', sub: 'ถ.ริมบึง', x: 2120, y: 300, icon: 'tree' },
  { id: 'library', name: 'ห้องสมุดเมือง', sub: 'ถ.นาคร', x: 1290, y: 1910, icon: 'school' },
  { id: 'market', name: 'ตลาดนัดเย็น', sub: 'ถ.สวนผัก', x: 300, y: 2120, icon: 'cart' },
];
const RECENT = ['station', 'mall', 'hosp'];
const byId = id => id === 'me' ? ME : PLACES.find(p => p.id === id);

// สุ่มแบบคงที่ จะได้แผนที่หน้าตาเดิมทุกครั้ง
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const snap = v => Math.max(0, Math.min(W, Math.round(v / G) * G));
const roadW = v => v % MAJOR === 0 ? 44 : 26;
const nameAt = (x, y) => `ใกล้แยก ${VROADS[Math.round(x / G)] || 'ถ.ท้ายเมือง'} × ${HROADS[Math.round(y / G)] || 'ซ.ใต้'}`;

/** เส้นทางตามถนนตาราง: A → ถนนตั้งที่ใกล้ → ถนนนอนที่ใกล้ B → B */
function route(a, b) {
  const ax = snap(a.x), by = snap(b.y), bx = snap(b.x);
  const pts = [[a.x, a.y], [ax, a.y], [ax, by], [bx, by], [bx, b.y], [b.x, b.y]];
  return pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
}
const segLen = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
const pathLen = pts => pts.reduce((t, p, i) => i ? t + segLen(pts[i - 1], p) : 0, 0);
function pointAt(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const L = segLen(pts[i - 1], pts[i]);
    if (d <= L || i === pts.length - 1) {
      const t = L ? Math.min(1, d / L) : 1, [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, ang: Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI };
    }
    d -= L;
  }
  const [x, y] = pts[pts.length - 1]; return { x, y, ang: 0 };
}
const KM_PER_UNIT = 0.4 / G; // 1 ช่องถนน = 400 ม.

/* ---------------- แผนที่ (SVG) ---------------- */
const mapEl = $('#map');
const svg = s('svg', { 'aria-hidden': 'true' });
const gBase = s('g'), gRoute = s('g'), gMarks = s('g'), gCars = s('g');
svg.append(gBase, gRoute, gCars, gMarks);
mapEl.append(svg);

function drawBase() {
  const n = W / G, park = new Set(['10,1', '11,1', '10,2', '3,8', '4,8', '7,5']);
  gBase.append(s('rect', { class: 'm-ground', x: -400, y: -400, width: W + 800, height: W + 800 }));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x0 = i * G + roadW(i * G) / 2 + 6, y0 = j * G + roadW(j * G) / 2 + 6;
    const x1 = (i + 1) * G - roadW((i + 1) * G) / 2 - 6, y1 = (j + 1) * G - roadW((j + 1) * G) / 2 - 6;
    if (park.has(`${i},${j}`)) { gBase.append(s('rect', { class: 'm-park', x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 18 })); continue; }
    // แบ่งบล็อกเป็นตึกเล็ก ๆ 1–3 หลัง
    const k = 1 + Math.floor(rnd() * 3), w = (x1 - x0 - (k - 1) * 10) / k;
    for (let t = 0; t < k; t++) {
      const split = rnd() < .5;
      if (split) {
        const hh = (y1 - y0 - 10) / 2;
        gBase.append(s('rect', { class: 'm-block', x: x0 + t * (w + 10), y: y0, width: w, height: hh, rx: 6 }));
        gBase.append(s('rect', { class: 'm-block', x: x0 + t * (w + 10), y: y0 + hh + 10, width: w, height: hh, rx: 6 }));
      } else gBase.append(s('rect', { class: 'm-block', x: x0 + t * (w + 10), y: y0, width: w, height: y1 - y0, rx: 6 }));
    }
  }
  gBase.append(s('path', { class: 'm-water', d: `M-400 1980 C 500 1820, 900 2160, 1500 1860 S 2400 1700, 2800 1760 L 2800 1900 C 2300 1850, 1900 2000, 1500 2010 S 500 2320, -400 2130 Z` }));
  for (let v = 0; v <= W; v += G) {
    const cls = v % MAJOR === 0 ? 'm-major' : 'm-road', sw = roadW(v);
    gBase.append(s('line', { class: cls, x1: v, y1: -400, x2: v, y2: W + 400, 'stroke-width': sw }));
    gBase.append(s('line', { class: cls, x1: -400, y1: v, x2: W + 400, y2: v, 'stroke-width': sw }));
  }
  for (const p of PLACES) {
    const g = s('g', { transform: `translate(${p.x} ${p.y})` });
    g.append(s('circle', { r: 9, fill: 'var(--text-2)', stroke: 'var(--m-ground)', 'stroke-width': 4 }));
    g.append(s('text', { class: 'm-label', x: 16, y: 7 }, p.name));
    gBase.append(g);
  }
}

// กล้อง: cam.x/cam.y = จุดกลางจอในพิกัดโลก · cam.z = พิกเซลต่อหน่วยโลก
const cam = { x: ME.x, y: ME.y, z: 0.9 };
const vp = () => ({ w: mapEl.clientWidth, h: mapEl.clientHeight });
function applyCam() {
  const { w, h: hh } = vp();
  svg.setAttribute('viewBox', `${cam.x - w / 2 / cam.z} ${cam.y - hh / 2 / cam.z} ${w / cam.z} ${hh / cam.z}`);
  if (mode.pick) updatePick();
}
let camAnim = 0;
function moveCam(to, ms = 450) {
  cancelAnimationFrame(camAnim);
  const from = { ...cam }, t0 = performance.now();
  const step = now => {
    const t = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - t, 3);
    cam.x = from.x + (to.x - from.x) * e; cam.y = from.y + (to.y - from.y) * e; cam.z = from.z + ((to.z ?? from.z) - from.z) * e;
    applyCam(); if (t < 1) camAnim = requestAnimationFrame(step);
  };
  camAnim = requestAnimationFrame(step);
}
/** ส่วนของจอที่มองเห็น (ไม่โดนแผ่นล่างบัง) */
const visibleTop = 70;
const visibleBottom = () => vp().h - sheetVis;
/** เลื่อนกล้องให้จุดโลก (x,y) ไปอยู่กลางส่วนที่มองเห็น */
function centerOn(x, y, z = cam.z) {
  const { h: hh } = vp(), cy = (visibleTop + visibleBottom()) / 2;
  moveCam({ x, y: y - (cy - hh / 2) / z, z });
}
function fitPoints(pts) {
  const xs = pts.map(p => p[0] ?? p.x), ys = pts.map(p => p[1] ?? p.y);
  const bw = Math.max(200, Math.max(...xs) - Math.min(...xs)), bh = Math.max(200, Math.max(...ys) - Math.min(...ys));
  const { w } = vp(), avail = visibleBottom() - visibleTop;
  const z = Math.max(0.2, Math.min(1.4, Math.min((w - 80) / bw, (avail - 80) / bh)));
  centerOn((Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2, z);
}
const screenToWorld = (sx, sy) => { const { w, h: hh } = vp(); return { x: cam.x + (sx - w / 2) / cam.z, y: cam.y + (sy - hh / 2) / cam.z }; };

// ลากแผนที่ · ล้อเมาส์ซูม · สองนิ้วซูม
const ptrs = new Map(); let pinch0 = null;
mapEl.addEventListener('pointerdown', e => { mapEl.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); cancelAnimationFrame(camAnim); if (mode.pick) $('#center-pin')?.classList.add('lift'); });
mapEl.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  if (ptrs.size === 2) {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (!pinch0) pinch0 = { d, z: cam.z };
    cam.z = Math.max(0.25, Math.min(2.5, pinch0.z * d / pinch0.d)); applyCam(); return;
  }
  cam.x -= (e.clientX - p.x) / cam.z; cam.y -= (e.clientY - p.y) / cam.z;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); applyCam();
});
const endPtr = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = null; if (!ptrs.size) $('#center-pin')?.classList.remove('lift'); };
mapEl.addEventListener('pointerup', endPtr); mapEl.addEventListener('pointercancel', endPtr);
mapEl.addEventListener('wheel', e => {
  e.preventDefault();
  const before = screenToWorld(e.clientX, e.clientY);
  cam.z = Math.max(0.25, Math.min(2.5, cam.z * Math.exp(-e.deltaY / 400)));
  const after = screenToWorld(e.clientX, e.clientY);
  cam.x += before.x - after.x; cam.y += before.y - after.y; applyCam();
}, { passive: false });

/* หมุด/รถบนแผนที่ */
function meMarker() {
  const g = s('g', { transform: `translate(${ME.x} ${ME.y})` });
  g.append(s('circle', { class: 'me-pulse', r: 60 }), s('circle', { r: 15, fill: 'var(--blue)', stroke: '#fff', 'stroke-width': 5 }));
  return g;
}
const carShape = (color = '#15233D') => {
  const g = s('g');
  g.append(s('rect', { x: -22, y: -11, width: 44, height: 22, rx: 7, fill: color, stroke: '#fff', 'stroke-width': 3 }));
  g.append(s('rect', { x: 2, y: -8, width: 9, height: 16, rx: 2, fill: '#9CC6F2' }));
  return g;
};
function endMarker(p, kind) {
  const g = s('g', { transform: `translate(${p.x} ${p.y})` });
  if (kind === 'a') g.append(s('circle', { r: 16, fill: '#15233D', stroke: '#fff', 'stroke-width': 5 }), s('circle', { r: 5, fill: '#fff' }));
  else g.append(s('rect', { x: -16, y: -16, width: 32, height: 32, rx: 6, fill: 'var(--blue)', stroke: '#fff', 'stroke-width': 5 }), s('rect', { x: -5, y: -5, width: 10, height: 10, fill: '#fff' }));
  return g;
}
function drawRoute(pts) {
  gRoute.replaceChildren();
  if (!pts) return;
  const d = 'M' + pts.map(p => p.join(' ')).join(' L');
  gRoute.append(s('path', { class: 'm-route-bg', d }), s('path', { class: 'm-route', d }));
}

// รถว่างวิ่งไปมาตามถนน (ประกอบฉากเท่านั้น)
const ambient = Array.from({ length: 9 }, () => {
  const x = snap(rnd() * W), y = snap(rnd() * W), el = carShape();
  gCars.append(el);
  return { x, y, tx: x, ty: y, el, speed: 50 + rnd() * 40 };
});
function stepAmbient(dt) {
  for (const c of ambient) {
    const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
    if (d < 1) {
      const dirs = [[G, 0], [-G, 0], [0, G], [0, -G]].filter(([a, b]) => c.x + a >= 0 && c.x + a <= W && c.y + b >= 0 && c.y + b <= W);
      const [a, b] = dirs[Math.floor(Math.random() * dirs.length)]; c.tx = c.x + a; c.ty = c.y + b; continue;
    }
    const m = Math.min(d, c.speed * dt); c.x += dx / d * m; c.y += dy / d * m;
    c.el.setAttribute('transform', `translate(${c.x} ${c.y}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})`);
  }
}

// รถของคนขับที่รับงาน — วิ่งตามเส้นทางในเวลาที่กำหนด
const ride = { car: null, pts: null, len: 0, t0: 0, dur: 0, onDone: null, onTick: null };
function driveAlong(pts, dur, onTick, onDone) {
  if (!ride.car) { ride.car = carShape('#16B76A'); gMarks.append(ride.car); }
  Object.assign(ride, { pts, len: pathLen(pts), t0: performance.now(), dur, onTick, onDone });
}
function stopRide() { ride.pts = null; ride.car?.remove(); ride.car = null; }
let last = performance.now();
function loop(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  stepAmbient(dt);
  if (ride.pts) {
    const f = Math.min(1, (now - ride.t0) / ride.dur), p = pointAt(ride.pts, f * ride.len);
    ride.car.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${p.ang})`);
    ride.onTick?.(f);
    if (f >= 1) { const done = ride.onDone; ride.pts = null; done?.(); }
  }
  requestAnimationFrame(loop);
}

/* ---------------- แผ่นล่าง ---------------- */
const sheet = $('#sheet'), sbody = $('#sbody'), sfoot = $('#sfoot');
let snaps = [300], snapIdx = 0, sheetVis = 300;
const maxVis = () => window.innerHeight - 8;
const resolveSnap = v => v === 'full' ? maxVis() : v <= 1 ? Math.round(window.innerHeight * v) : v;
function setVis(v) {
  sheetVis = v;
  document.documentElement.style.setProperty('--sheet-vis', v + 'px');
  sheet.classList.toggle('full', v >= maxVis() - 2);
  $('#side-ctrls').classList.toggle('hide', v > window.innerHeight * .7);
}
function setSnap(i) { snapIdx = Math.max(0, Math.min(snaps.length - 1, i)); setVis(resolveSnap(snaps[snapIdx])); if (snapIdx < snaps.length - 1 || snaps.length === 1) sbody.scrollTop = 0; }

let drag = null, suppressClick = false;
sheet.addEventListener('pointerdown', e => {
  if (e.button) return;
  drag = { y: e.clientY, vis: sheetVis, inBody: !!e.target.closest('.sbody'), moved: false, hist: [[e.timeStamp, e.clientY]], id: e.pointerId };
});
// ฟังที่ window ไม่ใช่ที่แผ่น: เมาส์ลากออกนอกแผ่นแล้วต้องยังลากต่อได้ (นิ้วถูกจับไว้กับแผ่นอยู่แล้ว)
window.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dy = e.clientY - drag.y;
  if (!drag.moved) {
    if (Math.abs(dy) < 8) return;
    if (snaps.length === 1 && !e.target.closest('[data-drag]')) { drag = null; return; } // แผ่นที่มีขนาดเดียวไม่ต้องลาก
    if (sheet.classList.contains('full') && drag.inBody && (dy < 0 || sbody.scrollTop > 0)) { drag = null; return; } // ปล่อยให้เลื่อนรายการ
    drag.moved = true; sheet.classList.add('dragging');
  }
  const lo = resolveSnap(snaps[0]) * .6, hi = maxVis();
  setVis(Math.max(lo, Math.min(hi, drag.vis - dy)));
  drag.hist.push([e.timeStamp, e.clientY]); if (drag.hist.length > 5) drag.hist.shift();
});
function endDrag(e) {
  if (!drag) return;
  const d = drag; drag = null;
  if (!d.moved) return;
  sheet.classList.remove('dragging'); suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
  const [t0, y0] = d.hist[0], v = (e.clientY - y0) / Math.max(1, e.timeStamp - t0); // px/ms (+ = ลง)
  const target = sheetVis - v * 180;
  let best = 0;
  snaps.forEach((sv, i) => { if (Math.abs(resolveSnap(sv) - target) < Math.abs(resolveSnap(snaps[best]) - target)) best = i; });
  setSnap(best);
}
window.addEventListener('pointerup', endDrag); window.addEventListener('pointercancel', endDrag);
sheet.addEventListener('click', e => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);
$('.grab').addEventListener('click', () => setSnap(snapIdx === snaps.length - 1 ? 0 : snapIdx + 1)); // แตะที่จับ = ขยาย/ย่อ
window.addEventListener('resize', () => { setSnap(snapIdx); applyCam(); });

/* ---------------- สถานะการเดินทาง + หน้าต่าง ๆ ---------------- */
const trip = { from: ME, to: null, when: null, opt: 'std', pts: null };
const mode = { pick: null };
const OPTS = [
  { id: 'moto', name: 'มอเตอร์ไซค์', seats: '1 ที่นั่ง', base: 20, perKm: 5, wait: 2, icon: 'moto' },
  { id: 'eco', name: 'ประหยัด', seats: '4 ที่นั่ง · รถเล็ก', base: 32, perKm: 6, wait: 5, icon: 'car' },
  { id: 'std', name: 'มาตรฐาน', seats: '4 ที่นั่ง', base: 40, perKm: 8, wait: 3, icon: 'car' },
  { id: 'xl', name: 'รถใหญ่', seats: '6 ที่นั่ง', base: 65, perKm: 12, wait: 7, icon: 'car' },
];
const tripKm = () => pathLen(trip.pts) * KM_PER_UNIT;
const tripMin = () => Math.max(3, Math.round(tripKm() / 22 * 60 + 2));
const priceOf = o => o.base + o.perKm * tripKm();

const stack = [];
const VIEWS = {};
let leaveFn = null;
function render(name, opts = {}) {
  leaveFn?.(); leaveFn = null;
  const v = VIEWS[name](opts);
  snaps = v.snaps;
  sbody.replaceChildren(...[].concat(v.body).filter(Boolean));
  sfoot.replaceChildren(...[].concat(v.foot || []).filter(Boolean));
  sfoot.hidden = !sfoot.childNodes.length;
  leaveFn = v.leave || null;
  const atRoot = stack.length <= 1;
  $('#menu-btn').classList.toggle('hidden', !atRoot && !v.menu);
  $('#back-btn').classList.toggle('hidden', !!(atRoot || v.noBack || v.menu));
  setSnap(v.snap ?? 0);
  v.enter?.();
}
let histOK = true;
function go(name, opts = {}) {
  stack.push(name);
  try { history.pushState({ v: name, n: stack.length }, ''); } catch { histOK = false; /* บางกรอบหน้าเว็บไม่ให้ใช้ history */ }
  render(name, opts);
}
/** ย้อนหนึ่งหน้า ผ่านประวัติของเบราว์เซอร์ (ปุ่มย้อนกลับของเครื่องจะได้ทำงานเหมือนกัน) */
let forceBack = false;
function goBack(force = false) { forceBack = force; if (histOK) history.back(); else back(); }
/** ไปหน้าใหม่แทนหน้าปัจจุบัน (ไม่เพิ่มประวัติ) */
function swap(name, opts = {}) { stack[stack.length - 1] = name; render(name, opts); }
function home() { stack.length = 0; stack.push('home'); try { history.replaceState({ v: 'home', n: 1 }, ''); } catch {} render('home'); }
function back() {
  const cur = stack[stack.length - 1], force = forceBack; forceBack = false;
  if (!force && ['finding', 'driver', 'trip', 'rate'].includes(cur)) { toast('อยู่ระหว่างเรียกรถ — กดยกเลิกในแผ่นล่างแทน'); try { history.pushState({ v: cur, n: stack.length }, ''); } catch {} return; }
  if (stack.length <= 1) return;
  stack.pop(); render(stack[stack.length - 1]);
}
window.addEventListener('popstate', back);
$('#back-btn').onclick = () => goBack();

const placeRow = (p, onclick) => h('li', h('button.place', { onclick }, h('span.ic', { html: ic(p.icon) }), h('div', h('b', p.name), h('small', p.sub))));

/* หน้าแรก: ค้นหา "ไปไหนดี?" · ที่บันทึกไว้ · ล่าสุด · บริการ */
VIEWS.home = () => {
  return {
    snaps: [212, .5, 'full'], snap: 1,
    enter() { trip.from = ME; trip.to = null; trip.pts = null; drawRoute(null); drawEnds(); refreshWhenChip(); centerOn(ME.x, ME.y, .9); },
    body: [
      h('h1.greet', greeting()),
      h('div.search', { role: 'group' },
        h('button', { style: 'flex:1;display:flex;gap:10px;align-items:center;text-align:left;min-height:44px', onclick: () => go('search'), 'aria-label': 'ค้นหาปลายทาง' },
          h('span', { html: ic('pin') }), h('span.ph', 'ไปไหนดี?')),
        h('button.chip', { onclick: openWhen, html: ic('clock') + `<span></span>` + ic('down') })),
      h('ul.places', { style: 'margin-top:6px' },
        PLACES.filter(p => p.saved).map(p => placeRow(p, () => pickDest(p))),
        RECENT.map(byId).map(p => placeRow({ ...p, icon: 'history' }, () => pickDest(p)))),
      h('h2.st', 'บริการ', h('span', 'ตัวอย่างโครง')),
      h('div.services', [['car', 'รถ'], ['moto', 'มอไซค์'], ['box', 'ส่งของ'], ['key', 'เช่ารถ']].map(([i, t]) =>
        h('button.svc', { onclick: () => i === 'car' || i === 'moto' ? go('search') : toast(`"${t}" ยังไม่ทำในโครงนี้`), html: ic(i) + `<span>${t}</span>` }))),
      h('div.promo', h('span', { html: ic('tag') }), h('div', h('b', 'ลด 20% สองเที่ยวแรก'), h('p', 'ตัวอย่างการ์ดโปรโมชัน — ข้อมูลไม่จริง'))),
    ],
    menu: true,
  };
};
function greeting() { const hr = new Date().getHours(); return hr < 12 ? 'สวัสดีตอนเช้า' : hr < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น'; }
function refreshWhenChip() {
  const span = sbody.querySelector('.chip span'); if (!span) return;
  span.textContent = trip.when ? new Date(trip.when).toLocaleString('th-TH', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'ตอนนี้';
}
function openWhen() {
  const dlg = $('#when-dlg'), input = $('#when-input');
  const d = new Date(Date.now() + 30 * 60000); d.setSeconds(0, 0);
  const local = x => new Date(x - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  input.min = local(new Date()); input.value = trip.when ? local(new Date(trip.when)) : local(d);
  dlg.onclose = () => {
    if (dlg.returnValue === 'set' && input.value) { trip.when = new Date(input.value).getTime(); toast('ตั้งเวลารับแล้ว'); }
    else if (dlg.returnValue === 'now') trip.when = null;
    refreshWhenChip();
  };
  dlg.showModal();
}

/* ค้นหา: ต้นทาง/ปลายทาง + รายการแนะนำ + เลือกบนแผนที่ */
VIEWS.search = () => {
  const from = h('input.field', { value: trip.from.name, 'aria-label': 'จุดรับ', readOnly: true, onclick: () => { go('pick', { which: 'from' }); } });
  const to = h('input.field', { id: 'dest', placeholder: 'ไปไหนดี?', 'aria-label': 'ปลายทาง', autocomplete: 'off', enterKeyHint: 'search' });
  const list = h('ul.places');
  const fill = () => {
    const q = to.value.trim();
    const hits = PLACES.filter(p => !q || p.name.includes(q) || p.sub.includes(q));
    list.replaceChildren(
      h('li', h('button.place', { onclick: () => go('pick', { which: 'to' }) }, h('span.ic', { html: ic('map') }), h('div', h('b', 'เลือกบนแผนที่'), h('small', 'เลื่อนแผนที่ให้หมุดตรงจุดที่ต้องการ')))),
      ...hits.map(p => placeRow(p, () => pickDest(p, true))),
      hits.length ? null : h('li.muted', { style: 'padding:16px 0' }, `ไม่พบ "${q}" ในตัวอย่าง — ลองเลือกบนแผนที่`));
  };
  to.addEventListener('input', fill);
  fill();
  return {
    snaps: ['full'],
    enter() { setTimeout(() => to.focus(), 300); },
    body: [h('div.route-fields', h('div.dots', h('i'), h('em'), h('i.b')), from, to), list],
  };
};
function pickDest(p, fromSearch = false) {
  trip.to = p;
  if (fromSearch) swap('options'); else go('options');
}

/* เลือกจุดบนแผนที่: หมุดกลางส่วนที่มองเห็น */
VIEWS.pick = ({ which = 'to' } = {}) => {
  const label = h('b', '…'), sub = h('small.muted', 'เลื่อนแผนที่ให้หมุดตรงจุด');
  return {
    snaps: [196],
    enter() {
      const pin = h('div', { id: 'center-pin', html: `<svg width="40" height="52" viewBox="0 0 40 52" aria-hidden="true"><path d="M20 51c0 0 18-17 18-30A18 18 0 002 21c0 13 18 30 18 30z" fill="${which === 'from' ? '#15233D' : '#1769D2'}" stroke="#fff" stroke-width="3"/><circle cx="20" cy="20" r="6" fill="#fff"/></svg>` });
      document.body.append(pin);
      mode.pick = { which, label };
      const base = which === 'from' ? trip.from : (trip.to || ME);
      centerOn(base.x, base.y, Math.max(cam.z, .9));
      updatePick();
    },
    leave() { $('#center-pin')?.remove(); mode.pick = null; },
    body: [h('p.muted', which === 'from' ? 'จุดรับ' : 'ปลายทาง'), label, h('br'), sub],
    foot: h('button.btn.primary', {
      onclick: () => {
        const p = { ...mode.pick.point, id: 'custom-' + which, icon: 'pin' };
        if (which === 'from') { trip.from = p; goBack(); return; }
        trip.to = p; swap('options');
      },
    }, 'ยืนยันจุดนี้'),
  };
};
function updatePick() {
  const pin = $('#center-pin'); if (!pin || !mode.pick) return;
  const { w } = vp(), y = (visibleTop + visibleBottom()) / 2;
  pin.style.top = y + 'px';
  const wp = screenToWorld(w / 2, y);
  const x = Math.round(Math.max(0, Math.min(W, wp.x))), yy = Math.round(Math.max(0, Math.min(W, wp.y)));
  mode.pick.point = { x, y: yy, name: nameAt(x, yy), sub: 'จุดที่เลือกบนแผนที่' };
  mode.pick.label.textContent = mode.pick.point.name;
}

/* เลือกรถ: เส้นทาง + ราคา + เวลาถึง */
VIEWS.options = () => {
  trip.pts = route(trip.from, trip.to);
  const list = h('ul.opts');
  const cta = h('button.btn.primary');
  const paint = () => {
    list.replaceChildren(...OPTS.map(o => h('li', h('button.opt', { 'aria-pressed': String(o.id === trip.opt), onclick: () => { trip.opt = o.id; paint(); } },
      h('span.car', { html: ic(o.icon, 'car') }),
      h('div', h('b', o.name), h('small', `${o.seats} · มาถึงใน ${o.wait} นาที`)),
      h('span.price', baht(priceOf(o)), o.id === 'eco' ? h('s', baht(priceOf(o) * 1.25)) : null)))));
    const o = OPTS.find(x => x.id === trip.opt);
    cta.textContent = trip.when ? `จอง ${o.name} ล่วงหน้า` : `เรียก ${o.name}`;
  };
  cta.onclick = () => { if (trip.when) { toast('จองล่วงหน้าแล้ว (จำลอง)'); home(); } else go('finding'); };
  paint();
  return {
    snaps: [.48, 'full'],
    enter() { drawRoute(trip.pts); drawEnds(); setTimeout(() => fitPoints(trip.pts), 30); },
    body: [
      h('h2.st', { style: 'margin-top:4px' }, trip.to.name, h('span', `${tripKm().toFixed(1)} กม. · ${tripMin()} นาที · ถึง ${clockAt(tripMin() + 3)}`)),
      list,
    ],
    foot: [
      h('div.payrow',
        h('button', { onclick: () => toast('วิธีจ่ายเงินยังไม่ทำในโครงนี้'), html: ic('cash') + '<span>เงินสด</span>' + ic('down') }),
        h('span.sp'),
        h('button', { onclick: () => toast('โค้ดส่วนลดยังไม่ทำในโครงนี้'), html: ic('tag') + '<span>โค้ดส่วนลด</span>' })),
      cta,
    ],
  };
};
function drawEnds() {
  gMarks.querySelectorAll('.end').forEach(n => n.remove());
  if (!gMarks.querySelector('.me')) { const m = meMarker(); m.classList.add('me'); gMarks.prepend(m); }
  if (trip.to) {
    const a = endMarker(trip.from, 'a'), b = endMarker(trip.to, 'b');
    a.classList.add('end'); b.classList.add('end'); gMarks.append(a, b);
  }
}

/* หาคนขับ */
VIEWS.finding = () => {
  let t;
  return {
    snaps: [236], noBack: true,
    enter() { t = setTimeout(() => swap('driver'), 2600); },
    leave() { clearTimeout(t); },
    body: h('div.finding', h('h2', 'กำลังหาคนขับใกล้คุณ'), h('p.muted', 'ปกติใช้เวลาไม่ถึงนาที (จำลอง 3 วินาที)'), h('div.bar', h('i'))),
    foot: h('button.btn.danger', { onclick: () => { toast('ยกเลิกแล้ว'); goBack(true); } }, 'ยกเลิก'),
  };
};

/* คนขับกำลังมา → ถึงแล้ว */
const DRIVER = { name: 'สมชาย', rating: 4.9, car: 'รถเก๋งสีขาว', plate: 'กข 1234', prov: 'ตัวอย่าง' };
VIEWS.driver = () => {
  const o = OPTS.find(x => x.id === trip.opt);
  const eta = h('div.eta', `มาถึงใน ${o.wait} นาที`), sub = h('p.muted', `จุดรับ: ${trip.from.name}`);
  const footBtn = h('button.btn.danger', { onclick: () => { stopRide(); toast('ยกเลิกเที่ยวนี้แล้ว'); home(); } }, 'ยกเลิกเที่ยวนี้');
  return {
    snaps: [330, .62], noBack: true,
    enter() {
      const start = { x: Math.min(W, snap(trip.from.x) + 600), y: Math.max(0, snap(trip.from.y) - 400) };
      const pts = route(start, trip.from);
      fitPoints([...pts, ...trip.pts]);
      driveAlong(pts, 9000, f => { eta.textContent = `มาถึงใน ${Math.max(1, Math.ceil((1 - f) * o.wait))} นาที`; }, () => {
        eta.textContent = 'คนขับมาถึงแล้ว';
        sub.textContent = `มองหา ${DRIVER.car} ทะเบียน ${DRIVER.plate}`;
        footBtn.replaceWith(h('button.btn.primary', { onclick: () => swap('trip') }, 'ขึ้นรถแล้ว (จำลอง)'));
      });
    },
    body: [
      eta, sub,
      h('div.driver', h('span.avatar', DRIVER.name[0]), h('div', h('b', DRIVER.name), h('small.muted', { style: 'display:block' }, `★ ${DRIVER.rating} · ${DRIVER.car}`)),
        h('div.plate', DRIVER.plate, h('small', DRIVER.prov))),
      h('div.row3',
        h('button.round', { onclick: () => toast('โทรยังไม่ทำในโครงนี้'), html: `<span>${ic('phone')}</span>โทร` }),
        h('button.round', { onclick: () => toast('แชตยังไม่ทำในโครงนี้'), html: `<span>${ic('chat')}</span>ข้อความ` }),
        h('button.round', { onclick: () => toast('แชร์การเดินทางยังไม่ทำในโครงนี้'), html: `<span>${ic('share')}</span>แชร์ทริป` })),
      h('h2.st', 'รายละเอียดเที่ยว'),
      h('ul.places', placeRow({ ...trip.from, icon: 'locate' }), placeRow({ ...trip.to, icon: 'pin' })),
      h('p.muted', `${o.name} · ${baht(priceOf(o))} · เงินสด`),
    ],
    foot: footBtn,
  };
};

/* ระหว่างเดินทาง */
VIEWS.trip = () => {
  const mins = tripMin(), eta = h('div.eta', `ถึงประมาณ ${clockAt(mins)}`), sub = h('p.muted', `กำลังไป ${trip.to.name}`);
  return {
    snaps: [210, .5], noBack: true,
    enter() {
      fitPoints(trip.pts);
      driveAlong(trip.pts, 12000, f => { sub.textContent = `กำลังไป ${trip.to.name} · เหลือ ${Math.max(1, Math.ceil((1 - f) * mins))} นาที`; }, () => swap('rate'));
    },
    body: [eta, sub, h('div.row3',
      h('button.round', { onclick: () => toast('แชร์การเดินทางยังไม่ทำในโครงนี้'), html: `<span>${ic('share')}</span>แชร์ทริป` }),
      h('button.round', { onclick: () => toast('ปุ่มความปลอดภัยยังไม่ทำในโครงนี้'), html: `<span>${ic('shield')}</span>ความปลอดภัย` }),
      h('button.round', { onclick: () => toast('แชตยังไม่ทำในโครงนี้'), html: `<span>${ic('chat')}</span>ข้อความ` }))],
  };
};

/* ให้คะแนน */
VIEWS.rate = () => {
  stopRide();
  let stars = 0;
  const o = OPTS.find(x => x.id === trip.opt);
  const row = h('div.stars', [1, 2, 3, 4, 5].map(n => h('button', { 'aria-label': `${n} ดาว`, onclick: () => { stars = n; row.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i < n)); }, html: ic('star') })));
  return {
    snaps: [430], noBack: true,
    body: [h('div.finding', h('h2', 'ถึงแล้ว!'), h('p.muted', `${trip.to.name} · ${baht(priceOf(o))} จ่ายเงินสด`), h('p', { style: 'margin-top:14px;font-weight:600' }, `เที่ยวนี้กับ ${DRIVER.name} เป็นอย่างไร?`), row)],
    foot: h('button.btn.primary', { onclick: () => { toast(stars ? `ขอบคุณ ให้ ${stars} ดาว` : 'ข้ามการให้คะแนน'); home(); } }, 'เสร็จสิ้น'),
  };
};

/* ---------------- ลิ้นชักเมนู ---------------- */
const drawer = $('#drawer'), scrim = $('#scrim');
function openDrawer(open) {
  drawer.classList.toggle('open', open); scrim.classList.toggle('show', open);
  drawer.setAttribute('aria-hidden', String(!open));
  if (open) drawer.querySelector('button')?.focus();
}
drawer.append(
  h('div.me', h('span.avatar', 'ผ'), h('div', h('b', 'ผู้ใช้ทดลอง'), h('small.muted', '★ 5.0 · ยังไม่มีบัญชี'))),
  ...[['card', 'วิธีชำระเงิน'], ['history', 'ประวัติการเดินทาง'], ['tag', 'โปรโมชัน'], ['shield', 'ความปลอดภัย'], ['help', 'ช่วยเหลือ'], ['gear', 'ตั้งค่า']]
    .map(([i, t]) => h('button.mitem', { onclick: () => toast(`"${t}" ยังไม่ทำในโครงนี้`), html: ic(i) + `<span>${t}</span><small>เร็ว ๆ นี้</small>` })),
  h('button.mitem', { onclick: () => { const r = document.documentElement; r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark'; }, html: ic('gear') + '<span>สลับธีมสว่าง/มืด</span>' }),
);
$('#menu-btn').innerHTML = ic('menu');
$('#back-btn').innerHTML = ic('back');
$('#locate-btn').innerHTML = ic('locate');
$('#menu-btn').onclick = () => openDrawer(true);
scrim.onclick = () => openDrawer(false);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('open')) openDrawer(false); });
$('#locate-btn').onclick = () => centerOn(ME.x, ME.y, Math.max(cam.z, .9));

/* ---------------- เริ่ม ---------------- */
drawBase();
applyCam();
home();
requestAnimationFrame(loop);
window.__shell = { trip, stack, cam, go, home };

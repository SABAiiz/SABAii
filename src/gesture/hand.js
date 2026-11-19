// โหมดโบกมือ — ใช้กล้องหน้าตามตำแหน่งมือ แล้วแปลงเป็น "ปัด" ซ้าย/ขวา/ขึ้น/ลง
//   • ภาพจากกล้องประมวลผลในเครื่องเท่านั้น ไม่บันทึก ไม่ส่งไปไหน (MediaPipe Hand Landmarker เก็บไว้ในเว็บเราเอง: assets/vendor/mediapipe)
//   • โหลดไลบรารี/โมเดล (~17MB) เฉพาะตอนผู้ใช้กดเปิด · ปิดแล้วกล้องดับทันที
//   • ทิศอิงมุมมองผู้ใช้ (ภาพกล้องหน้ากลับซ้ายขวาให้แล้ว): ยกมือไปทางขวา = "right"
const BASE = new URL('../../assets/vendor/mediapipe/', import.meta.url).href;

/** ตัวจับ "ปัด" จากจุดมือต่อเนื่อง (ฟังก์ชันล้วน ทดสอบได้) — ป้อน {x, y, t} (x,y = 0..1 ของภาพ, t = มิลลิวินาที) หรือ null เมื่อไม่เห็นมือ
 *  ปัด = เคลื่อนที่ ≥ minDist ภายใน maxMs และทิศหลักชัดกว่าอีกแกน ratio เท่า · หลังปัดพัก cooldown กันนับซ้ำตอนดึงมือกลับ */
export function createSwipe({ minDist = .2, maxMs = 400, ratio = 1.5, cooldown = 700 } = {}) {
  const hist = [];
  let last = -Infinity;
  return p => {
    if (!p) { hist.length = 0; return null; }
    hist.push(p);
    while (hist.length && p.t - hist[0].t > maxMs) hist.shift();
    if (p.t - last < cooldown) { hist.length = 0; hist.push(p); return null; }
    if (hist.length < 3) return null;
    let best = null;
    for (const a of hist) { // ระยะจากจุดใดก็ได้ในช่วงเวลาที่ผ่านมา (มือเร่งกลางทางก็จับได้)
      const dx = p.x - a.x, dy = p.y - a.y, ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax >= minDist && ax >= ratio * ay) { best = dx > 0 ? 'right' : 'left'; break; }
      if (ay >= minDist && ay >= ratio * ax) { best = dy > 0 ? 'down' : 'up'; break; }
    }
    if (best) { last = p.t; hist.length = 0; }
    return best;
  };
}

/** จุดกลางฝ่ามือจาก landmark 21 จุด (ข้อมือ + โคนนิ้วทั้งสี่) · กลับซ้ายขวาให้เหมือนกระจก */
export function palmCenter(lm) {
  let x = 0, y = 0;
  for (const i of [0, 5, 9, 13, 17]) { x += lm[i].x; y += lm[i].y; }
  return { x: 1 - x / 5, y: y / 5 };
}

/** เปิดกล้อง + ตัวตามมือ · คืน { stop, rest(ms) } หรือ null ถ้าเปิดไม่ได้ (onState บอกเหตุผล: denied · unsupported)
 *  onState: loading → ready · onPoint({x,y}|null) ทุกเฟรม (~30 ต่อวินาที) · onSwipe('left'|'right'|'up'|'down') */
export async function startHands({ video, onPoint, onSwipe, onState }) {
  onState?.('loading');
  if (!navigator.mediaDevices?.getUserMedia) { onState?.('unsupported'); return null; }
  let stream, lm, raf = 0, stopped = false;
  const stop = () => {
    stopped = true; cancelAnimationFrame(raf);
    stream?.getTracks().forEach(t => t.stop());
    if (video) video.srcObject = null;
    try { lm?.close(); } catch {}
  };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 30 } } });
  } catch (e) { onState?.(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : 'unsupported', e); return null; }
  Object.assign(video, { muted: true, playsInline: true, srcObject: stream });
  video.setAttribute('playsinline', '');
  await video.play().catch(() => {});
  try {
    const { HandLandmarker } = await import(BASE + 'vision_bundle.mjs');
    const files = { wasmLoaderPath: BASE + 'vision_wasm_internal.js', wasmBinaryPath: BASE + 'vision_wasm_internal.wasm' };
    const opts = delegate => ({ baseOptions: { modelAssetPath: BASE + 'hand_landmarker.task', delegate }, runningMode: 'VIDEO', numHands: 1,
      minHandDetectionConfidence: .55, minHandPresenceConfidence: .55, minTrackingConfidence: .5 });
    try { lm = await HandLandmarker.createFromOptions(files, opts('GPU')); }
    catch { lm = await HandLandmarker.createFromOptions(files, opts('CPU')); }
  } catch (e) { stop(); onState?.('unsupported', e); return null; }
  if (stopped) { stop(); return null; }

  const swipe = createSwipe();
  let lastT = 0, gap = 30, sx = null, sy = null, warm = false, restUntil = 0;
  const loop = () => {
    if (stopped) return;
    raf = requestAnimationFrame(loop);
    if (video.readyState < 2 || document.hidden) return;
    const t = performance.now();
    if (t < restUntil || t - lastT < gap) return;
    lastT = t;
    let res;
    try { res = lm.detectForVideo(video, t); } catch { return; }
    // เครื่องช้า: เว้นช่วงตรวจตามเวลาที่ใช้จริง (ไม่ให้แย่งจังหวะการเลื่อน/แอนิเมชัน) · เครื่องเร็ว ~30 ครั้ง/วินาที
    const cost = performance.now() - t;
    gap = Math.min(250, Math.max(30, gap * .8 + cost * 2 * .2));
    // ครั้งแรกเครื่องต้องเตรียมการ์ดจอ (อาจค้าง 1–5 วินาที) — บอก "พร้อม" หลังผ่านครั้งแรกจริง ระหว่างนั้นวงหมุนยังหมุน (CSS)
    if (!warm) { warm = true; onState?.('ready'); }
    const hand = res?.landmarks?.[0];
    if (!hand) { sx = sy = null; swipe(null); onPoint?.(null); return; }
    const p = palmCenter(hand);
    sx = sx == null ? p.x : sx + (p.x - sx) * .55; sy = sy == null ? p.y : sy + (p.y - sy) * .55; // ลดสั่นของจุดที่แสดง
    onPoint?.({ x: sx, y: sy });
    const dir = swipe({ x: p.x, y: p.y, t });
    if (dir) { rest(650); onSwipe?.(dir); }
  };
  // หลังปัด หยุดตรวจสักครู่ให้การ์ดจอว่างวาดการเลื่อน (ช่วงนี้ปัดซ้ำไม่ได้อยู่แล้ว) — เครื่องสเปกต่ำจะไม่สะดุด
  const rest = ms => { restUntil = performance.now() + ms; swipe(null); sx = sy = null; onPoint?.(null); };
  raf = requestAnimationFrame(loop);
  return { stop, rest };
}

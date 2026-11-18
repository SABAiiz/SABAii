// ฟังเสียง → ข้อความ (ไม่บันทึกไฟล์เสียงเอง) · 2 ทาง:
//   1) บนลิงก์ทดลอง claude.ai: ความสามารถ "dictation" ของหน้า (Claude ถอดเสียงให้ · ขออนุญาตผู้ใช้ครั้งแรก)
//      ใช้ได้บน Chrome/Edge และแอป Claude บนคอม · Safari และแอปมือถือได้ null
//   2) ที่อื่น: Web Speech API ของเบราว์เซอร์ (บน Chrome ส่งเสียงไปถอดที่เซิร์ฟเวอร์ของผู้ผลิตเบราว์เซอร์ จึงต้องใช้เน็ต)
// ทั้งสองทางต้องเริ่มจากการแตะของผู้ใช้โดยตรง (ห้าม await ก่อน start)
const SR = () => globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
let dict = null; // namespace ของ dictation เมื่อหน้าอยู่ใน claude.ai และใช้ได้
try { globalThis.claude?.use?.('dictation')?.then(d => { dict = d || null; }, () => {}); } catch {}

export const speechSupported = () => !!dict || !!SR();
/** ทางที่จะใช้: 'dictation' · 'web' · null */
export const speechEngine = () => (dict ? 'dictation' : SR() ? 'web' : null);

/** onText(ข้อความของรอบนี้ทั้งหมด) · onEnd(ข้อความ, รหัสผิดพลาด|null) · คืน { stop, abort, engine } */
export function startListening({ onText, onEnd, lang = 'th-TH' }) {
  return dict ? viaDictation(dict, { onText, onEnd, lang }) : viaWeb({ onText, onEnd, lang });
}

function viaWeb({ onText, onEnd, lang }) {
  const C = SR();
  if (!C) { queueMicrotask(() => onEnd?.('', 'unsupported')); return { stop() {}, abort() {}, engine: null }; }
  const rec = new C();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = true;
  let text = '', error = null, ended = false;
  rec.onresult = e => {
    let finals = '', interim = '';
    for (const r of e.results) (r.isFinal ? (finals += r[0].transcript + ' ') : (interim += r[0].transcript));
    text = (finals + interim).trim();
    onText?.(text, !interim);
  };
  rec.onerror = e => { error = e.error; };
  rec.onend = () => { if (ended) return; ended = true; onEnd?.(text, error && !text ? error : null); };
  try { rec.start(); } catch (e) { ended = true; queueMicrotask(() => onEnd?.('', 'start-failed')); }
  return {
    engine: 'web',
    stop: () => { try { rec.stop(); } catch {} },
    abort: () => { ended = true; try { rec.abort(); } catch {} },
  };
}

// เหตุที่จบแล้วไม่ใช่ความผิดพลาด
const CLEAN_END = new Set(['stopped', 'viewer_stopped', 'hidden', 'time_limit']);
function viaDictation(d, { onText, onEnd, lang }) {
  let finals = '', partial = '', ended = false, sawStart = false;
  const emit = () => onText?.((finals + (partial ? ' ' + partial : '')).trim(), !partial);
  const offs = [
    d.onPartial(({ text }) => { partial = text || ''; emit(); }),
    d.onFinal(({ text }) => { finals += finals ? text : (text || '').trimStart(); partial = ''; emit(); }),
    d.onState(({ state, reason }) => {
      if (state !== 'idle') { sawStart = true; return; }
      if (sawStart) finish(reason && !CLEAN_END.has(reason) ? reason : null);
    }),
  ];
  function finish(err) {
    if (ended) return; ended = true;
    offs.forEach(f => { try { f(); } catch {} });
    const text = (finals + (partial ? ' ' + partial : '')).trim();
    onEnd?.(text, err && !text ? err : null);
  }
  d.start({ language: lang.slice(0, 2) }).catch(e => finish(e?.code === 'stopped' ? null : e?.code || 'upstream_error'));
  return {
    engine: 'dictation',
    stop: () => { d.stop().catch(() => {}); },
    abort: () => { d.stop().catch(() => {}); finish(null); },
  };
}

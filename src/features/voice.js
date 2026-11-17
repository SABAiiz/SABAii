// ฟังเสียงด้วย Web Speech API ของเบราว์เซอร์ (ภาษาไทย) — ไม่บันทึกไฟล์เสียงเอง
// บน Chrome ระบบนี้ส่งเสียงไปถอดความที่เซิร์ฟเวอร์ของผู้ผลิตเบราว์เซอร์ จึงต้องใช้เน็ต
const SR = () => globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
export const speechSupported = () => !!SR();

export function startListening({ onText, onEnd, lang = 'th-TH' }) {
  const rec = new (SR())();
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
  try { rec.start(); } catch (e) { ended = true; onEnd?.('', 'start-failed'); }
  return {
    stop: () => { try { rec.stop(); } catch {} },
    abort: () => { ended = true; try { rec.abort(); } catch {} },
  };
}

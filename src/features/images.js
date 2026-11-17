// เลือก/ถ่ายรูป → ตรวจชนิดและขนาด → ย่อให้ไม่เกิน 1600px เป็น JPEG ก่อนเก็บ (รูปจากกล้องมือถือ 4–8 MB ต่อใบ)
export const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_SIDE = 1600;

/** เปิดตัวเลือกไฟล์ (camera = เปิดกล้องหลังบนมือถือ) · ผู้ใช้กดยกเลิก = คืน null */
export function pickImage({ camera = false } = {}) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ALLOWED.join(',');
    if (camera) input.capture = 'environment';
    input.style.display = 'none';
    input.onchange = () => { resolve(input.files?.[0] || null); input.remove(); };
    input.oncancel = () => { resolve(null); input.remove(); };
    document.body.append(input);
    input.click();
  });
}

export function checkFile(file) {
  if (!file) return 'ไม่ได้เลือกรูป';
  if (!ALLOWED.includes(file.type)) return 'รองรับเฉพาะรูป JPEG, PNG และ WebP';
  if (file.size > MAX_INPUT_BYTES) return 'รูปใหญ่เกิน 15 MB';
  return null;
}

async function loadBitmap(blob) {
  if (globalThis.createImageBitmap) {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch {}
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}

function draw(src, rotation = 0) {
  const w0 = src.width, h0 = src.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const w = Math.round(w0 * scale), h = Math.round(h0 * scale);
  const swap = rotation % 180 !== 0;
  const c = document.createElement('canvas');
  c.width = swap ? h : w; c.height = swap ? w : h;
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.drawImage(src, -w / 2, -h / 2, w, h);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('ย่อรูปไม่สำเร็จ')), 'image/jpeg', 0.82));
}

/** คืน { blob, url, rotated(deg) } */
export async function prepareImage(file) {
  const err = checkFile(file);
  if (err) throw new Error(err);
  let bmp;
  try { bmp = await loadBitmap(file); } catch { throw new Error('เปิดรูปนี้ไม่ได้ ลองรูปอื่น'); }
  const blob = await draw(bmp);
  return { blob, url: URL.createObjectURL(blob), rotated: deg => draw(bmp, deg) };
}

// ไอคอนประจำวิชา — ฟังก์ชันล้วน (ไม่แตะหน้าเว็บ) จึงทดสอบใน node ได้
/* ไอคอนประจำวิชา (0.9.9 · แบบ B ที่เจ้าของเลือก) — เดาจากชื่อวิชา · ไม่เจอ = ตัวอักษรแรกของชื่อ */
const SI = [
  [/ฟิสิก|phys/i, '<ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>'],
  [/เคมี|chem/i, '<path d="M9 3.5h6M10 3.5V9L5 18.3A1.5 1.5 0 006.3 20.5h11.4a1.5 1.5 0 001.3-2.2L14 9V3.5M7.4 15h9.2"/>'],
  [/ชีว|bio/i, '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l8-8"/>'],
  [/คณิต|math/i, '<path d="M17 5H7l5.5 7L7 19h10"/>'],
  [/อังกฤษ|eng/i, '<text x="12" y="16.5" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700" font-size="12" fill="currentColor" stroke="none">Aa</text>'],
  [/^ไทย|ภาษาไทย|thai/i, '<text x="12" y="17.5" text-anchor="middle" font-family="Noto Sans Thai Looped,sans-serif" font-weight="700" font-size="15" fill="currentColor" stroke="none">ก</text>'],
  [/สังคม|ศาสนา|ประวัติ|soc|hist/i, '<circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="3.6" ry="8.5"/><path d="M3.5 12h17"/>'],
  [/คอม|วิทยาการ|comp|code/i, '<rect x="3.5" y="5" width="17" height="11" rx="2"/><path d="M9 20h6M12 16v4"/>'],
  [/ศิลป|art/i, '<path d="M12 3.5a8.5 8.5 0 100 17c1.2 0 1.6-1 1.1-1.9-.6-1.1.1-2.3 1.4-2.3H17a3.5 3.5 0 003.5-3.5c0-5.3-3.8-9.3-8.5-9.3z"/><circle cx="8" cy="11" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16" cy="10.5" r="1.2"/>'],
  [/ดนตรี|music/i, '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'],
  [/พละ|สุขศึกษา|กีฬา|pe\b/i, '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17"/>'],
];
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
export function subjIcon(s) {
  const name = (s && s.name) || '';
  const hit = SI.find(([re]) => re.test(name));
  const body = hit ? hit[1] : `<text x="12" y="17" text-anchor="middle" font-family="Noto Sans Thai Looped,Inter,sans-serif" font-weight="700" font-size="13" fill="currentColor" stroke="none">${esc(name.trim().slice(0, 1) || '?')}</text>`;
  return `<svg class="si" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

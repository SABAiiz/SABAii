// สมุด: ค้นในโน้ต — ฟังก์ชันล้วน ไม่แตะ DOM/ที่เก็บข้อมูล
/** ค้นในชื่องานและโน้ตข้อความของทุกงาน (ไม่สนตัวพิมพ์เล็ก/ใหญ่) */
export function searchNotes(q, tasks, notes) {
  const k = q.trim().toLowerCase();
  if (!k) return [];
  const out = [];
  for (const t of tasks) {
    for (const n of notes(t.id)) if (n.kind === 'text' && (n.text || '').toLowerCase().includes(k)) out.push({ task: t, note: n });
    if ((t.title || '').toLowerCase().includes(k)) out.push({ task: t, note: null });
  }
  return out.slice(0, 30);
}

// SABAii: ส่งแจ้งเตือนตอนเย็นก่อนวันส่ง (Web Push)
//   • pg_cron ทุก 15 นาที → POST พร้อม x-cron-key → push_due() → ส่งให้เครื่องที่ถึงเวลา → push_mark()
//   • ปุ่ม "ส่งแจ้งเตือนทดสอบ" ในแอป → POST { test: true } พร้อม token ผู้ใช้ → ส่งไปทุกเครื่องของคนนั้น
//   กุญแจทั้งหมดอยู่ใน Vault (push_config) · ครั้งแรกสร้างกุญแจ VAPID เอง
// deploy: verify_jwt = false (ฟังก์ชันตรวจสิทธิ์เอง: cron key หรือ token ผู้ใช้)
import webpush from "npm:web-push@3.6.7";
import { compose, TEST_MESSAGE } from "./compose.js";

const SB = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function rpc(name: string, body: Record<string, unknown> = {}) {
  const r = await fetch(`${SB}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${name}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function config() {
  let cfg = await rpc("push_config");
  if (!cfg?.vapid_private) {
    const k = webpush.generateVAPIDKeys();
    await rpc("push_set_vapid", { p_public: k.publicKey, p_private: k.privateKey });
    cfg = await rpc("push_config");
  }
  webpush.setVapidDetails("https://sabaii.vercel.app", cfg.vapid_public, cfg.vapid_private);
  return cfg;
}

type Sub = { endpoint: string; p256dh: string; auth: string };
async function send(sub: Sub, msg: unknown) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(msg), { TTL: 6 * 3600, urgency: "normal" });
    return "sent";
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    return code === 404 || code === 410 ? "gone" : `error ${code ?? ""} ${(e as Error).message}`.trim();
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* ว่างได้ */ }
  const cfg = await config();

  // ---- ทดสอบจากแอป: ต้องเป็นผู้ใช้ที่เข้าสู่ระบบ ----
  if (body.test) {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const u = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: KEY, Authorization: `Bearer ${token}` } });
    if (!token || !u.ok) return json({ error: "ต้องเข้าสู่ระบบ" }, 401);
    const { id } = await u.json();
    const subs: Sub[] = await rpc("push_subs_of", { p_user: id });
    const results = await Promise.all(subs.map((s) => send(s, TEST_MESSAGE)));
    const gone = subs.filter((_, i) => results[i] === "gone").map((s) => s.endpoint);
    if (gone.length) await rpc("push_drop", { p_endpoints: gone });
    return json({ devices: subs.length, sent: results.filter((r) => r === "sent").length, results });
  }

  // ---- รอบเวลา (pg_cron) ----
  if (req.headers.get("x-cron-key") !== cfg.cron_key) return json({ error: "forbidden" }, 403);
  const due: (Sub & { tasks: unknown[] })[] = await rpc("push_due");
  const done: string[] = [], gone: string[] = [], errors: string[] = [];
  let sent = 0;
  await Promise.all(due.map(async (d) => {
    const msg = compose(d.tasks as never);
    if (!msg) { done.push(d.endpoint); return; } // ไม่มีงานพรุ่งนี้ = ไม่รบกวน แต่นับว่าวันนี้เช็กแล้ว
    const r = await send(d, msg);
    if (r === "sent") { sent++; done.push(d.endpoint); }
    else if (r === "gone") gone.push(d.endpoint);
    else errors.push(r); // ล้มชั่วคราว = ไม่จด รอบหน้าลองใหม่ (ภายใน 3 ชั่วโมง)
  }));
  if (done.length) await rpc("push_mark", { p_endpoints: done });
  if (gone.length) await rpc("push_drop", { p_endpoints: gone });
  return json({ checked: due.length, sent, gone: gone.length, errors });
});

// เทสต์ที่ไม่ได้ทดสอบเรื่องบัญชี: ให้เบราว์เซอร์ "เข้าสู่ระบบอยู่แล้ว" (แอปต้องเข้าสู่ระบบก่อนใช้ตั้งแต่ 0.13)
// + Supabase ปลอมที่ตอบว่าบัญชีว่าง/รับข้อมูลไว้ ไม่ต่อเน็ตจริง · เทสต์เรื่องบัญชีจริงอยู่ที่ account.e2e.cjs
const SESSION = { access_token: 'TEST', refresh_token: 'TEST', expires_at: 4102444800000, user: { id: 'test-user', email: 'test@sabaii.test', name: 'ทดสอบ', avatar: '' } };

async function signedIn(ctx) {
  await ctx.addInitScript(s => { try { if (!localStorage.getItem('sabaii-auth')) localStorage.setItem('sabaii-auth', s); } catch {} }, JSON.stringify(SESSION));
  await ctx.route('https://*.supabase.co/**', route => {
    const req = route.request(), p = new URL(req.url()).pathname;
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: cors });
    const body = p === '/rest/v1/items' ? [] : p === '/rest/v1/rpc/sync_push' ? 0 : {};
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
  });
  return ctx;
}

/** ทุก context ที่ browser นี้สร้างจะเข้าสู่ระบบอยู่แล้ว */
function autoSignIn(browser) {
  const make = browser.newContext.bind(browser);
  browser.newContext = async opts => signedIn(await make(opts));
  return browser;
}

module.exports = { signedIn, autoSignIn, SESSION };

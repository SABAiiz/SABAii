#!/bin/sh
# สร้างเว็บสำหรับขึ้น Vercel (ไม่ต้องติดตั้งอะไร ใช้แค่ cp):
#   dist/            = หน้าแนะนำ (landing.html → index.html)
#   dist/app/        = แอปทั้งตัว (service worker คุมเฉพาะ /app/ ไม่ยุ่งกับหน้าแนะนำ)
# ปุ่ม "ลองใช้เลย" ในหน้าแนะนำ → app/?from=landing → แบบสอบถามเริ่มที่ข้อ 1 ในแท็บเดิม
set -e
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist/app dist/src
sed -e 's|<meta name="sabaii-app" content="[^"]*">|<meta name="sabaii-app" content="app/?from=landing">|' \
    -e 's|<meta name="sabaii-hand" content="[^"]*">|<meta name="sabaii-hand" content="app/src/gesture/hand.js">|' landing.html > dist/index.html
cp -R src/landing dist/src/landing
cp -R assets icon-192.png icon-512.png apple-touch-icon.png favicon.png dist/
rm -rf dist/assets/vendor   # ตัวตามมือ (~17MB) มีชุดเดียวที่ /app/ — หน้าแนะนำโหลดจากที่นั่น
cp index.html manifest.webmanifest sw.js icon-192.png icon-512.png apple-touch-icon.png favicon.png dist/app/
cp -R src assets dist/app/
rm -rf dist/app/src/landing
cp -R care dist/care   # แบบสอบถาม "เสียงคนดูแล" (SPU AI Hackathon) → /care/
cp -R study dist/study   # แบบสอบถาม "เสียงนักเรียน" (SABAii) → /study/
echo "built dist/ ($(find dist -type f | wc -l | tr -d ' ') files)"

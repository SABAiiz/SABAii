#!/bin/sh
# สร้างเว็บสำหรับขึ้น Vercel (ไม่ต้องติดตั้งอะไร ใช้แค่ cp):
#   dist/            = หน้าแนะนำ (landing.html → index.html)
#   dist/app/        = แอปทั้งตัว (service worker คุมเฉพาะ /app/ ไม่ยุ่งกับหน้าแนะนำ)
# ปุ่ม "ลองใช้เลย" ในหน้าแนะนำ → app/?from=landing → แบบสอบถามเริ่มที่ข้อ 1 ในแท็บเดิม
set -e
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist/app dist/src
sed 's|<meta name="sabaii-app" content="[^"]*">|<meta name="sabaii-app" content="app/?from=landing">|' landing.html > dist/index.html
cp -R src/landing dist/src/landing
cp -R assets icon.svg dist/
cp index.html manifest.webmanifest sw.js icon.svg dist/app/
cp -R src assets dist/app/
rm -rf dist/app/src/landing
echo "built dist/ ($(find dist -type f | wc -l | tr -d ' ') files)"

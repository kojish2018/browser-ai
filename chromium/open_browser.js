const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://hojokindeskai.com');
  console.log('Chromiumブラウザを起動しました。手動で操作してください。');
  // ブラウザが自動で閉じないように、ここで処理を停止します。
  // ターミナルで Ctrl+C を押すと終了します。
  await new Promise(() => {});
})();

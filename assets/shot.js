const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }).catch(async e => {
    return await chromium.launch({ args: ['--no-sandbox'] });
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  await page.goto('file:///root/passage/app/index.html');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'demo-shot.png' });
  await browser.close();
  console.log('ok');
})();

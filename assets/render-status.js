const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.goto('file://' + path.resolve(__dirname, 'status.html'), { waitUntil: 'networkidle' });
  await p.pdf({
    path: path.resolve(__dirname, 'passage-status.pdf'),
    format: 'A4', printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });
  await b.close();
  console.log('PDF geschreven');
})();

import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,820'],
    defaultViewport: { width: 1280, height: 820 }
  });

  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:1420', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 600));

  // Open modal in Papein Light
  await page.click('.pill-dac-main');
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'C:/Users/korla/.gemini/antigravity/brain/63454dd2-458f-4f2b-9c65-5d77a2d470d5/verify_picker_papein_light.png' });

  // Switch to Dark mode
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-mode', 'dark');
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'C:/Users/korla/.gemini/antigravity/brain/63454dd2-458f-4f2b-9c65-5d77a2d470d5/verify_picker_papein_dark.png' });

  // Navigate to Device screen and verify clicking Connect opens modal
  await page.evaluate(() => {
    document.querySelector('.themed-hid-btn-cancel')?.click();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.pill-link'));
    const devBtn = buttons.find(b => b.innerText.includes('Device'));
    devBtn?.click();
  });
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    const connBtn = document.querySelector('button[aria-label="Connect DAC"]');
    connBtn?.click();
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: 'C:/Users/korla/.gemini/antigravity/brain/63454dd2-458f-4f2b-9c65-5d77a2d470d5/verify_picker_from_device_page.png' });

  await browser.close();
  console.log('Screenshots captured successfully!');
}

main().catch(console.error);

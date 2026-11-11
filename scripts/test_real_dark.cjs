const http = require('http');
const fs = require('fs');

function post(pathName, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`http://127.0.0.1:1422${pathName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(pathName) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:1422${pathName}`, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

async function run() {
  console.log('1. Go to Settings and toggle Dark switch button...');
  await post('/eval', {
    script: `
      (() => {
        const navBtns = Array.from(document.querySelectorAll('nav.top-nav button, header button'));
        const sBtn = navBtns.find(b => b.textContent.includes('Settings'));
        if (sBtn) sBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 400));

  await post('/eval', {
    script: `
      (() => {
        const darkToggle = document.querySelector('button[aria-label="Dark mode"]');
        if (darkToggle) {
          darkToggle.click();
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 400));

  let snap = await get('/screenshot');
  fs.writeFileSync('C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\screen_settings_dark.png', snap.data);
  console.log('Saved screen_settings_dark.png');

  console.log('2. Go to Studio in dark mode...');
  await post('/eval', {
    script: `
      (() => {
        const navBtns = Array.from(document.querySelectorAll('nav.top-nav button, header button'));
        const stBtn = navBtns.find(b => b.textContent.includes('Studio'));
        if (stBtn) stBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 400));

  snap = await get('/screenshot');
  fs.writeFileSync('C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\screen_studio_dark.png', snap.data);
  console.log('Saved screen_studio_dark.png');

  console.log('3. Open Presets search in dark mode...');
  await post('/eval', {
    script: `
      (() => {
        const searchInput = document.querySelector('header input[type="search"], input[placeholder*="Search"]');
        if (searchInput) {
          searchInput.focus();
          searchInput.value = 'Harman';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 400));

  snap = await get('/screenshot');
  fs.writeFileSync('C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\screen_dark_search_active.png', snap.data);
  console.log('Saved screen_dark_search_active.png');
}

run().catch(console.error);

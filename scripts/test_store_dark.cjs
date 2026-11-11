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
  await post('/eval', {
    script: `
      (() => {
        // Blur search input to close dropdown
        const active = document.activeElement;
        if (active) active.blur();

        // Switch to Dark mode via the settings checkbox
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
        const toggle = document.querySelector('input[type="checkbox"]');
        if (toggle && !toggle.checked) {
          toggle.click();
        }
        // Go back to studio
        const navBtns = Array.from(document.querySelectorAll('nav.top-nav button, header button'));
        const stBtn = navBtns.find(b => b.textContent.includes('Studio'));
        if (stBtn) stBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 500));

  const snap = await get('/screenshot');
  fs.writeFileSync('C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\screen_true_dark.png', snap.data);
  console.log('Saved screen_true_dark.png');
}

run().catch(console.error);

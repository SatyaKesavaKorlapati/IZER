const http = require('http');
const fs = require('fs');
const path = require('path');

function get(pathName) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:1422${pathName}`, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

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

async function testScreens() {
  console.log('Close modal...');
  await post('/eval', {
    script: `
      (() => {
        const cancelBtn = document.querySelector('.themed-hid-btn-cancel');
        if (cancelBtn) cancelBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 300));

  console.log('Go to Settings...');
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
  let snap = await get('/screenshot');
  fs.writeFileSync('C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\screen_settings.png', snap.data);

  console.log('Go to Import...');
  await post('/eval', {
    script: `
      (() => {
        const navBtns = Array.from(document.querySelectorAll('nav.top-nav button, header button'));
        const iBtn = navBtns.find(b => b.textContent.includes('Import'));
        if (iBtn) iBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 400));
  snap = await get('/screenshot');
  fs.writeFileSync('C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\screen_import.png', snap.data);

  console.log('Done captures!');
}

testScreens().catch(console.error);

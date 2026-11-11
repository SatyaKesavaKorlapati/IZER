const http = require('http');
const fs = require('fs');

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

async function testClickConnectButton() {
  console.log('1. Opening popup modal...');
  await post('/eval', {
    script: `
      (() => {
        const pill = document.querySelector('.pill-dac-main');
        if (pill) pill.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  const rectRes = await post('/eval', {
    script: `
      (() => {
        const btn = document.querySelector('.themed-hid-btn-connect');
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return {
          text: btn.textContent.trim(),
          disabled: btn.disabled,
          x: Math.round(r.x + r.width / 2),
          y: Math.round(r.y + r.height / 2)
        };
      })()
    `
  });
  console.log('Connect button in modal info:', rectRes.data);
  const target = JSON.parse(rectRes.data).result;

  if (target && !target.disabled) {
    console.log(`2. Clicking Connect button at (${target.x}, ${target.y})...`);
    await post('/click', { x: target.x, y: target.y });
    await new Promise(r => setTimeout(r, 1200));

    const snap = await get('/screenshot');
    const outPath = 'C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\popup_after_clicking_connect.png';
    fs.writeFileSync(outPath, snap.data);
    console.log('Saved screenshot after clicking Connect:', outPath);

    const statusRes = await post('/eval', {
      script: `
        (() => {
          const pill = document.querySelector('.pill-dac-main');
          const statusElem = document.querySelector('p[role="status"]');
          return {
            pill: pill ? pill.textContent.trim() : null,
            status: statusElem ? statusElem.textContent.trim() : null
          };
        })()
      `
    });
    console.log('App state:', statusRes.data);
  }
}

testClickConnectButton().catch(console.error);

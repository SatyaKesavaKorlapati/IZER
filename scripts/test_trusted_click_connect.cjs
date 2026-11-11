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

async function runTest() {
  console.log('1. Ensuring popup is open...');
  // Open popup via DAC pill
  await post('/eval', {
    script: `
      (() => {
        const pill = document.querySelector('.pill-dac-main');
        if (pill) pill.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  // Take screenshot of popup before clicking connect new device
  let snapBefore = await get('/screenshot');
  const pathBefore = 'C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\popup_before_connect_new_devices.png';
  fs.writeFileSync(pathBefore, snapBefore.data);
  console.log('Saved popup before click:', pathBefore);

  // Find exact coordinate of "Connect new device" button
  const rectRes = await post('/eval', {
    script: `
      (() => {
        const btn = document.querySelector('.themed-hid-btn-pair-new');
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return {
          text: btn.textContent.trim(),
          x: Math.round(r.x + r.width / 2),
          y: Math.round(r.y + r.height / 2)
        };
      })()
    `
  });
  console.log('Target button info:', rectRes.data);
  const target = JSON.parse(rectRes.data).result;

  if (target) {
    console.log(`2. Sending trusted click to (${target.x}, ${target.y})...`);
    const clickRes = await post('/click', { x: target.x, y: target.y });
    console.log('Click result:', clickRes.data);

    // Wait for the action and WebHID request to execute
    await new Promise(r => setTimeout(r, 1200));

    // Capture screenshot of what appears after clicking
    let snapAfter = await get('/screenshot');
    const pathAfter = 'C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\popup_after_connect_new_devices.png';
    fs.writeFileSync(pathAfter, snapAfter.data);
    console.log('Saved screenshot after clicking connect new devices:', pathAfter);

    // Check status in renderer
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
    console.log('App state after click:', statusRes.data);
  }
}

runTest().catch(console.error);

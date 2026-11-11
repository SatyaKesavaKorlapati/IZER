const http = require('http');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

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

async function testClickInModal() {
  // First ensure modal is open
  await post('/eval', {
    script: `
      (() => {
        const pill = document.querySelector('.pill-dac-main');
        if (pill) pill.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 400));

  // Find "Scan for devices" button/link inside the modal
  const scanBtn = await post('/eval', {
    script: `
      (() => {
        const scan = document.querySelector('.themed-hid-btn-pair-new');
        const connect = document.querySelector('.themed-hid-btn-connect');
        return {
          scanText: scan ? scan.textContent : null,
          connectText: connect ? connect.textContent : null
        };
      })()
    `
  });
  console.log('Buttons inside modal:', scanBtn.data);

  // Take screenshot before click
  let snapBefore = await get('/screenshot');
  fs.writeFileSync('C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\click_before.png', snapBefore.data);

  // Now click "Scan for devices"
  console.log('Clicking "Scan for devices"...');
  const clickRes = await post('/eval', {
    script: `
      (() => {
        const scan = document.querySelector('.themed-hid-btn-pair-new');
        if (scan) {
          scan.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `
  });
  console.log('Scan clicked:', clickRes.data);

  // Wait 1 second
  await new Promise(r => setTimeout(r, 1000));

  // Capture screenshot after click
  let snapAfter = await get('/screenshot');
  const outPath = 'C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\click_after_scan_devices.png';
  fs.writeFileSync(outPath, snapAfter.data);
  console.log('Saved screenshot after clicking scan devices:', outPath);

  // Also check top nav and status message
  const statusRes = await post('/eval', {
    script: `
      (() => {
        const pill = document.querySelector('.pill-dac-main');
        const srStatus = document.querySelector('p[role="status"]');
        return {
          pillText: pill ? pill.textContent.trim() : null,
          statusText: srStatus ? srStatus.textContent.trim() : null
        };
      })()
    `
  });
  console.log('App state after click:', statusRes.data);
}

testClickInModal().catch(console.error);

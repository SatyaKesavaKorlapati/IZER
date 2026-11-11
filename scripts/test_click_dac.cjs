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

async function testClickDac() {
  const boundsRes = await get('/bounds');
  const bounds = JSON.parse(boundsRes.data.toString('utf8'));
  console.log('Window Bounds:', bounds);

  // Import nut-js for physical cursor control
  const nutPath = 'C:\\Users\\korla\\AppData\\Roaming\\npm\\node_modules\\computer-use-mcp\\node_modules\\@nut-tree-fork\\nut-js\\dist\\index.js';
  const nut = await import(pathToFileURL(nutPath).href);
  const { mouse, Point } = nut;

  // DAC pill is at x ~ 952 inside window, y ~ 30 inside window (plus titlebar offset ~ 30px)
  const targetScreenX = bounds.x + 952;
  const targetScreenY = bounds.y + 30 + 25; // add window frame titlebar offset
  console.log(`Moving physical mouse cursor to screen (${targetScreenX}, ${targetScreenY})...`);

  await mouse.setPosition(new Point(targetScreenX, targetScreenY));
  console.log('Mouse moved!');

  // Trigger click on the DAC pill in the renderer
  console.log('Clicking DAC pill...');
  const clickRes = await post('/eval', {
    script: `
      (() => {
        const pill = document.querySelector('.pill-dac-main');
        if (pill) {
          pill.click();
          return { clicked: true, text: pill.textContent.trim() };
        }
        return { clicked: false };
      })()
    `
  });
  console.log('Click result:', clickRes.data);

  // Wait a moment for modal to render
  await new Promise(r => setTimeout(r, 600));

  // Check if modal is visible in DOM
  const checkModal = await post('/eval', {
    script: `
      (() => {
        const modal = document.querySelector('.themed-hid-modal-sheet');
        const overlay = document.querySelector('.themed-hid-modal-overlay');
        const title = modal ? modal.querySelector('h2')?.textContent : null;
        const devices = modal ? Array.from(modal.querySelectorAll('.themed-hid-device-row')).map(r => r.textContent.trim()) : [];
        return {
          isOpen: !!overlay,
          title,
          devices
        };
      })()
    `
  });
  console.log('Modal status:', checkModal.data);

  // Capture screenshot of the modal open on screen!
  const snap = await get('/screenshot');
  const outPath = 'C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\screen_modal_open.png';
  fs.writeFileSync(outPath, snap.data);
  console.log('Modal screenshot saved to:', outPath);
}

testClickDac().catch(console.error);

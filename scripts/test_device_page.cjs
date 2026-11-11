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

async function testDevicePage() {
  const nutPath = 'C:\\Users\\korla\\AppData\\Roaming\\npm\\node_modules\\computer-use-mcp\\node_modules\\@nut-tree-fork\\nut-js\\dist\\index.js';
  const nut = await import(pathToFileURL(nutPath).href);
  const { mouse, Point } = nut;

  console.log('1. Closing modal if open...');
  await post('/eval', {
    script: `
      (() => {
        const cancelBtn = document.querySelector('.themed-hid-btn-cancel');
        if (cancelBtn) cancelBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 400));

  console.log('2. Navigating to Device screen...');
  await post('/eval', {
    script: `
      (() => {
        const navBtns = Array.from(document.querySelectorAll('nav.top-nav button, header button'));
        const devBtn = navBtns.find(b => b.textContent.includes('Device'));
        if (devBtn) devBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 500));

  // Capture Device screen
  let snap = await get('/screenshot');
  let outPath = 'C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\screen_device_screen.png';
  fs.writeFileSync(outPath, snap.data);
  console.log('Device screen saved to:', outPath);

  // Get Connect button rect
  const btnInfo = await post('/eval', {
    script: `
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const connectBtn = btns.find(b => b.textContent.trim() === 'Connect');
        const otherBtn = btns.find(b => b.textContent.trim() === 'Other device');
        const cRect = connectBtn ? connectBtn.getBoundingClientRect() : null;
        const oRect = otherBtn ? otherBtn.getBoundingClientRect() : null;
        return {
          connect: cRect ? { x: cRect.x, y: cRect.y, w: cRect.width, h: cRect.height } : null,
          other: oRect ? { x: oRect.x, y: oRect.y, w: oRect.width, h: oRect.height } : null
        };
      })()
    `
  });
  console.log('Button rects on Device page:', btnInfo.data);

  const boundsRes = await get('/bounds');
  const bounds = JSON.parse(boundsRes.data.toString('utf8'));
  const rects = JSON.parse(btnInfo.data).result;

  if (rects.connect) {
    const targetX = Math.round(bounds.x + rects.connect.x + rects.connect.w / 2);
    const targetY = Math.round(bounds.y + rects.connect.y + rects.connect.h / 2 + 30); // frame offset
    console.log(`3. Moving cursor to Connect button at (${targetX}, ${targetY})...`);
    await mouse.setPosition(new Point(targetX, targetY));
    await new Promise(r => setTimeout(r, 200));

    console.log('Clicking Connect button...');
    await post('/eval', {
      script: `
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const connectBtn = btns.find(b => b.textContent.trim() === 'Connect');
          if (connectBtn) connectBtn.click();
        })()
      `
    });
    await new Promise(r => setTimeout(r, 600));

    snap = await get('/screenshot');
    outPath = 'C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\screen_device_modal_opened_from_button.png';
    fs.writeFileSync(outPath, snap.data);
    console.log('Modal opened from Device button saved to:', outPath);
  }
}

testDevicePage().catch(console.error);

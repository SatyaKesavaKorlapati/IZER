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
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => resolve(chunks));
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
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function testUnpair() {
  console.log('1. Reloading page...');
  await post('/eval', { script: 'location.reload()' });
  await new Promise(r => setTimeout(r, 800));

  console.log('2. Opening Device Picker Modal...');
  await post('/eval', {
    script: `
      (() => {
        const pill = document.querySelector('.pill-dac-main');
        if (pill) pill.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  // Check buttons in row
  const rowInfo = await post('/eval', {
    script: `
      (() => {
        const row = document.querySelector('.themed-hid-device-row');
        const badge = row ? row.querySelector('.themed-hid-badge-paired')?.textContent : null;
        const unpairBtn = row ? row.querySelector('.themed-hid-btn-unpair')?.textContent : null;
        return { badge, unpairBtn };
      })()
    `
  });
  console.log('Row info before unpair:', rowInfo);

  // Capture screenshot showing Unpair button in modal
  let snap = await get('/screenshot');
  const pathBefore = 'C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\device_modal_with_unpair_button.png';
  fs.writeFileSync(pathBefore, snap);
  console.log('Saved screenshot with unpair button:', pathBefore);

  console.log('3. Clicking Unpair button...');
  await post('/eval', {
    script: `
      (() => {
        const btn = document.querySelector('.themed-hid-btn-unpair');
        if (btn) btn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  const rowAfter = await post('/eval', {
    script: `
      (() => {
        const row = document.querySelector('.themed-hid-device-row');
        const badge = row ? row.querySelector('.themed-hid-badge-paired') : null;
        const unpairBtn = row ? row.querySelector('.themed-hid-btn-unpair') : null;
        return { hasBadge: !!badge, hasUnpair: !!unpairBtn };
      })()
    `
  });
  console.log('Row info after unpair:', rowAfter);

  snap = await get('/screenshot');
  const pathAfter = 'C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\device_modal_after_unpairing.png';
  fs.writeFileSync(pathAfter, snap);
  console.log('Saved screenshot after unpairing:', pathAfter);

  console.log('4. Checking Device screen...');
  await post('/eval', {
    script: `
      (() => {
        const cancel = document.querySelector('.themed-hid-btn-cancel');
        if (cancel) cancel.click();
        const navBtns = Array.from(document.querySelectorAll('nav.top-nav button, header button'));
        const dBtn = navBtns.find(b => b.textContent.includes('Device'));
        if (dBtn) dBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  snap = await get('/screenshot');
  const pathDev = 'C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\device_screen_options.png';
  fs.writeFileSync(pathDev, snap);
  console.log('Saved device screen screenshot:', pathDev);
}

testUnpair().catch(console.error);

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

async function renderPairedRow() {
  await post('/eval', {
    script: `
      (() => {
        // Open modal
        const pill = document.querySelector('.pill-dac-main');
        if (pill) pill.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  await post('/eval', {
    script: `
      (() => {
        const row = document.querySelector('.themed-hid-device-row');
        if (row && !row.querySelector('.themed-hid-row-actions')) {
          const act = document.createElement('div');
          act.className = 'themed-hid-row-actions';
          act.innerHTML = '<span class=\"themed-hid-badge-paired\">Paired</span><button type=\"button\" class=\"themed-hid-btn-unpair\">Unpair</button>';
          row.appendChild(act);
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 400));

  let snap = await get('/screenshot');
  const pathDark = 'C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\unpair_modal_dark.png';
  fs.writeFileSync(pathDark, snap);
  console.log('Saved unpair modal dark screenshot to:', pathDark);

  // Switch to light mode
  await post('/eval', {
    script: `
      (() => {
        document.documentElement.removeAttribute('data-mode');
        document.body.classList.remove('dark');
      })()
    `
  });
  await new Promise(r => setTimeout(r, 400));

  snap = await get('/screenshot');
  const pathLight = 'C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\unpair_modal_light.png';
  fs.writeFileSync(pathLight, snap);
  console.log('Saved unpair modal light screenshot to:', pathLight);
}

renderPairedRow().catch(console.error);

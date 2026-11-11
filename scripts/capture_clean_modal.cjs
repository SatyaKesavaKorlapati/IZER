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

async function run() {
  await post('/eval', { script: 'location.reload()' });
  await new Promise(r => setTimeout(r, 800));
  await post('/eval', {
    script: `
      (() => {
        const pill = document.querySelector('.pill-dac-main');
        if (pill) pill.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 600));

  const snap = await get('/screenshot');
  const outPath = 'C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\clean_modal_screenshot.png';
  fs.writeFileSync(outPath, snap);
  console.log('Saved clean modal screenshot to:', outPath);
}

run().catch(console.error);

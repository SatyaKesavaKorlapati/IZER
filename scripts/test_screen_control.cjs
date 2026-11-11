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

async function run() {
  console.log('Fetching window bounds...');
  const boundsRes = await get('/bounds');
  console.log('Bounds:', boundsRes.data.toString('utf8'));

  console.log('Capturing current window screenshot...');
  const snap1 = await get('/screenshot');
  const outPath1 = path.join('C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5', 'screen_initial.png');
  fs.writeFileSync(outPath1, snap1.data);
  console.log('Initial screenshot saved to:', outPath1);
}

run().catch(console.error);

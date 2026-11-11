const http = require('http');

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

async function inspectElements() {
  const code = `
    (() => {
      const dacPill = document.querySelector('.pill-dac-main');
      const dacRect = dacPill ? dacPill.getBoundingClientRect() : null;
      
      const navButtons = Array.from(document.querySelectorAll('nav.top-nav button, header button')).map(b => ({
        text: b.textContent.trim(),
        rect: b.getBoundingClientRect()
      }));

      return {
        dacRect: dacRect ? { x: dacRect.x, y: dacRect.y, w: dacRect.width, h: dacRect.height } : null,
        navButtons
      };
    })()
  `;

  const res = await post('/eval', { script: code });
  console.log('Result:', res.data);
}

inspectElements().catch(console.error);

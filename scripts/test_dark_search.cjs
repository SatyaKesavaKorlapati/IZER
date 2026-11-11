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

async function testDarkAndSearch() {
  console.log('1. Go to Studio...');
  await post('/eval', {
    script: `
      (() => {
        const navBtns = Array.from(document.querySelectorAll('nav.top-nav button, header button'));
        const sBtn = navBtns.find(b => b.textContent.includes('Studio'));
        if (sBtn) sBtn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 300));

  console.log('2. Toggle Dark mode...');
  await post('/eval', {
    script: `
      (() => {
        document.documentElement.setAttribute('data-dark', 'true');
        document.body.classList.add('dark');
        const themeBtn = Array.from(document.querySelectorAll('input[type="checkbox"]')).find(c => c.name === 'dark' || c.id === 'dark');
        if (themeBtn) {
          themeBtn.checked = true;
          themeBtn.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 400));
  let snap = await get('/screenshot');
  fs.writeFileSync('C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\screen_dark_studio.png', snap.data);

  console.log('3. Test Search popup in Dark mode...');
  await post('/eval', {
    script: `
      (() => {
        const searchInput = document.querySelector('header input[type="search"], input[placeholder*="Search"]');
        if (searchInput) {
          searchInput.focus();
          searchInput.value = 'Harman';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `
  });
  await new Promise(r => setTimeout(r, 500));
  snap = await get('/screenshot');
  fs.writeFileSync('C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5\\screen_dark_search.png', snap.data);

  console.log('Done dark and search tests!');
}

testDarkAndSearch().catch(console.error);

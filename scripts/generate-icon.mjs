import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="paper-bg" cx="50%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#fff8ec"/>
      <stop offset="45%" stop-color="#f6e3c5"/>
      <stop offset="100%" stop-color="#e3be8a"/>
    </radialGradient>
    <linearGradient id="terracotta-gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#b94b35"/>
      <stop offset="50%" stop-color="#d99425"/>
      <stop offset="100%" stop-color="#b94b35"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#402719" flood-opacity="0.35"/>
    </filter>
  </defs>

  <!-- Base Paper Tile -->
  <rect x="24" y="24" width="464" height="464" rx="108" fill="url(#paper-bg)" stroke="#8e552f" stroke-width="8" filter="url(#shadow)"/>
  
  <!-- Outer Dotted Filigree Border -->
  <rect x="42" y="42" width="428" height="428" rx="90" fill="none" stroke="url(#terracotta-gold)" stroke-width="4.5" stroke-dasharray="8 5"/>

  <!-- Inner Indian Arch Scallop Frame -->
  <path d="M 120 76 
           C 180 76, 210 60, 256 60 
           C 302 60, 332 76, 392 76 
           C 436 76, 448 108, 448 152 
           C 448 200, 436 216, 436 256 
           C 436 296, 448 312, 448 360 
           C 448 404, 436 436, 392 436 
           C 332 436, 302 452, 256 452 
           C 210 452, 180 436, 120 436 
           C 76 436, 64 404, 64 360 
           C 64 312, 76 296, 76 256 
           C 76 216, 64 200, 64 152 
           C 64 108, 76 76, 120 76 Z" 
        fill="#fdf9f0" 
        stroke="#8e552f" 
        stroke-width="5" 
        filter="url(#shadow)"/>

  <!-- Scalloped Inner Filigree -->
  <path d="M 130 92 
           C 185 92, 212 78, 256 78 
           C 300 78, 327 92, 382 92 
           C 420 92, 430 120, 430 156 
           C 430 196, 420 210, 420 256 
           C 420 302, 430 316, 430 356 
           C 430 392, 420 420, 382 420 
           C 327 420, 300 434, 256 434 
           C 212 434, 185 420, 130 420 
           C 92 420, 82 392, 82 356 
           C 82 316, 92 302, 92 256 
           C 92 210, 82 196, 82 156 
           C 82 120, 92 92, 130 92 Z" 
        fill="none" 
        stroke="url(#terracotta-gold)" 
        stroke-width="3" 
        stroke-dasharray="6 4"/>

  <!-- Traditional Floral Corner & Crest Ornaments -->
  <g fill="#b94b35">
    <circle cx="256" cy="74" r="7"/>
    <circle cx="256" cy="438" r="7"/>
    <circle cx="74" cy="256" r="7"/>
    <circle cx="438" cy="256" r="7"/>
    <circle cx="256" cy="74" r="3.5" fill="#ffd15c"/>
    <circle cx="256" cy="438" r="3.5" fill="#ffd15c"/>
  </g>

  <!-- Audio Waveform in Teal & Terracotta -->
  <path d="M 100 236 L 148 236 L 180 148 L 228 320 L 276 176 L 316 272 L 348 236 L 412 236" 
        fill="none" 
        stroke="#1a8f9a" 
        stroke-width="14" 
        stroke-linecap="round" 
        stroke-linejoin="round"/>

  <!-- Foreground Waveform Overlay in Rich Dark Ink -->
  <path d="M 100 236 L 148 236 L 180 148 L 228 320 L 276 176 L 316 272 L 348 236 L 412 236" 
        fill="none" 
        stroke="#382012" 
        stroke-width="7" 
        stroke-linecap="round" 
        stroke-linejoin="round"/>

  <!-- Frequency Points -->
  <circle cx="180" cy="148" r="10" fill="#b94b35" stroke="#fdf9f0" stroke-width="3.5"/>
  <circle cx="228" cy="320" r="10" fill="#d99425" stroke="#fdf9f0" stroke-width="3.5"/>
  <circle cx="276" cy="176" r="10" fill="#1a8f9a" stroke="#fdf9f0" stroke-width="3.5"/>
  <circle cx="316" cy="272" r="10" fill="#ba7392" stroke="#fdf9f0" stroke-width="3.5"/>

  <!-- IZER Typography Wordmark -->
  <text x="256" y="388" 
        text-anchor="middle" 
        font-family="'Abhaya Libre', 'Georgia', serif" 
        font-size="64" 
        font-weight="900" 
        letter-spacing="10" 
        fill="#382012">IZER</text>
</svg>
`;

async function main() {
  const buildDir = path.resolve("build");
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

  fs.writeFileSync(path.join(buildDir, "icon.svg"), iconSvg.trim());

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--window-size=512,512"],
    defaultViewport: { width: 512, height: 512, deviceScaleFactor: 1 }
  });

  const page = await browser.newPage();
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent;overflow:hidden;">${iconSvg}</body></html>`);
  await page.evaluateHandle("document.fonts.ready");
  await new Promise(r => setTimeout(r, 400));

  const png512 = path.join(buildDir, "icon.png");
  await page.screenshot({ path: png512, omitBackground: true });
  console.log("Created build/icon.png");

  // Create public/favicon.png and icon.png
  const publicDir = path.resolve("public");
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  fs.copyFileSync(png512, path.join(publicDir, "icon.png"));
  fs.copyFileSync(png512, path.join(publicDir, "favicon.png"));

  // Also copy to electron/icon.png
  fs.copyFileSync(png512, path.resolve("electron", "icon.png"));

  // Generate .ico file format (simple multi-resolution ICO header)
  // We can write a 256x256 png wrapped into an ICO container
  const page256 = await browser.newPage();
  await page256.setViewport({ width: 256, height: 256, deviceScaleFactor: 1 });
  await page256.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent;overflow:hidden;"><div style="width:256px;height:256px;">${iconSvg.replace(/width="512"/, 'width="256"').replace(/height="512"/, 'height="256"')}</div></body></html>`);
  await page256.evaluateHandle("document.fonts.ready");
  const png256Buffer = await page256.screenshot({ omitBackground: true });

  // Create standard ICO container from PNG
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0); // reserved
  icoHeader.writeUInt16LE(1, 2); // type 1 = icon
  icoHeader.writeUInt16LE(1, 4); // count of images = 1

  const icoEntry = Buffer.alloc(16);
  icoEntry.writeUInt8(0, 0); // width 256 (0 = 256)
  icoEntry.writeUInt8(0, 1); // height 256 (0 = 256)
  icoEntry.writeUInt8(0, 2); // colors = 0 (no palette)
  icoEntry.writeUInt8(0, 3); // reserved
  icoEntry.writeUInt16LE(1, 4); // planes
  icoEntry.writeUInt16LE(32, 6); // bpp
  icoEntry.writeUInt32LE(png256Buffer.length, 8); // size
  icoEntry.writeUInt32LE(22, 12); // offset (6 + 16 = 22)

  const icoBuffer = Buffer.concat([icoHeader, icoEntry, png256Buffer]);
  fs.writeFileSync(path.join(buildDir, "icon.ico"), icoBuffer);
  fs.writeFileSync(path.resolve("electron", "icon.ico"), icoBuffer);
  console.log("Created build/icon.ico and electron/icon.ico");

  await browser.close();
}

main().catch(console.error);

import puppeteer from "puppeteer-core";
import path from "node:path";

const outDir = "C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5";

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,820"],
    defaultViewport: { width: 1280, height: 820 }
  });

  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:1420/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const raw = localStorage.getItem("ja11-glass-eq-v1");
    const data = raw ? JSON.parse(raw) : {};
    data.settings = {
      ...(data.settings || {}),
      theme: "papein",
      dark: false,
      lookVersion: 2
    };
    localStorage.setItem("ja11-glass-eq-v1", JSON.stringify(data));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 600));

  // 1. Device Picker Modal (filtered to dongle only)
  await page.evaluate(() => {
    const btn = document.querySelector(".pill-dac-main");
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(outDir, "verify_device_picker_filtered.png") });
  console.log("1. verify_device_picker_filtered.png");

  // Close modal
  await page.evaluate(() => {
    const cancelBtn = document.querySelector(".themed-hid-btn-cancel");
    if (cancelBtn) cancelBtn.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  // 2. Settings Tiles
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll(".pill-link"));
    const settings = navButtons.find(b => b.textContent.includes("Settings"));
    if (settings) settings.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(outDir, "verify_tiles_settings.png") });
  console.log("2. verify_tiles_settings.png");

  // 3. Import / Export Tiles
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll(".pill-link"));
    const transfer = navButtons.find(b => b.textContent.includes("Import"));
    if (transfer) transfer.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(outDir, "verify_tiles_import.png") });
  console.log("3. verify_tiles_import.png");

  // 4. Device Tiles
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll(".pill-link"));
    const device = navButtons.find(b => b.textContent.includes("Device"));
    if (device) device.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(outDir, "verify_tiles_device.png") });
  console.log("4. verify_tiles_device.png");

  await browser.close();
  console.log("All verifications captured successfully!");
}

main().catch(console.error);

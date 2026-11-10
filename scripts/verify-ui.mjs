import puppeteer from "puppeteer-core";
import path from "node:path";

const outDir = "C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5";

async function run() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,820"],
    defaultViewport: { width: 1280, height: 820 }
  });

  const page = await browser.newPage();

  // Test Papein Dark Mode
  await page.goto("http://127.0.0.1:1420/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const raw = localStorage.getItem("ja11-glass-eq-v1");
    const data = raw ? JSON.parse(raw) : {};
    data.settings = {
      ...(data.settings || {}),
      theme: "papein",
      dark: true,
      lookVersion: 2
    };
    localStorage.setItem("ja11-glass-eq-v1", JSON.stringify(data));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 600));

  // 1. Studio Dark
  await page.screenshot({ path: path.join(outDir, "verify_studio_dark.png") });
  console.log("1. verify_studio_dark.png");

  // 2. Search Dark hit hover
  await page.type(".top-search-input", "harman");
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(outDir, "verify_search_dark.png") });
  console.log("2. verify_search_dark.png");

  // Clear search and blur
  await page.evaluate(() => {
    const inp = document.querySelector(".top-search-input");
    if (inp) {
      inp.value = "";
      inp.dispatchEvent(new Event("input", { bubbles: true }));
      inp.blur();
    }
  });
  await new Promise((r) => setTimeout(r, 300));

  // 3. Settings Dark
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll(".pill-link"));
    const settings = navButtons.find(b => b.textContent.includes("Settings"));
    if (settings) settings.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(outDir, "verify_settings_dark.png") });
  console.log("3. verify_settings_dark.png");

  // 4. Device Modal Dark
  await page.evaluate(() => {
    const btn = document.querySelector(".pill-dac-main");
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(outDir, "verify_device_modal_dark.png") });
  console.log("4. verify_device_modal_dark.png");

  await browser.close();
  console.log("Dark mode verifications finished!");
}

run().catch(console.error);

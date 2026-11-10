import puppeteer from "puppeteer-core";

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,820"],
    defaultViewport: { width: 1280, height: 820 }
  });

  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:1420/", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 600));

  // 1. High darkness (85%)
  await page.evaluate(() => {
    const raw = localStorage.getItem("ja11-glass-eq-v1");
    const data = raw ? JSON.parse(raw) : {};
    data.settings = {
      ...(data.settings || {}),
      theme: "paper",
      dark: true,
      themeIntensity: 85,
      lookVersion: 2
    };
    localStorage.setItem("ja11-glass-eq-v1", JSON.stringify(data));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: "C:\\Users\\korla\\.gemini\\antigravity\\brain\\f806ff80-9421-47f5-9979-c5fd672302ed\\paper_dark_85.png" });
  console.log("Captured paper_dark_85.png");

  // 2. Settings screen
  await page.evaluate(() => {
    // Click Settings button via DOM
    const navButtons = Array.from(document.querySelectorAll(".pill-link"));
    const settings = navButtons.find(b => b.textContent.includes("Settings"));
    if (settings) settings.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: "C:\\Users\\korla\\.gemini\\antigravity\\brain\\f806ff80-9421-47f5-9979-c5fd672302ed\\settings_paper.png" });
  console.log("Captured settings_paper.png");

  // 3. Presets screen
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll(".pill-link"));
    const presets = navButtons.find(b => b.textContent.includes("Presets"));
    if (presets) presets.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: "C:\\Users\\korla\\.gemini\\antigravity\\brain\\f806ff80-9421-47f5-9979-c5fd672302ed\\presets_paper.png" });
  console.log("Captured presets_paper.png");

  await browser.close();
}

main().catch(console.error);

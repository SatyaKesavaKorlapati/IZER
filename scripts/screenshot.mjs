import puppeteer from "puppeteer-core";

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,820"],
    defaultViewport: { width: 1280, height: 820 }
  });

  const page = await browser.newPage();

  // Load the page
  await page.goto("http://127.0.0.1:1420/", { waitUntil: "domcontentloaded", timeout: 10000 });
  await new Promise((r) => setTimeout(r, 600));

  // Initialize localStorage to Paper Light
  await page.evaluate(() => {
    localStorage.clear();
    const state = {
      settings: {
        theme: "paper",
        dark: false,
        themeIntensity: 0,
        lookVersion: 2,
        autoPreampDefault: true,
        confirmBeforeSave: true
      }
    };
    localStorage.setItem("ja11-glass-eq-v1", JSON.stringify(state));
  });

  await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 });
  await new Promise((r) => setTimeout(r, 800));

  console.log("DOM theme:", await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    mode: document.documentElement.dataset.mode
  })));

  // 1. Screenshot Paper Light Studio
  await page.screenshot({ path: "C:\\Users\\korla\\.gemini\\antigravity\\brain\\f806ff80-9421-47f5-9979-c5fd672302ed\\paper_light_fixed.png" });
  console.log("Saved paper_light_fixed.png");

  // 2. Open Quick Search Dropdown
  const searchInput = await page.$(".top-search-input");
  if (searchInput) {
    await searchInput.click();
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: "C:\\Users\\korla\\.gemini\\antigravity\\brain\\f806ff80-9421-47f5-9979-c5fd672302ed\\search_dropdown_fixed.png" });
    console.log("Saved search_dropdown_fixed.png");
    // Click outside to close search
    await page.click(".pill-brand");
    await new Promise((r) => setTimeout(r, 200));
  }

  // 3. Switch to Dark Mode at 25% intensity
  await page.evaluate(() => {
    const raw = localStorage.getItem("ja11-glass-eq-v1");
    const data = raw ? JSON.parse(raw) : {};
    data.settings = {
      ...(data.settings || {}),
      theme: "paper",
      dark: true,
      themeIntensity: 25,
      lookVersion: 2
    };
    localStorage.setItem("ja11-glass-eq-v1", JSON.stringify(data));
  });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: "C:\\Users\\korla\\.gemini\\antigravity\\brain\\f806ff80-9421-47f5-9979-c5fd672302ed\\paper_dark_25.png" });
  console.log("Saved paper_dark_25.png");

  // 4. Increase Dark Mode intensity to 80%
  await page.evaluate(() => {
    const raw = localStorage.getItem("ja11-glass-eq-v1");
    const data = raw ? JSON.parse(raw) : {};
    data.settings = {
      ...(data.settings || {}),
      theme: "paper",
      dark: true,
      themeIntensity: 80,
      lookVersion: 2
    };
    localStorage.setItem("ja11-glass-eq-v1", JSON.stringify(data));
  });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: "C:\\Users\\korla\\.gemini\\antigravity\\brain\\f806ff80-9421-47f5-9979-c5fd672302ed\\paper_dark_80.png" });
  console.log("Saved paper_dark_80.png");

  // 5. Navigate to Settings Screen by clicking Settings in nav
  const settingsBtn = await page.$('button[title*="computer"]');
  if (settingsBtn) {
    await settingsBtn.click();
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: "C:\\Users\\korla\\.gemini\\antigravity\\brain\\f806ff80-9421-47f5-9979-c5fd672302ed\\settings_screen_fixed.png" });
    console.log("Saved settings_screen_fixed.png");
  }

  // 6. Navigate to Presets Screen by clicking Presets in nav
  const presetsBtn = await page.$('button[title*="Library"]');
  if (presetsBtn) {
    await presetsBtn.click();
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: "C:\\Users\\korla\\.gemini\\antigravity\\brain\\f806ff80-9421-47f5-9979-c5fd672302ed\\presets_screen_fixed.png" });
    console.log("Saved presets_screen_fixed.png");
  }

  await browser.close();
  console.log("All tasks completed!");
}

main().catch(console.error);

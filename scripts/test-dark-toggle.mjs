import puppeteer from "puppeteer-core";
import path from "node:path";

const outDir = "C:\\Users\\korla\\.gemini\\antigravity\\brain\\63454dd2-458f-4f2b-9c65-5d77a2d470d5";

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,820"]
  });

  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:1420/", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 600));

  // Go to settings
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll(".pill-link"));
    const settings = navButtons.find((b) => b.textContent.includes("Settings"));
    if (settings) settings.click();
  });
  await new Promise((r) => setTimeout(r, 600));

  // Click Dark mode button
  const toggled = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Dark mode"]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log("Dark button clicked:", toggled);
  await new Promise((r) => setTimeout(r, 800));

  await page.screenshot({ path: path.join(outDir, "verify_settings_dark_toggled.png") });
  console.log("Saved verify_settings_dark_toggled.png");

  // Go back to studio
  await page.evaluate(() => {
    const navButtons = Array.from(document.querySelectorAll(".pill-link"));
    const studio = navButtons.find((b) => b.textContent.includes("Studio"));
    if (studio) studio.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  await page.screenshot({ path: path.join(outDir, "verify_studio_dark_toggled.png") });
  console.log("Saved verify_studio_dark_toggled.png");

  // Open device modal in dark mode
  await page.evaluate(() => {
    const btn = document.querySelector(".pill-dac-main");
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(outDir, "verify_device_modal_dark_toggled.png") });
  console.log("Saved verify_device_modal_dark_toggled.png");

  await browser.close();
}

main().catch(console.error);

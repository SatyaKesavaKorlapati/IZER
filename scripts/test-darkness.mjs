import puppeteer from "puppeteer-core";

async function run() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"]
  });
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:1420/", { waitUntil: "domcontentloaded" });
  
  const res = await page.evaluate(() => {
    // Check if stylesheet is loaded
    const sheets = Array.from(document.styleSheets).map(s => {
      try { return s.href || "inline (" + s.cssRules.length + " rules)"; }
      catch (e) { return "cors"; }
    });
    
    document.documentElement.dataset.theme = "paper";
    document.documentElement.dataset.mode = "dark";
    document.documentElement.style.setProperty("--darkness", "0.5");
    
    const computed = getComputedStyle(document.documentElement);
    return {
      sheets,
      theme: document.documentElement.dataset.theme,
      mode: document.documentElement.dataset.mode,
      paper: computed.getPropertyValue("--paper"),
      bg0: computed.getPropertyValue("--bg0"),
      plotTop: computed.getPropertyValue("--plot-top")
    };
  });

  console.log("Debug result:", JSON.stringify(res, null, 2));
  await browser.close();
}

run().catch(console.error);

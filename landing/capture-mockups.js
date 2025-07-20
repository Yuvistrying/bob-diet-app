const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

async function captureMockups() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Set viewport to ensure consistent rendering
  await page.setViewportSize({ width: 1200, height: 900 });

  // Navigate to the mockup generator
  const htmlPath = `file://${path.resolve(__dirname, "mockup-generator.html")}`;
  await page.goto(htmlPath);

  // Wait for fonts to load
  await page.waitForTimeout(1000);

  // Capture each mockup
  for (let i = 1; i <= 5; i++) {
    const element = await page.$(`#mockup-${i}`);
    if (element) {
      await element.screenshot({
        path: path.join(__dirname, "..", "public", `Device-${i}.png`),
        omitBackground: false,
      });
      console.log(`Captured Device-${i}.png`);
    }
  }

  await browser.close();
  console.log("All mockups captured successfully!");
}

captureMockups().catch(console.error);

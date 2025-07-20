const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

async function captureIPhoneMockups() {
  const browser = await chromium.launch({
    headless: false, // Set to true for production
  });

  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();

  // Navigate to the app
  await page.goto("http://localhost:5174/chat");

  // Wait for app to load
  await page.waitForTimeout(3000);

  // Function to create iPhone frame around screenshot
  async function addIPhoneFrame(screenshotBuffer, outputPath) {
    // Create iPhone frame
    const frame = Buffer.from(`
      <svg width="414" height="896" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="screen">
            <rect x="20" y="20" width="374" height="812" rx="40" />
          </clipPath>
        </defs>
        <!-- Phone frame -->
        <rect width="414" height="896" rx="50" fill="#1a1a1a" />
        <rect x="7" y="7" width="400" height="882" rx="46" fill="#2a2a2a" />
        <rect x="14" y="14" width="386" height="868" rx="42" fill="#000" />
        <!-- Screen area -->
        <rect x="20" y="20" width="374" height="812" rx="40" fill="white" />
        <!-- Notch -->
        <path d="M 147 20 L 147 40 Q 147 50 157 50 L 257 50 Q 267 50 267 40 L 267 20 Z" fill="#000" />
      </svg>
    `);

    // Composite the screenshot onto the frame
    await sharp(screenshotBuffer)
      .resize(374, 812, { fit: "cover" })
      .composite([
        {
          input: frame,
          blend: "dest-over",
        },
      ])
      .toFile(outputPath);
  }

  // Capture screenshots for each feature
  const screenshots = [
    {
      name: "Device-1",
      description: "Chat interface with weekly summary",
      setup: async () => {
        // Already on chat page with weekly summary visible
      },
    },
    {
      name: "Device-2",
      description: "Food confirmation bubble",
      setup: async () => {
        // Type a food entry
        await page.fill(
          'textarea[placeholder*="Ask Bob"]',
          "chicken salad with quinoa for lunch",
        );
        await page.press('textarea[placeholder*="Ask Bob"]', "Enter");
        await page.waitForTimeout(3000);
      },
    },
    {
      name: "Device-3",
      description: "Food diary",
      setup: async () => {
        await page.click('a[href="/diary"]');
        await page.waitForTimeout(2000);
      },
    },
    {
      name: "Device-4",
      description: "Weight tracking",
      setup: async () => {
        await page.click('button:has-text("Weight")');
        await page.waitForTimeout(1000);
      },
    },
    {
      name: "Device-5",
      description: "Profile settings",
      setup: async () => {
        await page.click('a[href="/profile"]');
        await page.waitForTimeout(2000);
      },
    },
    {
      name: "Device-6",
      description: "Meal suggestions",
      setup: async () => {
        await page.click('a[href="/chat"]');
        await page.waitForTimeout(2000);
        await page.fill(
          'textarea[placeholder*="Ask Bob"]',
          "what should I eat for dinner?",
        );
        await page.press('textarea[placeholder*="Ask Bob"]', "Enter");
        await page.waitForTimeout(3000);
      },
    },
  ];

  // Capture each screenshot
  for (const screenshot of screenshots) {
    console.log(`Capturing ${screenshot.name}: ${screenshot.description}`);

    await screenshot.setup();

    const buffer = await page.screenshot();
    const outputPath = path.join(
      __dirname,
      "..",
      "public",
      `${screenshot.name}.png`,
    );

    // Add iPhone frame
    await addIPhoneFrame(buffer, outputPath);

    console.log(`Saved ${screenshot.name}.png`);
  }

  await browser.close();
  console.log("All mockups captured successfully!");
}

// Run the capture
captureIPhoneMockups().catch(console.error);

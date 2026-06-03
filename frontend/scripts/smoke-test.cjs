const { chromium } = require("playwright");

const appUrl = process.env.APP_URL || "http://127.0.0.1:4173";

async function waitForApp(page) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 5000 });
      if (response && response.ok()) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`App did not become reachable at ${appUrl}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await waitForApp(page);
  const health = await page.evaluate(async () => {
    const response = await fetch("/api/health");
    return response.ok ? response.json() : { status: "bad", code: response.status };
  });
  if (health.status !== "ok") throw new Error(`API health failed: ${JSON.stringify(health)}`);

  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("simulation online"), null, { timeout: 20000 });
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("3d relativistic star graph"), null, { timeout: 20000 });

  await page.getByLabel("experiments").click();
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("experiment bench ready"), null, { timeout: 30000 });
  await page.getByRole("button", { name: "Sensitivity" }).click();
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("sensitivity controls"), null, { timeout: 10000 });

  await page.getByLabel("archive").click();
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("persistent research archive"), null, { timeout: 10000 });
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("archived runs"), null, { timeout: 10000 });

  if (errors.length > 0) {
    throw new Error(`Browser smoke test saw console/page errors: ${errors.join(" | ")}`);
  }
  await browser.close();
  console.log("Smoke test passed");
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});

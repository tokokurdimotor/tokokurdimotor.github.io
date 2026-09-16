// Run with Playwright installed, or set PLAYWRIGHT_MODULE to its module path.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.SITE_URL || "http://127.0.0.1:4173";
const out = process.env.SCREENSHOT_DIR || "verification";

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: "msedge" });
  const errors = [];
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  // Test the site independently from Google Analytics and external map availability.
  await page.route(/googletagmanager|google-analytics|google\.com\/maps/, (r) =>
    r.fulfill({ status: 200, body: "" }),
  );
  const broken = [];
  page.on("response", (r) => {
    if (r.url().startsWith(base) && r.status() >= 400) broken.push(r.url());
  });
  for (const width of [375, 667, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 667 ? 375 : 900 });
    for (const file of [
      "index.html",
      "about.html",
      "contact.html",
      "gallery.html",
      "404.html",
    ]) {
      await page.goto(`${base}/${file}`);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(
        await page.locator("h1").count(),
        1,
        `${file}: exactly one main heading`,
      );
      for (const lang of ["id", "en"]) {
        if ((await page.locator("html").getAttribute("lang")) !== lang)
          await page.locator("#langToggle").click();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        assert.equal(
          overflow,
          false,
          `${file}: no horizontal overflow at ${width}px (${lang})`,
        );
        const missing = await page.evaluate(() =>
          [...document.querySelectorAll("[data-i18n]")]
            .map((el) => el.dataset.i18n)
            .filter((key) => !translations[document.documentElement.lang][key]),
        );
        assert.deepEqual(missing, [], `${file}: every translation present`);
      }
      await page.locator("#langToggle").click();
      if (width === 375 || width === 1440) {
        await page.evaluate(async () => {
          await Promise.all(
            [...document.images].map(async (img) => {
              img.loading = "eager";
              await img.decode();
            }),
          );
        });
        await page.screenshot({
          path: `${out}/${file.replace(".html", "")}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(base + "/index.html");
  await page.locator("#hamburger").click();
  assert.equal(
    await page.locator("#hamburger").getAttribute("aria-expanded"),
    "true",
  );
  await page.locator('#navLinks a[href="index.html#layanan"]').click();
  assert.equal(
    await page.locator("#hamburger").getAttribute("aria-expanded"),
    "false",
  );
  assert.equal(await page.evaluate(() => document.body.style.overflow), "");
  await page.locator("#hamburger").click();
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator("#hamburger").getAttribute("aria-expanded"),
    "false",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "hamburger",
  );
  await page.locator("#hamburger").click();
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.waitForFunction(() => document.body.style.overflow === "");
  await page.locator("summary").first().click();
  assert.equal(await page.locator("details").first().getAttribute("open"), "");
  for (const href of await page
    .locator('a[href*="wa.me"]')
    .evaluateAll((els) => els.map((el) => el.href))) {
    assert.equal(new URL(href).pathname, "/6285731044137");
  }
  await page.goto(base + "/contact.html");
  await page.locator("button[type=submit]").click();
  assert.equal(await page.locator("#formError").isVisible(), true);
  assert.equal(await page.evaluate(() => document.activeElement.id), "name");
  await page.locator("#name").fill("Pelanggan Uji");
  await page.locator("#phone").fill("081234567890");
  await page.locator("#message").fill("Cek oli untuk mobil saya");
  // Intercept the outgoing window: do not send any message or navigate to WhatsApp.
  await page.evaluate(() => {
    window.open = (url) => {
      window.testWhatsappUrl = url;
    };
  });
  await page.locator("button[type=submit]").click();
  const wa = new URL(await page.evaluate(() => window.testWhatsappUrl));
  assert.equal(wa.hostname, "wa.me");
  assert.ok(wa.searchParams.get("text").includes("Cek oli untuk mobil saya"));
  assert.equal(await page.locator("#formError").isVisible(), false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base + "/index.html");
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
    "auto",
  );
  const nojs = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  await nojs.goto(base + "/index.html");
  assert.equal(await nojs.locator("h1").isVisible(), true);
  assert.ok(
    (await nojs.locator("#waHero").getAttribute("href")).startsWith(
      "https://wa.me/",
    ),
  );
  await nojs.goto(base + "/gallery.html");
  assert.equal(await nojs.locator("#galleryGrid img").count(), 8);
  assert.deepEqual(errors, [], "No JavaScript errors");
  assert.deepEqual(broken, [], "No broken local assets");
  await browser.close();
  console.log(
    "PASS: 5 pages × 5 viewports × 2 languages; menu, FAQ, form validation, WhatsApp destination, reduced motion, no-JS content, assets, and console.",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { runTest } from "./auth";

runTest("Ace Studio end-to-end", async helper => {
  const { page } = helper;

  // --- Video: queue a short draft shot ---
  await helper.goto("/dashboard");
  await page.waitForSelector("text=Video", { timeout: 15000 });
  await page.fill(
    "#video-prompt",
    "A red pickup truck drives slowly past a freshly stuccoed house at golden hour, camera pans.",
  );
  await page.click("text=Format");
  await page.locator('[role="combobox"]').first().click();
  await page.click("text=Quick draft");
  await page.fill("#seed", "7");
  await page.click("text=Generate shot");
  await page.waitForSelector("text=Queued", { timeout: 10000 }).catch(() => {});
  await helper.screenshot("studio-video-queued.png");

  // --- Image ---
  await helper.goto("/image");
  await page.fill(
    "#image-prompt",
    "Wide photo of a freshly stuccoed craftsman home at dusk, warm porch light, no text.",
  );
  await page.click("text=Generate image");
  await page.waitForTimeout(1000);

  // --- Music: 10 s instrumental ---
  await helper.goto("/music");
  await page.fill(
    "#music-prompt",
    "warm cinematic acoustic guitar and soft piano, hopeful, commercial underscore",
  );
  await page.click("text=Generate track");
  await page.waitForTimeout(1000);

  // --- Wait for the video to finish (up to 4 min) ---
  await helper.goto("/dashboard");
  const video = page.locator("video").first();
  await video.waitFor({ state: "visible", timeout: 240000 });
  const src = await video.getAttribute("src");
  if (!src) throw new Error("Rendered video has no src");
  console.log(`   ✓ video src: ${src.slice(0, 80)}…`);
  await helper.screenshot("studio-video-done.png");

  // Budget bar should show usage
  const budget = await page.locator('[data-testid="budget-bar"]').innerText();
  console.log(`   ✓ budget: ${budget.replace(/\n/g, " | ")}`);

  // --- Image done? (up to 2 min) ---
  await helper.goto("/image");
  await page
    .locator('[data-testid="job-card"] img')
    .first()
    .waitFor({ state: "visible", timeout: 120000 });
  await helper.screenshot("studio-image-done.png");

  // --- Music done? (up to 4 min) ---
  await helper.goto("/music");
  await page
    .locator("audio")
    .first()
    .waitFor({ state: "attached", timeout: 240000 });
  await helper.screenshot("studio-music-done.png");

  // --- Library shows all three ---
  await helper.goto("/library");
  await page.waitForSelector('[data-testid="job-card"]', { timeout: 15000 });
  const n = await page.locator('[data-testid="job-card"]').count();
  console.log(`   ✓ library cards: ${n}`);
  if (n < 3) throw new Error(`Expected 3 finished items, got ${n}`);
  await helper.screenshot("studio-library.png");
}).catch(() => process.exit(1));

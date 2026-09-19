import { runTest } from "./auth";

runTest("HD decode + rating", async helper => {
  const { page } = helper;
  await helper.goto("/dashboard");
  await page.waitForSelector("#hd", { timeout: 15000 });
  // draft format defaults hd off via server, so force the switch on explicitly
  await page.locator('[role="combobox"]').first().click();
  await page.click("text=Quick draft");
  await page.fill("#video-prompt", "A golden retriever shakes off lake water on a wooden dock at sunset.");
  await page.fill("#seed", "3");
  await page.click("text=Generate shot");
  const card = page.locator('[data-testid="job-card"]').first();
  await card.locator("text=HD").waitFor({ timeout: 20000 });
  await card.locator("video").waitFor({ state: "visible", timeout: 240000 });
  await card.locator('button[aria-label="Good"]').click();
  await page.waitForTimeout(1500);
  const cls = await card.locator('button[aria-label="Good"]').getAttribute("class");
  console.log("RATED:", cls?.includes("bg-primary"));
  await helper.screenshot("hd-rating.png");
});

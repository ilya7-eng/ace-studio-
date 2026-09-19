import { runTest } from "./auth";

runTest("Prompt coach", async helper => {
  const { page } = helper;
  await helper.goto("/dashboard");
  await page.waitForSelector("text=Video", { timeout: 15000 });
  await page.waitForSelector("#coach", { timeout: 15000 });
  await page.fill(
    "#video-prompt",
    "Edward Scissorhands in the UFC fighting ring, trying to fight the heavyweight champion and winning",
  );
  await page.locator('[role="combobox"]').first().click();
  await page.click("text=Quick draft");
  await page.fill("#seed", "7");
  await page.click("text=Generate shot");
  const details = page.locator("text=coached prompt").first();
  await details.waitFor({ state: "visible", timeout: 90000 });
  await details.click();
  const card = page.locator('[data-testid="job-card"]').first();
  console.log("CARD:\n" + (await card.innerText()));
  await helper.screenshot("coach-card.png");
});

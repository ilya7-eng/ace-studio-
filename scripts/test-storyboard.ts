import { runTest } from "./auth";

runTest("Storyboard plan + render", async helper => {
  const { page } = helper;
  await helper.goto("/storyboard");
  await page.waitForSelector("#sb-idea", { timeout: 20000 });
  await page.fill(
    "#sb-idea",
    "Edward Scissorhands steps into a UFC cage to fight the heavyweight champion. He lands one clean strike and the champion goes down.",
  );
  // scenes slider default 3 -> set to 2 via keyboard
  const slider = page.locator('[role="slider"]').first();
  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  // format: draft to save GPU
  await page.locator('[role="combobox"]').first().click();
  await page.click("text=Quick draft");
  await page.click("text=Plan scenes");
  await page.waitForSelector('[data-testid="scene-card"]', { timeout: 120000 });
  const cards = page.locator('[data-testid="scene-card"]');
  console.log("SCENES:", await cards.count());
  console.log("CHARS:\n" + (await page.locator("section").first().innerText()));
  console.log("SCENE1:\n" + (await cards.first().innerText()));
  await helper.screenshot("storyboard-plan.png");
  await page.click("text=Render 2 scenes");
  await page.locator("video").first().waitFor({ state: "visible", timeout: 300000 });
  await page.waitForTimeout(3000);
  console.log("VIDEOS:", await page.locator("video").count());
  await helper.screenshot("storyboard-rendered.png");
});

import { expect, test, type Page } from '@playwright/test';

/** Credits text "1,234.50" -> integer units. */
const units = (s: string) => Math.round(Number(s.replace(/[^0-9.-]/g, '')) * 100);

const idle = (page: Page) => expect(page.getByTestId('app')).toHaveAttribute('data-busy', 'false', { timeout: 45_000 });
const awaitingSpin = async (page: Page) => {
  await expect(page.getByTestId('app')).toHaveAttribute('data-awaiting', 'SPIN', { timeout: 45_000 });
  await idle(page);
};
const actions = (page: Page) =>
  page.evaluate(() => (window as unknown as { __hollowHour: { exportSession(): { rounds: { actions: unknown[] }[] } } }).__hollowHour.exportSession().rounds.reduce((n, r) => n + r.actions.length, 0));

test.describe('The Hollow Hour', () => {
  test('loads with a visible 5x5 grid and no console errors (3D background on)', async ({ page }) => {
    const errors: string[] = [];
    const external: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('request', (r) => !r.url().startsWith('http://localhost:4173') && !r.url().startsWith('data:') && external.push(r.url()));
    await page.goto('/?seed=1');
    await expect(page.getByRole('heading', { name: 'The Hollow Hour' })).toBeVisible();
    const board = page.getByTestId('board');
    await expect(board).toBeVisible();
    await expect(page.locator('[data-testid^="cell-"]')).toHaveCount(25);
    await expect(page.getByTestId('spin-button')).toBeEnabled();
    await expect(page.getByTestId('dev-panel')).toHaveCount(0); // forced triggers absent in ordinary play
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
    expect(external).toEqual([]); // static build: no external fonts, scripts or assets
  });

  test('a demo spin completes and the balance reconciles', async ({ page }) => {
    await page.goto('/?seed=3&bg=0&speed=instant');
    const before = units(await page.getByTestId('balance').locator('.stat-value').innerText());
    const stake = units(await page.getByTestId('bet').innerText());
    await page.getByTestId('spin-button').click();
    await awaitingSpin(page);
    const last = units(await page.getByTestId('last-win').locator('.stat-value').innerText());
    const after = units(await page.getByTestId('balance').locator('.stat-value').innerText());
    expect(after).toBe(before - stake + last);
    for (let i = 0; i < 25; i++) await expect(page.getByTestId(`cell-${i}`)).not.toHaveAttribute('data-sym', '');
  });

  test('the player cannot submit overlapping spins', async ({ page }) => {
    await page.goto('/?seed=4&bg=0');
    await page.getByTestId('spin-button').click();
    // while the round animates, the spin control is replaced by Skip and Space only skips
    await expect(page.getByTestId('spin-button')).toHaveCount(0);
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await awaitingSpin(page);
    expect(await actions(page)).toBe(1);
  });

  test('cascades resolve and a win is shown (guaranteed Hourglass cluster, dev trigger)', async ({ page }) => {
    await page.goto('/?seed=5&bg=0&dev=1&speed=fast');
    await page.getByTestId('dev-force-ECHO').click();
    await expect(page.getByTestId('feed')).toContainText('Hourglass', { timeout: 20_000 });
    await awaitingSpin(page);
    expect(units(await page.getByTestId('round-win').locator('.stat-value').innerText())).toBeGreaterThan(0);
  });

  test('Paradox Split animation plays and finishes; debt meter updates', async ({ page }) => {
    await page.goto('/?seed=6&bg=0&dev=1');
    await expect(page.getByTestId('debt-meter')).toHaveAttribute('data-value', '0');
    await page.getByTestId('dev-force-SPLIT').click();
    await expect(page.getByTestId('paradox-split')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('paradox-split')).toContainText('Timeline B');
    await awaitingSpin(page);
    await expect(page.getByTestId('paradox-split')).toHaveCount(0);
    const debt = Number(await page.getByTestId('debt-meter').getAttribute('data-value'));
    expect(debt).toBeGreaterThan(0);
  });

  test('the Echo Ledger can be inspected', async ({ page }) => {
    await page.goto('/?seed=7&bg=0&dev=1&speed=instant');
    await page.getByTestId('dev-force-ECHO').click();
    await awaitingSpin(page);
    await expect(page.getByTestId('echo-count')).not.toHaveText('0');
    await page.getByTestId('echo-ledger-toggle').click();
    const panel = page.getByTestId('echo-ledger-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.echo-row').first()).toContainText(/won in a cluster|remnant of the last hour|turned Hollow/);
    await expect(panel).toContainText('Recently consumed / expired');
    await panel.getByRole('button', { name: 'Close Echo Ledger' }).click();
    await expect(panel).toHaveCount(0);
  });

  test("Clockmaker's Choice is revealed as part of the round (no player input changes the outcome)", async ({ page }) => {
    await page.goto('/?seed=8&bg=0&dev=1&speed=fast');
    await page.getByTestId('dev-force-CLOCKMAKER').click();
    const modal = page.getByTestId('clockmaker-reveal');
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(modal.locator('.choice-card.picked')).toHaveCount(1, { timeout: 15_000 });
    await expect(modal.getByTestId('choice-PRESERVE_PAST')).toBeDisabled();
    await awaitingSpin(page);
    await expect(modal).toHaveCount(0);
    await expect(page.getByTestId('feed')).toContainText("Clockmaker's Choice");
    const session = await page.evaluate(() => (window as unknown as { __hollowHour: { exportSession(): { rounds: { actions: unknown[] }[] } } }).__hollowHour.exportSession());
    expect(session.rounds).toHaveLength(1);
    expect(session.rounds[0].actions).toHaveLength(1); // only the spin
  });

  test('The Last Second can be entered (dev trigger) and played through four stages', async ({ page }) => {
    await page.goto('/?seed=9&bg=0&dev=1&speed=instant');
    await page.getByTestId('dev-force-BONUS').click();
    for (let stage = 1; stage <= 4; stage++) {
      const btn = page.getByTestId('bonus-stage-button');
      await expect(btn).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('hour-multiplier')).toContainText('×');
      await btn.click();
      // stage 4 settles the round, after which the bonus panel closes
      if (stage < 4) await expect(page.getByTestId('bonus-panel')).toHaveAttribute('data-stage', String(stage), { timeout: 20_000 });
    }
    await awaitingSpin(page);
    await expect(page.getByTestId('bonus-panel')).toHaveCount(0);
    await expect(page.getByTestId('last-win').locator('.stat-value')).not.toHaveText('—');
  });

  test('mute and reduced-motion settings work and the game stays playable', async ({ page }) => {
    await page.goto('/?seed=10&bg=0&speed=fast');
    await page.getByTestId('mute-toggle').click();
    await expect(page.getByTestId('app')).toHaveAttribute('data-muted', 'true');
    await page.getByTestId('settings-button').click();
    await page.getByTestId('reduced-motion-toggle').check();
    await expect(page.getByTestId('app')).toHaveAttribute('data-reduced-motion', 'true');
    await page.getByRole('button', { name: 'Close Settings' }).click();
    const anim = await page.locator('.spin-button').evaluate((el) => getComputedStyle(el).animationName);
    expect(anim === 'none' || anim === '').toBe(true);
    await page.getByTestId('spin-button').click();
    await awaitingSpin(page);
    // settings persist across reloads (and only settings are stored)
    await page.reload();
    await expect(page.getByTestId('app')).toHaveAttribute('data-reduced-motion', 'true');
    await expect(page.getByTestId('app')).toHaveAttribute('data-muted', 'true');
  });

  test('the whole grid and the spin control fit the viewport', async ({ page }) => {
    await page.goto('/?seed=11&bg=0&speed=instant');
    const vp = page.viewportSize()!;
    const box = (await page.getByTestId('board').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
    const cell = (await page.getByTestId('cell-0').boundingBox())!;
    expect(cell.width).toBeGreaterThanOrEqual(44); // symbols stay distinguishable / tappable
    await expect(page.getByTestId('spin-button')).toBeInViewport();
    await page.getByTestId('rules-button').click();
    await expect(page.getByTestId('rules-modal')).toContainText('Paradox Split');
    await expect(page.getByTestId('rules-rtp')).toContainText('96.00%');
    await expect(page.getByTestId('rules-modal')).toContainText('50,000× stake');
  });
});

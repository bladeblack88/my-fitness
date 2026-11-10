import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('navigation tabs open their screens', async ({ page }) => {
  for (const tab of ['home','workout','progress','profile']) {
    await page.locator('[data-tab="' + tab + '"]').click();
    await expect(page.locator('#tab-' + tab)).toBeVisible();
  }
});

test('exercise result, timer controls and workout completion work', async ({ page }) => {
  await page.locator('[data-tab="workout"]').click();
  await page.locator('#actual-push').fill('12');
  await page.locator('[data-ex="push"] .resultline').getByRole('button', { name: 'Сохранить результат' }).click();
  await expect(page.locator('.toast')).toContainText('Сохранено');
  let db = await page.evaluate(() => JSON.parse(localStorage.getItem('mf2_db')));
  expect(db.logs.some(x => x.type === 'set' && x.exercise === 'push' && x.value === 12)).toBeTruthy();
  const tools = page.locator('[data-ex="push"] details.exercise-tools');
  await tools.locator('summary').click();
  await tools.getByRole('button', { name: 'Старт' }).click();
  await tools.getByRole('button', { name: 'Пауза' }).click();
  await tools.getByRole('button', { name: 'Сброс' }).click();
  await tools.getByRole('button', { name: 'Начать отдых' }).click();
  await tools.getByRole('button', { name: 'Стоп' }).click();
  await page.locator('#sessionRpe').fill('8');
  await expect(page.locator('#sessionRpeValue')).toHaveText('8');
  await page.getByRole('button', { name: 'Сохранить тренировку' }).click();
  await expect(page.getByRole('status')).toContainText('Тренировка сохранена');
  db = await page.evaluate(() => JSON.parse(localStorage.getItem('mf2_db')));
  expect(db.logs.some(x => x.type === 'workout' && x.rpe === 8)).toBeTruthy();
  await page.locator('[data-tab="progress"]').click();
  await expect(page.locator('#totalSessions')).toHaveText('1');
});

test('profile numeric validation rejects invalid values and accepts valid values', async ({ page }) => {
  await page.locator('[data-tab="profile"]').click();
  await page.locator('#tab-profile details').first().locator('summary').click();
  await page.locator('#pAge').fill('12');
  await page.locator('#pHeight').fill('180');
  await page.locator('#pWeight').fill('80.5');
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(page.getByRole('status')).toContainText('Проверь возраст');
  let db = await page.evaluate(() => JSON.parse(localStorage.getItem('mf2_db')));
  expect(db.profiles[db.active].age).toBe('');
  await page.locator('#pAge').fill('30');
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(page.getByRole('status')).toContainText('Профиль сохранён');
  db = await page.evaluate(() => JSON.parse(localStorage.getItem('mf2_db')));
  expect(db.profiles[db.active]).toMatchObject({ age: 30, height: 180, weight: 80.5 });
});

test('reminder checkboxes and settings persist after reload', async ({ page }) => {
  await page.locator('[data-tab="profile"]').click();
  await page.getByRole('button', { name: 'Напоминания' }).click();
  await page.locator('#waterOn').uncheck();
  await page.locator('#trainingOn').check();
  await page.locator('#waterEvery').selectOption('90');
  await page.locator('#trainingTime').fill('19:30');
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(page.getByRole('status')).toContainText('Напоминания сохранены');
  await page.reload();
  await page.locator('[data-tab="profile"]').click();
  await page.getByRole('button', { name: 'Напоминания' }).click();
  await expect(page.locator('#waterOn')).not.toBeChecked();
  await expect(page.locator('#trainingOn')).toBeChecked();
  await expect(page.locator('#waterEvery')).toHaveValue('90');
  await expect(page.locator('#trainingTime')).toHaveValue('19:30');
});

test('check-in validates weight boundaries and saves decimal values', async ({ page }) => {
  await page.locator('#tab-home details summary').click();
  await page.locator('#quickWeight').fill('301');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Вес должен быть');
  await page.locator('#quickWeight').fill('78.4');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Запись сохранена');
  const db = await page.evaluate(() => JSON.parse(localStorage.getItem('mf2_db')));
  expect(db.profiles[db.active].weight).toBe(78.4);
});

test('malformed backup is rejected without overwriting local data', async ({ page }) => {
  const before = await page.evaluate(() => localStorage.getItem('mf2_db'));
  await page.locator('[data-tab="profile"]').click();
  await page.locator('#tab-profile details').last().locator('summary').click();
  await page.locator('#backupFile').setInputFiles({
    name: 'broken-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ app: 'MY FITNESS', data: { profiles: [], logs: [] } }))
  });
  await expect(page.getByRole('status')).toContainText('Не удалось прочитать резервную копию');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('mf2_db'))).toBe(before);
});


test('home screen loads without uncaught errors or broken images', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.reload();
  await expect(page.locator('#tab-home')).toBeVisible();
  const brokenImages = await page.locator('img').evaluateAll(nodes => nodes.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.currentSrc || img.src));
  expect(errors, 'uncaught browser errors').toEqual([]);
  expect(brokenImages, 'broken images').toEqual([]);
});

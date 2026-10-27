import { expect, test } from '@playwright/test';

test('三个姿势和独立草稿刷新恢复、命名删除可撤销', async ({ page }, testInfo) => {
  await page.goto('/');
  const x = page.getByRole('spinbutton', { name: '位置 X' });
  await page.getByRole('tab', { name: '姿势库' }).click();
  for (const [name, value] of [
    ['站立', '512'],
    ['抬手草稿', '600'],
    ['弓步草稿', '700'],
  ]) {
    await x.fill(value);
    await x.press('Enter');
    await page.getByRole('textbox', { name: '姿势名称', exact: true }).fill(name);
    await page.getByRole('button', { name: '保存当前姿势' }).click();
  }
  await x.fill('750');
  await x.press('Enter');
  await expect(page.getByText(/已自动保存到本机/)).toBeVisible();
  await page.reload();
  await expect(x).toHaveValue('750');
  await page.getByRole('tab', { name: '姿势库' }).click();
  await expect(page.locator('.pose-card')).toHaveCount(3);
  await page
    .getByRole('article', { name: '姿势：站立', exact: true })
    .getByRole('button', { name: '加载' })
    .click();
  await expect(x).toHaveValue('512');
  await x.fill('800');
  await x.press('Enter');
  await page
    .getByRole('article', { name: '姿势：站立', exact: true })
    .getByRole('button', { name: '加载' })
    .click();
  await expect(x).toHaveValue('512');
  const name = page.getByRole('textbox', { name: '重命名 站立', exact: true });
  await name.fill('准备');
  await name.press('Enter');
  await page
    .getByRole('article', { name: '姿势：准备', exact: true })
    .getByRole('button', { name: '删除' })
    .click();
  await expect(page.locator('.pose-card')).toHaveCount(2);
  await page.getByRole('button', { name: '↶ 撤销' }).click();
  await expect(page.locator('.pose-card')).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath('pose-library.png'), fullPage: true });
});

test('工程备份在干净环境往返、姿势 JSON 往返、坏文件不覆盖', async ({ page, browser }) => {
  await page.goto('/');
  const x = page.getByRole('spinbutton', { name: '位置 X' });
  await x.fill('630');
  await x.press('Enter');
  await page.getByRole('tab', { name: '姿势库' }).click();
  await page.getByRole('button', { name: '保存当前姿势' }).click();
  const poseDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出当前姿势' }).click();
  const posePath = (await (await poseDownload).path())!;
  await page.getByLabel('选择姿势文件').setInputFiles(posePath);
  await expect(page.locator('.pose-card')).toHaveCount(2);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存备份' }).click();
  const path = (await (await pending).path())!;
  const context = await browser.newContext();
  const clean = await context.newPage();
  await clean.goto('/');
  await clean.getByLabel('选择工程文件').setInputFiles(path);
  await expect(clean.getByRole('spinbutton', { name: '位置 X' })).toHaveValue('630');
  await clean.getByRole('tab', { name: '姿势库' }).click();
  await expect(clean.locator('.pose-card')).toHaveCount(2);
  await clean.getByLabel('选择工程文件').setInputFiles({
    name: 'broken.motionforge',
    mimeType: 'application/zip',
    buffer: Buffer.from('invalid'),
  });
  await expect(clean.getByText(/打开失败/)).toBeVisible();
  await expect(clean.getByRole('spinbutton', { name: '位置 X' })).toHaveValue('630');
  await clean.getByRole('spinbutton', { name: '位置 X' }).fill('660');
  await clean.getByRole('spinbutton', { name: '位置 X' }).press('Enter');
  await expect(clean.getByText(/已自动保存到本机/)).toBeVisible();
  await clean.reload();
  await expect(clean.getByRole('spinbutton', { name: '位置 X' })).toHaveValue('660');
  await context.close();
});

test('存储失败仍可下载工程备份', async ({ page }) => {
  await page.addInitScript(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException('storage full', 'QuotaExceededError');
    };
  });
  await page.goto('/');
  await expect(page.getByText(/本地保存失败/)).toBeVisible();
  const x = page.getByRole('spinbutton', { name: '位置 X' });
  await x.fill('650');
  await x.press('Enter');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存备份' }).click();
  expect((await pending).suggestedFilename()).toMatch(/\.motionforge$/);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '新建工程' }).click();
  await expect(x).toHaveValue('650');
});

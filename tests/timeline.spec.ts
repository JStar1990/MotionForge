import { expect, test } from '@playwright/test';

async function sequence(page: import('@playwright/test').Page) {
  await page.goto('/?editor=2d');
  await page.getByRole('button', { name: '新建动作', exact: true }).click();
  for (const [name, duration, x] of [
    ['A', '3', '500'],
    ['B', '2', '600'],
    ['C', '4', '700'],
  ]) {
    await page.getByRole('button', { name: '添加当前姿势', exact: true }).click();
    await page.getByRole('button', { name: '选择关键姿势' }).last().click();
    const field = page.getByRole('textbox', { name: '关键姿势名称', exact: true });
    await field.fill(name);
    await field.press('Enter');
    const frames = page.getByRole('spinbutton', { name: '持续帧数', exact: true });
    await frames.fill(duration);
    await frames.press('Enter');
    const position = page.getByRole('spinbutton', { name: '位置 X', exact: true });
    await position.fill(x);
    await position.press('Enter');
  }
}

test('3/2/4 时间轴逐帧、整段编辑、草稿隔离及刷新恢复', async ({ page }, testInfo) => {
  await sequence(page);
  await expect(page.getByText('3 个关键姿势 / 9 个播放帧')).toBeVisible();
  await expect(page.getByLabel('动作时长')).toHaveText('0.75 秒');
  await page.getByRole('button', { name: '选择关键姿势 A', exact: true }).click();
  const x = page.getByRole('spinbutton', { name: '位置 X' });
  for (const [index, value] of [
    '500',
    '500',
    '500',
    '600',
    '600',
    '700',
    '700',
    '700',
    '700',
  ].entries()) {
    await expect(x).toHaveValue(value);
    await expect(page.getByLabel('当前播放帧')).toHaveText(`第 ${index + 1} / 9 帧`);
    if (index < 8) await page.getByRole('button', { name: '下一帧', exact: true }).click();
  }
  await page.getByRole('button', { name: '选择关键姿势 B', exact: true }).click();
  await page.getByRole('button', { name: '下一帧', exact: true }).click();
  await x.fill('650');
  await x.press('Enter');
  await page.getByRole('button', { name: '上一帧', exact: true }).click();
  await expect(x).toHaveValue('650');
  await page.getByRole('button', { name: '另存为姿势', exact: true }).click();
  await page.getByLabel('帧率', { exact: true }).fill('24');
  await expect(page.getByLabel('动作时长')).toHaveText('0.375 秒');
  await page.getByLabel('洋葱皮', { exact: true }).check();
  await page.screenshot({ path: testInfo.outputPath('timeline.png'), fullPage: true });
  await page.getByLabel('编辑目标').selectOption('');
  await expect(x).toHaveValue('512');
  await expect(page.getByText(/已自动保存到本机/)).toBeVisible();
  await page.reload();
  await page.getByLabel('编辑目标').selectOption({ label: '动作 1' });
  await expect(page.getByText('3 个关键姿势 / 9 个播放帧')).toBeVisible();
  await page.getByRole('button', { name: '选择关键姿势 B', exact: true }).click();
  await expect(x).toHaveValue('650');
});

test('播放锁定、末帧停止、重新播放和删除后范围修正', async ({ page }) => {
  await sequence(page);
  await page.getByLabel('循环播放').uncheck();
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: '位置 X' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '播放', exact: true })).toBeVisible();
  await expect(page.getByLabel('当前播放帧')).toHaveText('第 9 / 9 帧');
  await page.getByLabel('帧率', { exact: true }).fill('1');
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await expect(page.getByLabel('当前播放帧')).toHaveText('第 1 / 9 帧');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.getByRole('button', { name: '选择关键姿势 C', exact: true }).click();
  await page.getByRole('button', { name: '下一帧', exact: true }).click();
  await page.getByRole('button', { name: '删除关键姿势', exact: true }).click();
  await expect(page.getByLabel('当前播放帧')).toHaveText('第 5 / 5 帧');
  await page.getByRole('button', { name: '删除关键姿势', exact: true }).click();
  await page.getByRole('button', { name: '删除关键姿势', exact: true }).click();
  await expect(page.getByRole('button', { name: '播放', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '↶ 撤销' }).click();
  await expect(page.getByText('1 个关键姿势 / 3 个播放帧')).toBeVisible();
});

test('拖动排序、右边缘调时长、姿势资产插入保持隔离', async ({ page }) => {
  await sequence(page);
  await page
    .getByRole('button', { name: '选择关键姿势 A', exact: true })
    .dragTo(page.getByRole('button', { name: '选择关键姿势 C', exact: true }));
  await expect(page.locator('.key-block').first()).toContainText('B');
  const edge = page.getByRole('separator', { name: '调整 B 时长', exact: true });
  const box = (await edge.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 64, box.y + 20, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByText('3 个关键姿势 / 11 个播放帧')).toBeVisible();
  await page.getByRole('button', { name: '↶ 撤销' }).click();
  await expect(page.getByText('3 个关键姿势 / 9 个播放帧')).toBeVisible();
  await page.getByRole('button', { name: '选择关键姿势 B', exact: true }).click();
  await page.getByRole('button', { name: '另存为姿势', exact: true }).click();
  await page.getByRole('tab', { name: '姿势库' }).click();
  await page.getByRole('button', { name: '加入动作', exact: true }).click();
  await expect(page.getByText('4 个关键姿势 / 11 个播放帧')).toBeVisible();
  const x = page.getByRole('spinbutton', { name: '位置 X' });
  await x.fill('800');
  await x.press('Enter');
  await page.getByLabel('编辑目标').selectOption('');
  await page.getByRole('button', { name: '加载', exact: true }).click();
  await expect(x).toHaveValue('600');
});

test('循环播放、切换帧率与页面隐藏暂停', async ({ page }) => {
  await sequence(page);
  await page.getByLabel('帧率', { exact: true }).fill('60');
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await page.waitForTimeout(400);
  await expect(page.getByRole('button', { name: '暂停', exact: true })).toBeVisible();
  await page.getByLabel('帧率', { exact: true }).fill('12');
  await expect(page.getByRole('button', { name: '播放', exact: true })).toBeVisible();
  await expect(page.getByText('3 个关键姿势 / 9 个播放帧')).toBeVisible();
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('button', { name: '播放', exact: true })).toBeVisible();
  const frame = await page.getByLabel('当前播放帧').textContent();
  await page.waitForTimeout(150);
  await expect(page.getByLabel('当前播放帧')).toHaveText(frame!);
});

test('序列备份恢复、复制和删除动作可撤销', async ({ page, browser }) => {
  await sequence(page);
  await page.getByRole('button', { name: '复制关键姿势', exact: true }).click();
  await expect(page.getByText('4 个关键姿势 / 13 个播放帧')).toBeVisible();
  await page.getByRole('button', { name: '↶ 撤销' }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存备份', exact: true }).click();
  const path = (await (await pending).path())!;
  const context = await browser.newContext();
  const restored = await context.newPage();
  await restored.goto('/?editor=2d');
  await restored.getByLabel('选择工程文件').setInputFiles(path);
  await restored.getByLabel('编辑目标').selectOption({ label: '动作 1' });
  await expect(restored.getByText('3 个关键姿势 / 9 个播放帧')).toBeVisible();
  await restored.getByRole('button', { name: '选择关键姿势 C', exact: true }).click();
  await expect(restored.getByRole('spinbutton', { name: '位置 X' })).toHaveValue('700');
  await restored.getByRole('button', { name: '删除动作', exact: true }).click();
  await expect(restored.getByLabel('编辑目标')).toHaveValue('');
  await restored.getByRole('button', { name: '↶ 撤销' }).click();
  await restored.getByLabel('编辑目标').selectOption({ label: '动作 1' });
  await expect(restored.getByText('3 个关键姿势 / 9 个播放帧')).toBeVisible();
  await context.close();
});

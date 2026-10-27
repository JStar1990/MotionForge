import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { createDefaultProject } from '../src/core/project/defaultProject';

async function loadSequence(page: import('@playwright/test').Page, durations = [3, 2, 4]) {
  const project = createDefaultProject();
  project.clips.push({
    id: 'clip',
    name: '测试动作',
    keys: durations.map((durationFrames, i) => ({
      id: String(i),
      name: ['A', 'B', 'C'][i] ?? 'D',
      durationFrames,
      pose: { ...structuredClone(project.draft), rootPosition: { x: 500 + i * 50, y: 500 } },
    })),
  });
  const zip = await new JSZip()
    .file('project.json', JSON.stringify(project))
    .generateAsync({ type: 'nodebuffer' });
  await page.goto('/');
  await page
    .getByLabel('选择工程文件')
    .setInputFiles({ name: 'test.motionforge', mimeType: 'application/zip', buffer: zip });
  await expect(page.getByText('工程已打开，可继续编辑')).toBeVisible();
  await page.getByRole('button', { name: '导出图片 ↗' }).click();
  await expect(page.getByAltText('最终图片预览')).toBeVisible();
}

async function getDownload(page: import('@playwright/test').Page, button: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: button, exact: true }).click();
  return readFile((await (await pending).path())!);
}

test('当前 PNG 透明/纯色、无编辑辅助、预览和导出尺寸一致', async ({ page }, testInfo) => {
  await loadSequence(page);
  const png = await getDownload(page, '下载 PNG');
  expect(png.readUInt32BE(16)).toBe(1024);
  expect(png.readUInt32BE(20)).toBe(1024);
  const pixel = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    return {
      corner: [...ctx.getImageData(0, 0, 1, 1).data],
      center: [...ctx.getImageData(512, 400, 1, 1).data],
    };
  }, png.toString('base64'));
  expect(pixel.corner[3]).toBe(0);
  expect(pixel.center[3]).toBe(255);
  await page.getByLabel('导出背景', { exact: true }).selectOption('solid');
  const solid = await getDownload(page, '下载 PNG');
  const corner = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  }, solid.toString('base64'));
  expect(corner).toEqual([255, 255, 255, 255]);
  await page.screenshot({ path: testInfo.outputPath('export-preview.png'), fullPage: true });
  await page.getByLabel('导出假人', { exact: true }).uncheck();
  await expect(page.getByRole('button', { name: '下载 PNG', exact: true })).toBeDisabled();
});

test('关键姿势与实际帧图包的编号、清单与重复帧一致', async ({ page }) => {
  await loadSequence(page);
  await page.getByLabel('导出内容', { exact: true }).selectOption('keys');
  const keys = await JSZip.loadAsync(await getDownload(page, '下载图包'));
  expect(Object.keys(keys.files)).toEqual([
    'key_0001.png',
    'key_0002.png',
    'key_0003.png',
    'manifest.json',
  ]);
  const manifest = JSON.parse(await keys.file('manifest.json')!.async('string'));
  expect(manifest.fps).toBe(12);
  expect(manifest.totalFrames).toBe(9);
  expect(manifest.images.map((entry: { durationFrames: number }) => entry.durationFrames)).toEqual([
    3, 2, 4,
  ]);
  await page.getByLabel('导出内容', { exact: true }).selectOption('frames');
  const frames = await JSZip.loadAsync(await getDownload(page, '下载图包'));
  expect(Object.keys(frames.files)).toHaveLength(10);
  expect(await frames.file('frame_0001.png')!.async('base64')).toBe(
    await frames.file('frame_0003.png')!.async('base64'),
  );
  expect(await frames.file('frame_0001.png')!.async('base64')).not.toBe(
    await frames.file('frame_0004.png')!.async('base64'),
  );
});

test('视口不影响 PNG、取消及预算拒绝保留工程', async ({ page }) => {
  await loadSequence(page, [20, 20, 20]);
  const first = await getDownload(page, '下载 PNG');
  await page.getByRole('button', { name: '关闭导出' }).click();
  await page.getByTestId('pose-canvas').hover();
  await page.mouse.wheel(0, -400);
  await page.getByRole('button', { name: '导出图片 ↗' }).click();
  expect(await getDownload(page, '下载 PNG')).toEqual(first);
  await page.getByLabel('导出内容', { exact: true }).selectOption('frames');
  await page.getByRole('button', { name: '下载图包', exact: true }).click();
  await page.getByRole('button', { name: '取消导出', exact: true }).click();
  await expect(page.getByText('已取消导出，工程未改变。')).toBeVisible();
  await page.getByRole('button', { name: '关闭导出' }).click();
  await page.getByLabel('编辑目标').selectOption({ label: '测试动作' });
  await expect(page.getByText('3 个关键姿势 / 60 个播放帧')).toBeVisible();
  await page.getByRole('spinbutton', { name: '持续帧数', exact: true }).fill('100');
  await page.getByRole('spinbutton', { name: '持续帧数', exact: true }).press('Enter');
  await page.getByRole('button', { name: '导出图片 ↗' }).click();
  await page.getByLabel('导出内容', { exact: true }).selectOption('frames');
  await expect(page.getByRole('alert')).toContainText('预算');
  await expect(page.getByRole('button', { name: '下载图包', exact: true })).toBeDisabled();
});

import { expect, test } from '@playwright/test';
import { createDefaultProject } from '../src/core/project/defaultProject';
import { forwardKinematics } from '../src/core/rig/fk';
import { dragBoneEndpoint } from '../src/core/rig/dragPose';

test('编辑草稿、撤销重做和空状态', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '根节点' })).toBeVisible();
  await expect(page.getByTestId('pose-canvas').locator('canvas')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('editor.png'), fullPage: true });
  const x = page.getByRole('spinbutton', { name: '位置 X' });
  await x.fill('640');
  await x.press('Enter');
  await expect(x).toHaveValue('640');
  await page.getByRole('button', { name: '↶ 撤销' }).click();
  await expect(x).toHaveValue('512');
  await page.getByRole('button', { name: '↷ 重做' }).click();
  await expect(x).toHaveValue('640');
  await page.getByRole('button', { name: /左上臂/ }).click();
  const rotation = page.getByRole('spinbutton', { name: '局部旋转' });
  await rotation.fill('45');
  await rotation.press('Enter');
  await expect(rotation).toHaveValue('45');
  await page.getByRole('button', { name: '重置姿势' }).click();
  await expect(rotation).toHaveValue('0');
  await page.getByRole('button', { name: '↶ 撤销' }).click();
  await expect(rotation).toHaveValue('45');
  await page.getByRole('tab', { name: '姿势库' }).click();
  await expect(page.getByText('还没有姿势资产')).toBeVisible();
  await expect(page.getByRole('button', { name: '播放', exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('整次根节点拖动仅提交一次，撤销恢复起点', async ({ page }) => {
  await page.goto('/');
  const host = page.getByTestId('pose-canvas');
  await expect(host.locator('canvas')).toBeVisible();
  const box = (await host.boundingBox())!;
  const scale = Math.min((box.width - 80) / 1024, (box.height - 80) / 1024);
  const root = {
    x: box.x + box.width / 2,
    y: box.y + (box.height - 1024 * scale) / 2 + 500 * scale,
  };
  await page.mouse.move(root.x, root.y);
  await page.mouse.down();
  await page.mouse.move(root.x + 45, root.y + 20, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByText(/修订 1/)).toBeVisible();
  await page.getByRole('button', { name: '↶ 撤销' }).click();
  await expect(page.getByRole('spinbutton', { name: '位置 X' })).toHaveValue('512');
  await expect(page.getByRole('spinbutton', { name: '位置 Y' })).toHaveValue('500');
  await expect(page.getByRole('button', { name: '↶ 撤销' })).toBeDisabled();
});

test('拖动按 Esc 取消，不污染工程历史', async ({ page }) => {
  await page.goto('/');
  const host = page.getByTestId('pose-canvas');
  await expect(host.locator('canvas')).toBeVisible();
  const box = (await host.boundingBox())!;
  const scale = Math.min((box.width - 80) / 1024, (box.height - 80) / 1024);
  const root = {
    x: box.x + box.width / 2,
    y: box.y + (box.height - 1024 * scale) / 2 + 500 * scale,
  };
  await page.mouse.move(root.x, root.y);
  await page.mouse.down();
  await page.mouse.move(root.x + 40, root.y + 25, { steps: 8 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.getByText(/修订 0/)).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: '位置 X' })).toHaveValue('512');
  await expect(page.getByRole('button', { name: '↶ 撤销' })).toBeDisabled();
});

for (const boneId of ['leftForearm', 'rightForearm', 'leftShin', 'rightShin', 'head']) {
  test(`直接拖动 ${boneId}，缩放后可操作且整次撤销`, async ({ page }) => {
    await page.goto('/');
    const host = page.getByTestId('pose-canvas');
    await expect(host.locator('canvas')).toBeVisible();
    const box = (await host.boundingBox())!;
    const project = createDefaultProject();
    const endpoint = forwardKinematics(project.rig, project.draft)[boneId].end;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -100);
    const scale = Math.min((box.width - 80) / 1024, (box.height - 80) / 1024) * 1.1;
    await expect(page.getByText(`${Math.round(scale * 100)}%`, { exact: true })).toBeVisible();
    const start = {
      x: box.x + box.width / 2 + (endpoint.x - 512) * scale,
      y: box.y + box.height / 2 + (endpoint.y - 512) * scale,
    };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 30, start.y - 30, { steps: 12 });
    await page.mouse.up();
    await expect(page.getByText(/修订 1/)).toBeVisible();
    const angle = page.getByRole('spinbutton', { name: '局部旋转' });
    await expect(angle).not.toHaveValue('0');
    await page.getByRole('button', { name: '↶ 撤销' }).click();
    await expect(angle).toHaveValue('0');
    await expect(page.getByRole('button', { name: '↶ 撤销' })).toBeDisabled();
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 30, start.y + 20, { steps: 8 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(angle).toHaveValue('0');
    await expect(page.getByRole('button', { name: '↶ 撤销' })).toBeDisabled();
  });
}

test('模式切换、方向翻转和角度限制', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /左前臂/ }).click();
  const angle = page.getByRole('spinbutton', { name: '局部旋转' });
  await page.getByRole('button', { name: 'FK', exact: true }).click();
  await expect(angle).toHaveValue('0');
  await expect(page.getByRole('button', { name: '翻转弯曲方向' })).toBeDisabled();
  await page.getByRole('button', { name: 'IK', exact: true }).click();
  await expect(angle).toHaveValue('0');
  await page.getByRole('button', { name: '翻转弯曲方向' }).click();
  await expect(angle).toHaveValue('-30');
  await expect(page.getByLabel('目标偏差')).toHaveText('0.00 px');
  await page.getByRole('button', { name: '↶ 撤销' }).click();
  await expect(angle).toHaveValue('0');
  await page.getByRole('checkbox', { name: '启用关节限制' }).check();
  await page.getByRole('spinbutton', { name: '最小角度' }).fill('20');
  await page.getByRole('spinbutton', { name: '最小角度' }).press('Enter');
  await expect(angle).toHaveValue('20');
  await page.getByRole('button', { name: '重置姿势' }).click();
  await expect(angle).toHaveValue('20');
});

test('平移视口不修改工程，平移后仍可拖动骨骼点', async ({ page }) => {
  await page.goto('/');
  const host = page.getByTestId('pose-canvas');
  await expect(host.locator('canvas')).toBeVisible();
  const box = (await host.boundingBox())!;
  await page.mouse.move(box.x + 25, box.y + 90);
  await page.keyboard.down('Space');
  await page.mouse.down();
  await page.mouse.move(box.x + 95, box.y + 120, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  await expect(page.getByText(/修订 0/)).toBeVisible();
  const project = createDefaultProject();
  const endpoint = forwardKinematics(project.rig, project.draft).head.end;
  const scale = Math.min((box.width - 80) / 1024, (box.height - 80) / 1024);
  const x = box.x + box.width / 2 + (endpoint.x - 512) * scale + 70;
  const y = box.y + box.height / 2 + (endpoint.y - 512) * scale + 30;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 20, y, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText(/修订 1/)).toBeVisible();
  await expect(page.getByRole('heading', { name: '头部' })).toBeVisible();
});

test('拖动方向柄翻转肘部，并可一次撤销', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /左前臂/ }).click();
  const box = (await page.getByTestId('pose-canvas').boundingBox())!;
  const project = createDefaultProject();
  const world = forwardKinematics(project.rig, project.draft);
  const start = world.leftUpperArm.start;
  const end = world.leftForearm.end;
  const direction = Math.atan2(end.y - start.y, end.x - start.x);
  const scale = Math.min((box.width - 80) / 1024, (box.height - 80) / 1024);
  const mid = {
    x: box.x + box.width / 2 + ((start.x + end.x) / 2 - 512) * scale,
    y: box.y + box.height / 2 + ((start.y + end.y) / 2 - 512) * scale,
  };
  const x = mid.x + Math.sin(direction) * 65;
  const y = mid.y - Math.cos(direction) * 65;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(2 * mid.x - x, 2 * mid.y - y, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByRole('spinbutton', { name: '局部旋转' })).toHaveValue('-30');
  await expect(page.getByText(/修订 1/)).toBeVisible();
  await page.getByRole('button', { name: '↶ 撤销' }).click();
  await expect(page.getByRole('spinbutton', { name: '局部旋转' })).toHaveValue('0');
});

test('站立、抬手与弓步的画布操作验收', async ({ page }, testInfo) => {
  await page.goto('/');
  const host = page.getByTestId('pose-canvas');
  await expect(host.locator('canvas')).toBeVisible();
  const box = (await host.boundingBox())!;
  const scale = Math.min((box.width - 80) / 1024, (box.height - 80) / 1024);
  const screen = (point: { x: number; y: number }) => ({
    x: box.x + box.width / 2 + (point.x - 512) * scale,
    y: box.y + box.height / 2 + (point.y - 512) * scale,
  });
  const project = createDefaultProject();
  const drag = async (boneId: string, target: { x: number; y: number }) => {
    const from = screen(forwardKinematics(project.rig, project.draft)[boneId].end);
    const to = screen(target);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
    const expected =
      (dragBoneEndpoint(project.rig, project.draft, boneId, target).pose.localRotations[boneId] *
        180) /
      Math.PI;
    const actual = Number(await page.getByRole('spinbutton', { name: '局部旋转' }).inputValue());
    expect(Math.abs(actual - expected)).toBeLessThan(1.5);
  };
  await page.screenshot({ path: testInfo.outputPath('standing.png') });
  await drag('leftForearm', { x: 710, y: 210 });
  await expect(page.getByRole('spinbutton', { name: '局部旋转' })).not.toHaveValue('0');
  await page.screenshot({ path: testInfo.outputPath('raised-arm.png') });
  await page.getByRole('button', { name: '重置姿势' }).click();
  // Select the root so the editable position fields are available.
  const root = screen(project.draft.rootPosition);
  await page.mouse.click(root.x, root.y);
  await page.getByRole('spinbutton', { name: '位置 Y' }).fill('600');
  await page.getByRole('spinbutton', { name: '位置 Y' }).press('Enter');
  project.draft.rootPosition.y = 600;
  await drag('leftShin', { x: 760, y: 800 });
  await drag('rightShin', { x: 460, y: 800 });
  await expect(page.getByRole('spinbutton', { name: '局部旋转' })).not.toHaveValue('0');
  await expect(page.getByLabel('目标偏差')).toHaveText('0.00 px');
  await page.screenshot({ path: testInfo.outputPath('lunge.png') });
});

test('侧身预设、连续转身、重置和重叠关节编辑', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: '朝右侧身', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: '转身角度' })).toHaveValue('90');
  await page.screenshot({ path: testInfo.outputPath('profile-right.png') });
  await page.getByRole('button', { name: '朝左侧身', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: '转身角度' })).toHaveValue('-90');
  await page.screenshot({ path: testInfo.outputPath('profile-left.png') });
  await page.getByRole('button', { name: '↶ 撤销' }).click();
  await expect(page.getByRole('spinbutton', { name: '转身角度' })).toHaveValue('90');
  await page.getByRole('spinbutton', { name: '转身角度' }).fill('45');
  await page.getByRole('spinbutton', { name: '转身角度' }).press('Enter');
  await page.screenshot({ path: testInfo.outputPath('profile-three-quarter.png') });
  await page.getByRole('button', { name: '朝右侧身', exact: true }).click();
  await page.getByRole('button', { name: /右前臂/ }).click();
  const project = createDefaultProject();
  project.draft.bodyTurn = 90;
  const point = forwardKinematics(project.rig, project.draft).rightForearm.end;
  const box = (await page.getByTestId('pose-canvas').boundingBox())!;
  const scale = Math.min((box.width - 80) / 1024, (box.height - 80) / 1024);
  const x = box.x + box.width / 2 + (point.x - 512) * scale;
  const y = box.y + box.height / 2 + (point.y - 512) * scale;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y - 50, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole('heading', { name: '右前臂' })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: '局部旋转' })).not.toHaveValue('0');
  await page.getByRole('button', { name: '重置姿势' }).click();
  await expect(page.getByRole('spinbutton', { name: '转身角度' })).toHaveValue('90');
  await expect(page.getByRole('spinbutton', { name: '局部旋转' })).toHaveValue('0');
  await page.getByRole('button', { name: '正面', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: '转身角度' })).toHaveValue('0');
});

test('假人肩部连接与腿根层级，以及独立显示开关', async ({ page }, testInfo) => {
  await page.goto('/');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('button', { name: '骨架线', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('front-sockets.png') });
  await page.getByRole('button', { name: '朝左侧身', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('left-sockets.png') });
  await page.getByRole('button', { name: '朝右侧身', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('right-sockets.png') });
  await page.getByRole('button', { name: /右前臂/ }).click();
  await page.getByRole('spinbutton', { name: '局部旋转' }).fill('-30');
  await page.getByRole('spinbutton', { name: '局部旋转' }).press('Enter');
  await page.screenshot({ path: testInfo.outputPath('profile-arm-overlap.png') });
  await page.getByRole('button', { name: '↶ 撤销' }).click();
  await page.getByRole('button', { name: '正面', exact: true }).click();
  await page.getByRole('button', { name: '骨架线', exact: true }).click();
  await page.getByRole('button', { name: /右肩/ }).click();
  const rotation = page.getByRole('spinbutton', { name: '局部旋转' });
  await rotation.fill('60');
  await rotation.press('Enter');
  await page.getByRole('button', { name: /左大腿/ }).click();
  await rotation.fill('-45');
  await rotation.press('Enter');
  await page.getByRole('button', { name: /右大腿/ }).click();
  await rotation.fill('45');
  await rotation.press('Enter');
  await page.getByRole('button', { name: '骨架线', exact: true }).click();
  await expect(page.getByRole('button', { name: '骨架线', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.screenshot({ path: testInfo.outputPath('shoulder-hips.png') });
  await page.getByRole('button', { name: /左大腿/ }).click();
  await rotation.fill('-65');
  await rotation.press('Enter');
  await page.screenshot({ path: testInfo.outputPath('hand-over-thigh.png') });
  await page.getByRole('button', { name: '假人', exact: true }).click();
  await expect(page.getByRole('button', { name: '假人', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByText(/修订 9/)).toBeVisible();
  await page.getByRole('button', { name: '假人', exact: true }).click();
  await expect(rotation).toHaveValue('-65');
  expect(errors).toEqual([]);
});

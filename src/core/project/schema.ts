import { z } from 'zod';

const finite = z.number().finite();
const id = z.string().min(1);
const positiveInteger = z.number().int().positive();
export const vec2Schema = z.object({ x: finite, y: finite });
export const boneSchema = z.object({
  id,
  name: z.string().min(1),
  parentId: id.nullable(),
  offset: vec2Schema,
  length: finite.min(0.001),
  restAngle: finite,
  side: z.enum(['left', 'right', 'center']),
  angleLimit: z.object({ min: finite, max: finite }).optional(),
});
export const ikChainSchema = z.object({ id, upperBoneId: id, lowerBoneId: id });
export const rigSchema = z
  .object({
    id,
    revision: positiveInteger,
    bones: z.array(boneSchema).min(1).max(40),
    ikChains: z.array(ikChainSchema),
    drawOrder: z.array(id),
  })
  .superRefine((rig, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const bones = new Map(rig.bones.map((bone) => [bone.id, bone]));
    if (bones.size !== rig.bones.length) fail('骨骼 ID 重复');
    if (rig.bones.filter((bone) => bone.parentId === null).length !== 1)
      fail('骨架必须有且只有一个根骨骼');
    for (const bone of rig.bones) {
      if (bone.parentId !== null && !bones.has(bone.parentId)) fail(`父骨骼不存在：${bone.id}`);
      const visited = new Set<string>();
      let current: string | null = bone.id;
      while (current !== null && bones.has(current)) {
        if (visited.has(current)) {
          fail('骨架存在循环');
          break;
        }
        visited.add(current);
        current = bones.get(current)!.parentId;
      }
      if (bone.angleLimit && bone.angleLimit.min > bone.angleLimit.max) fail('角度限制范围无效');
    }
    if (
      new Set(rig.drawOrder).size !== bones.size ||
      rig.drawOrder.length !== bones.size ||
      rig.drawOrder.some((key) => !bones.has(key))
    )
      fail('绘制顺序必须包含每根骨骼且不重复');
    if (new Set(rig.ikChains.map((chain) => chain.id)).size !== rig.ikChains.length)
      fail('IK 链 ID 重复');
    for (const chain of rig.ikChains) {
      const upper = bones.get(chain.upperBoneId);
      const lower = bones.get(chain.lowerBoneId);
      if (
        !upper ||
        !lower ||
        lower.parentId !== upper.id ||
        Math.abs(lower.offset.x - upper.length) > 1e-6 ||
        Math.abs(lower.offset.y) > 1e-6
      )
        fail(`IK 链必须由首尾相接的两根骨骼组成：${chain.id}`);
    }
  });
export const poseSchema = z.object({
  rigId: id,
  rigRevision: positiveInteger,
  rootPosition: vec2Schema,
  rootRotation: finite,
  bodyTurn: finite.min(-90).max(90).default(0),
  localRotations: z.record(id, finite),
  ikControls: z.record(
    id,
    z.object({
      target: vec2Schema,
      bendSign: z.union([z.literal(1), z.literal(-1)]),
      mode: z.enum(['ik', 'fk']),
      pinned: z.boolean(),
    }),
  ),
});
export const poseAssetSchema = z.object({ id, name: z.string().min(1), pose: poseSchema });
export const keyPoseSchema = poseAssetSchema.extend({ durationFrames: positiveInteger.max(3000) });
export const clipSchema = z.object({
  id,
  name: z.string().min(1),
  keys: z.array(keyPoseSchema).max(300),
});
export const projectSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    name: z.string().min(1),
    revision: z.number().int().nonnegative(),
    canvas: z.object({
      width: positiveInteger.max(8192),
      height: positiveInteger.max(8192),
      background: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .nullable(),
    }),
    fps: z.number().int().min(1).max(60),
    defaultDurationFrames: positiveInteger.max(3000),
    rig: rigSchema,
    draft: poseSchema,
    poses: z.array(poseAssetSchema),
    clips: z.array(clipSchema),
    referenceImages: z.array(
      z.object({
        assetId: id,
        position: vec2Schema,
        scale: finite.positive(),
        opacity: finite.min(0).max(1),
        visible: z.boolean(),
      }),
    ),
  })
  .superRefine((project, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    const unique = (ids: string[], label: string) => {
      if (new Set(ids).size !== ids.length) fail(`${label} ID 重复`);
    };
    unique(
      project.poses.map((pose) => pose.id),
      '姿势',
    );
    unique(
      project.clips.map((clip) => clip.id),
      '序列',
    );
    unique(
      project.referenceImages.map((image) => image.assetId),
      '参考图',
    );
    unique(
      project.clips.flatMap((clip) => clip.keys.map((key) => key.id)),
      '关键姿势',
    );
    for (const clip of project.clips) {
      if (clip.keys.reduce((sum, key) => sum + key.durationFrames, 0) > 3000)
        fail('序列不能超过 3000 帧');
    }
    const poses = [
      project.draft,
      ...project.poses.map((asset) => asset.pose),
      ...project.clips.flatMap((clip) => clip.keys.map((key) => key.pose)),
    ];
    for (const pose of poses) {
      if (pose.rigId !== project.rig.id || pose.rigRevision !== project.rig.revision)
        fail('姿势与骨架版本不匹配');
      if (
        Object.keys(pose.localRotations).length !== project.rig.bones.length ||
        project.rig.bones.some((bone) => !Object.hasOwn(pose.localRotations, bone.id))
      )
        fail('姿势骨骼集合不匹配');
      if (
        Object.keys(pose.ikControls).length !== project.rig.ikChains.length ||
        project.rig.ikChains.some((chain) => !Object.hasOwn(pose.ikControls, chain.id))
      )
        fail('姿势 IK 控制器集合不匹配');
      for (const bone of project.rig.bones) {
        const rotation = pose.localRotations[bone.id];
        if (bone.angleLimit && (rotation < bone.angleLimit.min || rotation > bone.angleLimit.max))
          fail(`姿势超出关节限制：${bone.name}`);
      }
    }
  });

export type Vec2 = z.infer<typeof vec2Schema>;
export type BoneDefinition = z.infer<typeof boneSchema>;
export type IKChain = z.infer<typeof ikChainSchema>;
export type RigDefinition = z.infer<typeof rigSchema>;
export type PoseSnapshot = z.infer<typeof poseSchema>;
export type PoseAsset = z.infer<typeof poseAssetSchema>;
export type KeyPose = z.infer<typeof keyPoseSchema>;
export type Clip = z.infer<typeof clipSchema>;
export type Project = z.infer<typeof projectSchema>;

export function parseProject(input: unknown): Project {
  return projectSchema.parse(input);
}

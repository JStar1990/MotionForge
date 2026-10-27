// Reproduce neutral, self-contained GLBs from the author's free Standard ZIP.
// Usage: node scripts/prepare-mannequin.mjs path/to/standard.zip
import fs from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import console from 'node:console';
import crypto from 'node:crypto';
import JSZip from 'jszip';

const archive = await fs.readFile(process.argv[2]);
const zip = await JSZip.loadAsync(archive);
const prefix = 'Universal Base Characters[Standard]/';
const folder = prefix + 'Base Characters/Godot - UE/';
const output = 'public/models/quaternius';
await fs.mkdir(output, { recursive: true });
await fs.mkdir('assets/models/quaternius', { recursive: true });
const records = [];
for (const sex of ['Male', 'Female']) {
  const source = `Superhero_${sex}_FullBody`;
  const original = JSON.parse(await zip.file(folder + source + '.gltf').async('string'));
  const model = JSON.parse(JSON.stringify(original));
  if (model.buffers.length !== 1) throw new Error('Unexpected multiple buffers');
  const bin = await zip.file(folder + model.buffers[0].uri).async('nodebuffer');
  if (bin.length !== model.buffers[0].byteLength) throw new Error('Invalid source buffer size');
  model.buffers = [{ byteLength: bin.length }];
  model.materials = [
    {
      name: 'MotionForge Neutral Gray',
      pbrMetallicRoughness: {
        baseColorFactor: [0.58, 0.61, 0.66, 1],
        metallicFactor: 0,
        roughnessFactor: 0.8,
      },
    },
  ];
  for (const mesh of model.meshes) for (const primitive of mesh.primitives) primitive.material = 0;
  delete model.images;
  delete model.textures;
  delete model.samplers;
  // Source extensions are material-only; fail rather than stripping future geometry extensions.
  for (const extension of model.extensionsUsed ?? [])
    if (!extension.startsWith('KHR_materials_')) throw new Error(`Review extension: ${extension}`);
  delete model.extensionsUsed;
  delete model.extensionsRequired;
  const json = Buffer.from(JSON.stringify(model));
  const jsonPadded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20);
  json.copy(jsonPadded);
  const binPadded = Buffer.alloc(Math.ceil(bin.length / 4) * 4);
  bin.copy(binPadded);
  const glb = Buffer.alloc(12 + 8 + jsonPadded.length + 8 + binPadded.length);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(jsonPadded.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  jsonPadded.copy(glb, 20);
  const offset = 20 + jsonPadded.length;
  glb.writeUInt32LE(binPadded.length, offset);
  glb.writeUInt32LE(0x004e4942, offset + 4);
  binPadded.copy(glb, offset + 8);
  const filename = `mannequin-${sex.toLowerCase()}.glb`;
  await fs.writeFile(`${output}/${filename}`, glb);
  const primitives = model.meshes.flatMap((mesh) => mesh.primitives);
  records.push({
    filename,
    source: folder + source + '.gltf',
    bytes: glb.length,
    sha256: crypto.createHash('sha256').update(glb).digest('hex'),
    nodes: model.nodes.length,
    meshes: model.meshes.length,
    skins: model.skins.map((skin) => ({
      joints: skin.joints.length,
      jointNames: skin.joints.map((index) => model.nodes[index].name),
    })),
    triangles: primitives.reduce(
      (sum, p) =>
        sum +
        (p.indices === undefined
          ? model.accessors[p.attributes.POSITION].count
          : model.accessors[p.indices].count) /
          3,
      0,
    ),
    allPrimitivesSkinned: primitives.every(
      (p) => p.attributes.JOINTS_0 !== undefined && p.attributes.WEIGHTS_0 !== undefined,
    ),
    sourceTexturesRemoved: (original.images ?? []).map((image) => image.uri),
  });
}
const license = await zip.file(prefix + 'License_Standard.txt').async('string');
await fs.writeFile('assets/models/quaternius/License_Standard.txt', license);
await fs.writeFile(output + '/License_Standard.txt', license);
await fs.writeFile(
  'assets/models/quaternius/manifest.json',
  JSON.stringify(
    {
      author: 'Quaternius',
      pack: 'Universal Base Characters Standard',
      sourceURL: 'https://quaternius.itch.io/universal-base-characters',
      authorURL: 'https://quaternius.com/packs/universalbasecharacters.html',
      downloadDate: '2026-10-27',
      sourceArchiveSha256: crypto.createHash('sha256').update(archive).digest('hex'),
      conversion:
        'Original geometry, skin weights, node transforms, inverse bind matrices and skeleton retained; textures replaced by one neutral gray material; buffer embedded in GLB.',
      models: records,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify(
    records.map(({ filename, bytes, nodes, meshes, skins, triangles, allPrimitivesSkinned }) => ({
      filename,
      bytes,
      nodes,
      meshes,
      joints: skins.map((skin) => skin.joints),
      triangles,
      allPrimitivesSkinned,
    })),
    null,
    2,
  ),
);

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const worldDirectory = path.resolve(scriptDirectory, '..');
const sourcePath = path.join(
  worldDirectory,
  'public/models/milos-apartment/source/milos-apartment-capture-original.glb',
);
const runtimeDirectory = path.join(worldDirectory, 'public/models/milos-apartment/runtime');
const runtimePath = path.join(runtimeDirectory, 'milos-apartment.glb');

function paddedLength(length) {
  return Math.ceil(length / 4) * 4;
}

const source = await readFile(sourcePath);
if (source.toString('ascii', 0, 4) !== 'glTF') throw new Error('Source is not a binary glTF');
if (source.readUInt32LE(4) !== 2) throw new Error('Only glTF 2.0 is supported');

const sourceJsonLength = source.readUInt32LE(12);
const sourceJson = JSON.parse(
  source.toString('utf8', 20, 20 + sourceJsonLength).trimEnd(),
);
const binaryHeaderOffset = 20 + sourceJsonLength;
const binaryLength = source.readUInt32LE(binaryHeaderOffset);
const binaryType = source.readUInt32LE(binaryHeaderOffset + 4);
const binary = source.subarray(binaryHeaderOffset + 8, binaryHeaderOffset + 8 + binaryLength);

sourceJson.asset.generator = 'Dissonance Milo apartment runtime preparation';
sourceJson.asset.extras = {
  ...(sourceJson.asset.extras ?? {}),
  sourceAsset: 'milos-apartment-capture-original.glb',
};

sourceJson.nodes.forEach((node, index) => {
  if (node.mesh !== undefined) {
    node.name = `APT_ARCH_CAPTURE_${index}`;
    node.extras = { ...(node.extras ?? {}), dissonanceCategory: 'architecture' };
  } else {
    node.name = index === sourceJson.nodes.length - 1 ? 'APT_ARCH_ROOT' : `APT_ARCH_NODE_${index}`;
  }
});
sourceJson.meshes.forEach((mesh, index) => {
  mesh.name = `APT_ARCH_CAPTURE_MESH_${index}`;
});
sourceJson.materials?.forEach((material, index) => {
  material.name = `APT_CAPTURE_MATERIAL_${index}`;
});

const jsonBytes = Buffer.from(JSON.stringify(sourceJson));
const jsonChunkLength = paddedLength(jsonBytes.length);
const binaryChunkLength = paddedLength(binary.length);
const totalLength = 12 + 8 + jsonChunkLength + 8 + binaryChunkLength;
const output = Buffer.alloc(totalLength);

output.write('glTF', 0, 4, 'ascii');
output.writeUInt32LE(2, 4);
output.writeUInt32LE(totalLength, 8);
output.writeUInt32LE(jsonChunkLength, 12);
output.writeUInt32LE(0x4e4f534a, 16);
jsonBytes.copy(output, 20);
output.fill(0x20, 20 + jsonBytes.length, 20 + jsonChunkLength);

const outputBinaryHeaderOffset = 20 + jsonChunkLength;
output.writeUInt32LE(binaryChunkLength, outputBinaryHeaderOffset);
output.writeUInt32LE(binaryType, outputBinaryHeaderOffset + 4);
binary.copy(output, outputBinaryHeaderOffset + 8);

await mkdir(runtimeDirectory, { recursive: true });
await writeFile(runtimePath, output);
console.log(`Prepared ${path.relative(worldDirectory, runtimePath)} (${output.length} bytes)`);

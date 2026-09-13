/**
 * Extrae la anatomía COMPLETA de human-atlas (BodyParts3D 4.0, CC BY 4.0):
 * los 15 sistemas, 2.234 mallas. Para el visor de cuerpo entero con
 * esquema de condición personal (local, anónimo).
 *
 * Uso:  node extract-all.mjs <ruta-a-human-atlas> <dir-salida>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [, , atlasRoot, outDir = '.'] = process.argv;
if (!atlasRoot) { console.error('uso: node extract-all.mjs <human-atlas> [out]'); process.exit(1); }

const atlas = JSON.parse(readFileSync(join(atlasRoot, 'public/models/atlas.json'), 'utf8'));
const chunks = atlas.chunks.map((c) => readFileSync(join(atlasRoot, 'public', c.url.replace(/^\//, ''))));

const parts = [];
const buffers = [];
let offset = 0, totalTri = 0;

const push = (buf) => {
  const at = offset;
  buffers.push(buf); offset += buf.length;
  const pad = (4 - (offset % 4)) % 4;
  if (pad) { buffers.push(Buffer.alloc(pad)); offset += pad; }
  return at;
};

for (const p of atlas.parts) {
  const src = chunks[p.chunk];
  const posAt = push(src.subarray(p.positions, p.positions + p.vertexCount * 12));
  const nrmAt = push(src.subarray(p.normals, p.normals + p.vertexCount * 6));
  const idxAt = push(src.subarray(p.indices, p.indices + p.indexCount * 4));
  parts.push({
    id: p.id, fma: p.conceptId, name: p.name, system: p.system,
    positions: posAt, normals: nrmAt, indices: idxAt,
    vertexCount: p.vertexCount, indexCount: p.indexCount,
  });
  totalTri += p.indexCount / 3;
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'anatomy-full.bin'), Buffer.concat(buffers));
writeFileSync(join(outDir, 'anatomy-full.json'), JSON.stringify({
  source: 'BodyParts3D 4.0 via ashemag/human-atlas',
  attribution: 'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International',
  license: 'https://creativecommons.org/licenses/by/4.0/',
  layout: { positions: 'float32x3', normals: 'sint16x3 normalized', indices: 'uint32' },
  triangles: totalTri,
  parts,
}));

const by = {};
for (const p of parts) by[p.system] = (by[p.system] || 0) + 1;
console.log(`mallas: ${parts.length} · triángulos: ${totalTri.toLocaleString()}`);
console.log(JSON.stringify(by));
console.log(`binario: ${(offset / 1e6).toFixed(1)} MB`);

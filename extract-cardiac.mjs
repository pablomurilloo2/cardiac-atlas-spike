/**
 * Extrae el subconjunto cardiovascular de human-atlas (BodyParts3D 4.0, CC BY 4.0)
 * a un par manifest + binario listos para el atlas de PulseNet.
 *
 * - Filtra por concepto FMA, nunca por texto (la búsqueda por nombre arrastra
 *   la circunfleja femoral, la humeral y la marginal del colon).
 * - Excluye los ventrículos CEREBRALES que BodyParts3D clasifica como "cardiac".
 * - Anota cada malla coronaria con su código SCCT donde existe correspondencia.
 *
 * Uso:  node extract-cardiac.mjs <ruta-a-human-atlas> <dir-salida>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const [, , atlasRoot, outDir = '.'] = process.argv;
if (!atlasRoot) {
  console.error('uso: node extract-cardiac.mjs <ruta-a-human-atlas> [dir-salida]');
  process.exit(1);
}

/* Ventrículos cerebrales colados en el sistema "cardiac" de BodyParts3D. */
const BRAIN_FMA = new Set(['FMA78449', 'FMA78450', 'FMA78469', 'FMA78454', 'FMA75351']);

/* Conceptos FMA del árbol coronario -> código SCCT del diccionario clínico.
   null = rama real pero sin segmento SCCT propio (se agrupa con su tronco). */
const CORONARY_FMA = {
  FMA3855: 'LM',      // tronco coronaria izquierda
  FMA74912: 'LAD-p',  // tronco de la descendente anterior (BP3D no la divide p/m/d)
  FMA3860: 'D1',      // ramas diagonales
  FMA3892: null,      // septales de la DA
  FMA3868: null,      // rama del cono
  FMA3872: null, FMA3874: null, FMA3876: null, // ramas anteriores derechas de la DA
  FMA3895: 'LCx-p',   // circunfleja
  FMA3802: 'RCA-p',   // tronco coronaria derecha
  FMA3818: null,      // marginal aguda
  FMA3815: null, FMA3837: null, // ramas ventriculares de la CD
  FMA3840: 'R-PDA',   // interventricular posterior
  FMA3847: null, FMA3848: null, // septales de la PDA
};

/* Grandes vasos: el contexto que un cirujano usa para orientarse (canulación,
   cayado, retornos venosos). Sin esto el corazón flota sin norte. */
const GREAT_FMA = {
  FMA3736: 'Aorta ascendente',        FMA3768: 'Cayado aórtico',
  FMA3784: 'Aorta descendente',       FMA3932: 'Tronco braquiocefálico',
  FMA4058: 'Carótida común izquierda', FMA4694: 'Subclavia izquierda',
  FMA8612: 'Tronco pulmonar',
  FMA50873: 'Arteria pulmonar izquierda', FMA50872: 'Arteria pulmonar derecha',
  FMA4720: 'Vena cava superior',      FMA10951: 'Vena cava inferior',
  FMA49916: 'V. pulmonar sup. izquierda', FMA49913: 'V. pulmonar inf. izquierda',
  FMA49914: 'V. pulmonar sup. derecha',   FMA49911: 'V. pulmonar inf. derecha',
};

/* Sistema venoso cardiaco: el drenaje del corazón, que faltaba. */
const CARDIAC_VEIN_FMA = {
  FMA4706: 'Seno coronario', FMA4707: 'Vena cardiaca magna',
  FMA4713: 'Vena cardiaca media', FMA4714: 'Vena cardiaca menor',
  FMA4708: 'Vena marginal izquierda', FMA4716: 'Vena marginal derecha',
  FMA4712: 'Vena posterior del VI', FMA76767: 'Vena cardiaca anterior',
};

const atlas = JSON.parse(readFileSync(join(atlasRoot, 'public/models/atlas.json'), 'utf8'));
const chunks = atlas.chunks.map((c) =>
  readFileSync(join(atlasRoot, 'public', c.url.replace(/^\//, ''))));

const wanted = atlas.parts.filter((p) =>
  (p.system === 'cardiac' && !BRAIN_FMA.has(p.conceptId)) ||
  CORONARY_FMA[p.conceptId] !== undefined ||
  GREAT_FMA[p.conceptId] !== undefined ||
  CARDIAC_VEIN_FMA[p.conceptId] !== undefined);

/* Empaquetado del origen: pos float32×3 (12 B/v), normales int16×3 (6 B/v),
   índices uint32. Se conserva tal cual; sólo se reubica. */
/* Línea central aproximada de una malla tubular: eje dominante por iteración de
   potencia sobre la covarianza, proyección de vértices sobre el eje, y centroide
   por bin (~2 mm). Para vasos es una centerline decente; para el corazón no se
   calcula (no es un tubo). */
function centerlineOf(chunk, p) {
  const pos = new Float32Array(chunk.buffer, chunk.byteOffset + p.positions, p.vertexCount * 3);
  const n = p.vertexCount;
  const c = [0, 0, 0];
  for (let i = 0; i < n * 3; i += 3) { c[0] += pos[i]; c[1] += pos[i + 1]; c[2] += pos[i + 2]; }
  c[0] /= n; c[1] /= n; c[2] /= n;

  let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
  for (let i = 0; i < n * 3; i += 3) {
    const dx = pos[i] - c[0], dy = pos[i + 1] - c[1], dz = pos[i + 2] - c[2];
    xx += dx * dx; xy += dx * dy; xz += dx * dz; yy += dy * dy; yz += dy * dz; zz += dz * dz;
  }
  let ex = 1, ey = 1, ez = 1;
  for (let k = 0; k < 32; k++) {
    const nx = xx * ex + xy * ey + xz * ez;
    const ny = xy * ex + yy * ey + yz * ez;
    const nz = xz * ex + yz * ey + zz * ez;
    const len = Math.hypot(nx, ny, nz) || 1;
    ex = nx / len; ey = ny / len; ez = nz / len;
  }

  let tMin = Infinity, tMax = -Infinity;
  const ts = new Float32Array(n);
  for (let i = 0, v = 0; i < n * 3; i += 3, v++) {
    const t = (pos[i] - c[0]) * ex + (pos[i + 1] - c[1]) * ey + (pos[i + 2] - c[2]) * ez;
    ts[v] = t;
    if (t < tMin) tMin = t; if (t > tMax) tMax = t;
  }
  const len = tMax - tMin;
  if (!(len > 1e-6)) return [[+c[0].toFixed(5), +c[1].toFixed(5), +c[2].toFixed(5)]];
  const bins = Math.max(4, Math.min(24, Math.round(len / 0.002)));
  const acc = Array.from({ length: bins }, () => [0, 0, 0, 0]);
  for (let i = 0, v = 0; i < n * 3; i += 3, v++) {
    // ts es float32 pero tMin se calculó en doble precisión: el redondeo puede
    // caer por debajo del mínimo. Clamp por ambos extremos.
    const b = Math.max(0, Math.min(bins - 1, Math.floor(((ts[v] - tMin) / len) * bins)));
    acc[b][0] += pos[i]; acc[b][1] += pos[i + 1]; acc[b][2] += pos[i + 2]; acc[b][3]++;
  }
  return acc.filter((a) => a[3] > 0)
    .map((a) => [a[0] / a[3], a[1] / a[3], a[2] / a[3]].map((v) => +v.toFixed(5)));
}

const parts = [];
const buffers = [];
let offset = 0, totalTri = 0;

/* Float32Array y Uint32Array exigen desplazamientos múltiplos de 4. Las normales
   miden 6 B/vértice, así que sin relleno un conteo impar desalinea todo lo que
   sigue y el visor revienta con RangeError al construir los typed arrays. */
const push = (buf) => {
  const at = offset;
  buffers.push(buf);
  offset += buf.length;
  const pad = (4 - (offset % 4)) % 4;
  if (pad) { buffers.push(Buffer.alloc(pad)); offset += pad; }
  return at;
};

for (const p of wanted) {
  const src = chunks[p.chunk];
  const posAt = push(src.subarray(p.positions, p.positions + p.vertexCount * 12));
  const nrmAt = push(src.subarray(p.normals, p.normals + p.vertexCount * 6));
  const idxAt = push(src.subarray(p.indices, p.indices + p.indexCount * 4));

  const group = p.system === 'cardiac' ? 'heart'
    : CARDIAC_VEIN_FMA[p.conceptId] !== undefined ? 'cvein'
    : GREAT_FMA[p.conceptId] !== undefined ? 'great'
    : 'coronary';
  const centerline = group === 'heart' ? undefined : centerlineOf(chunks[p.chunk], p);
  parts.push({
    centerline,
    id: p.id,
    fma: p.conceptId,
    name: CARDIAC_VEIN_FMA[p.conceptId] || GREAT_FMA[p.conceptId] || p.name,
    group,
    scct: CORONARY_FMA[p.conceptId] ?? null,
    positions: posAt,
    normals: nrmAt,
    indices: idxAt,
    vertexCount: p.vertexCount,
    indexCount: p.indexCount,
    bounds: p.bounds,
  });
  totalTri += p.indexCount / 3;
}

mkdirSync(outDir, { recursive: true });
const bin = Buffer.concat(buffers);
writeFileSync(join(outDir, 'cardiac-subset.bin'), bin);
writeFileSync(join(outDir, 'cardiac-subset.bin.gz'), gzipSync(bin, { level: 9 }));
writeFileSync(join(outDir, 'cardiac-subset.json'), JSON.stringify({
  source: 'BodyParts3D 4.0 via ashemag/human-atlas',
  attribution: 'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International',
  license: 'https://creativecommons.org/licenses/by/4.0/',
  layout: { positions: 'float32x3', normals: 'sint16x3 normalized', indices: 'uint32' },
  triangles: totalTri,
  parts,
}, null, 1));

console.log(`mallas: ${parts.length} (${parts.filter((p) => p.group === 'heart').length} corazón, ` +
  `${parts.filter((p) => p.group === 'coronary').length} coronarias, ` +
  `${parts.filter((p) => p.group === 'cvein').length} venas cardiacas, ` +
  `${parts.filter((p) => p.group === 'great').length} grandes vasos)`);
console.log(`triángulos: ${totalTri.toLocaleString()}`);
console.log(`binario: ${(bin.length / 1e6).toFixed(2)} MB · gzip: ` +
  `${(gzipSync(bin, { level: 9 }).length / 1e6).toFixed(2)} MB`);

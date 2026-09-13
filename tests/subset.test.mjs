/**
 * Tests del artefacto extraído (cardiac-subset.bin/json).
 * Verifican el contrato binario del que depende heart.html: alineación,
 * rangos de índices, escala anatómica y coherencia de grupos.
 * Correr con:  node --test tests/
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SCCT_SEGMENTS } from '../clinical-model.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
let manifest, ab;

before(() => {
  manifest = JSON.parse(readFileSync(join(root, 'cardiac-subset.json'), 'utf8'));
  const bin = readFileSync(join(root, 'cardiac-subset.bin'));
  ab = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
});

test('manifiesto: atribución CC BY 4.0 presente (obligación de licencia)', () => {
  assert.match(manifest.attribution, /Database Center for Life Science/);
  assert.match(manifest.license, /licenses\/by\/4\.0/);
});

test('composición: 130 mallas — 18 corazón, 57 coronarias, 36 venas cardiacas, 19 grandes vasos', () => {
  assert.equal(manifest.parts.length, 130);
  const by = (g) => manifest.parts.filter((p) => p.group === g).length;
  assert.equal(by('heart'), 18);
  assert.equal(by('coronary'), 57);
  assert.equal(by('cvein'), 36);
  assert.equal(by('great'), 19);
});

test('sin ventrículos cerebrales: el defecto de clasificación de BodyParts3D quedó filtrado', () => {
  const brain = ['FMA78449', 'FMA78450', 'FMA78469', 'FMA78454', 'FMA75351'];
  for (const fma of brain) {
    assert.ok(!manifest.parts.some((p) => p.fma === fma),
      `estructura cerebral ${fma} presente en el subconjunto cardiaco`);
  }
});

test('binario: todos los offsets alineados a 4 bytes (contrato de typed arrays)', () => {
  for (const p of manifest.parts) {
    assert.equal(p.positions % 4, 0, `${p.id} posiciones desalineadas`);
    assert.equal(p.indices % 4, 0, `${p.id} índices desalineados`);
    assert.equal(p.normals % 2, 0, `${p.id} normales desalineadas`);
  }
});

test('binario: índices dentro de rango y buffers dentro del archivo', () => {
  for (const p of manifest.parts) {
    const end = p.indices + p.indexCount * 4;
    assert.ok(end <= ab.byteLength, `${p.id} desborda el binario`);
    const idx = new Uint32Array(ab, p.indices, p.indexCount);
    let max = 0;
    for (const i of idx) if (i > max) max = i;
    assert.ok(max < p.vertexCount, `${p.id} índice ${max} >= ${p.vertexCount} vértices`);
    assert.equal(p.indexCount % 3, 0, `${p.id} triángulos incompletos`);
  }
});

test('escala anatómica: el corazón mide entre 8 y 15 cm por eje', () => {
  const box = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
  for (const p of manifest.parts.filter((x) => x.group === 'heart')) {
    const pos = new Float32Array(ab, p.positions, p.vertexCount * 3);
    for (let i = 0; i < pos.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        if (pos[i + k] < box[0][k]) box[0][k] = pos[i + k];
        if (pos[i + k] > box[1][k]) box[1][k] = pos[i + k];
      }
    }
  }
  for (let k = 0; k < 3; k++) {
    const cm = (box[1][k] - box[0][k]) * 100;
    assert.ok(cm > 8 && cm < 15, `eje ${k}: ${cm.toFixed(1)} cm fuera del rango de un corazón humano`);
  }
});

test('códigos SCCT del manifiesto existen en el diccionario clínico', () => {
  const valid = new Set(SCCT_SEGMENTS.map((s) => s.code));
  for (const p of manifest.parts) {
    if (p.scct !== null && p.scct !== undefined) {
      assert.ok(valid.has(p.scct), `${p.id} anotado con SCCT inexistente: ${p.scct}`);
    }
  }
});

test('centerlines: presentes en vasos, ausentes en el corazón, y dentro de la caja anatómica', () => {
  for (const p of manifest.parts) {
    if (p.group === 'heart') {
      assert.equal(p.centerline, undefined, `${p.id} (corazón) no debe llevar centerline`);
      continue;
    }
    assert.ok(Array.isArray(p.centerline) && p.centerline.length >= 1,
      `${p.id} sin centerline`);
    for (const [x, y, z] of p.centerline) {
      assert.ok(Math.abs(x) < 0.3 && y > 0.9 && y < 1.7 && Math.abs(z) < 0.3,
        `${p.id} centerline fuera del tórax: ${x},${y},${z}`);
    }
  }
});

test('coronarias por concepto FMA, nunca por texto: sin femorales, humerales ni cólicas', () => {
  const banned = /femoral|humeral|colic|callosomarginal|scapular/i;
  for (const p of manifest.parts) {
    assert.ok(!banned.test(p.name), `intruso por coincidencia de texto: ${p.name}`);
  }
});

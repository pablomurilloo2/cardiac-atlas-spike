/**
 * Tests del diccionario clínico. Cada aserción de contenido médico cita su fuente:
 *  [C02] Cerqueira et al., Circulation 2002 — AHA 17 segmentos
 *  [L14] Leipsic et al., JCCT 2014 — SCCT 18 segmentos
 * Correr con:  node --test tests/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AHA_SEGMENTS, SCCT_SEGMENTS, VESSELS, LEVELS, WALLS,
  PALETTE, territoryOf, byId, byCode,
} from '../clinical-model.js';

test('AHA: exactamente 17 segmentos con ids 1..17 únicos [C02]', () => {
  assert.equal(AHA_SEGMENTS.length, 17);
  const ids = new Set(AHA_SEGMENTS.map((s) => s.id));
  assert.equal(ids.size, 17);
  for (let i = 1; i <= 17; i++) assert.ok(byId.has(i), `falta el segmento ${i}`);
});

test('AHA: bandas correctas — 6 basales, 6 medios, 4 apicales, 1 ápex [C02]', () => {
  const count = (lvl) => AHA_SEGMENTS.filter((s) => s.level === lvl).length;
  assert.equal(count('basal'), 6);
  assert.equal(count('mid'), 6);
  assert.equal(count('apical'), 4);
  assert.equal(count('apex'), 1);
});

test('AHA: cada segmento referencia nivel y pared existentes', () => {
  for (const s of AHA_SEGMENTS) {
    assert.ok(LEVELS[s.level], `nivel desconocido en segmento ${s.id}`);
    assert.ok(WALLS[s.wall], `pared desconocida en segmento ${s.id}`);
    assert.ok(VESSELS[s.territory], `territorio desconocido en segmento ${s.id}`);
  }
});

test('territorios en dominancia derecha: LAD 7, RCA 5, LCx 5 [C02]', () => {
  const acc = {};
  for (const s of AHA_SEGMENTS) {
    const t = territoryOf(s, 'right');
    acc[t] = (acc[t] || 0) + 1;
  }
  assert.deepEqual(acc, { LAD: 7, RCA: 5, LCx: 5 });
});

test('territorios en dominancia izquierda: la CD cede todo su territorio del VI a la Cx', () => {
  const acc = {};
  for (const s of AHA_SEGMENTS) {
    const t = territoryOf(s, 'left');
    acc[t] = (acc[t] || 0) + 1;
  }
  assert.equal(acc.RCA, undefined, 'en dominancia izquierda la CD no debe conservar territorio');
  assert.equal(acc.LCx, 10);
  assert.equal(acc.LAD, 7);
});

test('territorios en codominancia: los segmentos disputados se marcan compartidos', () => {
  const shared = AHA_SEGMENTS.filter((s) => territoryOf(s, 'codominant') === 'RCA/LCx');
  assert.equal(shared.length, 5, 'los 5 segmentos con altLeft deben marcarse RCA/LCx');
});

test('SCCT: 18 segmentos con numeración 1..18 única [L14]', () => {
  assert.equal(SCCT_SEGMENTS.length, 18);
  const nums = new Set(SCCT_SEGMENTS.map((v) => v.num));
  assert.equal(nums.size, 18);
  const codes = new Set(SCCT_SEGMENTS.map((v) => v.code));
  assert.equal(codes.size, 18, 'códigos duplicados');
});

test('SCCT: integridad referencial — todo atRisk apunta a segmentos AHA reales', () => {
  for (const v of SCCT_SEGMENTS) {
    assert.ok(v.atRisk.length > 0, `${v.code} sin territorio distal`);
    assert.equal(new Set(v.atRisk).size, v.atRisk.length, `${v.code} repite segmentos`);
    for (const id of v.atRisk) assert.ok(byId.has(id), `${v.code} -> segmento inexistente ${id}`);
    assert.ok(VESSELS[v.vessel], `${v.code} con vaso desconocido`);
  }
});

test('SCCT: todo segmento miocárdico es alcanzable desde alguna coronaria', () => {
  for (const s of AHA_SEGMENTS) {
    const feeders = SCCT_SEGMENTS.filter((v) => v.atRisk.includes(s.id));
    assert.ok(feeders.length > 0, `segmento ${s.id} (${s.es}) sin coronaria que lo comprometa`);
  }
});

test('coherencia territorio-rama: el territorio de cada segmento tiene una rama propia que lo compromete', () => {
  for (const s of AHA_SEGMENTS) {
    const t = territoryOf(s, 'right');
    const feeders = SCCT_SEGMENTS.filter((v) => v.atRisk.includes(s.id) && v.vessel !== 'LM');
    assert.ok(feeders.some((v) => v.vessel === t),
      `segmento ${s.id} es territorio ${t} pero ninguna rama de ${t} lo alimenta`);
  }
});

test('el tronco común compromete todo el territorio izquierdo (12 segmentos) [L14]', () => {
  const lm = byCode.get('LM');
  assert.equal(lm.atRisk.length, 12);
  for (const id of lm.atRisk) {
    const t = territoryOf(byId.get(id), 'right');
    assert.ok(t === 'LAD' || t === 'LCx', `LM compromete al segmento ${id} que es ${t}`);
  }
});

test('paleta: colores de territorio únicos y en formato hex válido', () => {
  const values = Object.values(PALETTE.territory);
  assert.equal(new Set(values).size, values.length, 'colores de territorio repetidos');
  for (const c of [...values, ...PALETTE.densityDark, ...PALETTE.densityLight,
    PALETTE.noDataDark, PALETTE.noDataLight]) {
    assert.match(c, /^#[0-9A-Fa-f]{6}$/, `color inválido: ${c}`);
  }
});

test('paleta: rampas de densidad con luminosidad monótona', () => {
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  };
  const dark = PALETTE.densityDark.map(lum);
  const light = PALETTE.densityLight.map(lum);
  for (let i = 1; i < dark.length; i++)
    assert.ok(dark[i] > dark[i - 1], 'rampa oscura no monótona (debe aclarar)');
  for (let i = 1; i < light.length; i++)
    assert.ok(light[i] < light[i - 1], 'rampa clara no monótona (debe oscurecer)');
});

test('todo contenido clínico declara fuente y estado de validación', () => {
  for (const s of AHA_SEGMENTS) {
    assert.equal(s.source, 'C02');
    assert.equal(s.status, 'to-validate', 'nada debe marcarse validado sin revisión clínica');
  }
  for (const v of SCCT_SEGMENTS) assert.equal(v.source, 'L14');
});

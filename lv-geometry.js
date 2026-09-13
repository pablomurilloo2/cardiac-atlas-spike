/**
 * Geometría del ventrículo izquierdo dividida en los 17 segmentos AHA.
 *
 * Elipsoide prolato truncado. Cada segmento es una malla independiente con pared
 * de grosor real (superficie externa + interna + bordes), de modo que el modelo
 * admite corte y vista interior sin quedar hueco.
 *
 * NO es geometría anatómica derivada de imagen: es un atlas esquemático con la
 * topología correcta del modelo AHA. Para reconstrucción específica del paciente
 * haría falta segmentación de CCTA, que es otro producto.
 */
import * as THREE from './vendor/three.module.min.js';

export const R = 1.0;          // radio ecuatorial
export const H = 1.62;         // semieje largo (ápex a base)
export const WALL = 0.13;      // grosor de pared
export const PHI_MAX = Math.PI * 0.62;   // truncamiento en la base

export const BANDS = {
  basal:  { p0: 0.72, p1: 1.00, sectors: 6, first: 1 },
  mid:    { p0: 0.45, p1: 0.72, sectors: 6, first: 7 },
  apical: { p0: 0.20, p1: 0.45, sectors: 4, first: 13 },
  apex:   { p0: 0.00, p1: 0.20, sectors: 1, first: 17 },
};

/** Índice del sector dentro de su banda, 0-based. */
export function sectorOf(seg) {
  return seg.id - BANDS[seg.level].first;
}

export function ellipsoidPoint(phi, theta, out = new THREE.Vector3()) {
  const s = Math.sin(phi);
  return out.set(R * s * Math.cos(theta), -H * Math.cos(phi), R * s * Math.sin(theta));
}

export function ellipsoidNormal(phi, theta, out = new THREE.Vector3()) {
  const p = ellipsoidPoint(phi, theta, out);
  return out.set(p.x / (R * R), p.y / (H * H), p.z / (R * R)).normalize();
}

/**
 * @param seg      entrada de AHA_SEGMENTS (necesita .level y .id)
 * @param nU       divisiones longitudinales
 * @param nV       divisiones circunferenciales
 * @param gap      separación entre segmentos, en fracción del rango
 */
export function buildSegmentGeometry(seg, nU, nV, gap = 0.016) {
  const band = BANDS[seg.level];
  const isApex = seg.level === 'apex';
  const sector = sectorOf(seg);

  const phi0 = (band.p0 + (isApex ? 0 : gap)) * PHI_MAX;
  const phi1 = (band.p1 - gap) * PHI_MAX;

  const arc = (Math.PI * 2) / band.sectors;
  const tGap = isApex ? 0 : gap * 1.6;
  // Segmento 1 (basal anterior) centrado al frente. Los sectores avanzan en el mismo
  // sentido que el bullseye AHA (anterior → septal), por eso el ángulo decrece.
  // PENDIENTE DE VALIDACIÓN: que este sentido corresponda a la orientación real del
  // paciente en la vista por defecto de la cámara es cosa de revisión clínica.
  const th0 = isApex ? 0 : -sector * arc - arc / 2 + tGap;
  const th1 = isApex ? Math.PI * 2 : -sector * arc + arc / 2 - tGap;

  const uCount = nU + 1, vCount = nV + 1;
  const perSurface = uCount * vCount;
  const positions = new Float32Array(perSurface * 2 * 3);
  const normals = new Float32Array(perSurface * 2 * 3);

  const p = new THREE.Vector3(), n = new THREE.Vector3();
  let o = 0;

  for (let surface = 0; surface < 2; surface++) {
    const inset = surface === 0 ? 0 : WALL;
    const flip = surface === 0 ? 1 : -1;
    for (let i = 0; i < uCount; i++) {
      const phi = Math.max(1e-4, phi0 + (phi1 - phi0) * (i / nU));
      for (let j = 0; j < vCount; j++) {
        const theta = th0 + (th1 - th0) * (j / nV);
        ellipsoidNormal(phi, theta, n);
        ellipsoidPoint(phi, theta, p);
        positions[o] = p.x - n.x * inset;
        positions[o + 1] = p.y - n.y * inset;
        positions[o + 2] = p.z - n.z * inset;
        normals[o] = n.x * flip; normals[o + 1] = n.y * flip; normals[o + 2] = n.z * flip;
        o += 3;
      }
    }
  }

  const idx = [];
  const quad = (a, b, c, d) => { idx.push(a, b, d, b, c, d); };

  for (let surface = 0; surface < 2; surface++) {
    const base = surface * perSurface;
    for (let i = 0; i < nU; i++) {
      for (let j = 0; j < nV; j++) {
        const a = base + i * vCount + j, b = a + vCount, c = b + 1, d = a + 1;
        if (surface === 0) quad(a, b, c, d); else quad(d, c, b, a);
      }
    }
  }

  const IN = perSurface;
  for (let j = 0; j < nV; j++) {                 // borde basal
    const a = nU * vCount + j;
    quad(a, a + 1, IN + a + 1, IN + a);
  }
  if (!isApex) {
    for (let j = 0; j < nV; j++) {               // borde apical
      quad(IN + j, IN + j + 1, j + 1, j);
    }
    for (let i = 0; i < nU; i++) {               // costados
      const a = i * vCount, b = a + vCount;
      quad(a, IN + a, IN + b, b);
      const c = i * vCount + nV, d = c + vCount;
      quad(IN + c, c, d, IN + d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/**
 * Trazados coronarios sobre el epicardio, en coordenadas (theta, t) donde
 * t es la fracción de eje largo desde el ápex. Aproximación esquemática con
 * los orígenes y recorridos correctos en topología, no en anatomía métrica.
 */
export const VESSEL_PATHS = {
  'LM':    [[0.00, 1.06], [0.16, 1.04]],
  'LAD-p': [[0.16, 1.04], [0.10, 0.86], [0.16, 0.70]],
  'LAD-m': [[0.16, 0.70], [0.20, 0.54], [0.22, 0.40]],
  'LAD-d': [[0.22, 0.40], [0.20, 0.24], [0.10, 0.08]],
  'D1':    [[0.17, 0.66], [0.42, 0.56], [0.62, 0.44]],
  'D2':    [[0.21, 0.48], [0.44, 0.38], [0.60, 0.28]],
  'LCx-p': [[0.16, 1.04], [0.62, 0.94], [1.02, 0.80]],
  'OM1':   [[1.02, 0.80], [1.22, 0.62], [1.30, 0.44]],
  'LCx-m': [[1.02, 0.80], [1.42, 0.66], [1.58, 0.48]],
  'OM2':   [[1.50, 0.58], [1.66, 0.42], [1.72, 0.26]],
  'L-PDA': [[1.70, 0.40], [2.20, 0.26], [2.70, 0.18]],
  'L-PLB': [[1.62, 0.52], [2.00, 0.44], [2.30, 0.38]],
  'RCA-p': [[3.14, 1.06], [2.72, 0.96], [2.40, 0.86]],
  'RCA-m': [[2.40, 0.86], [2.20, 0.70], [2.10, 0.54]],
  'RCA-d': [[2.10, 0.54], [2.06, 0.38], [2.02, 0.24]],
  'R-PDA': [[2.02, 0.24], [2.60, 0.20], [3.10, 0.16]],
  'R-PLB': [[2.14, 0.44], [2.60, 0.36], [2.96, 0.30]],
  'RI':    [[0.30, 1.00], [0.70, 0.82], [0.92, 0.62]],
};

export function vesselCurve(code, lift = 0.038) {
  const pts = VESSEL_PATHS[code];
  if (!pts) return null;
  const v = pts.map(([theta, t]) => {
    const phi = Math.max(0.02, t * PHI_MAX);
    const p = ellipsoidPoint(phi, theta);
    const n = ellipsoidNormal(phi, theta, new THREE.Vector3());
    return p.addScaledVector(n, lift);
  });
  return new THREE.CatmullRomCurve3(v);
}

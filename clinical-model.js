/**
 * PulseNet — diccionario de segmentos cardiacos.
 *
 * Contrato de datos del atlas. El 3D y el bullseye 2D son vistas sobre este módulo;
 * ninguna anotación se ata a nombres de malla de un archivo GLB. Cambiar el modelo
 * gráfico no debe migrar un solo dato clínico.
 *
 * FUENTES
 *  [C02] Cerqueira MD, Weissman NJ, Dilsizian V, et al. Standardized myocardial
 *        segmentation and nomenclature for tomographic imaging of the heart.
 *        Circulation. 2002;105(4):539-542. — modelo AHA de 17 segmentos.
 *  [L14] Leipsic J, Abbara S, Achenbach S, et al. SCCT guidelines for the
 *        interpretation and reporting of coronary CT angiography.
 *        J Cardiovasc Comput Tomogr. 2014;8(5):342-358. — 18 segmentos coronarios.
 *
 * ESTADO: contenido transcrito de los estándares citados, NO verificado todavía
 * contra los documentos originales por un clínico de Pulse Heart. Cada entrada lleva
 * `status`. Nada marcado 'to-validate' debe mostrarse en producción sin revisión.
 *
 * ADVERTENCIA CLÍNICA: la atribución de un segmento miocárdico a una arteria concreta
 * es VARIABLE entre pacientes. [C02] lo dice explícitamente. Este mapa codifica el
 * caso típico y sirve para orientación y comunicación, nunca para sustituir la
 * anatomía real del paciente vista en su angiografía o su CCTA.
 */

export const SOURCES = {
  C02: {
    ref: 'Cerqueira MD, et al. Circulation. 2002;105(4):539-542.',
    title: 'Standardized Myocardial Segmentation and Nomenclature for Tomographic Imaging of the Heart',
    body: 'American Heart Association Writing Group on Myocardial Segmentation and Registration for Cardiac Imaging',
  },
  L14: {
    ref: 'Leipsic J, et al. J Cardiovasc Comput Tomogr. 2014;8(5):342-358.',
    title: 'SCCT guidelines for the interpretation and reporting of coronary CT angiography',
    body: 'Society of Cardiovascular Computed Tomography',
  },
};

/* ------------------------------------------------------------------
   Miocardio — modelo AHA de 17 segmentos [C02]
   ------------------------------------------------------------------ */

export const LEVELS = {
  basal:  { es: 'Basal',   en: 'Basal',  order: 3 },
  mid:    { es: 'Medio',   en: 'Mid',    order: 2 },
  apical: { es: 'Apical',  en: 'Apical', order: 1 },
  apex:   { es: 'Ápex',    en: 'Apex',   order: 0 },
};

export const WALLS = {
  anterior:      { es: 'Anterior',       en: 'Anterior' },
  anteroseptal:  { es: 'Anteroseptal',   en: 'Anteroseptal' },
  inferoseptal:  { es: 'Inferoseptal',   en: 'Inferoseptal' },
  inferior:      { es: 'Inferior',       en: 'Inferior' },
  inferolateral: { es: 'Inferolateral',  en: 'Inferolateral' },
  anterolateral: { es: 'Anterolateral',  en: 'Anterolateral' },
  septal:        { es: 'Septal',         en: 'Septal' },
  lateral:       { es: 'Lateral',        en: 'Lateral' },
  apex:          { es: 'Ápex',           en: 'Apex' },
};

/**
 * `territory` es la atribución en dominancia DERECHA, que es ~85 % de la población.
 * `altLeft` indica a qué arteria pasa el segmento cuando la dominancia es izquierda:
 * la descendente posterior nace de la circunfleja y la pared inferior cambia de dueño.
 */
export const AHA_SEGMENTS = [
  { id: 1,  es: 'Basal anterior',        en: 'Basal anterior',        level: 'basal',  wall: 'anterior',      territory: 'LAD' },
  { id: 2,  es: 'Basal anteroseptal',    en: 'Basal anteroseptal',    level: 'basal',  wall: 'anteroseptal',  territory: 'LAD' },
  { id: 3,  es: 'Basal inferoseptal',    en: 'Basal inferoseptal',    level: 'basal',  wall: 'inferoseptal',  territory: 'RCA', altLeft: 'LCx' },
  { id: 4,  es: 'Basal inferior',        en: 'Basal inferior',        level: 'basal',  wall: 'inferior',      territory: 'RCA', altLeft: 'LCx' },
  { id: 5,  es: 'Basal inferolateral',   en: 'Basal inferolateral',   level: 'basal',  wall: 'inferolateral', territory: 'LCx' },
  { id: 6,  es: 'Basal anterolateral',   en: 'Basal anterolateral',   level: 'basal',  wall: 'anterolateral', territory: 'LCx' },

  { id: 7,  es: 'Medio anterior',        en: 'Mid anterior',          level: 'mid',    wall: 'anterior',      territory: 'LAD' },
  { id: 8,  es: 'Medio anteroseptal',    en: 'Mid anteroseptal',      level: 'mid',    wall: 'anteroseptal',  territory: 'LAD' },
  { id: 9,  es: 'Medio inferoseptal',    en: 'Mid inferoseptal',      level: 'mid',    wall: 'inferoseptal',  territory: 'RCA', altLeft: 'LCx' },
  { id: 10, es: 'Medio inferior',        en: 'Mid inferior',          level: 'mid',    wall: 'inferior',      territory: 'RCA', altLeft: 'LCx' },
  { id: 11, es: 'Medio inferolateral',   en: 'Mid inferolateral',     level: 'mid',    wall: 'inferolateral', territory: 'LCx' },
  { id: 12, es: 'Medio anterolateral',   en: 'Mid anterolateral',     level: 'mid',    wall: 'anterolateral', territory: 'LCx' },

  { id: 13, es: 'Apical anterior',       en: 'Apical anterior',       level: 'apical', wall: 'anterior',      territory: 'LAD' },
  { id: 14, es: 'Apical septal',         en: 'Apical septal',         level: 'apical', wall: 'septal',        territory: 'LAD' },
  { id: 15, es: 'Apical inferior',       en: 'Apical inferior',       level: 'apical', wall: 'inferior',      territory: 'RCA', altLeft: 'LCx' },
  { id: 16, es: 'Apical lateral',        en: 'Apical lateral',        level: 'apical', wall: 'lateral',       territory: 'LCx' },

  { id: 17, es: 'Ápex',                  en: 'Apex',                  level: 'apex',   wall: 'apex',          territory: 'LAD' },
].map((s) => ({ ...s, code: `AHA${s.id}`, source: 'C02', status: 'to-validate' }));

/** Territorio efectivo según la dominancia coronaria del paciente. */
export function territoryOf(segment, dominance = 'right') {
  if (dominance === 'left' && segment.altLeft) return segment.altLeft;
  if (dominance === 'codominant' && segment.altLeft) return 'RCA/LCx';
  return segment.territory;
}

/* ------------------------------------------------------------------
   Coronarias — modelo SCCT de 18 segmentos [L14]
   ------------------------------------------------------------------ */

export const VESSELS = {
  LAD: { es: 'Descendente anterior', en: 'Left anterior descending', abbr: 'DA' },
  LCx: { es: 'Circunfleja',          en: 'Left circumflex',          abbr: 'Cx' },
  RCA: { es: 'Coronaria derecha',    en: 'Right coronary artery',    abbr: 'CD' },
  LM:  { es: 'Tronco común izquierdo', en: 'Left main',              abbr: 'TCI' },
};

/**
 * `atRisk` = segmentos miocárdicos distales a este punto, es decir el territorio que
 * queda comprometido si la oclusión ocurre AQUÍ. Es la lectura quirúrgica: no "qué
 * riega" sino "qué se pierde". Aproximación del caso típico en dominancia derecha.
 */
export const SCCT_SEGMENTS = [
  { num: 1,  code: 'RCA-p',  es: 'CD proximal',              en: 'Proximal RCA',        vessel: 'RCA', atRisk: [3, 4, 9, 10, 15] },
  { num: 2,  code: 'RCA-m',  es: 'CD media',                 en: 'Mid RCA',             vessel: 'RCA', atRisk: [3, 4, 9, 10, 15] },
  { num: 3,  code: 'RCA-d',  es: 'CD distal',                en: 'Distal RCA',          vessel: 'RCA', atRisk: [4, 10, 15] },
  { num: 4,  code: 'R-PDA',  es: 'Descendente posterior',    en: 'R-PDA',               vessel: 'RCA', atRisk: [3, 9, 15], dominanceDependent: true },
  { num: 5,  code: 'LM',     es: 'Tronco común izquierdo',   en: 'Left main',           vessel: 'LM',  atRisk: [1, 2, 5, 6, 7, 8, 11, 12, 13, 14, 16, 17] },
  { num: 6,  code: 'LAD-p',  es: 'DA proximal',              en: 'Proximal LAD',        vessel: 'LAD', atRisk: [1, 2, 7, 8, 13, 14, 17] },
  { num: 7,  code: 'LAD-m',  es: 'DA media',                 en: 'Mid LAD',             vessel: 'LAD', atRisk: [7, 8, 13, 14, 17] },
  { num: 8,  code: 'LAD-d',  es: 'DA distal',                en: 'Distal LAD',          vessel: 'LAD', atRisk: [13, 14, 17] },
  { num: 9,  code: 'D1',     es: 'Primera diagonal',         en: 'First diagonal',      vessel: 'LAD', atRisk: [1, 7] },
  { num: 10, code: 'D2',     es: 'Segunda diagonal',         en: 'Second diagonal',     vessel: 'LAD', atRisk: [7, 12] },
  { num: 11, code: 'LCx-p',  es: 'Cx proximal',              en: 'Proximal LCx',        vessel: 'LCx', atRisk: [5, 6, 11, 12, 16] },
  { num: 12, code: 'OM1',    es: 'Primer marginal obtuso',   en: 'First obtuse marginal', vessel: 'LCx', atRisk: [6, 12] },
  { num: 13, code: 'LCx-m',  es: 'Cx media-distal',          en: 'Mid-distal LCx',      vessel: 'LCx', atRisk: [5, 11, 16] },
  { num: 14, code: 'OM2',    es: 'Segundo marginal obtuso',  en: 'Second obtuse marginal', vessel: 'LCx', atRisk: [5, 11] },
  { num: 15, code: 'L-PDA',  es: 'DP izquierda',             en: 'L-PDA',               vessel: 'LCx', atRisk: [3, 4, 9, 10, 15], dominanceDependent: true },
  { num: 16, code: 'R-PLB',  es: 'Posterolateral derecha',   en: 'R-PLB',               vessel: 'RCA', atRisk: [5, 11], dominanceDependent: true },
  { num: 17, code: 'RI',     es: 'Ramo intermedio',          en: 'Ramus intermedius',   vessel: 'LCx', atRisk: [6, 12] },
  { num: 18, code: 'L-PLB',  es: 'Posterolateral izquierda', en: 'L-PLB',               vessel: 'LCx', atRisk: [5, 11], dominanceDependent: true },
].map((v) => ({ ...v, source: 'L14', status: 'to-validate' }));

/* ------------------------------------------------------------------
   Paletas validadas con scripts/validate_palette.js del skill dataviz.
   No modificar a ojo: cualquier cambio se vuelve a validar.
   ------------------------------------------------------------------ */

export const PALETTE = {
  // Categórico — identidad de arteria. Pasa todos los pares (no sólo adyacentes)
  // bajo protanopia y deuteranopia, en modo claro y oscuro.
  territory: { LAD: '#2a78d6', RCA: '#d95f28', LCx: '#1baf7a', 'RCA/LCx': '#8B7BB8', LM: '#5A6494' },

  // Secuencial — magnitud (volumen de documentación). Un solo tono, luminosidad
  // monótona, extremo claro por encima de 2:1 contra su superficie.
  densityDark:  ['#3F4880', '#5A66A8', '#7787CB', '#98A6E2', '#BCC9F6', '#E4EBFC'],
  densityLight: ['#9BA9CE', '#8090C2', '#6676AF', '#4C5D99', '#35427E', '#1E2758'],

  // Ausencia de dato NO es magnitud baja: gris neutro fuera de la rampa cromática,
  // para que un segmento sin actividad se lea como anatomía, no como "poco".
  noDataDark: '#4A4E5E',
  noDataLight: '#B9BCC4',

  surfaceDark: '#0A0D36',
  surfaceLight: '#F4F6FC',
};

export const byId = new Map(AHA_SEGMENTS.map((s) => [s.id, s]));
export const byCode = new Map(SCCT_SEGMENTS.map((v) => [v.code, v]));

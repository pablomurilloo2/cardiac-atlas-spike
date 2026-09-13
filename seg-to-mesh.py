#!/usr/bin/env python3
"""
Convierte las segmentaciones de TotalSegmentator (NIfTI) en mallas 3D
registradas en el espacio del modelo corporal de referencia.

- Marching cubes con el espaciado real del vóxel (mm)
- Suavizado laplaciano (la anisotropía de 4.4 mm deja escalones)
- Registro: RAS(mm) -> ejes del cuerpo (x=izq, y=sup, z=ant, metros),
  escala+traslación resueltas con dos anclas (centroide lumbar y sacro)
  contra las mismas estructuras del modelo de referencia.
- Salida: media/micolumna/spine.bin + spine.json (mismo layout binario del visor)

Uso: python3 seg-to-mesh.py <dir_segmentaciones> <dir_salida>
"""
import sys, json, pathlib, struct
import numpy as np
import nibabel as nib
from skimage import measure

SEG_DIR = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
HERE = pathlib.Path(__file__).parent

ESTRUCTURAS = [
    ("vertebrae",           "Vértebras (tuyas)",        "#E4DECF", 1),
    ("intervertebral_discs","Discos intervertebrales (tuyos)", "#D97706", 1),
    ("sacrum",              "Sacro (tuyo)",             "#E4DECF", 1),
    ("spinal_cord",         "Médula / saco tecal (tuyo)","#E8D48A", 1),
    ("iliopsoas_left",      "Psoas izquierdo (tuyo)",   "#B0685F", 2),
    ("iliopsoas_right",     "Psoas derecho (tuyo)",     "#B0685F", 2),
    ("autochthon_left",     "Erectores izq. (tuyos)",   "#A05F58", 2),
    ("autochthon_right",    "Erectores der. (tuyos)",   "#A05F58", 2),
]

def ras_to_body(v_mm):
    """RAS(mm) -> ejes del cuerpo (m): x=-R, y=S, z=A"""
    out = np.empty_like(v_mm)
    out[:, 0] = -v_mm[:, 0]
    out[:, 1] = v_mm[:, 2]
    out[:, 2] = v_mm[:, 1]
    return out / 1000.0

def load_mask_mesh(path, step):
    img = nib.load(path)
    data = np.asarray(img.dataobj) > 0
    if data.sum() < 200: return None
    verts, faces, _, _ = measure.marching_cubes(
        data.astype(np.uint8), level=0.5, step_size=step)
    # vóxel -> mm en espacio del escáner vía affine
    aff = img.affine
    verts_mm = (aff[:3, :3] @ verts.T).T + aff[:3, 3]
    return verts_mm, faces

def laplacian_smooth(verts, faces, iters=6, lam=0.5):
    n = len(verts)
    neigh = [[] for _ in range(n)]
    for f in faces:
        a, b, c = f
        neigh[a] += [b, c]; neigh[b] += [a, c]; neigh[c] += [a, b]
    neigh = [np.unique(x) for x in neigh]
    v = verts.copy()
    for _ in range(iters):
        centro = np.array([v[nb].mean(axis=0) if len(nb) else v[i]
                           for i, nb in enumerate(neigh)])
        v = v + lam * (centro - v)
    return v

def centroid_of_mask(path):
    img = nib.load(path)
    data = np.asarray(img.dataobj) > 0
    idx = np.argwhere(data)
    aff = img.affine
    mm = (aff[:3, :3] @ idx.T).T + aff[:3, 3]
    return ras_to_body(mm).mean(axis=0)

# ---- anclas de referencia: centroides de lumbares y sacro en el modelo corporal ----
ref = json.loads((HERE / 'anatomy-full.json').read_text())
bin_ref = (HERE / 'anatomy-full.bin').read_bytes()
def ref_centroid(name_match):
    pts = []
    for p in ref['parts']:
        if name_match(p['name'].lower()):
            pos = np.frombuffer(bin_ref, dtype=np.float32,
                                count=p['vertexCount'] * 3, offset=p['positions']).reshape(-1, 3)
            pts.append(pos.mean(axis=0))
    return np.mean(pts, axis=0)

ref_lumbar = ref_centroid(lambda n: 'lumbar vertebra' in n and 'disk' not in n)
ref_sacro  = ref_centroid(lambda n: n == 'sacrum')

seg_lumbar = centroid_of_mask(SEG_DIR / 'vertebrae.nii.gz')
seg_sacro  = centroid_of_mask(SEG_DIR / 'sacrum.nii.gz')

escala = np.linalg.norm(ref_lumbar - ref_sacro) / max(np.linalg.norm(seg_lumbar - seg_sacro), 1e-6)
T = ref_lumbar - escala * seg_lumbar
print(f"registro: escala {escala:.3f} · traslación {np.round(T,3)}")

# ---- construir el binario en el layout del visor ----
parts, buffers, offset, total_tri = [], [], 0, 0
def push(b):
    global offset
    at = offset; buffers.append(b); offset += len(b)
    pad = (4 - offset % 4) % 4
    if pad: buffers.append(b'\x00' * pad); offset += pad
    return at

for key, nombre, color, step in ESTRUCTURAS:
    f = SEG_DIR / f'{key}.nii.gz'
    if not f.exists(): continue
    got = load_mask_mesh(f, step)
    if not got: continue
    verts_mm, faces = got
    verts_mm = laplacian_smooth(verts_mm, faces)
    v = ras_to_body(verts_mm) * escala + T          # al espacio del cuerpo

    # normales por acumulación de caras
    nrm = np.zeros_like(v)
    tri = v[faces]
    fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    for i in range(3): np.add.at(nrm, faces[:, i], fn)
    ln = np.linalg.norm(nrm, axis=1, keepdims=True); ln[ln == 0] = 1
    nrm /= ln

    pos_b = v.astype('<f4').tobytes()
    nrm_b = np.clip(nrm * 32767, -32767, 32767).astype('<i2').tobytes()
    idx_b = faces.astype('<u4').tobytes()
    pa = push(pos_b); na = push(nrm_b); ia = push(idx_b)
    parts.append({"id": key, "name": nombre, "color": color, "system": "micolumna",
                  "positions": pa, "normals": na, "indices": ia,
                  "vertexCount": len(v), "indexCount": len(faces) * 3})
    total_tri += len(faces)
    print(f"  {nombre:<36} {len(v):>7,} vért · {len(faces):>7,} tri")

(OUT / 'spine.bin').write_bytes(b''.join(buffers))
(OUT / 'spine.json').write_text(json.dumps({
    "source": "Segmentación TotalSegmentator-MR de la RM lumbar del titular (28/08/2026). Solo uso personal local.",
    "note": "Registro aproximado sobre el cuerpo de referencia (2 anclas). La forma de cada estructura proviene de la resonancia real.",
    "layout": {"positions": "float32x3", "normals": "sint16x3 normalized", "indices": "uint32"},
    "triangles": total_tri, "parts": parts}, ensure_ascii=False))
print(f"TOTAL: {total_tri:,} triángulos -> {OUT/'spine.bin'} ({offset/1e6:.1f} MB)")

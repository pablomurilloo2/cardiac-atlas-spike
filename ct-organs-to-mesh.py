"""Convierte las segmentaciones de TotalSegmentator (CT abdominal publica) en
mallas RAS mm para proyectos/04-estudio-espacial/data/organs.{bin,json}.

Uso: python3 ct-organs-to-mesh.py <dir_seg_ct>
Parte del pipeline de bootstrap del proyecto 04 (ver bootstrap.sh)."""
import sys, json, pathlib
import numpy as np
import nibabel as nib
from skimage import measure

SEG = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'seg_ct')
OUT = pathlib.Path(__file__).parent / 'proyectos/04-estudio-espacial/data'

# etiqueta japonesa (como el visor del video) + color por organo
ORGANS = [
    ('liver', 'Liver', '#C97B4A'),
    ('stomach', 'Stomach', '#E0A88A'),
    ('kidney_left', 'Left kidney', '#9E4C4C'),
    ('kidney_right', 'Right kidney', '#9E4C4C'),
    ('spleen', 'Spleen', '#7E4A6B'),
    ('pancreas', 'Pancreas', '#D9B26A'),
    ('gallbladder', 'Gallbladder', '#6B8E4A'),
    ('aorta', 'Aorta', '#C0392B'),
    ('inferior_vena_cava', 'Inferior vena cava', '#4A6BAA'),
    ('portal_vein_and_splenic_vein', 'Portal vein', '#5A7BC0'),
    ('colon', 'Colon', '#C9A46B'),
    ('small_bowel', 'Small bowel', '#D9B896'),
    ('urinary_bladder', 'Bladder', '#B0895A'),
]


def lap_smooth(v, f, it=6, lam=0.6):
    from collections import defaultdict
    nbr = defaultdict(set)
    for a, b, c in f:
        nbr[a] |= {b, c}; nbr[b] |= {a, c}; nbr[c] |= {a, b}
    idx = [np.fromiter(nbr[i], int) for i in range(len(v))]
    for _ in range(it):
        m = np.array([v[ii].mean(0) if len(ii) else v[i] for i, ii in enumerate(idx)])
        v = v + lam * (m - v)
    return v


parts, blobs, off = [], [], 0
for fn, label, color in ORGANS:
    p = SEG / f'{fn}.nii.gz'
    if not p.exists():
        print('no existe:', fn); continue
    img = nib.as_closest_canonical(nib.load(p))
    d = img.get_fdata() > 0.5
    if d.sum() < 100:
        print('vacio:', fn); continue
    v, f, _, _ = measure.marching_cubes(d.astype(np.uint8), 0.5, step_size=2)
    v = lap_smooth(v, f)
    ras = (img.affine @ np.c_[v, np.ones(len(v))].T).T[:, :3].astype(np.float32)
    tris = f.astype(np.uint32)
    parts.append({'name': label, 'organ': fn, 'color': color, 'pos': off,
                  'nv': len(ras), 'idx': off + ras.nbytes, 'ni': tris.size})
    blobs += [ras.tobytes(), tris.tobytes()]
    off += ras.nbytes + tris.nbytes
    print(fn, len(ras), 'v', tris.size // 3, 'tri')

OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'organs.bin').write_bytes(b''.join(blobs))
(OUT / 'organs.json').write_text(json.dumps({'parts': parts}, ensure_ascii=False))
print('total', off, 'bytes,', len(parts), 'organos')

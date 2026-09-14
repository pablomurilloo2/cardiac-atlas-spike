"""Estampa en cada tarjeta del hub la fecha del ultimo commit de su carpeta.

Uso: python3 gen-hub-fechas.py   (correr tras cada commit; idempotente)"""
import re, subprocess, pathlib

ROOT = pathlib.Path(__file__).parent
HUB = ROOT / 'proyectos/index.html'
s = HUB.read_text()


def last_commit(path):
    try:
        out = subprocess.run(
            ['git', 'log', '-1', '--format=%cd', '--date=format:%Y-%m-%d %H:%M', '--', path],
            capture_output=True, text=True, cwd=ROOT).stdout.strip()
        return out or None
    except Exception:
        return None


# quita estampas previas
s = re.sub(r'<span class="ts">[^<]*</span>', '', s)

def stamp(m):
    href = m.group(1)
    card = m.group(0)
    d = last_commit(f'proyectos/{href}')
    if not d:
        return card
    return card.replace('</a>', f'<span class="ts">actualizado {d}</span></a>')

s = re.sub(r'<a class="card" href="([^"]+)/">.*?</a>', stamp, s, flags=re.S)

if '.ts {' not in s:
    s = s.replace('.src { font-family:var(--mono); font-size:9.5px; color:var(--faint); margin-top:5px; display:block; }',
                  '.src { font-family:var(--mono); font-size:9.5px; color:var(--faint); margin-top:5px; display:block; }\n'
                  '  .ts { font-family:var(--mono); font-size:9px; color:#B5BCC9; margin-top:3px; display:block; }')

HUB.write_text(s)
print('fechas estampadas')

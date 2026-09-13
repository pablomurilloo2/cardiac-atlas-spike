#!/bin/bash
# Regenera los binarios de anatomía tras clonar. Requiere el repo de datos:
#   git clone --depth 1 https://github.com/ashemag/human-atlas ../human-atlas
# (BodyParts3D, CC BY 4.0 — conservar la atribución)
set -e
node extract-cardiac.mjs ../human-atlas .   # corazón + coronarias + venas + grandes vasos
node extract-body.mjs   ../human-atlas .    # sistema cardiovascular de cuerpo completo
node extract-all.mjs    ../human-atlas .    # anatomía completa (2.234 mallas)
echo "OK. Datos personales (condicion.json, media/) NO son parte del repo: son locales."
echo "Servir con: python3 serve.py  ->  http://localhost:8899"

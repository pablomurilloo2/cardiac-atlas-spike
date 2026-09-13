#!/bin/bash
# Regenera los binarios de anatomía tras clonar. Requiere el repo de datos:
#   git clone --depth 1 https://github.com/ashemag/human-atlas ../human-atlas
# (BodyParts3D, CC BY 4.0 — conservar la atribución)
set -e
node extract-cardiac.mjs ../human-atlas .   # corazón + coronarias + venas + grandes vasos
node extract-body.mjs   ../human-atlas .    # sistema cardiovascular de cuerpo completo
node extract-all.mjs    ../human-atlas .    # anatomía completa (2.234 mallas)

# human-atlas VERBATIM (proyectos/human-atlas): compilar main sin cambios y copiar sus modelos
#   (cd ../human-atlas && git worktree add ../human-atlas-main main)
#   (cd ../human-atlas-main && ln -s ../human-atlas/node_modules node_modules && npx vite build --base=./)
#   cp -r ../human-atlas-main/dist/models proyectos/human-atlas/models

# Proyecto 10 (KaloLumen): CTA-cardio de Slicer SampleData (no redistribuible) ->
#   curl -L -o CTA-cardio.nrrd https://github.com/Slicer/SlicerTestingData/releases/download/SHA256/3b0d4eb1a7d8ebb0c5a89cc0504640f76a030b4e869e33ff34c564c3d3b88ad2
#   y regenerar proyectos/10-kalolumen/data con el bloque python del historial (volume.bin + series MPR)
echo "OK. Datos personales (condicion.json, media/) NO son parte del repo: son locales."
echo "Servir con: python3 serve.py  ->  http://localhost:8899"

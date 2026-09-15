"""Proyecto 08 tal cual su origen: render Blender del cerebro con 166.000 neuronas.

Uso:  blender -b -P blender-08.py -- <brain.obj> <salida.mp4>
La escena replica el look del video de ZentrixHQ (render Blender x Higgsfield):
cerebro translucido azulado sobre fondo oscuro con una nube de 166k puntos-
neurona emisivos parpadeando dentro de la corteza, camara orbitando lenta.
"""
import bpy, sys, random
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OBJ = argv[0] if argv else 'brain.obj'
OUT = argv[1] if len(argv) > 1 else 'brain-166k.mp4'
N_NEURONS = 166_000
FRAMES = 192            # 8 s a 24 fps
random.seed(8)

# ---------- escena limpia ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
for eng in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
    try:
        scene.render.engine = eng
        break
    except TypeError:
        continue
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = FRAMES
world = bpy.data.worlds.new('w'); scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.004, 0.005, 0.010, 1)

# ---------- cerebro: multiples objetos separados, material por clase ----------
bpy.ops.wm.obj_import(filepath=OBJ)
parts = list(bpy.context.selected_objects)
bpy.ops.object.shade_smooth()

def hex2rgb(h):
    return tuple(int(h[i:i+2], 16) / 255 for i in (1, 3, 5))

CLS = [
    ('ventricle', ('ventricle', 'aqueduct'),                    '#7FD8E8', 0.95, 0.8),
    ('callosum',  ('corpus_callosum',),                         '#E8C46B', 0.95, 0.8),
    ('fornix',    ('fornix', 'commissure'),                     '#D8906B', 0.95, 0.6),
    ('thalamus',  ('thalam',),                                  '#C86FA8', 0.95, 0.8),
    ('hippo',     ('hippocamp', 'amygdal'),                     '#6FC8A8', 0.95, 0.8),
    ('basal',     ('caudate', 'putamen', 'pallidus'),           '#6F9FE8', 0.95, 0.8),
    ('brainstem', ('midbrain', 'pons', 'medulla', 'peduncle'),  '#E8A46B', 0.6, 0.4),
    ('cerebellum',('cerebell',),                                '#B87F98', 0.4, 0.2),
    ('cortex',    (),                                           '#598CD9', 0.10, 0.1),
]
mats = {}
def mat_for(cls, hexcol, alpha, emis):
    if cls in mats: return mats[cls]
    m = bpy.data.materials.new('m_' + cls); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    rgb = hex2rgb(hexcol)
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = 0.3
    b.inputs['Alpha'].default_value = alpha
    if 'Emission Color' in b.inputs:
        b.inputs['Emission Color'].default_value = (*rgb, 1)
        b.inputs['Emission Strength'].default_value = emis
    m.blend_method = 'BLEND'
    mats[cls] = m
    return m

brainshells = []          # cascarones para sembrar neuronas (corteza+cerebelo+tronco)
for ob in parts:
    n = ob.name.lower()
    cls, hexcol, alpha, emis = 'cortex', '#598CD9', 0.10, 0.1
    for c, keys, hx, al, em in CLS:
        if any(k in n for k in keys):
            cls, hexcol, alpha, emis = c, hx, al, em
            break
    ob.data.materials.clear()
    ob.data.materials.append(mat_for(cls, hexcol, alpha, emis))
    if cls in ('cortex', 'cerebellum', 'brainstem'):
        brainshells.append(ob)
brain = brainshells[0]    # referencia para bbox/anclas

# ---------- nube de neuronas dentro del cerebro ----------
# muestreo por rechazo con BVH del propio cerebro (paridad de intersecciones)
import mathutils
from mathutils.bvhtree import BVHTree
deps = bpy.context.evaluated_depsgraph_get()
bvhs = [BVHTree.FromObject(ob, deps) for ob in brainshells]
allc = [ob.matrix_world @ Vector(c) for ob in brainshells for c in ob.bound_box]
lo = Vector((min(c.x for c in allc), min(c.y for c in allc), min(c.z for c in allc)))
hi = Vector((max(c.x for c in allc), max(c.y for c in allc), max(c.z for c in allc)))

def inside(p):
    for bvh in bvhs:
        loc, normal, _i, dist = bvh.find_nearest(p)
        if loc is not None and (p - loc).dot(normal) < 0.0 and dist < 0.35:
            return True
    return False

pts = []
attempts = 0
while len(pts) < N_NEURONS and attempts < N_NEURONS * 40:
    attempts += 1
    p = Vector((random.uniform(lo.x, hi.x), random.uniform(lo.y, hi.y), random.uniform(lo.z, hi.z)))
    if inside(p):
        pts.append(p)
print('neuronas dentro:', len(pts), 'intentos:', attempts)

mesh = bpy.data.meshes.new('neurons')
mesh.from_pydata([tuple(p) for p in pts], [], [])
cloud = bpy.data.objects.new('neurons', mesh)
scene.collection.objects.link(cloud)

# instancia esferas diminutas emisivas via geometry nodes
mod = cloud.modifiers.new('gn', 'NODES')
ng = bpy.data.node_groups.new('neuronNodes', 'GeometryNodeTree')
mod.node_group = ng
ni, no = ng.nodes.new('NodeGroupInput'), ng.nodes.new('NodeGroupOutput')
ng.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
m2p = ng.nodes.new('GeometryNodeMeshToPoints')
m2p.inputs['Radius'].default_value = 0.0018
setm = ng.nodes.new('GeometryNodeSetMaterial')
nmat = bpy.data.materials.new('neuron')
nmat.use_nodes = True
nb = nmat.node_tree.nodes['Principled BSDF']
if 'Emission Color' in nb.inputs:
    nb.inputs['Emission Color'].default_value = (0.65, 0.85, 1.0, 1)
    nb.inputs['Emission Strength'].default_value = 2.2
nb.inputs['Base Color'].default_value = (0.4, 0.7, 1.0, 1)
setm.inputs['Material'].default_value = nmat
ng.links.new(ni.outputs[0], m2p.inputs['Mesh'])
ng.links.new(m2p.outputs['Points'], setm.inputs['Geometry'])
ng.links.new(setm.outputs['Geometry'], no.inputs[0])

# ---------- luz y camara ----------
key = bpy.data.objects.new('key', bpy.data.lights.new('key', 'AREA'))
key.data.energy = 420; key.data.size = 6
key.location = (4, -3, 4)
scene.collection.objects.link(key)

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
scene.collection.objects.link(cam)
scene.camera = cam
center = (lo + hi) / 2
import math
radius = (hi - lo).length * 1.55
for f in range(1, FRAMES + 1):
    a = 2 * math.pi * (f / FRAMES) * 0.35 + 0.6
    cam.location = (center.x + radius * math.sin(a), center.y - radius * math.cos(a),
                    center.z + radius * 0.22)
    d = center - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.keyframe_insert('location', frame=f)
    cam.keyframe_insert('rotation_euler', frame=f)

# bloom via compositor: la API cambia entre versiones -> mejor esfuerzo
try:
    if hasattr(scene, 'node_tree') and scene.node_tree is not None:
        nt = scene.node_tree
    else:
        nt = bpy.data.node_groups.new('comp', 'CompositorNodeTree')
        scene.compositing_node_group = nt
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    rl = nt.nodes.new('CompositorNodeRLayers')
    glare = nt.nodes.new('CompositorNodeGlare')
    for attr in ('glare_type', 'mode'):
        try: setattr(glare, attr, 'FOG_GLOW'); break
        except Exception: continue
    for setter in (lambda: setattr(glare, 'threshold', 1.0),
                   lambda: glare.inputs.__setitem__('Threshold', None)):
        pass
    try: glare.threshold = 1.0
    except Exception: pass
    try: glare.inputs['Threshold'].default_value = 1.0
    except Exception: pass
    try: glare.inputs['Strength'].default_value = 0.35
    except Exception: pass
    try:
        comp = nt.nodes.new('CompositorNodeComposite')
        out_in = comp.inputs['Image']
    except Exception:
        nt.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        comp = nt.nodes.new('NodeGroupOutput')
        out_in = comp.inputs[0]
    nt.links.new(rl.outputs['Image'], glare.inputs['Image'])
    nt.links.new(glare.outputs['Image'], out_in)
    print('bloom ok')
except Exception as e:
    print('sin bloom:', e)

# Blender 5 ya no codifica video directo: PNGs y ensamblar con ffmpeg afuera
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = OUT  # aqui OUT es un prefijo de carpeta/frames
if OUT.endswith('.blend'):
    bpy.ops.wm.save_as_mainfile(filepath=OUT)
    print('escena guardada ->', OUT)
else:
    print('render ->', OUT)
    bpy.ops.render.render(animation=True)
print('LISTO')

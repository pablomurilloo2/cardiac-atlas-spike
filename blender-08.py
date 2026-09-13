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
scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') else 'BLENDER_EEVEE'
try:
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
except Exception:
    scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = FRAMES
world = bpy.data.worlds.new('w'); scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.004, 0.005, 0.010, 1)

# ---------- cerebro ----------
bpy.ops.wm.obj_import(filepath=OBJ)
brain = bpy.context.selected_objects[0]
brain.name = 'brain'
bpy.ops.object.shade_smooth()
mat = bpy.data.materials.new('brainGlass')
mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value = (0.35, 0.55, 0.85, 1)
bsdf.inputs['Roughness'].default_value = 0.25
bsdf.inputs['Transmission Weight'].default_value = 0.0
bsdf.inputs['Alpha'].default_value = 0.16
if 'Emission Color' in bsdf.inputs:
    bsdf.inputs['Emission Color'].default_value = (0.10, 0.22, 0.45, 1)
    bsdf.inputs['Emission Strength'].default_value = 0.25
mat.blend_method = 'BLEND'
brain.data.materials.clear()
brain.data.materials.append(mat)

# ---------- nube de neuronas dentro del cerebro ----------
# muestreo por rechazo con BVH del propio cerebro (paridad de intersecciones)
import mathutils
from mathutils.bvhtree import BVHTree
deps = bpy.context.evaluated_depsgraph_get()
bvh = BVHTree.FromObject(brain, deps)
bb = [brain.matrix_world @ Vector(c) for c in brain.bound_box]
lo = Vector((min(c.x for c in bb), min(c.y for c in bb), min(c.z for c in bb)))
hi = Vector((max(c.x for c in bb), max(c.y for c in bb), max(c.z for c in bb)))

def inside(p):
    # punto mas cercano + signo de la normal: rapido y suficiente por cascaron
    loc, normal, _i, dist = bvh.find_nearest(p)
    if loc is None:
        return False
    return (p - loc).dot(normal) < 0.0

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
m2p.inputs['Radius'].default_value = 0.0035
setm = ng.nodes.new('GeometryNodeSetMaterial')
nmat = bpy.data.materials.new('neuron')
nmat.use_nodes = True
nb = nmat.node_tree.nodes['Principled BSDF']
if 'Emission Color' in nb.inputs:
    nb.inputs['Emission Color'].default_value = (0.65, 0.85, 1.0, 1)
    nb.inputs['Emission Strength'].default_value = 14.0
nb.inputs['Base Color'].default_value = (0.4, 0.7, 1.0, 1)
setm.inputs['Material'].default_value = nmat
ng.links.new(ni.outputs[0], m2p.inputs['Mesh'])
ng.links.new(m2p.outputs['Points'], setm.inputs['Geometry'])
ng.links.new(setm.outputs['Geometry'], no.inputs[0])

# ---------- luz y camara ----------
key = bpy.data.objects.new('key', bpy.data.lights.new('key', 'AREA'))
key.data.energy = 900; key.data.size = 6
key.location = (4, -3, 4)
scene.collection.objects.link(key)

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
scene.collection.objects.link(cam)
scene.camera = cam
center = (lo + hi) / 2
import math
radius = (hi - lo).length * 0.9
for f in range(1, FRAMES + 1):
    a = 2 * math.pi * (f / FRAMES) * 0.35 + 0.6
    cam.location = (center.x + radius * math.sin(a), center.y - radius * math.cos(a),
                    center.z + radius * 0.22)
    d = center - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam.keyframe_insert('location', frame=f)
    cam.keyframe_insert('rotation_euler', frame=f)

# bloom (Eevee Next: compositor glare)
scene.use_nodes = True
nt = scene.node_tree
for n in list(nt.nodes): nt.nodes.remove(n)
rl = nt.nodes.new('CompositorNodeRLayers')
glare = nt.nodes.new('CompositorNodeGlare')
glare.glare_type = 'FOG_GLOW'; glare.threshold = 0.6
comp = nt.nodes.new('CompositorNodeComposite')
nt.links.new(rl.outputs['Image'], glare.inputs['Image'])
nt.links.new(glare.outputs['Image'], comp.inputs['Image'])

scene.render.image_settings.file_format = 'FFMPEG'
scene.render.ffmpeg.format = 'MPEG4'
scene.render.ffmpeg.codec = 'H264'
scene.render.ffmpeg.constant_rate_factor = 'MEDIUM'
scene.render.filepath = OUT
print('render ->', OUT)
bpy.ops.render.render(animation=True)
print('LISTO')

"""Build the packed Blender source and the corresponding game GLB."""

import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from guppy_profile import (  # noqa: E402
    ANAL_EDGE, ANAL_ROOT, BODY, DORSAL_EDGE, DORSAL_ROOT, EYE_RADIUS, EYE_X,
    EYE_Y, FIN_CROPS, ORIGIN_X, ORIGIN_Y, PIXELS_PER_UNIT, TAIL_EDGE, TAIL_ROOT,
    VENTRAL_EDGE, VENTRAL_ROOT, sample_profile,
)


# Centers and pivots are listed from the stiff head to the soft trailing fin.
SPINE = (
    ("Head", .41, .41), ("Body", -.02, .22), ("Peduncle", -.59, -.38),
    ("TailBase", -.98, -.84), ("TailMid", -1.53, -1.29),
    ("TailEdge", -2.20, -1.87),
)


def position(x, y, z):
    return ((x - ORIGIN_X) / PIXELS_PER_UNIT, y, (ORIGIN_Y - z) / PIXELS_PER_UNIT)


def profile_width(x, z):
    top, bottom, width = sample_profile(BODY, x)
    height = bottom - top
    offset = (2 * z - top - bottom) / height
    return width * math.sqrt(max(0, 1 - offset * offset)) / PIXELS_PER_UNIT


def texture(nodes, name, label, noncolor=False):
    path = ROOT / "textures" / (name + ".png")
    image = bpy.data.images.load(str(path), check_existing=True)
    image.colorspace_settings.name = "Non-Color" if noncolor else "sRGB"
    image.pack()
    image.filepath = "//textures/" + path.name
    node = nodes.new("ShaderNodeTexImage")
    node.image = image
    node.label = label
    node.extension = "EXTEND"
    return node


def set_tail_reflections(nodes, links, shader):
    # Decode the packed glTF tangent (RG) and strength (B) in Blender too.
    rays = texture(nodes, "tail-anisotropy", "Directional highlight along fin rays", noncolor=True)
    rays.location = (-1150, -725)
    decode = nodes.new("ShaderNodeVectorMath")
    decode.operation = "MULTIPLY_ADD"
    decode.inputs[1].default_value = (2, 2, 1)
    decode.inputs[2].default_value = (-1, -1, 0)
    separate = nodes.new("ShaderNodeSeparateXYZ")
    links.new(rays.outputs["Color"], decode.inputs[0])
    links.new(decode.outputs["Vector"], separate.inputs[0])
    decode.location = (-895, -725)
    separate.location = (-700, -725)

    def math_node(operation, x, y):
        node = nodes.new("ShaderNodeMath")
        node.operation = operation
        node.location = (x, y)
        return node

    angle = math_node("ARCTAN2", -530, -630)
    offset = math_node("ADD", -350, -630)
    rotation = math_node("DIVIDE", -170, -630)
    strength = math_node("MULTIPLY", -350, -860)
    rotation.inputs[1].default_value = math.tau
    offset.inputs[1].default_value = 0
    strength.inputs[1].default_value = .56
    links.new(separate.outputs["Y"], angle.inputs[0])
    links.new(separate.outputs["X"], angle.inputs[1])
    links.new(angle.outputs[0], offset.inputs[0])
    links.new(offset.outputs[0], rotation.inputs[0])
    links.new(separate.outputs["Z"], strength.inputs[0])
    links.new(rotation.outputs[0], shader.inputs["Anisotropic Rotation"])
    links.new(strength.outputs[0], shader.inputs["Anisotropic"])
    tangent = nodes.new("ShaderNodeTangent")
    tangent.direction_type = "UV_MAP"
    tangent.uv_map = "Surface UV"
    tangent.location = (-170, -860)
    links.new(tangent.outputs["Tangent"], shader.inputs["Tangent"])


def material(name, maps, *, metallic=0, roughness=.44, normal_strength=0, alpha=False, coat=0, film=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = not alpha
    if alpha:
        mat.surface_render_method = "BLENDED"
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.location = (180, 180)
    nodes.get("Material Output").location = (515, 180)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Coat Weight"].default_value = coat
    shader.inputs["Coat Roughness"].default_value = .34
    if film:
        shader.inputs["Thin Film Thickness"].default_value = 218
        shader.inputs["Thin Film IOR"].default_value = 1.37
        settings = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        settings.interface.new_socket(name="Iridescence Factor", in_out="INPUT", socket_type="NodeSocketFloat")
        settings.interface.new_socket(name="Iridescence Thickness Minimum", in_out="INPUT", socket_type="NodeSocketFloat")
        gltf = nodes.new("ShaderNodeGroup")
        gltf.node_tree = settings
        gltf.location = (180, -360)
        gltf.inputs["Iridescence Factor"].default_value = film
        gltf.inputs["Iridescence Thickness Minimum"].default_value = 218

    base = texture(nodes, maps + "-base-color", "Pigment and fin opacity" if alpha else "Pigment")
    base.location = (-600, 320)
    links.new(base.outputs["Color"], shader.inputs["Base Color"])
    if alpha:
        links.new(base.outputs["Alpha"], shader.inputs["Alpha"])

    if (ROOT / "textures" / (maps + "-roughness.png")).is_file():
        rough = texture(nodes, maps + "-roughness", "Roughness", noncolor=True)
        rough.location = (-600, -20)
        links.new(rough.outputs["Color"], shader.inputs["Roughness"])
    if normal_strength:
        detail = texture(nodes, maps + "-normal", "Surface relief", noncolor=True)
        detail.location = (-600, -360)
        normal = nodes.new("ShaderNodeNormalMap")
        normal.location = (-235, -260)
        normal.inputs["Strength"].default_value = normal_strength
        links.new(detail.outputs["Color"], normal.inputs["Color"])
        links.new(normal.outputs["Normal"], shader.inputs["Normal"])
    if maps == "tail":
        set_tail_reflections(nodes, links, shader)
    return mat


def mesh(name, vertices, faces, uv, mat, *, wrap_v=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(mat)
    layer = data.uv_layers.new(name="Surface UV")
    for polygon in data.polygons:
        polygon.use_smooth = True
        values = [uv[index][1] for index in polygon.vertices]
        crosses_seam = wrap_v and max(values) - min(values) > .75
        for loop, vertex in zip(polygon.loop_indices, polygon.vertices):
            u, v = uv[vertex]
            layer.uv[loop].vector = (u, 0 if crosses_seam and v == 1 else v)
    return obj


def body_mesh(mat):
    vertices, uv, faces = [], [], []
    length_segments, cross_segments = 100, 56
    for i in range(length_segments + 1):
        u = i / length_segments
        x = BODY[0][0] + (BODY[-1][0] - BODY[0][0]) * u
        top, bottom, width = sample_profile(BODY, x)
        for j in range(cross_segments):
            turn = j / cross_segments
            angle = math.tau * turn
            z = (top + bottom - (bottom - top) * math.cos(angle)) / 2
            y = max(.10, width) * math.sin(angle) / PIXELS_PER_UNIT
            vertices.append(position(x, y, z))
            uv.append((u, 1 - turn))
    for i in range(length_segments):
        for j in range(cross_segments):
            a = i * cross_segments
            k = (j + 1) % cross_segments
            faces.append((a + j, a + j + cross_segments, a + k + cross_segments, a + k))
    for i, x in ((0, BODY[0][0]), (length_segments, BODY[-1][0])):
        top, bottom, _ = sample_profile(BODY, x)
        center = len(vertices)
        vertices.append(position(x, 0, (top + bottom) / 2))
        u = i / length_segments
        uv.append((u + (.001 if i == 0 else -.001), .5))
        ring = i * cross_segments
        for j in range(cross_segments):
            a, b = ring + j, ring + (j + 1) % cross_segments
            faces.append((center, a, b) if i == 0 else (center, b, a))
    return mesh("Scales and gill plates", vertices, faces, uv, mat, wrap_v=True)


def smoothstep(lo, hi, value):
    u = max(0, min(1, (value - lo) / (hi - lo)))
    return u * u * (3 - 2 * u)


def add_fin_flex(obj, samples, root, tip_flex, axis, *, fan=False):
    obj.shape_key_add(name="Basis")
    bend = obj.shape_key_add(name="Flex")
    wave_a = obj.shape_key_add(name="WaveA")
    wave_b = obj.shape_key_add(name="WaveB")
    gather = obj.shape_key_add(name="Gather") if fan else None
    for shape in (bend, wave_a, wave_b):
        shape.slider_min = -1
        shape.slider_max = 1

    for i, (radius, across, free) in enumerate(samples):
        base = obj.data.vertices[i].co
        span = free * radius ** 1.8
        # The two wave shapes are a quarter cycle apart. Combining them moves
        # the crease out along the rays while the root stays in place.
        phase = math.tau * (.67 * radius - .15 * (across - .5))
        lobe = 1 + .19 * (2 * across - 1)
        displacement = axis * (tip_flex * span)
        bend.data[i].co = base + displacement * lobe
        wave_a.data[i].co = base + displacement * (.60 * math.cos(phase))
        wave_b.data[i].co = base + displacement * (.60 * math.sin(phase))
        if gather:
            offset = base - root
            # Tension draws the outer rays inward without moving the peduncle.
            gather.data[i].co = base + Vector((-.050 * offset.x, 0, -.105 * offset.z)) * span


def membrane_clearance(maps, x, z):
    if maps == "tail":
        return 1 - smoothstep(469, 621, x)
    top, bottom, _ = sample_profile(BODY, x)
    edge = top - z if maps == "dorsal" else z - bottom
    return smoothstep(1, 48 if maps == "dorsal" else 29, edge)


def fin_mesh(name, maps, root, outline, mat, *, side=0, layers=16, cup=.035):
    # Include the measured outline knots, and smooth the curves between them.
    edge = [(0, *outline[0])]
    for old, new in zip(outline, outline[1:]):
        edge.append((edge[-1][0] + math.dist(old, new), *new))
    perimeter = [outline[0]]
    for (start, *_), (stop, *_) in zip(edge, edge[1:]):
        for part in range(1, 4):
            perimeter.append(sample_profile(edge, start + (stop - start) * part / 3))
    row_length = len(perimeter)
    x0, y0, x1, y1 = FIN_CROPS[maps]

    def fin_uv(x, z):
        return ((x - x0 + .5) / (x1 - x0), 1 - (z - y0 + .5) / (y1 - y0))

    vertices = [position(root[0], side, root[1])]
    uv = [fin_uv(*root)]
    samples = [(0, .5, 0)]
    faces = []
    for row in range(1, layers + 1):
        radius = row / layers
        for j, (edge_x, edge_z) in enumerate(perimeter):
            arc = j / (row_length - 1)
            x = root[0] + (edge_x - root[0]) * radius
            z = root[1] + (edge_z - root[1]) * radius
            ripple = .15 * math.sin(arc * 8 * math.pi + radius * 1.2)
            camber = cup * (math.sin(arc * 2.7 * math.pi) + ripple) * radius**1.65
            vertices.append(position(x, side + camber, z))
            uv.append(fin_uv(x, z))
            samples.append((radius, arc, membrane_clearance(maps, x, z)))
    for j in range(row_length - 1):
        faces.append((0, j + 1, j + 2))
    for row in range(layers - 1):
        for j in range(row_length - 1):
            a = 1 + row * row_length + j
            faces.append((a, a + row_length, a + row_length + 1, a + 1))
    obj = mesh(name, vertices, faces, uv, mat)
    tip_flex = {"tail": .29, "dorsal": .117, "anal": .079, "ventral": .088}[maps]
    add_fin_flex(obj, samples, Vector(vertices[0]), tip_flex, Vector((0, 1, 0)), fan=maps == "tail")
    return obj


def pectoral_root(side):
    x, z = 1202, 592
    return Vector(position(x, side * (profile_width(x, z) - .013), z))


def pectoral_mesh(side, mat):
    vertices, uv, faces = [], [], []
    samples = []
    root = pectoral_root(side)
    length_segments, ray_segments = 18, 16
    for i in range(length_segments + 1):
        u = i / length_segments
        for j in range(ray_segments + 1):
            v = j / ray_segments
            across = 2 * v - 1
            taper = .010 + .045 * math.sin(math.pi * u ** .66)
            x = -.29 * u + .058 * across**2 * u
            y = side * (.115 * u + .028 * (1 - across**2) * u)
            z = -.067 * u + across * taper
            vertices.append(root + Vector((x, y, z)))
            uv.append((u, 1 - v))
            samples.append((u, v, 1))
    for i in range(length_segments):
        for j in range(ray_segments):
            a = i * (ray_segments + 1) + j
            b = a + ray_segments + 1
            faces.append((a, b, b + 1, a + 1))
    obj = mesh("Pectoral membrane " + ("L" if side < 0 else "R"), vertices, faces, uv, mat)
    add_fin_flex(obj, samples, root, .082, Vector((0, side * .28, .96)))
    return obj


def eye_mesh(side, mat):
    vertices, uv, faces = [], [], []
    segments, rings = 56, 12

    def add_point(radius, angle):
        u, v = radius * math.cos(angle), radius * math.sin(angle)
        x = EYE_X + EYE_RADIUS * u
        z = EYE_Y - EYE_RADIUS * v
        bulge = .020 * max(0, 1 - radius * radius) ** .65
        y = side * (profile_width(x, z) + bulge + .002)
        vertices.append(position(x, y, z))
        uv.append((.5 + .5 * u, .5 + .5 * v))

    add_point(0, 0)
    for i in range(1, rings + 1):
        for j in range(segments):
            add_point(i / rings, math.tau * j / segments)
    for j in range(segments):
        faces.append((0, 1 + j, 1 + (j + 1) % segments))
    for i in range(rings - 1):
        for j in range(segments):
            a = 1 + i * segments
            k = (j + 1) % segments
            faces.append((a + j, a + j + segments, a + k + segments, a + k))
    if side > 0:
        faces = [tuple(reversed(face)) for face in faces]
    return mesh("Cornea " + ("L" if side < 0 else "R"), vertices, faces, uv, mat)


def armature():
    data = bpy.data.armatures.new("Blue guppy skeleton")
    rig = bpy.data.objects.new("GuppyRig", data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    rig.show_in_front = True
    with bpy.context.temp_override(object=rig, active_object=rig):
        bpy.ops.object.mode_set(mode="EDIT")
        previous = None
        for name, _, x in SPINE:
            bone = data.edit_bones.new(name)
            bone.head = (x, 0, 0)
            bone.tail = (x - .27, 0, 0)
            bone.align_roll(Vector((0, 0, 1)))
            bone.parent = previous
            previous = bone
        for side, name in ((-1, "Pectoral_L"), (1, "Pectoral_R")):
            bone = data.edit_bones.new(name)
            bone.head = pectoral_root(side)
            bone.tail = bone.head + Vector((-.27, .12 * side, -.067))
            bone.align_roll(Vector((0, 0, 1)))
            bone.parent = data.edit_bones["Head"]
        bpy.ops.object.mode_set(mode="OBJECT")
    return rig


def spine_weights(x):
    if x >= SPINE[0][1]:
        return ((SPINE[0][0], 1),)
    for (head_name, head_x, _), (tail_name, tail_x, _) in zip(SPINE, SPINE[1:]):
        if x >= tail_x:
            t = (head_x - x) / (head_x - tail_x)
            t = t * t * (3 - 2 * t)
            return ((head_name, 1 - t), (tail_name, t))
    return ((SPINE[-1][0], 1),)


def bind(obj, rig, fixed_bone=None):
    group = {bone.name: obj.vertex_groups.new(name=bone.name) for bone in rig.data.bones}
    for vertex in obj.data.vertices:
        weights = ((fixed_bone, 1),) if fixed_bone else spine_weights(vertex.co.x)
        for name, weight in weights:
            if weight > 0:
                group[name].add([vertex.index], weight, "REPLACE")
    obj.parent = rig
    modifier = obj.modifiers.new("Swim deformation", "ARMATURE")
    modifier.object = rig


def setup_studio(scene):
    collection = bpy.data.collections.new("Material inspection")
    scene.collection.children.link(collection)

    def aim(obj, target=(-.5, 0, 0)):
        obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

    for name, location, size, power, color in (
        ("Soft overhead", (-.3, -3.2, 3.2), 4.1, 280, (.94, .98, 1)),
        ("Front fill", (1.7, -4.3, -.6), 3.2, 125, (.84, .93, 1)),
        ("Fin backlight", (-1.6, 2.6, 1.8), 2.7, 155, (.76, .89, 1)),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.size, data.energy, data.color = size, power, color
        obj = bpy.data.objects.new(name, data)
        collection.objects.link(obj)
        obj.location = location
        aim(obj)

    camera = bpy.data.objects.new("Side profile", bpy.data.cameras.new("Side profile"))
    collection.objects.link(camera)
    camera.location = (-.69, -6.5, .06)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 3.70
    aim(camera, (-.69, 0, .06))
    scene.camera = camera
    scene.world = bpy.data.worlds.new("Dark slate")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes.get("Background").inputs["Color"].default_value = (.035, .060, .083, 1)
    scene.world.node_tree.nodes.get("Background").inputs["Strength"].default_value = .42
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1600, 1200
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "Khronos PBR Neutral"
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_perspective = "CAMERA"
                area.spaces.active.shading.color_type = "MATERIAL"
                area.spaces.active.overlay.show_overlays = False


def build():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.outliner.orphans_purge(do_recursive=True)
    rig = armature()
    skin = material("Blue flank · scales", "body", metallic=.11, normal_strength=.69, coat=.18, film=.28)
    glass = material("Cornea · silver iris", "eye", roughness=.24, coat=.17)
    body = body_mesh(skin)
    bind(body, rig)
    for name, label, root, edge, layers, cup in (
        ("tail", "Caudal fan", TAIL_ROOT, TAIL_EDGE, 22, .044),
        ("dorsal", "Dorsal sail", DORSAL_ROOT, DORSAL_EDGE, 15, .021),
        ("anal", "Anal fin", ANAL_ROOT, ANAL_EDGE, 10, .009),
        ("ventral", "Pelvic fin", VENTRAL_ROOT, VENTRAL_EDGE, 10, .018),
    ):
        membrane = material(label + " · membrane", name, metallic=.035, normal_strength=.49, alpha=True)
        sides = (-.023, .023) if name == "ventral" else (0,)
        for i, side in enumerate(sides):
            label_side = (" L" if i == 0 else " R") if side else ""
            obj = fin_mesh(label + label_side, name, root, edge, membrane, side=side, layers=layers, cup=cup)
            bind(obj, rig)

    pectoral = material("Pectoral · translucent rays", "pectoral", roughness=.49, normal_strength=.42, alpha=True)
    for side, name in ((-1, "Pectoral_L"), (1, "Pectoral_R")):
        bind(pectoral_mesh(side, pectoral), rig, name)
        bind(eye_mesh(side, glass), rig, "Head")

    setup_studio(bpy.context.scene)
    bpy.context.preferences.filepaths.save_version = 0
    rig.select_set(False)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "blue-guppy.blend"), compress=True)
    for obj in (rig, *rig.children):
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(ROOT / "blue-guppy.glb"), export_format="GLB", use_selection=True,
        export_texcoords=True, export_normals=True, export_tangents=True,
        export_morph=True, export_morph_normal=True, export_morph_tangent=True,
        export_animations=False, export_yup=True, export_armature_object_remove=True,
    )


if __name__ == "__main__":
    build()

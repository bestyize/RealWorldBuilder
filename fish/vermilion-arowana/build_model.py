"""Build the Vermilion Arowana in Blender from its traced reference views."""

import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from materials import create_materials


SCALE = 0.0017
ORIGIN = (995, 340)
IMAGE_SIZE = (1983, 793)
# Side contour measured at the back, belly, and lower jaw of the reference.
BODY = np.array([
    (388, 303, 426, .65), (396, 300, 427, .9), (410, 297, 428, 4.7),
    (426, 292, 432, 12.3), (449, 290, 436, 23), (480, 279, 455, 39),
    (520, 234, 498, 51), (580, 172, 559, 64), (650, 131, 606, 79),
    (740, 102, 652, 93), (800, 96, 663, 100), (900, 97, 658, 104),
    (944, 97.6, 650, 104.6), (975, 98, 629, 105), (1007, 98.6, 618, 105.5),
    (1050, 99, 614, 106), (1200, 97, 592, 104), (1294, 98.1, 578, 102),
    (1370, 100, 562, 100), (1480, 106, 525, 93), (1575, 113, 485, 86),
    (1660, 124, 453, 75), (1730, 132, 407, 63), (1790, 136, 357, 55),
    (1830, 138, 309, 44), (1872, 146, 243, 32), (1900, 156, 191, 18),
    (1912, 168, 176, 3.2),
])
BODY_RANGE = tuple(BODY[[0, -1], 0])
CHAIN = (
    ("Head", 1710), ("Shoulder", 1470), ("SpineA", 1190), ("SpineB", 870),
    ("Peduncle", 555), ("Tail", 420), ("TailTip", 226),
)
DORSAL_RANGE = (444, 787)
DORSAL = [
    (445, 290), (401, 285), (352, 267), (312, 223), (289, 178),
    (289, 132), (326, 95), (378, 61), (443, 40), (514, 28),
    (586, 23), (655, 38), (721, 66), (783, 103),
]
ANAL_RANGE = (441, 986)
ANAL_ATLAS = [
    (442, 432), (402, 460), (367, 503), (339, 550), (352, 597),
    (399, 649), (467, 692), (555, 733), (650, 762), (728, 774),
    (799, 761), (852, 728), (905, 662), (952, 596), (984, 565),
]
CAUDAL = [
    (420, 292), (357, 274), (284, 228), (213, 195), (151, 177),
    (104, 184), (62, 201), (36, 237), (22, 279), (21, 332),
    (28, 389), (39, 454), (61, 510), (96, 566), (130, 597),
    (172, 622), (219, 621), (270, 606), (310, 588), (354, 553),
    (394, 493), (431, 428),
]
# The photo contours use the same projected scale as the body calibration.
CAUDAL_PROFILE = [
    (420, 292), (342, 256), (267, 220), (197, 192), (117, 179),
    (66, 189), (21, 212), (8, 254), (-15, 294), (7, 329),
    (4, 370), (20, 414), (32, 452), (38, 501), (60, 540),
    (65, 579), (86, 608), (90, 632), (113, 653), (155, 643),
    (209, 640), (290, 631), (329, 613), (355, 578), (372, 543),
    (431, 428),
]
ANAL_PROFILE = [
    (442, 432), (402, 460), (340, 591), (378, 647), (415, 685),
    (454, 711), (530, 766), (610, 797), (662, 815), (732, 817),
    (818, 799), (865, 770), (911, 715), (947, 653), (966, 604),
    (984, 565),
]
PAIRED_FINS = (
    ("Pectoral", "Shoulder", [(1600, 418), (1536, 464), (1451, 516), (1360, 607), (1279, 697), (1211, 738)],
     [(1642, 410), (1601, 499), (1530, 579), (1436, 651), (1325, 704), (1214, 737)],
     86),
    ("Pelvic", "SpineA", [(1171, 527), (1124, 549), (1074, 591), (1038, 638), (987, 668)],
     [(1224, 521), (1187, 566), (1126, 611), (1062, 646), (990, 667)],
     54),
)


def interpolate(domain, values, sample):
    """Piecewise cubic interpolation through the measured guide points."""
    sample = np.asarray(sample, dtype=float)
    index = np.clip(np.searchsorted(domain, sample, side="right") - 1, 0, len(domain) - 2)
    delta = domain[index + 1] - domain[index]
    t = np.clip((sample - domain[index]) / delta, 0, 1)[..., None]
    stride = delta[..., None]
    slopes = np.gradient(values, domain, axis=0)
    return (
        (2 * t**3 - 3 * t**2 + 1) * values[index]
        + (t**3 - 2 * t**2 + t) * stride * slopes[index]
        + (-2 * t**3 + 3 * t**2) * values[index + 1]
        + (t**3 - t**2) * stride * slopes[index + 1]
    )


def body_profile(x):
    return interpolate(BODY[:, 0], BODY[:, 1:], x)


def trace(points, samples):
    points = np.array(points, dtype=float)
    distance = np.concatenate(([0], np.cumsum(np.linalg.norm(np.diff(points, axis=0), axis=1))))
    return interpolate(distance, points, samples * distance[-1])


def position(px, py, depth=0):
    return ((px - ORIGIN[0]) * SCALE, depth * SCALE, (ORIGIN[1] - py) * SCALE)


def depth_at(px, py):
    top, bottom, half_width = body_profile(px)
    h = np.clip(2 * (py - top) / (bottom - top) - 1, -1, 1)
    return half_width * math.sqrt(1 - h * h)


def projected_uv(px, py):
    return (px / (IMAGE_SIZE[0] - 1), 1 - py / (IMAGE_SIZE[1] - 1))


def mesh(name, vertices, faces, material, vertex_uv=None, wrap_dorsal=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    data.materials.append(material)
    for polygon in data.polygons:
        polygon.use_smooth = True
    if vertex_uv is not None:
        layer = data.uv_layers.new(name="UVMap")
        for polygon in data.polygons:
            values = [vertex_uv[index] for index in polygon.vertices]
            if wrap_dorsal and len(values) == 3:
                # Tiny end caps have their own nondegenerate tangent basis.
                u = values[0][0]
                inside = 1 if u == 0 else -1
                cap_u = u + .007 * inside
                values = [(cap_u, .5), *[
                    (cap_u + .005 * math.cos(math.tau * v), .5 + .011 * math.sin(math.tau * v))
                    for _, v in values[1:]
                ]]
            seam = wrap_dorsal and len(values) == 4 and max(v for _, v in values) > 0.95
            for loop, (u, v) in zip(polygon.loop_indices, values):
                layer.data[loop].uv = (u, 1 if seam and v == 0 else v)
    return obj


def make_body(material):
    steps, sectors = 145, 72
    xs = np.linspace(*BODY_RANGE, steps)
    verts, uv, faces = [], [], []
    for ring, (px, (top, bottom, width)) in enumerate(zip(xs, body_profile(xs))):
        mid, radius = (top + bottom) / 2, (bottom - top) / 2
        for sector in range(sectors):
            theta = math.tau * sector / sectors
            verts.append(position(px, mid - radius * math.cos(theta), width * math.sin(theta)))
            uv.append((ring / (steps - 1), sector / sectors))
    for ring in range(steps - 1):
        for sector in range(sectors):
            a = ring * sectors + sector
            next_sector = ring * sectors + (sector + 1) % sectors
            faces.append((a, a + sectors, next_sector + sectors, next_sector))
    for index, direction in ((0, 1), (steps - 1, -1)):
        top, bottom, _ = body_profile(xs[index])
        center = len(verts)
        verts.append(position(xs[index], (top + bottom) / 2))
        uv.append((index / (steps - 1), .5))
        start = index * sectors
        faces.extend((center, start + s, start + (s + direction) % sectors) for s in range(sectors))
    return mesh("Body", verts, faces, material, uv, wrap_dorsal=True)


def sheet(name, root, edge, material, depths, *, texture_edge=None, projected=True, back_depths=None):
    """Loft a fin from its attachment out to its rim."""
    rows, columns = depths.shape
    texture_edge = edge if texture_edge is None else texture_edge
    positions, uvs = [], []
    chord = np.linspace(0, 1, columns)
    for i in range(rows):
        for t in chord:
            positions.append((1 - t) * root[i] + t * edge[i])
            if projected:
                uvs.append(projected_uv(*((1 - t) * root[i] + t * texture_edge[i])))
            else:
                uvs.append((i / (rows - 1), 1 - t))
    faces = [
        (i * columns + j, (i + 1) * columns + j, (i + 1) * columns + j + 1, i * columns + j + 1)
        for i in range(rows - 1) for j in range(columns - 1)
    ]
    vertices = [position(px, py, z) for (px, py), z in zip(positions, depths.flat)]
    if back_depths is not None:
        offset = len(positions)
        vertices.extend(position(px, py, z) for (px, py), z in zip(positions, back_depths.flat))
        uvs *= 2
        faces += [tuple(offset + index for index in reversed(face)) for face in faces]
    return mesh(name, vertices, faces, material, uvs)


def anal_fin_loft(across):
    x = np.linspace(*ANAL_RANGE, len(across))
    belly = body_profile(x)[:, 1]
    root = np.column_stack((x, belly - 35))
    atlas_root = np.column_stack((x, belly - 14))
    # The reshaped anterior belly covers a deeper strip of the source outline.
    # Resample its rays from inside the painted fin.
    atlas_y = np.interp(x, [900, 945, 986], [589, 570, 552])
    t = np.clip((x - 861) / 69, 0, 1)
    atlas_root[:, 1] += t**2 * (3 - 2 * t) * (atlas_y - atlas_root[:, 1])
    return root, trace(ANAL_PROFILE, across), atlas_root, trace(ANAL_ATLAS, across)


def anal_fin_depths(root, edge):
    chord = np.linspace(0, 1, 23)[None, :, None]
    x, y = np.moveaxis((1 - chord) * root[:, None, :] + chord * edge[:, None, :], -1, 0)
    top, bottom, width = np.moveaxis(body_profile(x), -1, 0)
    offset = y - bottom
    radius = 0.5 * (bottom - top)
    section = np.clip(1 + offset / radius, -1, 1)
    body_depth = width * np.sqrt(1 - section**2)

    # Start with the belly's width and slope, then thin into the membrane.
    start, span = -19, 51
    at_start = 1 + start / radius
    radial_fraction = 1 - at_start**2
    depth_at_start = width * np.sqrt(radial_fraction)
    power = span * at_start / (radius * radial_fraction)
    taper = depth_at_start * np.clip(1 - (offset - start) / span, 0, 1) ** power
    attachment = np.clip((x - 441) / 62, 0, 1) * np.clip((985 - x) / 39, 0, 1)
    attachment = attachment**2 * (3 - 2 * attachment)
    half_depth = np.maximum(0, np.where(offset < start, body_depth, taper) - 1.25) * attachment
    across = np.linspace(0, np.pi, len(root))[:, None]
    exposed = np.clip(offset / 32, 0, 1)
    bow = 2.5 * np.sin(across) * np.sin(np.pi * chord[..., 0]) * exposed**2 * (3 - 2 * exposed)
    return bow + half_depth, bow - half_depth


def make_median_fins(materials, across, anal_root, anal_edge):
    material = materials["tail_fins"]
    chord = np.linspace(0, 1, 12)
    bow = np.sin(np.pi * across[:, None]) * np.sin(np.pi * chord[None, :])
    # The membrane starts inside the peduncle and the tapered skin
    # continues into it along the same longitudinal skinning frames.
    tail_x = 444 + 6 * across
    tail_top, tail_bottom, _ = body_profile(tail_x).T
    tail_base = np.column_stack((tail_x, tail_top + (.13 + .72 * across) * (tail_bottom - tail_top)))
    tail_edge = trace(CAUDAL_PROFILE, across)
    fan_x = tail_base[:, :1] * (1 - chord) + tail_edge[:, :1] * chord
    exposed = np.clip((BODY_RANGE[0] - fan_x) / 60, 0, 1)
    tail_bow = 4 * bow * exposed**2 * (3 - 2 * exposed)
    x = np.linspace(*DORSAL_RANGE, len(across))
    dorsal_root = np.column_stack((x, body_profile(x)[:, 0] + 13))
    anal_front, anal_back = anal_fin_depths(anal_root, anal_edge)
    return [
        sheet("Caudal fin", tail_base, tail_edge, material, tail_bow, texture_edge=trace(CAUDAL, across)),
        sheet("Dorsal fin", dorsal_root, trace(DORSAL, across), material, -2 * bow),
        sheet(
            "Anal fin", anal_root, anal_edge, materials["anal_fin"], anal_front,
            projected=False, back_depths=anal_back,
        ),
    ]


def make_paired_fins(material):
    parts, joints = {}, []
    length = np.linspace(0, 1, 43)
    chord = np.linspace(0, 1, 10)
    for name, parent, front, rear, extension in PAIRED_FINS:
        a = trace(front, length)
        b = trace(rear, length)
        hinge = (a[0] + b[0]) / 2
        contact = max(depth_at(*hinge) - 5, 8)
        root_depths = np.array([depth_at(*point) - 7 for point in np.linspace(a[0], b[0], len(chord))])
        taper = np.clip(length / .22, 0, 1)
        base = contact + (1 - taper**2 * (3 - 2 * taper))[:, None] * (root_depths - contact)
        camber = 12 * np.sin(np.pi * chord)[None, :] * np.sin(np.pi * length)[:, None]
        for suffix, side in (("L", -1), ("R", 1)):
            bone_name = f"{name}_{suffix}"
            depth = side * (base + extension * length[:, None] ** .83 + camber)
            part = sheet(f"{name} fin {suffix}", a, b, material, depth)
            joint_root = Vector(position(*hinge, side * contact))
            joint_tip = Vector(position(*(0.5 * (a[-7] + b[-7])), side * (contact + extension * .85)))
            if side > 0:
                angle = math.radians(9 if name == "Pectoral" else 5)
                pose = Matrix.Translation(joint_root) @ Matrix.Rotation(angle, 4, "Y") @ Matrix.Translation(-joint_root)
                part.data.transform(pose)
                joint_tip = pose @ joint_tip
            parts[bone_name] = part
            joints.append((bone_name, parent, joint_root, joint_tip))
    return parts, joints


def make_eye(name, side, material):
    center_px, center_py = 1800, 212
    center = Vector(position(center_px, center_py, side * (depth_at(center_px, center_py) - 3)))
    normal = Vector((0.30, side * 0.95, 0.04)).normalized()
    right = Vector((0.95, -side * 0.30, 0)).normalized()
    up = Vector((0, 0, 1))
    sectors, rings = 72, 24
    vertices, faces, colors = [center + normal * (13.5 * SCALE)], [], [(0.006, 0.008, 0.010, 1)]
    radial = [0, .57, .61, .67, .74, .82, .87, .93, 1]
    palette = np.array([
        (.006, .008, .010), (.006, .008, .010), (.015, .039, .042),
        (.051, .201, .190), (.060, .306, .272), (.098, .249, .215),
        (.025, .077, .082), (.012, .022, .028), (.033, .046, .050),
    ])
    for ring in range(1, rings + 1):
        radius = ring / rings
        base = np.array([np.interp(radius, radial, palette[:, channel]) for channel in range(3)])
        for sector in range(sectors):
            angle = math.tau * sector / sectors
            radial_lines = 1 + .095 * math.sin(39 * angle + 14 * radius) + .047 * math.sin(27 * angle)
            convex = 15 * (1 - radius * radius) - 1.5
            vertices.append(center + SCALE * (
                normal * convex + right * (radius * 35.5 * math.cos(angle))
                + up * (radius * 39 * math.sin(angle))
            ))
            colors.append((*np.maximum(base * radial_lines, 0), 1))
    for sector in range(sectors):
        faces.append((0, 1 + sector, 1 + (sector + 1) % sectors))
    for ring in range(rings - 1):
        for sector in range(sectors):
            a = 1 + ring * sectors + sector
            b = 1 + ring * sectors + (sector + 1) % sectors
            faces.append((a, a + sectors, b + sectors, b))
    if side > 0:
        faces = [tuple(reversed(face)) for face in faces]
    obj = mesh(name, vertices, faces, material)
    color = obj.data.color_attributes.new(name="Eye Color", type="FLOAT_COLOR", domain="POINT")
    for entry, rgba in zip(color.data, colors):
        entry.color = rgba
    obj.data.color_attributes.active_color = color
    return obj


def make_barbel(name, side, material):
    samples = np.linspace(0, 1, 19)
    guide = trace([(1890, 177), (1909, 174), (1927, 165), (1945, 150), (1967, 143)], samples)
    vertices, faces = [], []
    sectors = 9
    for t, (px, py) in zip(samples, guide):
        radius = 4.7 * (1 - t) ** .8 + .16
        py += 3 * side * t
        for sector in range(sectors):
            angle = math.tau * sector / sectors
            vertices.append(position(px, py - radius * math.cos(angle), side * (9 + 14 * t) + radius * math.sin(angle)))
    for ring in range(len(samples) - 1):
        for sector in range(sectors):
            a = ring * sectors + sector
            b = ring * sectors + (sector + 1) % sectors
            faces.append((a, a + sectors, b + sectors, b))
    return mesh(name, vertices, faces, material)


def armature(fin_joints):
    data = bpy.data.armatures.new("Vermilion skeleton")
    rig = bpy.data.objects.new("Vermilion Arowana", data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    rig.show_in_front = True
    bpy.ops.object.mode_set(mode="EDIT")
    previous = None
    joint_px = [px for _, px in CHAIN] + [88]
    for i, (name, px) in enumerate(CHAIN):
        bone = data.edit_bones.new(name)
        bone.head = position(px, 340)
        bone.tail = position(joint_px[i + 1], 340)
        if previous is not None:
            bone.parent = previous
            bone.use_connect = True
        previous = bone
    for name, parent, head, tip in fin_joints:
        bone = data.edit_bones.new(name)
        bone.head, bone.tail = head, tip
        bone.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    return rig


def bind(obj, rig, joint=None):
    modifier = obj.modifiers.new("Vermilion deformation", "ARMATURE")
    modifier.object = rig
    if joint is not None:
        group = obj.vertex_groups.new(name=joint)
        group.add(list(range(len(obj.data.vertices))), 1, "REPLACE")
        return
    group_by_joint = [obj.vertex_groups.new(name=name) for name, _ in CHAIN]
    pivots = np.array([px for _, px in CHAIN])
    for vertex in obj.data.vertices:
        px = vertex.co.x / SCALE + ORIGIN[0]
        downstream = int(np.searchsorted(-pivots, -px))
        if downstream == 0 or downstream == len(CHAIN):
            group_by_joint[0 if downstream == 0 else -1].add([vertex.index], 1, "REPLACE")
            continue
        t = float((pivots[downstream - 1] - px) / (pivots[downstream - 1] - pivots[downstream]))
        blend = t * t * (3 - 2 * t)
        group_by_joint[downstream - 1].add([vertex.index], 1 - blend, "REPLACE")
        group_by_joint[downstream].add([vertex.index], blend, "REPLACE")


def animate_idle(rig, fin_joints):
    """Store a restrained in-place stroke for the editable file and GLB."""
    bones = list(rig.pose.bones)
    up_axes = {bone.name: bone.bone.matrix_local.to_quaternion().inverted() @ Vector((0, 0, 1)) for bone in bones}
    forward_axes = {bone.name: bone.bone.matrix_local.to_quaternion().inverted() @ Vector((1, 0, 0)) for bone in bones}
    for frame in range(1, 145 + 1, 3):
        phase = math.tau * 3 * (frame - 1) / 144
        for index, ((name, _), amplitude) in enumerate(zip(CHAIN, (.008, .017, .036, .065, .097, .12, .128))):
            rig.pose.bones[name].rotation_quaternion = Quaternion(up_axes[name], amplitude * math.sin(phase - .58 * index))
        for i, (name, _, _, _) in enumerate(fin_joints):
            side = -1 if name.endswith("_L") else 1
            motion = math.sin(phase * 2 / 3 + .62 * i)
            rig.pose.bones[name].rotation_quaternion = (
                Quaternion(up_axes[name], side * .08 * motion)
                @ Quaternion(forward_axes[name], side * .12 * math.sin(phase * 2 / 3 - .8 + .62 * i))
            )
        for bone in bones:
            bone.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=bone.name)
    rig.animation_data.action.name = "Vermilion | Relaxed stroke"
    scene = bpy.context.scene
    scene.render.fps = 24
    scene.frame_start, scene.frame_end = 1, 145
    scene.frame_set(1)


def reference_camera(source):
    scene = bpy.context.scene
    scene.view_settings.view_transform = "Khronos PBR Neutral"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = -0.2
    data = bpy.data.cameras.new("Reference side")
    data.type = "ORTHO"
    data.ortho_scale = 3.65
    data.show_background_images = True
    background = data.background_images.new()
    background.image = source
    background.alpha = .3
    background.display_depth = "FRONT"
    background.scale = (IMAGE_SIZE[0] - 1) * SCALE / data.ortho_scale
    camera = bpy.data.objects.new("Reference side", data)
    scene.collection.objects.link(camera)
    camera.location = (0, -8, -.095)
    camera.rotation_euler = Vector((0, 1, 0)).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    scene.render.resolution_x, scene.render.resolution_y = 1600, 720
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new("Reference studio")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.035, .060, .087, 1)
    for name, location, power, size, tint in (
        ("Soft daylight", (1, -4, 2.5), 440, 4.8, (1, .98, .96)),
        ("Water fill", (-2, -3, -.7), 150, 4.5, (.88, .95, 1)),
        ("Rim", (-1, 2.5, 2.5), 285, 4, (.86, .95, 1)),
    ):
        light_data = bpy.data.lights.new(name, "AREA")
        light_data.energy, light_data.size, light_data.color = power, size, tint
        light = bpy.data.objects.new(name, light_data)
        scene.collection.objects.link(light)
        light.location = location
        light.rotation_euler = (-light.location).to_track_quat("-Z", "Y").to_euler()


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    concept = bpy.data.images.load(str(HERE / "concept.png"))
    if tuple(concept.size) != IMAGE_SIZE:
        raise ValueError(f"Concept must retain its {IMAGE_SIZE[0]} × {IMAGE_SIZE[1]} traced framing")
    concept.pack()
    photo = bpy.data.images.load(str(HERE / "reference.jpg"))
    if tuple(photo.size) != (1992, 916):
        raise ValueError("Reference photograph must retain its 1992 × 916 color registration")
    photo.pack()
    photo.use_fake_user = True
    form_study = bpy.data.images.load(str(HERE / "form-study.png"))
    form_study.pack()
    form_study.use_fake_user = True
    across = np.linspace(0, 1, 59)
    anal_loft = anal_fin_loft(across)
    materials = create_materials(concept, photo, body_profile, BODY_RANGE, DORSAL_RANGE, anal_loft)
    paired, fin_joints = make_paired_fins(materials["paired_fins"])
    rig = armature(fin_joints)
    objects = [make_body(materials["body"]), *make_median_fins(materials, across, *anal_loft[:2])]
    for obj in objects:
        bind(obj, rig)
    for name, obj in paired.items():
        bind(obj, rig, name)
        objects.append(obj)
    for suffix, side in (("L", -1), ("R", 1)):
        head_parts = (
            make_eye(f"Eye {suffix}", side, materials["eye"]),
            make_barbel(f"Barbel {suffix}", side, materials["barbel"]),
        )
        for obj in head_parts:
            bind(obj, rig, "Head")
            objects.append(obj)
    animate_idle(rig, fin_joints)
    reference_camera(concept)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in [rig, *objects]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "vermilion-arowana.blend"), compress=True)
    bpy.ops.export_scene.gltf(
        filepath=str(HERE / "vermilion-arowana.glb"),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_tangents=True,
        export_animations=True,
    )


if __name__ == "__main__":
    main()

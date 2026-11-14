"""Build the seated plush rabbit in Blender and export its standalone GLB."""

import argparse
import math
import random
import sys
from bisect import bisect_left
from itertools import accumulate
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

DIRECTORY = Path(__file__).resolve().parent
sys.path.insert(0, str(DIRECTORY))
from materials import linen_material, make_materials, material, photo_fiber_material, srgb
from render_photos import RABBIT_ROOT_NAME, fit_photo_backdrop

TAU = math.tau
PI = math.pi
UP = Vector((0, 0, 1))
FRONT = Vector((0, -1, 0))
RIGHT = Vector((1, 0, 0))
GROOM = []
TINTS = {}


def catmull(a, b, c, d, t):
    return b + .5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)))


def profile(points, t, closed=False):
    size = len(points)
    position = t * (size if closed else size - 1)
    index = math.floor(position)

    def point(i):
        return points[i % size] if closed else points[min(size - 1, max(0, i))]

    return catmull(point(index - 1), point(index), point(index + 1), point(index + 2), position - index)


def smoothstep(lo, hi, x):
    u = min(1, max(0, (x - lo) / (hi - lo)))
    return u * u * (3 - 2 * u)


def soft_floor(height):
    return .5 * (height + math.sqrt(height * height + .070 ** 2))


def collection(name):
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    return result


def mesh_object(name, vertices, faces, materials, target, uv_rows=None, colors=None, indices=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    target.objects.link(obj)
    for surface in materials:
        mesh.materials.append(surface)
    if uv_rows:
        uv_layer = mesh.uv_layers.new(name='Pattern UV')
        uv_layer.data.foreach_set('uv', [value for row in uv_rows for uv in row for value in uv])
    if colors:
        tint = mesh.color_attributes.new(name='Tint and occlusion', type='BYTE_COLOR', domain='POINT')
        tint.data.foreach_set('color', [value for rgba in colors for value in rgba])
        TINTS[obj] = colors
    if indices:
        mesh.polygons.foreach_set('material_index', indices)
    mesh.polygons.foreach_set('use_smooth', [True] * len(mesh.polygons))
    return obj


def surface(name, point, uv, tint, materials, target, *, rings=56, sides=64, section=None, reverse=False, groom=0):
    """Create a sealed shell with shared pole and seam vertices, and per-loop UVs."""
    parameters = [(0, 0)] + [(i / rings, j / sides) for i in range(1, rings) for j in range(sides)] + [(1, 0)]
    vertices = [point(t, u * TAU) for t, u in parameters]
    colors = [(*tint(t, u * TAU, p), 1) for (t, u), p in zip(parameters, vertices)] if tint else None
    faces, uvs, indices = [], [], []

    def vertex(i, j):
        if i == 0:
            return 0
        if i == rings:
            return len(vertices) - 1
        return 1 + (i - 1) * sides + j % sides

    for i in range(rings):
        for j in range(sides):
            corners = [(i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j)]
            if i == 0:
                corners.pop(0)
            if i == rings - 1:
                corners.pop(2)
            if reverse:
                corners.reverse()
            part = section((j + .5) / sides * TAU, (i + .5) / rings) if section else 0
            faces.append([vertex(k, l) for k, l in corners])
            if uv:
                uvs.append([uv(k / rings, l / sides, vertices[vertex(k, l)], part) for k, l in corners])
            indices.append(part)
    obj = mesh_object(name, vertices, faces, materials, target, uvs, colors, indices)
    if groom:
        GROOM.append((obj, groom, colors))
    return obj


def pile_uv(width, length, offset=0):
    # Whole repeats keep the wrap continuous at the seam.
    return lambda t, u, _p, _part: (u * width + offset, t * length + offset)


def head_uv(t, u, _p, _part):
    # The nap fans outward over the cheeks.
    angle = u * TAU
    cheek = math.sin(angle * 2) * max(0, math.cos(angle))
    return (u * 3 + .43 + (t - .44) * .19 * cheek, t * 1.25 + .43)


def head_nap_uv(t, u, point, _part):
    angle = u * TAU
    front = max(0, math.cos(angle))
    latitude = (point.z - 1.73) / 1.10
    spread = math.sin(angle * 2)
    # Pull the top of the UV field inward so the nap opens toward the cheeks.
    fan = (.235 - .39 * latitude) * spread * front ** .7
    crease = .011 * math.sin(t * 25 + angle * 3) * front * math.sin(t * PI)
    return (u * 3 + .43 + fan + crease, t * 1.32 + .43 + (latitude - t) * .17)


def head_seam(z):
    return .008 * math.sin(z * 8.5) + .0032 * math.sin(z * 25)


def head_point(t, angle):
    lat = -math.cos(t * PI)
    cross = math.sin(t * PI) ** .82
    s, c = math.sin(angle), math.cos(angle)
    cheek = 1 + .080 * math.exp(-((lat + .37) / .34) ** 2)
    x = .657 * cross * s * cheek * (1 - .062 * lat) + .012 * lat
    front = max(0, c)
    back = max(0, -c)
    y = -.112 - .466 * cross * front ** .78 + .464 * cross * back
    y -= .015 * cross * front * math.exp(-((lat + .39) / .29) ** 2)
    y += .008 * s * lat
    z = 2.270 + .557 * lat - .041 * cross * back + .009 * cross * s
    z += .028 * (1 - smoothstep(-1, -.72, lat))
    seam_x = .0050 * math.sin(z * 8.5) + .0028 * math.sin(z * 23)
    center_seam = math.exp(-((x - seam_x) / .018) ** 2) * cross
    y += center_seam * (.0057 * front - .008 * back)
    return Vector((x, y, z))


def shaped_head(t, angle, pilot):
    p = head_point(t, angle)
    front = max(0, math.cos(angle))
    strength = smoothstep(-.012, .055, p.x) if pilot else 1
    seam = math.exp(-((p.x - head_seam(p.z)) / .023) ** 2)
    forehead = smoothstep(2.27, 2.70, p.z)
    cheek = math.exp(-((p.z - 2.12) / .20) ** 2)
    p.y += front * strength * (.0018 * seam * forehead - .008 * cheek)
    p.z += .016 * cheek * front * strength
    return p


def head_tint(t, angle, p):
    seam_x = .0050 * math.sin(p.z * 8.5) + .0028 * math.sin(p.z * 23)
    seam = math.exp(-((p.x - seam_x) / .020) ** 2) * abs(math.cos(angle))
    neck = (1 - smoothstep(.10, .31, t)) * .070
    amount = .995 - seam * .042 - neck + .010 * math.cos(angle * 2 + t * 4)
    return (amount, amount, amount)


def head_panel_tint(t, angle, p, pilot):
    amount = head_tint(t, angle, p)[0]
    crease = math.exp(-((p.x - head_seam(p.z)) / .025) ** 2)
    above_eyes = smoothstep(2.27, 2.55, p.z)
    strength = smoothstep(-.012, .055, p.x) if pilot else 1
    amount -= crease * above_eyes * max(0, math.cos(angle)) * strength * .016
    return (amount,) * 3


def body_point(t, angle):
    lat = -math.cos(t * PI)
    ring = math.sin(t * PI) ** .85
    width = .621 * (1 - .272 * lat)
    x = width * ring * math.sin(angle)
    z = soft_floor(.942 + lat * 1.005)
    front = math.cos(angle)
    y = .086 - .499 * ring * front * (1 - .16 * lat) - .108 * lat
    y += .005 * math.exp(-(x / .017) ** 2) * ring * front
    return Vector((x, y, z))


def stuffed_body(t, angle):
    p = body_point(t, angle)
    lat = -math.cos(t * PI)
    ring = math.sin(t * PI)
    front = max(0, math.cos(angle))
    p.x *= 1 + .085 * math.exp(-((lat + .27) / .52) ** 2)
    p.y -= .044 * front * ring
    p.z += .150 * ring ** 1.52 * front * (1 - smoothstep(-.22, .69, lat))
    seam = math.exp(-((p.x - head_seam(p.z) * .55) / .023) ** 2)
    p.y += .006 * seam * ring * front
    return p


def body_nap_uv(_t, u, p, _part):
    angle = u * TAU
    fold = .083 * math.sin(angle * 2) * max(0, math.cos(angle))
    return (u * 3 + .15 + fold * (p.z - 1.12), .15 + p.z * .96)


def body_tint(t, angle, p):
    seam = math.exp(-(p.x / .022) ** 2) * abs(math.cos(angle))
    neck = smoothstep(.71, .94, t) * .15
    under = (1 - smoothstep(.10, .36, t)) * .13
    armpit = math.sin(angle) ** 8 * math.exp(-((t - .67) / .27) ** 2) * .085
    amount = .992 - seam * .044 - neck - under - armpit
    return (amount, amount, amount)


def tube(points, ripple=.016, ground=False, toe_cap=False):
    points = list(map(Vector, points))

    def point(t, angle):
        p = profile(points, t)
        before = profile(points, max(0, t - .0007)).xyz
        after = profile(points, min(1, t + .0007)).xyz
        tangent = (after - before).normalized()
        width, depth = p[3], p[4]
        if toe_cap:
            blend = 1 - smoothstep(.275, .435, t)
            tangent = tangent.lerp(Vector((0, 1, 0)), blend).normalized()
            tip, middle = points[0][1], points[3][1]
            span = middle - tip
            cap = math.sqrt(max(0, 1 - ((p.y - middle) / span) ** 2))
            width += (points[3][3] * cap - width) * blend
            depth += (points[3][4] * cap - depth) * blend
        across = (RIGHT - tangent * RIGHT.dot(tangent)).normalized()
        forward = across.cross(tangent)
        soft_fold = 1 + ripple * math.cos(3 * angle + t * 7) * math.sin(PI * t)
        position = (p.xyz + across * max(0, width) * math.sin(angle) * soft_fold
                    + forward * max(0, depth) * math.cos(angle) * soft_fold)
        if ground:
            position.z = soft_floor(position.z)
        return position

    return point


def foot_nap_uv(side, offset):
    # A stuffed paw has separate toe and leg patterns. Planar front UVs pass
    # smoothly through the toe tip rather than pinching the nap at one point.
    def uv(t, u, p, part):
        if part == 0:
            return (.62 + side * .11 + p.x * 1.22 + (p.z - .28) * side * .21,
                    .49 + p.z * 1.37)
        return (u * 2 + offset + .037 * math.sin(TAU * u) * t, .18 + t * 1.41 + offset)

    return uv


def foot_seam(t, angle, p, side):
    toe_break = .285 + .032 * math.sin(angle) * side - .026 * math.cos(angle)
    return math.exp(-((t - toe_break) / .026) ** 2) * smoothstep(.04, .20, p.z)


def make_limbs(mats, target, pilot):
    for side, label, d in [(-1, 'Left', 0.0), (1, 'Right', .021)]:
        old = pilot and side < 0
        arm = tube([
            (side * .584, -.343, .506 + d, 0, 0),
            (side * .626, -.330, .553 + d, .122, .125),
            (side * .636, -.294, .675 + d, .174, .174),
            (side * .620, -.250, .875 + d, .175, .180),
            (side * .565, -.212, 1.111 + d, .164, .165),
            (side * .484, -.174, 1.373 + d, .162, .167),
            (side * .354, -.124, 1.613 + d, .142, .141),
            (side * .243, -.080, 1.725 + d, 0, 0),
        ])
        leg_points = [
            (side * (.416 + d), -1.211 + d, .267, 0, 0),
            (side * (.423 + d), -1.171 + d, .268, .151, .157),
            (side * (.426 + d), -1.081 + d, .268, .238, .238),
            (side * (.412 + d), -.941 + d, .273, .258, .263),
            (side * (.382 + d), -.777 + d, .309, .231, .248),
            (side * (.345 + d), -.610 + d, .380, .194, .213),
            (side * (.313 + d), -.458 + d, .474, .182, .188),
            (side * (.297 + d), -.326 + d, .555, .186, .178),
            (side * (.272 + d), -.150 + d, .609, .153, .138),
            (side * (.234 + d), -.011 + d, .605, 0, 0),
        ]
        if not old:
            leg_points = [
                (side * (.421 + d), -1.270 + d, .269, 0, 0),
                (side * (.430 + d), -1.244 + d, .278, .145, .148),
                (side * (.441 + d), -1.174 + d, .282, .255, .254),
                (side * (.438 + d), -1.051 + d, .284, .303, .288),
                (side * (.410 + d), -.889 + d, .314, .287, .292),
                (side * (.373 + d), -.720 + d, .376, .241, .253),
                (side * (.343 + d), -.536 + d, .477, .215, .220),
                (side * (.311 + d), -.377 + d, .594, .218, .208),
                (side * (.275 + d), -.192 + d, .684, .172, .154),
                (side * (.235 + d), -.011 + d, .668, 0, 0),
            ]
        leg = tube(leg_points, ripple=.011, ground=True, toe_cap=not old)

        def limb_tint(t, angle, _p):
            inner = (1 - side * math.sin(angle)) * .5
            amount = 1 - smoothstep(.52, .96, t) * (.085 + .10 * inner) - .038 * max(0, -math.cos(angle))
            return (amount, amount, amount)

        arm_mat = mats['previous_plush'] if pilot else mats['plush']
        surface(f'{label} · stuffed arm', arm, pile_uv(1, 1.37, d + .37), limb_tint,
                [arm_mat], target, rings=52, sides=56, groom=3000)
        if old:
            surface(f'{label} · foot and bent leg', leg, pile_uv(2, 1.34, d + .11), limb_tint,
                    [mats['previous_plush']], target, rings=64, sides=64, groom=3900)
            continue

        def padded_foot(t, angle):
            p = leg(t, angle)
            groove = foot_seam(t, angle, p, side)
            p.z -= groove * .012
            p.x -= groove * math.sin(angle) * .004
            return p

        def foot_tint(t, angle, p):
            amount = limb_tint(t, angle, p)[0] - foot_seam(t, angle, p, side) * .081
            return (amount,) * 3

        def foot_panel(angle, t):
            toe_break = .285 + .032 * math.sin(angle) * side - .026 * math.cos(angle)
            return int(t > toe_break)

        surface(f'{label} · foot and bent leg', padded_foot, foot_nap_uv(side, d + .11), foot_tint,
                [mats['plush'], mats['plush']], target, rings=88, sides=72, section=foot_panel, groom=4600)


EAR_HEM = TAU * 10 / 80
ROLLED_EAR_HEM = TAU * 9 / 80


def make_ear(side, name, target, details, mats, pilot):
    old = pilot and side < 0
    def shape(points):
        return [Vector((side * x, y, z, width, depth, yaw * side))
                for x, y, z, width, depth, yaw in points]

    left = [
        (.302, -.080, 2.667, 0, 0, -.14), (.462, -.088, 2.640, .119, .090, -.07),
        (.594, -.074, 2.520, .143, .115, .02), (.701, -.082, 2.343, .165, .113, .14),
        (.817, -.111, 2.072, .188, .113, .24), (.914, -.156, 1.749, .218, .121, .28),
        (.997, -.211, 1.431, .244, .145, .27), (1.066, -.279, 1.129, .257, .163, .25),
        (1.099, -.343, .856, .245, .154, .21), (1.087, -.401, .642, .187, .128, .16),
        (1.043, -.431, .494, .109, .079, .07), (1.012, -.442, .455, 0, 0, -.04),
    ]
    right = [
        (.316, -.068, 2.651, 0, 0, .01), (.485, -.072, 2.624, .121, .100, .04),
        (.617, -.071, 2.507, .147, .111, .08), (.724, -.099, 2.321, .167, .121, .15),
        (.815, -.134, 2.060, .182, .125, .23), (.908, -.191, 1.748, .208, .139, .27),
        (.988, -.251, 1.422, .225, .154, .28), (1.045, -.311, 1.118, .238, .164, .31),
        (1.069, -.379, .857, .225, .155, .33), (1.058, -.430, .660, .178, .128, .36),
        (1.016, -.456, .520, .094, .084, .37), (.985, -.470, .483, 0, 0, .39),
    ]
    controls = shape(left if side < 0 else right)
    hem_angle = EAR_HEM if old else ROLLED_EAR_HEM

    def ear_point(t, angle):
        x, y, z, width, depth, yaw = profile(controls, t)
        angle = (angle + PI) % TAU - PI
        if not old:
            mid = math.sin(t * PI) ** 1.6
            lower = smoothstep(.54, .94, t)
            x -= side * (.098 * mid + .043 * lower)
            y -= .137 * mid + .118 * lower
            z -= .075 * lower
            width *= 1 + .047 * mid + .075 * lower
            depth *= 1 + .20 * mid + .15 * lower
            yaw -= side * (.30 * math.exp(-((t - .40) / .22) ** 2) + .18 * lower)
        # The cotton sits a little below the plush roll at the seam.
        hem = math.exp(-((abs(angle) - hem_angle) / .063) ** 2)
        cloth = 1 - smoothstep(hem_angle - .12, hem_angle + .02, abs(angle))
        roll = math.cos(angle) - (.32 if old else .41) * cloth - .063 * hem
        roll += (.19 if old else .34) * math.exp(-((abs(angle) - (hem_angle + .30)) / .24) ** 2)
        roll += (.047 if old else .086) * math.sin(t * 14 + angle * 1.8 + side * .4) * cloth
        if not old:
            roll += .071 * math.sin(t * 21 - angle * 2.3) * math.sin(PI * t) ** 2
        across = math.sin(angle) * max(0, width)
        across *= 1 + .023 * math.cos(t * 21 + angle * 2)
        ahead = max(0, depth) * roll
        slope = (profile(controls, min(1, t + .001))[0] - profile(controls, max(0, t - .001))[0])
        return Vector((x + across * math.cos(yaw) + ahead * math.sin(yaw),
                       y + across * math.sin(yaw) - ahead * math.cos(yaw),
                       z + across * slope * 65))

    def ear_uv(t, u, p, part):
        if part == 0:
            return (u * 2 + side * .22, (1 - t) * 1.96 + side * .17)
        if not old:
            angle = (u * TAU + PI) % TAU - PI
            width = profile(controls, t)[3]
            across = math.sin(angle) * max(0, width)
            return (.50 + side * .24 + across * .83, .105 + (p.z - .455) * .358 + side * .037)
        x, y, _z, _w, _d, yaw = profile(controls, t)
        across = (p.x - x) * math.cos(yaw) + (p.y - y) * math.sin(yaw)
        return (.50 + side * .24 + across * .49, .105 + (p.z - .455) * .358 + side * .037)

    def ear_tint(t, angle, _p):
        angle = abs((angle + PI) % TAU - PI)
        hem = math.exp(-((angle - hem_angle) / .10) ** 2)
        root = 1 - smoothstep(.04, .23, t)
        inside = 1 - smoothstep(hem_angle - .10, hem_angle + .08, angle)
        amount = .992 - hem * (.14 if old else .109) - root * .09 - inside * .065
        return (amount, amount, amount)

    plush = mats['previous_plush'] if old else mats['plush']
    cotton = mats['previous_cotton'] if old else mats['cotton']
    surface(f'{name} · two sewn panels', ear_point, ear_uv, ear_tint, [plush, cotton],
            target, rings=109, sides=80, section=lambda a, _t: int(abs((a + PI) % TAU - PI) < hem_angle),
            reverse=True, groom=4550)

    for edge in (-1, 1):
        points = [ear_point(t, edge * (hem_angle - .038)) + FRONT * .0015
                  for t in (j / 140 for j in range(17, 133))]
        sewn_line(f'{name} · cotton edge {edge:+}', points, .00127, mats['hem'], details, cut=3)


def sewn_line(name, points, radius, surface_material, target, cut=0):
    """Sweep thread geometry along a path, with short gaps for sewn hems."""
    vertices, faces = [], []
    sides = 6
    pieces = [points] if cut == 0 else [points[i:i + cut] for i in range(0, len(points) - cut, cut + 1)]
    for piece in pieces:
        start = len(vertices)
        for i, p in enumerate(piece):
            direction = (piece[min(i + 1, len(piece) - 1)] - piece[max(0, i - 1)]).normalized()
            a = direction.cross(FRONT).normalized()
            b = direction.cross(a).normalized()
            taper = .55 if i == 0 or i == len(piece) - 1 else 1
            for j in range(sides):
                angle = j / sides * TAU
                vertices.append(p + (a * math.cos(angle) + b * math.sin(angle)) * radius * taper)
            if i:
                k = start + (i - 1) * sides
                for j in range(sides):
                    nxt = (j + 1) % sides
                    faces.append((k + j, k + nxt, k + nxt + sides, k + j + sides))
        faces.append(tuple(start + j for j in reversed(range(sides))))
        end = start + sides * (len(piece) - 1)
        faces.append(tuple(end + j for j in range(sides)))
    return mesh_object(name, vertices, faces, [surface_material], target)


def make_face(head, mats, target):
    head_mesh = head.data
    bvh = BVHTree.FromPolygons([v.co for v in head_mesh.vertices], [face.vertices for face in head_mesh.polygons])

    def on_face(x, z, height=0):
        location, _normal, _index, _dist = bvh.ray_cast(Vector((x, -1.5, z)), -FRONT, 2)
        return location + FRONT * height

    def thread_patch(name, x, z, outline, thickness, base, tone, stitch_spacing, tilt):
        points = [Vector(p) for p in outline]
        steps, rows = 96, 8
        vertices = [on_face(x, z, thickness)]
        for i in range(1, rows + 1):
            t = i / rows
            for j in range(steps):
                u, v = profile(points, j / steps, closed=True) * t
                vertices.append(on_face(x + u, z + v, .0017 + (thickness - .0017) * math.cos(t * PI / 2) ** .70))
        faces = [(0, j + 1, (j + 1) % steps + 1) for j in range(steps)]
        for i in range(rows - 1):
            for j in range(steps):
                a, b = i * steps + 1, (i + 1) * steps + 1
                k = (j + 1) % steps
                faces.append((a + j, b + j, b + k, a + k))
        mesh_object(name, vertices, faces, [base], target)

        pattern = [profile(points, i / 128, closed=True) for i in range(128)]
        limit = min(p.x for p in pattern) + stitch_spacing * .5
        for n in range(math.ceil((max(p.x for p in pattern) - limit) / stitch_spacing)):
            a = limit + n * stitch_spacing
            hits = []
            for start, end in zip(pattern, pattern[1:] + pattern[:1]):
                p, q = start.x - start.y * tilt, end.x - end.y * tilt
                if (p <= a < q) or (q <= a < p):
                    hits.append(start.y + (end.y - start.y) * (a - p) / (q - p))
            if len(hits) < 2:
                continue
            trace = []
            for i in range(8):
                t = .045 + .91 * i / 7
                v = min(hits) * (1 - t) + max(hits) * t
                puff = .0017 + thickness * .61 * math.sin(t * PI) ** .70
                trace.append(on_face(x + a + v * tilt, z + v, puff + .0012))
            sewn_line(f'{name} · floss {n + 1:02}', trace, stitch_spacing * .21, tone if n % 3 else base, target)

    for side, x, z in [('Left', -.327, 2.274), ('Right', .323, 2.281)]:
        outline = [(math.cos(i / 10 * TAU) * .021 + math.sin(i / 10 * TAU) * .004,
                    math.sin(i / 10 * TAU) * .038) for i in range(10)]
        thread_patch(f'{side} eye', x, z, outline, .007, mats['eyes'], mats['eye_thread'], .0042, -.17)

    nose = [(0, -.052), (.016, -.039), (.036, -.015), (.053, .015), (.048, .031),
            (.025, .038), (0, .039), (-.027, .038), (-.048, .029), (-.052, .010),
            (-.034, -.016), (-.015, -.040)]
    nose = [(x * 1.16, z * 1.10) for x, z in nose]
    thread_patch('Cinnamon nose', .001, 2.163, nose, .011, mats['nose'], mats['nose_thread'], .0044, .12)
    mouth_points = [(-.063, 2.036), (-.045, 2.026), (-.020, 2.022), (.001, 2.034),
                    (.020, 2.023), (.045, 2.028), (.063, 2.038)]
    mouth = [on_face(*profile(list(map(Vector, mouth_points)), j / 28), .004) for j in range(29)]
    philtrum = [on_face(.001 + .002 * math.sin(i / 9 * PI), 2.034 + i / 9 * .080, .004) for i in range(10)]
    sewn_line('Two sides of the stitched smile', mouth, .0034, mats['mouth'], target)
    sewn_line('Stitch below the nose', philtrum, .0031, mats['mouth'], target)


def make_bow(mats, target):
    angle = math.radians(-36)
    across = Vector((math.cos(angle), .27, math.sin(angle)))
    up = Vector((-math.sin(angle), .55, math.cos(angle)))
    center = Vector((.480, -.348, 2.634))

    def cotton_uv(_t, _u, p, _part):
        d = p - center
        return (.407 + d.dot(across) * .63, .67 + d.dot(up) * .72)

    def bow_part(name, samples):
        samples = list(map(Vector, samples))

        def pose(t, a):
            u, v, y, width, depth = profile(samples, t)
            shift = math.sin(a) * max(0, width)
            gathered = 1 + .64 * math.exp(-((t - .19) / .20) ** 2)
            wrinkle = (.015 * math.cos(4 * a + 4 * t) + .007 * math.sin(7 * a - 10 * t))
            wrinkle *= math.sin(PI * t) ** .61 * gathered
            fill = math.cos(a) * max(0, depth) + wrinkle
            if 'tail' in name:
                return center + across * (u + shift) + up * v + FRONT * (y + fill)
            return center + across * u + up * (v + shift) + FRONT * (y + fill)

        def folds(t, a, _p):
            amount = .98 - .22 * math.exp(-((t - .15) / .20) ** 2) - .065 * (1 + math.cos(4 * a + t * 4))
            return (amount, amount, amount)

        surface(name, pose, cotton_uv, folds, [mats['cotton']], target, rings=42, sides=44,
                reverse='tail' in name or samples[-1][0] > samples[0][0])

    bow_part('Bow · rear ribbon tail', [(-.035, .002, -.003, 0, 0), (-.075, -.045, -.008, .046, .015),
             (-.091, -.112, -.018, .044, .017), (-.083, -.175, -.029, .050, .012),
             (-.068, -.232, -.030, .036, .012), (-.064, -.252, -.026, 0, 0)])
    bow_part('Bow · folded ribbon tail', [( .047, .015, .018, 0, 0), (.063, -.046, .026, .046, .014),
             (.090, -.093, .034, .061, .024), (.115, -.144, .023, .051, .017),
             (.126, -.186, .012, .067, .016), (.133, -.219, .019, .043, .013),
             (.134, -.234, .018, 0, 0)])
    bow_part('Bow · left folded loop', [(-.017, 0, .001, 0, 0), (-.076, .001, .013, .046, .025),
             (-.140, .015, .020, .074, .047), (-.204, .035, .035, .101, .063),
             (-.258, .043, .037, .113, .046), (-.290, .048, .020, .086, .031),
             (-.313, .046, .014, 0, 0)])
    bow_part('Bow · right folded loop', [( .017, .005, .004, 0, 0), (.067, -.006, .021, .043, .025),
             (.132, .005, .028, .064, .044), (.198, .019, .021, .091, .052),
             (.248, .017, .020, .087, .042), (.275, .013, .029, .061, .022),
             (.292, .011, .028, 0, 0)])

    def knot(t, a):
        h, ring = -math.cos(t * PI), math.sin(t * PI)
        waist = 1 - .32 * math.exp(-(h / .68) ** 2)
        pucker = 1 + .126 * math.cos(4 * a + h * 4.2) * ring
        return (center + up * h * .061 + across * (.004 + ring * .056 * math.sin(a) * waist)
                + FRONT * (-.017 + ring * .078 * math.cos(a) * pucker))

    surface('Bow · gathered centre knot', knot, cotton_uv, lambda _t, _a, _p: (.99, .99, .99),
            [mats['cotton']], target, rings=30, sides=36)


def make_tail(plush, target):
    def point(t, a):
        lat, ring = -math.cos(t * PI), math.sin(t * PI)
        tuft = 1 + .05 * math.cos(a * 5 + t * 4) * ring + .021 * math.cos(a * 9 - t * 11)
        return Vector((-.022 + .195 * ring * math.sin(a) * tuft,
                       .622 - .215 * ring * math.cos(a) * tuft,
                       .358 + .183 * lat))

    surface('Tail · plush tuft', point, pile_uv(1, .56, .61), lambda t, a, p: (.96, .96, .96),
            [plush], target, rings=44, sides=56, groom=2500)


def bake_contact_occlusion():
    """Store soft contact shading in the vertex color used by Blender and glTF."""
    vertices, polygons = [], []
    for obj in TINTS:
        offset = len(vertices)
        vertices.extend(v.co for v in obj.data.vertices)
        polygons.extend([offset + i for i in face.vertices] for face in obj.data.polygons)
    tree = BVHTree.FromPolygons(vertices, polygons)
    sample_count, reach = 16, .263
    samples = []
    for i in range(sample_count):
        u = (i + .5) / sample_count
        a = i * 2.39996323
        samples.append((math.sqrt(u) * math.cos(a), math.sqrt(u) * math.sin(a), math.sqrt(1 - u)))

    for obj, colors in TINTS.items():
        if not obj.data.vertices:
            continue
        for vertex in obj.data.vertices:
            n = vertex.normal
            start = vertex.co + n * .0055
            axis = n.cross(UP if abs(n.z) < .9 else FRONT).normalized()
            side = n.cross(axis)
            hits = 0
            for x, y, z in samples:
                _point, _normal, _index, distance = tree.ray_cast(start, axis * x + side * y + n * z, reach)
                if distance is not None:
                    hits += (1 - distance / reach) ** 1.40
            factor = 1 - .41 * hits / sample_count
            r, g, b, a = colors[vertex.index]
            colors[vertex.index] = (r * factor, g * factor, b * factor, a)
        attr = obj.data.color_attributes['Tint and occlusion']
        attr.data.foreach_set('color', [value for rgba in colors for value in rgba])


def nap_direction(name, position):
    x, y, z = position
    outward = math.tanh(x * 5.4)
    if name.startswith('Head'):
        forehead = smoothstep(2.30, 2.69, z)
        return Vector((outward * (.42 + forehead * .71), -.38 - .25 * forehead, -1 + .52 * forehead))
    if 'ear ·' in name:
        lower = 1 - smoothstep(.46, 1.24, z)
        return Vector((outward * (.31 - .53 * lower), -.25, -1))
    if 'foot and bent leg' in name:
        toe = 1 - smoothstep(-1.23, -.72, y)
        side = -1 if name.startswith('Left') else 1
        across = math.tanh((x - side * .45) * 5.4)
        return Vector((.36 * across + .12 * side, -1 + .68 * toe, -.39 - .64 * toe))
    if 'stuffed arm' in name:
        return Vector((outward * .35, -.22, -1))
    return Vector((outward * .36, -.29, -1))


def bake_nap(obj):
    # glTF leaves custom attributes in their original space, so store +Y up here.
    # Interpolate the comb before projecting it on the surface, including at UV seams.
    values = []
    for vertex in obj.data.vertices:
        x, y, z = vertex.co
        direction = nap_direction(obj.name, vertex.co)
        direction.x += .064 * math.sin(18*x + 11*z - 5*y) + .040 * math.sin(31*z - 19*x)
        direction.y += .052 * math.sin(18*z + 21*y + 7*x)
        values.extend((direction.x, direction.z, -direction.y))
    attr = obj.data.attributes.new('_nap', 'FLOAT_VECTOR', 'POINT')
    attr.data.foreach_set('vector', values)


def groom_photo_fibers(shell, target, palette, sample_count, material, seed):
    """Combed strands attached to the same fabric surface used by the GLB."""
    import numpy as np

    mesh = shell.data
    mesh.calc_loop_triangles()
    rng = np.random.default_rng(seed)
    plush_slots = {i for i, mat in enumerate(mesh.materials) if mat.name.startswith('01 ·')}
    faces = [tri for tri in mesh.loop_triangles
             if mesh.polygons[tri.polygon_index].material_index in plush_slots and tri.area > 1e-10]
    indices = np.array([list(tri.vertices) for tri in faces], dtype=np.int32)
    corners = np.array([list(tri.loops) for tri in faces], dtype=np.int32)
    area = np.array([tri.area for tri in faces], dtype=np.float64)
    pick = rng.choice(len(faces), sample_count, p=area / area.sum())
    start = rng.random((sample_count, 3), dtype=np.float32)
    root = np.sqrt(start[:, 0])
    weights = np.stack([1 - root, root * (1 - start[:, 1]), root * start[:, 1]], axis=1)

    def sample(data, indices_for_attribute):
        return np.einsum('nij,ni->nj', data[indices_for_attribute[pick]], weights)

    vertices = np.array([v.co[:] for v in mesh.vertices], dtype=np.float32)
    normals = np.array([v.normal[:] for v in mesh.vertices], dtype=np.float32)
    coords = sample(vertices, indices)
    normal = sample(normals, indices)
    normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-6)
    x, y, z = coords.T
    wave = np.sin(19 * x - 24 * z + 16 * y) * np.cos(37 * x + 13 * y)
    patch = np.sin(57 * x + 31 * z) * np.cos(42 * y + 19 * z)
    shear = np.cos(91 * x + 49 * y - 54 * z) * np.sin(45 * y + 64 * z)
    nap = np.array([a.vector[:] for a in mesh.attributes['_nap'].data], dtype=np.float32)
    flow = sample(nap, indices)
    direction = flow[:, (0, 2, 1)] * np.array([1, -1, 1], dtype=np.float32)
    name = shell.name
    face = name.startswith('Head')
    ear = 'ear ·' in name
    foot = 'foot and bent leg' in name
    scale = 1.0
    if face:
        scale = .93
    if ear:
        scale = 1.06
    if foot:
        scale = 1.07 * (.24 + .76 * np.clip((z - .039) / .095, 0, 1))
    direction[:, 0] += .063 * wave + .045 * patch
    direction[:, 1] += .048 * shear
    direction += rng.normal(0, .043, direction.shape).astype(np.float32)
    direction -= (direction * normal).sum(axis=1, keepdims=True) * normal
    direction /= np.maximum(np.linalg.norm(direction, axis=1, keepdims=True), 1e-6)
    cross = np.cross(direction, normal)

    seam = abs(x - .008 * np.sin(z * 8.5) - .0032 * np.sin(z * 25))
    pinch = 1 - .30 * np.exp(-(seam / .026) ** 2) * np.clip((-y - .13) / .17, 0, 1) if face or 'Body' in name else 1
    length = (.017 + .028 * start[:, 2] ** .85) * (1 + .12 * wave + .058 * patch) * scale * pinch
    if face:
        near_eye = np.hypot((abs(x) - .325) / .027, (z - 2.28) / .043)
        near_nose = np.hypot(x / .071, (z - 2.15) / .047)
        near_mouth = np.hypot(x / .066, (z - 2.058) / .034)
        keep = (y > -.36) | (np.minimum(np.minimum(near_eye, near_nose), near_mouth) > .89)
        length *= np.where((y < -.39) & (near_eye < 1.55), .48, 1)
    else:
        keep = np.ones(sample_count, dtype=bool)

    loft = (.18 + start[:, 1] * .25 + .057 * patch) * np.clip(pinch, .55, 1)
    if face:
        loft *= .74
    lift = loft[:, None] * length[:, None] * normal
    run = length[:, None] * direction
    turn = cross * (length * (.075 * shear + rng.normal(0, .046, sample_count)))[:, None]
    points = np.stack([coords - normal * .0012, coords + run * .14 + lift * .47,
                       coords + run * .45 + lift * .94 + turn * .28,
                       coords + run * .76 + lift + turn * .70,
                       coords + run + lift * .76 + turn], axis=1)[keep]
    radii = (.00032 + .00026 * start[:, 0])[:, None] * np.array([.80, 1, .85, .53, .05], dtype=np.float32)
    uv_map = np.array([item.uv[:] for item in mesh.uv_layers.active.data], dtype=np.float32)
    uv = sample(uv_map, corners)
    h, w, _ = palette.shape
    dye = palette[(np.floor((1 - uv[:, 1]) * h).astype(int) % h),
                  (np.floor(uv[:, 0] * w).astype(int) % w)]
    dye = np.clip(dye * .70 + np.array([.926, .812, .724]) * .30, 0, 1)
    tint = np.where(dye <= .04045, dye / 12.92, ((dye + .055) / 1.055) ** 2.4)
    tint *= (.925 + .105 * start[:, 1] + .037 * wave + .017 * patch)[:, None]
    pigment = np.concatenate((tint, np.ones((sample_count, 1))), axis=1)

    data = bpy.data.hair_curves.new(name + ' · fine plush')
    data.surface = shell
    data.surface_uv_map = mesh.uv_layers.active.name
    data.add_curves([5] * len(points))
    data.attributes['position'].data.foreach_set('vector', np.ascontiguousarray(points, dtype=np.float32).ravel())
    data.attributes.new('radius', 'FLOAT', 'POINT').data.foreach_set('value', np.ascontiguousarray(radii[keep], dtype=np.float32).ravel())
    data.attributes.new('Fiber tint', 'FLOAT_COLOR', 'CURVE').data.foreach_set('color', np.ascontiguousarray(pigment[keep], dtype=np.float32).ravel())
    data.materials.append(material)
    obj = bpy.data.objects.new(name + ' · fine plush', data)
    target.objects.link(obj)
    return obj


def scatter_pile(mats, target, palettes):
    rng = random.Random(436)
    vertices, colors, faces, normals = [], [], [], []
    averages = {key: pixels.mean(axis=(0, 1)) for key, pixels in palettes.items()}
    for obj, count, tints in GROOM:
        mesh = obj.data
        mesh.calc_loop_triangles()
        triangles = [tri for tri in mesh.loop_triangles
                     if mesh.materials[mesh.polygons[tri.polygon_index].material_index]
                     in (mats['plush'], mats.get('previous_plush')) and tri.area > 1e-10]
        area = list(accumulate(tri.area for tri in triangles))
        texcoords = [loop.uv.copy() for loop in mesh.uv_layers.active.data]
        coords = [v.co.copy() for v in mesh.vertices]
        directions = [v.normal.copy() for v in mesh.vertices]
        name = obj.name
        face_piece = name.startswith('Head')
        tail_piece = name.startswith('Tail')
        card_count = round(count * (1.22 if mats.get('previous_plush') else .57))
        for _ in range(card_count):
            tri = triangles[bisect_left(area, rng.random() * area[-1])]
            a, b, c = tri.vertices
            u, v = rng.random(), rng.random()
            if u + v > 1:
                u, v = 1 - u, 1 - v
            w = 1 - u - v
            p = coords[a] * w + coords[b] * u + coords[c] * v
            if face_piece and p.y < -.4 and 2.02 < p.z < 2.330:
                if abs(p.x) < .074 or abs(abs(p.x) - .325) < .033:
                    continue
            normal = (directions[a] * w + directions[b] * u + directions[c] * v).normalized()
            surface_material = mesh.materials[mesh.polygons[tri.polygon_index].material_index]
            previous = surface_material == mats.get('previous_plush')
            if previous:
                sideways = .29 * math.sin(11 * p.z + 19 * p.x) + rng.uniform(-.27, .27)
                if face_piece:
                    sideways += .42 * math.tanh(p.x * 7)
                comb = Vector((sideways, -.36, -1))
            else:
                comb = nap_direction(name, p)
                comb.x += .11 * math.sin(17 * p.z + 21 * p.x) + rng.uniform(-.14, .14)
                comb.y += .14 * math.sin(p.x * 15 - p.z * 21)
            tangent = (comb - normal * comb.dot(normal)).normalized()
            if tangent.length_squared < .001:
                tangent = normal.cross(RIGHT).normalized()
            cross = tangent.cross(normal)
            length = rng.uniform(.016, .039) * (1.24 if tail_piece else 1)
            if face_piece and not previous:
                length *= .86 + .23 * smoothstep(2.26, 2.71, p.z)
            half_width = rng.uniform(.00033, .00074)
            start = p - normal * .0011
            bend = rng.uniform(-.085, .085) * length
            middle = p + tangent * length * .50 + normal * length * .27
            end = p + tangent * length * .99 + normal * length * .23 + cross * bend
            j = len(vertices)
            vertices.extend((start - cross * half_width, start + cross * half_width, middle - cross * half_width * .57,
                             middle + cross * half_width * .57, end))
            faces.extend(((j, j + 3, j + 1), (j, j + 2, j + 3), (j + 2, j + 4, j + 3)))
            normals.extend((normal,) * 5)
            tint = tints[a][0] * w + tints[b][0] * u + tints[c][0] * v
            loop_a, loop_b, loop_c = tri.loops
            uv = texcoords[loop_a] * w + texcoords[loop_b] * u + texcoords[loop_c] * v
            palette = 'previous_plush' if previous else 'plush'
            pile_color = palettes[palette]
            height, width, _ = pile_color.shape
            pixel = pile_color[int((1 - uv.y) * height) % height, int(uv.x * width) % width]
            base = srgb((.76 * pixel + .24 * averages[palette]).clip(0, 1))
            r = tint * rng.uniform(.99, 1.061)
            for step in (.96, .96, 1.015, 1.015, 1.055):
                colors.append((*[min(1, x * r * step) for x in base], 1))
    pile = mesh_object('Groom · individual short fibers', vertices, faces, [mats['pile']], target, colors=colors)
    pile.data.normals_split_custom_set_from_vertices(normals)
    return pile


def add_photo_linen(studio, scale):
    width, length = 122, 128
    vertices, uv = [], []
    for row in range(length + 1):
        y = -4.6 + 9.1 * row / length
        for col in range(width + 1):
            x = -5.4 + 10.8 * col / width
            contact = math.exp(-((x / .91) ** 6 + ((y + .42) / 1.08) ** 6))
            folds = .062 * math.sin(4.20 * y + .72 * x + .66 * math.sin(x * 1.7))
            folds += .031 * math.sin(8.8 * y - x * 1.18 + .9 * math.sin(x * 2.3 + y))
            diagonal = y + 2.03 + .24 * x + .43 * math.sin(x * .83)
            folds += .147 * math.exp(-(diagonal / .39) ** 2) - .058 * math.exp(-((diagonal + .37) / .17) ** 2)
            z = .002 + (1 - contact * .993) * folds
            vertices.append((x * scale, y * scale, z * scale))
            uv.append((x * .56, y * .56 + .047 * math.sin(4.6 * y + x) * (1 - contact)))
    faces = []
    for j in range(length):
        for i in range(width):
            p = j * (width + 1) + i
            faces.append((p, p + 1, p + width + 2, p + width + 1))
    return mesh_object('Studio · woven linen and folds', vertices, faces, [linen_material()], studio,
                       uv_rows=[[uv[i] for i in face] for face in faces])


def add_studio(scale, photo=False):
    studio = collection('Studio · render only')

    def aim(obj, target):
        obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

    def studio_point(x, y, z):
        return (x * scale, y * scale, z * scale)

    def area(name, at, aim_at, power, size, color):
        data = bpy.data.lights.new(name, 'AREA')
        data.energy = power
        data.shape = 'DISK'
        data.size = size
        data.color = color
        obj = bpy.data.objects.new(name, data)
        studio.objects.link(obj)
        obj.location = studio_point(*at)
        aim(obj, studio_point(*aim_at))

    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new('Studio · ambient light')
    scene.world.use_nodes = True
    world = scene.world.node_tree.nodes.get('Background')
    world.inputs['Color'].default_value = (.62, .54, .46, 1)
    world.inputs['Strength'].default_value = .23 if photo else .31
    scene.view_settings.view_transform = 'AgX'
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    if photo:
        scene.view_settings.look = 'AgX - Medium High Contrast'
        scene.view_settings.exposure = -.26
        area('Window · large soft key', (-4.7, -2.6, 5.15), (0, 0, 1.13), 10.9, .34, (1, .89, .79))
        area('Room · soft bounce', (3.65, -4.0, 2.65), (0, 0, 1.32), 5.5, .57, (.98, .97, .96))
        area('Window · edge bounce', (-1.5, 3.55, 4.4), (0, 0, 1.38), 1.95, .33, (1, .91, .82))
        add_photo_linen(studio, scale)
    else:
        area('Softbox · main', (-3.4, -4.1, 5.2), (0, 0, 1.3), 13, .49, (1, .91, .82))
        area('Softbox · bounce', (3.0, -2.0, 2.6), (0, 0, 1.25), 4.5, .43, (.94, .96, 1))
        area('Softbox · rear', (1.2, 2.2, 4.4), (0, 0, 1.55), 8.0, .38, (1, .91, .80))
    floor = material('Studio · warm chalk', [.714, .638, .551] if photo else [.671, .584, .491], .89, 0)
    sweep = [(-8, -.16), (2.9, -.16)] if photo else [(-8, 0), (2.9, 0)]
    sweep.extend((2.9 + 2.2 * math.sin(a), 2.2 * (1 - math.cos(a)))
                 for a in (i * PI / 40 for i in range(1, 21)))
    sweep.append((5.1, 10))
    sweep_vertices = [studio_point(x, y, z) for y, z in sweep for x in (-8, 8)]
    sweep_faces = [(i, i + 1, i + 3, i + 2) for i in range(0, len(sweep_vertices) - 2, 2)]
    mesh_object('Studio · curved backdrop', sweep_vertices, sweep_faces, [floor], studio)
    if photo:
        fit_photo_backdrop()

    camera = bpy.data.objects.new('Camera · reference view', bpy.data.cameras.new('Camera · reference view'))
    studio.objects.link(camera)
    camera.location = studio_point(.10, -6.9, 2.27) if photo else studio_point(.30, -7.1, 2.29)
    aim(camera, studio_point(0, -.18, 1.46) if photo else studio_point(0, -.11, 1.43))
    camera.data.lens = 65 if photo else 68
    camera.data.clip_start = .005
    if photo:
        camera.data.dof.use_dof = True
        camera.data.dof.focus_distance = (camera.location - Vector(studio_point(0, -.67, 1.36))).length
        camera.data.dof.aperture_fstop = 13.5
    scene.camera = camera

    ref_image = bpy.data.images.load(str(DIRECTORY / 'reference.jpg'))
    ref_image.pack()
    ref_image.filepath = '//reference.jpg'
    reference = bpy.data.objects.new('Reference · approved front concept', None)
    reference.empty_display_type = 'IMAGE'
    reference.data = ref_image
    reference.empty_display_size = .328
    reference.location = (.37, .17, .157)
    reference.rotation_euler[0] = PI / 2
    studio.objects.link(reference)
    studio.hide_select = True

    for screen in bpy.data.screens:
        for region in screen.areas:
            if region.type == 'VIEW_3D':
                space = region.spaces.active
                space.clip_start = .001
                space.overlay.show_overlays = False
                space.shading.color_type = 'MATERIAL'
                space.shading.light = 'STUDIO'
                space.shading.show_cavity = True
                space.region_3d.view_location = studio_point(0, -.1, 1.42)
                space.region_3d.view_distance = .61
                space.region_3d.view_rotation = camera.rotation_euler.to_quaternion()
    return scene


def main(pilot=False, output=DIRECTORY):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats, palettes = make_materials(pilot)
    subject = collection(RABBIT_ROOT_NAME)
    pieces = [collection(name) for name in ('Pattern pieces', 'Embroidery and seams', 'Floral bow', 'Short pile groom')]
    for group in pieces:
        subject.children.link(group)
        bpy.context.scene.collection.children.unlink(group)
    shell, details, bow, groom = pieces
    head_materials = [mats['plush'], mats['previous_plush']] if pilot else [mats['plush']]
    head = surface('Head · forehead and cheeks', lambda t, a: shaped_head(t, a, pilot),
                   lambda t, u, p, part: (head_uv if part else head_nap_uv)(t, u, p, part),
                   lambda t, a, p: head_panel_tint(t, a, p, pilot),
                   head_materials, shell, rings=102, sides=144, groom=9400,
                   section=(lambda a, _t: int(math.sin(a) < 0)) if pilot else None)
    original_plush = mats['previous_plush'] if pilot else mats['plush']
    body_surface = body_point if pilot else stuffed_body
    body_uv = pile_uv(3, 1.76, .15) if pilot else body_nap_uv
    surface('Body · seated pear shape', body_surface, body_uv, body_tint,
            [original_plush], shell, rings=86, sides=112, groom=7500)
    make_limbs(mats, shell, pilot)
    make_ear(-1, 'Left ear', shell, details, mats, pilot)
    make_ear(1, 'Right ear', shell, details, mats, pilot)
    make_tail(original_plush, shell)
    make_bow(mats, bow)
    make_face(head, mats, details)
    bake_contact_occlusion()
    for surface_obj, _count, _colors in GROOM:
        bake_nap(surface_obj)
    authoring = None if pilot else collection('Combed hair curves · Blender render')
    pile = scatter_pile(mats, groom, palettes)
    curves = []
    if authoring:
        fiber_material = photo_fiber_material()
        for index, (surface_obj, count, _colors) in enumerate(GROOM):
            curves.append(groom_photo_fibers(surface_obj, authoring, palettes['plush'], round(count * 10.4),
                                             fiber_material, 3151 + index * 29))

    model_objects = list(subject.all_objects)
    low = min(vertex.co.z for obj in model_objects if obj != pile for vertex in obj.data.vertices)
    high = max(vertex.co.z for obj in model_objects if obj != pile for vertex in obj.data.vertices)
    scale = .30 / (high - low)
    root = bpy.data.objects.new(RABBIT_ROOT_NAME, None)
    subject.objects.link(root)
    root.empty_display_size = .036
    root.scale = (scale,) * 3
    root.location.z = -low * scale
    root['Reference'] = 'ImageGen concept · seated floral lop-eared rabbit'
    root['Units'] = '0.30 m from the floor to the top of the seated mesh before the fiber layer'
    for obj in model_objects:
        obj.parent = root
    for obj in curves:
        obj.parent = root
    if curves:
        pile.hide_render = True

    scene = add_studio(scale, photo=not pilot)
    scene.unit_settings.system = 'METRIC'
    bpy.context.view_layer.update()
    for obj in [root, *model_objects]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = head
    bpy.context.preferences.filepaths.save_version = 0
    output.mkdir(parents=True, exist_ok=True)
    if not pilot:
        bpy.ops.wm.save_as_mainfile(filepath=str(output / 'plush-rabbit.blend'), compress=True)
    bpy.ops.export_scene.gltf(filepath=str(output / 'plush-rabbit.glb'), export_format='GLB',
                             use_selection=True, export_normals=True, export_tangents=True, export_attributes=True,
                             export_vertex_color='ACTIVE', export_all_vertex_colors=False,
                             export_meshopt_compression_enable=True,
                             export_meshopt_extension='EXT_meshopt_compression', export_animations=False,
                             export_lights=False, export_cameras=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pilot', action='store_true', help='Export a split material study without changing the final asset.')
    parser.add_argument('--output', type=Path, default=DIRECTORY)
    options = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if options.pilot and options.output.resolve() == DIRECTORY:
        parser.error('Use --output to write the pilot outside the model directory.')
    main(options.pilot, options.output.resolve())

"""Bake the photograph and traced fin reference into portable PBR materials."""

from math import ceil, tau

import bpy
import numpy as np


LUMA = np.array((0.2126, 0.7152, 0.0722), dtype=np.float32)
BODY_MAP_SIZE = (4096, 2048)

# The clean side view straightens the fish. Match its body stations to
# columns in the photograph, following the photographed back and belly.
PHOTO_BODY_GUIDES = np.array([
    (355, 490, 456, 573), (399, 517, 458, 566), (447, 546, 451, 566),
    (520, 586, 413, 586), (580, 621, 369, 609), (650, 663, 344, 629),
    (740, 709, 326, 641), (800, 746, 319, 648), (900, 802, 314, 646),
    (975, 849, 309, 632), (1050, 895, 304, 608), (1200, 990, 291, 582),
    (1370, 1096, 281, 551), (1480, 1163, 276, 515), (1575, 1220, 274, 481),
    (1660, 1271, 275, 453), (1730, 1312, 273, 424), (1790, 1342, 270, 390),
    (1830, 1364, 269, 351), (1872, 1386, 271, 312), (1900, 1403, 274, 295),
    (1912, 1411, 279, 292),
])

# Each row pairs a fin patch on the clean side with the same photographed
# region. Interpolate their color corrections over the projected fin atlas.
PHOTO_FIN_GUIDES = (
    (150, 230, 341, 437, 95), (62, 359, 299, 518, 95),
    (151, 525, 334, 625, 115), (320, 361, 433, 539, 100),
    (385, 420, 504, 544, 92),
    (342, 157, 471, 382, 82), (449, 120, 520, 362, 93),
    (553, 58, 591, 317, 92), (652, 92, 653, 329, 100),
    (443, 612, 542, 663, 106), (596, 708, 658, 713, 112),
    (699, 712, 720, 724, 114), (859, 643, 818, 680, 105),
    (1612, 438, 1251, 488, 105), (1505, 545, 1220, 552, 110),
    (1377, 635, 1180, 609, 108),
    (1187, 557, 1007, 588, 100), (1090, 610, 959, 615, 95),
)


def _blur(pixels, sigma):
    radius = ceil(3 * sigma)
    weights = np.exp(-0.5 * (np.arange(-radius, radius + 1) / sigma) ** 2)
    weights = (weights / weights.sum()).astype(np.float32)
    for axis in (0, 1):
        if axis == 1:
            pixels = pixels.swapaxes(0, 1)
        padding = [(radius, radius)] + [(0, 0)] * (pixels.ndim - 1)
        padded = np.pad(pixels, padding, mode="edge")
        filtered = np.zeros_like(pixels)
        for offset, weight in enumerate(weights):
            filtered += weight * padded[offset : offset + len(pixels)]
        pixels = filtered.swapaxes(0, 1) if axis == 1 else filtered
    return pixels


def _smoothstep(start, stop, value):
    t = np.clip((value - start) / (stop - start), 0, 1)
    return t * t * (3 - 2 * t)


def _mix(first, second, amount):
    return first + (second - first) * amount


def _read_pixels(image):
    width, height = image.size
    pixels = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    return pixels.reshape(height, width, 4)[::-1]


def _clean_color(rgba):
    alpha = rgba[..., 3:4]
    rgb = rgba[..., :3]
    smooth = _blur(rgb * alpha, 1.15) / np.maximum(_blur(alpha, 1.15), 1e-5)
    gradient_y, gradient_x = np.gradient(smooth @ LUMA)
    rim = _smoothstep(0.011, 0.044, np.hypot(gradient_x, gradient_y))
    # Keep the narrow scale lips and fin rays while quieting the plate interiors.
    detail = (0.19 + 0.56 * rim)[..., None] * _smoothstep(0.38, 0.94, alpha)
    clean = _mix(smooth, rgb, detail)
    return clean * (1 - 0.13 * _smoothstep(0.64, 0.98, clean @ LUMA))[..., None]


def _sample(image, x, y):
    x = np.clip(x, 0, image.shape[1] - 1)
    y = np.clip(y, 0, image.shape[0] - 1)
    x0, y0 = x.astype(np.intp), y.astype(np.intp)
    x1 = np.minimum(x0 + 1, image.shape[1] - 1)
    y1 = np.minimum(y0 + 1, image.shape[0] - 1)
    dx, dy = (x - x0).astype(np.float32)[..., None], (y - y0).astype(np.float32)[..., None]
    first = _mix(image[y0, x0], image[y0, x1], dx)
    second = _mix(image[y1, x0], image[y1, x1], dx)
    return _mix(first, second, dy)


def _scale_photo(photo):
    """Recover the photographed scale edges with gentle smoothing inside the plates."""
    smooth = _blur(photo, 1.45)
    luminance = smooth @ LUMA
    fine = _blur(photo @ LUMA, 0.60)
    gradient = np.hypot(*np.gradient(fine)) / (fine + 0.12)
    edge = _smoothstep(0.020, 0.105, gradient)
    detail = (fine - luminance) * (0.15 + 1.10 * edge)
    return np.clip(smooth * (1 + detail / (luminance + 0.019))[..., None], 0, 1)


def _body_albedo(photo, body_profile, x_range):
    width, height = BODY_MAP_SIZE
    x = _mix(*x_range, (np.arange(width, dtype=np.float32) + 0.5) / width)
    theta = tau * (1 - (np.arange(height, dtype=np.float32) + 0.5) / height)
    top, bottom, _ = body_profile(x).T
    center = 0.5 * (bottom + top)
    depth = 0.5 * (bottom - top)
    inset = np.minimum(5.5, 0.23 * depth)
    y = center - (depth - inset) * np.cos(theta[:, None])

    side_height = (y - top) / (bottom - top)
    station, source_x, source_top, source_bottom = PHOTO_BODY_GUIDES.T
    photo_x = np.interp(x, station, source_x)
    photo_top = np.interp(x, station, source_top)
    photo_bottom = np.interp(x, station, source_bottom)
    photo_y = _mix(photo_top, photo_bottom, 0.02 + 0.94 * side_height)
    albedo = _sample(photo, photo_x, photo_y)

    # Remove the photograph's iris from the skin under the separate 3D eye.
    eye = ((photo_x - 1348) / 24) ** 2 + ((photo_y - 318) / 26) ** 2
    brow = _sample(photo, np.array(1350), np.array(285))
    cheek = _sample(photo, np.array(1349), np.array(353))
    socket = _mix(brow, cheek, _smoothstep(286, 351, photo_y)[..., None])
    albedo = _mix(albedo, socket, (1 - _smoothstep(0.60, 1.29, eye))[..., None])

    # Blend the last strip below the exposed flank into adjoining belly skin.
    belly = _sample(photo, photo_x, _mix(photo_top, photo_bottom, 0.85))
    belly = _blur(belly[None, ...], 10)[0]
    pectoral = _smoothstep(1330, 1460, x) * (1 - _smoothstep(1615, 1690, x))
    hidden = _smoothstep(0.89 - 0.06 * pectoral, 0.99, side_height)
    albedo = _mix(albedo, belly, hidden[..., None])

    # Recover midtone color in the shaded scales while protecting the bright gill and belly.
    lightness = _blur(albedo @ LUMA, 18)
    midtones = _smoothstep(0.012, 0.095, lightness) * (1 - _smoothstep(0.27, 0.57, lightness))
    flank = _smoothstep(0.53, 0.84, side_height) * _smoothstep(680, 1080, x)
    flank *= 1 - _smoothstep(1780, 1910, x)
    gain = 1.05 + 0.27 * midtones + 0.18 * flank
    albedo = np.clip(albedo * gain[..., None], 0, 1)
    seam = (0.75 * np.exp(-((np.sin(theta) / 0.25) ** 2)))[:, None, None]
    return _mix(albedo, _blur(albedo, 7.4), seam)


def _fin_albedo(color, photo):
    yy, xx = np.ogrid[: color.shape[0], : color.shape[1]]
    correction = np.zeros_like(color)
    total = np.zeros_like(color[..., 0])
    for x, y, px, py, spread in PHOTO_FIN_GUIDES:
        target = np.median(photo[py - 5 : py + 6, px - 5 : px + 6], axis=(0, 1))
        original = np.median(color[y - 8 : y + 9, x - 8 : x + 9], axis=(0, 1))
        change = np.clip(target * 1.10 + 0.017, 0, 1) - original
        weight = np.exp(-0.5 * ((xx - x) ** 2 + (yy - y) ** 2) / spread**2)
        correction += weight[..., None] * change
        total += weight
    return np.clip(color + correction / np.maximum(total[..., None], 1e-5), 0, 1)


def _dorsal_root(fin_color, alpha, body_color, body_profile, body_range, dorsal_range):
    """Blend the fin rays into the skin where the membrane enters the back."""
    y, x = np.ogrid[:alpha.shape[0], :alpha.shape[1]]
    back = body_profile(x[0])[:, 0]
    offset = y - back
    start, end = dorsal_range
    along_root = _smoothstep(start, start + 22, x) * (1 - _smoothstep(end - 21, end, x))
    contact = along_root * _smoothstep(-24, -7, offset) * (1 - _smoothstep(16, 28, offset))
    contact *= _smoothstep(0.30, 0.86, alpha)

    # Borrow the colors on either side of the contact from the two baked surfaces.
    fin_y = back - 27
    fin_edge = _sample(fin_color, x[0], fin_y)
    visible = _sample(alpha[..., None], x[0], fin_y)[..., 0]
    contact *= _smoothstep(0.40, 0.82, visible)
    u = (x[0] - body_range[0]) / (body_range[1] - body_range[0]) * body_color.shape[1] - 0.5
    skin = _sample(body_color[:1], u, np.zeros_like(u))
    transition = _mix(fin_edge, skin, _smoothstep(-19, 5, offset)[..., None])
    fin_color = _mix(fin_color, transition, contact[..., None])
    alpha = _mix(alpha, 0.99, contact * _smoothstep(-12, -1, offset))
    return fin_color, alpha, contact


def _normal_map(luminance, amplitude, *, filter_scale=1):
    height = _blur(luminance, 1.35 * filter_scale) - _blur(luminance, 7.2 * filter_scale)
    gy, gx = np.gradient(height)
    # The PNG rows run down, while tangent-space V runs up.
    nx = np.clip(-gx * amplitude, -0.18, 0.18)
    ny = np.clip(gy * amplitude, -0.18, 0.18)
    normal = np.stack((nx, ny, np.sqrt(1 - nx * nx - ny * ny)), axis=-1)
    return normal * 0.5 + 0.5


def _image(name, pixels, *, data=False):
    height, width, channels = pixels.shape
    image = bpy.data.images.new(
        name,
        width=width,
        height=height,
        alpha=channels == 4,
        is_data=data,
    )
    image.colorspace_settings.name = "Non-Color" if data else "sRGB"
    if channels == 3:
        pixels = np.concatenate((pixels, np.ones((height, width, 1), dtype=np.float32)), axis=-1)
    image.pixels.foreach_set(np.ascontiguousarray(np.clip(pixels[::-1], 0, 1), dtype=np.float32).ravel())
    image.update()
    image.pack()
    return image


def _material(name, color, roughness, *, specular=0.38, coat=0.0, coat_roughness=0.34, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    surface = material.node_tree.nodes["Principled BSDF"]
    surface.inputs["Base Color"].default_value = (*color, 1)
    surface.inputs["Metallic"].default_value = metallic
    surface.inputs["Roughness"].default_value = roughness
    surface.inputs["IOR"].default_value = 1.42
    surface.inputs["Specular IOR Level"].default_value = specular
    surface.inputs["Coat Weight"].default_value = coat
    surface.inputs["Coat Roughness"].default_value = coat_roughness
    return material, surface


def _texture_node(material, image):
    node = material.node_tree.nodes.new("ShaderNodeTexImage")
    node.image = image
    node.extension = "EXTEND"
    return node


def _add_normal(material, surface, image, strength):
    texture = _texture_node(material, image)
    normal = material.node_tree.nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value = strength
    material.node_tree.links.new(texture.outputs["Color"], normal.inputs["Color"])
    material.node_tree.links.new(normal.outputs["Normal"], surface.inputs["Normal"])


def _fin_material(name, color_image, normal_image, roughness, *, specular):
    fin, surface = _material(name, (0.5, 0.08, 0.04), roughness, specular=specular, coat=0.04)
    fin.surface_render_method = "BLENDED"
    fin.use_backface_culling = False
    color = _texture_node(fin, color_image)
    fin.node_tree.links.new(color.outputs["Color"], surface.inputs["Base Color"])
    fin.node_tree.links.new(color.outputs["Alpha"], surface.inputs["Alpha"])
    _add_normal(fin, surface, normal_image, 0.55)
    return fin


def create_materials(concept_image, reference_photo, body_profile, x_range, dorsal_range):
    """Return rig-ready materials and pack their textures into the Blender file."""
    rgba = _read_pixels(concept_image)
    photo = _read_pixels(reference_photo)[..., :3]
    color = _clean_color(rgba)
    albedo = _body_albedo(_scale_photo(photo), body_profile, x_range)
    luminance = albedo @ LUMA
    width, height = BODY_MAP_SIZE
    roughness_luminance = luminance.reshape(height // 2, 2, width // 2, 2).mean(axis=(1, 3))
    roughness = np.clip(0.47 - 0.12 * _blur(roughness_luminance, 3.1), 0.37, 0.47)

    body, surface = _material(
        "Vermilion · satin scales",
        (0.16, 0.13, 0.16),
        0.47,
        coat=0.18,
        coat_roughness=0.29,
        metallic=0.05,
    )
    body_color = _texture_node(body, _image("Vermilion body color", albedo))
    body.node_tree.links.new(body_color.outputs["Color"], surface.inputs["Base Color"])
    roughness_map = np.repeat(roughness[..., None], 3, axis=-1)
    roughness_texture = _texture_node(body, _image("Vermilion body roughness", roughness_map, data=True))
    channels = body.node_tree.nodes.new("ShaderNodeSeparateColor")
    body.node_tree.links.new(roughness_texture.outputs["Color"], channels.inputs["Color"])
    body.node_tree.links.new(channels.outputs["Green"], surface.inputs["Roughness"])
    body_normal = _normal_map(luminance, 8.6, filter_scale=1.65)
    _add_normal(body, surface, _image("Vermilion body normal", body_normal, data=True), 0.66)

    y, x = np.ogrid[: rgba.shape[0], : rgba.shape[1]]
    paired = _smoothstep(970, 1050, x) * _smoothstep(383, 445, y)
    fin_luminance = color @ LUMA
    # Finer membranes let more of the background through between the rays.
    ray_contrast = _blur(fin_luminance, 1.4) - _blur(fin_luminance, 5)
    rays = _smoothstep(-0.026, 0.035, ray_contrast)
    opacity = _mix(0.88, 0.69, paired) + _mix(0.10, 0.15, paired) * rays
    alpha = _smoothstep(0.01, 0.98, rgba[..., 3]) * opacity
    # Preserve the photo's red-orange median fins under the cool bounce light.
    fin_photo = _mix(_blur(photo, 1.65), photo, 0.10)
    fin_albedo = _fin_albedo(color, fin_photo)
    median_tint = np.array((1, 0.94, 0.84), dtype=np.float32)
    fin_albedo *= _mix(median_tint, 1, paired[..., None])
    fin_albedo, alpha, contact = _dorsal_root(fin_albedo, alpha, albedo, body_profile, x_range, dorsal_range)
    fin_color = _image("Vermilion fin ray color and opacity", np.dstack((fin_albedo, alpha)))
    fin_normal = _normal_map(fin_luminance, 4.6)
    surface_detail = _smoothstep(0.22, 0.85, alpha) * (1 - 0.80 * contact)
    fin_normal = _mix(np.array((0.5, 0.5, 1), dtype=np.float32), fin_normal, surface_detail[..., None])
    fin_normal = _image("Vermilion fin ray normal", fin_normal, data=True)
    tail_fins = _fin_material("Vermilion · red median fins", fin_color, fin_normal, 0.43, specular=0.25)
    paired_fins = _fin_material("Vermilion · translucent paired fins", fin_color, fin_normal, 0.47, specular=0.34)

    eye, eyewall = _material(
        "Vermilion · wet iris",
        (0.012, 0.036, 0.034),
        0.21,
        specular=0.55,
        coat=0.30,
        coat_roughness=0.18,
    )
    iris = eye.node_tree.nodes.new("ShaderNodeVertexColor")
    iris.layer_name = "Eye Color"
    eye.node_tree.links.new(iris.outputs["Color"], eyewall.inputs["Base Color"])

    barbel, _ = _material("Vermilion · coral barbels", (0.41, 0.095, 0.083), 0.43, coat=0.09)
    return {"body": body, "tail_fins": tail_fins, "paired_fins": paired_fins, "eye": eye, "barbel": barbel}

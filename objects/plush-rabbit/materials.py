"""Prepare PBR maps from the rabbit's ImageGen textile swatches."""

import math
import struct
import tempfile
import zlib
from pathlib import Path

import bpy
import numpy as np


PLUSH_COLOR = (.920, .816, .742)


def image_from_pixels(directory, name, pixels, color_space, jpeg_quality=None):
    if pixels.ndim == 2:
        pixels = pixels[..., None]
    pixels = np.round(np.clip(pixels, 0, 1) * 255).astype(np.uint8)
    height, width, channels = pixels.shape
    filtered = pixels.copy()
    filtered[:, 1:] -= pixels[:, :-1]
    scanlines = b''.join(b'\x01' + row.tobytes() for row in filtered)

    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))

    path = directory / f'{name}.png'
    path.write_bytes(
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2 if channels == 3 else 0, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(scanlines, 7))
        + chunk(b'IEND', b'')
    )
    image = bpy.data.images.load(str(path))
    image.colorspace_settings.name = color_space
    if jpeg_quality is not None:
        jpeg = path.with_suffix('.jpg')
        image.file_format = 'JPEG'
        image.save(filepath=str(jpeg), quality=jpeg_quality)
        bpy.data.images.remove(image)
        image = bpy.data.images.load(str(jpeg))
        image.colorspace_settings.name = color_space
        path = jpeg
    image.pack()
    image.filepath = f'//{path.name}'
    return image


def read_rgb(path):
    image = bpy.data.images.load(str(path))
    try:
        width, height = image.size
        pixels = np.empty(width * height * 4, dtype=np.float32)
        image.pixels.foreach_get(pixels)
        return pixels.reshape(height, width, 4)[::-1, :, :3].copy()
    finally:
        bpy.data.images.remove(image)


def blur(pixels, sigma):
    height, width = pixels.shape
    fy = np.fft.fftfreq(height)[:, None]
    fx = np.fft.rfftfreq(width)[None, :]
    weight = np.exp(-2 * (np.pi * sigma) ** 2 * (fx * fx + fy * fy))
    return np.fft.irfft2(np.fft.rfft2(pixels) * weight, s=pixels.shape).astype(np.float32)


def luminance(rgb):
    return rgb @ np.array([.2126, .7152, .0722], dtype=np.float32)


def feather_tile(rgb, overlap):
    # Blend opposite borders across a narrow overlap for continuous UV repeats.
    t = np.linspace(0, 1, overlap, dtype=np.float32)
    fade = (t * t * (3 - 2 * t))[None, :, None]
    for _ in range(2):
        edge = rgb[:, :overlap] * fade + rgb[:, -overlap:] * (1 - fade)
        rgb = np.concatenate((edge, rgb[:, overlap:-overlap]), axis=1).transpose(1, 0, 2)
    return rgb


def normal_map(height, strength):
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * strength
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * strength
    normals = np.stack((-dx, dy, np.ones_like(height)), axis=-1)
    return normals / np.linalg.norm(normals, axis=-1, keepdims=True) * .5 + .5


def pack_pbr_maps(directory, label, base, normal, roughness, *, base_quality=None):
    return (
        image_from_pixels(directory, f'{label} - Base Color', base, 'sRGB', base_quality),
        image_from_pixels(directory, f'{label} - Tangent Normal', normal, 'Non-Color'),
        image_from_pixels(directory, f'{label} - Roughness', roughness, 'Non-Color'),
    )


def plush_maps(source, directory):
    rgb = feather_tile(read_rgb(source), overlap=62)
    value = luminance(rgb)
    # Keep the medium-scale locks and their roots when the texture is minified.
    fine = blur(value, 1.15)
    tufts = blur(value, 6.0)
    field = blur(value, 58)
    relief = (fine - tufts) * .88 + (tufts - field) * 1.12
    tint = rgb - value[..., None]
    tint -= np.median(tint, axis=(0, 1))
    base = np.array([.917, .818, .735]) + (relief * 1.23)[..., None] + tint * .40
    normal = normal_map(relief, 7.1)
    roughness = np.clip(.88 - (fine - field) * .70, .76, .955)
    return pack_pbr_maps(directory, 'Short plush', base, normal, roughness), base


def combed_plush_maps(source, directory):
    # A small periodic shift groups neighboring fibers without a tiling seam.
    rgb = feather_tile(read_rgb(source), overlap=62)
    h, w, _ = rgb.shape
    y, x = np.mgrid[:h, :w].astype(np.float32)
    shift = 2.5 * np.sin(math.tau * (y / h * 9 + x / w * 11))
    shift += .9 * np.sin(math.tau * (y / h * 17 - x / w * 5))
    sample = x + shift
    left = np.floor(sample).astype(np.int32)
    fraction = (sample - left)[..., None]
    row = y.astype(np.int32)
    rgb = rgb[row, left % w] * (1 - fraction) + rgb[row, (left + 1) % w] * fraction

    value = luminance(rgb)
    fine = blur(value, 1.08) - blur(value, 4.7)
    groups = blur(value, 4.7) - blur(value, 22)
    nap = fine * .47 + groups * .60
    tint = rgb - value[..., None]
    tint -= np.median(tint, axis=(0, 1))
    base = np.array(PLUSH_COLOR) + (nap * 1.24)[..., None] + tint * .24
    normal = normal_map(fine + groups * .38, 2.3)
    roughness = np.clip(.84 - (fine + groups * .55) * .37, .77, .91)
    return pack_pbr_maps(directory, 'Combed short plush', base, normal, roughness, base_quality=96), base


def cotton_maps(source, directory):
    base = read_rgb(source)
    value = luminance(base)
    # Separate the weave from the darker floral ink so the print stays flat.
    fabric = blur(value, 1.05) - blur(value, 3.9)
    pigment_value = blur(value, 5)
    ink = np.percentile(pigment_value, 83) - pigment_value
    relief = fabric * np.clip(1 - ink * 8, .08, 1)
    normal = normal_map(relief, 6.4)
    roughness = np.clip(.91 - relief * 1.15, .84, .96)
    return pack_pbr_maps(directory, 'Floral cotton', base, normal, roughness)


def cotton_weave(shape):
    """Plain weave. Each warp yarn passes above and then below the next weft yarn."""
    height, width = shape
    y, x = np.mgrid[:height, :width].astype(np.float32)
    x /= width
    y /= height
    warp = x * 214 + .13 * np.sin(math.tau * (y * 13 + x * 3)) + .05 * np.sin(math.tau * y * 39)
    weft = y * 202 + .12 * np.sin(math.tau * (x * 11 - y * 4)) + .045 * np.sin(math.tau * x * 37)
    # The yarns are rounded, vary slightly in thickness, and exchange height at crossings.
    yarn_x = ((1 + np.cos(math.tau * warp)) * .5) ** 1.95
    yarn_y = ((1 + np.cos(math.tau * weft)) * .5) ** 1.72
    crossover = np.cos(np.pi * warp) * np.cos(np.pi * weft)
    width_x = .97 + .09 * np.sin(math.tau * (y * 23 + x * 37))
    width_y = .98 + .08 * np.sin(math.tau * (x * 19 - y * 31))
    top_warp = yarn_x * (.67 + .27 * crossover) * width_x
    top_weft = yarn_y * (.67 - .27 * crossover) * width_y
    peaks = np.maximum(top_warp, top_weft)
    lint = .017 * (np.sin(math.tau * (x * 341 + y * 41)) * yarn_x
                   + np.sin(math.tau * (x * 47 - y * 337)) * yarn_y)
    return blur(peaks + lint, .50)


def woven_cotton_maps(source, directory):
    base = read_rgb(source)
    weave = cotton_weave(base.shape[:2])
    value = luminance(base)
    base += (weave - np.mean(weave))[..., None] * .028
    base += np.array([.001, -.010, -.001])
    # Ink colors are carried by the same relief as the unprinted cotton.
    normal = normal_map(weave * .052, 5.6)
    roughness = np.clip(.928 + (.44 - weave) * .083 + (.80 - value) * .017, .84, .973)
    return pack_pbr_maps(directory, 'Woven floral cotton', base, normal, roughness, base_quality=97)


def srgb(values):
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values)


def material(name, color, roughness, sheen, maps=None, vertex_color=False, two_sided=True, normal_strength=1,
             extension='REPEAT', sheen_roughness=.76):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.use_backface_culling = not two_sided
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*srgb(color), 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Specular IOR Level'].default_value = .32
    shader.inputs['Sheen Weight'].default_value = 1 if sheen else 0
    shader.inputs['Sheen Roughness'].default_value = sheen_roughness
    shader.inputs['Sheen Tint'].default_value = (.91 * sheen, .80 * sheen, .68 * sheen, 1)
    result.diffuse_color = (*srgb(color), 1)
    nodes, links = result.node_tree.nodes, result.node_tree.links
    if maps:
        base, normal, rough = maps
        for image, label, row in ((base, 'Color', 0), (normal, 'Normal', -320), (rough, 'Roughness', -640)):
            if image is None:
                continue
            tex = nodes.new('ShaderNodeTexImage')
            tex.image = image
            tex.extension = extension
            tex.label = label
            tex.location = (-640, row)
            if label == 'Color':
                if vertex_color:
                    multiply = nodes.new('ShaderNodeMixRGB')
                    multiply.blend_type = 'MULTIPLY'
                    multiply.inputs[0].default_value = 1
                    multiply.location = (-220, 120)
                    color_node = nodes.new('ShaderNodeVertexColor')
                    color_node.layer_name = 'Tint and occlusion'
                    color_node.location = (-640, 210)
                    links.new(tex.outputs['Color'], multiply.inputs[1])
                    links.new(color_node.outputs['Color'], multiply.inputs[2])
                    links.new(multiply.outputs[0], shader.inputs['Base Color'])
                else:
                    links.new(tex.outputs['Color'], shader.inputs['Base Color'])
            elif label == 'Normal':
                normal_node = nodes.new('ShaderNodeNormalMap')
                normal_node.location = (-230, row)
                normal_node.inputs['Strength'].default_value = normal_strength
                links.new(tex.outputs['Color'], normal_node.inputs['Color'])
                links.new(normal_node.outputs['Normal'], shader.inputs['Normal'])
            elif label == 'Roughness':
                channels = nodes.new('ShaderNodeSeparateColor')
                channels.location = (-230, row)
                links.new(tex.outputs['Color'], channels.inputs['Color'])
                links.new(channels.outputs['Green'], shader.inputs['Roughness'])
    elif vertex_color:
        color_node = nodes.new('ShaderNodeVertexColor')
        color_node.layer_name = 'Tint and occlusion'
        links.new(color_node.outputs['Color'], shader.inputs['Base Color'])
    return result


def photo_fiber_material():
    result = bpy.data.materials.new('Blender · combed fiber scattering')
    result.use_nodes = True
    nodes, links = result.node_tree.nodes, result.node_tree.links
    hair = nodes.new('ShaderNodeBsdfHairPrincipled')
    hair.parametrization = 'COLOR'
    hair.inputs['Color'].default_value = (*srgb(PLUSH_COLOR), 1)
    hair.inputs['Roughness'].default_value = .32
    hair.inputs['Radial Roughness'].default_value = .46
    hair.inputs['IOR'].default_value = 1.48
    hair.inputs['Coat'].default_value = .09
    hair.inputs['Offset'].default_value = math.radians(1.4)
    hair.inputs['Random Roughness'].default_value = .09
    hair.location = (-190, 65)
    color = nodes.new('ShaderNodeAttribute')
    color.attribute_name = 'Fiber tint'
    color.location = (-440, 65)
    shader = nodes.get('Principled BSDF')
    nodes.remove(shader)
    links.new(color.outputs['Color'], hair.inputs['Color'])
    links.new(hair.outputs[0], nodes.get('Material Output').inputs['Surface'])
    return result


def linen_material():
    result = material('Studio · natural linen', [.761, .673, .574], .94, .137)
    nodes, links = result.node_tree.nodes, result.node_tree.links
    shader = nodes.get('Principled BSDF')
    coordinates = nodes.new('ShaderNodeTexCoord')
    uv = coordinates.outputs['UV']

    def weave_wave(direction, phase):
        wave = nodes.new('ShaderNodeTexWave')
        wave.bands_direction = direction
        wave.inputs['Scale'].default_value = 119
        wave.inputs['Distortion'].default_value = .28
        wave.inputs['Detail'].default_value = 1.4
        wave.inputs['Detail Scale'].default_value = .48
        wave.inputs['Phase Offset'].default_value = phase
        links.new(uv, wave.inputs['Vector'])
        return wave.outputs['Color']

    weave = nodes.new('ShaderNodeMixRGB')
    weave.blend_type = 'MULTIPLY'
    weave.inputs[0].default_value = .95
    links.new(weave_wave('X', 0), weave.inputs[1])
    links.new(weave_wave('Y', .73), weave.inputs[2])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Distance'].default_value = .00037
    bump.inputs['Strength'].default_value = .59
    links.new(weave.outputs['Color'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    tone = nodes.new('ShaderNodeValToRGB')
    tone.color_ramp.elements[0].color = (*srgb((.705, .614, .524)), 1)
    tone.color_ramp.elements[1].color = (*srgb((.847, .77, .673)), 1)
    links.new(weave.outputs['Color'], tone.inputs[0])
    links.new(tone.outputs[0], shader.inputs['Base Color'])
    return result


def make_materials(pilot=False):
    sources = Path(__file__).resolve().parent / 'textures'
    with tempfile.TemporaryDirectory(prefix='plush-maps-') as temp:
        directory = Path(temp)
        pile, pile_color = combed_plush_maps(sources / 'short-plush.png', directory)
        cotton = woven_cotton_maps(sources / 'floral-cotton-ditsy.png', directory)
        if pilot:
            previous_pile, previous_color = plush_maps(sources / 'short-plush.png', directory)
            previous_cotton = cotton_maps(sources / 'floral-cotton.png', directory)
    materials = {
        'plush': material('01 · Combed oatmeal short plush', PLUSH_COLOR, .84, .32, pile, vertex_color=True,
                          normal_strength=.58, sheen_roughness=.66),
        'pile': material('02 · Short pile fibers', PLUSH_COLOR, .91, .36, vertex_color=True,
                         two_sided=False, sheen_roughness=.71),
        'cotton': material('03 · Plain-woven printed cotton', [.929, .842, .747], .92, .08, cotton,
                           vertex_color=True, normal_strength=.47, extension='EXTEND'),
        'eyes': material('04 · Espresso embroidery', [.255, .152, .100], .87, .27),
        'eye_thread': material('05 · Espresso thread ridges', [.300, .186, .129], .83, .27),
        'nose': material('06 · Cinnamon embroidery', [.620, .336, .213], .85, .26),
        'nose_thread': material('07 · Cinnamon thread ridges', [.660, .380, .250], .83, .29),
        'mouth': material('08 · Mouth embroidery', [.365, .234, .158], .85, .26),
        'hem': material('09 · Warm cotton thread', [.775, .675, .565], .93, .19),
    }
    palette = {'plush': pile_color}
    if pilot:
        materials['previous_plush'] = material('Previous short plush', [.917, .818, .735], .86, .40, previous_pile,
                                               vertex_color=True, normal_strength=.90)
        materials['previous_cotton'] = material('Previous printed cotton', [.919, .837, .735], .91, .12,
                                                previous_cotton, vertex_color=True, normal_strength=.39,
                                                extension='EXTEND')
        palette['previous_plush'] = previous_color
    return materials, palette

"""Bake UV-aligned game textures from the selected blue guppy reference."""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from guppy_profile import BODY, EYE_RADIUS, EYE_X, EYE_Y, FIN_CROPS, TAIL_ROOT, sample_profile


ROOT = Path(__file__).resolve().parent
TEXTURES = ROOT / "textures"
LUMA = np.array([.2126, .7152, .0722], dtype=np.float32)


def smoothstep(lo, hi, value):
    t = np.clip((value - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def blur(pixels, sigma):
    return cv2.GaussianBlur(pixels, (0, 0), sigma, borderType=cv2.BORDER_REPLICATE)


def byte(pixels):
    return np.rint(np.clip(pixels, 0, 1) * 255).astype(np.uint8)


def save(name, pixels):
    Image.fromarray(byte(pixels)).save(TEXTURES / (name + ".png"), optimize=True)


def remap(pixels, x, y):
    return cv2.remap(pixels, x.astype(np.float32), y.astype(np.float32),
                     cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def pad_color(rgb, opaque):
    # Keep pigment under clear texels so mipmapping does not introduce black halos.
    _, labels = cv2.distanceTransformWithLabels(
        (~opaque).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL,
    )
    palette = np.zeros((labels.max() + 1, 3), dtype=np.float32)
    palette[labels[opaque]] = rgb[opaque]
    return palette[labels]


def tame_highlights(rgb, amount):
    luminance = rgb @ LUMA
    gloss = .65 * smoothstep(.43, .83, luminance)
    gloss += .35 * smoothstep(.02, .24, luminance - blur(luminance, 4))
    return rgb * (1 - amount * gloss[..., None])


def normal_map(height, strength):
    dy, dx = np.gradient(height)
    normal = np.stack((-strength * dx, strength * dy, np.ones_like(height)), axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    return normal * .5 + .5


def body_material(source):
    # The image contains an eye and a translucent pectoral fin. Their rendered
    # geometry will sit on the flank, so remove those features from body UVs.
    rgb = source.copy()
    eye_mask = np.zeros(rgb.shape[:2], dtype=np.uint8)
    cv2.ellipse(eye_mask, (EYE_X, EYE_Y), (EYE_RADIUS + 5, EYE_RADIUS + 5), 0, 0, 360, 255, -1)
    socket = cv2.inpaint(byte(rgb), eye_mask, 6, cv2.INPAINT_NS).astype(np.float32) / 255
    near_eye = blur(eye_mask.astype(np.float32) / 255, 3)[..., None]
    rgb = rgb * (1 - near_eye) + socket * near_eye
    patch = rgb[532:645, 1070:1229].copy()
    y, x = np.indices(patch.shape[:2], dtype=np.float32)
    rays = np.clip(1 - ((x - 87) / 75) ** 2 - ((y - 51 - .20 * (x - 87)) / 32) ** 2, 0, 1)
    donor = rgb[532:645, 900:1059]
    flank = blur(patch, 13) + .42 * (blur(donor, 1.1) - blur(donor, 8))
    rgb[532:645, 1070:1229] = patch + (flank - patch) * (.86 * rays[..., None])
    rgb = tame_highlights(.42 * rgb + .58 * blur(rgb, .68), .26)

    height, width = 1024, 2048
    columns = np.linspace(BODY[0][0], BODY[-1][0], width, dtype=np.float32)
    angles = np.linspace(0, 2 * np.pi, height, dtype=np.float32)[:, None]
    top, bottom, _ = np.array([sample_profile(BODY, x) for x in columns]).T
    fraction = .5 * (1 - np.cos(angles))
    side = np.abs(np.sin(angles))
    x = np.broadcast_to(columns, (height, width))
    # Sample slightly inside the cutout so the fins never bleed into body color.
    y = top + np.minimum(4, .30 * (bottom - top))
    y = y + np.maximum(0, (bottom - top) - 2 * np.minimum(4, .30 * (bottom - top))) * fraction
    projected = remap(rgb, x, y)
    shoulder = smoothstep(898, 1250, x)
    upper = (1 - smoothstep(.02, .23, fraction)) * (1 - side) * (.30 + .22 * shoulder)
    lower = smoothstep(.72, .99, fraction) * (1 - side) * (.39 + .17 * shoulder)
    color = projected * (1 - (upper + lower)[..., None])
    color += upper[..., None] * np.array([.095, .235, .32])
    color += lower[..., None] * np.array([.47, .61, .66])

    luminance = color @ LUMA
    scale_relief = blur(luminance, 1.3) - blur(luminance, 9)
    flank_relief = (.28 + .72 * side) * (1 - .82 * smoothstep(1205, 1315, x))
    scale_relief *= flank_relief
    roughness = .46 - .22 * scale_relief + .045 * lower + .04 * shoulder
    save("body-base-color", color)
    save("body-normal", normal_map(scale_relief, 4.2))
    save("body-roughness", roughness)


def fin_material(source, alpha, name, size, pigment_density, roughness):
    x0, y0, x1, y1 = FIN_CROPS[name]
    colors = cv2.resize(source[y0:y1, x0:x1], size, interpolation=cv2.INTER_CUBIC)
    coverage = cv2.resize(alpha[y0:y1, x0:x1], size, interpolation=cv2.INTER_LINEAR)
    colors = tame_highlights(.33 * colors + .67 * blur(colors, .74), .23)
    luminance = colors @ LUMA
    relief = blur(luminance, 1.25) - blur(luminance, 7)
    # Transmit more light between bright ridges. Dark pigment stays dense.
    membrane = pigment_density + .11 * (1 - smoothstep(.08, .38, luminance))
    membrane += .20 * np.maximum(0, relief)
    opacity = smoothstep(.04, .75, coverage) * np.minimum(membrane, .99)
    if name == "dorsal":
        # Keep the hidden attachment opaque below the top contour of the skin.
        px = np.linspace(x0, x1, size[0], endpoint=False)
        dorsal_line = np.array([sample_profile(BODY, x)[0] for x in px])
        depth = np.linspace(y0, y1, size[1], endpoint=False)[:, None] - dorsal_line
        root = smoothstep(-6, 1, depth)
        opacity = np.maximum(opacity, .96 * root)
    save(name + "-base-color", np.dstack((colors, opacity)))
    save(name + "-normal", normal_map(relief, 3.8))
    save(name + "-roughness", roughness - .30 * relief)

    if name == "tail":
        # glTF anisotropy stores a unit tangent in RG and its mask in B.
        py, px = np.indices((512, 256), dtype=np.float32)
        dx = ((px + .5) * (x1 - x0) / 256 + x0 - TAIL_ROOT[0]) / 600
        dy = (TAIL_ROOT[1] - y0 - (py + .5) * (y1 - y0) / 512) / 600
        length = np.maximum(.0001, np.hypot(dx, dy))
        band = cv2.resize(luminance, (256, 512), interpolation=cv2.INTER_AREA)
        strength = (.57 + .26 * smoothstep(.02, .16, band)) * smoothstep(.015, .16, length)
        save("tail-anisotropy", np.stack((.5 + .5 * dx / length, .5 + .5 * dy / length, strength), axis=-1))


def pectoral_material():
    height, width = 256, 512
    across, along = np.indices((height, width), dtype=np.float32)
    along /= width - 1
    across = 2 * across / (height - 1) - 1
    fan_angle = across * (.56 + .44 * along)
    ribs = (.5 + .5 * np.cos(2 * np.pi * (fan_angle * 10 + .17 * along))) ** 7
    ribs *= smoothstep(0, .16, along) * (1 - .74 * smoothstep(.74, 1, along))
    tint = np.array([.19, .38, .50], dtype=np.float32)
    color = tint * (1 - .40 * along[..., None]) + ribs[..., None] * np.array([.19, .25, .27])
    membrane = (.38 + .25 * ribs) * (1 - .57 * smoothstep(.58, 1, along))
    membrane *= 1 - .62 * smoothstep(.7, 1, np.abs(across))
    save("pectoral-base-color", np.dstack((color, membrane)))
    save("pectoral-normal", normal_map(blur(ribs, 1), 1.5))


def eye_material(source):
    y, x = np.indices((512, 512), dtype=np.float32)
    x = 2 * x / 511 - 1
    y = 2 * y / 511 - 1
    radius = np.hypot(x, y)
    angle = np.arctan2(y, x)
    iris = remap(source, EYE_X + .89 * EYE_RADIUS * x, EYE_Y + .89 * EYE_RADIUS * y)
    threads = .52 * np.sin(41 * angle + 4 * radius) + .24 * np.sin(73 * angle - 8 * radius)
    pale = np.array([.86, .84, .74], dtype=np.float32) * (1 + .075 * threads[..., None])
    iris = .56 * tame_highlights(iris, .33) + .44 * pale
    pupil = smoothstep(.39, .46, radius)[..., None]
    color = np.array([.013, .016, .021]) * (1 - pupil) + iris * pupil
    rim = smoothstep(.88, 1.015, radius)[..., None]
    save("eye-base-color", color * (1 - rim) + rim * np.array([.095, .13, .145]))


def main():
    TEXTURES.mkdir(exist_ok=True)
    with Image.open(ROOT / "concept.png") as image:
        pixels = np.asarray(image.convert("RGBA"), dtype=np.float32) / 255
    alpha = pixels[..., 3]
    source = pad_color(pixels[..., :3], alpha > .80)
    body_material(source)
    for name, size, density, roughness in (
        ("tail", (1024, 2048), .84, .46),
        ("dorsal", (1024, 512), .76, .46),
        ("anal", (512, 256), .62, .48),
        ("ventral", (512, 256), .58, .48),
    ):
        fin_material(source, alpha, name, size, density, roughness)
    pectoral_material()
    eye_material(source)


if __name__ == "__main__":
    main()

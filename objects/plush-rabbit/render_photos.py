"""Render the fixed photograph views from the editable plush rabbit scene."""

import argparse
from math import cos, radians, sin
from pathlib import Path
import sys

import bpy
from mathutils import Vector


VIEWS = {
    'front': (0, (0, -.18, 1.44), (0, -.67, 1.36), 7.08, .81, 70, 16),
    'three-quarter': (38, (0, -.19, 1.45), (0, -.44, 1.55), 7.27, 1.05, 69, 16),
    'detail': (13, (.09, -.31, 2.24), (.19, -.48, 2.27), 4.68, .47, 76, 19),
}


def fit_photo_backdrop():
    backdrop = bpy.data.objects['Studio · curved backdrop']
    backdrop.scale.x = 2.5


def render_photo(scene, scale, name, path, resolution, samples):
    angle, target, focus, distance, elevation, lens, aperture = VIEWS[name]
    look_at = Vector(target) * scale
    angle = radians(angle)
    camera = scene.camera
    camera.location = look_at + Vector((distance * sin(angle), -distance * cos(angle), elevation)) * scale
    camera.rotation_euler = (look_at - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.lens = lens
    focal_point = Vector(focus) * scale
    forward = (look_at - camera.location).normalized()
    camera.data.dof.use_dof = True
    camera.data.dof.focus_distance = (focal_point - camera.location).dot(forward)
    camera.data.dof.aperture_fstop = aperture
    scene.render.resolution_x = scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.cycles.samples = samples
    scene.cycles.adaptive_threshold = .009
    scene.cycles.adaptive_min_samples = min(12, samples)
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 95
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--view', choices=VIEWS, action='append')
    parser.add_argument('--resolution', type=int, default=1600)
    parser.add_argument('--samples', type=int, default=76)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    args.output.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    fit_photo_backdrop()
    scale = bpy.data.objects['Lucky'].scale.x
    for name in args.view or VIEWS:
        render_photo(scene, scale, name, args.output / f'{name}.jpg', args.resolution, args.samples)


if __name__ == '__main__':
    main()

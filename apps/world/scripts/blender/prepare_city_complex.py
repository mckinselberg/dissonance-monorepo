"""Export the low-poly city asset (ciudadortogonal.26.blend) to a runtime
GLB for placement in Dissonance World.

Run with Blender (background file is the source .blend itself, not imported):
  blender --background "D:\dan\code\dissonance-related\city low poly\ciudadortogonal.26.blend" \
    --python prepare_city_complex.py -- \
    --output "apps/world/public/models/city-complex/city-complex.glb"

Deliberately minimal: no mesh cleanup, categorization, or room-shell
authoring (compare prepare_milos_apartment.py) — just a stats dump (so the
caller can see what they're placing) followed by a straight glTF export of
the source scene with modifiers/transforms applied.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    script_args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    return parser.parse_args(script_args)


def print_stats() -> None:
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    minimum = Vector((float("inf"), float("inf"), float("inf")))
    maximum = Vector((float("-inf"), float("-inf"), float("-inf")))
    total_tris = 0
    for obj in mesh_objects:
        total_tris += sum(len(poly.vertices) - 2 for poly in obj.data.polygons)
        for corner in obj.bound_box:
            world_corner = obj.matrix_world @ Vector(corner)
            minimum.x, minimum.y, minimum.z = (
                min(minimum.x, world_corner.x),
                min(minimum.y, world_corner.y),
                min(minimum.z, world_corner.z),
            )
            maximum.x, maximum.y, maximum.z = (
                max(maximum.x, world_corner.x),
                max(maximum.y, world_corner.y),
                max(maximum.z, world_corner.z),
            )
    dimensions = maximum - minimum
    print(f"[prepare_city_complex] mesh objects: {len(mesh_objects)}")
    print(f"[prepare_city_complex] approx triangles: {total_tris}")
    print(
        f"[prepare_city_complex] bounds: "
        f"{dimensions.x:.2f} x {dimensions.y:.2f} x {dimensions.z:.2f} "
        f"(min {tuple(round(v, 2) for v in minimum)}, max {tuple(round(v, 2) for v in maximum)})"
    )
    print(f"[prepare_city_complex] scene unit scale: {bpy.context.scene.unit_settings.scale_length}")


def export_runtime(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )


def main() -> None:
    args = parse_args()
    output_path = Path(args.output).expanduser().resolve()
    print_stats()
    export_runtime(output_path)
    print(f"[prepare_city_complex] exported: {output_path}")


if __name__ == "__main__":
    main()

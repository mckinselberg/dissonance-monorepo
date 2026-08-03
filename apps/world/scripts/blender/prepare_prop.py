"""Prepare a static prop for the Dissonance BabylonJS runtime.

The input is always treated as immutable. The script opens/imports it, applies
an optional Blender Collapse decimation pass, downsizes and packs source
textures, saves an editable working copy, exports a self-contained GLB, and can
render a square comparison preview.

Example (run from the repository root):

  blender --background --python apps/world/scripts/blender/prepare_prop.py -- \
    --input apps/world/public/models/source/prop.blend \
    --output-blend apps/world/public/models/prop/working/prop.blend \
    --output-glb apps/world/public/models/prop/runtime/prop.glb \
    --preview apps/world/public/models/prop/working/prop.png \
    --decimate-ratio 0.7 \
    --texture-size 1024
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    script_args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output-blend", required=True)
    parser.add_argument("--output-glb", required=True)
    parser.add_argument("--preview")
    parser.add_argument("--preview-size", type=int, default=512)
    parser.add_argument("--decimate-ratio", type=float, default=1.0)
    parser.add_argument("--texture-size", type=int, default=1024)
    args = parser.parse_args(script_args)
    if not 0 < args.decimate_ratio <= 1:
        parser.error("--decimate-ratio must be greater than 0 and at most 1")
    if args.texture_size < 1:
        parser.error("--texture-size must be positive")
    if args.preview_size < 1:
        parser.error("--preview-size must be positive")
    return args


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def open_or_import(input_path: Path) -> None:
    suffix = input_path.suffix.lower()
    if suffix == ".blend":
        bpy.ops.wm.open_mainfile(filepath=str(input_path))
        return

    reset_scene()
    if suffix in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=str(input_path))
    elif suffix == ".fbx":
        bpy.ops.wm.fbx_import(filepath=str(input_path))
    elif suffix == ".obj":
        bpy.ops.wm.obj_import(filepath=str(input_path))
    else:
        raise ValueError(f"Unsupported input format: {suffix}")


def mesh_objects() -> list[bpy.types.Object]:
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("The source contains no mesh objects")
    return meshes


def triangle_count(meshes: list[bpy.types.Object]) -> int:
    return sum(sum(max(0, len(face.vertices) - 2) for face in obj.data.polygons) for obj in meshes)


def apply_decimation(meshes: list[bpy.types.Object], ratio: float) -> None:
    if math.isclose(ratio, 1.0):
        return
    for obj in meshes:
        if len(obj.data.polygons) < 8:
            continue
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        modifier = obj.modifiers.new(name="DissonanceDecimate", type="DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)


def resize_and_pack_images(max_size: int) -> list[dict[str, object]]:
    report: list[dict[str, object]] = []
    for image in bpy.data.images:
        if image.source not in {"FILE", "GENERATED"} or image.name == "Render Result":
            continue
        original = tuple(image.size)
        if not original[0] or not original[1]:
            continue
        scale = min(1.0, max_size / max(original))
        target = (
            max(1, round(original[0] * scale)),
            max(1, round(original[1] * scale)),
        )
        if target != original:
            image.scale(*target)
        image.pack()
        report.append({"name": image.name, "source": original, "runtime": target})
    return report


def select_only(meshes: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.hide_render = False
        obj.hide_viewport = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]


def world_bounds(meshes: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    minimum = Vector((math.inf, math.inf, math.inf))
    maximum = Vector((-math.inf, -math.inf, -math.inf))
    for obj in meshes:
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            for axis in range(3):
                minimum[axis] = min(minimum[axis], point[axis])
                maximum[axis] = max(maximum[axis], point[axis])
    return minimum, maximum


def export_glb(meshes: list[bpy.types.Object], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    select_only(meshes)
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )


def point_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def render_preview(
    meshes: list[bpy.types.Object],
    output_path: Path,
    preview_size: int,
) -> None:
    minimum, maximum = world_bounds(meshes)
    center = (minimum + maximum) * 0.5
    dimensions = maximum - minimum
    radius = max(dimensions) * 2.2

    bpy.ops.object.camera_add(location=center + Vector((radius, -radius * 1.25, radius * 0.72)))
    camera = bpy.context.active_object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max(dimensions) * 1.35
    point_at(camera, center)
    bpy.context.scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=center + Vector((radius, -radius, radius)))
    key = bpy.context.active_object
    key.data.energy = 700
    key.data.shape = "DISK"
    key.data.size = max(dimensions) * 1.5
    point_at(key, center)

    bpy.ops.object.light_add(type="AREA", location=center + Vector((-radius, radius * 0.4, radius * 0.5)))
    fill = bpy.context.active_object
    fill.data.energy = 280
    fill.data.size = max(dimensions) * 2
    point_at(fill, center)

    world = bpy.context.scene.world or bpy.data.worlds.new("DissonancePropPreview")
    bpy.context.scene.world = world
    world.color = (0.025, 0.025, 0.025)

    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        # Blender 5.x exposes Eevee under the shorter enum again.
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = preview_size
    scene.render.resolution_y = preview_size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).expanduser().resolve()
    output_blend = Path(args.output_blend).expanduser().resolve()
    output_glb = Path(args.output_glb).expanduser().resolve()
    preview_path = Path(args.preview).expanduser().resolve() if args.preview else None
    if not input_path.is_file():
        raise FileNotFoundError(input_path)

    open_or_import(input_path)
    meshes = mesh_objects()
    triangles_before = triangle_count(meshes)
    apply_decimation(meshes, args.decimate_ratio)
    triangles_after = triangle_count(meshes)
    images = resize_and_pack_images(args.texture_size)

    output_blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend))
    export_glb(meshes, output_glb)
    if preview_path:
        render_preview(meshes, preview_path, args.preview_size)

    print(
        "DISSONANCE_PROP_REPORT="
        + json.dumps(
            {
                "input": str(input_path),
                "outputBlend": str(output_blend),
                "outputGlb": str(output_glb),
                "decimateRatio": args.decimate_ratio,
                "trianglesBefore": triangles_before,
                "trianglesAfter": triangles_after,
                "textures": images,
            }
        )
    )


if __name__ == "__main__":
    main()

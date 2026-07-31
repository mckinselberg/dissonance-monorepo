"""Prepare Milo's apartment photogrammetry capture for the Dissonance runtime.

Run with Blender 4.x:
  blender --background --python prepare_milos_apartment.py -- \
    --input /path/to/milos-apartment-capture-original.glb \
    --output-blend /path/to/milos-apartment-clean.blend \
    --output-glb /path/to/milos-apartment-runtime.glb \
    --preview-dir /path/to/previews

The script is deliberately conservative: it preserves the capture, performs
mechanical cleanup, creates a separate low-poly shell, and leaves semantic
segmentation/debris deletion for the manual pass described in the handoff doc.
"""

from __future__ import annotations

import argparse
import math
import os
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector


def parse_args() -> argparse.Namespace:
    script_args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output-blend", required=True)
    parser.add_argument("--output-glb", required=True)
    parser.add_argument("--preview-dir", required=True)
    parser.add_argument("--merge-distance", type=float, default=0.0005)
    parser.add_argument("--wall-thickness", type=float, default=0.08)
    return parser.parse_args(script_args)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def ensure_collection(name: str) -> bpy.types.Collection:
    collection = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if collection.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(collection)
    return collection


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    minimum = Vector((math.inf, math.inf, math.inf))
    maximum = Vector((-math.inf, -math.inf, -math.inf))
    for obj in objects:
        for corner in obj.bound_box:
            world_corner = obj.matrix_world @ Vector(corner)
            minimum.x = min(minimum.x, world_corner.x)
            minimum.y = min(minimum.y, world_corner.y)
            minimum.z = min(minimum.z, world_corner.z)
            maximum.x = max(maximum.x, world_corner.x)
            maximum.y = max(maximum.y, world_corner.y)
            maximum.z = max(maximum.z, world_corner.z)
    return minimum, maximum


def flatten_import_hierarchy(meshes: list[bpy.types.Object]) -> None:
    for obj in meshes:
        world_transform = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = world_transform
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        obj.select_set(False)

    for obj in list(bpy.context.scene.objects):
        if obj.type == "EMPTY" and not obj.children:
            bpy.data.objects.remove(obj, do_unlink=True)


def clean_mesh(obj: bpy.types.Object, merge_distance: float) -> None:
    mesh = obj.data
    editable = bmesh.new()
    editable.from_mesh(mesh)
    bmesh.ops.remove_doubles(editable, verts=editable.verts, dist=merge_distance)
    bmesh.ops.dissolve_degenerate(editable, edges=editable.edges, dist=merge_distance)
    bmesh.ops.recalc_face_normals(editable, faces=editable.faces)
    editable.to_mesh(mesh)
    editable.free()
    mesh.validate(verbose=False)
    mesh.update()


def normalize_materials(materials: list[bpy.types.Material]) -> None:
    for index, material in enumerate(materials, start=1):
        material.name = f"APT_CAPTURE_MATERIAL_{index:02d}"
        material.use_nodes = True
        principled = next(
            (node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"),
            None,
        )
        if principled is None:
            continue
        if "Metallic" in principled.inputs:
            principled.inputs["Metallic"].default_value = 0.0
        if "Roughness" in principled.inputs:
            principled.inputs["Roughness"].default_value = 0.88


def create_material(name: str, color: tuple[float, float, float, float], roughness: float):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    principled = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Roughness"].default_value = roughness
    return material


def create_box(
    name: str,
    location: Vector,
    dimensions: Vector,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    obj["dissonanceCategory"] = "occluder" if name.startswith("APT_OCCLUDER_") else "architecture"
    move_to_collection(obj, collection)
    return obj


def create_room_shell(
    minimum: Vector,
    maximum: Vector,
    thickness: float,
    collection: bpy.types.Collection,
) -> None:
    dimensions = maximum - minimum
    center = (minimum + maximum) * 0.5
    shell_material = create_material("APT_SHELL_PLASTER", (0.42, 0.34, 0.25, 1), 0.92)
    floor_material = create_material("APT_SHELL_FLOOR", (0.2, 0.14, 0.09, 1), 0.86)

    create_box(
        "APT_ARCH_FLOOR",
        Vector((center.x, center.y, -thickness * 0.5)),
        Vector((dimensions.x, dimensions.y, thickness)),
        collection,
        floor_material,
    )
    wall_z = dimensions.z * 0.5
    create_box(
        "APT_OCCLUDER_NORTH_WALL",
        Vector((center.x, maximum.y + thickness * 0.5, wall_z)),
        Vector((dimensions.x, thickness, dimensions.z)),
        collection,
        shell_material,
    )
    create_box(
        "APT_OCCLUDER_SOUTH_WALL",
        Vector((center.x, minimum.y - thickness * 0.5, wall_z)),
        Vector((dimensions.x, thickness, dimensions.z)),
        collection,
        shell_material,
    )
    create_box(
        "APT_OCCLUDER_EAST_WALL",
        Vector((maximum.x + thickness * 0.5, center.y, wall_z)),
        Vector((thickness, dimensions.y, dimensions.z)),
        collection,
        shell_material,
    )
    create_box(
        "APT_OCCLUDER_WEST_WALL",
        Vector((minimum.x - thickness * 0.5, center.y, wall_z)),
        Vector((thickness, dimensions.y, dimensions.z)),
        collection,
        shell_material,
    )


def point_camera(camera: bpy.types.Object, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def create_preview_setup(bounds_min: Vector, bounds_max: Vector):
    center = (bounds_min + bounds_max) * 0.5
    dimensions = bounds_max - bounds_min

    bpy.ops.object.camera_add()
    camera = bpy.context.active_object
    camera.name = "PREVIEW_ISOMETRIC_CAMERA"
    camera.data.type = "ORTHO"
    camera.data.lens = 55
    camera.data.ortho_scale = max(dimensions.x, dimensions.y, dimensions.z * 1.6) * 1.35
    bpy.context.scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(bounds_max.x, bounds_min.y, bounds_max.z * 1.3))
    key_light = bpy.context.active_object
    key_light.name = "PREVIEW_WINDOW_LIGHT"
    key_light.data.energy = 1100
    key_light.data.shape = "RECTANGLE"
    key_light.data.size = max(dimensions.x, dimensions.y) * 0.7
    key_light.data.color = (1.0, 0.68, 0.38)
    point_camera(key_light, center)

    bpy.ops.object.light_add(type="AREA", location=(bounds_min.x, bounds_max.y, bounds_max.z))
    fill_light = bpy.context.active_object
    fill_light.name = "PREVIEW_FILL_LIGHT"
    fill_light.data.energy = 180
    fill_light.data.size = max(dimensions.x, dimensions.y)
    fill_light.data.color = (0.28, 0.38, 0.52)
    point_camera(fill_light, center)

    world = bpy.context.scene.world or bpy.data.worlds.new("MilosApartmentWorld")
    bpy.context.scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.018, 0.012, 0.009, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.22
    return camera, center, dimensions


def configure_render() -> None:
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        # Blender 3.x uses Filmic look names instead of the Blender 4.x AgX
        # enum. Keep the script portable across both families.
        scene.view_settings.look = "Medium High Contrast"


def render_previews(camera, target: Vector, dimensions: Vector, preview_dir: Path) -> None:
    preview_dir.mkdir(parents=True, exist_ok=True)
    radius = max(dimensions.x, dimensions.y) * 1.8
    height = max(dimensions.z * 1.7, radius * 0.85)
    cutaways = (
        ("APT_OCCLUDER_EAST_WALL", "APT_OCCLUDER_NORTH_WALL"),
        ("APT_OCCLUDER_WEST_WALL", "APT_OCCLUDER_NORTH_WALL"),
        ("APT_OCCLUDER_WEST_WALL", "APT_OCCLUDER_SOUTH_WALL"),
        ("APT_OCCLUDER_EAST_WALL", "APT_OCCLUDER_SOUTH_WALL"),
    )
    wall_names = {name for pair in cutaways for name in pair}
    for index, (angle_degrees, hidden_walls) in enumerate(
        zip((45, 135, 225, 315), cutaways),
        start=1,
    ):
        for wall_name in wall_names:
            wall = bpy.data.objects.get(wall_name)
            if wall is not None:
                wall.hide_render = wall_name in hidden_walls
        angle = math.radians(angle_degrees)
        camera.location = target + Vector((math.cos(angle) * radius, math.sin(angle) * radius, height))
        point_camera(camera, target)
        bpy.context.scene.render.filepath = str(preview_dir / f"milos-apartment-view-{index}.png")
        bpy.ops.render.render(write_still=True)
    for wall_name in wall_names:
        wall = bpy.data.objects.get(wall_name)
        if wall is not None:
            wall.hide_render = False


def create_artifact_anchor(collection: bpy.types.Collection) -> None:
    anchor = bpy.data.objects.new("ARTIFACT_ANCHOR_DegradedCassette", None)
    anchor.empty_display_type = "CUBE"
    anchor.empty_display_size = 0.12
    anchor.location = (0, 0, 0.1)
    anchor["dissonanceCategory"] = "artifact-anchor"
    collection.objects.link(anchor)


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
    input_path = Path(args.input).expanduser().resolve()
    output_blend = Path(args.output_blend).expanduser().resolve()
    output_glb = Path(args.output_glb).expanduser().resolve()
    preview_dir = Path(args.preview_dir).expanduser().resolve()
    if not input_path.exists():
        raise FileNotFoundError(input_path)

    reset_scene()
    capture_collection = ensure_collection("CAPTURE_REFERENCE")
    shell_collection = ensure_collection("AUTHORED_ARCHITECTURE")
    anchor_collection = ensure_collection("ARTIFACT_ANCHORS")

    bpy.ops.import_scene.gltf(filepath=str(input_path))
    capture_meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not capture_meshes:
        raise RuntimeError("The source GLB contains no mesh objects")

    flatten_import_hierarchy(capture_meshes)
    for index, obj in enumerate(capture_meshes, start=1):
        obj.name = f"APT_ARCH_CAPTURE_{index:02d}"
        obj.data.name = f"APT_ARCH_CAPTURE_MESH_{index:02d}"
        obj["dissonanceCategory"] = "architecture"
        clean_mesh(obj, args.merge_distance)
        move_to_collection(obj, capture_collection)
    normalize_materials(list(bpy.data.materials))

    # bmesh writes in clean_mesh() don't retroactively refresh the cached
    # bound_box; force a view-layer update so world_bounds() below reflects
    # the cleaned geometry rather than the pre-cleanup capture.
    bpy.context.view_layer.update()
    minimum, maximum = world_bounds(capture_meshes)
    offset = Vector((-(minimum.x + maximum.x) * 0.5, -(minimum.y + maximum.y) * 0.5, -minimum.z))
    for obj in capture_meshes:
        obj.matrix_world = Matrix.Translation(offset) @ obj.matrix_world
    minimum, maximum = world_bounds(capture_meshes)

    create_room_shell(minimum, maximum, args.wall_thickness, shell_collection)
    create_artifact_anchor(anchor_collection)
    camera, target, dimensions = create_preview_setup(minimum, maximum)
    configure_render()
    render_previews(camera, target, dimensions, preview_dir)

    output_blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output_blend))
    export_runtime(output_glb)
    print(f"Prepared Blender file: {output_blend}")
    print(f"Prepared runtime GLB: {output_glb}")
    print(f"Preview renders: {preview_dir}")


if __name__ == "__main__":
    main()

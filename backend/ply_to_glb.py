#!/usr/bin/env python3
"""Convert a PLY file to GLB (glTF binary).

Usage:
    python3 ply_to_glb.py input.ply output.glb

If output path is omitted, writes input with .glb extension.

This script uses trimesh to load the PLY and export to GLB. If the PLY
is a pure point cloud (no faces), a convex hull will be generated as
a fallback mesh so we can export a GLB. For better surface
reconstruction, consider running Poisson or Ball-Pivoting externally.
"""
import sys
import os

try:
    import trimesh
except Exception as e:
    print("Missing dependency 'trimesh'. Install with: pip install trimesh pygltflib", file=sys.stderr)
    raise


def main():
    if len(sys.argv) < 2:
        print("Usage: ply_to_glb.py input.ply [output.glb]")
        sys.exit(1)

    input_path = sys.argv[1]
    if not os.path.exists(input_path):
        print(f"Input file not found: {input_path}")
        sys.exit(2)

    out_path = None
    if len(sys.argv) >= 3:
        out_path = sys.argv[2]
    else:
        base = os.path.splitext(input_path)[0]
        out_path = base + ".glb"

    print(f"Loading PLY: {input_path}")
    mesh = trimesh.load(input_path, process=False)

    # If a Scene is returned, try to merge into a single mesh
    if isinstance(mesh, trimesh.Scene):
        print("Loaded a scene; merging geometry into a single mesh")
        mesh = trimesh.util.concatenate(mesh.dump())

    if not isinstance(mesh, trimesh.Trimesh):
        print("Loaded object is not a Trimesh; attempting to convert")
        mesh = trimesh.Trimesh(vertices=mesh.vertices, process=False)

    # If no faces (point cloud), try convex hull fallback
    if mesh.faces is None or len(mesh.faces) == 0:
        print("No faces detected in PLY; generating convex hull as fallback mesh")
        try:
            hull = mesh.convex_hull
            mesh = hull
        except Exception as e:
            print("Convex hull generation failed:", e, file=sys.stderr)
            print("Exporting point cloud as a simple mesh by triangulating via Delaunay on XY projection")
            try:
                # Simple triangulation fallback: project to XY and perform 2D Delaunay
                import numpy as np
                from scipy.spatial import Delaunay
                pts = mesh.vertices
                if pts.shape[0] < 3:
                    raise RuntimeError("Not enough points for triangulation")
                tri = Delaunay(pts[:, :2])
                faces = tri.simplices
                mesh = trimesh.Trimesh(vertices=pts, faces=faces, process=False)
            except Exception as e2:
                print("Triangulation fallback failed:", e2, file=sys.stderr)
                print("Cannot convert point cloud to mesh. Please run a surface reconstruction step manually.")
                sys.exit(3)

    # Preserve vertex colors if present
    try:
        if hasattr(mesh.visual, 'vertex_colors') and mesh.visual.vertex_colors is not None:
            print("Vertex colors detected; preserving colors in export")
    except Exception:
        pass

    print(f"Exporting GLB to: {out_path}")
    glb = mesh.export(file_type='glb')
    # mesh.export returns bytes for glb
    if isinstance(glb, (bytes, bytearray)):
        with open(out_path, 'wb') as f:
            f.write(glb)
        print("Export complete")
    else:
        # Some versions may return a dict or str
        with open(out_path, 'wb') as f:
            if isinstance(glb, str):
                f.write(glb.encode('utf-8'))
            else:
                f.write(bytes(glb))
        print("Export complete")


if __name__ == '__main__':
    main()

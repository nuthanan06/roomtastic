#!/usr/bin/env python3
"""
Merge depth maps from six orthographic views into a single normalized point cloud (.ply)
This is a simple implementation: for each depth map we sample pixels and map to 3D using
an orthographic-like projection, then normalize the combined point cloud to unit cube.
"""
import sys
import os
import numpy as np
import cv2

def depth_to_points(depth_img, color_img=None, scale=1.0):
    h, w = depth_img.shape
    ys, xs = np.where(depth_img > 0)
    zs = depth_img[ys, xs].astype(np.float32) / 255.0
    # map pixel coordinates to -0.5..0.5
    xs_n = (xs.astype(np.float32) / w - 0.5) * scale
    ys_n = (ys.astype(np.float32) / h - 0.5) * scale
    pts = np.stack([xs_n, -ys_n, zs], axis=1)
    colors = None
    if color_img is not None:
        color_img = cv2.cvtColor(color_img, cv2.COLOR_BGR2RGB)
        colors = color_img[ys, xs, :]
    return pts, colors

def write_ply(path, points, colors=None):
    with open(path, 'w') as f:
        f.write('ply\n')
        f.write('format ascii 1.0\n')
        f.write(f'element vertex {len(points)}\n')
        f.write('property float x\n')
        f.write('property float y\n')
        f.write('property float z\n')
        if colors is not None:
            f.write('property uchar red\n')
            f.write('property uchar green\n')
            f.write('property uchar blue\n')
        f.write('end_header\n')
        for i, p in enumerate(points):
            line = f"{p[0]} {p[1]} {p[2]}"
            if colors is not None:
                c = colors[i]
                line += f" {int(c[0])} {int(c[1])} {int(c[2])}"
            f.write(line + '\n')

def main():
    if len(sys.argv) < 3:
        print('Usage: merge_point_clouds.py <views_dir> <out_ply>')
        sys.exit(1)

    views_dir = sys.argv[1]
    out_ply = sys.argv[2]

    views = ['front','back','left','right','top','bottom']
    all_points = []
    all_colors = []

    for v in views:
        depth_path = os.path.join(views_dir, f'{v}_depth.png')
        img_path = os.path.join(views_dir, f'{v}.png')
        if not os.path.exists(depth_path) or not os.path.exists(img_path):
            continue
        depth = cv2.imread(depth_path, cv2.IMREAD_GRAYSCALE)
        color = cv2.imread(img_path)
        if depth is None or color is None:
            continue
        pts, colors = depth_to_points(depth, color, scale=1.0)
        if pts.shape[0] == 0:
            continue
        all_points.append(pts)
        if colors is not None:
            all_colors.append(colors)

    if len(all_points) == 0:
        print('No points found')
        sys.exit(1)

    pts = np.vstack(all_points)
    cols = np.vstack(all_colors) if len(all_colors) > 0 else None

    # Normalize to unit cube centered at origin
    mins = pts.min(axis=0)
    maxs = pts.max(axis=0)
    center = (mins + maxs) / 2.0
    scale = (maxs - mins).max() + 1e-9
    pts = (pts - center) / scale

    write_ply(out_ply, pts, cols)
    print(f'Wrote merged PLY to {out_ply}')

if __name__ == '__main__':
    main()

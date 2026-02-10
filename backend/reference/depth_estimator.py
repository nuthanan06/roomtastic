#!/usr/bin/env python3
"""
Depth Estimation Script
Converts a 2D image to a depth map using MiDaS (or fallback method)
"""

import sys
import cv2
import numpy as np


def enhance_depth(depth_img: np.ndarray, color_img: np.ndarray | None = None) -> np.ndarray:
    """
    Robust depth enhancement pipeline (in-place returns a new uint8 depth image):
    - Fill holes (zeros) using `cv2.inpaint` on an 8-bit image.
    - Apply median blur to remove salt/noise.
    - Apply bilateral filter to smooth while preserving edges.
    - If `color_img` is provided, we compute an edge mask from the color image
      and preserve edges (less smoothing) near strong color edges.

    Input: `depth_img` expected as uint8 single-channel (0-255).
    Returns an uint8 array.
    """
    if depth_img is None:
        return depth_img

    d = depth_img.copy()
    # ensure uint8
    if d.dtype != np.uint8:
        d = np.clip(d, 0, 255).astype(np.uint8)

    # Hole mask: pixels with value 0 are treated as missing
    mask = (d == 0).astype('uint8')
    if mask.sum() > 0:
        # inpaint requires 8-bit 1-channel image and mask 0/255
        try:
            inpaint_mask = (mask * 255).astype('uint8')
            # Inpaint with Navier-Stokes method to smoothly fill holes
            d = cv2.inpaint(d, inpaint_mask, inpaintRadius=3, flags=cv2.INPAINT_NS)
        except Exception:
            # fallback: nearest non-zero fill using distance transform
            try:
                dist = cv2.distanceTransform((d == 0).astype('uint8'), cv2.DIST_L2, 5)
                # naive nearest neighbor filling
                ys, xs = np.where(d == 0)
                nonzero_y, nonzero_x = np.where(d != 0)
                if len(nonzero_y) > 0:
                    for y, x in zip(ys, xs):
                        # pick a nearby non-zero pixel (this is slow but safe fallback)
                        idx = np.argmin((nonzero_y - y) ** 2 + (nonzero_x - x) ** 2)
                        d[y, x] = d[nonzero_y[idx], nonzero_x[idx]]
            except Exception:
                pass

    # small median to remove speckle
    try:
        d = cv2.medianBlur(d, 5)
    except Exception:
        pass

    # edge mask from color image (if available) to reduce smoothing across edges
    edge_mask = None
    if color_img is not None:
        try:
            gray = cv2.cvtColor(color_img, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            edge_mask = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)
        except Exception:
            edge_mask = None

    # Bilateral smoothing: apply stronger smoothing where edge_mask==0
    try:
        # Smooth globally
        smooth = cv2.bilateralFilter(d, d=9, sigmaColor=75, sigmaSpace=75)
        if edge_mask is not None:
            # where edges exist, prefer original (preserve discontinuities)
            keep = (edge_mask > 0)
            d[~keep] = smooth[~keep]
        else:
            d = smooth
    except Exception:
        pass

    return d

def estimate_depth_with_midas(input_path: str, output_path: str):
    """
    Estimate depth using MiDaS (if available)
    """
    try:
        import torch
        
        print("Loading MiDaS model...")
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Using device: {device}")
        
        # Load model
        model = torch.hub.load("intel-isl/MiDaS", "DPT_Hybrid")
        model.to(device)
        model.eval()
        
        # Load transforms
        midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms")
        transform = midas_transforms.dpt_transform
        
        # Load image
        img = cv2.imread(input_path)
        if img is None:
            raise ValueError(f"Could not load image from {input_path}")
        
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        print("Running depth estimation...")
        img_input = transform(img_rgb).to(device)
        
        with torch.no_grad():
            depth = model(img_input)
            depth = torch.nn.functional.interpolate(
                depth.unsqueeze(1),
                size=img.shape[:2],
                mode="bicubic",
                align_corners=False,
            ).squeeze()
        
        # Normalize to 0-255
        depth_min = depth.min()
        depth_max = depth.max()
        depth_normalized = ((depth - depth_min) / (depth_max - depth_min + 1e-6) * 255).cpu().numpy().astype(np.uint8)

        # Enhance MiDaS depth using color guidance when possible
        try:
            depth_enh = enhance_depth(depth_normalized, img)
        except Exception:
            depth_enh = depth_normalized

        cv2.imwrite(output_path, depth_enh)
        print(f"✓ MiDaS depth map saved successfully!")
        return True
        
    except Exception as e:
        print(f"MiDaS not available: {e}")
        return False

def estimate_depth_simple(input_path: str, output_path: str):
    """
    Fallback: Generate depth map using image features
    """
    print("Using feature-based depth estimation...")
    
    # read both grayscale (for processing) and color (for guidance)
    img_gray = cv2.imread(input_path, cv2.IMREAD_GRAYSCALE)
    img_color = cv2.imread(input_path)
    img = img_gray
    if img is None:
        raise ValueError(f"Could not load image from {input_path}")
    
    print(f"Image size: {img.shape}")
    
    # Create depth map from image features
    blurred = cv2.GaussianBlur(img, (15, 15), 0)
    edges = cv2.Canny(blurred, 50, 150)
    
    # Distance transform for pseudo-depth
    depth = cv2.distanceTransform(255 - edges, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
    depth_normalized = np.uint8(np.clip(depth / (depth.max() + 1e-6) * 255, 0, 255))
    
    # Add contrast information
    contrast = cv2.convertScaleAbs(cv2.Laplacian(img, cv2.CV_64F))
    depth_final = cv2.addWeighted(depth_normalized, 0.7, contrast, 0.3, 0)
    
    # Smooth
    depth_final = cv2.medianBlur(depth_final, 5)

    # Enhance depth: fill holes and smooth while preserving edges
    depth_enh = enhance_depth(depth_final, img_color)

    cv2.imwrite(output_path, depth_enh)
    print(f"✓ Fallback depth map saved successfully!")

def estimate_depth(input_path: str, output_path: str):
    """
    Main function: Try MiDaS first, fall back to simple method
    """
    print(f"Loading image from {input_path}")
    
    # Try MiDaS first
    if estimate_depth_with_midas(input_path, output_path):
        return
    
    # Fall back to simple method
    estimate_depth_simple(input_path, output_path)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python depth_estimator.py <input_image> <output_depth_map>")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    try:
        estimate_depth(input_path, output_path)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)



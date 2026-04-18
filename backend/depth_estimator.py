#!/usr/bin/env python3
"""
Depth Estimation Script
Converts a 2D image to a depth map using MiDaS (or fallback method)
"""

import sys
import cv2
import numpy as np


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
        depth_normalized = (
            ((depth - depth_min) / (depth_max - depth_min + 1e-6) * 255)
            .cpu()
            .numpy()
            .astype(np.uint8)
        )

        cv2.imwrite(output_path, depth_normalized)
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

    img = cv2.imread(input_path, cv2.IMREAD_GRAYSCALE)
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

    cv2.imwrite(output_path, depth_final)
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

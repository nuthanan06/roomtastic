#!/usr/bin/env python3
"""
Simple test script for depth estimation
"""

import cv2
import numpy as np


def create_test_image():
    """Create a simple test image"""
    img = np.ones((300, 400, 3), dtype=np.uint8) * 128

    # Add some shapes for testing
    cv2.rectangle(img, (50, 50), (150, 150), (255, 0, 0), -1)
    cv2.circle(img, (300, 100), 50, (0, 255, 0), -1)
    cv2.ellipse(img, (200, 250), (50, 30), 0, 0, 360, (0, 0, 255), -1)

    return img


def generate_depth_map(input_path, output_path):
    """Generate a simple depth map from image"""
    print(f"Reading image from {input_path}")
    img = cv2.imread(input_path, cv2.IMREAD_GRAYSCALE)

    if img is None:
        print(f"Creating test image...")
        img = create_test_image()
        img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        img_gray = img

    # Create depth map using image features
    blurred = cv2.GaussianBlur(img_gray, (15, 15), 0)
    edges = cv2.Canny(blurred, 50, 150)

    # Distance transform creates a pseudo-depth effect
    depth = cv2.distanceTransform(255 - edges, cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
    depth_normalized = np.uint8(np.clip(depth / (depth.max() + 1e-6) * 255, 0, 255))

    # Add some variation from original contrast
    contrast = cv2.convertScaleAbs(cv2.Laplacian(img_gray, cv2.CV_64F))
    depth_final = cv2.addWeighted(depth_normalized, 0.7, contrast, 0.3, 0)

    # Apply median filter for smoothing
    depth_final = cv2.medianBlur(depth_final, 5)

    print(f"Saving depth map to {output_path}")
    cv2.imwrite(output_path, depth_final)
    print(f"✓ Depth map created successfully!")
    print(f"  Shape: {depth_final.shape}")
    print(f"  Min/Max values: {depth_final.min()}/{depth_final.max()}")


if __name__ == "__main__":
    import sys

    if len(sys.argv) == 3:
        input_path = sys.argv[1]
        output_path = sys.argv[2]
    else:
        print("Usage: python3 test_depth.py <input> <output>")
        print("\nCreating test image...")
        input_path = "test_input.jpg"
        output_path = "test_output.png"

        test_img = create_test_image()
        cv2.imwrite(input_path, test_img)
        print(f"Created test image: {input_path}")

    generate_depth_map(input_path, output_path)

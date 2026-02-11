'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { Viewer3D } from "./Viewer3D";


// For six orthographic views and their depth maps
interface OrthographicViews {
  front: string;
  back: string;
  left: string;
  right: string;
  top: string;
  bottom: string;
}

interface DepthMaps {
  front: string;
  back: string;
  left: string;
  right: string;
  top: string;
  bottom: string;
}

interface ProcessedData {
  originalImage: string;
  depthMap: string;
}


interface DepthMaps {
  front: string;
  back: string;
  left: string;
  right: string;
  top: string;
  bottom: string;
}

interface ProductDimensions {
  width: number;
  depth: number;
  height: number;
}


export const ImageUploader: React.FC = () => {
  // Step state: 0 = upload, 1 = orthographic, 2 = depth, 3 = 3D
  const [processedFile, setProcessedFile] = useState<File | null>(null);
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orthographicViews, setOrthographicViews] = useState<OrthographicViews | null>(null);
  const [depthMaps, setDepthMaps] = useState<DepthMaps | null>(null);
  const [mergedPly, setMergedPly] = useState<string | null>(null);
  const [glbData, setGlbData] = useState<string | null>(null);

  const [dimensions, setDimensions] = useState<ProductDimensions>({
    width: 19,
    depth: 5.5,
    height: 13,
  });
  const [inputMode, setInputMode] = useState<'file' | 'url'>('file');
  const [url, setUrl] = useState<string>('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreview(event.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select an image');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('image', file);
      formData.append('width', String(dimensions.width));
      formData.append('depth', String(dimensions.depth));
      formData.append('height', String(dimensions.height));

      const response = await axios.post('http://localhost:8080/api/process-3d', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data && response.data.success) {
        const views = response.data.views || {};
        const depths = response.data.depths || {};
        setOrthographicViews({
          front: views.front,
          back: views.back,
          left: views.left,
          right: views.right,
          top: views.top,
          bottom: views.bottom,
        });
        setDepthMaps({
          front: depths.front,
          back: depths.back,
          left: depths.left,
          right: depths.right,
          top: depths.top,
          bottom: depths.bottom,
        });
        if (response.data.mergedPly) {
          setMergedPly(response.data.mergedPly);
        }
        // Show 3D model immediately
        setStep(4);
      } else {
        setError(response.data.error || 'Failed to generate orthographic views');
      }
    } catch (e) {
      console.error(e);
      setError('Failed to generate orthographic views');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Generate depth maps for all six orientations, then normalize points (future step)
  const generateDepthMaps = async () => {
    // If depth maps already present (returned by process-3d), just proceed
    if (depthMaps) {
      setStep(3);
      return;
    }
    if (!orthographicViews) return;
    setIsLoading(true);
    setError(null);
    try {
      const keys = Object.keys(orthographicViews) as (keyof OrthographicViews)[];
      const depthResults: Partial<DepthMaps> = {};
      for (const key of keys) {
        const base64 = orthographicViews[key];
        let blob: Blob;
        if (base64.startsWith('data:')) {
          const res = await fetch(base64);
          blob = await res.blob();
        } else {
          blob = new Blob([base64], { type: 'image/png' });
        }
        const formData = new FormData();
        formData.append('image', blob, `${key}.png`);
        formData.append('width', String(dimensions.width));
        formData.append('depth', String(dimensions.depth));
        formData.append('height', String(dimensions.height));
        const response = await axios.post('http://localhost:8080/api/process-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (response.data.success) {
          depthResults[key] = response.data.depthMap;
        } else {
          throw new Error(response.data.error || 'Processing failed');
        }
      }
      // TODO: Normalize all points from all six depth maps for a unified 3D model
      setDepthMaps(depthResults as DepthMaps);
      setStep(3);
    } catch (e) {
      console.error(e);
      setError('Failed to generate depth maps');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post('http://localhost:8080/api/process-url', { url });

      if (response.data.success) {
        setProcessedData({
          originalImage: response.data.originalImage,
          depthMap: response.data.depthMap,
        });
      } else {
        setError(response.data.error || 'Processing failed');
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(`Error: ${err.response?.data?.error || err.message}`);
      } else {
        setError('An error occurred during processing');
      }
    } finally {
      setIsLoading(false);
    }
  };


  // Step 1: Show orthographic views
  if (step === 2 && orthographicViews) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900">
        <div className="p-4 bg-gray-800 border-b border-gray-700 w-full flex justify-between items-center">
          <button
            onClick={() => {
              setOrthographicViews(null);
              setOrthographicViews(null);
              setFile(null);
              setMergedPly(null);
              setStep(0);
              setMergedPly(null);
              setStep(0);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            ← Back to Upload
          </button>
          <button
            onClick={generateDepthMaps}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            Next: Depth Maps →
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <h2 className="text-2xl text-white mb-4">Orthographic Views</h2>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(orthographicViews).map(([side, img]) => (
              <div key={side} className="flex flex-col items-center">
                <span className="text-gray-300 mb-1 capitalize">{side}</span>
                <img src={img} alt={side} className="rounded shadow-lg border border-gray-700 max-w-30 max-h-30 bg-black" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Show depth maps
  if (step === 3 && depthMaps) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900">
        <div className="p-4 bg-gray-800 border-b border-gray-700 w-full flex justify-between items-center">
          <button
            onClick={() => {
              setDepthMaps(null);
              setStep(2);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            ← Back to Orthographic Views
          </button>
          <button
            onClick={() => setStep(4)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            Next: 3D Model →
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <h2 className="text-2xl text-white mb-4">Depth Maps</h2>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(depthMaps).map(([side, img]) => (
              <div key={side} className="flex flex-col items-center">
                <span className="text-gray-300 mb-1 capitalize">{side}</span>
                <img src={img} alt={side + ' depth'} className="rounded shadow-lg border border-gray-700 max-w-30 max-h-30 bg-black" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Show 3D model (allow GLB-only path)
  if (step === 4 && (glbData || (depthMaps && orthographicViews))) {
    return (
      <div className="w-full h-screen flex flex-col">
        <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
          <button
            onClick={() => setStep(3)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            ← Back to Depth Maps
          </button>
          <button
            onClick={() => {
              setOrthographicViews(null);
              setDepthMaps(null);
              setFile(null);
              setMergedPly(null);
              setStep(0);
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
          >
            New Upload
          </button>
        </div>
        <div className="flex-1">
          {/* TODO: Update Viewer3D to accept all six sides */}
          {/* TODO: Update Viewer3D to accept all six sides */}
          <Viewer3D
            originalImage={orthographicViews ? orthographicViews.front : undefined}
            depthMap={depthMaps ? depthMaps.front : undefined}
            backImage={orthographicViews ? orthographicViews.back : undefined}
            backDepthMap={depthMaps ? depthMaps.back : undefined}
            leftImage={orthographicViews ? orthographicViews.left : undefined}
            leftDepthMap={depthMaps ? depthMaps.left : undefined}
            rightImage={orthographicViews ? orthographicViews.right : undefined}
            rightDepthMap={depthMaps ? depthMaps.right : undefined}
            topImage={orthographicViews ? orthographicViews.top : undefined}
            topDepthMap={depthMaps ? depthMaps.top : undefined}
            bottomImage={orthographicViews ? orthographicViews.bottom : undefined}
            bottomDepthMap={depthMaps ? depthMaps.bottom : undefined}
            mergedPly={mergedPly}
            glbData={glbData}
            // position on floor plane: center X,Z at 0, place bottom on y=0
            position={[0, (dimensions.height || 1) * 0.5, 0]}
            // scale: convert cm to meters roughly (the Viewer uses normalized coordinates)
            modelScale={Math.max(0.01, (dimensions.width || 1) / 100)}
          />
        </div>
      </div>
    );
  }
  // Step 0: Upload UI
  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-2xl p-8 border border-gray-700">
        <h1 className="text-3xl font-bold text-white mb-2">3D Model Pipeline</h1>
        <p className="text-gray-400 mb-6">Step 1: Upload an image to generate orthographic views, depth maps, and a 3D model</p>

        {/* Toggle between File and URL modes */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setInputMode('file');
              setUrl('');
              setError(null);
            }}
            className={`flex-1 py-2 px-4 rounded font-medium transition ${
              inputMode === 'file'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Upload File
          </button>
          <button
            onClick={() => {
              setInputMode('url');
              setFile(null);
              setPreview(null);
              setError(null);
            }}
            className={`flex-1 py-2 px-4 rounded font-medium transition ${
              inputMode === 'url'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Paste URL
          </button>
        </div>

        <div className="space-y-4">
          {inputMode === 'file' ? (
            <>
              {/* File Preview */}
              {preview && (
                <div className="relative overflow-hidden rounded-lg border-2 border-gray-600">
                  <img src={preview} alt="Preview" className="w-full h-auto" />
                </div>
              )}

              {/* File Input */}
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-blue-400 transition cursor-pointer">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="text-gray-400">
                    <p className="text-sm font-medium">Click to upload image</p>
                    <p className="text-xs mt-1">PNG, JPG, GIF up to 50MB</p>
                  </div>
                </label>
              </div>

          {/* Dimensions Input */}
          <div className="bg-gray-700 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-gray-300">Product Dimensions (cm)</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-gray-400">Width</label>
                <input
                  type="number"
                  step="0.1"
                  value={dimensions.width}
                  onChange={(e) => setDimensions({ ...dimensions, width: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-gray-600 text-white rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Depth</label>
                <input
                  type="number"
                  step="0.1"
                  value={dimensions.depth}
                  onChange={(e) => setDimensions({ ...dimensions, depth: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-gray-600 text-white rounded px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Height</label>
                <input
                  type="number"
                  step="0.1"
                  value={dimensions.height}
                  onChange={(e) => setDimensions({ ...dimensions, height: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-gray-600 text-white rounded px-2 py-1 text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">From Amazon product listing</p>
          </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-900/30 border border-red-600 text-red-200 px-4 py-3 rounded text-sm">
                  {error}
                </div>
              )}

            </>
          ) : (
            <>
              {/* URL Input */}
              <div>
                <input
                  type="url"
                  placeholder="Paste product URL (e.g., ikea.com/products/...)"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none transition placeholder-gray-500"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-900/30 border border-red-600 text-red-200 px-4 py-3 rounded text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleUrlSubmit}
                disabled={!url.trim() || isLoading}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isLoading ? 'Processing... (this may take a minute)' : 'Process URL'}
              </button>
            </>
          )}

          {/* Info Text */}
          <p className="text-xs text-gray-500 text-center mt-4">
            Enter product dimensions to accurately scale the 3D model. Uses MiDaS depth estimation.
            Enter product dimensions to accurately scale the 3D model. Uses MiDaS depth estimation.
          </p>
        </div>
      </div>
    </div>
  );
};
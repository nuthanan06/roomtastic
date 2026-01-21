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

  if (processedData) {
    return (
      <div className="w-full h-screen flex flex-col">
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <button
            onClick={() => {
              setProcessedData(null);
              setFile(null);
              setPreview(null);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            ← Back to Upload
          </button>
        </div>
        <div className="flex-1">
          <Viewer3D
            originalImage={processedData.originalImage}
            depthMap={processedData.depthMap}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-2xl p-8 border border-gray-700">
        <h1 className="text-3xl font-bold text-white mb-2">Roomtastic</h1>
        <p className="text-gray-400 mb-6">Convert 2D images to 3D models</p>

        <div className="space-y-4">
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

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/30 border border-red-600 text-red-200 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || isLoading}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading ? 'Processing... (this may take a minute)' : 'Convert to 3D'}
          </button>

          {/* Info Text */}
          <p className="text-xs text-gray-500 text-center mt-4">
            Your image will be processed using MiDaS depth estimation and converted to an interactive 3D model.
          </p>
        </div>
      </div>
    </div>
  );
};

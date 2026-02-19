'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { Viewer3D } from "./Viewer3D";

interface ProcessedData {
  originalImage: string;
  depthMap: string;
}

interface ProductDimensions {
  width: number;
  depth: number;
  height: number;
}

export const ImageUploader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [inputMode, setInputMode] = useState<'file' | 'url'>('file');
  const [url, setUrl] = useState<string>('');
  const [dimensions, setDimensions] = useState<ProductDimensions>({
    width: 100,
    depth: 100,
    height: 100,
  });

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

      const response = await axios.post('http://localhost:8080/api/process-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

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

  const handleUrlSubmit = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Ensure URL has protocol
      let processUrl = url.trim();
      if (!processUrl.startsWith('http://') && !processUrl.startsWith('https://')) {
        processUrl = 'https://' + processUrl;
      }

      const response = await axios.post('http://localhost:8080/api/process-url', { url: processUrl });

      if (response.data.success) {
        setProcessedData({
          originalImage: response.data.originalImage,
          depthMap: response.data.depthMap,
        });
      } else {
        setError(response.data.error || 'Processing failed');
      }
    } catch (err) {
      console.error('URL processing error:', err);
      if (axios.isAxiosError(err)) {
        console.error('Axios error response:', err.response);
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
            Your image will be processed using MiDaS depth estimation and converted to an interactive 3D model.
          </p>
        </div>
      </div>
    </div>
  );
};

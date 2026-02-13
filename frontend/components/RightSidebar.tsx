'use client';

import React, { useState } from 'react';
import axios from 'axios';

interface ProcessedData {
  originalImage: string;
  depthMap: string;
}

interface ImageUploadSidebarProps {
  onProcessed?: (data: ProcessedData | null) => void;
}

export default function ImageUploadSidebar({ onProcessed }: ImageUploadSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

      const response = await axios.post('http://localhost:8080/api/process-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const processedData = {
          originalImage: response.data.originalImage,
          depthMap: response.data.depthMap,
        };
        onProcessed?.(processedData);
        setError(null);
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
      let processUrl = url.trim();
      if (!processUrl.startsWith('http://') && !processUrl.startsWith('https://')) {
        processUrl = 'https://' + processUrl;
      }

      const response = await axios.post('http://localhost:8080/api/process-url', { url: processUrl });

      if (response.data.success) {
        const processedData = {
          originalImage: response.data.originalImage,
          depthMap: response.data.depthMap,
        };
        onProcessed?.(processedData);
        setError(null);
      } else {
        setError(response.data.error || 'Processing failed');
      }
    } catch (err) {
      console.error('URL processing error:', err);
      if (axios.isAxiosError(err)) {
        setError(`Error: ${err.response?.data?.error || err.message}`);
      } else {
        setError('An error occurred during processing');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setUrl('');
    setError(null);
    onProcessed?.(null);
  };

  return (
    <div 
      className={`fixed right-0 top-0 h-full bg-gray-900 border-l border-gray-700 shadow-2xl z-10 transition-all duration-300 ${
        isCollapsed ? 'w-12' : 'w-96'
      }`}
    >
      {/* Collapse/Expand Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute left-0 top-4 -translate-x-full bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-l-lg border border-gray-700 border-r-0 transition"
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        )}
      </button>

      {!isCollapsed && (
        <div className="h-full overflow-y-auto">
          <div className="p-6">
        <h2 className="text-2xl font-bold text-white mb-2">Roomtastic</h2>
        <p className="text-gray-400 text-sm mb-6">Convert 2D images to 3D models</p>

        {/* Toggle between File and URL modes */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setInputMode('file');
              setUrl('');
              setError(null);
            }}
            className={`flex-1 py-2 px-4 rounded font-medium transition text-sm ${
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
            className={`flex-1 py-2 px-4 rounded font-medium transition text-sm ${
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
                  <img src={preview} alt="Preview" className="w-full h-auto max-h-48 object-contain" />
                </div>
              )}

              {/* File Input */}
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center hover:border-blue-400 transition cursor-pointer">
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
                  placeholder="Paste image URL"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-blue-400 focus:outline-none transition placeholder-gray-500 text-sm"
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

          {/* Reset Button */}
          {(file || url || preview) && (
            <button
              onClick={handleReset}
              className="w-full bg-gray-700 text-white font-semibold py-2 rounded-lg hover:bg-gray-600 transition text-sm"
            >
              Reset
            </button>
          )}

          {/* Info Text */}
          <p className="text-xs text-gray-500 text-center mt-4">
            Your image will be processed using MiDaS depth estimation and converted to an interactive 3D model.
          </p>
        </div>
          </div>
        </div>
      )}

      {isCollapsed && (
        <div className="h-full flex items-center justify-center">
          <div className="transform -rotate-90 text-white text-xs font-medium whitespace-nowrap">
            Upload
          </div>
        </div>
      )}
    </div>
  );
}

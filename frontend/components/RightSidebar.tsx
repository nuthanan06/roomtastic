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
      className={`fixed right-0 top-0 h-full bg-slate-950/95 border-l border-violet-500/20 shadow-2xl shadow-violet-950/40 z-10 transition-all duration-300 backdrop-blur-md ${
        isCollapsed ? "w-12" : "w-96"
      }`}
    >
      {/* Collapse/Expand Button */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute left-0 top-4 -translate-x-full bg-slate-900 hover:bg-slate-800 text-indigo-200 p-2 rounded-l-lg border border-violet-500/25 border-r-0 transition"
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
        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Image → depth</h2>
        <p className="text-indigo-200/65 text-sm mb-6">Lab preview only — room layouts use My rooms → Edit.</p>

        {/* Toggle between File and URL modes */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setInputMode('file');
              setUrl('');
              setError(null);
            }}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition text-sm ${
              inputMode === "file"
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-violet-900/30"
                : "bg-slate-800 text-indigo-200/80 hover:bg-slate-700 border border-violet-500/15"
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
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition text-sm ${
              inputMode === "url"
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-violet-900/30"
                : "bg-slate-800 text-indigo-200/80 hover:bg-slate-700 border border-violet-500/15"
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
                <div className="relative overflow-hidden rounded-lg border border-violet-500/30">
                  <img src={preview} alt="Preview" className="w-full h-auto max-h-48 object-contain" />
                </div>
              )}

              {/* File Input */}
              <div className="border-2 border-dashed border-violet-500/35 rounded-xl p-4 text-center hover:border-violet-400/60 transition cursor-pointer">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="text-indigo-200/70">
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
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold py-3 rounded-xl hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-violet-900/25"
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
                  className="w-full bg-slate-900 text-white px-4 py-3 rounded-xl border border-violet-500/25 focus:border-violet-400 focus:outline-none transition placeholder-slate-500 text-sm"
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
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold py-3 rounded-xl hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-violet-900/25"
              >
                {isLoading ? 'Processing... (this may take a minute)' : 'Process URL'}
              </button>
            </>
          )}

          {/* Reset Button */}
          {(file || url || preview) && (
            <button
              onClick={handleReset}
              className="w-full bg-slate-800 text-indigo-100 font-semibold py-2 rounded-xl hover:bg-slate-700 border border-violet-500/20 transition text-sm"
            >
              Reset
            </button>
          )}

          {/* Info Text */}
          <p className="text-xs text-slate-500 text-center mt-4">
            Your image will be processed using MiDaS depth estimation and converted to an interactive 3D model.
          </p>
        </div>
          </div>
        </div>
      )}

      {isCollapsed && (
        <div className="h-full flex items-center justify-center">
          <div className="transform -rotate-90 text-indigo-200 text-xs font-medium whitespace-nowrap">Upload</div>
        </div>
      )}
    </div>
  );
}

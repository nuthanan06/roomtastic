'use client';

import { useState, useEffect } from 'react';

interface LeftSidebarProps {
  onDimensionsChange?: (width: number, length: number) => void;
}

export default function LeftSidebar({ onDimensionsChange }: LeftSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [width, setWidth] = useState(10); // default width of 10
  const [length, setLength] = useState(10); // default length of 10

  // Initialize dimensions on mount
  useEffect(() => {
    onDimensionsChange?.(width, length);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div 
      className={`fixed left-0 top-0 h-full bg-gray-900 border-r border-gray-700 shadow-2xl z-10 transition-all duration-300 ${
        isCollapsed ? 'w-12' : 'w-96'
      }`}
    >
      {/* Collapse/Expand Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute right-0 top-4 translate-x-full bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-r-lg border border-gray-700 border-l-0 transition"
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {!isCollapsed && (
        <div className="h-full overflow-y-auto">
          <div className="p-6">
            <h2 className="text-2xl font-bold text-white mb-6">Room Controls</h2>
            
            <div className="space-y-6">
              {/* Width Input */}
              <div>
                <label 
                  htmlFor="width" 
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Width
                </label>
                <input
                  type="number"
                  id="width"
                  min="1"
                  max="50"
                  value={width}
                  onChange={(e) => {
                    const newWidth = Number(e.target.value);
                    setWidth(newWidth);
                    onDimensionsChange?.(newWidth, length);
                  }}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:bg-white focus:text-gray-900 focus:border-blue-400 focus:outline-none transition-all duration-200"
                />
              </div>

              {/* Length Input */}
              <div>
                <label 
                  htmlFor="length" 
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Length
                </label>
                <input
                  type="number"
                  id="length"
                  min="1"
                  max="50"
                  value={length}
                  onChange={(e) => {
                    const newLength = Number(e.target.value);
                    setLength(newLength);
                    onDimensionsChange?.(width, newLength);
                  }}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:bg-white focus:text-gray-900 focus:border-blue-400 focus:outline-none transition-all duration-200"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {isCollapsed && (
        <div className="h-full flex items-center justify-center">
          <div className="transform -rotate-90 text-white text-xs font-medium whitespace-nowrap">
            Tools
          </div>
        </div>
      )}
    </div>
  );
}

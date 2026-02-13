'use client';

import { useState } from 'react';

export default function LeftSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

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
            {/* Empty sidebar - content will be added later */}
            <h2 className="text-2xl font-bold text-white mb-2">Tools</h2>
            <p className="text-gray-400 text-sm">Content coming soon...</p>
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

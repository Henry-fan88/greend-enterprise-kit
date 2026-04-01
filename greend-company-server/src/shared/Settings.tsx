import React from 'react';
import { useApp } from '../store';
import { Type, Check, X } from 'lucide-react';

export default function SettingsPage({ onClose }: { onClose: () => void }) {
  const { theme, setTheme } = useApp();

  const fonts = [
    { id: 'Inter', name: 'Inter (Modern Sans)' },
    { id: 'Roboto', name: 'Roboto (Clean Sans)' },
    { id: 'Playfair Display', name: 'Playfair (Elegant Serif)' },
    { id: 'JetBrains Mono', name: 'JetBrains (Technical Mono)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative p-8">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        <h2 className="text-3xl font-bold mb-8">Settings & Customization</h2>

        <div className="bg-gray-50 rounded-xl border border-gray-100 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Type className="w-6 h-6 text-gray-400" />
            <h3 className="text-xl font-semibold">Typography</h3>
          </div>
          <p className="text-gray-500 mb-6">Select a font family for the dashboard interface.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fonts.map((font) => (
              <button
                key={font.id}
                onClick={() => setTheme({ ...theme, font: font.id })}
                style={{ fontFamily: font.id }}
                className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                  theme.font === font.id ? 'border-black bg-white shadow-sm' : 'border-transparent bg-white hover:border-gray-200'
                }`}
              >
                <div>
                  <span className="block font-medium text-lg">{font.name}</span>
                  <span className="block text-sm text-gray-500 mt-1">The quick brown fox jumps over the lazy dog.</span>
                </div>
                {theme.font === font.id && <Check className="w-5 h-5 text-black shrink-0 ml-4" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

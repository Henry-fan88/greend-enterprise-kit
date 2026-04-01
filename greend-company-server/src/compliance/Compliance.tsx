import React, { useState } from 'react';
import { CheckCircle2, Circle, AlertCircle, FileText, Globe, MapPin, ChevronDown } from 'lucide-react';
import { useApp } from '../store';

export default function Compliance() {
  const { frameworks, setFrameworks, addLog } = useApp();
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);

  const regions = ['All', 'Global', 'European Union', 'United States'];

  const filteredFrameworks = selectedRegion === 'All'
    ? frameworks
    : frameworks.filter(fw => fw.region === selectedRegion || fw.region === 'Global');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-500 bg-emerald-50 border-emerald-200';
      case 'on-track': return 'text-blue-500 bg-blue-50 border-blue-200';
      case 'at-risk': return 'text-amber-500 bg-amber-50 border-amber-200';
      default: return 'text-gray-500 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'on-track': return <Circle className="w-5 h-5 text-blue-500 fill-blue-500/20" />;
      case 'at-risk': return <AlertCircle className="w-5 h-5 text-amber-500" />;
      default: return <Circle className="w-5 h-5 text-gray-500" />;
    }
  };

  const toggleRequirement = (frameworkId: string, reqId: string) => {
    const updatedFrameworks = frameworks.map(fw => {
      if (fw.id === frameworkId) {
        const updatedReqs = fw.requirements.map(req => {
          if (req.id === reqId) {
            const newCompleted = !req.completed;
            addLog('Updated Compliance', `Marked "${req.name}" as ${newCompleted ? 'completed' : 'incomplete'} in ${fw.name}`);
            return { ...req, completed: newCompleted };
          }
          return req;
        });

        const completedCount = updatedReqs.filter(r => r.completed).length;
        const progress = Math.round((completedCount / updatedReqs.length) * 100);

        let status: 'completed' | 'on-track' | 'at-risk' = 'at-risk';
        if (progress === 100) status = 'completed';
        else if (progress >= 50) status = 'on-track';

        return { ...fw, requirements: updatedReqs, progress, status };
      }
      return fw;
    });

    setFrameworks(updatedFrameworks);
  };

  return (
    <div className="p-8 h-full overflow-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold">Compliance Tracking</h2>
          <p className="text-gray-500 mt-2">Monitor your progress against global ESG disclosure frameworks.</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowRegionDropdown(!showRegionDropdown)}
            className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50"
          >
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium">Region: {selectedRegion}</span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {showRegionDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 z-50 py-2">
              {regions.map(region => (
                <button
                  key={region}
                  onClick={() => {
                    setSelectedRegion(region);
                    setShowRegionDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${selectedRegion === region ? 'font-bold text-black' : 'text-gray-700'}`}
                >
                  {region}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {filteredFrameworks.map((fw) => (
          <div key={fw.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <div className="flex justify-between items-start mb-4">
                <div className={`px-3 py-1 rounded-full text-xs font-medium border flex items-center space-x-1 ${getStatusColor(fw.status)}`}>
                  {getStatusIcon(fw.status)}
                  <span className="capitalize">{fw.status.replace('-', ' ')}</span>
                </div>
                <div className="flex items-center text-gray-400 text-sm">
                  <Globe className="w-4 h-4 mr-1" />
                  {fw.region}
                </div>
              </div>

              <h3 className="text-xl font-bold mb-2">{fw.name}</h3>
              <p className="text-sm text-gray-500 line-clamp-2">{fw.description}</p>

              <div className="mt-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-gray-700">Overall Progress</span>
                  <span className="font-bold">{fw.progress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      fw.progress >= 90 ? 'bg-emerald-500' :
                      fw.progress >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${fw.progress}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="p-6 flex-1 bg-gray-50/50">
              <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="w-4 h-4 mr-2 text-gray-400" />
                Key Requirements
              </h4>
              <ul className="space-y-3">
                {fw.requirements.map((req) => (
                  <li
                    key={req.id}
                    className="flex items-start space-x-3 cursor-pointer group"
                    onClick={() => toggleRequirement(fw.id, req.id)}
                  >
                    {req.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5 group-hover:text-emerald-600 transition-colors" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-300 shrink-0 mt-0.5 group-hover:text-gray-400 transition-colors" />
                    )}
                    <span className={`text-sm select-none transition-colors ${req.completed ? 'text-gray-700' : 'text-gray-500 group-hover:text-gray-700'}`}>
                      {req.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

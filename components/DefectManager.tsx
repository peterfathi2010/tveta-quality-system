import React, { useState } from 'react';
import { Defect } from '../types';
import { analyzeDefect } from '../services/geminiService';
import { AlertCircle, BrainCircuit, Check, X, ChevronRight, Loader2 } from 'lucide-react';

interface DefectManagerProps {
  defects: Defect[];
  onUpdateDefect: (defect: Defect) => void;
}

const DefectManager: React.FC<DefectManagerProps> = ({ defects, onUpdateDefect }) => {
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async (defect: Defect) => {
    setAnalyzing(true);
    try {
      const result = await analyzeDefect(defect.description, defect.auditTitle);
      const updatedDefect: Defect = {
        ...defect,
        aiAnalysis: result.analysis,
        aiRecommendation: result.recommendation
      };
      onUpdateDefect(updatedDefect);
      setSelectedDefect(updatedDefect); // Update local view
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStatusToggle = (defect: Defect) => {
    const newStatus = defect.status === 'Open' ? 'Resolved' : 'Open';
    onUpdateDefect({ ...defect, status: newStatus });
    if (selectedDefect && selectedDefect.id === defect.id) {
      setSelectedDefect({ ...defect, status: newStatus });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
      {/* List Column */}
      <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h2 className="font-bold text-slate-800">Defect Log</h2>
          <p className="text-xs text-slate-500 mt-1">{defects.filter(d => d.status === 'Open').length} Open Issues</p>
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-2">
          {defects.map(defect => (
            <div 
              key={defect.id}
              onClick={() => setSelectedDefect(defect)}
              className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                selectedDefect?.id === defect.id 
                ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' 
                : 'bg-white border-slate-100 hover:bg-slate-50'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                  defect.status === 'Open' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                }`}>
                  {defect.status}
                </span>
                <span className="text-[10px] text-slate-400">{new Date(defect.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-sm font-medium text-slate-800 line-clamp-2">{defect.description}</p>
              <p className="text-xs text-slate-500 mt-1 truncate">{defect.auditTitle}</p>
            </div>
          ))}
          {defects.length === 0 && (
            <div className="text-center p-8 text-slate-400 text-sm">No defects recorded.</div>
          )}
        </div>
      </div>

      {/* Detail Column */}
      <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
        {selectedDefect ? (
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-bold text-slate-800">Defect Details</h2>
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                    selectedDefect.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                    selectedDefect.severity === 'High' ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {selectedDefect.severity} Priority
                  </span>
                </div>
                <p className="text-slate-600">{selectedDefect.description}</p>
              </div>
              <button 
                onClick={() => handleStatusToggle(selectedDefect)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedDefect.status === 'Open' 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                }`}
              >
                {selectedDefect.status === 'Open' ? <Check size={16} /> : <X size={16} />}
                Mark {selectedDefect.status === 'Open' ? 'Resolved' : 'Open'}
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Context Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block text-xs uppercase mb-1">Source Audit</span>
                  <span className="font-medium text-slate-700">{selectedDefect.auditTitle}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-500 block text-xs uppercase mb-1">Reported</span>
                  <span className="font-medium text-slate-700">{new Date(selectedDefect.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* AI Analysis Section */}
              <div className="border border-indigo-100 rounded-xl overflow-hidden">
                <div className="bg-indigo-50/50 p-4 border-b border-indigo-100 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-indigo-900 font-semibold">
                    <BrainCircuit size={20} className="text-indigo-600" />
                    AI Root Cause Analysis
                  </div>
                  {!selectedDefect.aiAnalysis && (
                    <button 
                      onClick={() => handleAnalyze(selectedDefect)}
                      disabled={analyzing}
                      className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                      {analyzing ? <Loader2 size={14} className="animate-spin" /> : 'Run Analysis'}
                    </button>
                  )}
                </div>
                
                <div className="p-4 bg-gradient-to-b from-white to-indigo-50/20 min-h-[120px]">
                  {selectedDefect.aiAnalysis ? (
                    <div className="space-y-4 animate-fade-in">
                      <div>
                        <h4 className="text-sm font-bold text-slate-700 mb-1">Root Cause</h4>
                        <p className="text-sm text-slate-600 leading-relaxed">{selectedDefect.aiAnalysis}</p>
                      </div>
                      <div className="pt-4 border-t border-indigo-100">
                        <h4 className="text-sm font-bold text-slate-700 mb-1">Recommended Action (CAPA)</h4>
                        <p className="text-sm text-slate-600 leading-relaxed bg-white p-3 rounded border border-indigo-100 shadow-sm">
                          {selectedDefect.aiRecommendation}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-6 text-slate-400 gap-2">
                       <AlertCircle size={32} className="opacity-20" />
                       <p className="text-sm">No analysis performed yet.</p>
                       <p className="text-xs">Click "Run Analysis" to let Gemini identify root causes.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <ChevronRight size={48} className="opacity-20 mb-4" />
            <p>Select a defect to view details and AI analysis</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DefectManager;
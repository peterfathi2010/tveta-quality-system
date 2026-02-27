
import React, { useState } from 'react';
import { Audit, AuditStatus, ChecklistItem, ChecklistItemStatus, Defect } from '../types';
import { generateAuditChecklist } from '../services/geminiService';
import { Play, Plus, Loader2, Save, XCircle, CheckCircle, HelpCircle, Search, ArrowLeft, Sparkles, Eye } from 'lucide-react';

interface AuditToolProps {
  audits: Audit[];
  onSaveAudit: (audit: Audit) => void;
  onUpdateAudit: (audit: Audit) => void;
  onLogDefect: (defect: Defect) => void;
}

const AuditTool: React.FC<AuditToolProps> = ({ audits, onSaveAudit, onUpdateAudit, onLogDefect }) => {
  const [view, setView] = useState<'list' | 'create' | 'run' | 'detail'>('list');
  const [activeAudit, setActiveAudit] = useState<Audit | null>(null);
  
  // Creation State
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Search State
  const [searchTerm, setSearchTerm] = useState('');

  // Handlers
  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    try {
      const items = await generateAuditChecklist(topic);
      const newAudit: Audit = {
        id: crypto.randomUUID(),
        title: topic,
        context: topic,
        createdAt: new Date().toISOString(),
        status: AuditStatus.DRAFT,
        items: items
      };
      setActiveAudit(newAudit);
      // View is already 'create', but this ensures we move to preview stage
      setView('create'); 
    } catch (error) {
      console.error(error);
      alert("Failed to generate audit. Check console.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = () => {
    if (activeAudit) {
      onSaveAudit(activeAudit);
      setView('list');
      setTopic('');
      setActiveAudit(null);
    }
  };

  const handleStartRun = (audit: Audit) => {
    setActiveAudit({ ...audit, status: AuditStatus.IN_PROGRESS });
    setView('run');
  };

  const handleViewAudit = (audit: Audit) => {
    setActiveAudit(audit);
    setView('detail');
  };

  const handleCheckItem = (itemId: string, status: ChecklistItemStatus) => {
    if (!activeAudit) return;
    
    const updatedItems = activeAudit.items.map(item => 
      item.id === itemId ? { ...item, status } : item
    );
    
    setActiveAudit({ ...activeAudit, items: updatedItems });
  };

  const handleLogDefectForItem = (item: ChecklistItem) => {
    if (!activeAudit) return;
    
    const defect: Defect = {
      id: crypto.randomUUID(),
      auditId: activeAudit.id,
      auditTitle: activeAudit.title,
      description: `Failed Check: ${item.question}. Context: ${item.description || ''}`,
      severity: 'Medium', // Default
      status: 'Open',
      createdAt: new Date().toISOString()
    };
    
    onLogDefect(defect);
    alert(`Defect logged for "${item.category}"`);
  };

  const handleCompleteAudit = () => {
    if (!activeAudit) return;

    // Calculate score
    const applicableItems = activeAudit.items.filter(i => i.status !== ChecklistItemStatus.NA);
    const passedItems = applicableItems.filter(i => i.status === ChecklistItemStatus.PASS);
    const score = applicableItems.length > 0 
      ? Math.round((passedItems.length / applicableItems.length) * 100)
      : 0;

    const completedAudit = {
      ...activeAudit,
      status: AuditStatus.COMPLETED,
      score
    };
    
    onUpdateAudit(completedAudit);
    setView('list');
    setActiveAudit(null);
  };

  // --- SUB-COMPONENTS RENDER ---

  const renderList = () => {
    const filteredAudits = audits.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Audit Management</h2>
            <p className="text-slate-500">Manage and track quality audits.</p>
          </div>
          <div className="flex gap-2">
             <div className="relative">
               <input 
                 type="text" 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 placeholder="Search audits..."
                 className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
               />
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
             </div>
             <button 
               onClick={() => {
                  setTopic('');
                  setActiveAudit(null);
                  setView('create');
               }}
               className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm"
             >
               <Plus size={20} />
               <span>New Audit</span>
             </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Audit Name</th>
                <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Created</th>
                <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Status</th>
                <th className="px-6 py-4 font-semibold text-slate-600 text-sm">Score</th>
                <th className="px-6 py-4 font-semibold text-slate-600 text-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAudits.map(audit => (
                <tr key={audit.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-slate-800 font-medium">
                    <button onClick={() => handleViewAudit(audit)} className="hover:text-blue-600 text-left">
                      {audit.title}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm">{new Date(audit.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      audit.status === AuditStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                      audit.status === AuditStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {audit.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">{audit.score !== undefined ? `${audit.score}%` : '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                        {audit.status !== AuditStatus.COMPLETED && (
                          <button 
                            onClick={() => handleStartRun(audit)}
                            className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center gap-1"
                          >
                            <Play size={16} /> Continue
                          </button>
                        )}
                        <button 
                           onClick={() => handleViewAudit(audit)}
                           className="text-slate-500 hover:text-blue-600 text-sm font-medium flex items-center gap-1"
                        >
                           <Eye size={16} /> View
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAudits.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    {searchTerm ? 'No audits match your search.' : 'No audits found. Create a new one.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderCreatePreview = () => {
    // Stage 1: Topic Input
    if (!activeAudit) {
        return (
            <div className="max-w-2xl mx-auto mt-10 animate-fade-in">
                 <button onClick={() => setView('list')} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors">
                    <ArrowLeft size={20} /> Back to List
                 </button>
                 <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
                    <div className="mb-6">
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Sparkles className="text-blue-600" />
                            Create AI Audit
                        </h2>
                        <p className="text-slate-500 mt-1">Enter a topic or context, and Gemini will generate a professional audit checklist for you.</p>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Audit Topic / Context</label>
                            <input 
                                type="text" 
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="e.g. 'Laboratory Safety Inspection' or 'ISO 9001 Compliance'"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                                autoFocus
                            />
                        </div>
                        <button 
                             onClick={handleGenerate}
                             disabled={isGenerating || !topic}
                             className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-4 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-all font-bold shadow-lg shadow-blue-600/20 mt-2"
                        >
                             {isGenerating ? <Loader2 className="animate-spin" size={24}/> : <Sparkles size={24} />}
                             <span>Generate Checklist with AI</span>
                        </button>
                    </div>
                 </div>
            </div>
        );
    }

    // Stage 2: Preview Generated Items
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">Preview: {activeAudit?.title}</h2>
          <div className="space-x-2">
            <button onClick={() => setView('list')} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
            <button onClick={handleSaveDraft} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2">
              <Save size={18} /> Save & Exit
            </button>
            <button onClick={() => activeAudit && handleStartRun(activeAudit)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm transition-colors flex items-center gap-2">
              <Play size={18} /> Start Now
            </button>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 mb-6">Gemini has generated the following checklist items based on your topic. Review them before starting.</p>
          <div className="space-y-4">
            {activeAudit?.items.map((item, idx) => (
              <div key={item.id} className="p-4 border border-slate-100 rounded-lg bg-slate-50">
                <div className="flex items-start gap-3">
                  <span className="bg-slate-200 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">{idx + 1}</span>
                  <div>
                    <h4 className="font-semibold text-slate-800">{item.question}</h4>
                    <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                    <span className="inline-block mt-2 text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">{item.category}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderRun = () => (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100 sticky top-4 z-10">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{activeAudit?.title}</h2>
          <span className="text-sm text-slate-500">Audit in progress</span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setView('list')} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">Save & Close</button>
          <button onClick={handleCompleteAudit} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm font-medium">Complete Audit</button>
        </div>
      </div>

      <div className="space-y-4">
        {activeAudit?.items.map((item) => (
          <div key={item.id} className={`bg-white p-6 rounded-xl shadow-sm border transition-all ${
            item.status === ChecklistItemStatus.FAIL ? 'border-red-200 bg-red-50/30' : 
            item.status === ChecklistItemStatus.PASS ? 'border-green-200 bg-green-50/30' : 
            'border-slate-100'
          }`}>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.category}</span>
                </div>
                <h3 className="text-lg font-medium text-slate-800 mb-2">{item.question}</h3>
                <p className="text-slate-600 text-sm">{item.description}</p>
              </div>

              <div className="flex flex-row md:flex-col gap-2 justify-center min-w-[140px]">
                <button 
                  onClick={() => handleCheckItem(item.id, ChecklistItemStatus.PASS)}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                    item.status === ChecklistItemStatus.PASS 
                    ? 'bg-green-600 text-white border-green-600 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-green-300 hover:text-green-600'
                  }`}
                >
                  <CheckCircle size={18} /> Pass
                </button>
                <button 
                  onClick={() => handleCheckItem(item.id, ChecklistItemStatus.FAIL)}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                    item.status === ChecklistItemStatus.FAIL 
                    ? 'bg-red-600 text-white border-red-600 shadow-sm' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:text-red-600'
                  }`}
                >
                  <XCircle size={18} /> Fail
                </button>
                <button 
                  onClick={() => handleCheckItem(item.id, ChecklistItemStatus.NA)}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                    item.status === ChecklistItemStatus.NA 
                    ? 'bg-slate-600 text-white border-slate-600 shadow-sm' 
                    : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <HelpCircle size={18} /> N/A
                </button>
              </div>
            </div>

            {item.status === ChecklistItemStatus.FAIL && (
              <div className="mt-4 pt-4 border-t border-red-100 flex items-center justify-between">
                <span className="text-sm text-red-600 font-medium">Deviation detected.</span>
                <button 
                  onClick={() => handleLogDefectForItem(item)}
                  className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded hover:bg-red-200 transition-colors font-medium"
                >
                  Log Defect Ticket
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderDetail = () => {
    if (!activeAudit) return null;
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
           <button onClick={() => { setActiveAudit(null); setView('list'); }} className="mb-4 flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors">
              <ArrowLeft size={20} /> Back to List
           </button>
           {/* Header Card */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-start">
                  <div>
                      <h2 className="text-2xl font-bold text-slate-800">{activeAudit.title}</h2>
                      <p className="text-slate-500 mt-1">{activeAudit.context}</p>
                      <p className="text-slate-400 text-sm mt-2">Created: {new Date(activeAudit.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                          activeAudit.status === AuditStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                          activeAudit.status === AuditStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                      }`}>
                          {activeAudit.status}
                      </span>
                      {activeAudit.score !== undefined && (
                           <div className="mt-2 text-3xl font-black text-slate-800">{activeAudit.score}%</div>
                      )}
                  </div>
              </div>
           </div>

           {/* Items List */}
           <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">Checklist Results</div>
              <div className="divide-y divide-slate-100">
                  {activeAudit.items.map((item) => (
                      <div key={item.id} className="p-4 flex items-start gap-4 hover:bg-slate-50">
                          <div className="mt-1">
                              {item.status === ChecklistItemStatus.PASS && <CheckCircle className="text-green-500" size={24} />}
                              {item.status === ChecklistItemStatus.FAIL && <XCircle className="text-red-500" size={24} />}
                              {(item.status === ChecklistItemStatus.NA || item.status === ChecklistItemStatus.PENDING) && <HelpCircle className="text-slate-300" size={24} />}
                          </div>
                          <div className="flex-1">
                              <h4 className="font-medium text-slate-800">{item.question}</h4>
                              <p className="text-sm text-slate-500 mt-0.5">{item.description}</p>
                              <div className="mt-2 flex gap-2">
                                  <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">{item.category}</span>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                                      item.status === ChecklistItemStatus.PASS ? 'bg-green-50 text-green-700 border-green-200' :
                                      item.status === ChecklistItemStatus.FAIL ? 'bg-red-50 text-red-700 border-red-200' :
                                      'bg-slate-50 text-slate-500 border-slate-200'
                                  }`}>
                                      {item.status}
                                  </span>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
           </div>
      </div>
    );
  };

  return (
    <div className="h-full">
      {view === 'list' && renderList()}
      {view === 'create' && renderCreatePreview()}
      {view === 'run' && renderRun()}
      {view === 'detail' && renderDetail()}
    </div>
  );
};

export default AuditTool;

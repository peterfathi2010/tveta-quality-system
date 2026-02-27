
import React, { useState, useMemo } from 'react';
import { Auditor } from '../types';
import { Plus, Trash2, Edit, Star, X, Share2, Search } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../hooks/useData';
import { EGYPT_GOVERNORATES } from '../constants';
import { useDebounce } from '../hooks/useDebounce';

// AuditorRow Component (kept simple)
const AuditorRow: React.FC<{auditor: Auditor, canManage: boolean, onEdit: (auditor: Auditor) => void, onDelete: (id: string) => void, onShare: (auditor: Auditor) => void}> = React.memo(({ auditor, canManage, onEdit, onDelete, onShare }) => {
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="p-4 font-bold text-slate-800">{auditor.name}</td>
      <td className="p-4 text-slate-600"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{auditor.governorate}</span></td>
      <td className="p-4 text-slate-600">{auditor.specialization}</td>
      <td className="p-4 font-mono text-slate-500 text-sm" dir="ltr">{auditor.phone}</td>
      <td className="p-4 text-yellow-500 font-bold flex gap-1">{auditor.rating} <Star size={14} className="fill-current" /></td>
      <td className="p-4 text-center">
          <div className="flex justify-center gap-2">
            <button onClick={() => onShare(auditor)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Share2 size={18} /></button>
            {canManage && (<><button onClick={() => onEdit(auditor)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={18} /></button><button onClick={() => onDelete(auditor.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button></>)}
          </div>
      </td>
    </tr>
  );
});

const ITEMS_PER_PAGE = 15;

const Auditors: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const canCreate = hasPermission('create', 'auditors');
  const { auditors, actions } = useData();
  
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [showForm, setShowForm] = useState(false);
  const [newAuditor, setNewAuditor] = useState<Partial<Auditor>>({});
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // --- Strict Scope Filtering ---
  const filteredAuditors = useMemo(() => {
    let result = auditors;
    if (user?.role === 'admin') {
        // Admin sees all
    } else if (user?.role === 'sector_manager' && user?.governorates) {
        result = auditors.filter(a => user?.governorates?.includes(a.governorate));
    } else if (user?.role === 'auditor') {
        // Auditors can see colleagues in same governorate
        const userGov = user?.governorate || (user?.governorates && user?.governorates[0]);
        if (userGov) result = auditors.filter(a => a.governorate === userGov);
    }
    
    return result.filter(a => a.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
  }, [auditors, user, debouncedSearchTerm]);

  const displayList = useMemo(() => filteredAuditors.slice(0, visibleCount), [filteredAuditors, visibleCount]);
  const handleSave = async () => { /* ... existing save logic ... */ 
      if (newAuditor.name && newAuditor.governorate) {
          const a: Auditor = { id: newAuditor.id || Date.now().toString(), name: newAuditor.name!, governorate: newAuditor.governorate!, specialization: newAuditor.specialization || 'عام', status: 'Active', phone: newAuditor.phone || '', rating: 5 };
          await actions.saveAuditor(a); setShowForm(false); setNewAuditor({});
      }
  };
  const handleDelete = async (id: string) => { if(confirm('حذف؟')) await actions.deleteAuditor(id); };

  // Allowed Governorates for Form
  const allowedGovs = useMemo(() => {
     if(user?.role === 'admin') return EGYPT_GOVERNORATES;
     if(user?.role === 'sector_manager') return user.governorates || [];
     return [];
  }, [user]);

  return (
    <div className="space-y-8 pb-10 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h2 className="text-2xl font-bold text-slate-800">قاعدة بيانات المراجعين</h2><p className="text-slate-500">نطاق {user?.role === 'admin' ? 'الكل' : user?.governorates?.join('، ')}</p></div>
        <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="ابحث عن مراجع..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-800 placeholder-slate-400 pr-10 pl-4 py-2.5 rounded-xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                />
            </div>
            {canCreate && <button onClick={() => { setNewAuditor({}); setShowForm(true); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-medium shrink-0"><Plus size={18} /> إضافة مراجع</button>}
        </div>
      </div>

      {showForm && canCreate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm fade-in no-print overflow-y-auto">
            <div className="bg-white w-full max-w-4xl p-8 rounded-[32px] shadow-2xl border border-blue-100 relative animate-in fade-in zoom-in-95 duration-200 my-auto">
                <button 
                    onClick={() => setShowForm(false)} 
                    className="absolute top-6 left-6 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 p-2 rounded-full hover:bg-slate-100"
                >
                    <X size={24} />
                </button>
                <div className="absolute top-0 right-0 w-full h-2 bg-blue-600 rounded-t-[32px]"></div>

                <h3 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-2 border-b border-slate-100 pb-4">
                    {newAuditor.id ? <Edit size={24} className="text-blue-500" /> : <Plus size={24} className="text-blue-500" />}
                    {newAuditor.id ? 'تعديل بيانات مراجع' : 'إضافة مراجع جديد'}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-600">الاسم</label>
                        <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" placeholder="الاسم كامل" value={newAuditor.name || ''} onChange={e => setNewAuditor({...newAuditor, name: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-600">المحافظة</label>
                        <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 appearance-none" value={newAuditor.governorate || ''} onChange={e => setNewAuditor({...newAuditor, governorate: e.target.value})}>
                            <option value="">اختر المحافظة</option>
                            {allowedGovs.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-600">التخصص</label>
                        <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" placeholder="التخصص" value={newAuditor.specialization || ''} onChange={e => setNewAuditor({...newAuditor, specialization: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-600">رقم الهاتف</label>
                        <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" placeholder="رقم الهاتف" value={newAuditor.phone || ''} onChange={e => setNewAuditor({...newAuditor, phone: e.target.value})} />
                    </div>
                </div>
                
                <div className="flex gap-3 mt-8 pt-6 border-t border-slate-100 justify-end">
                    <button onClick={() => setShowForm(false)} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl font-bold transition-colors">إلغاء</button>
                    <button onClick={handleSave} className="px-8 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-2xl font-bold shadow-lg shadow-blue-600/20 transition-colors">حفظ البيانات</button>
                </div>
            </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-soft border border-slate-200 overflow-hidden">
        <table className="w-full text-right">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-sm"><tr><th className="p-4">الاسم</th><th className="p-4">المحافظة</th><th className="p-4">التخصص</th><th className="p-4">الهاتف</th><th className="p-4">التقييم</th><th className="p-4 text-center">إجراءات</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {displayList.map((a) => <AuditorRow key={a.id} auditor={a} canManage={canCreate} onEdit={() => {setNewAuditor(a); setShowForm(true);}} onDelete={handleDelete} onShare={()=>{}} />)}
            </tbody>
        </table>
      </div>
      {filteredAuditors.length > visibleCount && <button onClick={() => setVisibleCount(p => p + ITEMS_PER_PAGE)} className="w-full py-3 bg-white border border-slate-200 text-blue-600 font-bold rounded-2xl">عرض المزيد</button>}
    </div>
  );
};

export default Auditors;


import React, { useState, useEffect, useMemo } from 'react';
import { Phone, MapPin, Plus, Edit, Trash2, UploadCloud, Loader2, FileSpreadsheet, Lock, Mail, ShieldAlert, Zap, LayoutGrid, List as ListIcon, Printer, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../hooks/useData';
import { SupportMember, QualityOfficer, Sector, User, Role } from '../types';
import { EGYPT_GOVERNORATES } from '../constants';
import { useDebounce } from '../hooks/useDebounce';
import { parseCSV, batchImportToFirestore, generateCSVContent } from '../services/backupService';
import { db } from '../services/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { uploadStringToDrive, getSystemFolderId } from '../services/googleDriveService';

const Team: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'support' | 'officers' | 'admins'>('support');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list'); // Default to list for clearer data view
  
  useEffect(() => {
    if (location.pathname === '/quality-officers') setActiveTab('officers');
    else setActiveTab('support');
  }, [location.pathname]);

  const canCreate = hasPermission('create', 'team');
  const isAdmin = user?.role === 'admin';
  const { supportMembers, officers, actions } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  
  // Enhanced Form Data for Login Creation
  const [formData, setFormData] = useState({
      name: '', phone: '', sector: '', governorates: '', governorate: '', 
      email: '', password: '', role: 'sector_manager', createLogin: false 
  });
  
  const [isBatchCreating, setIsBatchCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // --- Scoped Data ---
  const filteredSupport = useMemo(() => {
      let data = supportMembers;
      if (user?.role === 'sector_manager') {
          data = supportMembers.filter(m => m.sector === user?.sector);
      }
      return data.filter(m => m.name.includes(debouncedSearchTerm) || m.sector.includes(debouncedSearchTerm));
  }, [supportMembers, debouncedSearchTerm, user]);

  const filteredOfficers = useMemo(() => {
      let data = officers;
      if (user?.role === 'sector_manager' && user?.governorates) {
          data = officers.filter(o => user?.governorates?.includes(o.governorate));
      } else if (user?.role === 'auditor') {
          const gov = user?.governorate || (user?.governorates && user?.governorates[0]);
          if(gov) data = officers.filter(o => o.governorate === gov);
      }
      return data.filter(o => o.name.includes(debouncedSearchTerm) || o.governorate.includes(debouncedSearchTerm));
  }, [officers, debouncedSearchTerm, user]);

  const handleDelete = async (id: number | string) => { 
    if(confirm("حذف؟ سيتم حذف البيانات من السجلات.")) { 
        if (activeTab === 'support') await actions.deleteSupportMember(id as number); 
        else if (activeTab === 'officers') await actions.deleteOfficer(id as number); 
        // Note: Deleting from Auth usually requires Admin SDK or Cloud Functions, but we can delete from 'users' collection
        if (isAdmin && db) {
             // Try to delete associated user doc if it exists (id might match)
             try { 
                await deleteDoc(doc(db, 'users', id.toString())); 
             } catch(err) {
                console.error(err);
             }
        }
    } 
  };

  const handleEdit = (item: SupportMember | QualityOfficer) => { 
      setEditingId(item.id); 
      setFormData({ 
          ...item, 
          governorates: (item as SupportMember).governorates?.join(',') || '',
          sector: (item as SupportMember).sector || '',
          governorate: (item as QualityOfficer).governorate || '',
          email: (item as SupportMember & {email?: string}).email || '', // Might not be available in item if not merged
          password: '', 
          role: activeTab === 'support' ? 'sector_manager' : 'auditor',
          createLogin: false
      }); 
      setShowForm(true); 
  };

  const handleSubmit = async (e: React.FormEvent) => { 
      e.preventDefault(); 
      const uniqueId = editingId ? Number(editingId) : Date.now();
      
      // 1. Create Login Account if requested (Admin Only)
      if (isAdmin && formData.createLogin && formData.email && formData.password && db) {
           const userDocId = `user_${uniqueId}`; // Consistent ID strategy
           const newUser: User = {
               id: userDocId,
               name: formData.name,
               email: formData.email,
               password: formData.password, // Storing simply for this demo context (In real app, handle Auth properly)
               role: formData.role as Role,
               phone: formData.phone,
               sector: formData.sector as Sector,
               governorates: formData.governorates ? formData.governorates.split(',') : (formData.governorate ? [formData.governorate] : []),
               governorate: formData.governorate
           };
           // Write to Users Collection for AuthContext to pick up
           await setDoc(doc(db, 'users', userDocId), newUser);
      }

      // 2. Save to Specific Collection (Support / Officers)
      if (activeTab === 'support') {
          const member: SupportMember = {
              id: uniqueId,
              name: formData.name,
              phone: formData.phone,
              sector: formData.sector as Sector,
              governorates: formData.governorates.split(',').map(s => s.trim()).filter(Boolean)
          };
          await actions.saveSupportMember(member);
      } else if (activeTab === 'officers') {
          const officer: QualityOfficer = {
              id: uniqueId,
              name: formData.name,
              phone: formData.phone,
              governorate: formData.governorate
          };
          await actions.saveOfficer(officer);
      }
      
      setShowForm(false); 
  };

  // --- BATCH CREATE ACCOUNTS (Admin Only) ---
  const handleBatchCreateAccounts = async () => {
      if (!confirm(`هل أنت متأكد من إنشاء حسابات دخول تلقائية لـ ${filteredSupport.length} عضو؟\nسيتم تعيين البريد: رقم_الهاتف@tveta.edu\nوكلمة المرور: رقم الهاتف`)) return;

      setIsBatchCreating(true);
      try {
          for (const member of filteredSupport) {
              const userDocId = `user_${member.id}`; // Consistent ID
              const cleanPhone = member.phone.replace(/\D/g, ''); // Digits only
              if (!cleanPhone) continue;

              const generatedEmail = `${cleanPhone}@tveta.edu`;
              
              const newUser: User = {
                  id: userDocId,
                  name: member.name,
                  email: generatedEmail,
                  password: cleanPhone, // Default password
                  role: (member.sector === Sector.IT || member.name.includes("بيتر")) ? 'admin' : 'sector_manager',
                  phone: cleanPhone,
                  sector: member.sector,
                  governorates: member.governorates || []
              };

              // 1. Create in Users collection (for Login)
              if (db) {
                  await setDoc(doc(db, 'users', userDocId), newUser);
              }
              
              // 2. Ensure Member exists in Support collection (persistence)
              await actions.saveSupportMember(member);
          }
          alert(`تم إنشاء/تحديث الحسابات بنجاح.`);
      } catch (e) {
          console.error(e);
          alert("حدث خطأ أثناء الإنشاء الجماعي.");
      } finally {
          setIsBatchCreating(false);
      }
  };

  // --- IMPORT / EXPORT ---
  const handleDownloadTemplate = () => {
      const template = activeTab === 'support' 
          ? [{ name: 'الاسم', phone: 'رقم الهاتف', sector: 'القطاع', governorates: 'المحافظات (مفصولة بفاصلة)' }]
          : [{ name: 'الاسم', phone: 'رقم الهاتف', governorate: 'المحافظة' }];
      
      const csv = generateCSVContent(template);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Team_Template_${activeTab}.csv`;
      link.click();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsImporting(true);
      try {
          const data = await parseCSV(file);
          if (data.length === 0) throw new Error("الملف فارغ");

          const collectionName = activeTab === 'support' ? 'support' : 'officers';
          
          // Map fields if necessary (Arabic headers to English keys)
          const mappedData = data.map(item => {
              if (activeTab === 'support') {
                  return {
                      id: Date.now() + Math.random(),
                      name: item['الاسم'] || item.name,
                      phone: item['رقم الهاتف'] || item.phone,
                      sector: item['القطاع'] || item.sector,
                      governorates: (item['المحافظات (مفصولة بفاصلة)'] || item.governorates || '').split(',').map((s: string) => s.trim())
                  };
              } else {
                  return {
                      id: Date.now() + Math.random(),
                      name: item['الاسم'] || item.name,
                      phone: item['رقم الهاتف'] || item.phone,
                      governorate: item['المحافظة'] || item.governorate
                  };
              }
          });

          await batchImportToFirestore(collectionName, mappedData);
          alert(`تم استيراد ${mappedData.length} سجل بنجاح.`);
      } catch (err) {
          alert(`فشل الاستيراد: ${(err as Error).message}`);
      } finally {
          setIsImporting(false);
          e.target.value = '';
      }
  };

  const handleExportToDrive = async () => {
      setIsSyncing(true);
      try {
          const folderId = await getSystemFolderId();
          const data = activeTab === 'support' ? filteredSupport : filteredOfficers;
          const fileName = activeTab === 'support' ? 'Support_Team' : 'Quality_Officers';
          const csvContent = generateCSVContent(data as unknown as Record<string, unknown>[]);
          if(csvContent) {
              await uploadStringToDrive(csvContent, `${fileName}_${new Date().toISOString()}.csv`, 'text/csv', folderId);
              alert("تم تصدير القائمة إلى Google Drive بنجاح في مجلد TVETA_QUALITY_MANAGEMENT.");
          }
      } catch (e) {
          alert(`فشل التصدير: ${(e as Error).message}`);
      } finally {
          setIsSyncing(false);
      }
  };

  const allowedGovsForForm = useMemo(() => {
      if(isAdmin) return EGYPT_GOVERNORATES;
      if(user?.role === 'sector_manager') return user.governorates || [];
      return [];
  }, [user, isAdmin]);

  return (
    <div className="space-y-6 pb-20 relative">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 no-print">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            {activeTab === 'support' ? 'فريق الدعم والمديرين' : activeTab === 'officers' ? 'مسؤولي الجودة' : 'مديرو النظام'}
          </h2>
          <p className="text-slate-500 font-medium">إدارة الهيكل التنظيمي والصلاحيات</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={20}/></button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}><ListIcon size={20}/></button>
            <button onClick={() => window.print()} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"><Printer size={20}/></button>
            {isAdmin && (
                <button 
                   onClick={handleExportToDrive} 
                   disabled={isSyncing}
                   className={`p-2 rounded-lg transition-all ${isSyncing ? 'text-blue-400 animate-pulse' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                   title="تصدير القائمة الحالية إلى Google Drive"
                >
                   {isSyncing ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20}/>}
                </button>
            )}
        </div>
      </div>

      <div className="flex p-1.5 bg-slate-200/50 backdrop-blur rounded-[20px] no-print max-w-lg">
          <button onClick={() => setActiveTab('support')} className={`flex-1 py-2.5 text-sm font-black rounded-2xl transition-all ${activeTab === 'support' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>الدعم / مديري القطاعات</button>
          <button onClick={() => setActiveTab('officers')} className={`flex-1 py-2.5 text-sm font-black rounded-2xl transition-all ${activeTab === 'officers' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>مسؤولي الجودة</button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center no-print">
         <div className="relative w-full md:w-1/3"><input type="text" placeholder="بحث..." className="w-full pr-12 pl-4 py-3.5 bg-white border border-slate-200 rounded-2xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /><MapPin size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" /></div>
         <div className="flex gap-2 w-full md:w-auto">
             {canCreate && (
                 <>
                    <div className="relative group">
                        <button className="bg-white border border-slate-200 text-slate-600 px-4 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors">
                            <UploadCloud size={18} /> <span>استيراد / تحميل</span>
                        </button>
                        <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-100 shadow-xl rounded-2xl py-2 hidden group-hover:block z-50">
                            <button onClick={handleDownloadTemplate} className="w-full text-right px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"><FileSpreadsheet size={14}/> تحميل النموذج</button>
                            <label className="w-full text-right px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2 cursor-pointer">
                                <UploadCloud size={14}/> رفع ملف CSV
                                <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
                            </label>
                        </div>
                    </div>
                    
                    <button onClick={() => { setShowForm(true); setEditingId(null); setFormData({name: '', phone: '', sector: '', governorates: '', governorate: '', email: '', password: '', role: 'sector_manager', createLogin: false}); }} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 flex-1 md:flex-none hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                        <Plus size={18} /> <span>إضافة عضو جديد</span>
                    </button>
                    {isAdmin && activeTab === 'support' && (
                        <button 
                            onClick={handleBatchCreateAccounts} 
                            disabled={isBatchCreating}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 flex-1 md:flex-none hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
                            title="إنشاء حسابات دخول تلقائية لجميع الأعضاء المعروضين"
                        >
                            {isBatchCreating ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />} 
                            <span>إنشاء حسابات تلقائية</span>
                        </button>
                    )}
                 </>
             )}
         </div>
      </div>

      {/* --- FORM MODAL --- */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm fade-in no-print overflow-y-auto">
            <div className="bg-white w-full max-w-4xl p-8 rounded-[32px] shadow-2xl border border-blue-100 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
                <button 
                    onClick={() => setShowForm(false)} 
                    className="absolute top-6 left-6 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 p-2 rounded-full hover:bg-slate-100"
                >
                    <X size={24} />
                </button>
                <div className="absolute top-0 right-0 w-full h-2 bg-blue-600"></div>
                
                <h3 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-2 border-b border-slate-100 pb-4">
                    {editingId ? <Edit size={24} className="text-blue-500" /> : <Plus size={24} className="text-blue-500" />}
                    {editingId ? 'تعديل بيانات العضو' : 'إضافة عضو جديد'}
                </h3>
                
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-600">الاسم رباعي</label>
                        <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" placeholder="الاسم كامل" />
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-600">رقم الهاتف</label>
                        <input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" placeholder="رقم الهاتف" />
                    </div>
                    
                    {activeTab === 'support' && (
                        <>
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-600">القطاع</label>
                                <input required value={formData.sector} onChange={e => setFormData({...formData, sector: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" placeholder="القطاع (مثال: غرب الدلتا)" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-600">المحافظات</label>
                                <input required value={formData.governorates} onChange={e => setFormData({...formData, governorates: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" placeholder="المحافظات (مفصولة بفاصلة)" />
                            </div>
                        </>
                    )}

                    {activeTab === 'officers' && (
                        <div className="space-y-1">
                            <label className="text-sm font-bold text-slate-600">المحافظة</label>
                            <select required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 appearance-none" value={formData.governorate} onChange={e => setFormData({...formData, governorate: e.target.value})}>
                                <option value="">اختر المحافظة</option>
                                {allowedGovsForForm.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                    )}

                    {/* ADMIN ONLY: Create Login Account Section */}
                    {isAdmin && (
                        <div className="md:col-span-2 bg-slate-50 p-6 rounded-2xl border border-slate-200 mt-2">
                            <label className="flex items-center gap-3 mb-4 cursor-pointer">
                                <input type="checkbox" className="w-5 h-5 rounded text-blue-600" checked={formData.createLogin} onChange={e => setFormData({...formData, createLogin: e.target.checked})} />
                                <span className="font-bold text-slate-700 flex items-center gap-2"><Lock size={16} /> إنشاء حساب دخول للنظام</span>
                            </label>
                            
                            {formData.createLogin && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                                    <div className="relative">
                                        <Mail className="absolute right-3 top-3.5 text-slate-400" size={18} />
                                        <input required type="email" placeholder="البريد الإلكتروني" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-3 pr-10 bg-white border border-slate-300 rounded-xl" />
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute right-3 top-3.5 text-slate-400" size={18} />
                                        <input required type="password" placeholder="كلمة المرور" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-3 pr-10 bg-white border border-slate-300 rounded-xl" />
                                    </div>
                                    <div>
                                        <select required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full p-3 bg-white border border-slate-300 rounded-xl">
                                            <option value="sector_manager">مدير قطاع / دعم فني</option>
                                            <option value="auditor">مراجع / مسؤول جودة</option>
                                            <option value="admin">مدير نظام (Admin)</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-3">
                                        <p className="text-xs text-amber-600 flex items-center gap-1"><ShieldAlert size={12} /> سيتمكن هذا العضو من تسجيل الدخول باستخدام هذه البيانات.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="md:col-span-2 flex justify-end gap-3 pt-6 border-t border-slate-100">
                        <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl font-bold transition-colors">إلغاء</button>
                        <button type="submit" className="px-8 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-2xl font-bold shadow-lg shadow-blue-600/20 transition-colors">حفظ البيانات</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* --- GRID VIEW (CARDS) --- */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeTab === 'support' && filteredSupport.map((member) => (
                <div key={member.id} className="bg-white rounded-[32px] shadow-soft border border-slate-100 p-6 group hover:border-blue-200 transition-all hover:shadow-lg">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-black text-lg text-slate-800">{member.name}</h3>
                        {canCreate && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(member)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={16} /></button>
                                <button onClick={() => handleDelete(member.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                            </div>
                        )}
                    </div>
                    <p className="text-sm text-blue-600 font-bold mb-4 bg-blue-50 px-3 py-1 rounded-full w-fit">{member.sector}</p>
                    <div className="space-y-2">
                        <div className="text-slate-500 text-sm flex items-center gap-2"><Phone size={16} className="text-slate-400" /> {member.phone}</div>
                        <div className="text-slate-500 text-sm flex items-start gap-2">
                            <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" /> 
                            <span className="leading-snug">{member.governorates.join('، ')}</span>
                        </div>
                    </div>
                </div>
            ))}
            {activeTab === 'officers' && filteredOfficers.map((officer) => (
                <div key={officer.id} className="bg-white rounded-[32px] shadow-soft border border-slate-100 p-6 flex flex-col justify-between group hover:border-blue-200 transition-all hover:shadow-lg">
                    <div>
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="font-black text-slate-800 text-lg">{officer.name}</h3>
                        <span className="bg-blue-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full">{officer.governorate}</span>
                    </div>
                    <div className="text-slate-600 text-sm flex items-center gap-2 mb-4"><Phone size={16} className="text-slate-400" /> {officer.phone}</div>
                    </div>
                    {canCreate && (
                        <div className="flex justify-end gap-2 pt-4 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(officer)} className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"><Edit size={14} /> تعديل</button>
                            <button onClick={() => handleDelete(officer.id)} className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100"><Trash2 size={14} /> حذف</button>
                        </div>
                    )}
                </div>
            ))}
        </div>
      )}

      {/* --- LIST VIEW (TABLE) - Optimized for Print --- */}
      {viewMode === 'list' && (
          <div className="bg-white rounded-3xl shadow-soft border border-slate-200 overflow-hidden print:shadow-none print:border-black print:rounded-none">
              <div className="hidden print:block p-4 text-center border-b-2 border-black mb-4">
                  <h1 className="text-2xl font-black">أعضاء فريق الدعم الفني وضمان الجودة</h1>
                  <p>الإدارة المركزية لضمان الجودة</p>
              </div>
              
              <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                      <thead className="bg-slate-100 print:bg-gray-200 text-slate-700 font-bold border-b border-slate-300 print:border-black">
                          <tr>
                              <th className="p-4 border-l border-slate-200 print:border-black w-12 text-center">م</th>
                              <th className="p-4 border-l border-slate-200 print:border-black">الاسم</th>
                              <th className="p-4 border-l border-slate-200 print:border-black w-32">تليفون التواصل</th>
                              {activeTab === 'support' && <th className="p-4 border-l border-slate-200 print:border-black">القطاع</th>}
                              <th className="p-4 border-l border-slate-200 print:border-black">{activeTab === 'support' ? 'المحافظات المنوط التواصل معها' : 'المحافظة'}</th>
                              {canCreate && <th className="p-4 w-24 text-center no-print">إجراءات</th>}
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 print:divide-black">
                          {(activeTab === 'support' ? filteredSupport : filteredOfficers).map((item, idx) => (
                              <tr key={item.id} className="hover:bg-slate-50 print:hover:bg-transparent">
                                  <td className="p-4 border-l border-slate-200 print:border-black text-center font-bold">{idx + 1}</td>
                                  <td className="p-4 border-l border-slate-200 print:border-black font-bold text-slate-900">{item.name}</td>
                                  <td className="p-4 border-l border-slate-200 print:border-black font-mono text-sm" dir="ltr">{item.phone}</td>
                                  {activeTab === 'support' && (
                                      <td className="p-4 border-l border-slate-200 print:border-black font-bold text-blue-700 print:text-black">{(item as SupportMember).sector}</td>
                                  )}
                                  <td className="p-4 border-l border-slate-200 print:border-black">
                                      {activeTab === 'support' ? (item as SupportMember).governorates.join(' - ') : (item as QualityOfficer).governorate}
                                  </td>
                                  {canCreate && (
                                      <td className="p-4 text-center no-print">
                                          <div className="flex justify-center gap-2">
                                              <button onClick={() => handleEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16} /></button>
                                              <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                          </div>
                                      </td>
                                  )}
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}
    </div>
  );
};

export default Team;

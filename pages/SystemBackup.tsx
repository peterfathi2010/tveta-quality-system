
import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { exportToCSV, backupSystemData, restoreSystemData, generateBackupJSON, generateCSVContent } from '../services/backupService';
import { uploadStringToDrive, getSystemFolderId } from '../services/googleDriveService';
import { Database, FileSpreadsheet, FileJson, UploadCloud, AlertTriangle, CheckCircle2, Shield, Download, RefreshCw, Loader2 } from 'lucide-react';

const SystemBackup: React.FC = () => {
  const { visits, auditors, supportMembers, reports, officers } = useData();
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState('');

  // Calculate stats
  const totalRecords = visits.length + auditors.length + supportMembers.length + reports.length + officers.length;
  const backupSize = JSON.stringify({ visits, auditors, supportMembers, reports, officers }).length / 1024; // KB

  const handleFullBackup = () => {
    const allData = { visits, auditors, supportMembers, reports, officers };
    backupSystemData(allData);
  };

  const handleSyncToDrive = async () => {
    if (!confirm("سيتم رفع نسخة كاملة من البيانات إلى Google Drive. هل تريد الاستمرار؟")) return;
    
    setIsSyncing(true);
    try {
        const folderId = await getSystemFolderId();
        const allData = { visits, auditors, supportMembers, reports, officers };
        
        // 1. Full JSON
        const jsonContent = generateBackupJSON(allData);
        await uploadStringToDrive(jsonContent, `TVETA_Backup_${new Date().toISOString()}.json`, 'application/json', folderId);
        
        // 2. Visits CSV
        const visitsCSV = generateCSVContent(visits as unknown as Record<string, unknown>[]);
        if(visitsCSV) await uploadStringToDrive(visitsCSV, `Visits_${new Date().toISOString()}.csv`, 'text/csv', folderId);
        
        // 3. Auditors CSV
        const auditorsCSV = generateCSVContent(auditors as unknown as Record<string, unknown>[]);
        if(auditorsCSV) await uploadStringToDrive(auditorsCSV, `Auditors_${new Date().toISOString()}.csv`, 'text/csv', folderId);

        alert("تمت عملية المزامنة بنجاح! يمكنك العثور على الملفات في مجلد TVETA_QUALITY_MANAGEMENT على Drive.");
    } catch (err) {
        console.error(err);
        alert(`فشلت المزامنة: ${(err as Error).message || "خطأ غير معروف"}`);
    } finally {
        setIsSyncing(false);
    }
  };

  const handleExportVisits = () => exportToCSV(visits as unknown as Record<string, unknown>[], 'Visits_Report');
  const handleExportAuditors = () => exportToCSV(auditors as unknown as Record<string, unknown>[], 'Auditors_Database');
  const handleExportReports = () => exportToCSV(reports as unknown as Record<string, unknown>[], 'Archive_Log');

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("تحذير: استعادة البيانات قد تؤدي إلى تحديث البيانات الموجودة ببيانات من النسخة الاحتياطية. هل أنت متأكد؟")) {
        e.target.value = '';
        return;
    }

    setIsRestoring(true);
    setRestoreStatus('جاري تحليل الملف...');

    try {
      await restoreSystemData(file, (msg) => setRestoreStatus(msg));
      alert("تمت العملية بنجاح! يرجى تحديث الصفحة لرؤية البيانات المستعادة.");
      setRestoreStatus('تمت الاستعادة بنجاح');
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الاستعادة. تأكد من سلامة ملف النسخة الاحتياطية.");
      setRestoreStatus('فشلت العملية');
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
          <Database size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-800">مركز النسخ الاحتياطي والاستعادة</h2>
          <p className="text-slate-500 font-medium">Data Sovereignty & Disaster Recovery</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Backup Section */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[32px] shadow-soft border border-slate-100 relative overflow-hidden group hover:border-blue-200 transition-all">
             <div className="absolute top-0 right-0 w-full h-1.5 bg-blue-600"></div>
             <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
                <Download size={24} className="text-blue-600" />
                تصدير البيانات (Backup)
             </h3>
             <p className="text-slate-500 text-sm mb-6">
               قم بتحميل نسخة كاملة من قاعدة البيانات على جهازك الخاص. يمكنك استخدام هذه الملفات للعمل دون اتصال أو لاستعادة النظام لاحقاً.
             </p>
             
             <div className="space-y-3">
                <button onClick={handleFullBackup} className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-2xl group/btn transition-all">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg text-slate-600 group-hover/btn:text-blue-600 shadow-sm"><FileJson size={20} /></div>
                      <div className="text-right">
                         <p className="font-bold text-slate-700">نسخة كاملة للنظام (JSON)</p>
                         <p className="text-xs text-slate-400">تستخدم للاستعادة (Restore)</p>
                      </div>
                   </div>
                   <Download size={20} className="text-slate-300 group-hover/btn:text-blue-600" />
                </button>

                <div className="grid grid-cols-2 gap-3">
                   <button onClick={handleExportVisits} className="flex items-center justify-center gap-2 p-3 bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-xl font-bold text-sm transition-all">
                      <FileSpreadsheet size={18} /> تقرير الزيارات (Excel)
                   </button>
                   <button onClick={handleExportAuditors} className="flex items-center justify-center gap-2 p-3 bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-xl font-bold text-sm transition-all">
                      <FileSpreadsheet size={18} /> بيانات المراجعين (Excel)
                   </button>
                </div>
                <button onClick={handleExportReports} className="w-full flex items-center justify-center gap-2 p-3 bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-xl font-bold text-sm transition-all">
                      <FileSpreadsheet size={18} /> سجل الأرشيف والتقارير (Excel)
                </button>

                <div className="pt-4 border-t border-slate-100 mt-2">
                   <button 
                       onClick={handleSyncToDrive} 
                       disabled={isSyncing}
                       className="w-full flex items-center justify-center gap-2 p-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-50"
                   >
                       {isSyncing ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20} />}
                       {isSyncing ? 'جاري المزامنة...' : 'مزامنة فورية مع Google Drive'}
                   </button>
                   <p className="text-[10px] text-slate-400 text-center mt-2">سيتم رفع النسخة الحالية مباشرة إلى مجلد النظام على سحابة جوجل</p>
                </div>
             </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex items-start gap-4">
             <Shield className="text-blue-600 shrink-0 mt-1" size={24} />
             <div>
                <h4 className="font-bold text-blue-800">بياناتك آمنة ومملوكة لك</h4>
                <p className="text-sm text-blue-700/80 mt-1">
                   النظام يضمن لك الحق الكامل في الوصول لبياناتك وتخزينها محلياً. يتم حفظ البيانات السحابية بشكل مشفر، وهذه النسخ المحلية هي مسؤوليتك الشخصية.
                </p>
             </div>
          </div>
        </div>

        {/* Restore Section */}
        <div className="space-y-6">
           <div className="bg-white p-8 rounded-[32px] shadow-soft border border-slate-100 relative overflow-hidden hover:border-amber-200 transition-all">
             <div className="absolute top-0 right-0 w-full h-1.5 bg-amber-500"></div>
             <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
                <UploadCloud size={24} className="text-amber-600" />
                استعادة النظام (Restore)
             </h3>
             <p className="text-slate-500 text-sm mb-6">
               في حالة فقدان البيانات أو الانتقال لجهاز جديد، يمكنك رفع ملف (JSON) الذي قمت بتصديره سابقاً لاستعادة كافة السجلات.
             </p>

             <div className="border-3 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-amber-50 hover:border-amber-300 transition-all relative">
                {isRestoring ? (
                    <div className="text-center space-y-4">
                       <RefreshCw size={48} className="animate-spin text-amber-500 mx-auto" />
                       <p className="font-bold text-slate-700">{restoreStatus}</p>
                    </div>
                ) : (
                    <>
                        <input type="file" accept=".json" onChange={handleRestore} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" />
                        <Database size={48} className="text-slate-300 mb-4" />
                        <p className="font-bold text-slate-600">اضغط لرفع ملف النسخة الاحتياطية</p>
                        <p className="text-xs text-slate-400 mt-2">يقبل ملفات .json فقط</p>
                    </>
                )}
             </div>
             
             {restoreStatus && !isRestoring && (
                <div className="mt-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-2 font-bold text-sm">
                   <CheckCircle2 size={16} /> {restoreStatus}
                </div>
             )}

             <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                <p className="text-xs text-amber-800 font-medium">
                   تنبيه: عملية الاستعادة ستقوم بدمج البيانات وتحديث السجلات الموجودة. يفضل إجراء نسخة احتياطية للحالة الحالية قبل البدء.
                </p>
             </div>
           </div>

           {/* Stats Widget */}
           <div className="bg-slate-900 text-slate-300 p-6 rounded-3xl flex items-center justify-between">
              <div>
                 <p className="text-xs font-bold uppercase tracking-widest text-slate-500">حالة النظام</p>
                 <p className="text-2xl font-black text-white mt-1">{totalRecords} <span className="text-sm font-medium text-slate-500">سجل</span></p>
              </div>
              <div className="text-left">
                 <p className="text-xs font-bold uppercase tracking-widest text-slate-500">حجم البيانات</p>
                 <p className="text-2xl font-black text-white mt-1">~{backupSize.toFixed(2)} <span className="text-sm font-medium text-slate-500">KB</span></p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SystemBackup;

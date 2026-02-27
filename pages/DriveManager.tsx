
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { GoogleDriveFile } from '../types';
import { initGoogleDrive, listDriveFiles, uploadFileToDrive, deleteFileFromDrive, createDriveFolder, getSystemFolderId } from '../services/googleDriveService';
import { HardDrive, UploadCloud, FolderPlus, Trash2, File, Folder, ExternalLink, Loader2, RefreshCw, AlertCircle, Lock, ShieldCheck, FileText, Settings, Copy, Info, ChevronRight, Search, CheckCircle2, Image } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DriveManager: React.FC = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [configError, setConfigError] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderStack, setFolderStack] = useState<{id: string, name: string}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  // Auto-connect check
  useEffect(() => {
      const checkAutoConnect = async () => {
        if (user?.role !== 'admin') return;
        setIsLoading(true);
        setConfigError(false);
        try {
            await initGoogleDrive();
        } catch (error) {
            console.warn("Drive Init Status:", error);
            if (error?.toString().includes("Client ID") || (error as Error)?.message?.includes("Client ID")) {
                setConfigError(true);
            }
        } finally {
            setIsLoading(false);
        }
      };
      checkAutoConnect();
  }, [user]);

  const handleManualConnect = async () => {
      setIsLoading(true);
      setConfigError(false);
      try {
          await initGoogleDrive();
          const token = await import('../services/googleDriveService').then(m => m.authenticateGoogle());
          if ((token as { access_token?: string }).access_token) {
              setIsConnected(true);
              const rootId = await getSystemFolderId();
              setCurrentFolderId(rootId);
              setFolderStack([{id: rootId, name: 'الملفات الرئيسية'}]);
              await loadFiles(rootId);
              showNotification("تم الاتصال بـ Google Drive بنجاح", 'success');
          }
      } catch (error) {
          console.error("Connection Failed:", error);
          if (error?.toString().includes("Client ID") || (error as Error)?.message?.includes("Client ID")) {
              setConfigError(true);
              showNotification("خطأ: مفتاح Client ID مفقود", 'error');
          } else if ((error as { error?: string })?.error === 'popup_closed_by_user') {
              showNotification("تم إلغاء الاتصال من قبل المستخدم", 'error');
          } else {
              showNotification("فشل الاتصال: " + ((error as Error).message || "راجع إعدادات Google Cloud"), 'error');
          }
      } finally {
          setIsLoading(false);
      }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 4000);
  };

  const loadFiles = async (folderId?: string) => {
      try {
          setIsLoading(true);
          const targetId = folderId || currentFolderId;
          if (!targetId) return;
          const driveFiles = await listDriveFiles(targetId);
          setFiles(driveFiles || []);
      } catch (error) {
          console.error("Error loading files", error);
          showNotification("فشل تحميل الملفات", 'error');
      } finally {
          setIsLoading(false);
      }
  };

  const handleNavigate = async (folderId: string, folderName: string) => {
      setCurrentFolderId(folderId);
      setFolderStack(prev => [...prev, {id: folderId, name: folderName}]);
      await loadFiles(folderId);
  };

  const handleGoBack = async (index: number) => {
      const target = folderStack[index];
      setCurrentFolderId(target.id);
      setFolderStack(prev => prev.slice(0, index + 1));
      await loadFiles(target.id);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      try {
          const folderId = currentFolderId || await getSystemFolderId();
          await uploadFileToDrive(file, folderId);
          await loadFiles(folderId);
          showNotification("تم رفع الملف بنجاح", 'success');
      } catch (error) {
          console.error(error);
          showNotification("فشل رفع الملف: " + (error as Error).message, 'error');
      } finally {
          setIsUploading(false);
          e.target.value = '';
      }
  };

  const handleDelete = async (fileId: string) => {
      if(!confirm("هل أنت متأكد من حذف هذا الملف من Google Drive؟ لا يمكن التراجع عن هذا الإجراء.")) return;
      
      try {
          setIsLoading(true);
          await deleteFileFromDrive(fileId);
          setFiles(prev => prev.filter(f => f.id !== fileId));
          showNotification("تم الحذف بنجاح", 'success');
      } catch (error) {
          console.error(error);
          showNotification("فشل الحذف", 'error');
      } finally {
          setIsLoading(false);
      }
  };

  const handleCreateFolder = async () => {
      const name = prompt("ادخل اسم المجلد الجديد:");
      if (!name) return;
      
      setIsLoading(true);
      try {
          const parentId = currentFolderId || await getSystemFolderId();
          await createDriveFolder(name, parentId);
          await loadFiles(parentId); 
          showNotification("تم إنشاء المجلد", 'success');
      } catch (error) {
           console.error(error);
           showNotification("فشل إنشاء المجلد", 'error');
      } finally {
          setIsLoading(false);
      }
  };

  const filteredFiles = useMemo(() => {
      if (!searchTerm) return files;
      const lowerSearch = searchTerm.toLowerCase();
      return files.filter(f => {
          const nameMatch = f.name.toLowerCase().includes(lowerSearch);
          const mimeMatch = f.mimeType.toLowerCase().includes(lowerSearch);
          const dateMatch = f.createdTime ? new Date(f.createdTime).toLocaleDateString('ar-EG').includes(lowerSearch) : false;
          return nameMatch || mimeMatch || dateMatch;
      });
  }, [files, searchTerm]);

  const copyOrigin = () => {
      navigator.clipboard.writeText(currentOrigin);
      showNotification("تم نسخ الرابط", 'success');
  };

  if (!user || user.role !== 'admin') {
      return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 gap-4">
              <Lock size={64} className="opacity-20" />
              <div className="text-center">
                  <h2 className="text-xl font-bold text-slate-600">غير مصرح بالوصول</h2>
                  <p className="text-sm">هذه الصفحة مخصصة لمديري النظام (Admins) فقط.</p>
              </div>
          </div>
      );
  }

  if (configError) {
      return (
          <div className="space-y-6 pb-20 animate-fade-in">
              <div className="bg-rose-50 border border-rose-100 rounded-[32px] p-12 text-center shadow-soft flex flex-col items-center gap-6 max-w-3xl mx-auto mt-10">
                  <div className="w-24 h-24 bg-rose-100 rounded-full flex items-center justify-center mb-2 text-rose-600">
                      <Settings size={48} />
                  </div>
                  <h3 className="text-2xl font-black text-rose-800">مطلوب إعدادات الربط</h3>
                  <p className="text-rose-600/80 max-w-lg mx-auto leading-relaxed">
                      لم يتم العثور على <code>Google Client ID</code> في متغيرات البيئة.
                  </p>
                  
                  <div className="bg-white p-6 rounded-2xl border border-rose-100 w-full text-left space-y-4" dir="ltr">
                      <h4 className="font-bold text-slate-700 flex items-center gap-2">
                          <AlertCircle size={18} className="text-amber-500" />
                          Troubleshooting:
                      </h4>
                      <ul className="list-disc list-inside text-sm text-slate-600 space-y-2">
                          <li>Ensure <code>.env</code> file exists in the project root.</li>
                          <li>Ensure <code>VITE_GOOGLE_CLIENT_ID</code> is set correctly.</li>
                          <li><strong>Important:</strong> Restart the development server after changing <code>.env</code> file.</li>
                      </ul>
                  </div>

                  <button 
                      onClick={() => window.location.reload()}
                      className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-rose-600/20"
                  >
                      تحديث الصفحة
                  </button>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
       <AnimatePresence>
       {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 no-print"
          >
              <div className={`px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-white font-bold ${notification.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}>
                  {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                  <span>{notification.message}</span>
              </div>
          </motion.div>
       )}
       </AnimatePresence>

       <div className="flex justify-between items-center border-b border-slate-200 pb-6">
          <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                  <HardDrive size={32} />
              </div>
              <div>
                  <h2 className="text-3xl font-black text-slate-800">إدارة الملفات (Google Drive)</h2>
                  <p className="text-slate-500 font-medium">الربط السحابي وإدارة الملفات المركزية</p>
              </div>
          </div>
          
          {isConnected && (
              <div className="flex gap-3">
                  <button onClick={() => loadFiles()} disabled={isLoading} className="p-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors" title="تحديث القائمة">
                      <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
                  </button>
              </div>
          )}
       </div>

       {!isConnected ? (
           <div className="flex flex-col gap-8">
               <div className="bg-white rounded-[32px] p-12 text-center shadow-soft border border-slate-100 flex flex-col items-center gap-6">
                   <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-2">
                       <HardDrive size={48} className="text-blue-600" />
                   </div>
                   <h3 className="text-2xl font-black text-slate-800">ربط حساب Google Drive</h3>
                   <p className="text-slate-500 max-w-lg mx-auto leading-relaxed">
                       لإدارة ملفات النظام، سيتم إنشاء مجلد مركزي باسم <br/>
                       <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-blue-600 font-bold">TVETA_QUALITY_MANAGEMENT</span><br/>
                       يرجى تسجيل الدخول بحساب Google الخاص بالمسؤول للمتابعة.<br/>
                   </p>
                   <button 
                      onClick={handleManualConnect} 
                      disabled={isLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-600/30 transition-all flex items-center gap-3 disabled:opacity-70"
                   >
                       {isLoading ? <Loader2 className="animate-spin" /> : <img src="https://www.google.com/favicon.ico" className="w-6 h-6 bg-white rounded-full p-0.5" alt="G" />}
                       <span>بدء الاتصال بـ Google</span>
                   </button>
               </div>

               <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100 flex items-start gap-4">
                  <Info className="text-amber-600 shrink-0 mt-1" />
                  <div className="flex-1 text-right">
                      <h4 className="font-bold text-amber-800 mb-2">واجهت خطأ "redirect_uri_mismatch"؟</h4>
                      <p className="text-sm text-amber-700 mb-3">
                          هذا الخطأ يعني أن عنوان الموقع الحالي غير مضاف في قائمة المصرح لهم في Google Cloud Console.
                      </p>
                      <div className="bg-white p-3 rounded-lg border border-amber-200 flex items-center justify-between gap-3" dir="ltr">
                          <code className="text-xs font-mono text-slate-600">{currentOrigin}</code>
                          <button onClick={copyOrigin} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                              <Copy size={14} /> Copy
                          </button>
                      </div>
                  </div>
               </div>
           </div>
       ) : (
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               {/* Sidebar / Actions */}
               <div className="lg:col-span-1 space-y-4">
                   <div className="bg-white p-6 rounded-3xl shadow-soft border border-slate-100">
                       <h3 className="font-bold text-slate-800 mb-6">إجراءات الملفات</h3>
                       <div className="space-y-3">
                           <label className={`w-full flex items-center gap-3 p-4 bg-blue-600 text-white rounded-xl cursor-pointer hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 ${isUploading ? 'opacity-70 pointer-events-none' : ''}`}>
                               {isUploading ? <Loader2 className="animate-spin" size={24} /> : <UploadCloud size={24} />}
                               <div className="flex-1">
                                   <span className="font-bold block">رفع ملف جديد</span>
                                   <span className="text-xs text-blue-100 opacity-80">PDF, Excel, Images...</span>
                               </div>
                               <input type="file" className="hidden" onChange={handleUpload} disabled={isUploading} />
                           </label>
                           
                           <button onClick={handleCreateFolder} className="w-full flex items-center gap-3 p-4 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-all">
                               <FolderPlus size={24} className="text-amber-500" />
                               <span className="font-bold">إنشاء مجلد فرعي</span>
                           </button>
                       </div>
                   </div>

                   <div className="bg-slate-900 text-slate-300 p-6 rounded-3xl">
                       <div className="flex items-center gap-2 mb-4">
                           <ShieldCheck className="text-emerald-500" />
                           <h4 className="font-bold text-white">متصل وآمن</h4>
                       </div>
                       <p className="text-sm text-slate-400 mb-2">المجلد الحالي:</p>
                       <p className="text-xs font-mono bg-slate-800 p-2 rounded text-emerald-400 truncate select-all">{folderStack[folderStack.length-1]?.name}</p>
                       <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-end">
                           <div>
                               <p className="text-xs text-slate-500">عدد الملفات</p>
                               <p className="text-2xl font-black text-white">{files.length}</p>
                           </div>
                       </div>
                   </div>
               </div>

               {/* Files Grid */}
               <div className="lg:col-span-3 space-y-4">
                    {/* Breadcrumbs & Search */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
                            {folderStack.map((folder, idx) => (
                                <React.Fragment key={folder.id}>
                                    {idx > 0 && <ChevronRight size={16} className="text-slate-300 shrink-0" />}
                                    <button 
                                        onClick={() => handleGoBack(idx)}
                                        className={`text-sm font-bold whitespace-nowrap px-2 py-1 rounded-lg transition-colors ${idx === folderStack.length - 1 ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        {folder.name}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>
                        <div className="relative w-full md:w-64">
                            <input 
                                type="text" 
                                placeholder="بحث في المجلد..." 
                                className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl shadow-soft border border-slate-100 overflow-hidden min-h-[500px] flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-slate-800">مستكشف الملفات</h3>
                            <div className="text-xs text-slate-400">آخر تحديث: {new Date().toLocaleTimeString('ar-EG')}</div>
                        </div>
                        
                        {filteredFiles.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                                <HardDrive size={64} className="mb-4 opacity-20" />
                                <p>{searchTerm ? 'لا توجد نتائج للبحث.' : 'المجلد فارغ.'}</p>
                                <p className="text-xs mt-2">استخدم زر "رفع ملف" لإضافة محتوى.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto custom-scrollbar p-2">
                                {filteredFiles.map((file) => (
                                    <motion.div 
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        key={file.id} 
                                        className="p-4 hover:bg-slate-50 transition-colors flex items-center gap-4 group rounded-2xl"
                                    >
                                        <div 
                                            onClick={() => file.mimeType.includes('folder') && handleNavigate(file.id, file.name)}
                                            className={`w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 ${file.mimeType.includes('folder') ? 'cursor-pointer hover:bg-amber-50 hover:border-amber-200' : ''}`}
                                        >
                                             {file.mimeType.includes('folder') ? (
                                                 <Folder size={24} className="text-amber-500" />
                                             ) : file.mimeType.includes('image') ? (
                                                 <Image size={24} className="text-purple-500" />
                                             ) : file.mimeType.includes('pdf') ? (
                                                 <FileText size={24} className="text-red-500" />
                                             ) : (
                                                 <File size={24} className="text-blue-500" />
                                             )}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <h4 
                                                onClick={() => file.mimeType.includes('folder') && handleNavigate(file.id, file.name)}
                                                className={`font-bold text-slate-800 truncate text-sm ${file.mimeType.includes('folder') ? 'cursor-pointer hover:text-blue-600' : ''}`}
                                            >
                                                {file.name}
                                            </h4>
                                            <div className="flex gap-3 text-[10px] text-slate-500 mt-1">
                                                <span className="bg-slate-100 px-2 rounded">{file.mimeType.includes('folder') ? 'مجلد' : file.mimeType.split('/').pop()}</span>
                                                {file.size && <span>{(parseInt(file.size) / 1024).toFixed(1)} KB</span>}
                                                {file.createdTime && <span>{new Date(file.createdTime).toLocaleDateString('ar-EG')}</span>}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <a 
                                               href={file.webViewLink} 
                                               target="_blank" 
                                               rel="noreferrer" 
                                               className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" 
                                               title="فتح في Drive"
                                            >
                                                <ExternalLink size={18} />
                                            </a>
                                            <button 
                                               onClick={() => handleDelete(file.id)} 
                                               className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" 
                                               title="حذف"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default DriveManager;


import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Visit, VisitAttachment, DynamicFormSubmission } from '../types';
import { Calendar as CalendarIcon, CheckCircle, XCircle, Send, Printer, Loader, LocateFixed, Plus, Edit, Save, Mic, Map, ChevronDown, Image as ImageIcon, StopCircle, FileUp, Layout, HardDriveUpload } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../hooks/useData';
import { EGYPT_GOVERNORATES } from '../constants';
import VisitCard from '../components/VisitCard';
import { uploadFileToDrive, getSystemFolderId } from '../services/googleDriveService';

const STAGES = ['لم تبدأ', 'في الطريق', 'وصول للموقع', 'تفتيش القاعات', 'مراجعة المستندات', 'إعداد التقرير', 'تم الانتهاء'];
const VISITS_PER_PAGE = 10;

const Visits: React.FC = () => {
  const { user, hasPermission } = useAuth();
  
  const canCreate = hasPermission('create', 'visits');
  const canEdit = hasPermission('edit', 'visits');
  const canDelete = hasPermission('delete', 'visits');
  const canUpdateProgress = hasPermission('update_progress', 'visits');

  const { visits, auditors, dynamicForms, actions } = useData();
  
  const getAuditorName = useCallback((id: string) => auditors.find(a => a.id === id)?.name || 'غير معروف', [auditors]);

  // --- STRICT FILTERING LOGIC ---
  const filteredVisits = useMemo(() => {
    let result = visits;
    if (user?.role === 'admin') {
        // Admin sees all
    } else if (user?.role === 'sector_manager' && user.governorates) {
        // Manager sees their governorates only
        result = visits.filter(v => user.governorates!.includes(v.governorate));
    } else if (user?.role === 'auditor') {
        // Auditor sees visits in their governorate OR assigned to them
        const userGov = user.governorate || (user.governorates && user.governorates[0]);
        // Show if assigned to me OR in my gov (optional: restrict to only assigned)
        result = visits.filter(v => v.governorate === userGov || v.auditorId === user.relatedId || v.auditorId === user.id);
    }
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [visits, user]);

  // Pagination
  const [visibleCount, setVisibleCount] = useState(VISITS_PER_PAGE);
  const displayedVisits = useMemo(() => filteredVisits.slice(0, visibleCount), [filteredVisits, visibleCount]);
  const handleLoadMore = () => setVisibleCount(prev => prev + VISITS_PER_PAGE);

  // Local State
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null); 
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatusText, setUpdateStatusText] = useState('تحديث وحفظ البيانات');
  
  // Update Form State
  const [updateForm, setUpdateForm] = useState({ 
      stageIdx: 0, 
      notes: '', 
      status: 'Planned' as Visit['status'],
      locationCoords: null as { lat: number; lng: number; timestamp: string } | null
  });
  
  // Attachments & Forms State
  const [rawImageFile, setRawImageFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const [rawDocumentFile, setRawDocumentFile] = useState<File | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [rawAudioBlob, setRawAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Smart Form Filling in Modal
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [isFillingForm, setIsFillingForm] = useState(false);
  const [formAnswers, setFormAnswers] = useState<Record<string, unknown>>({});

  const [showVisitForm, setShowVisitForm] = useState(false);
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [visitFormData, setVisitFormData] = useState<Partial<Visit>>({
    location: '', governorate: '', date: '', auditorId: '', status: 'Planned'
  });

  // Allowed Governorates for Dropdown
  const allowedGovernorates = useMemo(() => {
      if (user?.role === 'admin') return EGYPT_GOVERNORATES;
      if (user?.role === 'sector_manager') return user?.governorates || [];
      if (user?.role === 'auditor') return user?.governorate ? [user.governorate] : (user?.governorates || []);
      return [];
  }, [user]);

  // Allowed Auditors
  const availableAuditorsForForm = useMemo(() => {
    let filtered = visitFormData.governorate 
        ? auditors.filter(a => a.governorate === visitFormData.governorate)
        : [];
    if (user?.role === 'admin') return auditors; // Admin sees all regardless of gov selection initially
    if (visitFormData.governorate) {
       filtered = auditors.filter(a => a.governorate === visitFormData.governorate);
    }
    if (user?.role === 'sector_manager' && user?.governorates) {
        filtered = filtered.filter(a => user?.governorates?.includes(a.governorate));
    }
    return filtered;
  }, [auditors, visitFormData.governorate, user]);

  const handleOpenAdd = () => {
    setEditingVisitId(null);
    const defaultGov = allowedGovernorates.length === 1 ? allowedGovernorates[0] : '';
    const defaultAuditor = (user?.role === 'auditor') ? (user?.id || user?.relatedId || '') : '';
    setVisitFormData({
      location: '',
      governorate: defaultGov,
      date: new Date().toISOString().split('T')[0],
      auditorId: defaultAuditor,
      status: 'Planned'
    });
    setShowVisitForm(true);
  };

  const handleOpenEdit = useCallback((visit: Visit) => {
    setEditingVisitId(visit.id);
    setVisitFormData({
      location: visit.location,
      governorate: visit.governorate,
      date: visit.date,
      auditorId: visit.auditorId,
      status: visit.status
    });
    setShowVisitForm(true);
  }, []);

  const handleShare = useCallback((visit: Visit) => {
      const auditorName = getAuditorName(visit.auditorId);
      const text = `*تقرير متابعة زيارة*\nالموقع: ${visit.location}\nالمحافظة: ${visit.governorate}\nالمراجع: ${auditorName}\nالحالة: ${visit.status}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }, [getAuditorName]);

  const handleDeleteVisit = useCallback(async (id: string) => {
    if (confirm("هل أنت متأكد من الحذف؟")) await actions.deleteVisit(id);
  }, [actions]);

  const handleSaveVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    let visitToSave: Visit;
    if (editingVisitId) {
      const existing = visits.find(v => v.id === editingVisitId);
      if (!existing) return;
      visitToSave = {
        ...existing,
        ...visitFormData as Visit,
        progress: visitFormData.status === 'Completed' ? 100 : existing.progress,
      };
    } else {
      visitToSave = {
        id: Date.now().toString(),
        location: visitFormData.location!,
        governorate: visitFormData.governorate!,
        date: visitFormData.date!,
        auditorId: visitFormData.auditorId!,
        status: visitFormData.status as Visit['status'],
        progress: visitFormData.status === 'Completed' ? 100 : 0,
        currentStage: visitFormData.status === 'Completed' ? 'تم الانتهاء' : 'لم تبدأ'
      };
    }
    await actions.saveVisit(visitToSave);
    setShowVisitForm(false);
  };

  const handleOpenUpdate = useCallback((visit: Visit) => {
    setActiveVisit(visit);
    // Reset local state
    setRawImageFile(null);
    setPreviewImage(null);
    setRawDocumentFile(null);
    setRawAudioBlob(null);
    setIsRecording(false);
    setSelectedFormId('');
    setIsFillingForm(false);
    setFormAnswers({});
    setUpdateStatusText('تحديث وحفظ البيانات');
    
    const currentIdx = STAGES.indexOf(visit.currentStage || 'لم تبدأ');
    setUpdateForm({ 
        stageIdx: currentIdx === -1 ? 0 : currentIdx, 
        notes: visit.fieldNotes || '',
        status: visit.status,
        locationCoords: visit.locationCoords || null
    });
  }, []);

  // --- LOGIC: Sync Progress and Status ---
  const handleStageChange = (idx: number) => {
      let newStatus = updateForm.status;
      
      // Auto-update status based on stage
      if (idx === STAGES.length - 1) {
          newStatus = 'Completed';
      } else if (idx === 0 && newStatus === 'Completed') {
          newStatus = 'Planned';
      } else if (idx > 0 && newStatus === 'Planned') {
          newStatus = 'In Progress';
      }
      
      setUpdateForm(prev => ({ ...prev, stageIdx: idx, status: newStatus }));
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newStatus = e.target.value as Visit['status'];
      let newStageIdx = updateForm.stageIdx;

      // Auto-update stage based on status
      if (newStatus === 'Completed') {
          newStageIdx = STAGES.length - 1; // Force last stage
      } else if (newStatus === 'Planned') {
          newStageIdx = 0; // Force start
      } else if (newStatus === 'In Progress' && newStageIdx === 0) {
          newStageIdx = 1; // Start if it was at 0
      }

      setUpdateForm(prev => ({ ...prev, status: newStatus, stageIdx: newStageIdx }));
  };

  // --- LOCATION HANDLER ---
  const handleGetLocation = () => {
      if ("geolocation" in navigator) {
          setIsUpdating(true);
          setUpdateStatusText('جاري تحديد الموقع...');
          navigator.geolocation.getCurrentPosition(
              (position) => {
                  const coords = {
                      lat: position.coords.latitude,
                      lng: position.coords.longitude,
                      timestamp: new Date().toISOString()
                  };
                  setUpdateForm(prev => ({ ...prev, locationCoords: coords }));
                  setIsUpdating(false);
                  setUpdateStatusText('تحديث وحفظ البيانات');
                  alert("تم تحديد الموقع بنجاح: " + coords.lat.toFixed(5) + ", " + coords.lng.toFixed(5));
              },
              (error) => {
                  console.error(error);
                  alert("تعذر الحصول على الموقع. تأكد من تفعيل GPS والسماح للمتصفح.");
                  setIsUpdating(false);
                  setUpdateStatusText('تحديث وحفظ البيانات');
              },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
      } else {
          alert("المتصفح لا يدعم تحديد الموقع.");
      }
  };

  // --- MEDIA HANDLERS ---
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRawImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreviewImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setRawDocumentFile(file);
      }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRawAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setIsRecording(true);
    } catch { alert("تعذر الوصول للميكروفون"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); }
  };

  const handleSendUpdate = async () => {
    if (!activeVisit) return;
    setIsUpdating(true);
    setUpdateStatusText('جاري الاتصال بـ Google Drive...');
    
    try {
        // Calculate Progress based on Stage (Logic Redundancy for Safety)
        let progressValue = Math.round((updateForm.stageIdx / (STAGES.length - 1)) * 100);
        let updatedStatus = updateForm.status;
        let currentStage = STAGES[updateForm.stageIdx];

        // Ensure consistency before save
        if (updatedStatus === 'Completed') {
            progressValue = 100;
            currentStage = STAGES[STAGES.length - 1];
        } else if (progressValue === 100) {
            updatedStatus = 'Completed';
        } else if (updatedStatus === 'Planned') {
            progressValue = 0;
        }

        // Prepare Attachments - Auto Upload to Drive
        const newAttachments: VisitAttachment[] = [...(activeVisit.attachments || [])];
        let folderId = '';
        
        // 1. Upload Image
        if (rawImageFile) {
             setUpdateStatusText('جاري رفع الصورة...');
             if(!folderId) folderId = await getSystemFolderId();
             try {
                const uploaded = await uploadFileToDrive(rawImageFile, folderId);
                newAttachments.push({ 
                    id: `img_${Date.now()}`, 
                    type: 'image', 
                    url: (uploaded as { webViewLink: string }).webViewLink, 
                    timestamp: new Date().toISOString() 
                });
             } catch(e) { console.error("Image upload failed", e); }
        }

        // 2. Upload Document
        if (rawDocumentFile) {
             setUpdateStatusText('جاري رفع الملف...');
             if(!folderId) folderId = await getSystemFolderId();
             try {
                 const uploaded = await uploadFileToDrive(rawDocumentFile, folderId);
                 newAttachments.push({ 
                    id: `file_${Date.now()}`, 
                    type: 'file', 
                    url: (uploaded as { webViewLink: string }).webViewLink, 
                    name: rawDocumentFile.name, 
                    timestamp: new Date().toISOString() 
                 });
             } catch(e) { console.error("File upload failed", e); }
        }

        // 3. Upload Audio
        if (rawAudioBlob) {
             setUpdateStatusText('جاري رفع التسجيل الصوتي...');
             if(!folderId) folderId = await getSystemFolderId();
             try {
                 // Convert blob to File
                 const audioFile = new File([rawAudioBlob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
                 const uploaded = await uploadFileToDrive(audioFile, folderId);
                 newAttachments.push({ 
                    id: `aud_${Date.now()}`, 
                    type: 'audio', 
                    url: (uploaded as { webViewLink: string }).webViewLink, 
                    timestamp: new Date().toISOString() 
                 });
             } catch(e) { console.error("Audio upload failed", e); }
        }

        setUpdateStatusText('جاري حفظ التحديثات...');

        // Handle Form Submission
        let reportId = activeVisit.linkedReportId;
        if (isFillingForm && selectedFormId && user) {
             const submissionId = `sub_${Date.now()}`;
             const submission: DynamicFormSubmission = {
                 id: submissionId,
                 templateId: selectedFormId,
                 userId: user.id,
                 userName: user.name,
                 submittedAt: new Date().toISOString(),
                 answers: formAnswers as Record<string, string | number | boolean>,
                 governorate: activeVisit.governorate,
                 visitId: activeVisit.id
             };
             await actions.saveFormSubmission(submission);
             reportId = submissionId; 
        }

        const updatedVisit: Visit = {
          ...activeVisit,
          currentStage: currentStage,
          progress: progressValue,
          status: updatedStatus,
          fieldNotes: updateForm.notes,
          attachments: newAttachments,
          locationCoords: updateForm.locationCoords || activeVisit.locationCoords,
          linkedReportId: reportId
        };
        
        await actions.saveVisit(updatedVisit);
        alert(`تم تحديث حالة الزيارة إلى "${updatedStatus}" ونسبة الإنجاز إلى ${progressValue}% بنجاح.`);
    } catch (error) {
        console.error("Error saving visit:", error);
        alert("حدث خطأ أثناء الحفظ");
    } finally {
        setIsUpdating(false);
        setActiveVisit(null);
        setUpdateStatusText('تحديث وحفظ البيانات');
    }
  };

  const selectedTemplate = dynamicForms.find(f => f.id === selectedFormId);
  const isAssignedAuditor = user && activeVisit && (user.id === activeVisit.auditorId || user.relatedId === activeVisit.auditorId);
  const canModifyStatus = user?.role === 'admin' || user?.role === 'sector_manager' || isAssignedAuditor;

  return (
    <div className="space-y-8 pb-20">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
           <h2 className="text-2xl font-bold text-slate-800">الزيارات الميدانية</h2>
           <p className="text-slate-500 mt-1">
             {user?.role === 'admin' ? 'إدارة مركزية' : `إدارة زيارات ${user?.role === 'sector_manager' ? 'القطاع' : 'المحافظة'}`}
           </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-xl shadow-sm hover:bg-slate-50 transition flex items-center gap-2">
             <Printer size={18} /><span>طباعة</span>
          </button>
          {canCreate && (
             <button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-blue-600/20 transition font-medium flex items-center gap-2">
              <Plus size={18} /> جدولة زيارة
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2 no-print">
            <h3 className="font-bold text-slate-700">المهام في نطاقك ({filteredVisits.length})</h3>
          </div>
          
          {filteredVisits.length === 0 ? (
             <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center text-slate-400">
               <CalendarIcon size={48} className="mx-auto mb-3 opacity-50" />
               <p>لا توجد زيارات مسجلة في نطاق صلاحياتك.</p>
             </div>
          ) : (
            <>
              {displayedVisits.map(visit => (
                <VisitCard
                  key={visit.id}
                  visit={visit}
                  auditorName={getAuditorName(visit.auditorId)}
                  user={user}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  canUpdateProgress={canUpdateProgress}
                  onShare={handleShare}
                  onViewDetails={v => setActiveVisit(v)} 
                  onEdit={handleOpenEdit}
                  onDelete={handleDeleteVisit}
                  onUpdate={handleOpenUpdate}
                />
              ))}
              
              {filteredVisits.length > visibleCount && (
                <button onClick={handleLoadMore} className="w-full py-3 bg-white border border-slate-200 text-blue-600 font-bold rounded-2xl hover:bg-blue-50 transition-colors shadow-sm flex items-center justify-center gap-2">
                  <ChevronDown size={20} /> عرض المزيد
                </button>
              )}
            </>
          )}
        </div>

        <div className="space-y-6 no-print">
          <div className="bg-white p-6 rounded-2xl shadow-soft border border-slate-100">
             <h3 className="font-bold text-slate-800 mb-6 text-lg">إحصائيات النطاق</h3>
             <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-600 font-medium">زيارات مخططة / جارية</span>
                  <span className="font-bold text-slate-900 bg-white px-3 py-1 rounded-lg shadow-sm">{filteredVisits.filter(v => v.status === 'Planned' || v.status === 'In Progress').length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl">
                  <span className="text-green-700 font-medium">تم تنفيذها</span>
                  <span className="font-bold text-green-700 bg-white px-3 py-1 rounded-lg shadow-sm">{filteredVisits.filter(v => v.status === 'Completed').length}</span>
                </div>
             </div>
          </div>
        </div>
      </div>
      
      {/* Modal: Add/Edit Visit */}
      {showVisitForm && (canCreate || canEdit) && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm fade-in no-print">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  {editingVisitId ? <Edit size={24} className="text-blue-600" /> : <Plus size={24} className="text-blue-600" />}
                  {editingVisitId ? 'تعديل تفاصيل الزيارة' : 'جدولة زيارة جديدة'}
                </h3>
                <button onClick={() => setShowVisitForm(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button>
              </div>

              <form onSubmit={handleSaveVisit} className="space-y-4">
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">مكان الزيارة</label>
                   <input required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={visitFormData.location} onChange={(e) => setVisitFormData({...visitFormData, location: e.target.value})} />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">المحافظة</label>
                       <select 
                         required
                         className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none appearance-none"
                         value={visitFormData.governorate}
                         onChange={(e) => setVisitFormData({...visitFormData, governorate: e.target.value, auditorId: ''})}
                       >
                         <option value="">اختر...</option>
                         {allowedGovernorates.map(g => <option key={g} value={g}>{g}</option>)}
                       </select>
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ</label>
                       <input required type="date" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={visitFormData.date} onChange={(e) => setVisitFormData({...visitFormData, date: e.target.value})} />
                    </div>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">المراجع المسؤول</label>
                    <select 
                      required
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none appearance-none disabled:opacity-50"
                      value={visitFormData.auditorId}
                      disabled={!visitFormData.governorate}
                      onChange={(e) => setVisitFormData({...visitFormData, auditorId: e.target.value})}
                    >
                      <option value="">{visitFormData.governorate ? 'اختر المراجع' : 'اختر المحافظة أولاً'}</option>
                      {availableAuditorsForForm.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                 </div>

                 <div className="pt-4 mt-2 border-t border-slate-100 flex gap-3">
                    <button type="button" onClick={() => setShowVisitForm(false)} className="flex-1 py-3 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl font-bold">إلغاء</button>
                    <button type="submit" className="flex-[2] py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold flex items-center justify-center gap-2"><Save size={18} /> حفظ</button>
                 </div>
              </form>
            </div>
         </div>
      )}

      {/* UPDATE / PROGRESS MODAL */}
      {activeVisit && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm fade-in no-print">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[90vh]">
               <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                  <div>
                      <h3 className="text-xl font-bold text-slate-800">تحديث متابعة الزيارة</h3>
                      <p className="text-sm text-slate-500">{activeVisit.location} - {activeVisit.governorate}</p>
                  </div>
                  <button onClick={() => setActiveVisit(null)} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button>
               </div>
               
               <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                  
                  {/* 1. Status & Location Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">حالة الزيارة</label>
                          <select 
                            value={updateForm.status} 
                            onChange={handleStatusChange}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 outline-none"
                            disabled={!canModifyStatus}
                          >
                             <option value="Planned">مخطط (Planned)</option>
                             <option value="In Progress">جاري التنفيذ (In Progress)</option>
                             <option value="Completed">تم الانتهاء (Completed)</option>
                             <option value="Cancelled">ملغى (Cancelled)</option>
                          </select>
                          {!canModifyStatus && <p className="text-[10px] text-red-400 mt-1">تعديل الحالة مسموح للمدير أو المراجع المسؤول فقط.</p>}
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">الموقع الجغرافي</label>
                          
                          {updateForm.locationCoords ? (
                              <div className="space-y-2">
                                  <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-green-200">
                                      <div className="flex items-center gap-2">
                                          <CheckCircle size={16} className="text-green-500" />
                                          <div>
                                              <p className="text-xs font-bold text-green-700">تم تسجيل الموقع</p>
                                              <p className="text-[10px] text-slate-400 font-mono">{new Date(updateForm.locationCoords.timestamp).toLocaleTimeString('ar-EG')}</p>
                                          </div>
                                      </div>
                                      <a 
                                          href={`https://www.google.com/maps?q=${updateForm.locationCoords.lat},${updateForm.locationCoords.lng}`}
                                          target="_blank"
                                          rel="noreferrer" 
                                          className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition-colors"
                                          title="عرض على الخريطة"
                                      >
                                          <Map size={18} />
                                      </a>
                                  </div>
                                  
                                  {(isAssignedAuditor || user?.role === 'admin') && (
                                      <button 
                                        onClick={handleGetLocation}
                                        className="w-full py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 flex items-center justify-center gap-2"
                                      >
                                        <LocateFixed size={14} /> تحديث الإحداثيات
                                      </button>
                                  )}
                              </div>
                          ) : (
                              <button 
                                onClick={handleGetLocation}
                                className="w-full py-2.5 bg-white text-blue-600 border border-blue-200 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-50 transition-all"
                              >
                                  <LocateFixed size={16} /> تحديد موقعي (GPS)
                              </button>
                          )}
                      </div>
                  </div>

                  {/* 2. Progress Stage */}
                  <div>
                      <div className="flex justify-between items-end mb-2">
                          <label className="block text-sm font-bold text-slate-700">مرحلة الزيارة الحالية</label>
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              إنجاز: {Math.round((updateForm.stageIdx / (STAGES.length - 1)) * 100)}%
                          </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {STAGES.map((stage, idx) => (
                           <button key={stage} onClick={() => handleStageChange(idx)} className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-all ${updateForm.stageIdx === idx ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>{stage}</button>
                        ))}
                      </div>
                  </div>

                  {/* 3. Forms & Reports Integration */}
                  <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                      <div className="flex justify-between items-center mb-3">
                          <label className="flex items-center gap-2 text-sm font-bold text-indigo-900">
                             <Layout size={18} className="text-indigo-600" />
                             تعبئة نموذج تقرير (Smart Form)
                          </label>
                          {isFillingForm && <button onClick={() => setIsFillingForm(false)} className="text-xs text-red-500 font-bold hover:underline">إلغاء النموذج</button>}
                      </div>
                      
                      {!isFillingForm ? (
                          <div className="flex gap-2">
                              <select 
                                value={selectedFormId} 
                                onChange={(e) => setSelectedFormId(e.target.value)}
                                className="flex-1 p-2.5 bg-white border border-indigo-200 rounded-lg text-sm outline-none"
                              >
                                  <option value="">اختر نموذج للتعبئة...</option>
                                  {dynamicForms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                              </select>
                              <button 
                                disabled={!selectedFormId}
                                onClick={() => setIsFillingForm(true)}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50"
                              >
                                  بدء التعبئة
                              </button>
                          </div>
                      ) : (
                          <div className="bg-white p-4 rounded-xl border border-indigo-200 max-h-60 overflow-y-auto">
                              <h4 className="font-bold text-indigo-800 mb-4 text-sm border-b pb-2">{selectedTemplate?.title}</h4>
                              <div className="space-y-3">
                                  {selectedTemplate?.fields.map(field => (
                                      <div key={field.id}>
                                          <label className="block text-xs font-bold text-slate-600 mb-1">{field.label}</label>
                                          {field.type === 'select' ? (
                                              <select className="w-full p-2 border rounded-lg text-sm" onChange={e => setFormAnswers({...formAnswers, [field.id]: e.target.value})}>
                                                  <option value="">اختر...</option>
                                                  {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                              </select>
                                          ) : field.type === 'textarea' ? (
                                              <textarea className="w-full p-2 border rounded-lg text-sm h-16" onChange={e => setFormAnswers({...formAnswers, [field.id]: e.target.value})} />
                                          ) : (
                                              <input type={field.type} className="w-full p-2 border rounded-lg text-sm" onChange={e => setFormAnswers({...formAnswers, [field.id]: e.target.value})} />
                                          )}
                                      </div>
                                  ))}
                              </div>
                              <div className="mt-3 text-center text-xs text-green-600 font-bold bg-green-50 p-2 rounded">
                                  سيتم حفظ النموذج تلقائياً عند تحديث الزيارة
                              </div>
                          </div>
                      )}
                  </div>

                  {/* 4. Notes & Attachments */}
                  <div>
                     <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                        ملاحظات ومرفقات 
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <HardDriveUpload size={10} />
                            سيتم الرفع لـ Google Drive تلقائياً
                        </span>
                     </label>
                     <textarea className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl h-20 outline-none resize-none text-sm" value={updateForm.notes} onChange={e => setUpdateForm({...updateForm, notes: e.target.value})} placeholder="اكتب ملاحظاتك هنا..." />
                     
                     <div className="grid grid-cols-3 gap-2 mt-2">
                        <label className="cursor-pointer flex flex-col items-center justify-center gap-1 p-3 border border-dashed border-slate-300 rounded-xl hover:bg-slate-50 hover:border-blue-400 bg-white transition-all">
                           <ImageIcon size={20} className="text-blue-500" />
                           <span className="text-[10px] font-bold text-slate-600">صورة</span>
                           <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                        </label>
                        
                        <label className="cursor-pointer flex flex-col items-center justify-center gap-1 p-3 border border-dashed border-slate-300 rounded-xl hover:bg-slate-50 hover:border-amber-400 bg-white transition-all">
                           <FileUp size={20} className="text-amber-500" />
                           <span className="text-[10px] font-bold text-slate-600">ملف (PDF/Doc)</span>
                           <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileSelect} />
                        </label>
                        
                        <button 
                           onClick={isRecording ? stopRecording : startRecording}
                           className={`flex flex-col items-center justify-center gap-1 p-3 border border-dashed rounded-xl transition-colors ${isRecording ? 'bg-red-50 border-red-400 animate-pulse' : 'bg-white border-slate-300 hover:bg-slate-50 hover:border-red-400'}`}
                        >
                           {isRecording ? <StopCircle size={20} className="text-red-500" /> : <Mic size={20} className="text-red-500" />}
                           <span className="text-[10px] font-bold text-slate-600">{isRecording ? 'إيقاف' : 'تسجيل صوت'}</span>
                        </button>
                     </div>

                     {/* Previews */}
                     <div className="space-y-2 mt-3">
                         {previewImage && <div className="text-xs flex items-center gap-2 text-green-600"><CheckCircle size={12}/> تم تحديد صورة للرفع</div>}
                         {rawDocumentFile && <div className="text-xs flex items-center gap-2 text-green-600"><CheckCircle size={12}/> تم تحديد ملف للرفع: {rawDocumentFile.name}</div>}
                         {rawAudioBlob && <div className="text-xs flex items-center gap-2 text-green-600"><CheckCircle size={12}/> تم تسجيل مقطع صوتي</div>}
                     </div>
                  </div>
               </div>

               <div className="mt-4 pt-4 border-t border-slate-100 flex gap-3">
                  <button onClick={() => setActiveVisit(null)} className="flex-1 py-3 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl font-bold">إلغاء</button>
                  <button onClick={handleSendUpdate} disabled={isUpdating} className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-colors">
                    {isUpdating ? <Loader size={20} className="animate-spin" /> : <Send size={20} />} {updateStatusText}
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default Visits;

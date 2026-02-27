
import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, Search, Eye, Check, X, Printer, Plus, 
  Trash2, Save, Sparkles, FileUp, Loader2, HardDriveUpload,
  Layout, Wand2, MapPin, Edit
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../hooks/useData';
import { ReportDocument, DynamicFormTemplate, FormField, FieldType, DynamicFormSubmission } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { loadGoogleScripts, uploadFileToDrive, getSystemFolderId } from '../services/googleDriveService';
import { analyzeDocumentImage, generateSmartFormSchema } from '../services/geminiService';
import { TvetaLogo } from '../components/TvetaLogo';
import { EGYPT_GOVERNORATES } from '../constants';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const Reports: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const location = useLocation();
  const canCreateForm = hasPermission('create', 'forms') && user?.role === 'admin'; 
  const isAdmin = user?.role === 'admin';
  const { reports, dynamicForms, dynamicSubmissions, actions } = useData(); 
  
  const [activeTab, setActiveTab] = useState<'archive' | 'forms'>('archive');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [filterGov, setFilterGov] = useState('All');
  
  // States for Modals/Forms
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [formBuilderData, setFormBuilderData] = useState<{title: string, description: string, fields: FormField[]}>({title: '', description: '', fields: []});
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  const [showFormFiller, setShowFormFiller] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DynamicFormTemplate | null>(null);
  const [formAnswers, setFormAnswers] = useState<Record<string, unknown>>({});
  
  // Edit Report State (Admin)
  const [editingReport, setEditingReport] = useState<ReportDocument | null>(null);
  
  // Print Preview State
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printData, setPrintData] = useState<{template: DynamicFormTemplate, answers: Record<string, unknown>, meta: Record<string, unknown>} | null>(null);
  
  // Smart Upload State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadData, setUploadData] = useState({ title: '', governorate: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  
  // AI Analysis & Generation State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingForm, setIsGeneratingForm] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get('q');
    const action = params.get('action');

    if (query) { setSearchTerm(query); setActiveTab('archive'); }
    if (action === 'upload') { setShowUploadModal(true); }
    
    loadGoogleScripts().catch(err => console.warn("Google Drive scripts init failed", err));
    
  }, [location.search]);

  // --- Strict Filtering Logic ---
  const filteredReports = useMemo(() => {
    let result = reports;
    if (user?.role === 'admin') {
        // Admin sees all
    } else if (user?.role === 'sector_manager' && user?.governorates) {
        result = reports.filter(r => user?.governorates?.includes(r.governorate));
    } else if (user?.role === 'auditor') {
        const userGov = user?.governorate || (user?.governorates && user?.governorates[0]);
        if (userGov) {
            result = reports.filter(r => r.governorate === userGov);
        }
    }

    return result.filter(report => {
        const searchLow = debouncedSearchTerm.toLowerCase();
        const matchesSearch = report.title.toLowerCase().includes(searchLow) || report.governorate.toLowerCase().includes(searchLow);
        const matchesGov = filterGov === 'All' || report.governorate === filterGov;
        return matchesSearch && matchesGov;
    });
  }, [reports, debouncedSearchTerm, filterGov, user]);

  const allowedGovs = useMemo(() => {
      if (user?.role === 'admin') return [];
      if (user?.role === 'sector_manager') return user?.governorates || [];
      return user?.governorate ? [user.governorate] : [];
  }, [user]);

  const handlePrint = () => {
    window.print();
  };

  // --- Form Builder Logic ---
  const addField = (type: FieldType, customOptions?: string[], label: string = 'سؤال جديد') => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      label: label,
      type,
      required: false,
      options: type === 'select' || type === 'checkbox' ? (customOptions || ['الخيار 1']) : undefined
    };

    setFormBuilderData(prev => ({ ...prev, fields: [...prev.fields, newField] }));
    setActiveFieldId(newField.id);
  };

  const addGovernorateField = () => {
    addField('select', EGYPT_GOVERNORATES, 'المحافظة');
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFormBuilderData(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === id ? { ...f, ...updates } : f)
    }));
  };

  const removeField = (id: string) => {
    setFormBuilderData(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.id !== id)
    }));
  };

  const addOptionToField = (fieldId: string) => {
      const field = formBuilderData.fields.find(f => f.id === fieldId);
      if(field && field.options) {
          updateField(fieldId, { options: [...field.options, `خيار ${field.options.length + 1}`] });
      }
  };

  const updateOptionText = (fieldId: string, optionIdx: number, text: string) => {
      const field = formBuilderData.fields.find(f => f.id === fieldId);
      if(field && field.options) {
          const newOptions = [...field.options];
          newOptions[optionIdx] = text;
          updateField(fieldId, { options: newOptions });
      }
  };

  const removeOption = (fieldId: string, optionIdx: number) => {
      const field = formBuilderData.fields.find(f => f.id === fieldId);
      if(field && field.options) {
          const newOptions = field.options.filter((_, idx) => idx !== optionIdx);
          updateField(fieldId, { options: newOptions });
      }
  };

  const handleSaveForm = async () => {
    if (!formBuilderData.title) {
        alert("يرجى كتابة عنوان للنموذج");
        return;
    }
    const newTemplate: DynamicFormTemplate = {
      id: `template_${Date.now()}`,
      title: formBuilderData.title,
      description: formBuilderData.description,
      fields: formBuilderData.fields,
      createdAt: new Date().toISOString()
    };
    await actions.saveFormTemplate(newTemplate);
    setShowFormBuilder(false);
    setFormBuilderData({ title: '', description: '', fields: [] });
    setNotification('تم حفظ نموذج التقرير بنجاح');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAIFormGeneration = async () => {
      const topic = prompt("اكتب وصفاً أو موضوعاً للنموذج الذي تريد إنشاءه (مثال: نموذج تقييم نظافة المعامل):");
      if(!topic) return;

      setIsGeneratingForm(true);
      try {
          const schema = await generateSmartFormSchema(topic);
          if (schema) {
              const enrichedFields = (schema as { fields: FormField[] }).fields.map((f: FormField, idx: number) => ({
                  ...f,
                  id: `ai_field_${Date.now()}_${idx}`,
                  type: f.type || 'text'
              }));
              setFormBuilderData({
                  title: (schema as { title?: string }).title || topic,
                  description: (schema as { description?: string }).description || 'تم إنشاؤه بواسطة الذكاء الاصطناعي',
                  fields: enrichedFields
              });
              setNotification("تم تصميم النموذج بنجاح!");
          } else {
              setNotification("فشل توليد النموذج. حاول مرة أخرى.");
          }
      } catch (e) {
          console.error(e);
          setNotification("حدث خطأ أثناء الاتصال بـ Gemini");
      } finally {
          setIsGeneratingForm(false);
          setTimeout(() => setNotification(null), 3000);
      }
  };

  // --- Form Filler Logic ---
  const handleOpenFill = (template: DynamicFormTemplate) => { 
    setSelectedTemplate(template); 
    setFormAnswers({}); 
    setShowFormFiller(true); 
  };

  const handleSubmitForm = async (closeAfter: boolean = true) => {
    if (!selectedTemplate || !user) return;
    
    // Validation
    const missingRequired = selectedTemplate.fields.filter(f => f.required && !formAnswers[f.id]);
    if (missingRequired.length > 0) {
      alert(`يرجى إكمال الحقول المطلوبة: ${missingRequired.map(f => f.label).join(', ')}`);
      return;
    }

    setIsSubmittingForm(true);
    try {
        const submissionData: DynamicFormSubmission = {
          id: `sub_${Date.now()}`,
          templateId: selectedTemplate.id,
          userId: user?.id || '',
          userName: user?.name || '',
          submittedAt: new Date().toISOString(),
          answers: formAnswers as Record<string, string | number | boolean>,
          governorate: user?.governorate || (user?.governorates?.[0]) || 'غير محدد'
        };

        await actions.saveFormSubmission(submissionData);
        setNotification('تم إرسال النموذج إلى إدارة النظام بنجاح');
        
        if (closeAfter) {
            setShowFormFiller(false);
            setPrintData({
                template: selectedTemplate,
                answers: formAnswers,
                meta: {
                    user: user?.name || '',
                    date: new Date().toLocaleDateString('ar-EG'),
                    gov: submissionData.governorate
                }
            });
            setShowPrintPreview(true);
        } else {
            setFormAnswers({});
            const formContainer = document.getElementById('dynamic-form-container');
            if (formContainer) formContainer.scrollTop = 0;
        }

        setTimeout(() => setNotification(null), 4000);
    } catch (e) {
        console.error(e);
        setNotification("حدث خطأ أثناء الإرسال");
    } finally {
        setIsSubmittingForm(false);
    }
  };

  const handleViewReport = (report: ReportDocument) => {
     if(report.isSmartForm && report.smartFormData) {
         // Attempt to find full submission and template for rich display
         const submission = dynamicSubmissions.find(s => s.id === report.url);
         const templateId = submission?.templateId || (report.title.match(/تقرير: (template_\d+)/)?.[1]);
         const template = dynamicForms.find(f => f.id === templateId) || { id: 'view', title: report.title, description: 'عرض أرشيف', fields: [], createdAt: '' };

         setPrintData({
             template: template,
             answers: report.smartFormData,
             meta: {
                 user: submission?.userName || report.auditorId || 'مسجل بالنظام',
                 date: report.date,
                 gov: report.governorate,
                 isArchive: true
             }
         });
         setShowPrintPreview(true);
     } else {
         if (report.url) {
             window.open(report.url, '_blank');
         } else {
             alert('رابط الملف غير متوفر.');
         }
     }
  };

  // --- ADMIN ACTIONS ---
  const handleDeleteReport = async (id: string) => {
      if(!confirm("هل أنت متأكد من حذف هذا التقرير من الأرشيف؟ لا يمكن التراجع.")) return;
      await actions.deleteReport(id);
      setNotification("تم حذف التقرير بنجاح");
      setTimeout(() => setNotification(null), 3000);
  };

  const handleEditReport = (report: ReportDocument) => {
      setEditingReport(report);
  };

  const handleSaveEdit = async () => {
      if (!editingReport) return;
      await actions.saveReport(editingReport);
      setEditingReport(null);
      setNotification("تم تحديث بيانات التقرير");
      setTimeout(() => setNotification(null), 3000);
  };

  // --- PDF GENERATION & EXPORT ---
  const handleExportToDrive = async (report: ReportDocument) => {
      if (!report.isSmartForm || !report.smartFormData) {
          alert("يمكن تصدير النماذج الذكية فقط. الملفات المرفقة موجودة بالفعل على Drive.");
          return;
      }
      
      const submission = dynamicSubmissions.find(s => s.id === report.url);
      const templateId = submission?.templateId || (report.title.match(/تقرير: (template_\d+)/)?.[1]);
      const template = dynamicForms.find(f => f.id === templateId);

      if (!template || !submission) {
          alert("تعذر العثور على بيانات النموذج الأصلية.");
          return;
      }

      setIsExporting(true);
      setNotification("جاري إعداد ملف PDF...");

      try {
          // 1. Create a hidden element for rendering the report
          const printContainer = document.createElement('div');
          printContainer.style.position = 'absolute';
          printContainer.style.top = '-9999px';
          printContainer.style.left = '0';
          printContainer.style.width = '210mm'; // A4
          printContainer.style.backgroundColor = '#ffffff';
          printContainer.style.padding = '40px';
          printContainer.style.direction = 'rtl';
          printContainer.style.fontFamily = 'Arial, sans-serif'; 
          
          let fieldsHtml = '';
          template.fields.forEach(field => {
              const val = submission.answers[field.id];
              let valStr = '---';
              if (Array.isArray(val)) valStr = val.join(', ');
              else if (val) valStr = String(val);
              
              fieldsHtml += `
                <div style="margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                    <div style="font-weight: bold; font-size: 14px; color: #333; margin-bottom: 5px;">${field.label}</div>
                    <div style="color: #555; font-size: 13px;">${valStr}</div>
                </div>
              `;
          });

          printContainer.innerHTML = `
            <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 20px;">
                <h1 style="font-size: 24px; font-weight: bold; margin: 0;">${template.title}</h1>
                <p style="color: #666; margin: 5px 0;">${template.description}</p>
                <div style="font-size: 12px; color: #999;">Ref: ${submission.id}</div>
            </div>
            <div style="margin-bottom: 30px; background: #f9fafb; padding: 15px; border-radius: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px;">
                <div><strong>مقدم التقرير:</strong> ${submission.userName}</div>
                <div><strong>التاريخ:</strong> ${new Date(submission.submittedAt).toLocaleDateString('ar-EG')}</div>
                <div><strong>المحافظة:</strong> ${submission.governorate}</div>
            </div>
            <div>
                ${fieldsHtml}
            </div>
            <div style="margin-top: 50px; display: flex; justify-content: space-between; text-align: center;">
                 <div>
                    <p style="font-size: 14px; font-weight: bold;">توقيع المراجع</p>
                    <div style="margin-top: 40px; border-top: 1px dashed #000; width: 150px;"></div>
                 </div>
                 <div>
                    <p style="font-size: 14px; font-weight: bold;">اعتماد المدير</p>
                    <div style="margin-top: 40px; border-top: 1px dashed #000; width: 150px;"></div>
                 </div>
            </div>
            <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #999;">
                تم استخراج هذا المستند إلكترونياً من نظام TVETA للجودة
            </div>
          `;

          document.body.appendChild(printContainer);

          // 2. Generate PDF
          const canvas = await html2canvas(printContainer, { scale: 2 });
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          
          pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          const pdfBlob = pdf.output('blob');
          const pdfFile = new File([pdfBlob], `${report.title.replace(/\s+/g, '_')}.pdf`, { type: 'application/pdf' });

          document.body.removeChild(printContainer);

          // 3. Upload to Drive
          setNotification("جاري رفع ملف PDF إلى Google Drive...");
          const folderId = await getSystemFolderId();
          await uploadFileToDrive(pdfFile, folderId);
          setNotification("تم الحفظ في Drive بنجاح!");

      } catch (e) {
          console.error(e);
          setNotification("فشل التصدير: " + (e as Error).message);
      } finally {
          setIsExporting(false);
          setTimeout(() => setNotification(null), 4000);
      }
  };

  // --- AI Smart Fill & Upload Logic (Identical to previous) ---
  const handleSmartFill = async () => { 
     if (!selectedFile || !selectedFile.type.startsWith('image/')) return;
     
     setIsAnalyzing(true);
     setNotification("جاري تحليل الصورة بواسطة Gemini...");
     try {
         const reader = new FileReader();
         reader.onloadend = async () => {
             const base64 = (reader.result as string).split(',')[1];
             const analysis = await analyzeDocumentImage(base64);
             
             setUploadData(prev => ({
                 ...prev,
                 title: analysis.title || prev.title,
                 governorate: analysis.governorate && EGYPT_GOVERNORATES.includes(analysis.governorate) 
                     ? analysis.governorate 
                     : prev.governorate
             }));
             setNotification("تم استخراج البيانات بنجاح!");
         };
         reader.readAsDataURL(selectedFile);
     } catch (e) {
         console.error(e);
         setNotification("فشل التحليل الذكي.");
     } finally {
         setIsAnalyzing(false);
         setTimeout(() => setNotification(null), 3000);
     }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploadProgress(10);
    try {
        const folderId = await getSystemFolderId();
        setUploadProgress(40);
        
        const uploadedFile = await uploadFileToDrive(selectedFile, folderId);
        setUploadProgress(80);

        const newReport: ReportDocument = {
            id: `doc_${Date.now()}`,
            title: uploadData.title,
            type: selectedFile.type,
            date: new Date().toISOString().split('T')[0],
            governorate: uploadData.governorate,
            status: 'Approved',
            url: (uploadedFile as { webViewLink: string }).webViewLink,
            auditorId: user?.id
        };

        await actions.saveReport(newReport);
        setUploadProgress(100);
        setNotification("تم الحفظ بنجاح");
        setShowUploadModal(false);
        setUploadData({ title: '', governorate: '' });
        setSelectedFile(null);
    } catch (error) {
        console.error(error);
        setNotification("فشل الرفع: " + (error as Error).message);
    } finally {
        setUploadProgress(null);
        setTimeout(() => setNotification(null), 3000);
    }
  };

  return (
    <div className="space-y-8 relative pb-20">
      {/* Notifications */}
      {notification && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-bounce no-print">
              <div className={`px-8 py-4 rounded-3xl shadow-2xl flex items-center gap-3 border ${notification.includes('فشل') || notification.includes('خطأ') ? 'bg-rose-900 border-rose-700 text-white' : 'bg-slate-900 border-slate-700 text-white'}`}>
                  <div className={`rounded-full p-1 ${notification.includes('فشل') || notification.includes('خطأ') ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                      {notification.includes('فشل') || notification.includes('خطأ') ? <X size={18} /> : <Check size={18} />}
                  </div>
                  <span className="font-bold">{notification}</span>
              </div>
          </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 no-print border-b border-slate-200 dark:border-slate-800 pb-8">
        <div className="space-y-2">
           <div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em]">
             <Sparkles size={14} />
             <span>نظام إدارة الأرشيف الذكي</span>
           </div>
           <h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
             المستندات <span className="text-indigo-600">&</span> التقارير
           </h2>
           <p className="text-slate-500 dark:text-slate-400 font-medium text-lg max-w-md">إدارة مركزية للنماذج الذكية والأرشيف السحابي المؤمن.</p>
        </div>
        <div className="flex flex-wrap gap-4">
           <button onClick={() => setShowUploadModal(true)} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-4 rounded-full font-black flex items-center gap-3 shadow-2xl transition-all hover:scale-105 active:scale-95 group">
             <FileUp size={20} />
             <span>إدراج ملف جديد</span>
           </button>
        </div>
      </div>

      {/* Modern Sliding Tabs */}
      <div className="flex justify-center no-print">
        <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-full shadow-inner">
            <button 
              onClick={() => setActiveTab('archive')} 
              className={`px-8 py-2.5 rounded-full text-sm font-black transition-all ${activeTab === 'archive' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              سجل الأرشيف
            </button>
            <button 
              onClick={() => setActiveTab('forms')} 
              className={`px-8 py-2.5 rounded-full text-sm font-black transition-all ${activeTab === 'forms' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              النماذج الذكية
            </button>
        </div>
      </div>

      {activeTab === 'archive' && (
        <div className="space-y-6 fade-in">
             <div className="flex flex-wrap gap-4 no-print bg-white dark:bg-slate-900 p-6 rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="relative flex-1 min-w-[300px]">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input type="text" placeholder="ابحث في الأرشيف..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pr-12 pl-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white font-medium" />
                </div>
                {user?.role !== 'auditor' && (
                    <select value={filterGov} onChange={e => setFilterGov(e.target.value)} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-6 py-3.5 rounded-2xl font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="All">كل المحافظات</option>
                        {allowedGovs.length > 0 ? allowedGovs.map(g => <option key={g} value={g}>{g}</option>) : EGYPT_GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                )}
             </div>

             <div className="bg-white dark:bg-slate-900 rounded-[40px] shadow-soft border border-slate-100 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-right">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">
                        <tr>
                          <th className="p-6">المستند</th>
                          <th className="p-6">الموقع</th>
                          <th className="p-6">التاريخ</th>
                          <th className="p-6 text-center">الإجراءات</th>
                          {isAdmin && <th className="p-6 text-center">الإدارة</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {filteredReports.map(report => (
                            <tr key={report.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                                <td className="p-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${report.isSmartForm ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'}`}>
                                            {report.isSmartForm ? <Layout size={20} /> : <FileText size={20} />}
                                        </div>
                                        <div>
                                            <div className="font-black text-slate-900 dark:text-white">{report.title}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{report.isSmartForm ? 'نموذج ذكي' : 'ملف مرفوع'}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-6">
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-bold text-sm">
                                        <MapPin size={14} className="text-slate-400" />
                                        {report.governorate}
                                    </div>
                                </td>
                                <td className="p-6">
                                    <div className="text-slate-500 dark:text-slate-500 font-mono text-xs font-bold">
                                        {new Date(report.date).toLocaleDateString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </div>
                                </td>
                                <td className="p-6">
                                    <div className="flex justify-center gap-2">
                                        <button onClick={() => handleViewReport(report)} className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all" title="عرض">
                                            <Eye size={20} />
                                        </button>
                                        {report.isSmartForm && (
                                            <button onClick={() => handleViewReport(report)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all" title="طباعة">
                                                <Printer size={20} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                                {isAdmin && (
                                    <td className="p-6 border-r border-slate-50 dark:border-slate-800">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => handleEditReport(report)} className="p-2.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-all">
                                                <Edit size={20} />
                                            </button>
                                            <button onClick={() => handleDeleteReport(report.id)} className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all">
                                                <Trash2 size={20} />
                                            </button>
                                            {report.isSmartForm && (
                                                <button onClick={() => handleExportToDrive(report)} className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all">
                                                    {isExporting ? <Loader2 className="animate-spin" size={20} /> : <HardDriveUpload size={20} />}
                                                </button>
                                            )}
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

      {/* Edit Modal (Admin) */}
      {editingReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm fade-in no-print">
              <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl p-6">
                  <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">تعديل بيانات التقرير</h3>
                      <button onClick={() => setEditingReport(null)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-slate-500 mb-1">عنوان التقرير</label>
                          <input className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl" value={editingReport.title} onChange={e => setEditingReport({...editingReport, title: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-bold text-slate-500 mb-1">المحافظة</label>
                              <select className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl" value={editingReport.governorate} onChange={e => setEditingReport({...editingReport, governorate: e.target.value})}>
                                  {EGYPT_GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-slate-500 mb-1">التاريخ</label>
                              <input type="date" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl" value={editingReport.date} onChange={e => setEditingReport({...editingReport, date: e.target.value})} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-slate-500 mb-1">الحالة</label>
                          <select className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl" value={editingReport.status} onChange={e => setEditingReport({...editingReport, status: e.target.value as ReportDocument['status']})}>
                              <option value="Approved">معتمد (Approved)</option>
                              <option value="Pending">قيد المراجعة (Pending)</option>
                              <option value="Rejected">مرفوض (Rejected)</option>
                          </select>
                      </div>
                  </div>
                  <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <button onClick={() => setEditingReport(null)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold">إلغاء</button>
                      <button onClick={handleSaveEdit} className="flex-[2] py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20">حفظ التعديلات</button>
                  </div>
              </div>
          </div>
      )}

      {/* Forms Tab */}
      {activeTab === 'forms' && (
          <div className="space-y-6 animate-fade-in">
              {canCreateForm && (
                  <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-[32px] p-8 text-white flex justify-between items-center shadow-lg shadow-purple-500/20">
                      <div>
                          <h3 className="text-2xl font-black mb-1">منشئ النماذج الذكي</h3>
                          <p className="text-purple-100 opacity-80">صمم نماذج احترافية تشبه Google Forms بنقرة واحدة</p>
                      </div>
                      <button onClick={() => setShowFormBuilder(true)} className="bg-white text-purple-700 px-6 py-3 rounded-2xl font-bold flex gap-2 hover:bg-purple-50 transition-colors shadow-xl">
                          <Plus size={20} /> تصميم نموذج جديد
                      </button>
                  </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {dynamicForms.map(form => (
                     <div key={form.id} className="bg-white dark:bg-slate-900 rounded-[24px] shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all overflow-hidden flex flex-col">
                         <div className="h-3 bg-indigo-600 w-full"></div>
                         <div className="p-6 flex-1">
                            <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-2 line-clamp-1">{form.title}</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 line-clamp-2">{form.description}</p>
                            <button onClick={() => handleOpenFill(form)} className="w-full py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors flex items-center justify-center gap-2">
                                <FileText size={18} /> عرض وتعبئة
                            </button>
                         </div>
                     </div>
                 ))}
              </div>
          </div>
      )}

      {/* --- GOOGLE FORMS STYLE BUILDER MODAL --- */}
      {showFormBuilder && (
        <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-950 overflow-y-auto no-print">
            <div className="min-h-screen pb-20">
                {/* Header Toolbar */}
                <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center shadow-sm">
                   <div className="flex items-center gap-4">
                       <button onClick={() => setShowFormBuilder(false)} className="text-slate-500 hover:text-slate-700"><X size={24} /></button>
                       <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">{formBuilderData.title || 'نموذج بدون عنوان'}</h3>
                   </div>
                   <div className="flex gap-3">
                       <button onClick={handleAIFormGeneration} disabled={isGeneratingForm} className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-bold text-sm transition-colors">
                           {isGeneratingForm ? <Loader2 className="animate-spin" size={16} /> : <Wand2 size={16} />} 
                           توليد بالذكاء الاصطناعي
                       </button>
                       <button onClick={handleSaveForm} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-md transition-colors">
                           <Save size={18} /> حفظ النموذج
                       </button>
                   </div>
                </div>

                {/* Main Content */}
                <div className="max-w-3xl mx-auto mt-8 px-4 flex gap-6 items-start relative">
                    
                    {/* Form Cards */}
                    <div className="flex-1 space-y-6">
                        {/* Title Card */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border-t-8 border-indigo-600 p-6 relative group border-x border-b border-slate-200 dark:border-slate-800">
                             <input 
                                value={formBuilderData.title} 
                                onChange={e => setFormBuilderData({...formBuilderData, title: e.target.value})}
                                className="w-full text-3xl font-bold text-slate-800 dark:text-white border-b border-transparent hover:border-slate-200 focus:border-indigo-500 outline-none pb-2 bg-transparent transition-colors placeholder-slate-300"
                                placeholder="عنوان النموذج"
                             />
                             <input 
                                value={formBuilderData.description} 
                                onChange={e => setFormBuilderData({...formBuilderData, description: e.target.value})}
                                className="w-full text-sm text-slate-500 dark:text-slate-400 mt-2 border-b border-transparent hover:border-slate-200 focus:border-indigo-500 outline-none pb-1 bg-transparent transition-colors placeholder-slate-300"
                                placeholder="وصف النموذج"
                             />
                        </div>

                        {/* Question Cards */}
                        {formBuilderData.fields.map((field) => (
                            <div key={field.id} onClick={() => setActiveFieldId(field.id)} className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border-l-4 transition-all relative group ${activeFieldId === field.id ? 'border-l-blue-500 ring-1 ring-blue-500/20' : 'border-l-transparent hover:border-l-slate-300'}`}>
                                
                                {activeFieldId === field.id ? (
                                    // Edit Mode
                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <div className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-md px-3 py-2 border-b-2 border-slate-300 focus-within:border-blue-600 transition-colors">
                                                <input 
                                                    value={field.label} 
                                                    onChange={e => updateField(field.id, { label: e.target.value })}
                                                    className="w-full bg-transparent outline-none text-slate-800 dark:text-white font-medium" 
                                                    placeholder="السؤال"
                                                />
                                            </div>
                                            <div className="w-48">
                                                <select 
                                                    value={field.type} 
                                                    onChange={e => updateField(field.id, { type: e.target.value as FieldType })}
                                                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-sm outline-none"
                                                >
                                                    <option value="text">إجابة قصيرة</option>
                                                    <option value="textarea">فقرة</option>
                                                    <option value="select">خيارات متعددة</option>
                                                    <option value="checkbox">مربعات اختيار</option>
                                                    <option value="date">تاريخ</option>
                                                    <option value="number">رقم</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Options Editor */}
                                        {(field.type === 'select' || field.type === 'checkbox') && (
                                            <div className="space-y-2 pl-4">
                                                {field.options?.map((opt, optIdx) => (
                                                    <div key={optIdx} className="flex items-center gap-2 group/opt">
                                                        {field.type === 'select' ? <div className="w-4 h-4 rounded-full border-2 border-slate-300"></div> : <div className="w-4 h-4 rounded border-2 border-slate-300"></div>}
                                                        <input 
                                                            value={opt} 
                                                            onChange={e => updateOptionText(field.id, optIdx, e.target.value)}
                                                            className="flex-1 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 outline-none px-1 text-sm text-slate-700 dark:text-slate-300"
                                                        />
                                                        <button onClick={() => removeOption(field.id, optIdx)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover/opt:opacity-100 px-2"><X size={16}/></button>
                                                    </div>
                                                ))}
                                                <div className="flex items-center gap-2 mt-2">
                                                    {field.type === 'select' ? <div className="w-4 h-4 rounded-full border-2 border-slate-300 opacity-50"></div> : <div className="w-4 h-4 rounded border-2 border-slate-300 opacity-50"></div>}
                                                    <button onClick={() => addOptionToField(field.id)} className="text-sm text-slate-500 hover:text-blue-600 font-medium">إضافة خيار</button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end items-center gap-4">
                                            <button onClick={() => removeField(field.id)} className="p-2 text-slate-500 hover:text-red-600 rounded-full hover:bg-slate-100 transition-colors" title="حذف">
                                                <Trash2 size={20} />
                                            </button>
                                            <div className="h-6 w-px bg-slate-200"></div>
                                            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-400">
                                                <span>مطلوب</span>
                                                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${field.required ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${field.required ? '-translate-x-4' : 'translate-x-0'}`} />
                                                </div>
                                                <input type="checkbox" className="hidden" checked={field.required} onChange={e => updateField(field.id, { required: e.target.checked })} />
                                            </label>
                                        </div>
                                    </div>
                                ) : (
                                    // Preview Mode inside Builder
                                    <div className="cursor-pointer">
                                        <h4 className="text-slate-800 dark:text-white font-medium mb-2">{field.label} {field.required && <span className="text-red-500">*</span>}</h4>
                                        {field.type === 'text' && <div className="border-b border-dotted border-slate-300 py-1 w-1/2 text-slate-400 text-sm">نص الإجابة القصيرة</div>}
                                        {field.type === 'textarea' && <div className="border-b border-dotted border-slate-300 py-1 w-full text-slate-400 text-sm">نص الإجابة الطويلة</div>}
                                        {(field.type === 'select' || field.type === 'checkbox') && (
                                            <div className="space-y-1">
                                                {field.options?.map((opt, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-slate-500 text-sm">
                                                        {field.type === 'select' ? <div className="w-4 h-4 rounded-full border border-slate-300"></div> : <div className="w-4 h-4 rounded border border-slate-300"></div>}
                                                        <span>{opt}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Floating Sidebar */}
                    <div className="sticky top-24 bg-white dark:bg-slate-900 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 p-2 flex flex-col gap-2">
                        <button onClick={() => addField('text')} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors group relative" title="إضافة سؤال">
                            <Plus size={24} />
                            <span className="absolute right-12 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity pointer-events-none">إضافة سؤال</span>
                        </button>
                        <button onClick={addGovernorateField} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors group relative" title="قائمة المحافظات">
                            <MapPin size={24} />
                            <span className="absolute right-12 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity pointer-events-none">إضافة محافظات</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- GOOGLE FORMS STYLE FILLER MODAL --- */}
      {showFormFiller && selectedTemplate && (
          <div className="fixed inset-0 z-50 bg-[#f0ebf8] dark:bg-slate-950 overflow-y-auto no-print">
              <div className="min-h-screen py-8 px-4 flex flex-col items-center">
                  <div className="w-full max-w-2xl">
                      {/* Header Image / Strip */}
                      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border-t-[10px] border-indigo-600 p-6 mb-4 border-x border-b border-slate-200 dark:border-slate-800">
                          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{selectedTemplate.title}</h1>
                          <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{selectedTemplate.description}</p>
                          <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-red-600 font-medium">* يشير إلى سؤال مطلوب</div>
                      </div>

                      <div className="space-y-4">
                          {selectedTemplate.fields.map(field => (
                              <div key={field.id} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-800 transition-shadow hover:shadow-md">
                                  <label className="block text-base font-medium text-slate-800 dark:text-slate-200 mb-4">
                                      {field.label} {field.required && <span className="text-red-500">*</span>}
                                  </label>
                                  
                                  {field.type === 'text' && (
                                      <input 
                                          className="w-full border-b border-slate-300 focus:border-indigo-600 outline-none py-2 bg-transparent transition-colors placeholder-slate-400"
                                          placeholder="إجابتك"
                                          onChange={e => setFormAnswers({...formAnswers, [field.id]: e.target.value})}
                                      />
                                  )}
                                  
                                  {field.type === 'textarea' && (
                                      <textarea 
                                          className="w-full border-b border-slate-300 focus:border-indigo-600 outline-none py-2 bg-transparent transition-colors placeholder-slate-400 resize-none h-10 focus:h-24"
                                          placeholder="إجابتك"
                                          onChange={e => setFormAnswers({...formAnswers, [field.id]: e.target.value})}
                                      />
                                  )}

                                  {(field.type === 'select' || field.type === 'checkbox') && (
                                      <div className="space-y-3">
                                          {field.options?.map((opt, i) => (
                                              <label key={i} className="flex items-center gap-3 cursor-pointer group">
                                                  {field.type === 'select' ? (
                                                      <>
                                                        <input 
                                                            type="radio" 
                                                            name={field.id} 
                                                            value={opt} 
                                                            className="w-5 h-5 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                            onChange={e => setFormAnswers({...formAnswers, [field.id]: e.target.value})}
                                                        />
                                                        <span className="text-slate-700 dark:text-slate-300 group-hover:text-black dark:group-hover:text-white">{opt}</span>
                                                      </>
                                                  ) : (
                                                      <>
                                                        <input 
                                                            type="checkbox" 
                                                            value={opt} 
                                                            className="w-5 h-5 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                                            onChange={e => {
                                                                const current = (formAnswers[field.id] as string[]) || [];
                                                                if(e.target.checked) setFormAnswers({...formAnswers, [field.id]: [...current, opt]});
                                                                else setFormAnswers({...formAnswers, [field.id]: current.filter((x:string) => x !== opt)});
                                                            }}
                                                        />
                                                        <span className="text-slate-700 dark:text-slate-300 group-hover:text-black dark:group-hover:text-white">{opt}</span>
                                                      </>
                                                  )}
                                              </label>
                                          ))}
                                      </div>
                                  )}

                                  {field.type === 'date' && (
                                      <input 
                                          type="date"
                                          className="p-2 border border-slate-300 rounded focus:border-indigo-600 outline-none bg-transparent"
                                          onChange={e => setFormAnswers({...formAnswers, [field.id]: e.target.value})}
                                      />
                                  )}
                                  
                                  {field.type === 'number' && (
                                      <input 
                                          type="number"
                                          className="w-full border-b border-slate-300 focus:border-indigo-600 outline-none py-2 bg-transparent transition-colors placeholder-slate-400"
                                          placeholder="رقم"
                                          onChange={e => setFormAnswers({...formAnswers, [field.id]: e.target.value})}
                                      />
                                  )}
                              </div>
                          ))}
                      </div>

                      <div className="flex justify-between items-center mt-6">
                          <button onClick={() => handleSubmitForm(true)} className="bg-indigo-600 text-white px-8 py-2.5 rounded hover:bg-indigo-700 font-bold shadow transition-colors flex items-center gap-2">
                              {isSubmittingForm ? <Loader2 className="animate-spin" /> : 'إرسال'}
                          </button>
                          <button onClick={() => setShowFormFiller(false)} className="text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-2 rounded transition-colors">
                              محو النموذج
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- PROFESSIONAL PRINT PREVIEW --- */}
      {showPrintPreview && printData && (
          <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
              <div className="max-w-[210mm] mx-auto bg-white min-h-screen p-8 md:p-12 print:p-0 print:w-full">
                  {/* Print Controls */}
                  <div className="flex justify-between mb-8 no-print border-b border-slate-100 pb-4 sticky top-0 bg-white z-10">
                      <h2 className="text-xl font-bold text-slate-800">معاينة التقرير</h2>
                      <div className="flex gap-2">
                          <button onClick={() => setShowPrintPreview(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">إغلاق</button>
                          <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700"><Printer size={18}/> طباعة</button>
                      </div>
                  </div>

                  {/* Report Content */}
                  <div className="print-content text-black">
                      {/* Header */}
                      <header className="flex justify-between items-center border-b-2 border-black pb-4 mb-8">
                          <div className="flex items-center gap-4">
                              <TvetaLogo variant="light" size="lg" />
                          </div>
                          <div className="text-left">
                              <h1 className="text-2xl font-black uppercase tracking-wide">نموذج تقرير فني</h1>
                              <p className="text-sm font-bold text-slate-600">{printData.template.title}</p>
                              <div className="text-xs font-mono mt-1">Ref: {Math.floor(Math.random() * 10000)}/2024</div>
                          </div>
                      </header>

                      {/* Meta Data Grid */}
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg mb-8 grid grid-cols-2 gap-4 text-sm print:bg-transparent print:border-black">
                          <div><span className="font-bold text-slate-500 print:text-black">مقدم التقرير:</span> <span className="font-bold">{(printData.meta as Record<string, unknown>).user as string}</span></div>
                          <div><span className="font-bold text-slate-500 print:text-black">تاريخ التقديم:</span> <span className="font-mono">{(printData.meta as Record<string, unknown>).date as string}</span></div>
                          <div><span className="font-bold text-slate-500 print:text-black">النطاق الجغرافي:</span> <span>{(printData.meta as Record<string, unknown>).gov as string}</span></div>
                          <div><span className="font-bold text-slate-500 print:text-black">حالة الاعتماد:</span> <span>معتمد</span></div>
                      </div>

                      {/* Content Table Style */}
                      <div className="space-y-6">
                          {printData.template.fields.map((field, idx) => (
                              <div key={idx} className="break-inside-avoid">
                                  <div className="font-bold text-lg mb-1 border-l-4 border-slate-300 pl-2 print:border-black">{idx + 1}. {field.label}</div>
                                  <div className="bg-slate-50/50 p-3 rounded text-slate-800 print:bg-transparent print:p-1 print:pl-4 print:text-black">
                                      {Array.isArray(printData.answers[field.id]) 
                                        ? (printData.answers[field.id] as string[]).join(', ') 
                                        : (printData.answers[field.id] as string || '---')}
                                  </div>
                              </div>
                          ))}
                      </div>

                      {/* Footer Signature */}
                      <div className="mt-16 pt-8 border-t border-slate-300 print:border-black flex justify-between break-inside-avoid">
                          <div className="text-center w-1/3">
                              <p className="font-bold text-sm mb-12">توقيع المراجع</p>
                              <div className="border-t border-dashed border-slate-400 print:border-black w-3/4 mx-auto"></div>
                          </div>
                          <div className="text-center w-1/3">
                              <p className="font-bold text-sm mb-12">اعتماد مدير القطاع</p>
                              <div className="border-t border-dashed border-slate-400 print:border-black w-3/4 mx-auto"></div>
                          </div>
                      </div>
                      
                      <div className="text-center mt-8 text-[10px] text-slate-400 print:text-black">
                          تم استخراج هذا المستند إلكترونياً من نظام TVETA للجودة بتاريخ {new Date().toLocaleDateString('ar-EG')}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Upload Modal (Existing) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm fade-in no-print">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl p-8 relative">
               <button onClick={() => setShowUploadModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"><X size={24} /></button>
               <form onSubmit={handleUpload} className="space-y-4 pt-4">
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-4">إدراج ملف جديد</h3>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl flex items-center gap-2 text-indigo-700 dark:text-indigo-300 text-sm mb-2">
                       <HardDriveUpload size={18} />
                       <span className="font-bold">سيتم الحفظ تلقائياً في Google Drive (TVETA Folder)</span>
                  </div>
                  <input required value={uploadData.title} onChange={e => setUploadData({...uploadData, title: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none" placeholder="عنوان التقرير" />
                  <select required value={uploadData.governorate} onChange={e => setUploadData({...uploadData, governorate: e.target.value})} className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none">
                     <option value="">اختر المحافظة...</option>
                     {EGYPT_GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50">
                      <span className="text-sm text-slate-500">{selectedFile ? selectedFile.name : 'اضغط لاختيار ملف'}</span>
                      <input type="file" className="hidden" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                  </label>
                  
                  {/* Smart Fill Trigger */}
                  {selectedFile && selectedFile.type.startsWith('image/') && (
                      <button 
                        type="button" 
                        onClick={handleSmartFill} 
                        disabled={isAnalyzing}
                        className="w-full py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 text-sm hover:opacity-90"
                      >
                          {isAnalyzing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                          تحليل البيانات تلقائياً بالذكاء الاصطناعي
                      </button>
                  )}

                  {uploadProgress !== null && <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600 transition-all" style={{width: `${uploadProgress}%`}}></div></div>}
                  <button type="submit" disabled={!selectedFile || uploadProgress !== null} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">حفظ وأرشفة</button>
               </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Reports;

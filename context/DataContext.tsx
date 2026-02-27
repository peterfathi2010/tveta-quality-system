
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useState, useEffect, ReactNode, useMemo, useRef, useCallback } from 'react';
import { 
  Visit, Auditor, ReportDocument, SupportMember, QualityOfficer, Template, EvaluationTemplate, EvaluationSubmission, DynamicFormTemplate, DynamicFormSubmission, AggregatedReport
} from '../types';
import { db } from '../services/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { batchImportToFirestore } from '../services/backupService';
import { SUPPORT_TEAM, QUALITY_OFFICERS } from '../constants';

interface DataActions {
  saveVisit: (visit: Visit) => Promise<void>;
  deleteVisit: (id: string) => Promise<void>;
  saveAuditor: (auditor: Auditor) => Promise<void>;
  deleteAuditor: (id: string) => Promise<void>;
  saveReport: (report: ReportDocument) => Promise<void>;
  deleteReport: (id: string) => Promise<void>; 
  saveSupportMember: (member: SupportMember) => Promise<void>;
  deleteSupportMember: (id: number) => Promise<void>;
  saveOfficer: (officer: QualityOfficer) => Promise<void>;
  deleteOfficer: (id: number) => Promise<void>;
  saveFormTemplate: (form: DynamicFormTemplate) => Promise<void>;
  saveFormSubmission: (submission: DynamicFormSubmission) => Promise<void>;
  importData: (collectionName: string, data: Record<string, unknown>[]) => Promise<void>;
}

export interface DataContextType {
  visits: Visit[];
  auditors: Auditor[];
  reports: ReportDocument[];
  supportMembers: SupportMember[];
  officers: QualityOfficer[];
  templates: Template[];
  setTemplates: React.Dispatch<React.SetStateAction<Template[]>>;
  evalTemplates: EvaluationTemplate[];
  evalSubmissions: EvaluationSubmission[];
  dynamicForms: DynamicFormTemplate[];
  dynamicSubmissions: DynamicFormSubmission[];
  aggregatedReports: AggregatedReport[];
  lastSaved: Date;
  isSyncing: boolean;
  permissionError: string | null;
  actions: DataActions;
}

export const DataContext = createContext<DataContextType | undefined>(undefined);

// System Defaults (Can be moved to DB later)
const INITIAL_TEMPLATES: Template[] = [
    { id: '1', name: 'استمارة تقييم مدرب', description: 'نموذج لتقييم أداء المدربين داخل القاعات التدريبية.', fileName: 'trainer_eval_v1.docx' },
    { id: '2', name: 'استمارة تقييم مكان التدريب', description: 'نموذج للتأكد من جاهزية وكفاءة قاعات التدريب.', fileName: 'venue_check.docx' },
    { id: '3', name: 'استمارة متابعة العملية التدريبية', description: 'تقرير دوري لمتابعة سير العمل أثناء التدريب.', fileName: 'process_followup.pdf' },
    { id: '4', name: 'نموذج تقرير زيارة ميدانية', description: 'نموذج رسمي لتوثيق الزيارات الميدانية للمراكز.', fileName: 'visit_report.docx' }
];

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Sync state tracking
  const [isSyncing, setIsSyncing] = useState(true); // Default true to show loading initially
  const [lastSaved, setLastSaved] = useState(new Date());
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // App State - Initialize with constants to ensure data is present even before DB sync or if DB is empty
  const [visits, setVisits] = useState<Visit[]>([]);
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [reports, setReports] = useState<ReportDocument[]>([]);
  const [supportMembers, setSupportMembers] = useState<SupportMember[]>(SUPPORT_TEAM);
  const [officers, setOfficers] = useState<QualityOfficer[]>(QUALITY_OFFICERS);
  const [dynamicForms, setDynamicForms] = useState<DynamicFormTemplate[]>([]);
  const [dynamicSubmissions, setDynamicSubmissions] = useState<DynamicFormSubmission[]>([]);
  
  // Non-persisted or less critical states
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES);
  const [evalTemplates] = useState<EvaluationTemplate[]>([]);
  const [evalSubmissions] = useState<EvaluationSubmission[]>([]);
  const [aggregatedReports] = useState<AggregatedReport[]>([]);

  // Track loading of each collection
  const loadingStatus = useRef({
    visits: true,
    auditors: true,
    reports: true,
    support: true,
    officers: true,
    forms: true,
    submissions: true
  });

  const checkLoading = () => {
    const stillLoading = Object.values(loadingStatus.current).some(s => s);
    setIsSyncing(stillLoading);
  };

  // Generic Subscribe Function
  const subscribe = useCallback(<T,>(collectionName: string, setter: React.Dispatch<React.SetStateAction<T[]>>, orderByField?: string) => {
    if (!db) {
        setPermissionError("قاعدة البيانات غير متصلة. يرجى التحقق من إعدادات Firebase.");
        setIsSyncing(false);
        return () => {};
    }
    const q = query(collection(db, collectionName));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data: T[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as unknown as T);
      });
      
      if (orderByField && data.length > 0) {
         if (orderByField === 'date' || orderByField === 'createdAt' || orderByField === 'submittedAt') {
             data.sort((a, b) => new Date((b as any)[orderByField]).getTime() - new Date((a as any)[orderByField]).getTime());
         }
      }

      if (data.length > 0 || (collectionName !== 'support' && collectionName !== 'officers')) {
         setter(data);
      }
      
      setLastSaved(new Date());
      setPermissionError(null); // Clear error on success
      
      const key = collectionName === 'dynamicForms' ? 'forms' : (collectionName === 'dynamicSubmissions' ? 'submissions' : collectionName);
      // @ts-expect-error - dynamic keys
      loadingStatus.current[key] = false;
      checkLoading();

    }, (error) => {
      if (error.code === 'permission-denied') {
        setPermissionError("خطأ في الصلاحيات: يرجى التأكد من إعداد قواعد الحماية (Security Rules) في Firebase Console.");
      } else {
        console.error(`Error syncing ${collectionName}:`, error);
      }

      const key = collectionName === 'dynamicForms' ? 'forms' : (collectionName === 'dynamicSubmissions' ? 'submissions' : collectionName);
      // @ts-expect-error - dynamic keys
      loadingStatus.current[key] = false;
      checkLoading();
    });
    return unsubscribe;
  }, []);

  // Real-time Listeners
  useEffect(() => {
    const unsubVisits = subscribe('visits', setVisits, 'date');
    const unsubAuditors = subscribe('auditors', setAuditors);
    const unsubReports = subscribe('reports', setReports, 'date');
    const unsubSupport = subscribe('support', setSupportMembers);
    const unsubOfficers = subscribe('officers', setOfficers);
    const unsubForms = subscribe('dynamicForms', setDynamicForms, 'createdAt');
    const unsubSubmissions = subscribe('dynamicSubmissions', setDynamicSubmissions, 'submittedAt');

    return () => {
      unsubVisits();
      unsubAuditors();
      unsubReports();
      unsubSupport();
      unsubOfficers();
      unsubForms();
      unsubSubmissions();
    };
  }, [subscribe]);

  // --- Actions (Direct Firestore CRUD) ---
  // Memoized actions to prevent re-creation on every render
  const actions: DataActions = useMemo(() => ({
    saveVisit: async (visit: Visit) => {
      if (!db) return;
      setIsSyncing(true);
      try {
        const cleanData = JSON.parse(JSON.stringify(visit));
        await setDoc(doc(db, 'visits', visit.id), cleanData);
      } catch (error) {
        console.error("Error saving visit:", error);
        // @ts-expect-error - error type is unknown
        alert(`فشل الحفظ: ${error.message || 'خطأ غير معروف'}`);
      } finally {
        setIsSyncing(false);
      }
    },
    deleteVisit: async (id: string) => {
      if (!db) return;
      setIsSyncing(true);
      await deleteDoc(doc(db, 'visits', id));
      setIsSyncing(false);
    },
    saveAuditor: async (auditor: Auditor) => {
        if (!db) return;
        setIsSyncing(true);
        try {
            const cleanData = JSON.parse(JSON.stringify(auditor));
            await setDoc(doc(db, 'auditors', auditor.id), cleanData);
        } catch (e) { console.error(e); }
        setIsSyncing(false);
    },
    deleteAuditor: async (id: string) => {
        if (!db) return;
        setIsSyncing(true);
        await deleteDoc(doc(db, 'auditors', id));
        setIsSyncing(false);
    },
    saveReport: async (report: ReportDocument) => {
        if (!db) return;
        setIsSyncing(true);
        try {
            const cleanData = JSON.parse(JSON.stringify(report));
            await setDoc(doc(db, 'reports', report.id), cleanData);
        } catch (e) { console.error(e); }
        setIsSyncing(false);
    },
    deleteReport: async (id: string) => {
        if (!db) return;
        setIsSyncing(true);
        try {
            await deleteDoc(doc(db, 'reports', id));
        } catch (e) { console.error(e); alert('فشل حذف التقرير'); }
        setIsSyncing(false);
    },
    saveSupportMember: async (member: SupportMember) => {
         if (!db) return;
         setIsSyncing(true);
         const cleanData = JSON.parse(JSON.stringify(member));
         await setDoc(doc(db, 'support', member.id.toString()), cleanData);
         setIsSyncing(false);
    },
    deleteSupportMember: async (id: number) => {
        if (!db) return;
        setIsSyncing(true);
        await deleteDoc(doc(db, 'support', id.toString()));
        setIsSyncing(false);
    },
    saveOfficer: async (officer: QualityOfficer) => {
        if (!db) return;
        setIsSyncing(true);
        const cleanData = JSON.parse(JSON.stringify(officer));
        await setDoc(doc(db, 'officers', officer.id.toString()), cleanData);
        setIsSyncing(false);
    },
    deleteOfficer: async (id: number) => {
        if (!db) return;
        setIsSyncing(true);
        await deleteDoc(doc(db, 'officers', id.toString()));
        setIsSyncing(false);
    },
    saveFormTemplate: async (form: DynamicFormTemplate) => {
         if (!db) return;
         setIsSyncing(true);
         try {
             const sanitizedForm = JSON.parse(JSON.stringify(form));
             await setDoc(doc(db, 'dynamicForms', form.id), sanitizedForm);
         } catch (e) {
             console.error("Error saving form template:", e);
             throw e;
         } finally {
             setIsSyncing(false);
         }
    },
    saveFormSubmission: async (submission: DynamicFormSubmission) => {
        if (!db) return;
        setIsSyncing(true);
        try {
            const sanitizedSubmission = JSON.parse(JSON.stringify(submission));
            await setDoc(doc(db, 'dynamicSubmissions', submission.id), sanitizedSubmission);
            
            const reportDoc: ReportDocument = {
                id: `smart_report_${submission.id}`,
                title: `تقرير: ${submission.templateId} (مقدم من ${submission.userName})`,
                type: 'Smart Form',
                date: submission.submittedAt.split('T')[0],
                governorate: submission.governorate,
                status: 'Approved',
                auditorId: submission.userId,
                isSmartForm: true,
                smartFormData: submission.answers,
                url: submission.id 
            };
            const sanitizedReport = JSON.parse(JSON.stringify(reportDoc));
            await setDoc(doc(db, 'reports', reportDoc.id), sanitizedReport);
        } catch (e) {
            console.error("Error saving submission", e);
            throw e;
        } finally {
            setIsSyncing(false);
        }
    },
    importData: async (collectionName: string, data: Record<string, unknown>[]) => {
        if (!db) return;
        setIsSyncing(true);
        try {
            await batchImportToFirestore(collectionName, data);
        } catch(e) {
            console.error(e);
            throw e;
        } finally {
            setIsSyncing(false);
        }
    }
  }), []);

  const contextValue = useMemo(() => ({
      visits, auditors, reports, supportMembers, officers, templates, setTemplates,
      evalTemplates, evalSubmissions, dynamicForms, dynamicSubmissions, aggregatedReports,
      lastSaved, isSyncing, permissionError, actions
  }), [
      visits, auditors, reports, supportMembers, officers, templates, 
      evalTemplates, evalSubmissions, dynamicForms, dynamicSubmissions, aggregatedReports,
      lastSaved, isSyncing, permissionError, actions
  ]);

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};



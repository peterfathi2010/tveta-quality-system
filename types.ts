
export enum Sector {
  WestDelta = "غرب الدلتا",
  CanalSinai = "القناة وسيناء",
  CentralDelta = "وسط الدلتا",
  Cairo = "القاهرة",
  UpperEgypt = "الصعيد",
  IT = "مسئول IT",
  WorkshopCoordinator = "منسق ورش العمل"
}

export type Role = 'admin' | 'sector_manager' | 'auditor';

export interface User {
  id: string;
  email: string;
  password?: string; // Added for DB Auth
  name: string;
  role: Role;
  sector?: Sector; // For Managers
  relatedId?: string; // To link User to Auditor/Officer ID
  governorates?: string[]; // Specific governorates allowed for this user
  phone?: string;
  governorate?: string;
  specialization?: string;
  lastSeen?: number;
  createdAt?: string;
}

export interface SupportMember {
  id: number;
  name: string;
  phone: string;
  sector: Sector;
  governorates: string[]; 
}

export interface QualityOfficer {
  id: number;
  name: string;
  phone: string;
  governorate: string;
}

export interface Auditor {
  id: string;
  name: string;
  governorate: string;
  specialization: string;
  status: 'Active' | 'Inactive';
  phone: string;
  rating: number; 
}

export interface VisitAttachment {
  id: string;
  type: 'image' | 'audio' | 'file';
  url: string; // Base64 string or URL
  name?: string; // Filename
  timestamp: string;
}

export interface Visit {
  id: string;
  auditorId: string;
  location: string; 
  date: string;
  status: 'Planned' | 'In Progress' | 'Completed' | 'Cancelled';
  governorate: string;
  // Persisted Progress Fields
  progress?: number; 
  currentStage?: string;
  fieldNotes?: string;
  locationCoords?: { lat: number; lng: number; timestamp: string };
  attachments?: VisitAttachment[];
  linkedReportId?: string; // ID of the smart form submission or uploaded report
}

export interface Template {
  id: string;
  name: string;
  description: string;
  fileName: string;
}

export interface PerformanceReport {
  id: string;
  month: string;
  governorate: string;
  completionRate: number; 
  issuesCount: number;
  notes: string;
}

export interface ReportDocument {
  id: string;
  title: string;
  type: string; 
  date: string;
  governorate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  auditorId?: string; // Linked to the creator
  url?: string; // URL for File or ID for Smart Form
  isSmartForm?: boolean; // Flag to identify smart forms
  smartFormData?: Record<string, unknown>; // The actual data of the smart form
  visitId?: string; // Optional link to a visit
}

// --- New Evaluation System Types ---
export interface EvaluationCriterion {
  id: number;
  text: string;
  maxScore: number;
}

export interface EvaluationTemplate {
  id: string;
  title: string;
  criteria: EvaluationCriterion[];
}

export interface EvaluationSubmission {
  id: string;
  visitId: string;
  templateId: string;
  answers: Record<number, number>; // criterionId -> score given
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  submittedAt: string;
}

// --- Dynamic Forms System (New) ---
export type FieldType = 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[]; // For select type
  defaultValue?: string | number | boolean;
}

export interface DynamicFormTemplate {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  createdAt: string;
}

export interface DynamicFormSubmission {
  id: string;
  templateId: string;
  userId: string;
  userName: string;
  submittedAt: string;
  answers: Record<string, string | number | boolean>; // fieldId -> value
  governorate: string;
  visitId?: string; // Linked visit
}

// --- Aggregated Reports (New Feature) ---
export interface AggregatedReport {
  id: string;
  title: string;
  generatedBy: string;
  generatedAt: string;
  templateName: string;
  period: { start: string; end: string };
  totalSubmissions: number;
  statistics: {
    fieldLabel: string;
    type: FieldType;
    data: Record<string, number> | number; // Distribution for select, Average for number
  }[];
}

// --- Missing Utility Types ---
export enum AuditStatus {
  PLANNED = 'Planned',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  DRAFT = 'Draft'
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

// --- Added Missing Types for Dashboard and Tools ---

export interface KPI {
  totalAudits: number;
  passRate: number;
  openDefects: number;
  averageScore: number;
}

export enum ChecklistItemStatus {
  PASS = 'Pass',
  FAIL = 'Fail',
  NA = 'N/A',
  PENDING = 'Pending'
}

export interface ChecklistItem {
  id: string;
  question: string;
  description?: string;
  category: string;
  status: ChecklistItemStatus;
}

export interface Audit {
  id: string;
  title: string;
  context: string;
  createdAt: string;
  status: AuditStatus;
  items: ChecklistItem[];
  score?: number;
}

export interface Defect {
  id: string;
  auditId: string;
  auditTitle: string;
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'Resolved';
  createdAt: string;
  aiAnalysis?: string;
  aiRecommendation?: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  webViewLink: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
}

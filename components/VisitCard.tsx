
import React, { memo } from 'react';
import { Visit, User } from '../types';
import { Calendar as CalendarIcon, MapPin, CheckCircle, Clock, XCircle, LocateFixed, Share2, Eye, Edit, Trash2, Navigation, Activity } from 'lucide-react';

interface VisitCardProps {
  visit: Visit;
  auditorName: string;
  user: User | null;
  canEdit: boolean;
  canDelete: boolean;
  canUpdateProgress: boolean;
  onShare: (visit: Visit) => void;
  onViewDetails: (visit: Visit) => void;
  onEdit: (visit: Visit) => void;
  onDelete: (id: string) => void;
  onUpdate: (visit: Visit) => void;
}

const getStatusBadge = (status: Visit['status']) => {
  switch (status) {
    case 'Completed': return <span className="flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-100 px-3 py-1 rounded-full text-xs font-medium"><CheckCircle size={14} /> تم التنفيذ</span>;
    case 'Planned': return <span className="flex items-center gap-1.5 text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full text-xs font-medium"><Clock size={14} /> مخطط</span>;
    case 'In Progress': return <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-100 px-3 py-1 rounded-full text-xs font-medium"><Activity size={14} /> جاري التنفيذ</span>;
    case 'Cancelled': return <span className="flex items-center gap-1.5 text-red-700 bg-red-50 border border-red-100 px-3 py-1 rounded-full text-xs font-medium"><XCircle size={14} /> ملغى</span>;
  }
};

const VisitCard: React.FC<VisitCardProps> = memo(({ 
  visit, 
  auditorName, 
  user,
  canEdit, 
  canDelete, 
  canUpdateProgress, 
  onShare, 
  onViewDetails, 
  onEdit, 
  onDelete, 
  onUpdate 
}) => {
  
  // Logic to determine if user can update progress (Admin, Manager, or Assigned Auditor)
  const isAssigned = user && (visit.auditorId === user.id || visit.auditorId === user.relatedId);
  
  // Update allowed if user has permission AND (is Admin OR Manager OR Assigned Auditor)
  const canUpdate = canUpdateProgress && (user?.role === 'admin' || user?.role === 'sector_manager' || isAssigned);

  return (
    <div className="bg-white p-5 rounded-2xl shadow-soft border border-slate-100 hover:border-blue-200 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group relative overflow-hidden">
      <div className="absolute bottom-0 left-0 h-1 bg-slate-100 w-full">
        <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${visit.progress || 0}%` }}></div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
        <div className="flex items-start gap-4">
          <div className="bg-blue-50 text-blue-600 p-3.5 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors no-print">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-lg group-hover:text-blue-700 transition-colors">{visit.location}</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500 mt-1.5">
              <span className="flex items-center gap-1"><MapPin size={14} className="text-slate-400" /> {visit.governorate}</span>
              <span className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded text-xs font-medium text-slate-600">المراجع: {auditorName}</span>
              <span className="flex items-center gap-1"><Clock size={14} className="text-slate-400" /> {visit.date}</span>
            </div>
          </div>
        </div>
        
        <div className="w-full md:w-auto flex flex-row md:flex-col items-center md:items-end justify-between gap-2 pl-2">
          <div className="text-xs font-medium text-slate-400 mb-1">{visit.currentStage} ({visit.progress}%)</div>
          {getStatusBadge(visit.status)}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center no-print">
        <div className="flex items-center gap-2">
            {visit.locationCoords && (
              <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-lg animate-pulse">
                  <LocateFixed size={12} /> تم استلام الموقع
              </span>
            )}
        </div>

        <div className="flex gap-2">
                <button 
                    onClick={() => onShare(visit)}
                    className="flex items-center gap-1 text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg text-sm font-medium transition"
                    title="مشاركة واتساب"
                >
                    <Share2 size={16} />
                </button>

                <button 
                  onClick={() => onViewDetails(visit)}
                  className="flex items-center gap-1 text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-sm font-medium transition"
                  title="عرض التفاصيل"
                >
                  <Eye size={16} />
                </button>
                
                {canEdit && (
                  <button 
                    onClick={() => onEdit(visit)}
                    className="flex items-center gap-1 text-slate-600 hover:text-orange-600 bg-slate-50 hover:bg-orange-50 px-3 py-1.5 rounded-lg text-sm font-medium transition"
                    title="تعديل الزيارة"
                  >
                    <Edit size={16} />
                  </button>
                )}
                
                {canDelete && (
                  <button 
                      onClick={() => onDelete(visit.id)}
                      className="flex items-center gap-1 text-slate-600 hover:text-red-600 bg-slate-50 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-medium transition"
                      title="حذف الزيارة"
                  >
                      <Trash2 size={16} />
                  </button>
                )}
                
                {/* Update Progress Button - Available for Admin, Manager, and Assigned Auditor */}
                {canUpdate && (
                    <button 
                    onClick={() => onUpdate(visit)}
                    className="flex items-center gap-1 text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg text-sm font-bold transition shadow-lg shadow-blue-600/20"
                  >
                    <Navigation size={16} /> تحديث / موقع
                  </button>
                )}
        </div>
      </div>
    </div>
  );
});

export default VisitCard;

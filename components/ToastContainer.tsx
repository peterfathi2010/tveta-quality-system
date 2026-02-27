import React from 'react';
import { useToast, Toast } from '../context/ToastContext';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const ToastMessage: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => {
  const icons = {
    success: <CheckCircle className="text-emerald-500" size={20} />,
    error: <AlertCircle className="text-red-500" size={20} />,
    info: <Info className="text-blue-500" size={20} />,
    warning: <AlertTriangle className="text-amber-500" size={20} />
  };

  const bgColors = {
    success: 'bg-emerald-50 border-emerald-200',
    error: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-amber-50 border-amber-200'
  };

  return (
    <div className={`flex items-start gap-3 p-4 mb-3 rounded-2xl border shadow-lg shadow-slate-200/50 animate-in slide-in-from-bottom-5 fade-in duration-300 ${bgColors[toast.type]}`}>
      <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 text-sm font-medium text-slate-800">{toast.message}</div>
      <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
        <X size={18} />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 left-4 z-[100] max-w-sm w-full flex flex-col-reverse">
      {toasts.map((toast) => (
        <ToastMessage key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

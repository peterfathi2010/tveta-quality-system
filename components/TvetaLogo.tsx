
import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

export const TvetaLogo: React.FC<{ variant?: 'light' | 'dark', size?: 'sm' | 'lg' }> = ({ variant = 'light', size = 'sm' }) => {
  const isDark = variant === 'dark'; // Dark background context (e.g. sidebar)
  const isLg = size === 'lg';
  const [imgError, setImgError] = useState(false);
  
  return (
    <div className="flex items-center gap-3 select-none">
      {/* Logo Container */}
      <div className={`relative flex items-center justify-center overflow-hidden transition-transform duration-300 hover:scale-105 ${isLg ? 'w-24 h-24' : 'w-12 h-12'} rounded-full bg-white shadow-md border-2 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
        {!imgError ? (
            <img 
              src="/logo.png" 
              alt="TVETA Logo" 
              className="w-full h-full object-contain"
              onError={() => setImgError(true)}
            />
        ) : (
            <>
              <ShieldCheck size={isLg ? 32 : 20} className="text-blue-600" strokeWidth={2.5} />
            </>
        )}
      </div>
      
      {/* Text Branding */}
      <div className="flex flex-col">
        <h1 className={`${isLg ? 'text-4xl' : 'text-xl'} font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-800 dark:text-white'}`}>
          TVETA
        </h1>
        <span className={`${isLg ? 'text-sm' : 'text-[9px]'} font-bold uppercase tracking-[0.2em] ${isDark ? 'text-blue-200' : 'text-blue-600 dark:text-blue-400'}`}>
          Quality System
        </span>
      </div>
    </div>
  );
};

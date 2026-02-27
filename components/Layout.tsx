
import React, { useState, useMemo } from 'react';
import { Menu, X, Users, ClipboardCheck, Calendar, UserCheck, Home, FolderOpen, LogOut, User as UserIcon, Settings, ChevronRight, Signal, Database, ShieldCheck, Search as SearchIcon, Bell, HardDrive, Moon, Sun, AlertTriangle } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../hooks/useData';
import { useTheme } from '../hooks/useTheme';
import { SUPPORT_TEAM, SECTOR_GOVERNORATES_MAP } from '../constants';
import { TvetaLogo } from './TvetaLogo';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { lastSaved, isSyncing, permissionError } = useData();
  const { theme, toggleTheme } = useTheme();

  const allNavItems = [
    { name: 'لوحة القيادة', path: '/', icon: Home, roles: ['admin', 'sector_manager', 'auditor'] },
    { name: 'فريق الدعم والمديرين', path: '/support-team', icon: Users, roles: ['admin', 'sector_manager'] }, 
    { name: 'مسؤولي الجودة', path: '/quality-officers', icon: UserCheck, roles: ['admin', 'sector_manager'] }, 
    { name: 'قاعدة المراجعين', path: '/auditors', icon: ClipboardCheck, roles: ['admin', 'sector_manager', 'auditor'] },
    { name: 'الزيارات الميدانية', path: '/visits', icon: Calendar, roles: ['admin', 'sector_manager', 'auditor'] },
    { name: 'الأرشيف والنماذج', path: '/reports', icon: FolderOpen, roles: ['admin', 'sector_manager', 'auditor'] },
    { name: 'مساعد الجودة الذكي', path: '/ai-assistant', icon: ShieldCheck, roles: ['admin', 'sector_manager', 'auditor'] },
    // Admin Only
    { name: 'إدارة Google Drive', path: '/drive', icon: HardDrive, roles: ['admin'] },
    { name: 'النسخ الاحتياطي', path: '/backup', icon: Database, roles: ['admin'] },
  ];

  const navItems = allNavItems.filter(item => item.roles.includes(user?.role || ''));

  const getRoleLabel = (role?: string) => {
    switch(role) {
        case 'admin': return 'مدير النظام (Admin)';
        case 'sector_manager': return 'مسئول قطاع (Manager)';
        case 'auditor': return 'مراجع جودة (Auditor)';
        default: return 'مستخدم';
    }
  };

  const getRoleColor = (role?: string) => {
    switch(role) {
        case 'admin': return 'from-red-500 to-rose-400';
        case 'sector_manager': return 'from-blue-500 to-indigo-400';
        case 'auditor': return 'from-emerald-500 to-teal-400';
        default: return 'from-slate-500 to-gray-400';
    }
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      navigate(`/reports?q=${encodeURIComponent(globalSearch)}`);
      setGlobalSearch('');
    }
  };

  // --- Logic for Print Footer ---
  const managerName = useMemo(() => {
    if (user?.role === 'sector_manager') return user.name;
    // Try to map auditor/admin location to sector manager
    if (user?.governorates && user.governorates.length > 0) {
       // Assume first governorate dictates sector
       const gov = user.governorates[0];
       const sectorEntry = Object.entries(SECTOR_GOVERNORATES_MAP).find(([, govs]) => govs.includes(gov));
       if (sectorEntry) {
          const sectorName = sectorEntry[0];
          const manager = SUPPORT_TEAM.find(m => m.sector === sectorName);
          if (manager) return manager.name;
       }
    }
    return null; // Return null to show dotted line for signature
  }, [user]);

  const printDate = new Date().toLocaleString('ar-EG', { 
    year: 'numeric', month: 'long', day: 'numeric', 
    hour: 'numeric', minute: 'numeric', hour12: true 
  });

  return (
    // Changed min-h-screen to h-screen for better scroll management
    <div className="h-screen bg-[#f1f5f9] dark:bg-slate-950 flex overflow-hidden font-sans transition-colors duration-300">
      
      {/* Backdrop for Mobile */}
      <div 
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ease-in-out ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setIsSidebarOpen(false)} 
      />

      <aside className={`no-print fixed inset-y-0 right-0 z-50 w-80 bg-[#0f172a] text-slate-300 transform transition-transform duration-300 ease-out lg:translate-x-0 lg:static lg:inset-0 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col shadow-2xl border-l border-slate-800`}>
        <div className="flex items-center justify-between px-8 py-8 h-24 bg-slate-900/50">
          <TvetaLogo variant="dark" />
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white transition p-1 bg-white/5 rounded-lg">
            <X size={20} />
          </button>
        </div>
        
        <nav className="px-4 space-y-1.5 flex-1 overflow-y-auto py-6 custom-scrollbar">
          <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 opacity-70">القائمة الرئيسية</p>
          {navItems.map((item, index) => {
             const isActive = location.pathname === item.path;
             const Icon = item.icon;
             return (
              <Link 
                key={item.path} 
                to={item.path} 
                onClick={() => setIsSidebarOpen(false)} 
                className={`group flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 border border-transparent ${isActive ? 'bg-blue-600 shadow-xl shadow-blue-600/30 translate-x-1' : 'hover:bg-slate-800/80 hover:border-slate-700/50 hover:translate-x-1'}`}
                style={{ transitionDelay: `${index * 50}ms` }} // Staggered animation
              >
                <div className="flex items-center gap-4">
                  <span className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-300 ${isActive ? 'bg-white/15 text-cyan-300 shadow-inner' : 'text-slate-400 bg-slate-800/50 group-hover:text-blue-400 group-hover:bg-slate-700'}`}>
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                  </span>
                  <span className={`font-bold text-sm transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                    {item.name}
                  </span>
                </div>
                {isActive && <ChevronRight size={14} className="text-cyan-300/70" />}
              </Link>
            );
          })}
        </nav>

        {/* Sync Status - Neutral Branding (TVETA Server) */}
        <div className="px-8 py-4 mb-2 bg-slate-900/50 border-t border-slate-800/50">
           <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {isSyncing ? (
                  <>
                    <div className="relative">
                      <Signal size={12} className="text-blue-400 animate-pulse" />
                    </div>
                    <span>جاري الاتصال بالخادم...</span>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <Signal size={12} className="text-emerald-500" />
                    </div>
                    <span>TVETA Server Online</span>
                  </>
                )}
              </div>
              <p className="text-[9px] text-slate-600">Last Sync: {lastSaved.toLocaleTimeString('ar-EG')}</p>
           </div>
        </div>

        <div className="p-4 bg-slate-900">
          <div className="bg-slate-800/30 rounded-2xl p-4 border border-slate-800/80">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${getRoleColor(user?.role)} p-[2px] shadow-lg`}>
                 <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center">
                    <UserIcon size={18} className="text-white" />
                 </div>
              </div>
              <div className="overflow-hidden">
                <p className="font-bold text-sm text-white truncate">{user?.name}</p>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{getRoleLabel(user?.role)}</p>
              </div>
            </div>
            <button onClick={logout} className="w-full flex items-center justify-center gap-2 py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white text-xs font-black rounded-xl transition-all border border-rose-500/20 group">
              <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f1f5f9] dark:bg-slate-950 transition-colors">
        <header className="no-print bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm h-16 lg:h-20 flex items-center justify-between px-4 lg:px-8 z-20 border-b border-slate-200 dark:border-slate-800 sticky top-0 transition-all duration-300">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition active:scale-95">
              <Menu size={24} />
            </button>
            <div className="hidden lg:flex flex-col animate-fade-in">
               <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">لوحة التحكم</h2>
               <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">مرحباً بك، {user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <form onSubmit={handleGlobalSearch} className="hidden md:flex relative group">
              <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                 value={globalSearch}
                 onChange={(e) => setGlobalSearch(e.target.value)}
                 className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 pl-4 pr-10 py-2.5 rounded-xl w-64 focus:w-80 transition-all duration-300 outline-none focus:ring-2 focus:ring-blue-500/50 text-sm font-medium placeholder-slate-400" 
                 placeholder="بحث سريع في التقارير..." 
              />
            </form>
            
            <button 
              onClick={toggleTheme}
              className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors hover:scale-105 active:scale-95 border border-transparent dark:border-slate-700"
              title={theme === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
            >
              {theme === 'dark' ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} />}
            </button>

            <button className="relative p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors hover:scale-105 active:scale-95">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></span>
            </button>
            <button className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors hover:scale-105 active:scale-95">
              <Settings size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth relative flex flex-col custom-scrollbar">
           <div className="max-w-7xl mx-auto w-full flex-1">
             {permissionError && (
               <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400 animate-shake no-print">
                 <AlertTriangle size={20} className="shrink-0" />
                 <div className="flex-1">
                   <p className="font-bold text-sm">{permissionError}</p>
                   <p className="text-xs opacity-80 mt-1">هذا الخطأ يمنع مزامنة البيانات مع السحابة. يرجى مراجعة مدير النظام.</p>
                 </div>
               </div>
             )}
             {children}
           </div>

           {/* --- PRINT FOOTER --- */}
           <div className="hidden print:flex flex-row justify-between items-end mt-12 pt-6 border-t-2 border-slate-300 w-full break-inside-avoid">
              <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">مستخرج التقرير</span>
                  <span className="font-black text-slate-900 text-lg">{user?.name}</span>
                  <span className="text-xs text-slate-600 font-medium px-2 py-0.5 bg-slate-100 rounded w-fit">{getRoleLabel(user?.role)}</span>
                  <div className="mt-3 text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    <span>تحريراً في: {printDate}</span>
                  </div>
              </div>
              
              <div className="flex flex-col gap-4 min-w-[250px] text-left">
                  <span className="text-sm font-bold text-slate-800 border-b border-slate-800 pb-1 w-fit ml-auto">اعتماد مسئول القطاع</span>
                  
                  {managerName ? (
                     <div className="font-black text-slate-900 text-lg text-left pl-2">{managerName}</div>
                  ) : (
                     <div className="h-10 border-b border-slate-400 border-dashed w-full mb-2"></div>
                  )}
                  
                  <span className="text-[10px] text-slate-400 text-left">التوقيع / الختم</span>
              </div>
           </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;

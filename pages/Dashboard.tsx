
import React, { useMemo, useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { FolderOpen, Clock, Activity, MapPin, ChevronLeft, UserCircle, TrendingUp, Calendar, Zap, Users, ShieldCheck, HardDrive } from 'lucide-react';
import { useData } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Visit, Auditor, SupportMember, QualityOfficer } from '../types';

type ExtendedMember = (SupportMember | QualityOfficer) & {
    status: string;
    lastLocation: string;
    lastActiveTime: string;
    roleType: string;
    sector?: string;
    specialization?: string;
    governorate?: string;
    governorates?: string[];
};

const StatCard = ({ title, value, icon: Icon, colorClass, subtext, onClick }: { title: string, value: string, icon: React.ElementType, colorClass: string, subtext?: string, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={`bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-soft border border-slate-100 dark:border-slate-800 transition-all duration-300 group relative overflow-hidden ${onClick ? 'cursor-pointer hover:shadow-xl hover:-translate-y-1 hover:border-blue-200 dark:hover:border-blue-700' : ''}`}
  >
    {onClick && <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 dark:text-slate-600"><ChevronLeft size={20} /></div>}
    <div className="flex items-center justify-between relative z-10">
      <div>
        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">{title}</p>
        <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{value}</h3>
        {subtext && <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-medium">{subtext}</p>}
      </div>
      <div className={`p-4 rounded-xl ${colorClass} shadow-lg shadow-current/20 group-hover:scale-110 transition-transform duration-300`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
  </div>
);

const ReviewerPerformance = ({ visits, auditors }: { visits: Visit[], auditors: Auditor[] }) => {
  const performanceData = useMemo(() => {
    const data: Record<string, { total: number, completed: number, cancelled: number, name: string }> = {};
    
    auditors.forEach(a => {
      data[a.id] = { total: 0, completed: 0, cancelled: 0, name: a.name };
    });

    visits.forEach(v => {
      if (data[v.auditorId]) {
        data[v.auditorId].total += 1;
        if (v.status === 'Completed') data[v.auditorId].completed += 1;
        if (v.status === 'Cancelled') data[v.auditorId].cancelled += 1;
      } else {
        const auditorName = auditors.find(a => a.id === v.auditorId)?.name || 'غير معروف';
        data[v.auditorId] = { total: 1, completed: v.status === 'Completed' ? 1 : 0, cancelled: v.status === 'Cancelled' ? 1 : 0, name: auditorName };
      }
    });

    return Object.values(data)
      .filter(d => d.total > 0)
      .map(d => ({
        ...d,
        passRate: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
        failRate: d.total > 0 ? Math.round((d.cancelled / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [visits, auditors]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft border border-slate-100 dark:border-slate-800 overflow-hidden no-print">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Users size={20} className="text-blue-600 dark:text-blue-400" />
            أداء المراجعين
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">ملخص معدلات الإنجاز وعدد المراجعات لكل مراجع</p>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">
            <tr>
              <th className="px-6 py-4 text-right">المراجع</th>
              <th className="px-6 py-4 text-center">إجمالي المراجعات</th>
              <th className="px-6 py-4 text-center">معدل الإنجاز (Pass)</th>
              <th className="px-6 py-4 text-center">معدل الإلغاء (Fail)</th>
              <th className="px-6 py-4 text-left">الأداء العام</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {performanceData.length > 0 ? performanceData.map((reviewer, idx) => (
              <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-700">
                      <UserCircle size={24} />
                    </div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{reviewer.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-center font-black text-slate-700 dark:text-slate-300">
                  {reviewer.total}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {reviewer.passRate}%
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                    {reviewer.failRate}%
                  </span>
                </td>
                <td className="px-6 py-4 text-left">
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden flex">
                    <div style={{ width: `${reviewer.passRate}%` }} className="bg-emerald-500 h-full"></div>
                    <div style={{ width: `${reviewer.failRate}%` }} className="bg-rose-500 h-full"></div>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                  لا توجد بيانات مراجعات متاحة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SupportTeamActivity = ({ members, onManage }: { members: (SupportMember | QualityOfficer)[], onManage: () => void }) => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft border border-slate-100 dark:border-slate-800 overflow-hidden no-print">
     <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
        <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Activity size={20} className="text-blue-600 dark:text-blue-400" />
                نشاط فريق الجودة
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">متابعة حية لحالة الأعضاء والزيارات الأخيرة</p>
        </div>
        <button onClick={onManage} className="text-sm text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 px-4 py-2 rounded-xl transition-colors">عرض الفريق</button>
     </div>
     
     <div className="overflow-x-auto">
        <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">
                <tr>
                    <th className="px-6 py-4 text-right">عضو الفريق</th>
                    <th className="px-6 py-4 text-right">الدور</th>
                    <th className="px-6 py-4 text-right">الحالة</th>
                    <th className="px-6 py-4 text-right">آخر موقع (محافظة)</th>
                    <th className="px-6 py-4 text-right">التوقيت</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {members.length > 0 ? members.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-700">
                                    <UserCircle size={24} />
                                </div>
                                <div>
                                   <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{member.name}</p>
                                   <p className="text-[10px] text-slate-500 dark:text-slate-400">{(member as ExtendedMember).sector || (member as ExtendedMember).specialization || 'عام'}</p>
                                </div>
                            </div>
                        </td>
                         <td className="px-6 py-4">
                            <span className={`text-[10px] px-2 py-1 rounded-lg font-bold ${(member as ExtendedMember).roleType === 'دعم فني' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                                {(member as ExtendedMember).roleType}
                            </span>
                        </td>
                        <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                (member as ExtendedMember).status === 'online' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' :
                                'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                    (member as ExtendedMember).status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                }`}></span>
                                {(member as ExtendedMember).status === 'online' ? 'متصل' : 'غير متصل'}
                            </span>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs font-medium bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg w-fit border border-slate-100 dark:border-slate-700">
                                <MapPin size={12} className="text-blue-500" />
                                {(member as ExtendedMember).lastLocation}
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <div className="text-slate-400 dark:text-slate-500 text-xs flex items-center gap-1 font-mono">
                                <Clock size={12} />
                                {(member as ExtendedMember).lastActiveTime}
                            </div>
                        </td>
                    </tr>
                )) : (
                    <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                            لا يوجد أعضاء نشطين في نطاقك حالياً.
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
     </div>
  </div>
);

const Dashboard: React.FC = () => {
  const { visits, supportMembers, officers, reports, auditors } = useData();
  const { user, systemUsers } = useAuth();
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Update current time every minute to keep online status fresh and pure
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // --- Filtering Logic based on User Role ---
  const { scopedVisits, scopedReports, scopedStaff } = useMemo(() => {
    let v = visits;
    let r = reports;
    let s: (SupportMember | QualityOfficer)[] = [...supportMembers, ...officers]; // Combine lists for activity view

    if (user?.role === 'admin') {
        // Admin sees all
    } else if (user?.role === 'sector_manager' && user?.governorates) {
        // Manager sees data in their governorates
        v = visits.filter(visit => user?.governorates?.includes(visit.governorate));
        r = reports.filter(rep => user?.governorates?.includes(rep.governorate));
        
        // Filter staff
        s = s.filter(member => {
            const m = member as ExtendedMember;
            if (m.sector === user?.sector) return true;
            if (m.governorate && user?.governorates?.includes(m.governorate)) return true;
            return false;
        });

    } else if (user?.role === 'auditor') {
        // Auditor sees their own governorate data
        const userGov = user?.governorate || (user?.governorates && user?.governorates[0]);
        if (userGov) {
            v = visits.filter(visit => visit.governorate === userGov);
            r = reports.filter(rep => rep.governorate === userGov);
            s = s.filter(member => {
                const m = member as ExtendedMember;
                return m.governorate === userGov || m.governorates?.includes(userGov);
            });
        }
    }
    return { scopedVisits: v, scopedReports: r, scopedStaff: s };
  }, [visits, reports, supportMembers, officers, user]);


  // --- Compute Stats (Quality Management KPIs) ---
  const stats = useMemo(() => {
    const total = scopedVisits.length;
    const completed = scopedVisits.filter(v => v.status === 'Completed').length;
    // Updated: Planned now includes In Progress for statistical overview
    const planned = scopedVisits.filter(v => v.status === 'Planned' || v.status === 'In Progress').length;
    const cancelled = scopedVisits.filter(v => v.status === 'Cancelled').length; 
    
    const compliance = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Quality Color Logic
    let complianceColor = 'bg-blue-600';
    if (total > 0) {
        if (compliance >= 80) complianceColor = 'bg-emerald-500'; // Excellent
        else if (compliance >= 50) complianceColor = 'bg-amber-500'; // Warning
        else complianceColor = 'bg-rose-500'; // Critical
    }

    return { total, completed, planned, cancelled, compliance, complianceColor };
  }, [scopedVisits]);

  // --- Extract Available Years ---
  const availableYears = useMemo(() => {
    const years = new Set<number>(scopedVisits.map(v => new Date(v.date).getFullYear()));
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [scopedVisits]);

  // --- Prepare Chart Data ---
  const chartData = useMemo(() => {
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const counts: Record<string, number> = {};
    months.forEach(m => counts[m] = 0);

    scopedVisits.forEach(v => {
        const d = new Date(v.date);
        if (d.getFullYear() === selectedYear) {
            const mName = d.toLocaleString('ar-EG', { month: 'long' });
            counts[mName] = (counts[mName] || 0) + 1;
        }
    });

    return Object.keys(counts).map(name => ({ name, audits: counts[name] }));
  }, [scopedVisits, selectedYear]);

  const pieData = [
    { name: 'تم التنفيذ', value: stats.completed, color: '#10b981' },
    { name: 'جاري / مخطط', value: stats.planned, color: '#f59e0b' },
    { name: 'ملغى', value: stats.cancelled, color: '#ef4444' },
  ].filter(d => d.value > 0);

  // --- Activity Logic (Real-time Online Status) ---
  const activityList = useMemo(() => {
    const now = currentTime;
    // 1. Create a Lookup Map for Auditors -> Last Visit (O(N) complexity)
    // Map key: auditorId, value: Visit object (latest one)
    const latestVisitsMap = new Map<string, Visit>();
    
    // Helper to get name from ID if needed
    const getAuditorIdByName = (name: string) => auditors.find(a => a.name === name)?.id;

    visits.forEach(v => {
        const existing = latestVisitsMap.get(v.auditorId);
        if (!existing || new Date(v.date) > new Date(existing.date)) {
            latestVisitsMap.set(v.auditorId, v);
        }
    });

    // 2. Map scoped staff to status using System Users (from Firestore via AuthContext)
    const FIVE_MINUTES = 5 * 60 * 1000;

    return scopedStaff.slice(0, 10).map(member => {
        // Find matching system user by name or phone (since ID might not match strictly between collections)
        // Ideally ID matches, but we fallback to name for older data
        const sysUser = systemUsers.find(u => u.name === member.name || u.phone === member.phone);
        
        // Status Logic: Check lastSeen timestamp from system user
        let isOnline = false;
        let lastSeenText = 'غير متاح';

        if (sysUser && sysUser.lastSeen) {
            const lastSeenTime = sysUser.lastSeen;
            if ((now - lastSeenTime) < FIVE_MINUTES) {
                isOnline = true;
            } else {
                // If offline, show when they were last seen
                lastSeenText = new Date(lastSeenTime).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'});
            }
        } else {
            // Fallback to Visit Logic if no system user found (legacy behavior)
            // Try finding by explicit ID match or Name match
            let lastVisit = latestVisitsMap.get(String(member.id));
            if (!lastVisit) {
                 const foundId = getAuditorIdByName(member.name);
                 if (foundId) lastVisit = latestVisitsMap.get(foundId);
            }
            if (lastVisit) {
                 const today = new Date().toISOString().split('T')[0];
                 if (lastVisit.date === today && lastVisit.status !== 'Cancelled') isOnline = true;
                 lastSeenText = lastVisit.date;
            }
        }

        const status = isOnline ? 'online' : 'offline';
        const displayTime = isOnline ? 'نشط الآن' : (sysUser ? `آخر ظهور ${lastSeenText}` : lastSeenText);
        
        // Location Logic: Visit Location > Assigned Gov > First Sector Gov
        const m = member as ExtendedMember;
        let lastGov = m.governorate;
        if (!lastGov && m.governorates?.length) {
            lastGov = m.governorates[0];
        }

        return {
            ...member,
            status,
            lastLocation: lastGov || 'المقر المركزي',
            lastActiveTime: displayTime,
            roleType: m.sector ? 'دعم فني' : 'مسؤول جودة'
        };
    });
  }, [scopedStaff, visits, auditors, systemUsers, currentTime]);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print">
        <div className="space-y-1">
           <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
             <ShieldCheck className="text-blue-600" size={36} />
             {user?.role === 'admin' ? 'مركز التحكم الرئيسي' : user?.role === 'sector_manager' ? `إدارة قطاع ${user?.sector || ''}` : `إدارة محافظة ${user?.governorate || ''}`}
           </h2>
           <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">نظام ضمان الجودة - الإصدار الذكي 2026</p>
        </div>
        <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-5 py-3 rounded-2xl shadow-soft border border-slate-100 dark:border-slate-700">
                <Calendar size={18} className="text-blue-500" />
                {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">النظام متصل ومؤمن</span>
            </div>
        </div>
      </div>

      {/* BENTO GRID STATS */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-6 no-print">
        {/* Main KPI - Large */}
        <div className="md:col-span-2 lg:col-span-3 bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl shadow-slate-900/20 group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-blue-600/30 transition-colors"></div>
            <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
                            <TrendingUp size={20} className="text-blue-400" />
                        </div>
                        <span className="text-sm font-bold text-slate-400">مؤشر الإنجاز العام</span>
                    </div>
                    <div className="flex items-baseline gap-4">
                        <h3 className="text-7xl font-black tracking-tighter">{stats.compliance}%</h3>
                        <div className="flex flex-col">
                            <span className="text-emerald-400 font-bold flex items-center gap-1 text-sm">
                                <ChevronLeft size={14} className="rotate-90" />
                                +12%
                            </span>
                            <span className="text-xs text-slate-500">عن الشهر الماضي</span>
                        </div>
                    </div>
                </div>
                <div className="mt-8">
                    <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden mb-3">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${stats.compliance}%` }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                            className="h-full bg-gradient-to-r from-blue-500 to-emerald-400"
                        ></motion.div>
                    </div>
                    <p className="text-xs text-slate-400 font-medium">تم إنجاز {stats.completed} زيارة من أصل {stats.total} مخطط لها</p>
                </div>
            </div>
        </div>

        {/* Secondary Stats */}
        <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <StatCard 
                title="الزيارات المخططة" 
                value={stats.planned.toString()} 
                icon={Clock} 
                colorClass="bg-amber-500" 
                subtext="مهام قيد التنفيذ حالياً"
                onClick={() => navigate('/visits?filter=planned')}
            />
            <StatCard 
                title="الأرشيف السحابي" 
                value={scopedReports.length.toString()} 
                icon={FolderOpen} 
                colorClass="bg-indigo-500" 
                subtext="مستندات مؤمنة في Drive"
                onClick={() => navigate('/reports')}
            />
            <StatCard 
                title="فريق العمل" 
                value={scopedStaff.length.toString()} 
                icon={Users} 
                colorClass="bg-emerald-500" 
                subtext="أعضاء نشطين في النطاق"
                onClick={() => navigate('/support-team')}
            />
            <StatCard 
                title="تنبيهات الجودة" 
                value="3" 
                icon={Zap} 
                colorClass="bg-rose-500" 
                subtext="ملاحظات تحتاج تدخل"
                onClick={() => navigate('/ai-assistant')}
            />
        </div>
      </div>

      {/* QUICK ACTIONS BAR */}
      <div className="flex flex-wrap gap-4 no-print">
          <button onClick={() => navigate('/visits')} className="flex-1 min-w-[150px] flex items-center gap-3 px-6 py-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 hover:border-blue-500 hover:shadow-md transition-all group">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Calendar size={20} />
              </div>
              <span className="font-bold text-slate-700 dark:text-slate-300">جدولة زيارة</span>
          </button>
          <button onClick={() => navigate('/reports?action=upload')} className="flex-1 min-w-[150px] flex items-center gap-3 px-6 py-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 hover:border-indigo-500 hover:shadow-md transition-all group">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <FolderOpen size={20} />
              </div>
              <span className="font-bold text-slate-700 dark:text-slate-300">إدراج ملف</span>
          </button>
          <button onClick={() => navigate('/ai-assistant')} className="flex-1 min-w-[150px] flex items-center gap-3 px-6 py-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 hover:border-amber-500 hover:shadow-md transition-all group">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <Zap size={20} />
              </div>
              <span className="font-bold text-slate-700 dark:text-slate-300">مساعد الجودة</span>
          </button>
          {user?.role === 'admin' && (
            <button onClick={() => navigate('/drive-manager')} className="flex-1 min-w-[150px] flex items-center gap-3 px-6 py-4 bg-slate-800 text-white rounded-2xl shadow-lg hover:bg-slate-700 transition-all group">
                <div className="p-2 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors">
                    <HardDrive size={20} />
                </div>
                <span className="font-bold">مستكشف Drive</span>
            </button>
          )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[32px] shadow-soft border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center mb-8">
            <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">تحليل الأداء الزمني</h3>
                <p className="text-sm text-slate-500">توزيع الزيارات المنفذة على مدار العام</p>
            </div>
            <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 no-print"
            >
                {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                ))}
            </select>
          </div>
          <div className="h-80" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                        <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.8} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#33415515" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 600}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 600}} />
                <Tooltip 
                  cursor={{fill: '#33415505'}} 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', backgroundColor: '#fff'}} 
                />
                <Bar dataKey="audits" fill="url(#barGradient)" radius={[8, 8, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution Chart */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] shadow-soft border border-slate-100 dark:border-slate-800 flex flex-col print:hidden">
          <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">توزيع الحالات</h3>
          <p className="text-sm text-slate-500 mb-8">نسبة إنجاز المهام المسندة</p>
          <div className="flex-1 min-h-[240px] relative">
            {pieData.length > 0 ? (
                <>
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={95} paddingAngle={8} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{stats.total}</span>
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">إجمالي المهام</span>
                </div>
                </>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400">لا توجد بيانات</div>
            )}
          </div>
          <div className="space-y-4 mt-8">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl transition-all hover:scale-[1.02]">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{item.name}</span>
                </div>
                <span className="text-sm font-black text-slate-900 dark:text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ReviewerPerformance visits={scopedVisits} auditors={auditors} />

      <SupportTeamActivity members={activityList} onManage={() => user?.role === 'auditor' ? navigate('/quality-officers') : navigate('/support-team')} />
    </div>
  );
};

export default Dashboard;

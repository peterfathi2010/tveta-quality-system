import React from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { KPI, Audit, AuditStatus } from '../types';
import { CheckCircle2, AlertTriangle, FileText, TrendingUp } from 'lucide-react';

interface DashboardProps {
  kpi: KPI;
  recentAudits: Audit[];
}

const Dashboard: React.FC<DashboardProps> = ({ kpi, recentAudits }) => {
  
  // Prepare chart data from audits
  const trendData = recentAudits
    .filter(a => a.status === AuditStatus.COMPLETED)
    .slice(-7) // Last 7
    .map(a => ({
      name: a.title.substring(0, 10) + '...',
      score: a.score || 0
    }));

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800">Quality Overview</h2>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Total Audits</p>
            <p className="text-2xl font-bold text-slate-800">{kpi.totalAudits}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-green-50 rounded-lg text-green-600">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Avg. Pass Rate</p>
            <p className="text-2xl font-bold text-slate-800">{kpi.passRate}%</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Open Defects</p>
            <p className="text-2xl font-bold text-slate-800">{kpi.openDefects}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Quality Score</p>
            <p className="text-2xl font-bold text-slate-800">{kpi.averageScore}</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Recent Quality Scores</h3>
          <div className="h-64">
             {trendData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={trendData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                   <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                   <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                   <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      itemStyle={{ color: '#3b82f6' }}
                   />
                   <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
                 </LineChart>
               </ResponsiveContainer>
             ) : (
               <div className="h-full flex items-center justify-center text-slate-400">
                 No completed audits yet
               </div>
             )}
          </div>
        </div>

        {/* Recent Activity List */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Recent Audits</h3>
          <div className="space-y-4">
            {recentAudits.slice(0, 4).map(audit => (
              <div key={audit.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors cursor-default">
                <div>
                  <h4 className="font-medium text-slate-700">{audit.title}</h4>
                  <p className="text-xs text-slate-500">{new Date(audit.createdAt).toLocaleDateString()} • {audit.items.length} items</p>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-semibold ${
                  audit.status === AuditStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                  audit.status === AuditStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {audit.status.replace('_', ' ')}
                </div>
              </div>
            ))}
            {recentAudits.length === 0 && (
              <p className="text-center text-slate-400 py-8">No audits created yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useNumberFormat } from '@/context/number-format-context';
import { createClient } from '@/lib/supabase/client';
import { 
  History, 
  Search, 
  RefreshCw, 
  Loader2, 
  Tag 
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'كافة العمليات' },
  { id: 'المبيعات والفواتير', label: 'المبيعات والفواتير' },
  { id: 'المشتريات والموردين', label: 'المشتريات والموردين' },
  { id: 'الخزينة والتحصيلات', label: 'الخزينة والتحصيلات' },
  { id: 'الأجل والعملاء', label: 'الأجل والعملاء' },
  { id: 'الأمان والصلاحيات', label: 'الأمان والصلاحيات' },
  { id: 'عام', label: 'عام وعمليات أخرى' },
];

export default function AuditLogsPage() {
  const { formatNumber } = useNumberFormat();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');

  const fetchLogs = useCallback(async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      let res = await fetch(`/api/admin/audit-log?category=${encodeURIComponent(selectedCategory)}&t=${Date.now()}`);
      if (!res.ok) {
        res = await fetch(`/api/admin/logs?category=${encodeURIComponent(selectedCategory)}&t=${Date.now()}`);
      }
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data || json.logs || []);
      }
    } catch (err) {
      console.error('Fetch Logs Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchLogs();

    // 1. Polling interval every 5 seconds
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 5000);

    // 2. Refresh on window focus
    const onFocus = () => fetchLogs(true);
    window.addEventListener('focus', onFocus);

    // 3. Supabase Realtime channel subscription on audit_logs
    const supabase = createClient();
    const channel = supabase
      .channel('audit-logs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => fetchLogs(true))
      .subscribe();

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      supabase.removeChannel(channel);
    };
  }, [fetchLogs]);

  const filteredLogs = logs.filter(l => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (l.user_name || '').toLowerCase().includes(q) ||
      (l.user_role || '').toLowerCase().includes(q) ||
      (l.action_type || '').toLowerCase().includes(q) ||
      (l.category || '').toLowerCase().includes(q) ||
      (l.details || '').toLowerCase().includes(q)
    );
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <History className="w-8 h-8 text-brand-600 dark:text-emerald-400" />
              <span>سجل حركات النظام والعمليات (Audit Log)</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">تتبع وتدقيق فوري لكافة التعديلات، فواتير البيع والشراء، التحصيلات، وتغييرات الصلاحيات</p>
          </div>
          <button
            onClick={() => fetchLogs(false)}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>تحديث السجل</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-brand-700 dark:bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="بحث في تفاصيل العملية، اسم القائم بالحركة، أو نوع الإجراء..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-white text-base">جدول السجل الزمني الفوري</h2>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{formatNumber(filteredLogs.length)} حركة مسجلة</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-4 whitespace-nowrap">التاريخ والوقت</th>
                  <th className="p-4 whitespace-nowrap">المستخدم والرتبة</th>
                  <th className="p-4 whitespace-nowrap">القسم</th>
                  <th className="p-4 whitespace-nowrap">نوع العملية</th>
                  <th className="p-4 whitespace-nowrap">التفاصيل والتغييرات</th>
                  <th className="p-4 whitespace-nowrap">عنوان IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-500 dark:text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-600 dark:text-emerald-400" />
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-500 dark:text-slate-400 font-medium">
                      لا توجد حركات مسجلة مطابقة للبحث
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => {
                    const isOwner = log.user_role?.includes('Super') || log.user_role?.includes('مالك');
                    const isAdmin = log.user_role?.includes('مدير') || log.user_role?.includes('Admin');

                    return (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                          <span className="block text-[10px] text-slate-400">
                            {new Date(log.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className="font-bold text-slate-900 dark:text-white block text-xs">{log.user_name}</span>
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-0.5 ${
                            isOwner 
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' 
                              : isAdmin 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' 
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {log.user_role}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <Tag className="w-3 h-3" />
                            <span>{log.category || 'عام'}</span>
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className="font-bold text-slate-900 dark:text-white text-xs bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 inline-block">
                            {log.action_type}
                          </span>
                        </td>
                        <td className="p-4 text-xs text-slate-800 dark:text-slate-200 leading-relaxed max-w-md">
                          {log.details}
                        </td>
                        <td className="p-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                          {log.ip_address || '127.0.0.1'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

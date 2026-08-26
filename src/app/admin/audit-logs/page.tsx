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
  Tag, 
  Calendar,
  Filter,
  User,
  ShieldCheck,
  RotateCcw,
  Clock,
  Activity
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'كافة العمليات' },
  { id: 'المبيعات والفواتير', label: 'المبيعات والفواتير' },
  { id: 'المشتريات والموردين', label: 'المشتريات والموردين' },
  { id: 'الخزينة والتحصيلات', label: 'الخزينة والتحصيلات' },
  { id: 'الأجل والعملاء', label: 'الأجل والعملاء' },
  { id: 'الأمان والصلاحيات', label: 'الأمان والصلاحيات' },
  { id: 'عام وعمليات أخرى', label: 'عام وعمليات أخرى' },
];

export default function AuditLogsPage() {
  const { formatNumber } = useNumberFormat();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = useCallback(async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') {
        params.set('category', selectedCategory);
      }
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      params.set('limit', '500');
      params.set('t', Date.now().toString());

      let res = await fetch(`/api/admin/audit-log?${params.toString()}`);
      if (!res.ok) {
        res = await fetch(`/api/admin/logs?${params.toString()}`);
      }
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data || json.logs || []);
      }
    } catch (err) {
      console.error('Fetch Audit Logs Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, startDate, endDate]);

  useEffect(() => {
    fetchLogs();

    // 1. Auto-polling interval every 6 seconds
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 6000);

    // 2. Refresh on window focus
    const onFocus = () => fetchLogs(true);
    window.addEventListener('focus', onFocus);

    // 3. Supabase Realtime channel subscription on audit_logs
    const supabase = createClient();
    const channel = supabase
      .channel('audit-logs-realtime-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => {
        fetchLogs(true);
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      supabase.removeChannel(channel);
    };
  }, [fetchLogs]);

  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSearch('');
    setStartDate('');
    setEndDate('');
  };

  const filteredLogs = logs.filter(l => {
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchesSearch = 
        (l.user_name || '').toLowerCase().includes(q) ||
        (l.user_role || '').toLowerCase().includes(q) ||
        (l.action_type || '').toLowerCase().includes(q) ||
        (l.category || '').toLowerCase().includes(q) ||
        (l.details || '').toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }

    if (startDate) {
      const startMs = new Date(startDate).getTime();
      const logMs = new Date(l.created_at).getTime();
      if (logMs < startMs) return false;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const endMs = end.getTime();
      const logMs = new Date(l.created_at).getTime();
      if (logMs > endMs) return false;
    }

    return true;
  });

  const getCategoryBadgeClass = (category: string) => {
    const cat = String(category || '').trim();
    if (cat.includes('المبيعات') || cat.includes('فواتير')) {
      return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    }
    if (cat.includes('المشتريات') || cat.includes('موردين')) {
      return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
    if (cat.includes('الخزينة') || cat.includes('تحصيلات')) {
      return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    }
    if (cat.includes('الأجل') || cat.includes('عملاء')) {
      return 'bg-orange-50 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800';
    }
    if (cat.includes('الأمان') || cat.includes('صلاحيات')) {
      return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    }
    return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  };

  const getRoleBadgeClass = (role: string) => {
    const r = String(role || '').trim();
    if (r.includes('مالك')) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800';
    }
    if (r.includes('مدير') || r.includes('Admin')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
    if (r.includes('مندوب')) {
      return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800';
    }
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-brand-50 dark:bg-brand-950/60 flex items-center justify-center text-brand-600 dark:text-emerald-400 border border-brand-200 dark:border-brand-800/80 shadow-xs">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>سجل حركات النظام والعمليات (Audit Log)</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
                    مباشر
                  </span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  توثيق فوري لكافة حركات وتعديلات المبيعات، المشتريات، الخزينة، والمستخدمين مع حفظ البيانات
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchLogs(false)}
              disabled={refreshing}
              className="btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              title="تحديث قائمة الحركات فورياً"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>تحديث السجل</span>
            </button>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        <div className="bg-white dark:bg-[#0B132B] rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
          
          {/* Quick Categories Bar */}
          <div>
            <div className="flex items-center gap-2 mb-2.5 text-xs font-bold text-slate-500 dark:text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              <span>تصفية سريعة بالقسم:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-brand-700 dark:bg-emerald-600 text-white shadow-md shadow-brand-700/20 scale-[1.02]'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search and Date Range Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            {/* Search Input */}
            <div className="md:col-span-6 relative">
              <input
                type="text"
                placeholder="بحث شامل بالاسم، نوع العملية، أو تفاصيل الإجراء..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-4 pr-10 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/90 rounded-xl text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-brand-500 shadow-xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            </div>

            {/* Date From */}
            <div className="md:col-span-2.5 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="w-full">
                <span className="block text-[9px] font-bold text-slate-400">من تاريخ:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold font-mono text-slate-900 dark:text-white outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Date To */}
            <div className="md:col-span-2.5 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="w-full">
                <span className="block text-[9px] font-bold text-slate-400">إلى تاريخ:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-transparent text-xs font-bold font-mono text-slate-900 dark:text-white outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Reset Button */}
            <div className="md:col-span-1 flex items-center">
              {(selectedCategory !== 'all' || search || startDate || endDate) && (
                <button
                  onClick={handleResetFilters}
                  className="w-full h-full py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="إعادة ضبط الفلاتر"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">مسح</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Logs Table Card */}
        <div className="bg-white dark:bg-[#0B132B] rounded-3xl shadow-md border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/60 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-600 dark:text-emerald-400" />
              <h2 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">السجل الزمني الفوري للحركات</h2>
            </div>
            <span className="text-xs font-bold font-mono px-3 py-1 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-xs">
              {formatNumber(filteredLogs.length)} حركة مسجلة
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold text-xs border-b border-slate-200 dark:border-slate-700">
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
                    <td colSpan={6} className="p-12 text-center text-slate-500 dark:text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-600 dark:text-emerald-400 mb-2" />
                      <p className="text-xs font-bold">جاري تحميل سجل حركات النظام...</p>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-500 dark:text-slate-400 font-bold text-xs">
                      لا توجد حركات مسجلة مطابقة للبحث المحدد
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map(log => {
                    const roleTitle = log.user_role || 'مدير عام';
                    const userName = log.user_name && log.user_name !== 'المدير العام' ? log.user_name : 'مسؤول الإدارة';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        {/* 1. Date & Time */}
                        <td className="p-4 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <div className="font-bold">
                            {new Date(log.created_at).toLocaleDateString('ar-EG', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                            {new Date(log.created_at).toLocaleTimeString('ar-EG', { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              second: '2-digit',
                              hour12: true 
                            })}
                          </span>
                        </td>

                        {/* 2. Real User Name and Role */}
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="font-extrabold text-slate-900 dark:text-white block text-xs">
                                {userName}
                              </span>
                              <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border mt-0.5 ${getRoleBadgeClass(roleTitle)}`}>
                                {roleTitle}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 3. Category */}
                        <td className="p-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl border ${getCategoryBadgeClass(log.category)}`}>
                            <Tag className="w-3 h-3" />
                            <span>{log.category || 'عام وعمليات أخرى'}</span>
                          </span>
                        </td>

                        {/* 4. Action Type */}
                        <td className="p-4 whitespace-nowrap">
                          <span className="font-bold text-slate-900 dark:text-white text-xs bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 inline-block shadow-2xs">
                            {log.action_type}
                          </span>
                        </td>

                        {/* 5. Details */}
                        <td className="p-4 text-xs text-slate-800 dark:text-slate-200 leading-relaxed max-w-md">
                          <p className="line-clamp-3 sm:line-clamp-none font-medium">
                            {log.details}
                          </p>
                        </td>

                        {/* 6. IP Address */}
                        <td className="p-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px]">
                            {log.ip_address || '127.0.0.1'}
                          </span>
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

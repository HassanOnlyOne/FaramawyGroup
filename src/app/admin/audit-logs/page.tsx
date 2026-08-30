'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useNumberFormat } from '@/context/number-format-context';
import { createClient } from '@/lib/supabase/client';
import { 
  History, 
  Search, 
  RefreshCw, 
  Loader2, 
  Tag, 
  User, 
  Filter, 
  Clock, 
  Activity,
  ChevronDown
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

const TIME_CHIPS = [
  { id: 'all', label: 'الكل' },
  { id: 'today', label: 'اليوم' },
  { id: 'yesterday', label: 'أمس' },
  { id: 'week', label: 'آخر 7 أيام' },
  { id: 'month', label: 'هذا الشهر' },
];

export default function AuditLogsPage() {
  const { formatNumber } = useNumberFormat();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [search, setSearch] = useState('');
  const [displayLimit, setDisplayLimit] = useState(100);

  const fetchLogs = useCallback(async (isBackground = false) => {
    if (!isBackground) setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'all') {
        params.set('category', selectedCategory);
      }
      params.set('limit', '5000');
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
  }, [selectedCategory]);

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
      .channel('audit-logs-realtime-quick')
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

  // Clean, real user names for dropdown filter
  const userOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => {
      let name = (l.user_name || '').trim();
      if (name && !['المدير العام', 'مسؤول الإدارة', 'إدارة النظام'].includes(name)) {
        set.add(name);
      } else if (l.user_email) {
        set.add(l.user_email);
      }
    });
    return Array.from(set);
  }, [logs]);

  // Helper to extract clean actual user name
  const getCleanUserName = (log: any): string => {
    const rawName = (log.user_name || '').trim();
    if (rawName && !['المدير العام', 'مسؤول الإدارة', 'إدارة النظام', 'مدير عام', 'المدير'].includes(rawName)) {
      return rawName;
    }
    if (log.user_email) {
      return log.user_email;
    }
    return rawName || 'مشرف النظام';
  };

  // Filter logs based on category, time chip, user, and search
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endToday = startToday + 86400000;
    const startYesterday = startToday - 86400000;
    const startWeek = now.getTime() - (7 * 86400000);
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return logs.filter(l => {
      const logTime = new Date(l.created_at).getTime();

      // 1. Time Filter Chip
      if (timeFilter === 'today') {
        if (logTime < startToday || logTime >= endToday) return false;
      } else if (timeFilter === 'yesterday') {
        if (logTime < startYesterday || logTime >= startToday) return false;
      } else if (timeFilter === 'week') {
        if (logTime < startWeek) return false;
      } else if (timeFilter === 'month') {
        if (logTime < startMonth) return false;
      }

      // 2. User Filter Dropdown
      if (selectedUser !== 'all') {
        const cleanName = getCleanUserName(l);
        if (cleanName !== selectedUser && l.user_name !== selectedUser) return false;
      }

      // 3. Search Query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesSearch = 
          (l.user_name || '').toLowerCase().includes(q) ||
          (l.action_type || '').toLowerCase().includes(q) ||
          (l.category || '').toLowerCase().includes(q) ||
          (l.details || '').toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [logs, timeFilter, selectedUser, search]);

  const visibleLogs = useMemo(() => {
    return filteredLogs.slice(0, displayLimit);
  }, [filteredLogs, displayLimit]);

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

  return (
    <AdminLayout>
      <div className="space-y-5">
        
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-50 dark:bg-brand-950/60 flex items-center justify-center text-brand-600 dark:text-emerald-400 border border-brand-200 dark:border-brand-800 shadow-xs">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>سجل حركات النظام</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
                    مباشر
                  </span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  توثيق فوري وسريع لكافة العمليات الإدارية والفواتير والتحصيلات
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchLogs(false)}
              disabled={refreshing}
              className="btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs cursor-pointer active:scale-98 transition-transform"
              title="تحديث السجل الآن"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-brand-600 dark:text-emerald-400' : ''}`} />
              <span>تحديث السجل</span>
            </button>
          </div>
        </div>

        {/* 1️⃣ Quick Filters Bar */}
        <div className="bg-white dark:bg-[#0B132B] rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          
          {/* Quick Date Chips + User Selector */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            {/* Quick Date Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 ml-1">
                الفترة:
              </span>
              {TIME_CHIPS.map(chip => {
                const isActive = timeFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    onClick={() => setTimeFilter(chip.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-brand-700 dark:bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Quick User Dropdown */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 shrink-0">
                المستخدم:
              </span>
              <div className="relative w-full md:w-48">
                <select
                  value={selectedUser}
                  onChange={e => setSelectedUser(e.target.value)}
                  className="w-full appearance-none bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-brand-500 cursor-pointer shadow-xs"
                >
                  <option value="all">كل المستخدمين</option>
                  {userOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Quick Categories Bar */}
          <div className="flex items-center gap-1.5 flex-wrap pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 ml-1">
              القسم:
            </span>
            {CATEGORIES.map(cat => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-brand-700 dark:bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Flexible Search Bar */}
          <div className="relative pt-1">
            <input
              type="text"
              placeholder="بحث في تفاصيل العملية، الإجراء، أو اسم القائم بالحركة..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-4 pr-10 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-brand-500 shadow-xs"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
          </div>
        </div>

        {/* 2️⃣ & 3️⃣ Clean Scrollable Table Card */}
        <div className="bg-white dark:bg-[#0B132B] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          
          {/* Card Top Info */}
          <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-600 dark:text-emerald-400" />
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                الجدول الزمني للعمليات
              </span>
            </div>
            <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {formatNumber(filteredLogs.length)} حركة
            </span>
          </div>

          {/* Smooth Scrollable Container with max height */}
          <div className="overflow-x-auto overflow-y-auto max-h-[620px] scrollbar-thin">
            <table className="w-full text-right text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-850/95 backdrop-blur-sm text-slate-700 dark:text-slate-300 font-bold text-xs border-b border-slate-200 dark:border-slate-700 shadow-2xs">
                <tr>
                  <th className="p-3.5 whitespace-nowrap">التاريخ والوقت</th>
                  <th className="p-3.5 whitespace-nowrap">المستخدم</th>
                  <th className="p-3.5 whitespace-nowrap">القسم</th>
                  <th className="p-3.5 whitespace-nowrap">نوع العملية</th>
                  <th className="p-3.5">التفاصيل والتغييرات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-500 dark:text-slate-400">
                      <Loader2 className="w-7 h-7 animate-spin mx-auto text-brand-600 dark:text-emerald-400 mb-2" />
                      <p className="text-xs font-bold">جاري تحميل سجل الحركات...</p>
                    </td>
                  </tr>
                ) : visibleLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-500 dark:text-slate-400 font-bold text-xs">
                      لا توجد حركات مسجلة مطابقة للفلتر المحدد
                    </td>
                  </tr>
                ) : (
                  visibleLogs.map(log => {
                    const cleanName = getCleanUserName(log);

                    return (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        
                        {/* 1. Date & Time */}
                        <td className="p-3.5 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <span className="font-bold block">
                            {new Date(log.created_at).toLocaleDateString('ar-EG', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                            {new Date(log.created_at).toLocaleTimeString('ar-EG', { 
                              hour: '2-digit', 
                              minute: '2-digit', 
                              second: '2-digit',
                              hour12: true 
                            })}
                          </span>
                        </td>

                        {/* 2. Clean User Name Only (No Role Badges / Placeholders) */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-slate-800 flex items-center justify-center text-brand-600 dark:text-emerald-400 border border-brand-100 dark:border-slate-700 shrink-0">
                              <User className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white text-xs">
                              {cleanName}
                            </span>
                          </div>
                        </td>

                        {/* 3. Category */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl border ${getCategoryBadgeClass(log.category)}`}>
                            <Tag className="w-3 h-3" />
                            <span>{log.category || 'عام'}</span>
                          </span>
                        </td>

                        {/* 4. Action Type */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-xs bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 inline-block">
                            {log.action_type}
                          </span>
                        </td>

                        {/* 5. Details */}
                        <td className="p-3.5 text-xs text-slate-800 dark:text-slate-200 leading-relaxed max-w-lg">
                          <p className="font-medium">
                            {log.details}
                          </p>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Load More Button */}
          {filteredLogs.length > displayLimit && (
            <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/60 text-center">
              <button
                onClick={() => setDisplayLimit(prev => prev + 100)}
                className="btn-secondary px-6 py-2 rounded-xl text-xs font-bold shadow-xs hover:border-brand-400 transition-all cursor-pointer"
              >
                تحميل المزيد من الحركات (+100) — المتبقي {filteredLogs.length - displayLimit}
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

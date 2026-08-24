'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CustomerLayout } from '@/components/layout/customer-layout';
import { BRAND } from '@/lib/constants';
import { useNumberFormat } from '@/context/number-format-context';
import { createClient } from '@/lib/supabase/client';
import { 
  User, 
  Store, 
  ShoppingBag, 
  CreditCard, 
  Phone, 
  MapPin, 
  LogOut, 
  ChevronLeft, 
  Clock, 
  CheckCircle2, 
  Headphones, 
  Edit3, 
  Save, 
  Loader2,
  ShieldCheck,
  LogIn,
  UserPlus
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';

export default function AccountPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { formatPriceShort, formatNumber } = useNumberFormat();
  const [profile, setProfile] = useState<any>(null);
  const [creditInfo, setCreditInfo] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit contact details mode
  const [editingDetails, setEditingDetails] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editStoreName, setEditStoreName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  useEffect(() => {
    async function loadAccountData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setProfile(null);
          setLoading(false);
          return;
        }

        const [meRes, creditRes, ordersRes, paymentsRes] = await Promise.all([
          fetch(`/api/auth/me?t=${Date.now()}`),
          fetch(`/api/credit?t=${Date.now()}`),
          fetch(`/api/orders?limit=100&t=${Date.now()}`),
          fetch(`/api/payments?t=${Date.now()}`)
        ]);

        let currentProfile: any = null;
        if (meRes.ok) {
          const userJson = await meRes.json();
          currentProfile = userJson.user || userJson.profile || userJson.data;
        }

        if (!currentProfile) {
          const { data: pDirect } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
          currentProfile = pDirect;
        }

        if (creditRes.ok) {
          const creditJson = await creditRes.json();
          if (creditJson.success) {
            setCreditInfo(creditJson);
            if (!currentProfile && creditJson.profile) {
              currentProfile = creditJson.profile;
            }
          }
        }

        let ordersList: any[] = [];
        if (ordersRes.ok) {
          const ordJson = await ordersRes.json();
          ordersList = ordJson.data || ordJson.orders || [];
        }

        if (ordersList.length === 0) {
          const { data: dbOrders } = await supabase
            .from('orders')
            .select('*')
            .eq('customer_id', user.id)
            .order('created_at', { ascending: false });
          if (dbOrders) ordersList = dbOrders;
        }

        setOrders(ordersList);

        if (currentProfile) {
          setProfile(currentProfile);
          setEditFullName(currentProfile.full_name || currentProfile.name || currentProfile.store_name || '');
          setEditStoreName(currentProfile.store_name || currentProfile.full_name || currentProfile.name || '');
          setEditPhone(currentProfile.phone || '');
          setEditAddress(currentProfile.address || '');
        }
      } catch (error) {
        console.error('Failed to load account:', error);
      } finally {
        setLoading(false);
      }
    }
    loadAccountData();
  }, []);

  const handleLogout = async () => {
    try {
      // 1. Call server logout route
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      
      // 2. Terminate Supabase Auth session
      const supabase = createClient();
      await supabase.auth.signOut();
      
      // 3. Clear local & session storage
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      
      // 4. Hard redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/login';
    }
  };

  const handleSaveContactDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSavingDetails(true);
    try {
      const cleanP = editPhone.trim();
      const egyptianPhoneRegex = /^(010|011|012|015)[0-9]{8}$/;
      if (cleanP && !egyptianPhoneRegex.test(cleanP)) {
        toast({ title: 'رقم الهاتف غير صحيح', description: 'يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015', type: 'error' });
        setSavingDetails(false);
        return;
      }

      const cleanName = editFullName.trim() || editStoreName.trim();
      const cleanStore = editStoreName.trim() || cleanName;
      const cleanAddress = editAddress.trim();

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const targetId = user?.id || profile.id;

      if (targetId) {
        // 1. Update profiles table directly
        const { error: pErr } = await supabase
          .from('profiles')
          .update({
            full_name: cleanName,
            store_name: cleanStore,
            phone: cleanP,
            address: cleanAddress
          })
          .eq('id', targetId);

        if (pErr) {
          console.warn('Profiles update error:', pErr);
        }

        // 2. Update Supabase Auth user_metadata in parallel
        try {
          await supabase.auth.updateUser({
            data: {
              full_name: cleanName,
              store_name: cleanStore,
              phone: cleanP
            }
          });
        } catch (authErr) {
          console.warn('Auth metadata update error:', authErr);
        }

        // 3. Update via server API /api/auth/me
        await fetch('/api/auth/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: cleanName,
            store_name: cleanStore,
            phone: cleanP,
            address: cleanAddress
          })
        }).catch(() => {});
      }

      // 4. Update local state
      setProfile((prev: any) => ({
        ...prev,
        full_name: cleanName,
        store_name: cleanStore,
        phone: cleanP,
        address: cleanAddress
      }));

      setEditingDetails(false);
      toast({ title: 'تم حفظ البيانات بنجاح', description: 'تم تحديث الاسم والبيانات الشخصية في النظام بالكامل', type: 'success' });
      router.refresh();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, type: 'error' });
    } finally {
      setSavingDetails(false);
    }
  };

  const customerCodeClean = profile?.customer_code ? String(profile.customer_code).replace(/\D/g, '') : (profile?.id ? String(profile.id).slice(-4) : '');
  const merchantName = profile?.store_name || profile?.full_name || profile?.name || 'تاجر تجزئة';
  const initialLetter = merchantName.trim().charAt(0) || 'ف';

  const currentDebt = Number(
    profile?.current_debt !== undefined 
      ? profile.current_debt 
      : (creditInfo?.current_debt !== undefined ? creditInfo.current_debt : (profile?.previous_balance !== undefined ? profile.previous_balance : 0))
  );

  const activeOrdersCount = orders.filter(o => ['pending', 'approved', 'delivering', 'out_for_delivery'].includes(o.status)).length;
  const totalOrdersCount = orders.length;

  return (
    <CustomerLayout>
      <div className="space-y-5 sm:space-y-6 pb-28 max-w-3xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4" dir="rtl">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">حساب المتجر والخدمات</h1>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">إدارة بيانات المنشأة، متابعة المديونية والطلبات، والدعم الفني</p>
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
              <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
              <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
            </div>
          </div>
        ) : !profile ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 space-y-5">
            <div className="w-20 h-20 bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-brand-200 dark:border-brand-800">
              <Store className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">أهلاً بك في منصة {BRAND.shortName}</h2>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">يرجى تسجيل الدخول للوصول إلى كشف حساب الأجل، سجل الطلبات، وبيانات منشأتك</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2 max-w-sm mx-auto">
              <Link href="/login" className="btn-primary flex-1 py-3 text-center rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                <LogIn className="w-4 h-4" />
                <span>تسجيل الدخول</span>
              </Link>
              <Link href="/register" className="btn-secondary flex-1 py-3 text-center rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700">
                <UserPlus className="w-4 h-4" />
                <span>حساب تاجر جديد</span>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Merchant Identity Card */}
            <div className="bg-gradient-to-l from-brand-900 via-brand-800 to-brand-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl -translate-x-12 -translate-y-12 pointer-events-none"></div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl font-black text-white shadow-inner">
                    {initialLetter}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black">{merchantName}</h2>
                      {customerCodeClean && (
                        <span className="text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg">
                          كود: #{formatNumber(customerCodeClean)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-mono">{profile.phone || 'غير مسجل'}</span>
                    </p>
                    {profile.address && (
                      <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1.5 line-clamp-1">
                        <MapPin className="w-3.5 h-3.5 text-orange-400" />
                        <span>{profile.address}</span>
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setEditingDetails(!editingDetails)}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 border border-white/20 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{editingDetails ? 'إغلاق التعديل' : 'تعديل البيانات'}</span>
                </button>
              </div>

              {/* Edit Details Inline Form */}
              {editingDetails && (
                <form onSubmit={handleSaveContactDetails} className="mt-5 pt-5 border-t border-white/10 space-y-3 relative z-10">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-900 dark:text-white">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-200 mb-1">الاسم الشخصي / المسؤول</label>
                      <input
                        type="text"
                        required
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        placeholder="مثال: حسن (مالك النظام)"
                        className="w-full p-2.5 bg-white rounded-xl text-xs font-bold text-slate-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-200 mb-1">اسم المتجر / المنشأة</label>
                      <input
                        type="text"
                        required
                        value={editStoreName}
                        onChange={(e) => setEditStoreName(e.target.value)}
                        className="w-full p-2.5 bg-white rounded-xl text-xs font-bold text-slate-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-200 mb-1">رقم الهاتف الأساسي (11 رقم)</label>
                      <input
                        type="tel"
                        maxLength={11}
                        required
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ''))}
                        className="w-full p-2.5 bg-white rounded-xl text-xs font-bold text-slate-900 outline-none font-mono"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-200 mb-1">عنوان التسليم والمحل</label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="المحافظة - المركز - الشارع"
                      className="w-full p-2.5 bg-white rounded-xl text-xs font-bold text-slate-900 outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={savingDetails}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow"
                    >
                      {savingDetails ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>حفظ التعديلات</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Link href="/credit" className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-brand-500 transition-all text-center">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">المديونية المستحقة (الأجل)</p>
                <p className="text-xl font-black text-red-600 dark:text-red-400 font-mono">{formatPriceShort(currentDebt)}</p>
              </Link>

              <Link href="/orders" className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-brand-500 transition-all text-center">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">طلبات قيد التنفيذ</p>
                <p className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">{formatNumber(activeOrdersCount)}</p>
              </Link>

              <Link href="/orders" className="col-span-2 sm:col-span-1 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-brand-500 transition-all text-center">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">إجمالي الفواتير والطلبات</p>
                <p className="text-xl font-black text-slate-800 dark:text-slate-200 font-mono">{formatNumber(totalOrdersCount)}</p>
              </Link>
            </div>

            {/* Account Services Menu */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              <Link href="/orders" className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">سجل الطلبات والتوريدات</h3>
                    <p className="text-xs text-slate-400">متابعة الفواتير السابقة وتتبع الشحنات</p>
                  </div>
                </div>
                <ChevronLeft className="w-5 h-5 text-slate-400" />
              </Link>

              <Link href="/credit" className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">كشف حساب الأجل والمديونية</h3>
                    <p className="text-xs text-slate-400">الحد الائتماني، المسحوبات وسندات السداد النقدي</p>
                  </div>
                </div>
                <ChevronLeft className="w-5 h-5 text-slate-400" />
              </Link>

              <a 
                href={`https://wa.me/2${BRAND.contacts[0]}?text=${encodeURIComponent(`السلام عليكم، أحتاج مساعدة أو استفسار بخصوص متجري (كود: ${customerCodeClean})`)}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-950/60 text-green-600 dark:text-green-400 flex items-center justify-center">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">الدعم الفني وخدمة العملاء</h3>
                    <p className="text-xs text-slate-400">تواصل فوري عبر الواتساب والمكالمات مع مسؤولي المبيعات</p>
                  </div>
                </div>
                <ChevronLeft className="w-5 h-5 text-slate-400" />
              </a>

              {/* Admin Link if role is admin */}
              {['admin', 'owner', 'staff'].includes(profile.role) && (
                <Link href="/admin" className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors bg-purple-50/50 dark:bg-purple-950/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-purple-900 dark:text-purple-300">لوحة تحكم الإدارة (ERP)</h3>
                      <p className="text-xs text-purple-700/70 dark:text-purple-400/70">الانتقال للوحة إدارة المبيعات، المخزون، والعملاء</p>
                    </div>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-purple-600" />
                </Link>
              )}
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/60 text-red-600 dark:text-red-400 font-bold p-4 rounded-2xl border border-red-200 dark:border-red-900/50 flex items-center justify-center gap-2 transition-colors text-sm shadow-sm cursor-pointer"
            >
              <LogOut className="w-5 h-5" />
              <span>تسجيل الخروج من الحساب</span>
            </button>
          </>
        )}
      </div>
    </CustomerLayout>
  );
}

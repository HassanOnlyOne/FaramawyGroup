'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useToast } from '@/components/ui/toast';
import { useNumberFormat } from '@/context/number-format-context';
import { ShieldCheck, ShieldAlert, KeyRound, Users, Check, X, Lock, Save, Loader2, RefreshCw, UserPlus, Mail, Phone, LockKeyhole, Eye, EyeOff, Key, AlertCircle, CheckCircle2 } from 'lucide-react';

const PERMISSION_KEYS = [
  { key: 'orders', label: 'الوصول للطلبات والمبيعات' },
  { key: 'purchases', label: 'الوصول لفواتير المشتريات' },
  { key: 'inventory', label: 'الوصول للمنتجات والمخزون' },
  { key: 'customers', label: 'الوصول للأجل والعملاء' },
  { key: 'suppliers', label: 'الوصول للموردين' },
  { key: 'treasury', label: 'الوصول للمالية والخزينة' },
  { key: 'reports', label: 'الوصول للتقارير وسجل العمليات' },
];

export default function UsersPermissionsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { formatNumber } = useNumberFormat();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Pending Password Reset Requests
  const [pendingResets, setPendingResets] = useState<any[]>([]);

  // New User Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUserData, setNewUserData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'staff',
    permissions: {
      orders: true,
      purchases: false,
      inventory: true,
      customers: true,
      suppliers: false,
      treasury: false,
      reports: false,
    }
  });

  // Reset Password Modal State
  const [resetUser, setResetUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchPendingResets();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users-permissions?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setUsers(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPendingResets() {
    try {
      const res = await fetch(`/api/admin/password-resets?t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setPendingResets(json.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch pending password resets:', err);
    }
  }

  const handleResolveResetRequest = async (requestItem: any) => {
    try {
      await fetch('/api/admin/password-resets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: requestItem.id,
          phone_or_email: requestItem.phone_or_email
        })
      });

      toast({
        title: 'تم تحديث الحالة',
        description: `تم وسم طلب (${requestItem.phone_or_email}) كـ تم الحل`,
        type: 'success'
      });

      // Remove from local banner state
      setPendingResets(prev => prev.filter(r => r.id !== requestItem.id && r.phone_or_email !== requestItem.phone_or_email));

      // Check if user exists in users array and trigger reset password modal
      const matchedUser = users.find(u => 
        (u.phone && u.phone.includes(requestItem.phone_or_email)) ||
        (u.email && u.email.toLowerCase() === requestItem.phone_or_email.toLowerCase())
      );

      if (matchedUser) {
        setResetUser(matchedUser);
        setNewPassword('');
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, type: 'error' });
    }
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      
      let roleLabel = u.role_label;
      let newPermissions = { ...u.permissions };

      if (newRole === 'super_owner') {
        roleLabel = 'مالك النظام (Super Owner)';
        PERMISSION_KEYS.forEach(p => newPermissions[p.key] = true);
      } else if (newRole === 'admin') {
        roleLabel = 'المدير العام (Admin)';
        PERMISSION_KEYS.forEach(p => newPermissions[p.key] = true);
      } else if (newRole === 'delegate') {
        roleLabel = 'مندوب توزيع ومبيعات';
        newPermissions.orders = true;
        newPermissions.inventory = true;
        newPermissions.customers = true;
      } else if (newRole === 'staff') {
        roleLabel = 'موظف / كاشير';
      } else if (newRole === 'customer') {
        roleLabel = 'عميل / تاجر معتمد';
      }

      return {
        ...u,
        role: newRole,
        role_label: roleLabel,
        permissions: newPermissions
      };
    }));
  };

  const handlePermissionToggle = (userId: string, permKey: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id !== userId || u.is_locked) return u;
      return {
        ...u,
        permissions: {
          ...u.permissions,
          [permKey]: !u.permissions?.[permKey]
        }
      };
    }));
  };

  const handleSaveUser = async (user: any) => {
    setSavingId(user.id);
    try {
      const res = await fetch('/api/admin/users/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          id: user.id,
          role: user.role,
          permissions: user.permissions,
          is_credit_enabled: user.is_credit_enabled,
          credit_limit: user.credit_limit
        })
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success === true && json.data) {
        const updatedUser = json.data;
        setUsers(prev => prev.map(u => {
          if (u.id === user.id) {
            let roleLabel = u.role_label;
            if (updatedUser.role === 'super_owner') roleLabel = 'مالك النظام (Super Owner)';
            else if (updatedUser.role === 'admin') roleLabel = 'المدير العام (Admin)';
            else if (updatedUser.role === 'delegate') roleLabel = 'مندوب توزيع ومبيعات';
            else if (updatedUser.role === 'staff') roleLabel = 'موظف / كاشير';
            else if (updatedUser.role === 'customer') roleLabel = 'عميل / تاجر معتمد';

            return {
              ...u,
              ...updatedUser,
              role: updatedUser.role || user.role,
              role_label: roleLabel,
              permissions: updatedUser.permissions || user.permissions
            };
          }
          return u;
        }));

        toast({
          title: 'تم حفظ التعديلات بنجاح',
          description: `تم تحديث رتبة وصلاحيات (${user.full_name}) في قاعدة البيانات`,
          type: 'success'
        });

        router.refresh();
      } else {
        toast({ 
          title: 'فشل حفظ الصلاحيات', 
          description: json.error || 'تعذر حفظ التعديلات في قاعدة البيانات', 
          type: 'error' 
        });
      }
    } catch (err: any) {
      toast({ 
        title: 'خطأ في الاتصال بالسيرفر', 
        description: err.message || 'حدث خطأ أثناء إرسال الطلب', 
        type: 'error' 
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.full_name.trim() || !newUserData.email.trim()) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال الاسم والبريد الإلكتروني', type: 'error' });
      return;
    }

    setCreatingUser(true);
    try {
      const res = await fetch('/api/admin/users-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserData)
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success === true && json.data) {
        toast({ title: 'تم إنشاء المستخدم بنجاح', description: 'تم تفعيل الحساب وحفظ الصلاحيات في النظام', type: 'success' });
        setShowAddModal(false);
        setNewUserData({
          full_name: '',
          email: '',
          phone: '',
          password: '',
          role: 'staff',
          permissions: {
            orders: true,
            purchases: false,
            inventory: true,
            customers: true,
            suppliers: false,
            treasury: false,
            reports: false,
          }
        });
        await fetchUsers();
        router.refresh();
      } else {
        toast({ title: 'خطأ', description: json.error || 'فشل إنشاء المستخدم', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال', description: err.message, type: 'error' });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser || !newPassword || newPassword.length < 6) {
      toast({ title: 'تنبيه', description: 'كلمة المرور يجب أن تكون 6 خانات على الأقل', type: 'error' });
      return;
    }

    setResettingPassword(true);
    try {
      const res = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: resetUser.id,
          newPassword: newPassword
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        toast({
          title: 'تم تحديث كلمة المرور بنجاح',
          description: data.message || `تم تعيين كلمة مرور جديدة للمستخدم (${resetUser.full_name})`,
          type: 'success'
        });
        setResetUser(null);
        setNewPassword('');
      } else {
        toast({
          title: 'خطأ في تحديث كلمة المرور',
          description: data.error || 'فشل تعيين كلمة المرور',
          type: 'error'
        });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال', description: err.message, type: 'error' });
    } finally {
      setResettingPassword(false);
    }
  };

  // Divide users into Staff/Management & Customer groups
  const ADMIN_ROLES = ['admin', 'staff', 'moderator', 'super_owner', 'owner', 'manager', 'delegate'];
  const staffMembers = users.filter(u => ADMIN_ROLES.includes(u.role));
  const customerMembers = users.filter(u => !ADMIN_ROLES.includes(u.role));

  const renderUserRow = (user: any) => {
    const isLocked = user.is_locked;

    return (
      <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
        <td className="p-4 whitespace-nowrap">
          <div className="font-black text-slate-900 dark:text-white text-sm">{user.full_name || user.store_name}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{user.email}</div>
          {user.phone && user.phone !== '---' && (
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">{formatNumber(user.phone)}</div>
          )}
          
          {/* Password Badge & Reset Trigger */}
          <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
            <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              ••••••••
            </span>
            <button
              type="button"
              onClick={() => {
                setResetUser(user);
                setNewPassword('');
                setShowResetPassword(false);
              }}
              className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
              title="تعيين كلمة مرور جديدة لهذا المستخدم"
            >
              <Key className="w-3 h-3" />
              <span>تعيين كلمة مرور جديدة</span>
            </button>
          </div>
        </td>

        <td className="p-4 whitespace-nowrap">
          {isLocked ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 rounded-xl font-bold text-xs border border-purple-300 dark:border-purple-800">
              <Lock className="w-3.5 h-3.5" />
              <span>مالك النظام (Super Owner)</span>
            </div>
          ) : (
            <select
              value={user.role}
              onChange={(e) => handleRoleChange(user.id, e.target.value)}
              className="p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 cursor-pointer"
            >
              <option value="admin">المدير العام (Admin)</option>
              <option value="delegate">مندوب توزيع ومبيعات</option>
              <option value="staff">موظف / كاشير</option>
              <option value="customer">عميل / تاجر معتمد</option>
            </select>
          )}
        </td>

        <td className="p-4">
          <div className="flex flex-wrap gap-2 max-w-xl">
            {PERMISSION_KEYS.map(perm => {
              const isAllowed = Boolean(user.permissions?.[perm.key]);

              return (
                <label
                  key={perm.key}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold cursor-pointer border transition-all ${
                    isAllowed
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 opacity-60'
                  } ${isLocked ? 'cursor-not-allowed opacity-90' : ''}`}
                >
                  <input
                    type="checkbox"
                    disabled={isLocked || user.role === 'admin' || user.role === 'super_owner'}
                    checked={isAllowed}
                    onChange={() => handlePermissionToggle(user.id, perm.key)}
                    className="w-3.5 h-3.5 text-emerald-600 rounded"
                  />
                  <span>{perm.label}</span>
                </label>
              );
            })}
          </div>
        </td>

        <td className="p-4 whitespace-nowrap text-center">
          <button
            onClick={() => handleSaveUser(user)}
            disabled={savingId === user.id || isLocked}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer ${
              isLocked 
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700' 
                : 'btn-primary'
            }`}
          >
            {savingId === user.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>حفظ التعديلات</span>
          </button>
        </td>
      </tr>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-brand-600 dark:text-emerald-400" />
              <span>إدارة الفريق والعملاء والصلاحيات (Team & Permissions)</span>
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">تحديد مستويات الوصول والأدوار الوظيفية وإعادة تعيين كلمات المرور لفريق العمل والعملاء</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة مستخدم جديد</span>
            </button>
            <button
              onClick={() => {
                fetchUsers();
                fetchPendingResets();
              }}
              className="btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </button>
          </div>
        </div>

        {/* Password Reset Alert Banner */}
        {pendingResets.length > 0 && (
          <div className="bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-500/40 p-4 rounded-3xl shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-900 dark:text-rose-200 font-black text-sm sm:text-base">
                <AlertCircle className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>يوجد ({formatNumber(pendingResets.length)}) طلب استرجاع كلمة مرور جديد من الأرقام/البريد التالي:</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {pendingResets.map(req => (
                <div key={req.id || req.phone_or_email} className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-2 shadow-sm">
                  <div>
                    <span className="font-mono font-bold text-xs text-slate-900 dark:text-white block">{req.phone_or_email}</span>
                    <span className="text-[10px] text-slate-400 block">طلب استرجاع معلق</span>
                  </div>
                  <button
                    onClick={() => handleResolveResetRequest(req)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-sm"
                  >
                    تم الحل / تعيين باسورد
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-purple-50/70 dark:bg-purple-950/40 p-5 rounded-3xl border border-purple-200 dark:border-purple-800/60 shadow-sm">
            <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200 font-black text-sm mb-1">
              <Lock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>مالك النظام (Super Owner)</span>
            </div>
            <p className="text-xs text-purple-700 dark:text-purple-300 leading-relaxed">
              صلاحيات كاملة للمالك ومراقبة سجلات الأمان وإدارة المنصة والإعدادات الحساسة.
            </p>
          </div>

          <div className="bg-blue-50/70 dark:bg-blue-950/40 p-5 rounded-3xl border border-blue-200 dark:border-blue-800/60 shadow-sm">
            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-black text-sm mb-1">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>المدير العام (Admin / Manager)</span>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              إدارة العمليات التجارية، فواتير المبيعات والمشتريات، المخزون، والمالية والخزينة.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-sm mb-1">
              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>العملاء والتجار والمناديب</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              صلاحيات مخصصة وتصنيف منفصل لكل فئة في الجدول أدناه مع تحكم كامل بكلمات المرور.
            </p>
          </div>
        </div>

        {/* Unified Table with Visual Separator */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-white text-base">المستخدمون والمصرح لهم بالمنظومة</h2>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{formatNumber(users.length)} إجمالي المسجلين</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-4 whitespace-nowrap">المستخدم والحساب</th>
                  <th className="p-4 whitespace-nowrap">الرتبة والدور الوظيفي</th>
                  <th className="p-4 whitespace-nowrap">الصلاحيات الممنوحة للشاشات</th>
                  <th className="p-4 whitespace-nowrap text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-10 text-center text-slate-500 dark:text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-600 dark:text-emerald-400" />
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* SECTION 1: ADMIN & STAFF TEAM */}
                    <tr className="bg-slate-100/80 dark:bg-slate-800/80">
                      <td colSpan={4} className="px-4 py-2.5 font-black text-xs text-brand-800 dark:text-brand-300 border-y border-slate-200 dark:border-slate-700">
                        الإدارة ({formatNumber(staffMembers.length)})
                      </td>
                    </tr>
                    {staffMembers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400 text-xs">لا يوجد إداريون مسجلون</td>
                      </tr>
                    ) : (
                      staffMembers.map(renderUserRow)
                    )}

                    {/* VISUAL SEPARATOR */}
                    <tr className="bg-slate-200/50 dark:bg-slate-800/50">
                      <td colSpan={4} className="p-0">
                        <div className="border-b-2 border-slate-300 dark:border-slate-700 my-2" />
                      </td>
                    </tr>

                    {/* SECTION 2: CUSTOMERS & MERCHANTS */}
                    <tr className="bg-emerald-50/80 dark:bg-emerald-950/60">
                      <td colSpan={4} className="px-4 py-2.5 font-black text-xs text-emerald-900 dark:text-emerald-300 border-y border-emerald-200 dark:border-emerald-800">
                        العملاء والتجار المعتمدون ({formatNumber(customerMembers.length)})
                      </td>
                    </tr>
                    {customerMembers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-400 text-xs">لا يوجد عملاء مسجلون</td>
                      </tr>
                    ) : (
                      customerMembers.map(renderUserRow)
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reset Password Modal */}
      {resetUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300 dark:border-slate-800 animate-scale-in">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-amber-50 dark:bg-amber-950/40">
              <h3 className="font-bold text-base text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <span>إعادة تعيين كلمة المرور</span>
              </h3>
              <button
                onClick={() => setResetUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  المستخدم
                </label>
                <input
                  type="text"
                  disabled
                  value={`${resetUser.full_name} (${resetUser.email || resetUser.phone})`}
                  className="w-full p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  كلمة المرور الجديدة *
                </label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="كلمة المرور الجديدة (6 خانات+)"
                    className="w-full pr-4 pl-10 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold font-mono outline-none focus:border-amber-500"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none cursor-pointer"
                    title={showResetPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  سيتم تحديث كلمة المرور في قاعدة البيانات وحفظ العملية في سجل الحركات تلقائياً.
                </span>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={resettingPassword || !newPassword || newPassword.length < 6}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-xs shadow transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {resettingPassword ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4" />
                  )}
                  <span>تأكيد تحديث كلمة المرور</span>
                </button>
                <button
                  type="button"
                  onClick={() => setResetUser(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-300 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-brand-50 dark:bg-slate-800">
              <h3 className="font-bold text-base text-brand-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-600 dark:text-emerald-400" />
                <span>إضافة مستخدم جديد</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateNewUser} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">الاسم بالكامل *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أحمد عبد الله"
                    value={newUserData.full_name}
                    onChange={e => setNewUserData({ ...newUserData, full_name: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">رقم الهاتف</label>
                  <input
                    type="tel"
                    placeholder="010XXXXXXXX"
                    dir="ltr"
                    value={newUserData.phone}
                    onChange={e => setNewUserData({ ...newUserData, phone: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">البريد الإلكتروني *</label>
                  <input
                    type="email"
                    required
                    placeholder="user@elfarmawy.com"
                    dir="ltr"
                    value={newUserData.email}
                    onChange={e => setNewUserData({ ...newUserData, email: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">كلمة المرور (اختياري)</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    dir="ltr"
                    value={newUserData.password}
                    onChange={e => setNewUserData({ ...newUserData, password: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">الرتبة والدور الوظيفي *</label>
                <select
                  value={newUserData.role}
                  onChange={e => setNewUserData({ ...newUserData, role: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 cursor-pointer"
                >
                  <option value="admin">مدير عام (Admin)</option>
                  <option value="delegate">مندوب توزيع ومبيعات</option>
                  <option value="staff">موظف / كاشير / مسؤول مخزن</option>
                  <option value="customer">عميل / تاجر معتمد</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">تحديد الشاشات المسموح بالوصول إليها</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                  {PERMISSION_KEYS.map(perm => {
                    const isChecked = Boolean((newUserData.permissions as any)[perm.key]);

                    return (
                      <label key={perm.key} className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => setNewUserData({
                            ...newUserData,
                            permissions: {
                              ...newUserData.permissions,
                              [perm.key]: e.target.checked
                            }
                          })}
                          className="w-3.5 h-3.5 text-emerald-600 rounded"
                        />
                        <span>{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="flex-1 btn-primary py-2.5 rounded-xl font-bold text-xs shadow cursor-pointer"
                >
                  {creatingUser ? 'جاري الإضافة...' : 'إضافة وتفعيل الحساب'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

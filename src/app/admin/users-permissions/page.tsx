'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useToast } from '@/components/ui/toast';
import { useNumberFormat } from '@/context/number-format-context';
import { ShieldCheck, ShieldAlert, KeyRound, Users, Check, X, Lock, Save, Loader2, RefreshCw, UserPlus, Mail, Phone, LockKeyhole } from 'lucide-react';

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
  const { formatNumber } = useNumberFormat();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

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

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users-permissions?t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

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
          [permKey]: !u.permissions[permKey]
        }
      };
    }));
  };

  const handleSaveUser = async (user: any) => {
    setSavingId(user.id);
    try {
      const res = await fetch('/api/admin/users-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          role: user.role,
          role_label: user.role_label,
          permissions: user.permissions
        })
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success !== false) {
        toast({ title: `تم حفظ وتحديث صلاحيات (${user.full_name}) بنجاح`, type: 'success' });
      } else {
        toast({ title: 'خطأ', description: json.error || 'فشل حفظ الصلاحيات', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال بالسيرفر', description: err.message, type: 'error' });
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

      if (res.ok && json.success !== false) {
        toast({ title: 'تم إنشاء المستخدم وإضافته بنجاح', type: 'success' });
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
      } else {
        toast({ title: 'خطأ', description: json.error || 'فشل إنشاء المستخدم', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال', description: err.message, type: 'error' });
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-brand-600 dark:text-emerald-400" />
              إدارة الفريق والصلاحيات (Users & Permissions)
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">تحديد مستويات الوصول والأدوار الوظيفية لفريق العمل والمديرين</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow"
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة مستخدم جديد</span>
            </button>
            <button
              onClick={fetchUsers}
              className="btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </button>
          </div>
        </div>

        {/* General Professional Roles Cards */}
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
              <span>فريق العمل والموظفين (Staff)</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              صلاحيات مخصصة ومحددة حسب طبيعة العمل والمهام عبر مربعات الاختيار في الجدول.
            </p>
          </div>
        </div>

        {/* Users List Table */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-white text-base">المستخدمون المسجلون بالمنظومة</h2>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{formatNumber(users.length)} مستخدمين فعليين</span>
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
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-10 text-center text-slate-500 dark:text-slate-400 font-medium">
                      لا يوجد مستخدمون مسجلون حالياً
                    </td>
                  </tr>
                ) : users.map(user => {
                  const isLocked = user.is_locked;

                  return (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-black text-slate-900 dark:text-white text-sm">{user.full_name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{user.email}</div>
                        {user.phone && user.phone !== '---' && (
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">{formatNumber(user.phone)}</div>
                        )}
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
                            className="p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
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
                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all ${
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
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add New User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-300 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-brand-50 dark:bg-slate-800">
              <h3 className="font-bold text-base text-brand-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-600 dark:text-emerald-400" />
                <span>إضافة مستخدم جديد لفريق العمل</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl font-bold"
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
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="admin">مدير عام (Admin)</option>
                  <option value="delegate">مندوب توزيع ومبيعات</option>
                  <option value="staff">موظف / كاشير / مسؤول مخزن</option>
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
                  className="flex-1 btn-primary py-2.5 rounded-xl font-bold text-xs shadow"
                >
                  {creatingUser ? 'جاري الإضافة...' : 'إضافة وتفعيل الحساب'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary px-4 py-2.5 rounded-xl text-xs font-bold"
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

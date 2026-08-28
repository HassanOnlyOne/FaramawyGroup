'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useToast } from '@/components/ui/toast';
import { useNumberFormat } from '@/context/number-format-context';
import { 
  Truck, 
  Plus, 
  Search, 
  Building, 
  Phone, 
  Loader2, 
  Edit, 
  Trash2, 
  DollarSign, 
  FileText,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  X
} from 'lucide-react';

export default function SuppliersPage() {
  const { toast } = useToast();
  const { formatPriceShort, formatNumber } = useNumberFormat();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editSupplier, setEditSupplier] = useState<any>(null);
  const [paymentSupplier, setPaymentSupplier] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Supplier Statement State
  const [statementSupplier, setStatementSupplier] = useState<any>(null);
  const [statementPurchases, setStatementPurchases] = useState<any[]>([]);
  const [statementPayments, setStatementPayments] = useState<any[]>([]);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementTab, setStatementTab] = useState<'all' | 'purchases' | 'payments'>('all');

  const [newSupplier, setNewSupplier] = useState({
    name: '',
    company: '',
    company_name: '',
    phone: '',
    balance: '0',
    current_balance: '0',
    opening_balance: '0',
    initial_balance: '0',
    notes: ''
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  async function fetchSuppliers() {
    try {
      const res = await fetch(`/api/admin/suppliers?t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        setSuppliers(json.data || json.suppliers || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenStatement = async (supplier: any) => {
    setStatementSupplier(supplier);
    setStatementLoading(true);
    setStatementPurchases([]);
    setStatementPayments([]);
    setStatementTab('all');

    try {
      const res = await fetch(`/api/admin/suppliers?id=${supplier.id}&t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setStatementSupplier(json.supplier || supplier);
          setStatementPurchases(json.purchases || []);
          setStatementPayments(json.payments || []);
        }
      }
    } catch (e) {
      console.error('Error fetching statement:', e);
    } finally {
      setStatementLoading(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    const sName = (newSupplier.name || '').trim();
    const sCompany = (newSupplier.company || newSupplier.company_name || '').trim();

    if (!sName && !sCompany) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال اسم المورد أو اسم الشركة', type: 'error' });
      return;
    }

    const bal = Number(newSupplier.balance || newSupplier.current_balance || newSupplier.opening_balance || newSupplier.initial_balance || 0);

    const supplierData = {
      name: sName || sCompany,
      company: sCompany,
      company_name: sCompany,
      phone: newSupplier.phone ? newSupplier.phone.trim() : '',
      balance: bal,
      current_balance: bal,
      opening_balance: bal,
      initial_balance: bal,
      notes: newSupplier.notes ? newSupplier.notes.trim() : ''
    };

    setFormLoading(true);
    try {
      const res = await fetch('/api/admin/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierData)
      });
      
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success !== false) {
        toast({ title: 'تم تسجيل المورد بنجاح', type: 'success' });
        setShowAddModal(false);
        setNewSupplier({
          name: '',
          company: '',
          company_name: '',
          phone: '',
          balance: '0',
          current_balance: '0',
          opening_balance: '0',
          initial_balance: '0',
          notes: ''
        });
        await fetchSuppliers();
      } else {
        toast({ title: 'خطأ في حفظ المورد', description: data.error || 'فشل تسجيل المورد في النظام', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال بالسيرفر', description: err.message, type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSupplier) return;

    const sName = (editSupplier.name || '').trim();
    const sCompany = (editSupplier.company || editSupplier.company_name || '').trim();
    const bal = Number(editSupplier.balance ?? editSupplier.current_balance ?? editSupplier.opening_balance ?? editSupplier.initial_balance ?? 0);

    const updateData = {
      ...editSupplier,
      name: sName || sCompany,
      company: sCompany,
      company_name: sCompany,
      phone: editSupplier.phone ? editSupplier.phone.trim() : '',
      balance: bal,
      current_balance: bal,
      opening_balance: bal,
      initial_balance: bal,
      notes: editSupplier.notes ? editSupplier.notes.trim() : ''
    };

    setFormLoading(true);
    try {
      const res = await fetch('/api/admin/suppliers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success !== false) {
        toast({ title: 'تم تحديث بيانات المورد بنجاح', type: 'success' });
        setEditSupplier(null);
        await fetchSuppliers();
      } else {
        toast({ title: 'خطأ في تعديل المورد', description: data.error || 'فشل حفظ التعديلات', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال', description: err.message, type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteSupplier = async (supplier: any) => {
    const confirmDelete = window.confirm(`هل أنت متأكد من حذف المورد "${supplier.name || supplier.company_name}"؟`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/admin/suppliers?id=${supplier.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast({ title: 'تم حذف المورد بنجاح', type: 'success' });
        await fetchSuppliers();
      } else {
        toast({ title: 'خطأ في حذف المورد', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال', description: err.message, type: 'error' });
    }
  };

  const handleRecordSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSupplier || !paymentAmount || Number(paymentAmount) <= 0) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال مبلغ صحيح للدفعة', type: 'error' });
      return;
    }

    setFormLoading(true);
    try {
      const res = await fetch('/api/admin/suppliers/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: paymentSupplier.id,
          payment_amount: Number(paymentAmount),
          payment_method: 'كاش نقدي',
          notes: paymentNotes ? `[سداد دفعة للمورد: ${paymentAmount} ج.م] - ${paymentNotes}` : `سداد دفعة نقدية بقيمة ${paymentAmount} ج.م`
        })
      });

      if (res.ok) {
        toast({ title: 'تم تسجيل سداد الدفعة وخصمها من رصيد المورد والخزينة بنجاح', type: 'success' });
        const targetSupplier = paymentSupplier;
        setPaymentSupplier(null);
        setPaymentAmount('');
        setPaymentNotes('');
        await fetchSuppliers();
        if (statementSupplier && statementSupplier.id === targetSupplier.id) {
          handleOpenStatement(targetSupplier);
        }
      } else {
        toast({ title: 'خطأ في تسجيل الدفعة', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال بالسيرفر', description: err.message, type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const safeSuppliers = Array.isArray(suppliers) ? suppliers : [];
  const filtered = safeSuppliers.filter(s =>
    (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.company_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.phone || '').includes(search)
  );

  const totalSupplierDebt = safeSuppliers.reduce((sum, s) => sum + Number(s.current_balance || s.balance || s.current_debt || 0), 0);

  // Statement calculations
  const statementPurchasesTotal = statementPurchases.reduce((sum, p) => sum + Number(p.total || p.total_amount || 0), 0);
  const statementPurchasesPaid = statementPurchases.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0);
  const statementDirectPayments = statementPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const statementTotalPaid = statementPurchasesPaid + statementDirectPayments;
  const statementCurrentBalance = Number(statementSupplier?.current_balance !== undefined && statementSupplier?.current_balance !== null ? statementSupplier.current_balance : (statementSupplier?.balance || 0));

  // Combined statement chronological timeline
  const combinedStatement: any[] = [];

  statementPurchases.forEach(p => {
    combinedStatement.push({
      id: `pur-${p.id}`,
      date: p.created_at,
      type: 'فاتورة توريد',
      ref: p.invoice_no || p.invoice_number || `فاتورة #${String(p.id).slice(0, 6)}`,
      inflowCredit: Number(p.total || p.total_amount || 0), // مستحق للمورد (+)
      outflowDebit: Number(p.paid_amount || 0), // مسدد منه فورياً (-)
      notes: p.notes || `فاتورة توريد بضائع (${p.items?.length || 1} أصناف)`
    });
  });

  statementPayments.forEach(pay => {
    combinedStatement.push({
      id: `pay-${pay.id}`,
      date: pay.payment_date || pay.created_at,
      type: 'سداد دفعة نقدية',
      ref: `سند #${String(pay.id).slice(0, 8)}`,
      inflowCredit: 0,
      outflowDebit: Number(pay.amount || 0), // مسدد للمورد (-)
      notes: pay.notes || 'سداد نقدي لحساب المورد'
    });
  });

  combinedStatement.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">دليل الموردين والشركات</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">تسجيل الموردين والمستوردين، وتتبع الأرصدة، كشوفات الحساب، وسداد الدفعات</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl shadow cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مورد جديد</span>
            </button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي عدد الموردين</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5">{formatNumber(safeSuppliers.length)} مورد</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center font-bold">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي مستحقات الموردين الحالية</span>
              <p className="text-2xl font-black text-red-600 dark:text-red-400 font-mono mt-0.5">{formatPriceShort(totalSupplierDebt)}</p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative">
            <input
              type="text"
              placeholder="البحث باسم المورد، اسم الشركة، أو رقم الهاتف..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none focus:border-brand-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          </div>
        </div>

        {/* Suppliers Table */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-4 whitespace-nowrap">اسم المورد / المسؤول</th>
                  <th className="p-4 whitespace-nowrap">الشركة / المصنع</th>
                  <th className="p-4 whitespace-nowrap">الهاتف</th>
                  <th className="p-4 whitespace-nowrap">الرصيد المستحق (له)</th>
                  <th className="p-4 whitespace-nowrap">ملاحظات</th>
                  <th className="p-4 whitespace-nowrap text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">لا يوجد موردين مسجلون</td></tr>
                ) : (
                  filtered.map(s => {
                    const supDebt = Number(s.current_balance !== undefined && s.current_balance !== null ? s.current_balance : (s.balance !== undefined && s.balance !== null ? s.balance : (s.current_debt || 0)));
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4">
                          <button
                            onClick={() => handleOpenStatement(s)}
                            className="font-bold text-slate-900 dark:text-slate-100 hover:text-brand-600 dark:hover:text-emerald-400 hover:underline text-right block transition-colors cursor-pointer"
                            title="عرض كشف حساب المورد"
                          >
                            {s.name}
                          </button>
                        </td>
                        <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">{s.company_name || '---'}</td>
                        <td className="p-4 font-mono font-medium text-xs" dir="ltr">{formatNumber(s.phone || '---')}</td>
                        <td className="p-4 font-bold text-red-600 dark:text-red-400 font-mono text-base">{formatPriceShort(supDebt)}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-400 text-xs">{s.notes || '---'}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            {/* كشف حساب */}
                            <button
                              onClick={() => handleOpenStatement(s)}
                              className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="عرض كشف حساب وسجل تعاملات المورد"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>كشف حساب</span>
                            </button>

                            {/* سداد دفعة */}
                            <button
                              onClick={() => {
                                setPaymentSupplier(s);
                                setPaymentAmount('');
                                setPaymentNotes('');
                              }}
                              className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="سداد دفعة نقدية للمورد"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>سداد دفعة</span>
                            </button>

                            {/* تعديل */}
                            <button
                              onClick={() => setEditSupplier({ ...s })}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                              title="تعديل بيانات المورد"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            {/* حذف */}
                            <button
                              onClick={() => handleDeleteSupplier(s)}
                              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                              title="حذف المورد"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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

      {/* 3️⃣ Supplier Statement Modal */}
      {statementSupplier && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0B132B] rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold border border-blue-200 dark:border-blue-800">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <span>كشف حساب وسجل تعاملات: {statementSupplier.company_name || statementSupplier.name}</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    المسؤول: {statementSupplier.name} | الهاتف: {statementSupplier.phone || 'غير مسجل'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title="طباعة كشف الحساب"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setStatementSupplier(null)} 
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 scrollbar-thin">
              {statementLoading ? (
                <div className="py-16 text-center text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
                  <p className="text-xs font-bold">جاري جلب تفاصيل فواتير التوريد والسدادات...</p>
                </div>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">إجمالي فواتير التوريد (المشتريات)</span>
                      <p className="text-lg font-black text-slate-900 dark:text-white font-mono mt-1">
                        {formatPriceShort(statementPurchasesTotal)}
                      </p>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">{statementPurchases.length} فاتورة مسجلة</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">إجمالي السدادات والدفعات النقدية</span>
                      <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                        {formatPriceShort(statementTotalPaid)}
                      </p>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">{statementPayments.length} سندات دفع نقدية</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60">
                      <span className="text-[11px] font-bold text-red-700 dark:text-red-300">الرصيد المتبقي المستحق له حالياً</span>
                      <p className="text-xl font-black text-red-600 dark:text-red-400 font-mono mt-1">
                        {formatPriceShort(statementCurrentBalance)}
                      </p>
                      <span className="text-[10px] text-red-500/80 mt-0.5 block font-bold">
                        {statementCurrentBalance > 0 ? 'مبلغ مستحق السداد للمورد' : 'الحساب خالص بالكامل'}
                      </span>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                    <button
                      onClick={() => setStatementTab('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        statementTab === 'all'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      كشف الحساب الزمني المدمج ({combinedStatement.length})
                    </button>
                    <button
                      onClick={() => setStatementTab('purchases')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        statementTab === 'purchases'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      فواتير المشتريات والتوريد ({statementPurchases.length})
                    </button>
                    <button
                      onClick={() => setStatementTab('payments')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        statementTab === 'payments'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      سجل السدادات النقدية ({statementPayments.length})
                    </button>
                  </div>

                  {/* Statement Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    {statementTab === 'all' && (
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="p-3">التاريخ والوقت</th>
                            <th className="p-3">نوع الحركة</th>
                            <th className="p-3">المرجع / الفاتورة</th>
                            <th className="p-3">دائن (+) بضاعة موردة</th>
                            <th className="p-3">مدين (-) مسدد للمورد</th>
                            <th className="p-3">البيان / الملاحظات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {combinedStatement.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-400">لا توجد حركات مسجلة للمورد حتى الآن</td></tr>
                          ) : (
                            combinedStatement.map(it => (
                              <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="p-3 font-mono whitespace-nowrap text-slate-500 dark:text-slate-400">
                                  {new Date(it.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                                  <span className="block text-[10px] text-slate-400 font-mono">
                                    {new Date(it.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </td>
                                <td className="p-3 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                    it.type.includes('فاتورة')
                                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  }`}>
                                    {it.type}
                                  </span>
                                </td>
                                <td className="p-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                  {it.ref}
                                </td>
                                <td className="p-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                  {it.inflowCredit > 0 ? formatPriceShort(it.inflowCredit) : '---'}
                                </td>
                                <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                  {it.outflowDebit > 0 ? formatPriceShort(it.outflowDebit) : '---'}
                                </td>
                                <td className="p-3 text-slate-600 dark:text-slate-300 max-w-xs">
                                  {it.notes}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}

                    {statementTab === 'purchases' && (
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="p-3">التاريخ</th>
                            <th className="p-3">رقم الفاتورة</th>
                            <th className="p-3">إجمالي الفاتورة</th>
                            <th className="p-3">المسدد منها</th>
                            <th className="p-3">المتبقي</th>
                            <th className="p-3">البيان</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {statementPurchases.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-400">لا توجد فواتير توريد مسجلة</td></tr>
                          ) : (
                            statementPurchases.map(p => {
                              const tot = Number(p.total || p.total_amount || 0);
                              const pd = Number(p.paid_amount || 0);
                              const rem = Number(p.remaining_amount !== undefined && p.remaining_amount !== null ? p.remaining_amount : Math.max(0, tot - pd));
                              return (
                                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                  <td className="p-3 font-mono text-slate-500 whitespace-nowrap">
                                    {new Date(p.created_at).toLocaleDateString('ar-EG')}
                                  </td>
                                  <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                                    {p.invoice_no || p.invoice_number || String(p.id).slice(0, 8)}
                                  </td>
                                  <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                                    {formatPriceShort(tot)}
                                  </td>
                                  <td className="p-3 font-mono font-bold text-emerald-600">
                                    {formatPriceShort(pd)}
                                  </td>
                                  <td className="p-3 font-mono font-bold text-red-600">
                                    {formatPriceShort(rem)}
                                  </td>
                                  <td className="p-3 text-slate-600 dark:text-slate-300">
                                    {p.notes || `فاتورة مشتريات (${p.items?.length || 1} أصناف)`}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    )}

                    {statementTab === 'payments' && (
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="p-3">التاريخ والوقت</th>
                            <th className="p-3">رقم السند</th>
                            <th className="p-3">المبلغ المسدد نقداً</th>
                            <th className="p-3">البيان والملاحظات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {statementPayments.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-slate-400">لا توجد سدادات نقدية مسجلة</td></tr>
                          ) : (
                            statementPayments.map(pay => (
                              <tr key={pay.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="p-3 font-mono whitespace-nowrap text-slate-700 dark:text-slate-300">
                                  <span className="font-bold block">
                                    {new Date(pay.created_at || pay.payment_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono block">
                                    {new Date(pay.created_at || pay.payment_date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </td>
                                <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-200 dark:border-slate-700">
                                    {String(pay.id).slice(0, 10)}
                                  </span>
                                </td>
                                <td className="p-3 font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap">
                                  {formatPriceShort(Number(pay.amount || 0))}
                                </td>
                                <td className="p-3 text-slate-600 dark:text-slate-300">
                                  <span>{pay.notes || 'سداد نقدي لحساب المورد'}</span>
                                  {pay.payment_method && (
                                    <span className="mr-2 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] rounded border border-emerald-200 dark:border-emerald-800">
                                      {pay.payment_method}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500">
                الرصيد المستحق للمورد: <strong className="font-mono text-red-600 dark:text-red-400 text-sm">{formatPriceShort(statementCurrentBalance)}</strong>
              </span>
              <button
                onClick={() => setStatementSupplier(null)}
                className="btn-secondary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/60">
              <h3 className="font-bold text-base text-emerald-900 dark:text-emerald-300">إضافة مورد جديد</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl font-bold cursor-pointer">&times;</button>
            </div>
            <form onSubmit={handleCreateSupplier} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">اسم المورد / المسؤول *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أحمد عبد الله"
                  value={newSupplier.name}
                  onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">اسم الشركة / المصنع المورد</label>
                <input
                  type="text"
                  placeholder="مثال: مصنع الأهرام للزيوت / شركة الفيروز"
                  value={newSupplier.company_name || newSupplier.company}
                  onChange={e => setNewSupplier({ ...newSupplier, company: e.target.value, company_name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">رقم الهاتف للتواصل</label>
                <input
                  type="tel"
                  placeholder="مثال: 01012345678"
                  value={newSupplier.phone}
                  onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold font-mono focus:outline-none focus:border-emerald-500"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">الرصيد الافتتاحي المستحق له (ج.م)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={newSupplier.balance}
                  onChange={e => setNewSupplier({ 
                    ...newSupplier, 
                    balance: e.target.value, 
                    current_balance: e.target.value, 
                    opening_balance: e.target.value, 
                    initial_balance: e.target.value 
                  })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">ملاحظات إضافية</label>
                <textarea
                  rows={2}
                  placeholder="أي تفاصيل عن المنتجات الموردة أو شروط السداد..."
                  value={newSupplier.notes}
                  onChange={e => setNewSupplier({ ...newSupplier, notes: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                ></textarea>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 btn-primary py-2.5 rounded-xl font-bold shadow text-xs cursor-pointer"
                >
                  {formLoading ? 'جاري الحفظ...' : 'تسجيل المورد'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {editSupplier && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-blue-50 dark:bg-blue-950/60">
              <h3 className="font-bold text-base text-blue-900 dark:text-blue-300">تعديل بيانات المورد</h3>
              <button onClick={() => setEditSupplier(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl font-bold cursor-pointer">&times;</button>
            </div>
            <form onSubmit={handleUpdateSupplier} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">اسم المورد / المسؤول *</label>
                <input
                  type="text"
                  required
                  value={editSupplier.name || ''}
                  onChange={e => setEditSupplier({ ...editSupplier, name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">اسم الشركة / المصنع</label>
                <input
                  type="text"
                  value={editSupplier.company_name || editSupplier.company || ''}
                  onChange={e => setEditSupplier({ ...editSupplier, company: e.target.value, company_name: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">الهاتف</label>
                <input
                  type="tel"
                  value={editSupplier.phone || ''}
                  onChange={e => setEditSupplier({ ...editSupplier, phone: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">الرصيد المستحق الحالي (ج.م)</label>
                <input
                  type="number"
                  value={editSupplier.balance ?? editSupplier.current_balance ?? editSupplier.opening_balance ?? 0}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    setEditSupplier({ 
                      ...editSupplier, 
                      balance: val, 
                      current_balance: val, 
                      opening_balance: val, 
                      initial_balance: val 
                    });
                  }}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">ملاحظات</label>
                <textarea
                  rows={2}
                  value={editSupplier.notes || ''}
                  onChange={e => setEditSupplier({ ...editSupplier, notes: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs"
                ></textarea>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold shadow text-xs cursor-pointer"
                >
                  {formLoading ? 'جاري التعديل...' : 'حفظ التعديلات'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditSupplier(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Payment Modal */}
      {paymentSupplier && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300 dark:border-slate-800">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/60">
              <h3 className="font-bold text-base text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                سداد دفعة نقدية للمورد
              </h3>
              <button onClick={() => setPaymentSupplier(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl font-bold cursor-pointer">&times;</button>
            </div>
            <form onSubmit={handleRecordSupplierPayment} className="p-5 space-y-4">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">المورد المستلم:</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{paymentSupplier.name} ({paymentSupplier.company_name || 'شركة موردة'})</p>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-slate-600 dark:text-slate-400">الرصيد المستحق الحالي له:</span>
                  <span className="font-bold text-red-600 dark:text-red-400 font-mono">{formatPriceShort(Number(paymentSupplier.current_balance || paymentSupplier.balance || 0))}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">المبلغ المسدد نقداً (ج.م) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="ادخل قيمة الدفعة المسددة (مثال: 1000)"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full p-2.5 border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 rounded-xl text-base font-bold text-emerald-700 dark:text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">البيان / ملاحظات السند</label>
                <input
                  type="text"
                  placeholder="مثال: دفعة نقدية تحت حساب توريد زيوت"
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl text-xs"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 btn-primary py-2.5 rounded-xl font-bold shadow text-xs cursor-pointer"
                >
                  {formLoading ? 'جاري تسجيل الدفعة...' : 'تأكيد السداد والخصم من الرصيد'}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentSupplier(null)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
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

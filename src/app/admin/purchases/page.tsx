'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { useToast } from '@/components/ui/toast';
import { useNumberFormat } from '@/context/number-format-context';
import { Receipt, Plus, Search, Loader2, Trash2 } from 'lucide-react';

export default function PurchasesPage() {
  const { toast } = useToast();
  const { formatPriceShort, formatNumber } = useNumberFormat();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const [newPurchase, setNewPurchase] = useState({
    supplier_id: '',
    invoice_no: '',
    paid_amount: '0',
    notes: ''
  });

  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [purRes, supRes, prodRes] = await Promise.all([
        fetch(`/api/admin/purchases?t=${Date.now()}`),
        fetch(`/api/admin/suppliers?t=${Date.now()}`),
        fetch(`/api/products?limit=200&t=${Date.now()}`)
      ]);

      if (purRes.ok) {
        const json = await purRes.json();
        setPurchases(json.data || json.purchases || []);
      }

      if (supRes.ok) {
        const json = await supRes.json();
        setSuppliers(json.data || json.suppliers || []);
      }

      if (prodRes.ok) {
        const json = await prodRes.json();
        setProducts(json.products || json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleAddItem = (productId: string) => {
    if (!productId) return;
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    const existingIndex = invoiceItems.findIndex(i => i.product_id === productId);
    if (existingIndex > -1) {
      const updated = [...invoiceItems];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].total_price = updated[existingIndex].quantity * updated[existingIndex].unit_price;
      setInvoiceItems(updated);
    } else {
      const defaultPrice = Number(prod.base_price || 0) * 0.9;
      setInvoiceItems([
        ...invoiceItems,
        {
          product_id: prod.id,
          name: prod.name,
          unit: prod.wholesale_unit || prod.unit || 'عبوة',
          quantity: 10,
          unit_price: Math.round(defaultPrice),
          total_price: 10 * Math.round(defaultPrice)
        }
      ]);
    }
  };

  const handleUpdateItem = (index: number, field: string, val: number) => {
    const updated = [...invoiceItems];
    const item = { ...updated[index], [field]: Math.max(0, val) };
    item.total_price = item.quantity * item.unit_price;
    updated[index] = item;
    setInvoiceItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const itemsTotal = invoiceItems.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
  const paidVal = Number(newPurchase.paid_amount || 0);
  const remainingVal = Math.max(0, itemsTotal - paidVal);

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invoiceItems.length === 0) {
      toast({ title: 'تنبيه', description: 'يرجى إضافة صنف واحد على الأقل في الفاتورة', type: 'error' });
      return;
    }

    setFormLoading(true);
    try {
      const selectedSup = suppliers.find(s => s.id === newPurchase.supplier_id);
      const generatedInv = newPurchase.invoice_no.trim() || `PUR-${Date.now().toString().slice(-5)}`;

      const payload = {
        invoice_number: generatedInv,
        invoice_no: generatedInv,
        supplier_id: newPurchase.supplier_id || null,
        supplier_name: selectedSup?.company_name || selectedSup?.name || 'مورد عام',
        total: itemsTotal,
        total_amount: itemsTotal,
        paid_amount: paidVal,
        remaining_amount: remainingVal,
        items: invoiceItems,
        notes: newPurchase.notes
      };

      const res = await fetch('/api/admin/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success !== false) {
        toast({ title: 'تم تسجيل فاتورة المشتريات وتحديث المخزون ورصيد المورد بنجاح', type: 'success' });
        setShowModal(false);
        setNewPurchase({ supplier_id: '', invoice_no: '', paid_amount: '0', notes: '' });
        setInvoiceItems([]);
        await fetchData();
      } else {
        toast({ title: 'خطأ في الحفظ', description: data.error || 'فشل حفظ الفاتورة', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال بالسيرفر', description: err.message, type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const safePurchases = Array.isArray(purchases) ? purchases : [];
  const filtered = safePurchases.filter(p =>
    (p.invoice_no || p.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.supplier?.name || p.supplier?.company_name || p.supplier_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">فواتير المشتريات والتوريدات</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">تسجيل بضائع الموردين الموردة للمخازن وزيادة المخزون تلقائياً</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 font-bold px-4 py-2.5 text-xs rounded-xl shadow">
              <Plus className="w-4 h-4" />
              <span>إضافة فاتورة مشتريات</span>
            </button>
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                placeholder="بحث برقم الفاتورة أو المورد..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-4 pr-9 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-4 whitespace-nowrap">رقم الفاتورة</th>
                  <th className="p-4 whitespace-nowrap">المورد / الشركة</th>
                  <th className="p-4 whitespace-nowrap">التاريخ</th>
                  <th className="p-4 whitespace-nowrap">إجمالي الفاتورة</th>
                  <th className="p-4 whitespace-nowrap">المبلغ المدفوع</th>
                  <th className="p-4 whitespace-nowrap">الرصيد المتبقي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">لا توجد فواتير مشتريات مسجلة</td></tr>
                ) : (
                  filtered.map(p => {
                    const totalVal = Number(p.total !== undefined && p.total !== null ? p.total : (p.total_amount || 0));
                    const paid = Number(p.paid_amount || 0);
                    const remVal = Number(p.remaining_amount !== undefined && p.remaining_amount !== null ? p.remaining_amount : Math.max(0, totalVal - paid));
                    const invNo = p.invoice_no || p.invoice_number || `PUR-${String(p.id).slice(0, 6)}`;
                    const invClean = String(invNo).replace(/\D/g, '') || invNo;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-emerald-700 dark:text-emerald-400">#{formatNumber(invClean)}</td>
                        <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{p.supplier?.company_name || p.supplier?.name || p.supplier_name || 'مورد عام'}</td>
                        <td className="p-4 text-slate-600 dark:text-slate-400 font-medium text-xs">
                          {new Date(p.created_at).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="p-4 font-bold text-slate-900 dark:text-white text-base font-mono">{formatPriceShort(totalVal)}</td>
                        <td className="p-4 font-bold text-emerald-600 dark:text-emerald-400 font-mono">{formatPriceShort(paid)}</td>
                        <td className="p-4 font-bold text-red-600 dark:text-red-400 font-mono">{formatPriceShort(remVal)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New Purchase Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-3xl overflow-hidden border border-slate-300 dark:border-slate-800 max-h-[92vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/60">
              <h3 className="font-bold text-base text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                تسجيل فاتورة مشتريات وتوريد مخزن
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-2xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleCreatePurchase} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">المورد / الشركة الموردة *</label>
                  <select
                    required
                    value={newPurchase.supplier_id}
                    onChange={e => setNewPurchase({ ...newPurchase, supplier_id: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="">-- اختر المورد --</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.company_name || s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">رقم الفاتورة (اختياري)</label>
                  <input
                    type="text"
                    placeholder="مثال: PUR-20001 أو اتركه للتوليد التلقائي"
                    value={newPurchase.invoice_no}
                    onChange={e => setNewPurchase({ ...newPurchase, invoice_no: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Product Selector */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50 dark:bg-slate-800/60 space-y-3">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">إضافة أصناف ومنتجات إلى الفاتورة:</label>
                <div className="flex gap-2">
                  <select
                    id="product-select"
                    className="flex-1 p-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800"
                    onChange={e => {
                      if (e.target.value) {
                        handleAddItem(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">-- اضغط لاختيار منتج وإدراجه في الفاتورة --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.wholesale_unit || p.unit || 'عبوة'}) — المخزون الحالي: {formatNumber(p.stock_quantity || 0)}</option>
                    ))}
                  </select>
                </div>

                {/* Items List */}
                {invoiceItems.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {invoiceItems.map((item, idx) => (
                      <div key={item.product_id} className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                        <div className="flex-1">
                          <span className="font-bold text-slate-900 dark:text-white block">{item.name}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">الوحدة: {item.unit}</span>
                        </div>
                        <div className="w-20">
                          <label className="block text-[10px] text-slate-500 mb-0.5">الكمية</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => handleUpdateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-full p-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-center font-bold font-mono"
                          />
                        </div>
                        <div className="w-24">
                          <label className="block text-[10px] text-slate-500 mb-0.5">سعر شراء الوحدة</label>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={item.unit_price}
                            onChange={e => handleUpdateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full p-1.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg text-center font-bold font-mono"
                          />
                        </div>
                        <div className="w-24 text-left">
                          <label className="block text-[10px] text-slate-500 mb-0.5">الإجمالي</label>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono block">{formatPriceShort(item.total_price)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Summary */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>إجمالي قيمة بضائع الفاتورة:</span>
                  <span className="text-base text-slate-900 dark:text-white font-mono">{formatPriceShort(itemsTotal)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">المبلغ المسدد نقداً الآن (كاش للمورد)</label>
                    <input
                      type="number"
                      min="0"
                      max={itemsTotal}
                      step="10"
                      value={newPurchase.paid_amount}
                      onChange={e => setNewPurchase({ ...newPurchase, paid_amount: e.target.value })}
                      className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">المبلغ المتبقي المستحق للمورد (آجل)</label>
                    <div className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-red-600 dark:text-red-400 bg-white dark:bg-slate-800 font-mono text-sm">
                      {formatPriceShort(remainingVal)}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">ملاحظات الفاتورة</label>
                <textarea
                  rows={2}
                  placeholder="أي تفاصيل أو شروط خاصة بالتوريد..."
                  value={newPurchase.notes}
                  onChange={e => setNewPurchase({ ...newPurchase, notes: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-900 dark:text-white"
                ></textarea>
              </div>

              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-3 bg-slate-50 dark:bg-slate-800/60 -mx-5 -mb-5 mt-4">
                <button
                  type="submit"
                  disabled={formLoading || invoiceItems.length === 0}
                  className="flex-1 btn-primary py-3 rounded-xl font-bold disabled:opacity-50 text-xs"
                >
                  {formLoading ? 'جاري تسجيل الفاتورة...' : `حفظ وتأكيد الفاتورة (${formatPriceShort(itemsTotal)})`}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border border-slate-300 dark:border-slate-700 text-xs"
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

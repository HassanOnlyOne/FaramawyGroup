'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/layout/admin-layout';
import { ElfarmawyInvoice } from '@/components/admin/invoice';
import { Printer, ArrowRight, Loader2, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useNumberFormat } from '@/context/number-format-context';
import { recordAuditLog } from '@/lib/audit-client';
import Link from 'next/link';

export default function AdminOrderDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const { formatPriceShort, formatNumber } = useNumberFormat();

  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const [status, setStatus] = useState<string>('pending');

  // Invoice Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [editableItems, setEditableItems] = useState<any[]>([]);
  const [editableShippingFee, setEditableShippingFee] = useState(0);
  const [editableDiscount, setEditableDiscount] = useState(0);
  const [editablePaidAmount, setEditablePaidAmount] = useState(0);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');

  const handleDeleteThisOrder = async () => {
    const invNo = order?.invoice_no || order?.order_number || id;
    const confirmDelete = window.confirm(`هل أنت متأكد من حذف هذا الطلب الملغي #${invNo} نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`);
    if (!confirmDelete) return;

    setDeletingOrder(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success !== false) {
        toast({ title: 'تم حذف الطلب الملغي نهائياً', type: 'success' });
        router.push('/admin/orders');
      } else {
        toast({ title: 'فشل حذف الطلب', description: data.error || 'تعذر حذف الطلب', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال', description: err.message, type: 'error' });
    } finally {
      setDeletingOrder(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  useEffect(() => {
    if (order) {
      if (order.status) {
        setStatus(order.status);
      }
      const itemsList = Array.isArray(order.order_items) ? order.order_items : (Array.isArray(order.items) ? order.items : []);
      setEditableItems(itemsList.map((it: any) => ({
        id: it.id,
        product_id: it.product_id || it.product?.id,
        name: it.product?.name || it.name || 'منتج',
        quantity: Number(it.quantity || 1),
        unit_price: Number(it.unit_price || it.price_at_time || it.product?.base_price || 0),
        total_price: Number(it.total_price || ((it.quantity || 1) * (it.unit_price || it.product?.base_price || 0))),
        wholesale_unit: it.product?.wholesale_unit || it.product?.unit || 'عبوة'
      })));
      setEditableShippingFee(Number(order.delivery_fee || order.shipping_fee || order.shipping_cost || 0));
      setEditableDiscount(Number(order.discount || order.discount_amount || 0));
      setEditablePaidAmount(Number(order.paid_amount || 0));
    }
  }, [order]);

  async function fetchOrder(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        const json = await res.json();
        const actualOrder = json.data || json.order || (json.id ? json : null);
        if (actualOrder) {
          setOrder(actualOrder);
          if (actualOrder.status) {
            setStatus(actualOrder.status);
          }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  async function fetchProductsForEdit() {
    try {
      const res = await fetch(`/api/products?limit=100&t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        setAllProducts(json.products || json.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (updating || newStatus === status) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success !== false) {
        toast({ title: 'تم تحديث حالة الطلب والمخزون بنجاح', type: 'success' });
        setStatus(newStatus);
        const updated = data.data || data.order;
        if (updated) {
          setOrder(updated);
        } else {
          setOrder((prev: any) => prev ? ({ ...prev, status: newStatus }) : null);
        }
      } else {
        toast({ title: 'خطأ في التحديث', description: data.error || 'فشل تعديل الحالة', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'حدث خطأ في الاتصال بالسيرفر', type: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  const handleOpenEditModal = () => {
    fetchProductsForEdit();
    setShowEditModal(true);
  };

  const handleAddItemToOrder = () => {
    if (!selectedProductId) return;
    const prod = allProducts.find(p => p.id === selectedProductId);
    if (!prod) return;

    const existingIdx = editableItems.findIndex(it => it.product_id === prod.id);
    if (existingIdx >= 0) {
      const updated = [...editableItems];
      updated[existingIdx].quantity += 1;
      updated[existingIdx].total_price = updated[existingIdx].quantity * updated[existingIdx].unit_price;
      setEditableItems(updated);
    } else {
      setEditableItems([
        ...editableItems,
        {
          id: `new-${Date.now()}`,
          product_id: prod.id,
          name: prod.name,
          quantity: prod.min_order_quantity || 1,
          unit_price: Number(prod.base_price || 0),
          total_price: Number(prod.base_price || 0) * Number(prod.min_order_quantity || 1),
          wholesale_unit: prod.wholesale_unit || prod.unit || 'عبوة'
        }
      ]);
    }
    setSelectedProductId('');
  };

  const handleRemoveItem = (index: number) => {
    setEditableItems(editableItems.filter((_, idx) => idx !== index));
  };

  const handleItemQtyChange = (index: number, newQty: number) => {
    const updated = [...editableItems];
    const qty = Math.max(1, newQty);
    updated[index].quantity = qty;
    updated[index].total_price = qty * updated[index].unit_price;
    setEditableItems(updated);
  };

  const handleItemPriceChange = (index: number, newPrice: number) => {
    const updated = [...editableItems];
    const price = Math.max(0, newPrice);
    updated[index].unit_price = price;
    updated[index].total_price = updated[index].quantity * price;
    setEditableItems(updated);
  };

  const calcSubtotal = editableItems.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
  const calcTotal = Math.max(0, calcSubtotal + Number(editableShippingFee) - Number(editableDiscount));
  const prevCustomerDebt = Number(order?.previous_balance || order?.customer?.previous_balance || 0);
  const safePaid = Math.min(calcTotal, Math.max(0, Number(editablePaidAmount || 0)));
  const remainingInvoiceDebt = Math.max(0, calcTotal - safePaid);
  const totalCumulativeDebt = prevCustomerDebt + remainingInvoiceDebt;

  const handleSaveInvoiceChanges = async () => {
    setSavingInvoice(true);
    try {
      const isCredit = remainingInvoiceDebt > 0;

      const payload = {
        items: editableItems.map(item => ({
          product_id: item.product_id || item.id,
          product_name: item.name || item.product_name,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price || item.price),
          total_price: Number(item.quantity) * Number(item.unit_price || item.price)
        })),
        shipping_fee: Number(editableShippingFee),
        delivery_fee: Number(editableShippingFee),
        shipping_cost: Number(editableShippingFee),
        discount_amount: Number(editableDiscount),
        discount: Number(editableDiscount),
        total_amount: Number(calcTotal),
        total: Number(calcTotal),
        paid_amount: safePaid,
        remaining_amount: remainingInvoiceDebt,
        remaining_credit_amount: remainingInvoiceDebt,
        payment_method: isCredit ? 'credit' : 'cash',
        previous_balance: prevCustomerDebt,
        current_balance: totalCumulativeDebt
      };

      // استخدام الـ API المعزز بالسيرفر لضمان تحديث الـ DB، المخزون، والآجل
      let res = await fetch(`/api/admin/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        res = await fetch(`/api/orders/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json().catch(() => ({}));

      if (res.ok && (data.success !== false)) {
        toast({ title: 'تم حفظ الفاتورة وتحديث المخزون والمديونية بنجاح', type: 'success' });
        setShowEditModal(false);
        await fetchOrder(false);
      } else {
        toast({ title: 'خطأ في تعديل الفاتورة', description: data.error || 'فشل حفظ التعديلات', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ في الاتصال بالسيرفر', description: err.message, type: 'error' });
    } finally {
      setSavingInvoice(false);
    }
  };

  const handlePrint = () => {
    recordAuditLog({
      action_type: 'طباعة فاتورة',
      category: 'المبيعات والفواتير',
      details: `تمت طباعة فاتورة بيع للطلب #${order?.invoice_no || order?.order_number || id} للعميل (${order?.customer?.full_name || order?.customer?.store_name || 'عميل'})`
    });
    window.print();
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center py-24">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!order) {
    return (
      <AdminLayout>
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
          <h2 className="text-xl font-bold text-slate-800 mb-2">الطلب غير موجود</h2>
          <Link href="/admin/orders" className="text-emerald-600 font-bold hover:underline">
            العودة لقائمة الطلبات
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const safeOrderId = order.invoice_no || order.order_number || (order.id ? String(order.id).slice(0, 8) : '---');
  const itemsList = Array.isArray(order.order_items) ? order.order_items : (Array.isArray(order.items) ? order.items : []);
  const totalAmount = Number(order.total !== undefined ? order.total : (order.total_amount || order.subtotal || 0));
  const paidAmountVal = Number(order.paid_amount || 0);
  const remainingAmountVal = Number(order.remaining_amount !== undefined ? order.remaining_amount : Math.max(0, totalAmount - paidAmountVal));
  const customerProfile = order.customer || order.profiles || {};
  const deliveryFeeVal = Number(order.delivery_fee || order.shipping_fee || order.shipping_cost || 0);
  const customerPreviousBalance = Number(order.previous_balance !== undefined ? order.previous_balance : (customerProfile.previous_balance || 0));
  const expectedTotalDebt = customerPreviousBalance + remainingAmountVal;

  return (
    <AdminLayout>
      <div className="space-y-6 print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <Link href="/admin/orders" className="p-2 bg-slate-100 rounded-xl border border-slate-200 hover:bg-slate-200 text-slate-700">
              <ArrowRight className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">تفاصيل الفاتورة #{safeOrderId}</h1>
              {order.invoice_no && <span className="text-xs font-mono text-emerald-600 font-bold block">رقم الفاتورة: {order.invoice_no}</span>}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
            <select 
              value={status} 
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={updating}
              className="px-4 py-2.5 border border-slate-300 rounded-xl bg-white text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 shadow-sm"
            >
              <option value="pending">قيد الانتظار</option>
              <option value="approved">مقبول</option>
              <option value="delivering">في التوصيل</option>
              <option value="completed">مكتمل</option>
              <option value="returned">مرتجع</option>
              <option value="cancelled">ملغي</option>
            </select>

            <button 
              onClick={handleOpenEditModal}
              className="btn-secondary flex items-center gap-2 font-bold px-4 py-2.5 text-sm rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
            >
              <Edit className="w-4 h-4 text-blue-600" />
              <span>تعديل الفاتورة والأسعار</span>
            </button>

            <button 
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 font-bold px-4 py-2.5 text-sm rounded-xl"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الفاتورة</span>
            </button>

            {['cancelled', 'ملغي', 'ملغى'].includes(String(status || '').toLowerCase()) && (
              <button 
                onClick={handleDeleteThisOrder}
                disabled={deletingOrder}
                className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 flex items-center gap-2 font-bold px-4 py-2.5 text-sm rounded-xl transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deletingOrder ? 'جاري حذف الطلب...' : 'حذف الطلب نهائياً'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-900">الأصناف والمنتجات المطلوبة ({itemsList.length})</h3>
                <span className="text-xs text-slate-500 font-bold">المخزن الرئيسي</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-4">كود الصنف</th>
                      <th className="p-4">اسم المنتج</th>
                      <th className="p-4">الكمية</th>
                      <th className="p-4">سعر الوحدة</th>
                      <th className="p-4">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {itemsList.map((item: any, i: number) => (
                      <tr key={item.id || i} className="hover:bg-slate-50">
                        <td className="p-4 font-mono font-bold text-xs">{item.product?.sku_code || item.product?.sku || String(i + 1).padStart(3, '0')}</td>
                        <td className="p-4">
                          <div className="font-bold text-slate-900">{item.product?.name || item.name || 'منتج'}</div>
                          <div className="text-xs text-slate-500">{item.product?.wholesale_unit || item.product?.unit || 'عبوة'}</div>
                        </td>
                        <td className="p-4 font-bold text-slate-900">{item.quantity}</td>
                        <td className="p-4 font-mono">{formatPriceShort(Number(item.unit_price || item.price_at_time || item.product?.base_price || 0))}</td>
                        <td className="p-4 font-bold text-emerald-700 font-mono text-base">
                          {formatPriceShort(Number(item.total_price || (item.quantity * (item.unit_price || item.product?.base_price || 0))))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>المجموع الفرعي للبضائع:</span>
                  <span className="font-bold font-mono">{formatPriceShort(Number(order.subtotal || totalAmount))}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>مصاريف الشحن والتوصيل:</span>
                  <span className="font-bold text-slate-900">{deliveryFeeVal > 0 ? formatPriceShort(deliveryFeeVal) : 'مجاني'}</span>
                </div>
                {Number(order.discount || order.discount_amount || 0) > 0 && (
                  <div className="flex justify-between text-red-600 font-bold">
                    <span>الخصم:</span>
                    <span>-{formatPriceShort(Number(order.discount || order.discount_amount))}</span>
                  </div>
                )}
                <div className="flex justify-between pt-3 border-t border-slate-200 items-center">
                  <span className="font-bold text-slate-900 text-lg">الإجمالي الكلي النهائي</span>
                  <span className="font-black text-emerald-700 text-2xl font-mono">{formatPriceShort(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
              <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-3">بيانات العميل ومكان التسليم</h3>
              <div className="space-y-2.5 text-sm">
                <p><span className="text-slate-500 block text-xs">اسم المحل / المتجر:</span> <span className="font-bold text-slate-900 text-base">{order.store_name_ref || order.store_name || customerProfile.store_name || customerProfile.full_name || order.customer_name || 'عميل تجزئة'}</span></p>
                <p><span className="text-slate-500 block text-xs">كود العميل:</span> <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">{customerProfile.customer_code ? String(customerProfile.customer_code).replace(/\D/g, '') : '1000'}</span></p>
                <p><span className="text-slate-500 block text-xs">الهاتف الأساسي:</span> <span dir="ltr" className="font-bold text-slate-900 font-mono">{order.contact_phone || customerProfile.phone || '---'}</span></p>
                <p><span className="text-slate-500 block text-xs">العنوان التفصيلي للتسليم:</span> <span className="font-bold text-slate-900 leading-relaxed block mt-0.5">{order.delivery_address || order.shipping_address || customerProfile.address || 'المخزن الرئيسي'}</span></p>
                {order.delegate_name && (
                  <p><span className="text-slate-500 block text-xs">المندوب المتابع:</span> <span className="font-bold text-emerald-700">{order.delegate_name}</span></p>
                )}
                {order.customer_notes && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs mt-3">
                    <span className="font-bold text-amber-900 block mb-1">📝 ملاحظات العميل على الطلب:</span>
                    <p className="text-amber-800 leading-relaxed font-medium">{order.customer_notes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4 border-b border-slate-200 pb-3">تفاصيل الحساب والتسديد</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">طريقة الدفع:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${order.payment_method === 'credit' || remainingAmountVal > 0 ? 'bg-orange-100 text-orange-800 border border-orange-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                    {order.payment_method === 'credit' || remainingAmountVal > 0 ? 'أجل (آجل / مركب)' : 'كاش عند الاستلام'}
                  </span>
                </div>
                
                {paidAmountVal > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    <span>المدفوع نقداً مقدماً (كاش):</span>
                    <span className="font-mono">{formatPriceShort(paidAmountVal)}</span>
                  </div>
                )}

                <div className="flex justify-between mt-2 pt-2 border-t border-slate-100">
                  <span className="text-slate-500">الرصيد السابق المسجل على العميل:</span>
                  <span className="font-bold text-slate-800 font-mono">{formatPriceShort(customerPreviousBalance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">قيمة الفاتورة الحالية:</span>
                  <span className="font-bold text-slate-900 font-mono">+{formatPriceShort(totalAmount)}</span>
                </div>
                
                <div className="flex justify-between text-orange-700 font-bold bg-orange-50/60 p-2 rounded-lg border border-orange-200">
                  <span>المبلغ الأجل المتبقي من الفاتورة:</span>
                  <span className="font-mono">+{formatPriceShort(remainingAmountVal)}</span>
                </div>

                <div className="flex justify-between mt-2 pt-2 border-t border-slate-200 items-center">
                  <span className="text-slate-900 font-black text-sm">الرصيد المتوقع بعد الفاتورة:</span>
                  <span className="font-black text-red-700 text-lg font-mono">{formatPriceShort(expectedTotalDebt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-300 max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-900">تعديل مكونات الفاتورة ومصاريف الشحن</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">&times;</button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="flex gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="flex-1 p-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 bg-white"
                >
                  <option value="">-- اختر صنف لإضافته للطلب --</option>
                  {allProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.wholesale_unit || p.unit || 'عبوة'}) — {p.base_price} ج.م</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddItemToOrder}
                  disabled={!selectedProductId}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                >
                  إضافة
                </button>
              </div>

              <div className="space-y-2">
                {editableItems.map((item, idx) => (
                  <div key={item.id || idx} className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl">
                    <div className="flex-1">
                      <span className="font-bold text-slate-900 block text-sm">{item.name}</span>
                      <span className="text-xs text-slate-400">{item.wholesale_unit || 'عبوة'}</span>
                    </div>

                    <div className="w-20">
                      <label className="block text-[10px] text-slate-500 mb-0.5">الكمية</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemQtyChange(idx, parseInt(e.target.value) || 1)}
                        className="w-full p-1.5 border border-slate-300 rounded-lg text-center font-bold text-sm"
                      />
                    </div>

                    <div className="w-24">
                      <label className="block text-[10px] text-slate-500 mb-0.5">سعر الوحدة</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={item.unit_price}
                        onChange={(e) => handleItemPriceChange(idx, parseFloat(e.target.value) || 0)}
                        className="w-full p-1.5 border border-slate-300 rounded-lg text-center font-bold text-sm"
                      />
                    </div>

                    <div className="w-28 text-left">
                      <label className="block text-[10px] text-slate-500 mb-0.5">الإجمالي</label>
                      <span className="font-bold text-emerald-700 block text-sm font-mono">{formatPriceShort(item.total_price)}</span>
                    </div>

                    <button
                      onClick={() => handleRemoveItem(idx)}
                      type="button"
                      className="text-red-500 hover:text-red-700 font-bold px-2 py-1"
                      title="حذف الصنف"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">مصاريف الشحن والتوصيل (ج.م)</label>
                  <input
                    type="number"
                    step="5"
                    value={editableShippingFee}
                    onChange={(e) => setEditableShippingFee(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">قيمة الخصم (ج.م)</label>
                  <input
                    type="number"
                    step="5"
                    value={editableDiscount}
                    onChange={(e) => setEditableDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-800 mb-1">المبلغ المدفوع كاش (ج.م)</label>
                  <input
                    type="number"
                    min="0"
                    max={calcTotal}
                    step="10"
                    value={editablePaidAmount}
                    onChange={(e) => setEditablePaidAmount(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 border border-emerald-300 rounded-xl font-bold text-emerald-700 bg-emerald-50/50 font-mono"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>مجموع بنود المنتجات:</span>
                  <span className="font-bold text-slate-900 font-mono">{formatPriceShort(calcSubtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>مصاريف التوصيل والشحن:</span>
                  <span className="font-bold text-slate-900 font-mono">+{formatPriceShort(editableShippingFee)}</span>
                </div>
                {editableDiscount > 0 && (
                  <div className="flex justify-between text-red-600 font-bold">
                    <span>الخصم التجاري:</span>
                    <span className="font-mono">-{formatPriceShort(editableDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-slate-900 text-base pt-2 border-t border-slate-200">
                  <span>إجمالي الفاتورة الجديد:</span>
                  <span className="font-mono">{formatPriceShort(calcTotal)}</span>
                </div>
                
                <div className="pt-2 border-t border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>المبلغ المدفوع (كاش):</span>
                    <span className="font-mono">{formatPriceShort(safePaid)}</span>
                  </div>
                  <div className="flex justify-between text-orange-700 font-bold">
                    <span>المبلغ المتبقي / آجل الفاتورة:</span>
                    <span className="font-mono">+{formatPriceShort(remainingInvoiceDebt)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 font-medium">
                    <span>الرصيد السابق على العميل:</span>
                    <span className="font-bold font-mono">{formatPriceShort(prevCustomerDebt)}</span>
                  </div>
                  <div className="flex justify-between font-black text-red-700 text-sm pt-1.5 border-t border-slate-300">
                    <span>إجمالي مديونية العميل الكلية بعد الفاتورة:</span>
                    <span className="text-base font-mono">{formatPriceShort(totalCumulativeDebt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex gap-2 bg-slate-50">
              <button
                onClick={handleSaveInvoiceChanges}
                disabled={savingInvoice}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow transition-all"
              >
                {savingInvoice ? 'جاري حفظ التعديلات...' : `حفظ الفاتورة والإجمالي (${formatPriceShort(calcTotal)})`}
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 bg-slate-200 text-slate-800 font-bold py-2.5 rounded-xl border border-slate-300"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden print:block">
        <ElfarmawyInvoice order={order} />
      </div>
    </AdminLayout>
  );
}
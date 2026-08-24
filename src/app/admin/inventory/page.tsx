'use client';

import { AdminLayout } from '@/components/layout/admin-layout';
import { formatPrice, UNIT_LABELS } from '@/lib/constants';
import type { Product, StockLog } from '@/lib/types';
import { Warehouse, AlertTriangle, Plus, Minus, Package, History, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [logsOpen, setLogsOpen] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState('');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, lowRes, logsRes] = await Promise.all([
        fetch('/api/products?includeInactive=true'),
        fetch('/api/products/low-stock'),
        fetch('/api/stock/logs?limit=10')
      ]);
      
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(Array.isArray(prodData) ? prodData : (prodData?.data || prodData?.products || []));
      }
      if (lowRes.ok) {
        const lowData = await lowRes.json();
        setLowStockProducts(Array.isArray(lowData) ? lowData : (lowData?.data || lowData?.products || []));
      }
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setStockLogs(Array.isArray(logsData) ? logsData : (logsData?.data || logsData?.logs || []));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProductId || adjustQuantity === 0) return;
    
    setSubmitting(true);
    try {
      const res = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: adjustProductId,
          quantity_change: adjustQuantity,
          reason: adjustReason
        })
      });
      
      if (!res.ok) throw new Error('فشل تعديل المخزون');
      
      setModalOpen(false);
      setAdjustProductId('');
      setAdjustQuantity(0);
      setAdjustReason('');
      fetchData(); // Refresh data
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openAdjustModal = (productId?: string) => {
    if (productId) setAdjustProductId(productId);
    setAdjustQuantity(0);
    setAdjustReason('');
    setModalOpen(true);
  };

  const safeProducts = Array.isArray(products) ? products : [];
  const safeLowStockProducts = Array.isArray(lowStockProducts) ? lowStockProducts : [];
  const safeStockLogs = Array.isArray(stockLogs) ? stockLogs : [];

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <Warehouse className="w-6 h-6 text-emerald-600" />
              إدارة المخزون
            </h1>
            <p className="text-slate-500 mt-1">تتبع وإدارة كميات المنتجات المتوفرة</p>
          </div>
          <button 
            onClick={() => openAdjustModal()}
            className="btn-primary flex items-center gap-2"
          >
            <Package className="w-5 h-5" />
            تعديل يدوي
          </button>
        </div>

        {safeLowStockProducts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
            <h2 className="text-amber-800 font-bold flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              تنبيهات انخفاض المخزون
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {safeLowStockProducts.map(p => (
                <div key={p.id} className="bg-white border border-amber-200 rounded-lg p-3 flex justify-between items-center shadow-sm">
                  <div>
                    <div className="text-slate-900 font-bold text-sm">{p.name}</div>
                    <div className="text-slate-500 text-xs">الحد الأدنى: {p.low_stock_threshold}</div>
                  </div>
                  <div className={`font-bold text-lg ${p.stock_quantity === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                    {p.stock_quantity}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div 
            className="p-4 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => setLogsOpen(!logsOpen)}
          >
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-600" />
              سجل حركات المخزون الأخير
            </h2>
            {logsOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </div>
          
          {logsOpen && (
            <div className="p-4 bg-slate-50">
              <div className="overflow-x-auto">
                <table className="w-full text-right bg-white border border-slate-200 rounded-xl">
                  <thead>
                    <tr className="text-slate-800 text-sm border-b border-slate-200 bg-slate-100">
                      <th className="p-3 font-bold">التاريخ</th>
                      <th className="p-3 font-bold">المنتج</th>
                      <th className="p-3 font-bold text-center">التغيير</th>
                      <th className="p-3 font-bold">السبب</th>
                      <th className="p-3 font-bold">بواسطة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {safeStockLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-700 text-sm">{new Date(log.created_at).toLocaleString('ar-EG')}</td>
                        <td className="p-3 text-slate-900 font-bold text-sm">{log.product?.name || 'منتج محذوف'}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold ${log.quantity_change > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                            {log.quantity_change > 0 ? '+' : ''}{log.quantity_change}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 text-sm">{log.reason || '-'}</td>
                        <td className="p-3 text-slate-600 text-sm">{log.performer?.full_name || 'النظام'}</td>
                      </tr>
                    ))}
                    {safeStockLogs.length === 0 && (
                      <tr><td colSpan={5} className="p-4 text-center text-slate-500">لا يوجد حركات مسجلة</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">نظرة عامة على المخزون</h2>
          
          {loading ? (
            <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right bg-white border border-slate-200 rounded-xl">
                <thead>
                  <tr className="text-slate-800 text-sm border-b border-slate-200 bg-slate-100">
                    <th className="p-3 font-bold">المنتج</th>
                    <th className="p-3 font-bold">SKU</th>
                    <th className="p-3 font-bold text-center">الحالة</th>
                    <th className="p-3 font-bold text-center">المخزون الحالي</th>
                    <th className="p-3 font-bold text-center">الحد الأدنى</th>
                    <th className="p-3 font-bold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {safeProducts.map((p) => {
                    const isOutOfStock = p.stock_quantity === 0;
                    const isLowStock = p.stock_quantity <= p.low_stock_threshold && !isOutOfStock;
                    const statusColor = isOutOfStock ? 'bg-red-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500';
                    
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-slate-900 font-bold">{p.name}</td>
                        <td className="p-3 text-slate-500 text-sm font-mono">{p.sku}</td>
                        <td className="p-3 text-center">
                          <div className={`w-3 h-3 rounded-full mx-auto ${statusColor}`} />
                        </td>
                        <td className={`p-3 text-center font-bold ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {p.stock_quantity}
                        </td>
                        <td className="p-3 text-center text-slate-500">{p.low_stock_threshold}</td>
                        <td className="p-3">
                          <button 
                            onClick={() => openAdjustModal(p.id)}
                            className="text-sm px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg border border-slate-200 transition-colors"
                          >
                            تعديل
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Adjust Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-300 shadow-xl rounded-2xl w-full max-w-md p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-slate-900 mb-4 border-b border-slate-100 pb-3">تعديل المخزون اليدوي</h2>
            
            <form onSubmit={handleAdjustStock} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">المنتج *</label>
                <select 
                  value={adjustProductId}
                  onChange={(e) => setAdjustProductId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                  required
                >
                  <option value="" disabled>اختر المنتج...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (المخزون الحالي: {p.stock_quantity})</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">مقدار التغيير (+/-) *</label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setAdjustQuantity(q => q - 1)} className="p-2.5 bg-slate-100 border border-slate-300 rounded-xl hover:bg-slate-200 text-slate-800 font-bold"><Minus className="w-4 h-4"/></button>
                  <input
                    type="number"
                    value={adjustQuantity}
                    onChange={(e) => setAdjustQuantity(parseInt(e.target.value) || 0)}
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-center font-bold text-lg focus:border-emerald-500 focus:outline-none"
                    dir="ltr"
                    required
                  />
                  <button type="button" onClick={() => setAdjustQuantity(q => q + 1)} className="p-2.5 bg-slate-100 border border-slate-300 rounded-xl hover:bg-slate-200 text-slate-800 font-bold"><Plus className="w-4 h-4"/></button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">استخدم إشارة سالبة (-) للإنقاص (مثل -5) أو موجبة للزيادة (مثل +10)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">السبب / ملاحظات الجرد</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="مثال: جرد سنوي، بضاعة تالفة، تصحيح كمية..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200 mt-6">
                <button 
                  type="button" 
                  onClick={() => setModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 rounded-xl border border-slate-200 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  disabled={submitting || !adjustProductId || adjustQuantity === 0}
                  className="flex-1 btn-primary py-2.5 flex justify-center items-center font-bold"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'حفظ تعديل المخزون'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

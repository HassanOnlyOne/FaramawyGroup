'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { formatPriceShort } from '@/lib/constants';
import { Plus } from 'lucide-react';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // Auto-Suggest customer search state
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [payRes, custRes] = await Promise.all([
        fetch('/api/payments'),
        fetch('/api/customers')
      ]);
      if (payRes.ok) {
        const payData = await payRes.json();
        setPayments(Array.isArray(payData) ? payData : (payData?.data || payData?.payments || []));
      }
      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(Array.isArray(custData) ? custData : (custData?.data || custData?.customers || []));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleRecordPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCustomer) {
      alert('يرجى اختيار العميل من القائمة');
      return;
    }
    setFormLoading(true);
    const formData = new FormData(e.currentTarget);
    
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          amount: parseFloat(formData.get('amount') as string),
          payment_method: 'cash',
          notes: formData.get('notes')
        })
      });
      if (res.ok) {
        setShowModal(false);
        setSelectedCustomer(null);
        setCustomerSearch('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFormLoading(false);
    }
  };

  const safePayments = Array.isArray(payments) ? payments : [];
  const safeCustomers = Array.isArray(customers) ? customers : [];

  const filteredCustomers = safeCustomers.filter(c => {
    if (!customerSearch) return true;
    const term = customerSearch.toLowerCase();
    return (
      (c.store_name || '').toLowerCase().includes(term) ||
      (c.full_name || c.name || '').toLowerCase().includes(term) ||
      (c.customer_code || '').toLowerCase().includes(term) ||
      (c.phone || '').includes(term)
    );
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">سجل التحصيلات ونقدية العملاء</h1>
            <p className="text-slate-500 text-sm mt-1">تسجيل المبالغ المستلمة وخصمها من مديونية الحساب</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 font-bold">
            <Plus className="w-4 h-4" />
            <span>تسجيل تحصيل نقدية</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-4 whitespace-nowrap">التاريخ</th>
                  <th className="p-4 whitespace-nowrap">العميل / المتجر</th>
                  <th className="p-4 whitespace-nowrap">المبلغ المحصل</th>
                  <th className="p-4 whitespace-nowrap">ملاحظات والإيصال</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-500">جاري التحميل...</td></tr>
                ) : safePayments.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-500 font-medium">لا توجد تحصيلات مسجلة حتى الآن</td></tr>
                ) : (
                  safePayments.map(payment => (
                    <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-slate-600 font-medium">
                        {new Date(payment.created_at || payment.payment_date).toLocaleDateString('ar-EG', {
                          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="p-4 font-bold text-slate-900">
                        {payment.customer?.store_name || payment.customer?.full_name || payment.profiles?.store_name || payment.profiles?.name || 'عميل محذوف'}
                        {payment.customer?.customer_code && <span className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded ml-2">{payment.customer.customer_code}</span>}
                      </td>
                      <td className="p-4 font-bold text-emerald-600 text-base">{formatPriceShort(payment.amount)}</td>
                      <td className="p-4 text-slate-700">{payment.notes || '---'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-emerald-50">
              <h3 className="font-bold text-lg text-emerald-900">تسجيل تحصيل نقدية جديد</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-5 space-y-4">
              
              {/* AutoSuggest Customer Search Input */}
              <div className="relative">
                <label className="block text-xs font-bold text-slate-800 mb-1">ابحث باسم العميل أو الكود *</label>
                
                {selectedCustomer ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="font-bold text-emerald-900 text-sm">{selectedCustomer.store_name || selectedCustomer.full_name}</p>
                      <p className="text-xs text-emerald-700">
                        كود: <span className="font-mono font-bold">{selectedCustomer.customer_code || '---'}</span> | المديونية الحالية: <span className="font-bold text-red-600">{formatPriceShort(selectedCustomer.current_debt !== undefined && selectedCustomer.current_debt !== null ? selectedCustomer.current_debt : (selectedCustomer.previous_balance || 0))}</span>
                      </p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => { setSelectedCustomer(null); setDropdownOpen(true); }}
                      className="text-xs text-red-600 font-bold bg-white px-2 py-1 rounded border border-red-200 hover:bg-red-50 cursor-pointer"
                    >
                      تغيير
                    </button>
                  </div>
                ) : (
                  <>
                    <input 
                      type="text"
                      placeholder="اكتب اسم التاجر أو الكود (مثال: محمد)..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setDropdownOpen(true);
                      }}
                      onFocus={() => setDropdownOpen(true)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                    />

                    {dropdownOpen && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {filteredCustomers.length === 0 ? (
                          <div className="p-3 text-xs text-slate-500 text-center">لا يوجد عميل يطابق البحث</div>
                        ) : (
                          filteredCustomers.map(c => {
                            const custDebt = Number(c.current_debt !== undefined && c.current_debt !== null ? c.current_debt : (c.previous_balance || 0));
                            return (
                              <div 
                                key={c.id} 
                                onClick={() => {
                                  setSelectedCustomer(c);
                                  setCustomerSearch(c.store_name || c.full_name);
                                  setDropdownOpen(false);
                                }}
                                className="p-3 hover:bg-emerald-50 cursor-pointer transition-colors flex justify-between items-center"
                              >
                                <div>
                                  <span className="font-bold text-slate-900 text-sm block">{c.store_name || c.full_name || c.name}</span>
                                  {c.full_name && c.store_name && <span className="text-xs text-slate-500 block">{c.full_name}</span>}
                                </div>
                                <div className="text-left">
                                  {c.customer_code && <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 block">{c.customer_code}</span>}
                                  <span className="text-xs text-red-600 font-bold block mt-0.5">مديونية: {formatPriceShort(custDebt)}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">المبلغ المحصل (ج.م) *</label>
                <input type="number" name="amount" required min="1" step="0.01" className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-900" placeholder="مثال: 5000" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">ملاحظات أو رقم الإيصال</label>
                <textarea name="notes" className="w-full p-2.5 border border-slate-300 rounded-xl text-sm" rows={2} placeholder="تفاصيل الإيصال، اسم المندوب..."></textarea>
              </div>
              <div className="pt-3 flex gap-2">
                <button type="submit" disabled={formLoading || !selectedCustomer} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition-all shadow cursor-pointer">
                  {formLoading ? 'جاري التسجيل...' : 'تأكيد التسديد'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 text-slate-800 py-2.5 rounded-xl font-bold border border-slate-200 cursor-pointer">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

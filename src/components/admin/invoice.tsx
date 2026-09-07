'use client';

import * as React from 'react';
import { Order } from '@/lib/types';
import { BRAND, PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { tafqeedEGP } from '@/lib/tafqeed';
import { useNumberFormat } from '@/context/number-format-context';

interface InvoiceProps {
  order: Order;
}

export function ElfarmawyInvoice({ order }: InvoiceProps) {
  const { formatPriceShort, formatNumber } = useNumberFormat();
  const printDate = new Date();
  const orderDate = new Date(order.created_at || Date.now());

  const handlePrint = () => {
    window.print();
  };

  const invTotal = Number(order.total !== undefined && order.total !== null ? order.total : (order.total_amount || order.subtotal || 0));
  const paidCash = Number(order.paid_amount || 0);
  const remainingDebt = Number(order.remaining_amount !== undefined && order.remaining_amount !== null ? order.remaining_amount : Math.max(0, invTotal - paidCash));
  const prevBalance = Number(order.previous_balance || order.customer?.previous_balance || 0);
  const surplusCash = (paidCash > invTotal) ? (paidCash - invTotal) : 0;
  const currentBalanceAfter = order.current_balance !== undefined && order.current_balance !== null
    ? Number(order.current_balance)
    : Math.max(0, prevBalance + remainingDebt - surplusCash);

  const invoiceNumber = order.invoice_no || order.order_number || String(order.id).slice(0, 8);
  const cleanInvNum = String(invoiceNumber).replace(/\D/g, '') || invoiceNumber;

  const customerCode = order.customer?.customer_code || (order as any).customer_code || '1004';
  const cleanCustomerCode = String(customerCode).replace(/\D/g, '') || '1004';

  return (
    <>
      {/* Print Button (hidden in print) */}
      <div className="no-print mb-4 flex justify-end">
        <button
          onClick={handlePrint}
          className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-lg flex items-center gap-2"
        >
          <span>🖨️ طباعة الفاتورة</span>
        </button>
      </div>

      {/* Invoice Container */}
      <div className="invoice-container bg-white p-6 rounded-2xl border border-slate-200 shadow-sm print:shadow-none print:rounded-none print:border-none max-w-4xl mx-auto text-slate-900" dir="rtl">
        
        {/* Print Timestamp */}
        <div className="text-left text-xs text-slate-500 mb-2 print:text-black print:text-[9pt]">
          طُبع بتاريخ: {printDate.toLocaleDateString('ar-EG')} — الساعة: {printDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
        </div>

        {/* Main Header */}
        <div className="invoice-header text-center border-2 border-brand-700 rounded-xl p-4 mb-4 bg-brand-50 print:bg-gray-100 print:rounded-none">
          <h1 className="text-2xl font-black text-brand-800 print:text-black print:text-[18pt]">
            {BRAND.name}
          </h1>
          <p className="text-xs text-slate-600 print:text-black mt-1 font-bold">لتجارة وتوزيع المواد الغذائية بالجملة والتجزئة</p>
        </div>

        {/* Info Bar */}
        <div className="grid grid-cols-5 gap-2 text-xs border border-slate-300 rounded-lg overflow-hidden mb-4 print:rounded-none">
          <div className="bg-slate-50 p-2 text-center border-l border-slate-300 print:bg-gray-100">
            <span className="text-slate-500 print:text-gray-600 block">رقم المخزن</span>
            <p className="font-bold text-slate-900 print:text-black">{order.store_code || '1'}</p>
          </div>
          <div className="bg-slate-50 p-2 text-center border-l border-slate-300 print:bg-gray-100">
            <span className="text-slate-500 print:text-gray-600 block">نوع البيع</span>
            <p className="font-bold text-slate-900 print:text-black">
              {remainingDebt > 0 ? 'مبيعات (آجل / دفعات)' : 'مبيعات (كاش)'}
            </p>
          </div>
          <div className="bg-slate-50 p-2 text-center border-l border-slate-300 print:bg-gray-100">
            <span className="text-slate-500 print:text-gray-600 block">التاريخ</span>
            <p className="font-bold text-slate-900 print:text-black">{orderDate.toLocaleDateString('ar-EG')}</p>
          </div>
          <div className="bg-slate-50 p-2 text-center border-l border-slate-300 print:bg-gray-100">
            <span className="text-slate-500 print:text-gray-600 block">اسم المخزن</span>
            <p className="font-bold text-slate-900 print:text-black">{order.store_name_ref || 'المخزن الرئيسي'}</p>
          </div>
          <div className="bg-emerald-50 p-2 text-center print:bg-gray-200">
            <span className="text-emerald-800 print:text-gray-700 block font-bold">فاتورة رقم</span>
            <p className="font-black text-emerald-900 print:text-black text-base font-mono">#{formatNumber(cleanInvNum)}</p>
          </div>
        </div>

        {/* Customer & Delegate Info */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="border border-slate-200 rounded-lg p-3 print:rounded-none">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-slate-500 text-xs block">العميل / المتجر</span>
                <p className="font-bold text-slate-900">{order.customer?.store_name || order.customer?.full_name || 'سوبر ماركت الإخلاص'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">كود العميل بالمخزن</span>
                <p className="font-bold text-slate-900 font-mono">#{formatNumber(cleanCustomerCode)}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">العنوان</span>
                <p className="font-bold text-slate-900">{order.delivery_address || order.customer?.address || 'المخزن الرئيسي / تسليم مباشر'}</p>
              </div>
              <div>
                <span className="text-slate-500 text-xs block">التليفون</span>
                <p className="font-bold text-slate-900 font-mono">{order.contact_phone || order.customer?.phone || '01066918217'}</p>
              </div>
            </div>
          </div>
          <div className="border border-slate-200 rounded-lg p-3 print:rounded-none flex flex-col justify-center">
            <span className="text-slate-500 text-xs block mb-1">المندوب المسئول</span>
            <p className="font-bold text-slate-900 text-base">{order.delegate_name || 'مندوب التوزيع المعتمد'}</p>
          </div>
        </div>

        {/* Items Table */}
        <table className="invoice-table w-full border-collapse border border-slate-300 rounded-lg overflow-hidden mb-4 text-sm">
          <thead>
            <tr className="bg-slate-100 print:bg-gray-100">
              <th className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-800">كود الصنف</th>
              <th className="border border-slate-300 px-3 py-2 text-right font-bold text-slate-800">إسم الصنف</th>
              <th className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-800">الوحدة</th>
              <th className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-800">الكمية</th>
              <th className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-800">السعر (ج.م)</th>
              <th className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-800">الخصم</th>
              <th className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-800">الإجمالي (ج.م)</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items && order.order_items.length > 0 ? (
              order.order_items.map((item, idx) => {
                const itemSku = item.product?.sku_code || item.product?.sku || (item.product_id ? String(item.product_id).replace(/\D/g, '').slice(-3) : '') || String(10 + idx);
                const unitPrice = Number(item.unit_price || 0);
                const qty = Number(item.quantity || 1);
                const itemTotal = Number(item.total_price || qty * unitPrice);
                const baseTotal = ((item.product?.base_price || unitPrice) * qty);
                const discount = Math.max(0, baseTotal - itemTotal);

                return (
                  <tr key={item.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70 print:bg-gray-50'}>
                    <td className="border border-slate-300 px-3 py-2 text-center font-mono font-bold text-slate-900 text-xs">
                      {formatNumber(itemSku)}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 font-bold text-slate-900">{item.product?.name || (item as any).name || 'صنف غذائي'}</td>
                    <td className="border border-slate-300 px-3 py-2 text-center text-slate-700">{item.product?.wholesale_unit || item.product?.unit || 'كرتونة'}</td>
                    <td className="border border-slate-300 px-3 py-2 text-center font-black text-slate-900 font-mono">{formatNumber(qty)}</td>
                    <td className="border border-slate-300 px-3 py-2 text-center font-bold font-mono text-slate-900">{formatNumber(unitPrice)}</td>
                    <td className="border border-slate-300 px-3 py-2 text-center text-red-600 font-mono">
                      {discount > 0 ? formatNumber(discount) : '—'}
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-center font-black font-mono text-slate-900">{formatNumber(itemTotal)}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="border border-slate-300 px-3 py-2 text-center font-mono font-bold">10</td>
                <td className="border border-slate-300 px-3 py-2 font-bold">توريد بضائع ومواد غذائية عامة</td>
                <td className="border border-slate-300 px-3 py-2 text-center">كرتونة</td>
                <td className="border border-slate-300 px-3 py-2 text-center font-bold">1</td>
                <td className="border border-slate-300 px-3 py-2 text-center font-bold">{formatNumber(invTotal)}</td>
                <td className="border border-slate-300 px-3 py-2 text-center text-red-600">—</td>
                <td className="border border-slate-300 px-3 py-2 text-center font-black">{formatNumber(invTotal)}</td>
              </tr>
            )}
            {/* Alignment rows */}
            {(order.order_items?.length || 1) < 6 && Array.from({ length: 6 - (order.order_items?.length || 1) }).map((_, i) => (
              <tr key={`empty-${i}`}>
                <td className="border border-slate-300 px-3 py-2">&nbsp;</td>
                <td className="border border-slate-300 px-3 py-2"></td>
                <td className="border border-slate-300 px-3 py-2"></td>
                <td className="border border-slate-300 px-3 py-2"></td>
                <td className="border border-slate-300 px-3 py-2"></td>
                <td className="border border-slate-300 px-3 py-2"></td>
                <td className="border border-slate-300 px-3 py-2"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Financial Summary & Settlement Box (ملخص الحساب والتسديد أسفل الفاتورة) */}
        <div className="grid grid-cols-5 gap-2 text-xs border-2 border-slate-800 rounded-xl overflow-hidden mb-4 print:rounded-none">
          <div className="bg-slate-100 p-3 text-center border-l border-slate-300">
            <span className="text-slate-600 font-bold block mb-1">إجمالي الفاتورة</span>
            <p className="font-black text-base text-slate-900 font-mono">{formatPriceShort(invTotal)}</p>
          </div>
          <div className="bg-emerald-50 p-3 text-center border-l border-slate-300">
            <span className="text-emerald-800 font-bold block mb-1">المدفوع مقدماً (كاش)</span>
            <p className="font-black text-base text-emerald-700 font-mono">{formatPriceShort(paidCash)}</p>
          </div>
          <div className="bg-orange-50 p-3 text-center border-l border-slate-300">
            <span className="text-orange-800 font-bold block mb-1">المبلغ المتبقي (آجل)</span>
            <p className="font-black text-base text-orange-700 font-mono">{formatPriceShort(remainingDebt)}</p>
          </div>
          <div className="bg-slate-50 p-3 text-center border-l border-slate-300">
            <span className="text-slate-600 font-bold block mb-1">الرصيد السابق للعميل</span>
            <p className="font-black text-base text-slate-800 font-mono">{formatPriceShort(prevBalance)}</p>
          </div>
          <div className="bg-red-50 p-3 text-center">
            <span className="text-red-800 font-bold block mb-1">الرصيد الحالي بعد الفاتورة</span>
            <p className="font-black text-base text-red-700 font-mono">{formatPriceShort(currentBalanceAfter)}</p>
          </div>
        </div>

        {/* Tafqeed Bar */}
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-center mb-4 print:border-black print:bg-gray-100">
          <p className="font-bold text-amber-900 print:text-black text-sm">
            تفقيد المبلغ: <span className="font-extrabold">{tafqeedEGP(invTotal)}</span>
          </p>
        </div>

        {/* Contact Footer */}
        <div className="invoice-footer text-center border-2 border-brand-700 rounded-xl p-3 bg-brand-50 print:bg-gray-100 print:rounded-none print:border-black">
          <p className="font-bold text-brand-800 text-sm print:text-black">
            للتواصل والمبيعات: {BRAND.contacts.join(' | ')}
          </p>
        </div>
      </div>
    </>
  );
}

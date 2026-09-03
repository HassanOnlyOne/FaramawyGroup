import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { logAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getNextPurchaseInvoiceNumber(adminClient: any): Promise<string> {
  try {
    const { data: purchases } = await adminClient
      .from('purchases')
      .select('invoice_no, invoice_number')
      .order('created_at', { ascending: false })
      .limit(100);

    let maxNum = 20000;
    if (purchases && purchases.length > 0) {
      for (const pur of purchases) {
        const num1 = parseInt(String(pur.invoice_no || '').replace(/\D/g, ''), 10);
        const num2 = parseInt(String(pur.invoice_number || '').replace(/\D/g, ''), 10);
        if (!isNaN(num1) && num1 >= 20000 && num1 < 9999999) {
          if (num1 > maxNum) maxNum = num1;
        }
        if (!isNaN(num2) && num2 >= 20000 && num2 < 9999999) {
          if (num2 > maxNum) maxNum = num2;
        }
      }
    }
    return String(maxNum + 1);
  } catch {
    return '20001';
  }
}

// دالة موحدة لحساب رصيد المورد بدقة: رصيد أول المدة + فواتير المشتريات الآجلة - سدادات الدفعات
async function recalculateSupplierBalance(adminClient: any, supplierId: string) {
  if (!supplierId) return;

  // 1. جلب بيانات المورد لمعرفة الرصيد الافتتاحي
  const { data: supplier } = await adminClient
    .from('suppliers')
    .select('*')
    .eq('id', supplierId)
    .maybeSingle();

  if (!supplier) return;

  const openingBalance = Number(
    supplier.opening_balance ?? supplier.initial_balance ?? supplier.previous_balance ?? 0
  );

  // 2. جلب جميع فواتير المشتريات التابعة لهذا المورد
  const { data: supPurchases } = await adminClient
    .from('purchases')
    .select('total, total_amount, paid_amount, remaining_amount')
    .eq('supplier_id', supplierId);

  const purchasesRemaining = (supPurchases || []).reduce((sum: number, p: any) => {
    const t = Number(p.total ?? p.total_amount ?? 0);
    const pd = Number(p.paid_amount || 0);
    const r = Number(p.remaining_amount !== undefined && p.remaining_amount !== null ? p.remaining_amount : Math.max(0, t - pd));
    return sum + r;
  }, 0);

  // 3. جلب مدفوعات الموردين إن وُجد جدول لسداد الموردين
  let totalSupplierPayments = 0;
  try {
    const { data: supPayments } = await adminClient
      .from('supplier_payments')
      .select('amount')
      .eq('supplier_id', supplierId);
    if (supPayments) {
      totalSupplierPayments = supPayments.reduce((acc: number, sp: any) => acc + Number(sp.amount || 0), 0);
    }
  } catch {}

  // 4. الرصيد التراكمي الصحيح
  const finalBalance = Math.max(0, (openingBalance + purchasesRemaining) - totalSupplierPayments);

  await adminClient
    .from('suppliers')
    .update({ 
      balance: finalBalance,
      current_balance: finalBalance
    })
    .eq('id', supplierId);
}

export async function GET(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    let { data: purchases, error } = await adminClient
      .from('purchases')
      .select('*, supplier:suppliers(id, name, company_name, phone)')
      .order('created_at', { ascending: false });

    if (error || !purchases) {
      const fb = await supabase
        .from('purchases')
        .select('*, supplier:suppliers(id, name, company_name, phone)')
        .order('created_at', { ascending: false });
      purchases = fb.data;
    }

    const formattedPurchases = (purchases || []).map((p: any) => {
      const tot = Number(p.total !== undefined && p.total !== null ? p.total : (p.total_amount || 0));
      const pd = Number(p.paid_amount || 0);
      const rem = Number(p.remaining_amount !== undefined && p.remaining_amount !== null ? p.remaining_amount : Math.max(0, tot - pd));
      return {
        ...p,
        invoice_no: p.invoice_no || p.invoice_number || `PUR-${String(p.id).slice(0, 6)}`,
        invoice_number: p.invoice_number || p.invoice_no || `PUR-${String(p.id).slice(0, 6)}`,
        total: tot,
        total_amount: tot,
        paid_amount: pd,
        remaining_amount: rem
      };
    });

    return NextResponse.json({ success: true, data: formattedPurchases, purchases: formattedPurchases }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const body = await req.json();
    const { 
      supplier_id, 
      supplier_name,
      invoice_number, 
      invoice_no, 
      total_amount, 
      total, 
      paid_amount, 
      remaining_amount, 
      notes, 
      items 
    } = body;

    const invoiceNum = (invoice_number || invoice_no) 
      ? String(invoice_number || invoice_no).replace(/\D/g, '') || await getNextPurchaseInvoiceNumber(adminClient)
      : await getNextPurchaseInvoiceNumber(adminClient);

    let computedItemsTotal = 0;
    if (Array.isArray(items) && items.length > 0) {
      computedItemsTotal = items.reduce((sum: number, it: any) => {
        const qty = Number(it.quantity || 1);
        const price = Number(it.unit_price || it.price || 0);
        return sum + (it.total_price ? Number(it.total_price) : qty * price);
      }, 0);
    }

    const totalVal = computedItemsTotal > 0 
      ? computedItemsTotal 
      : Number(total_amount !== undefined ? total_amount : (total !== undefined ? total : 0));
      
    const paidVal = Number(paid_amount || 0);
    const remVal = Number(remaining_amount !== undefined ? remaining_amount : Math.max(0, totalVal - paidVal));

    const payloadAllFields = {
      supplier_id: supplier_id || null,
      invoice_no: invoiceNum,
      invoice_number: invoiceNum,
      total: totalVal,
      total_amount: totalVal,
      paid_amount: paidVal,
      remaining_amount: remVal,
      items: Array.isArray(items) ? items : [],
      notes: notes || null,
      created_at: new Date().toISOString()
    };

    let purchaseData: any = null;
    let purchaseError: any = null;

    const res1 = await adminClient.from('purchases').insert([payloadAllFields]).select().maybeSingle();
    purchaseData = res1.data;
    purchaseError = res1.error;

    if (purchaseError || !purchaseData) {
      console.warn('Purchase attempt 1 failed, trying fallback columns...', purchaseError?.message);
      
      const payloadFallback: any = {
        supplier_id: supplier_id || null,
        invoice_no: invoiceNum,
        total: totalVal,
        paid_amount: paidVal,
        notes: notes || null,
        created_at: new Date().toISOString()
      };

      const res2 = await adminClient.from('purchases').insert([payloadFallback]).select().maybeSingle();
      if (res2.data) {
        purchaseData = res2.data;
        purchaseError = null;
      } else {
        const resFb = await supabase.from('purchases').insert([payloadFallback]).select().maybeSingle();
        purchaseData = resFb.data;
        purchaseError = resFb.error;
      }
    }

    if (purchaseError && !purchaseData) {
      console.error('Purchase insert error:', purchaseError);
      return NextResponse.json({ success: false, error: purchaseError.message || 'فشل حفظ فاتورة المشتريات' }, { status: 400 });
    }

    // زيادة كميات المخزون في جدول المنتجات
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const prodId = item.product_id || item.id;
        const qty = Number(item.quantity || 0);
        if (prodId && qty > 0) {
          const { data: prod } = await adminClient.from('products').select('stock_quantity').eq('id', prodId).maybeSingle();
          if (prod) {
            const currentStock = Number(prod.stock_quantity || 0);
            const newStock = currentStock + qty;
            await adminClient.from('products').update({ stock_quantity: newStock }).eq('id', prodId);
          }
        }
      }
    }

    // إعادة حساب رصيد المورد التراكمي (أول المدة + فواتير المشتريات)
    if (supplier_id) {
      await recalculateSupplierBalance(adminClient, supplier_id);
    }

    await logAction({
      actionType: 'تسجيل فاتورة مشتريات',
      category: 'المشتريات والموردين',
      details: `تسجيل فاتورة مشتريات #${invoiceNum} من مورد (${supplier_name || 'مورد عام'}) بإجمالي ${totalVal} ج.م ومسدد ${paidVal} ج.م ومتبقي ${remVal} ج.م`
    });

    return NextResponse.json({
      success: true,
      data: {
        ...purchaseData,
        total: totalVal,
        total_amount: totalVal,
        paid_amount: paidVal,
        remaining_amount: remVal,
        invoice_no: invoiceNum
      },
      message: 'تم تسجيل فاتورة المشتريات وتحديث المخزون ورصيد المورد بنجاح'
    }, { status: 201 });
  } catch (err: any) {
    console.error('Purchase POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const body = await req.json();
    const { 
      id,
      supplier_id, 
      supplier_name,
      invoice_number, 
      invoice_no, 
      total_amount, 
      total, 
      paid_amount, 
      remaining_amount, 
      notes, 
      items 
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'معرف الفاتورة مطلوب للتعديل' }, { status: 400 });
    }

    const { data: existingPurchase } = await adminClient
      .from('purchases')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!existingPurchase) {
      return NextResponse.json({ success: false, error: 'فاتورة المشتريات غير موجودة' }, { status: 404 });
    }

    let computedItemsTotal = 0;
    if (Array.isArray(items) && items.length > 0) {
      computedItemsTotal = items.reduce((sum: number, it: any) => {
        const qty = Number(it.quantity || 1);
        const price = Number(it.unit_price || it.price || 0);
        return sum + (it.total_price ? Number(it.total_price) : qty * price);
      }, 0);
    }

    const totalVal = computedItemsTotal > 0 
      ? computedItemsTotal 
      : Number(total_amount !== undefined ? total_amount : (total !== undefined ? total : Number(existingPurchase.total || 0)));
      
    const paidVal = Number(paid_amount !== undefined ? paid_amount : Number(existingPurchase.paid_amount || 0));
    const remVal = Number(remaining_amount !== undefined ? remaining_amount : Math.max(0, totalVal - paidVal));
    const invNum = invoice_no || invoice_number || existingPurchase.invoice_no || existingPurchase.invoice_number;

    const oldItems = Array.isArray(existingPurchase.items) ? existingPurchase.items : [];
    
    for (const oldIt of oldItems) {
      const prodId = oldIt.product_id || oldIt.id;
      const oldQty = Number(oldIt.quantity || 0);
      if (prodId && oldQty > 0) {
        const { data: prod } = await adminClient.from('products').select('stock_quantity').eq('id', prodId).maybeSingle();
        if (prod) {
          const currentStock = Number(prod.stock_quantity || 0);
          const revertedStock = Math.max(0, currentStock - oldQty);
          await adminClient.from('products').update({ stock_quantity: revertedStock }).eq('id', prodId);
        }
      }
    }

    if (Array.isArray(items) && items.length > 0) {
      for (const newIt of items) {
        const prodId = newIt.product_id || newIt.id;
        const newQty = Number(newIt.quantity || 0);
        if (prodId && newQty > 0) {
          const { data: prod } = await adminClient.from('products').select('stock_quantity').eq('id', prodId).maybeSingle();
          if (prod) {
            const currentStock = Number(prod.stock_quantity || 0);
            const updatedStock = currentStock + newQty;
            await adminClient.from('products').update({ stock_quantity: updatedStock }).eq('id', prodId);
          }
        }
      }
    }

    const updatePayloadAll: any = {
      supplier_id: supplier_id !== undefined ? (supplier_id || null) : existingPurchase.supplier_id,
      invoice_no: invNum,
      invoice_number: invNum,
      total: totalVal,
      total_amount: totalVal,
      paid_amount: paidVal,
      remaining_amount: remVal,
      items: Array.isArray(items) ? items : existingPurchase.items,
      notes: notes !== undefined ? notes : existingPurchase.notes,
      updated_at: new Date().toISOString()
    };

    let { data: updatedData, error: updateError } = await adminClient
      .from('purchases')
      .update(updatePayloadAll)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateError || !updatedData) {
      const updatePayloadFallback: any = {
        supplier_id: supplier_id !== undefined ? (supplier_id || null) : existingPurchase.supplier_id,
        invoice_no: invNum,
        total: totalVal,
        paid_amount: paidVal,
        notes: notes !== undefined ? notes : existingPurchase.notes,
        updated_at: new Date().toISOString()
      };

      const resFb = await adminClient
        .from('purchases')
        .update(updatePayloadFallback)
        .eq('id', id)
        .select()
        .maybeSingle();

      updatedData = resFb.data;
      updateError = resFb.error;
    }

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 400 });
    }

    // إعادة ضبط رصيد المورد التراكمي
    const effectiveSupId = supplier_id || existingPurchase.supplier_id;
    if (effectiveSupId) {
      await recalculateSupplierBalance(adminClient, effectiveSupId);
    }

    await logAction({
      actionType: 'تعديل فاتورة مشتريات',
      category: 'المشتريات والموردين',
      details: `تعديل فاتورة مشتريات #${invNum} بإجمالي ${totalVal} ج.م ومسدد ${paidVal} ج.م ومتبقي ${remVal} ج.م وضبط المخزون تلقائياً`
    });

    return NextResponse.json({
      success: true,
      data: updatedData || { id, ...updatePayloadAll },
      message: 'تم تعديل فاتورة المشتريات وضبط المخزون بنجاح'
    }, { status: 200 });

  } catch (err: any) {
    console.error('Purchase PUT error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const { searchParams } = new URL(req.url);
    let purchaseId = searchParams.get('id');

    if (!purchaseId) {
      const body = await req.json().catch(() => ({}));
      purchaseId = body.id;
    }

    if (!purchaseId) {
      return NextResponse.json({ success: false, error: 'معرف فاتورة المشتريات مطلوب للحذف' }, { status: 400 });
    }

    const { data: purchase } = await adminClient
      .from('purchases')
      .select('*')
      .eq('id', purchaseId)
      .maybeSingle();

    if (!purchase) {
      return NextResponse.json({ success: false, error: 'فاتورة المشتريات غير موجودة' }, { status: 404 });
    }

    const items = Array.isArray(purchase.items) ? purchase.items : [];
    for (const item of items) {
      const prodId = item.product_id || item.id;
      const qty = Number(item.quantity || 0);
      if (prodId && qty > 0) {
        const { data: prod } = await adminClient.from('products').select('stock_quantity').eq('id', prodId).maybeSingle();
        if (prod) {
          const currentStock = Number(prod.stock_quantity || 0);
          const newStock = Math.max(0, currentStock - qty);
          await adminClient.from('products').update({ stock_quantity: newStock }).eq('id', prodId);
        }
      }
    }

    const { error: delError } = await adminClient.from('purchases').delete().eq('id', purchaseId);
    if (delError) {
      await supabase.from('purchases').delete().eq('id', purchaseId);
    }

    // إعادة ضبط رصيد المورد بعد الحذف
    if (purchase.supplier_id) {
      await recalculateSupplierBalance(adminClient, purchase.supplier_id);
    }

    const invNum = purchase.invoice_no || purchase.invoice_number || purchaseId;
    await logAction({
      actionType: 'حذف فاتورة مشتريات',
      category: 'المشتريات والموردين',
      details: `تم حذف فاتورة المشتريات #${invNum} وعكس الكميات المضافة للمخزون وضبط رصيد المورد`
    });

    return NextResponse.json({
      success: true,
      message: 'تم حذف فاتورة المشتريات وعكس كميات المخزون وتحديث رصيد المورد بنجاح'
    }, { status: 200 });

  } catch (err: any) {
    console.error('Purchase DELETE error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
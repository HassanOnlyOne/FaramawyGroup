import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { logActivity } from '@/lib/auditLogger';

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

    // Calculate total from items if items are provided
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

    // Attempt 1: Full payload
    const res1 = await adminClient.from('purchases').insert([payloadAllFields]).select().maybeSingle();
    purchaseData = res1.data;
    purchaseError = res1.error;

    // Attempt 2: If failed with column error, strip non-core columns
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

    // Automatically increase product stock quantities in products table
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

    // Automatically update supplier debt in suppliers table
    if (supplier_id) {
      const { data: supPurchases } = await adminClient
        .from('purchases')
        .select('total, total_amount, paid_amount, remaining_amount')
        .eq('supplier_id', supplier_id);

      let totalSupDebt = remVal;
      if (supPurchases && supPurchases.length > 0) {
        totalSupDebt = supPurchases.reduce((sum: number, p: any) => {
          const t = Number(p.total || p.total_amount || 0);
          const pd = Number(p.paid_amount || 0);
          const r = Number(p.remaining_amount !== undefined && p.remaining_amount !== null ? p.remaining_amount : Math.max(0, t - pd));
          return sum + r;
        }, 0);
      }

      await adminClient.from('suppliers').update({ balance: totalSupDebt }).eq('id', supplier_id);
    }

    await logActivity(
      'تسجيل فاتورة مشتريات',
      `تسجيل فاتورة مشتريات #${invoiceNum} من مورد (${supplier_name || 'مورد عام'}) بإجمالي ${totalVal} ج.م ومتبقي ${remVal} ج.م`,
      'purchases'
    );

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
      message: 'تم تسجيل فاتورة المشتريات وتحديث المخزون بنجاح'
    }, { status: 201 });
  } catch (err: any) {
    console.error('Purchase POST error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

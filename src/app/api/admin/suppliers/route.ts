import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { logSystemActivity } from '@/lib/auditLogger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    let { data: suppliers, error } = await adminClient.from('suppliers').select('*').order('created_at', { ascending: false });
    if (error || !suppliers) {
      const fb = await supabase.from('suppliers').select('*').order('created_at', { ascending: false });
      suppliers = fb.data || [];
    }

    const { data: allPurchases } = await adminClient
      .from('purchases')
      .select('supplier_id, supplier_name, total, total_amount, paid_amount, remaining_amount');

    const purchasesList = Array.isArray(allPurchases) ? allPurchases : [];

    const formattedSuppliers = (suppliers || []).map((sup: any) => {
      const supPurchases = purchasesList.filter((p: any) => {
        if (p.supplier_id && p.supplier_id === sup.id) return true;
        if (sup.name && p.supplier_name && String(p.supplier_name).toLowerCase().includes(String(sup.name).toLowerCase())) return true;
        if (sup.company_name && p.supplier_name && String(p.supplier_name).toLowerCase().includes(String(sup.company_name).toLowerCase())) return true;
        return false;
      });

      const actualBalance = Number(sup.current_balance !== undefined && sup.current_balance !== null ? sup.current_balance : (sup.balance || 0));

      return {
        ...sup,
        balance: actualBalance,
        current_balance: actualBalance,
        current_debt: actualBalance,
        purchases_count: supPurchases.length
      };
    });

    return new NextResponse(JSON.stringify({
      success: true,
      data: formattedSuppliers,
      suppliers: formattedSuppliers
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const body = await req.json();
    const { name, company_name, phone, initial_balance, balance, notes } = body;

    const supplierName = (name || company_name || 'مورد عام').trim();
    const supplierCompany = (company_name || name || '').trim();
    const numBalance = Number(initial_balance ?? balance ?? 0);

    const payload: any = {
      name: supplierName,
      company_name: supplierCompany,
      phone: phone?.trim() || null,
      balance: numBalance,
      current_balance: numBalance,
      notes: notes?.trim() || null,
      created_at: new Date().toISOString()
    };

    let { data, error } = await adminClient.from('suppliers').insert([payload]).select().maybeSingle();
    
    if (error && (error.code === 'PGRST204' || error.message.includes('balance') || error.message.includes('current_balance'))) {
      const minimalPayload = {
        name: supplierName,
        company_name: supplierCompany,
        phone: phone?.trim() || null,
        notes: notes?.trim() || null,
        created_at: new Date().toISOString()
      };
      const retry = await adminClient.from('suppliers').insert([minimalPayload]).select().maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      const fb = await supabase.from('suppliers').insert([payload]).select().maybeSingle();
      data = fb.data;
      error = fb.error;
    }

    if (error && !data) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    await logSystemActivity(
      'إضافة مورد جديد',
      `تسجيل مورد جديد: ${supplierName} (${supplierCompany}) برصيد افتتاحي ${numBalance} ج.م`,
      'purchases'
    );

    return NextResponse.json({ success: true, data, supplier: data, message: 'تم حفظ المورد بنجاح' }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const body = await req.json();
    const { id, name, company_name, phone, balance, current_balance, notes, payment_amount } = body;

    if (!id) return NextResponse.json({ success: false, error: 'معرف المورد مطلوب' }, { status: 400 });

    // Fetch existing supplier
    let { data: existing } = await adminClient.from('suppliers').select('*').eq('id', id).maybeSingle();
    if (!existing) {
      const fb = await supabase.from('suppliers').select('*').eq('id', id).maybeSingle();
      existing = fb.data;
    }

    if (!existing) return NextResponse.json({ success: false, error: 'المورد غير موجود' }, { status: 404 });

    const updates: any = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updates.name = name.trim();
    if (company_name !== undefined) updates.company_name = company_name.trim();
    if (phone !== undefined) updates.phone = phone ? phone.trim() : null;
    if (notes !== undefined) updates.notes = notes ? notes.trim() : null;

    let recordedPaymentAmount = 0;

    if (payment_amount !== undefined && Number(payment_amount) > 0) {
      recordedPaymentAmount = Number(payment_amount);
      const currentBal = Number(existing.current_balance !== undefined && existing.current_balance !== null ? existing.current_balance : (existing.balance || 0));
      const newBalance = Math.max(0, currentBal - recordedPaymentAmount);
      updates.balance = newBalance;
      updates.current_balance = newBalance;

      // 1. Try calling RPC if defined
      try {
        await adminClient.rpc('record_supplier_payment', {
          p_supplier_id: id,
          p_amount: recordedPaymentAmount,
          p_notes: notes || 'سداد دفعة نقدية للمورد',
          p_user_name: 'المدير العام'
        });
      } catch {}

      // 2. Insert into supplier_payments table
      const supPaymentRecord = {
        id: `spay-${Date.now()}`,
        supplier_id: id,
        amount: recordedPaymentAmount,
        notes: notes || 'سداد دفعة نقدية للمورد',
        payment_date: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      try {
        await adminClient.from('supplier_payments').insert([supPaymentRecord]);
      } catch {}

      // 3. Update purchase invoices remaining debt
      const { data: supPurchases } = await adminClient
        .from('purchases')
        .select('*')
        .or(`supplier_id.eq.${id},supplier_name.ilike.%${existing.name}%`)
        .order('created_at', { ascending: true });

      if (supPurchases && supPurchases.length > 0) {
        let remainingToDeduct = recordedPaymentAmount;
        for (const pur of supPurchases) {
          if (remainingToDeduct <= 0) break;
          const tot = Number(pur.total || pur.total_amount || 0);
          const pd = Number(pur.paid_amount || 0);
          const rem = Number(pur.remaining_amount !== undefined && pur.remaining_amount !== null ? pur.remaining_amount : Math.max(0, tot - pd));

          if (rem > 0) {
            const deduct = Math.min(rem, remainingToDeduct);
            const newPaid = pd + deduct;
            const newRem = Math.max(0, rem - deduct);
            remainingToDeduct -= deduct;

            await adminClient
              .from('purchases')
              .update({ paid_amount: newPaid, remaining_amount: newRem })
              .eq('id', pur.id);
          }
        }
      }

      await logSystemActivity(
        'سداد دفعة للمورد',
        `سداد دفعة نقدية بقيمة ${recordedPaymentAmount} ج.م للمورد (${existing.name || existing.company_name}) - الرصيد الجديد: ${newBalance} ج.م`,
        'treasury'
      );
    } else if (balance !== undefined || current_balance !== undefined) {
      const b = Number(current_balance !== undefined ? current_balance : balance);
      updates.balance = b;
      updates.current_balance = b;
    }

    let { data: updated, error } = await adminClient.from('suppliers').update(updates).eq('id', id).select().maybeSingle();

    if (error || !updated) {
      const fb = await supabase.from('suppliers').update(updates).eq('id', id).select().maybeSingle();
      updated = fb.data || { ...existing, ...updates };
    }

    return NextResponse.json({
      success: true,
      data: updated,
      supplier: updated,
      new_balance: updates.current_balance,
      message: 'تم تحديث بيانات ورصيد المورد بنجاح'
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ success: false, error: 'معرف المورد مطلوب' }, { status: 400 });

    const res = await adminClient.from('suppliers').delete().eq('id', id);
    if (res.error) {
      await supabase.from('suppliers').delete().eq('id', id);
    }

    return NextResponse.json({ success: true, message: 'تم حذف المورد بنجاح' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

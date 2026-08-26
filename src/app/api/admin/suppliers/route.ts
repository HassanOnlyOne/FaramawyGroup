import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { logAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get('id');
    const returnPaymentsOnly = searchParams.get('payments') === 'true';

    // 1. If requesting all supplier payments (e.g. for Treasury)
    if (returnPaymentsOnly) {
      let payments: any[] = [];
      try {
        const { data, error } = await adminClient
          .from('supplier_payments')
          .select('*, supplier:suppliers(id, name, company_name)')
          .order('payment_date', { ascending: false });
        if (!error && data) {
          payments = data;
        } else {
          const fb = await supabase
            .from('supplier_payments')
            .select('*, supplier:suppliers(id, name, company_name)')
            .order('payment_date', { ascending: false });
          payments = fb.data || [];
        }
      } catch {}

      return NextResponse.json({ success: true, data: payments, payments });
    }

    // 2. If requesting detailed statement for a specific supplier
    if (supplierId) {
      let { data: supplier } = await adminClient
        .from('suppliers')
        .select('*')
        .eq('id', supplierId)
        .maybeSingle();

      if (!supplier) {
        const fb = await supabase.from('suppliers').select('*').eq('id', supplierId).maybeSingle();
        supplier = fb.data;
      }

      if (!supplier) {
        return NextResponse.json({ success: false, error: 'المورد غير موجود' }, { status: 404 });
      }

      // Fetch all purchases for this supplier
      const { data: purchasesData } = await adminClient
        .from('purchases')
        .select('*')
        .or(`supplier_id.eq.${supplierId},supplier_name.ilike.%${supplier.name || supplier.company_name}%`)
        .order('created_at', { ascending: false });

      // Fetch all payments made to this supplier
      let paymentsData: any[] = [];
      try {
        let { data: pays, error: pErr } = await adminClient
          .from('supplier_payments')
          .select('*')
          .eq('supplier_id', supplierId)
          .order('created_at', { ascending: false });

        if (pErr || !pays) {
          const fb = await supabase
            .from('supplier_payments')
            .select('*')
            .eq('supplier_id', supplierId)
            .order('created_at', { ascending: false });
          pays = fb.data;
        }
        paymentsData = pays || [];
      } catch {}

      const purchases = purchasesData || [];
      const payments = paymentsData || [];
      const currentBalance = Number(supplier.current_balance !== undefined && supplier.current_balance !== null ? supplier.current_balance : (supplier.balance || 0));

      return NextResponse.json({
        success: true,
        supplier: {
          ...supplier,
          balance: currentBalance,
          current_balance: currentBalance
        },
        purchases,
        payments
      });
    }

    // 3. List all suppliers with calculated balances
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
    const numBalance = Number(balance || initial_balance || 0);

    const payload: any = {
      id: crypto.randomUUID(),
      name: supplierName,
      company_name: supplierCompany,
      phone: phone ? phone.trim() : null,
      balance: numBalance,
      current_balance: numBalance,
      initial_balance: numBalance,
      notes: notes ? notes.trim() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let { data, error } = await adminClient.from('suppliers').insert([payload]).select().maybeSingle();

    if (error && (error.message?.includes('initial_balance') || error.message?.includes('current_balance'))) {
      const fallback = { ...payload };
      delete fallback.initial_balance;
      delete fallback.current_balance;
      const retry = await adminClient.from('suppliers').insert([fallback]).select().maybeSingle();
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

    // Resolve user details
    const { data: { user: callerUser } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    let callerName = '';
    let callerRole = '';
    if (callerUser) {
      const { data: callerProf } = await adminClient.from('profiles').select('full_name, role').eq('id', callerUser.id).maybeSingle();
      callerName = callerProf?.full_name || callerUser.email?.split('@')[0] || '';
      callerRole = callerProf?.role || '';
    }

    await logAction({
      actionType: 'إضافة مورد جديد',
      category: 'المشتريات والموردين',
      details: `قام ${callerName || 'المشرف'} بتسجيل مورد جديد: ${supplierName} (${supplierCompany}) برصيد افتتاحي ${numBalance} ج.م`,
      user: { id: callerUser?.id, name: callerName, role: callerRole }
    });

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
    const supplierTitle = existing.company_name || existing.name || 'مورد';

    // Resolve caller user
    const { data: { user: callerUser } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    let callerName = '';
    let callerRole = '';
    if (callerUser) {
      const { data: callerProf } = await adminClient.from('profiles').select('full_name, role').eq('id', callerUser.id).maybeSingle();
      callerName = callerProf?.full_name || callerUser.email?.split('@')[0] || '';
      callerRole = callerProf?.role || '';
    }

    if (payment_amount !== undefined && Number(payment_amount) > 0) {
      recordedPaymentAmount = Number(payment_amount);
      const currentBal = Number(existing.current_balance !== undefined && existing.current_balance !== null ? existing.current_balance : (existing.balance || 0));
      const newBalance = Math.max(0, currentBal - recordedPaymentAmount);
      updates.balance = newBalance;
      updates.current_balance = newBalance;

      // 1. Insert into supplier_payments table
      const supPaymentRecord: any = {
        id: crypto.randomUUID(),
        supplier_id: id,
        amount: recordedPaymentAmount,
        payment_method: 'كاش نقدي',
        notes: notes || `سداد نقدي لحساب المورد ${supplierTitle}`,
        created_by: callerUser?.id || null,
        payment_date: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      try {
        const { error: payErr } = await adminClient.from('supplier_payments').insert([supPaymentRecord]);
        if (payErr && (payErr.message?.includes('payment_method') || payErr.message?.includes('created_by'))) {
          const fallback = { ...supPaymentRecord };
          delete fallback.payment_method;
          delete fallback.created_by;
          await adminClient.from('supplier_payments').insert([fallback]);
        }
      } catch (errSup) {
        console.warn('supplier_payments insert warning:', errSup);
      }

      // 2. Insert into treasury_transactions table for Treasury outflow tracking
      const treasuryEntry = {
        id: crypto.randomUUID(),
        transaction_type: 'سداد دفعة مورد',
        inflow: 0,
        outflow: recordedPaymentAmount,
        party: supplierTitle,
        party_id: id,
        notes: `سداد نقدي لحساب المورد ${supplierTitle}${notes ? ` (${notes})` : ''}`,
        created_at: new Date().toISOString(),
        created_by: callerUser?.id || null
      };

      try {
        await adminClient.from('treasury_transactions').insert([treasuryEntry]);
      } catch (errTx) {
        console.warn('treasury_transactions insert warning:', errTx);
      }

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

      // 4. Log in audit_logs with exact user name format
      await logAction({
        actionType: 'سداد دفعة للمورد',
        category: 'الخزينة والتحصيلات',
        details: `قام ${callerName || 'المشرف'} بسداد دفعة نقدية بقيمة ${recordedPaymentAmount} ج.م للمورد (${supplierTitle}) - الرصيد الجديد: ${newBalance} ج.م`,
        user: { id: callerUser?.id, name: callerName, role: callerRole }
      });

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
      new_balance: updates.balance,
      message: recordedPaymentAmount > 0 ? 'تم تسجيل سداد الدفعة وخصمها من رصيد المورد والخزينة بنجاح' : 'تم حفظ التعديلات بنجاح'
    }, { status: 200 });

  } catch (err: any) {
    console.error('Supplier PUT error:', err);
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

    const { data: existing } = await adminClient.from('suppliers').select('name, company_name').eq('id', id).maybeSingle();

    const { error } = await adminClient.from('suppliers').delete().eq('id', id);
    if (error) {
      await supabase.from('suppliers').delete().eq('id', id);
    }

    const { data: { user: callerUser } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    let callerName = '';
    if (callerUser) {
      const { data: callerProf } = await adminClient.from('profiles').select('full_name').eq('id', callerUser.id).maybeSingle();
      callerName = callerProf?.full_name || callerUser.email?.split('@')[0] || '';
    }

    await logAction({
      actionType: 'حذف مورد',
      category: 'المشتريات والموردين',
      details: `قام ${callerName || 'المشرف'} بحذف المورد (${existing?.company_name || existing?.name || id}) نهائياً من النظام`,
      user: { id: callerUser?.id, name: callerName }
    });

    return NextResponse.json({ success: true, message: 'تم حذف المورد بنجاح' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

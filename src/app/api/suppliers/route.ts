import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

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

    // Fetch all purchases to aggregate supplier debts
    const { data: allPurchases } = await adminClient
      .from('purchases')
      .select('supplier_id, total, total_amount, paid_amount, remaining_amount');

    const purchasesList = Array.isArray(allPurchases) ? allPurchases : [];

    const formattedSuppliers = (suppliers || []).map((sup: any) => {
      const supPurchases = purchasesList.filter((p: any) => p.supplier_id === sup.id);
      const purchasesDebt = supPurchases.reduce((sum: number, p: any) => {
        const tot = Number(p.total !== undefined && p.total !== null ? p.total : (p.total_amount || 0));
        const pd = Number(p.paid_amount || 0);
        const rem = Number(p.remaining_amount !== undefined && p.remaining_amount !== null ? p.remaining_amount : Math.max(0, tot - pd));
        return sum + rem;
      }, 0);

      const finalDebt = Math.max(purchasesDebt, Number(sup.current_balance ?? sup.balance ?? 0));

      return {
        ...sup,
        company: sup.company || sup.company_name || '',
        company_name: sup.company_name || sup.company || '',
        balance: finalDebt,
        current_balance: finalDebt,
        opening_balance: Number(sup.opening_balance ?? sup.initial_balance ?? finalDebt),
        initial_balance: Number(sup.initial_balance ?? sup.opening_balance ?? finalDebt),
        current_debt: finalDebt,
        purchases_count: supPurchases.length
      };
    });

    return NextResponse.json({ success: true, data: formattedSuppliers, suppliers: formattedSuppliers }, { status: 200 });
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
      name, 
      company, 
      company_name, 
      phone, 
      initial_balance, 
      balance, 
      current_balance, 
      opening_balance, 
      notes 
    } = body;

    const supplierName = (name || company_name || company || 'مورد عام').trim();
    const supplierCompany = (company || company_name || name || '').trim();
    const numBalance = Number(balance ?? current_balance ?? opening_balance ?? initial_balance ?? 0);

    const basePayload: any = {
      id: crypto.randomUUID(),
      name: supplierName,
      company: supplierCompany,
      company_name: supplierCompany,
      phone: phone?.trim() || null,
      balance: numBalance,
      current_balance: numBalance,
      opening_balance: numBalance,
      initial_balance: numBalance,
      notes: notes?.trim() || null,
      created_at: new Date().toISOString()
    };

    let payload = { ...basePayload };
    let data: any = null;
    let error: any = null;

    for (let i = 0; i < 7; i++) {
      const res = await adminClient.from('suppliers').insert([payload]).select().maybeSingle();
      if (!res.error && res.data) {
        data = res.data;
        error = null;
        break;
      }
      error = res.error;
      const errMsg = error?.message || '';

      const match = errMsg.match(/column "([^"]+)" of relation "suppliers" does not exist/i)
                 || errMsg.match(/Could not find the '([^']+)' column/i);
      if (match && match[1] && match[1] in payload) {
        delete payload[match[1]];
        continue;
      }

      if (errMsg.includes('opening_balance') && 'opening_balance' in payload) {
        delete payload.opening_balance;
        continue;
      }
      if (errMsg.includes('initial_balance') && 'initial_balance' in payload) {
        delete payload.initial_balance;
        continue;
      }
      if (errMsg.includes('current_balance') && 'current_balance' in payload) {
        delete payload.current_balance;
        continue;
      }
      if (errMsg.includes('company_name') && 'company_name' in payload) {
        delete payload.company_name;
        continue;
      }
      if (errMsg.includes('company') && 'company' in payload) {
        delete payload.company;
        continue;
      }
      if (errMsg.includes('id') && 'id' in payload) {
        delete payload.id;
        continue;
      }
      break;
    }

    if (error || !data) {
      let fbPayload = { ...payload };
      for (let i = 0; i < 7; i++) {
        const fb = await supabase.from('suppliers').insert([fbPayload]).select().maybeSingle();
        if (!fb.error && fb.data) {
          data = fb.data;
          error = null;
          break;
        }
        error = fb.error;
        const errMsg = error?.message || '';
        const match = errMsg.match(/column "([^"]+)" of relation "suppliers" does not exist/i)
                   || errMsg.match(/Could not find the '([^']+)' column/i);
        if (match && match[1] && match[1] in fbPayload) {
          delete fbPayload[match[1]];
          continue;
        }
        break;
      }
    }

    if (error && !data) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    const normalizedData = {
      ...data,
      company: data?.company || data?.company_name || supplierCompany,
      company_name: data?.company_name || data?.company || supplierCompany,
      balance: numBalance,
      current_balance: numBalance,
      opening_balance: numBalance,
      initial_balance: numBalance
    };

    return NextResponse.json({ success: true, data: normalizedData, supplier: normalizedData, message: 'تم حفظ المورد بنجاح' }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

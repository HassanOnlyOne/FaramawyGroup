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

      const finalDebt = Math.max(purchasesDebt, Number(sup.balance || 0));

      return {
        ...sup,
        balance: finalDebt,
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
    const { name, company_name, phone, initial_balance, balance, notes } = body;

    const supplierName = (name || company_name || 'مورد عام').trim();
    const supplierCompany = (company_name || name || '').trim();
    const numBalance = Number(initial_balance ?? balance ?? 0);

    const payload: any = {
      name: supplierName,
      company_name: supplierCompany,
      phone: phone?.trim() || null,
      balance: numBalance,
      notes: notes?.trim() || null,
      created_at: new Date().toISOString()
    };

    let { data, error } = await adminClient.from('suppliers').insert([payload]).select().maybeSingle();
    
    if (error || !data) {
      const fb = await supabase.from('suppliers').insert([payload]).select().maybeSingle();
      data = fb.data;
      error = fb.error;
    }

    if (error && !data) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data, supplier: data, message: 'تم حفظ المورد بنجاح' }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

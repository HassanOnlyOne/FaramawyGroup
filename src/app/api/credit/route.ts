import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function cleanPhone(p: any): string {
  return String(p || '').replace(/\D/g, '');
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    
    let profile: any = null;
    let targetUserId = user?.id;

    if (targetUserId) {
      let { data: p } = await adminClient.from('profiles').select('*').eq('id', targetUserId).maybeSingle();
      if (!p) {
        const fb = await supabase.from('profiles').select('*').eq('id', targetUserId).maybeSingle();
        p = fb.data;
      }
      profile = p;
    }

    // Fallback: search by customer_code parameter or phone
    if (!profile) {
      const url = new URL(req.url);
      const customerCode = url.searchParams.get('code') || url.searchParams.get('customer_code');
      const phone = url.searchParams.get('phone');
      
      if (customerCode) {
        const cleanCode = String(customerCode).replace(/\D/g, '');
        const { data: pByCode } = await adminClient.from('profiles').select('*').eq('customer_code', cleanCode).maybeSingle();
        profile = pByCode;
        if (profile) targetUserId = profile.id;
      } else if (phone) {
        const cleanP = cleanPhone(phone);
        const { data: pByPhone } = await adminClient.from('profiles').select('*').eq('phone', cleanP).maybeSingle();
        profile = pByPhone;
        if (profile) targetUserId = profile.id;
      }
    }

    if (!profile) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - يرجى تسجيل الدخول أولاً',
        authenticated: false
      }, { status: 401 });
    }

    // Sanitize customer_code & credit enablement
    profile.customer_code = profile.customer_code ? String(profile.customer_code).replace(/\D/g, '') : '1004';
    
    const isCreditActive = profile.is_credit_enabled !== undefined 
      ? Boolean(profile.is_credit_enabled) 
      : (profile.credit_enabled !== undefined ? Boolean(profile.credit_enabled) : (Number(profile.credit_limit || 0) > 0));
    
    profile.is_credit_enabled = isCreditActive;
    profile.credit_enabled = isCreditActive;

    // Fetch all orders
    const { data: allOrders } = await adminClient
      .from('orders')
      .select('id, order_number, invoice_no, total, total_amount, paid_amount, remaining_amount, payment_method, status, created_at, customer_id, contact_phone, store_code')
      .order('created_at', { ascending: false });

    const safeAllOrders = Array.isArray(allOrders) ? allOrders : [];
    const profPhoneClean = cleanPhone(profile.phone);

    // Match orders belonging to this customer
    let matchedOrders = safeAllOrders.filter((o: any) => {
      if (targetUserId && o.customer_id === targetUserId) return true;
      if (profile.id && o.customer_id === profile.id) return true;
      if (profPhoneClean && cleanPhone(o.contact_phone) === profPhoneClean) return true;
      if (o.store_code && String(o.store_code).replace(/\D/g, '') === profile.customer_code) return true;
      return false;
    });

    if (matchedOrders.length === 0 && safeAllOrders.length > 0) {
      matchedOrders = safeAllOrders.filter((o: any) => {
        const isCredit = o.payment_method === 'credit';
        const t = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
        const p = Number(o.paid_amount || 0);
        const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : (isCredit ? Math.max(0, t - p) : 0));
        return isCredit || rem > 0;
      });
    }

    // Non-pending, non-cancelled/returned orders (Active/Approved/Completed)
    const approvedActiveOrders = matchedOrders.filter((o: any) => !['pending', 'cancelled', 'returned'].includes(o.status));
    
    // Pending orders (held for credit limit calculation only)
    const pendingOrders = matchedOrders.filter((o: any) => o.status === 'pending');

    // Fetch payments
    let payments: any[] = [];
    try {
      const { data: dbPayments } = await adminClient
        .from('customer_payments')
        .select('*')
        .order('created_at', { ascending: false });
      if (dbPayments && dbPayments.length > 0) {
        payments = dbPayments;
      } else {
        const { data: oldPays } = await adminClient
          .from('payments')
          .select('*')
          .order('created_at', { ascending: false });
        if (oldPays) payments = oldPays;
      }
    } catch {}

    // Match payments for this customer
    const customerPayments = payments.filter((p: any) => {
      if (targetUserId && (p.customer_id === targetUserId || p.customer?.id === targetUserId)) return true;
      if (profile.id && (p.customer_id === profile.id || p.customer?.id === profile.id)) return true;
      if (profile.customer_code && (String(p.customer_code || '').includes(profile.customer_code) || String(p.customer?.customer_code || '').includes(profile.customer_code))) return true;
      return false;
    });

    const totalPaidSum = customerPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    // Calculate actual approved outstanding debt from credit orders ONLY minus customer payments
    const grossApprovedDebt = approvedActiveOrders.reduce((sum: number, o: any) => {
      const isCredit = o.payment_method === 'credit';
      const ordTotal = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
      const ordPaid = Number(o.paid_amount || 0);
      const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : (isCredit ? Math.max(0, ordTotal - ordPaid) : 0));
      
      // Strict Cash Exclusion: pure cash orders with remaining 0 are excluded
      if (!isCredit && rem <= 0) return sum;
      return sum + rem;
    }, 0);

    // Reserved credit from pending orders
    const reservedCredit = pendingOrders.reduce((sum: number, o: any) => {
      const isCredit = o.payment_method === 'credit';
      const ordTotal = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
      const ordPaid = Number(o.paid_amount || 0);
      const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : (isCredit ? Math.max(0, ordTotal - ordPaid) : 0));
      if (!isCredit && rem <= 0) return sum;
      return sum + rem;
    }, 0);

    const directProfileDebt = Number(profile.current_debt !== undefined && profile.current_debt !== null ? profile.current_debt : (profile.previous_balance || 0));
    const currentDebt = grossApprovedDebt > 0 
      ? Math.max(0, grossApprovedDebt - totalPaidSum) 
      : (customerPayments.length > 0 ? 0 : directProfileDebt);

    const creditLimit = Number(profile.credit_limit || 0);
    const availableCredit = Math.max(0, creditLimit - (currentDebt + reservedCredit));

    // List of official approved credit orders for statement of account
    const creditWithdrawals = approvedActiveOrders
      .filter((o: any) => {
        const isCredit = o.payment_method === 'credit';
        const ordTotal = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
        const ordPaid = Number(o.paid_amount || 0);
        const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : (isCredit ? Math.max(0, ordTotal - ordPaid) : 0));
        return isCredit || rem > 0;
      })
      .map((o: any) => {
        const isCredit = o.payment_method === 'credit';
        const ordTotal = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
        const ordPaid = Number(o.paid_amount || 0);
        const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : (isCredit ? Math.max(0, ordTotal - ordPaid) : 0));
        const invNumber = o.invoice_no || o.order_number || `1000${String(o.id).slice(0, 3)}`;
        return {
          id: o.id,
          order_number: invNumber,
          invoice_no: invNumber,
          total: ordTotal,
          paid_amount: ordPaid,
          remaining_amount: rem,
          payment_method: 'credit',
          status: o.status || 'completed',
          created_at: o.created_at
        };
      });

    return new NextResponse(JSON.stringify({
      success: true,
      profile: {
        ...profile,
        current_debt: currentDebt,
        previous_balance: currentDebt
      },
      is_credit_enabled: isCreditActive,
      current_debt: currentDebt,
      reserved_credit: reservedCredit,
      credit_limit: creditLimit,
      available_credit: availableCredit,
      credit_orders: creditWithdrawals,
      payments: customerPayments
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
      }
    });
  } catch (error: any) {
    console.error('Credit API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

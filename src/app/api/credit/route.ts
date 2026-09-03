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

    // البحث كخيار بديل عبر المعلمات
    if (!profile) {
      const url = new URL(req.url);
      const customerCode = url.searchParams.get('code') || url.searchParams.get('customer_code');
      const phone = url.searchParams.get('phone');
      
      if (customerCode) {
        const { data: pByCode } = await adminClient.from('profiles').select('*').eq('customer_code', customerCode).maybeSingle();
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

    const isCreditActive = profile.is_credit_enabled !== undefined 
      ? Boolean(profile.is_credit_enabled) 
      : (profile.credit_enabled !== undefined ? Boolean(profile.credit_enabled) : (Number(profile.credit_limit || 0) > 0));
    
    profile.is_credit_enabled = isCreditActive;
    profile.credit_enabled = isCreditActive;

    // جلب طلبات هذا العميل فقط بالاعتماد على id العميل حصراً
    const { data: matchedOrders } = await adminClient
      .from('orders')
      .select('id, order_number, invoice_no, total, total_amount, paid_amount, remaining_amount, payment_method, status, created_at, customer_id, contact_phone, store_code')
      .eq('customer_id', targetUserId)
      .order('created_at', { ascending: false });

    const safeOrders = Array.isArray(matchedOrders) ? matchedOrders : [];

    // تصفية الطلبات النشطة واستبعاد الملغاة والمعلقة
    const approvedActiveOrders = safeOrders.filter((o: any) => !['pending', 'cancelled', 'returned'].includes(o.status));
    const pendingOrders = safeOrders.filter((o: any) => o.status === 'pending');

    // جلب سندات السداد الخاصة بهذا المستخدم فقط
    let customerPayments: any[] = [];
    try {
      const { data: dbPayments } = await adminClient
        .from('customer_payments')
        .select('*')
        .eq('customer_id', targetUserId)
        .order('created_at', { ascending: false });

      if (dbPayments && dbPayments.length > 0) {
        customerPayments = dbPayments;
      } else {
        const { data: oldPays } = await adminClient
          .from('payments')
          .select('*')
          .eq('customer_id', targetUserId)
          .order('created_at', { ascending: false });
        if (oldPays) customerPayments = oldPays;
      }
    } catch {}

    const totalPaidSum = customerPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    // حساب إجمالي المتبقي من فواتير الآجل
    const grossApprovedDebt = approvedActiveOrders.reduce((sum: number, o: any) => {
      const isCredit = o.payment_method === 'credit';
      const ordTotal = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
      const ordPaid = Number(o.paid_amount || 0);
      const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : (isCredit ? Math.max(0, ordTotal - ordPaid) : 0));
      
      if (!isCredit && rem <= 0) return sum;
      return sum + (rem > 0 ? rem : ordTotal);
    }, 0);

    const reservedCredit = pendingOrders.reduce((sum: number, o: any) => {
      const isCredit = o.payment_method === 'credit';
      const ordTotal = Number(o.total !== undefined && o.total !== null ? o.total : (o.total_amount || 0));
      const ordPaid = Number(o.paid_amount || 0);
      const rem = Number(o.remaining_amount !== undefined && o.remaining_amount !== null ? o.remaining_amount : (isCredit ? Math.max(0, ordTotal - ordPaid) : 0));
      if (!isCredit && rem <= 0) return sum;
      return sum + rem;
    }, 0);

    const currentDebt = Math.max(0, grossApprovedDebt - totalPaidSum);
    const creditLimit = Number(profile.credit_limit || 0);
    const availableCredit = Math.max(0, creditLimit - (currentDebt + reservedCredit));

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
        const invNumber = o.invoice_no || o.order_number || String(o.id).slice(0, 8);
        return {
          id: o.id,
          order_number: invNumber,
          invoice_no: invNumber,
          total: ordTotal,
          paid_amount: ordPaid,
          remaining_amount: rem > 0 ? rem : ordTotal,
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
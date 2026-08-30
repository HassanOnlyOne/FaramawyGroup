import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// In-memory fallback array for password reset requests if table isn't created yet in DB
let inMemoryResetRequests: Array<{ id: string; phone_or_email: string; status: string; created_at: string }> = [];

// GET: Fetch pending password reset requests
export async function GET() {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    let pendingRequests: any[] = [];
    let dbError = null;

    try {
      const { data, error } = await adminClient
        .from('password_reset_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (!error && data) {
        pendingRequests = data;
      } else {
        dbError = error;
      }
    } catch (e) {
      dbError = e;
    }

    // Fallback if table doesn't exist in Supabase DB
    if (dbError || pendingRequests.length === 0) {
      const pendingMemory = inMemoryResetRequests.filter(r => r.status === 'pending');
      if (pendingMemory.length > 0) {
        pendingRequests = pendingMemory;
      }
    }

    return NextResponse.json({
      success: true,
      data: pendingRequests,
      count: pendingRequests.length
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, data: [], count: 0 }, { status: 500 });
  }
}

// POST: Create a new password reset request
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const phoneOrEmail = (body.phone_or_email || body.phone || body.email || body.inputValue || '').trim();

    if (!phoneOrEmail) {
      return NextResponse.json({ success: false, error: 'رقم الهاتف أو البريد المطلوب مفود' }, { status: 400 });
    }

    const newRequest = {
      id: crypto.randomUUID(),
      phone_or_email: phoneOrEmail,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const adminClient = createAdminClient();
    let inserted = null;

    try {
      const { data, error } = await adminClient
        .from('password_reset_requests')
        .insert([newRequest])
        .select()
        .maybeSingle();

      if (!error && data) {
        inserted = data;
      }
    } catch (err) {
      console.warn('DB insert password_reset_requests warning:', err);
    }

    // Add to in-memory fallback array
    inMemoryResetRequests.unshift(newRequest);
    if (inMemoryResetRequests.length > 500) inMemoryResetRequests.pop();

    // Log action to audit_logs
    await logAction({
      actionType: 'طلب استرجاع كلمة مرور',
      category: 'الأمان والصلاحيات',
      details: `تم تقديم طلب استرجاع كلمة مرور جديد من الرقم/البريد: (${phoneOrEmail})`
    });

    return NextResponse.json({
      success: true,
      message: 'تم تسجيل طلب استرجاع كلمة المرور بنجاح، سيتواصل معك فريق الإدارة قريباً',
      data: inserted || newRequest
    }, { status: 201 });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH: Resolve a password reset request
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = body.id || body.requestId;
    const phoneOrEmail = body.phone_or_email;

    if (!id && !phoneOrEmail) {
      return NextResponse.json({ success: false, error: 'معرف الطلب أو رقم الهاتف مطلوب' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Update in DB if available
    try {
      if (id) {
        await adminClient
          .from('password_reset_requests')
          .update({ status: 'resolved', updated_at: new Date().toISOString() })
          .eq('id', id);
      } else if (phoneOrEmail) {
        await adminClient
          .from('password_reset_requests')
          .update({ status: 'resolved', updated_at: new Date().toISOString() })
          .eq('phone_or_email', phoneOrEmail);
      }
    } catch (err) {
      console.warn('DB update password_reset_requests warning:', err);
    }

    // Update in memory fallback
    inMemoryResetRequests = inMemoryResetRequests.map(r => {
      if (r.id === id || r.phone_or_email === phoneOrEmail) {
        return { ...r, status: 'resolved' };
      }
      return r;
    });

    const targetCustomer = body.customer_name || body.userName || phoneOrEmail || 'العميل';

    // Log action to audit_logs
    await logAction({
      actionType: 'حل طلب استرجاع كلمة مرور',
      category: 'الأمان والصلاحيات',
      details: `قام المشرف بحل طلب استرجاع كلمة المرور للعميل (${targetCustomer})`
    });

    return NextResponse.json({
      success: true,
      message: 'تم تحديث حالة الطلب إلى تم الحل بنجاح'
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

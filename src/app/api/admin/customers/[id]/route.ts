import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const adminClient = createAdminClient();
    const supabase = await createClient();

    let { data: profile, error } = await adminClient.from('profiles').select('*').eq('id', id).single();
    if (error || !profile) {
      const fbRes = await supabase.from('profiles').select('*').eq('id', id).single();
      profile = fbRes.data;
    }

    if (!profile) {
      return NextResponse.json({ success: false, error: 'العميل غير موجود' }, { status: 404 });
    }

    return new NextResponse(JSON.stringify({ success: true, data: profile, profile }), {
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

async function handleCustomerUpdate(req: NextRequest, id: string) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const body = await req.json();
    const updatesObj = body.updates || body;

    const updates: any = {};
    if (updatesObj.credit_limit !== undefined) updates.credit_limit = Number(updatesObj.credit_limit);
    if (updatesObj.previous_balance !== undefined) updates.previous_balance = Number(updatesObj.previous_balance);
    if (updatesObj.customer_code !== undefined) updates.customer_code = String(updatesObj.customer_code).replace(/\D/g, '');
    if (updatesObj.store_name !== undefined) updates.store_name = updatesObj.store_name;
    if (updatesObj.full_name !== undefined) updates.full_name = updatesObj.full_name;
    if (updatesObj.role !== undefined) updates.role = updatesObj.role;

    if (updatesObj.is_credit_enabled !== undefined) {
      updates.is_credit_enabled = Boolean(updatesObj.is_credit_enabled);
      updates.credit_enabled = Boolean(updatesObj.is_credit_enabled);
    } else if (updatesObj.credit_enabled !== undefined) {
      updates.is_credit_enabled = Boolean(updatesObj.credit_enabled);
      updates.credit_enabled = Boolean(updatesObj.credit_enabled);
    }

    let { data, error } = await adminClient.from('profiles').update(updates).eq('id', id).select().single();

    // Fallback if one of the column variants does not exist in the database table schema
    if (error && (error.code === 'PGRST204' || error.message.includes('credit_enabled') || error.message.includes('is_credit_enabled'))) {
      const fallbackUpdates = { ...updates };
      delete fallbackUpdates.is_credit_enabled;
      delete fallbackUpdates.credit_enabled;
      
      if (updatesObj.is_credit_enabled !== undefined || updatesObj.credit_enabled !== undefined) {
        const val = Boolean(updatesObj.is_credit_enabled ?? updatesObj.credit_enabled);
        // Try credit_enabled first
        fallbackUpdates.credit_enabled = val;
      }
      
      let retry = await adminClient.from('profiles').update(fallbackUpdates).eq('id', id).select().single();
      if (retry.error) {
        // Try is_credit_enabled
        delete fallbackUpdates.credit_enabled;
        fallbackUpdates.is_credit_enabled = Boolean(updatesObj.is_credit_enabled ?? updatesObj.credit_enabled);
        retry = await adminClient.from('profiles').update(fallbackUpdates).eq('id', id).select().single();
      }
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      const res = await supabase.from('profiles').update(updates).eq('id', id).select().single();
      data = res.data;
      if (res.error) throw res.error;
    }

    return NextResponse.json({ success: true, data, profile: data, message: 'تم تحديث بيانات العميل بنجاح' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return handleCustomerUpdate(req, id);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return handleCustomerUpdate(req, id);
}

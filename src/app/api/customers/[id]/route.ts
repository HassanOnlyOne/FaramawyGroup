import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

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
      return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ data: profile, profile }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
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
    if (updatesObj.customer_code !== undefined) updates.customer_code = String(updatesObj.customer_code);
    if (updatesObj.store_name !== undefined) updates.store_name = updatesObj.store_name;
    if (updatesObj.full_name !== undefined) updates.full_name = updatesObj.full_name;
    if (updatesObj.credit_enabled !== undefined) updates.credit_enabled = Boolean(updatesObj.credit_enabled);
    if (updatesObj.role !== undefined) updates.role = updatesObj.role;

    let { data, error } = await adminClient.from('profiles').update(updates).eq('id', id).select().single();

    // Fallback if credit_enabled column is missing in schema
    if (error && (error.message.includes('credit_enabled') || error.code === 'PGRST204')) {
      delete updates.credit_enabled;
      const retry = await adminClient.from('profiles').update(updates).eq('id', id).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      delete updates.credit_enabled;
      const res = await supabase.from('profiles').update(updates).eq('id', id).select().single();
      data = res.data;
      if (res.error) throw res.error;
    }

    return NextResponse.json({ data, message: 'تم تحديث بيانات العميل بنجاح' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
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

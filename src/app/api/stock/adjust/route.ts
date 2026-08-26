import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAction } from '@/lib/audit';

async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

async function getAdminUser(supabase: any) {
  const user = await getAuthUser(supabase);
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || !['admin', 'staff', 'owner', 'manager', 'super_owner'].includes(profile.role)) return null;
  return user;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { product_id, quantity_change, reason } = await req.json();

    if (!product_id || typeof quantity_change !== 'number') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: product, error: productError } = await adminClient
      .from('products')
      .select('name, stock_quantity')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });
    }

    const oldQuantity = Number(product.stock_quantity || 0);
    const newQuantity = Math.max(0, oldQuantity + quantity_change);
    
    const { error: updateError } = await adminClient
      .from('products')
      .update({ stock_quantity: newQuantity })
      .eq('id', product_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Insert stock log
    let logRecord = null;
    try {
      const { data: log } = await adminClient
        .from('stock_logs')
        .insert([{
          product_id,
          quantity_change,
          reason,
          performed_by: adminUser.id
        }])
        .select()
        .single();
      logRecord = log;
    } catch {}

    // Resolve caller user name
    const { data: prof } = await adminClient
      .from('profiles')
      .select('full_name, role')
      .eq('id', adminUser.id)
      .maybeSingle();

    const callerName = prof?.full_name || adminUser.email?.split('@')[0] || 'مشرف النظام';

    // Record audit log with exact requested format
    await logAction({
      actionType: 'تعديل رصيد المخزون',
      category: 'عام وعمليات أخرى',
      details: `قام ${callerName} بتعديل رصيد مخزون (${product.name}) من ${oldQuantity} إلى ${newQuantity}${reason ? ` (السبب: ${reason})` : ''}`,
      user: {
        id: adminUser.id,
        name: callerName,
        role: prof?.role
      }
    });

    return NextResponse.json({ 
      success: true,
      log: logRecord, 
      stock_quantity: newQuantity,
      message: 'تم تعديل رصيد المخزون وتسجيل الحركة بنجاح' 
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

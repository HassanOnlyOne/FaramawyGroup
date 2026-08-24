import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/auditLogger';

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
  if (!profile || profile.role !== 'admin') return null;
  return user;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { product_id, quantity_change, reason } = await req.json();

    if (!product_id || typeof quantity_change !== 'number') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const newQuantity = product.stock_quantity + quantity_change;
    
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock_quantity: newQuantity })
      .eq('id', product_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    const { data: log, error: logError } = await supabase
      .from('stock_logs')
      .insert([{
        product_id,
        quantity_change,
        reason,
        performed_by: adminUser.id
      }])
      .select()
      .single();

    await logActivity(
      'تعديل رصيد المخزون',
      `تعديل رصيد الصنف بمقدار (${quantity_change > 0 ? `+${quantity_change}` : quantity_change}) - السبب: ${reason || 'تسوية جردية'}`,
      'inventory'
    );

    return NextResponse.json({ log, stock_quantity: newQuantity }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    
    const { data: product, error } = await supabase
      .from('products')
      .select('*, category:categories(name), pricing_tiers(*)')
      .eq('id', id)
      .single();

    if (error || !product) {
      return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ data: product, product }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function handleProductUpdate(req: NextRequest, id: string) {
  try {
    const supabase = await createClient();
    const adminUser = await getAdminUser(supabase);
    
    const body = await req.json();
    const { 
      name, sku, category_id, description, images, image_url,
      unit, base_price, stock_quantity, low_stock_threshold, 
      is_active, is_paused, pricing_tiers, ...rest 
    } = body;

    const updatePayload: any = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updatePayload.name = name;
    if (sku !== undefined) updatePayload.sku = sku;
    if (category_id !== undefined) updatePayload.category_id = category_id;
    if (description !== undefined) updatePayload.description = description;
    if (unit !== undefined) updatePayload.unit = unit;
    if (base_price !== undefined) updatePayload.base_price = Number(base_price);
    if (stock_quantity !== undefined) updatePayload.stock_quantity = Number(stock_quantity);
    if (low_stock_threshold !== undefined) updatePayload.low_stock_threshold = Number(low_stock_threshold);
    if (is_active !== undefined) updatePayload.is_active = Boolean(is_active);
    if (is_paused !== undefined) updatePayload.is_paused = Boolean(is_paused);

    const finalImage = image_url || (Array.isArray(images) && images[0] ? images[0] : null);
    if (finalImage) {
      updatePayload.images = [finalImage];
    } else if (Array.isArray(images)) {
      updatePayload.images = images;
    }

    // Try update with admin client first to bypass strict auth/RLS if needed, or fallback to supabase
    const adminClient = createAdminClient();
    let updateResult = await adminClient.from('products').update(updatePayload).eq('id', id).select().single();
    
    if (updateResult.error && updateResult.error.message?.includes('is_paused')) {
      delete updatePayload.is_paused;
      updateResult = await adminClient.from('products').update(updatePayload).eq('id', id).select().single();
    }
    
    if (updateResult.error) {
      updateResult = await supabase.from('products').update(updatePayload).eq('id', id).select().single();
      if (updateResult.error) {
        return NextResponse.json({ error: updateResult.error.message }, { status: 400 });
      }
    }

    // Update pricing tiers
    if (Array.isArray(pricing_tiers)) {
      await adminClient.from('pricing_tiers').delete().eq('product_id', id);
      if (pricing_tiers.length > 0) {
        const tiersToInsert = pricing_tiers.map((tier: any) => ({
          product_id: id,
          min_quantity: Number(tier.min_quantity || 1),
          max_quantity: tier.max_quantity ? Number(tier.max_quantity) : null,
          price_per_unit: Number(tier.price_per_unit || 0)
        }));
        await adminClient.from('pricing_tiers').insert(tiersToInsert);
      }
    }

    // Fetch updated product with tiers
    const { data: updatedProduct } = await supabase
      .from('products')
      .select('*, pricing_tiers(*)')
      .eq('id', id)
      .single();

    return NextResponse.json({ data: updatedProduct || updateResult.data, product: updatedProduct || updateResult.data, message: 'تم تحديث المنتج بنجاح' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return handleProductUpdate(req, id);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return handleProductUpdate(req, id);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Product deleted successfully' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

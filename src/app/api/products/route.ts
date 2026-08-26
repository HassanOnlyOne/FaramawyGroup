import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
  if (!profile || profile.role !== 'admin') return null;
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const url = new URL(req.url);
    
    const category_id = url.searchParams.get('category_id') || url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('products')
      .select(`
        *,
        category:categories(name),
        pricing_tiers(*)
      `, { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category_id) {
      query = query.eq('category_id', category_id);
    }
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: products, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ 
      data: products || [],
      products: products || [], 
      pagination: { total: count, page, limit } 
    }, { 
      status: 200, 
      headers: { 
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' 
      } 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const body = await req.json();
    const { 
      name, sku, category_id, description, images, image_url,
      unit, base_price, stock_quantity, low_stock_threshold, 
      pricing_tiers 
    } = body;

    const productImages = image_url ? [image_url] : (Array.isArray(images) ? images : []);

    const productPayload = {
      name,
      sku,
      category_id: category_id || null,
      description: description || null,
      images: productImages,
      unit: unit || 'عبوة',
      wholesale_unit: unit || 'عبوة',
      base_price: Number(base_price || 0),
      stock_quantity: Number(stock_quantity || 0),
      low_stock_threshold: Number(low_stock_threshold || 10),
      is_active: true
    };

    // 1. Insert Product using adminClient first, fallback to supabase
    let product: any = null;
    let productError: any = null;

    const resAdmin = await adminClient.from('products').insert([productPayload]).select().single();
    product = resAdmin.data;
    productError = resAdmin.error;

    if (productError || !product) {
      const resSupabase = await supabase.from('products').insert([productPayload]).select().single();
      product = resSupabase.data;
      productError = resSupabase.error;
    }

    if (productError || !product) {
      return NextResponse.json({ error: productError?.message || 'فشل إضافة المنتج' }, { status: 400 });
    }

    // 2. Insert Pricing Tiers
    if (pricing_tiers && pricing_tiers.length > 0) {
      const tiersToInsert = pricing_tiers.map((tier: any) => ({
        product_id: product.id,
        min_quantity: Number(tier.min_quantity || 1),
        max_quantity: tier.max_quantity ? Number(tier.max_quantity) : null,
        price_per_unit: Number(tier.price_per_unit || 0)
      }));

      await adminClient.from('pricing_tiers').insert(tiersToInsert);
    }

    // Fetch full product with tiers
    const { data: fullProduct } = await adminClient
      .from('products')
      .select('*, pricing_tiers(*)')
      .eq('id', product.id)
      .single();

    await logAction({
      actionType: 'إضافة صنف جديد',
      category: 'عام وعمليات أخرى',
      details: `تمت إضافة الصنف الجديد (${product.name}) بسعر ${product.base_price} ج.م ومخزون ${product.stock_quantity} ${product.wholesale_unit || 'عبوة'}`
    });

    return NextResponse.json({ 
      success: true, 
      data: fullProduct || product, 
      product: fullProduct || product,
      message: 'تم حفظ المنتج بنجاح' 
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

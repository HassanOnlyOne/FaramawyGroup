import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();
    
    let { data: categories, error } = await adminClient
      .from('categories')
      .select('*, products:products(count)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error || !categories) {
      const fb = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      categories = fb.data;
    }

    return NextResponse.json({ success: true, data: categories || [], categories: categories || [] }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const body = await req.json();
    const { name, description, image_url, sort_order } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'اسم التصنيف مطلوب' }, { status: 400 });
    }

    const payload = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description || null,
      image_url: image_url || null,
      sort_order: Number(sort_order) || 0,
      is_active: true,
      created_at: new Date().toISOString()
    };

    let { data: category, error } = await adminClient
      .from('categories')
      .insert([payload])
      .select()
      .single();

    if (error || !category) {
      const fb = await supabase
        .from('categories')
        .insert([payload])
        .select()
        .single();
      category = fb.data;
      error = fb.error;
    }

    if (error && !category) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: category, category, message: 'تم إنشاء التصنيف بنجاح' }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

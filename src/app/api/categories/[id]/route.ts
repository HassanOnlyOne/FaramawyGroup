import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const adminClient = createAdminClient();
    const supabase = await createClient();
    
    let { data: category, error } = await adminClient
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !category) {
      const fb = await supabase.from('categories').select('*').eq('id', id).single();
      category = fb.data;
    }

    if (!category) {
      return NextResponse.json({ success: false, error: 'التصنيف غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: category, category }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const adminClient = createAdminClient();
    const supabase = await createClient();
    
    const body = await req.json();
    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.description !== undefined) updates.description = body.description;
    if (body.image_url !== undefined) updates.image_url = body.image_url;
    if (body.sort_order !== undefined) updates.sort_order = Number(body.sort_order);
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);

    let { data: category, error } = await adminClient
      .from('categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !category) {
      const fb = await supabase.from('categories').update(updates).eq('id', id).select().single();
      category = fb.data;
      error = fb.error;
    }

    if (error && !category) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: category, category, message: 'تم تحديث التصنيف بنجاح' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(req, context);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const adminClient = createAdminClient();
    const supabase = await createClient();
    
    // Soft delete or deactivate
    let { error } = await adminClient
      .from('categories')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      const fb = await supabase.from('categories').update({ is_active: false }).eq('id', id);
      error = fb.error;
    }

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'تم حذف / تعطيل التصنيف بنجاح' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

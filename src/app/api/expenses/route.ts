import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    let { data: expenses, error } = await adminClient.from('expenses').select('*').order('created_at', { ascending: false });
    if (error || !expenses) {
      const fb = await supabase.from('expenses').select('*').order('created_at', { ascending: false });
      expenses = fb.data;
    }

    return NextResponse.json({ data: expenses || [], expenses: expenses || [] }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const body = await req.json();
    const { title, category, amount, notes } = body;

    const payload = {
      id: crypto.randomUUID(),
      title: title || 'مصروف عام',
      category: category || 'تشغيلي',
      amount: Number(amount || 0),
      notes: notes || null,
      created_at: new Date().toISOString()
    };

    let { data, error } = await adminClient.from('expenses').insert(payload).select().maybeSingle();
    if (error || !data) {
      const fb = await supabase.from('expenses').insert(payload).select().maybeSingle();
      data = fb.data;
      error = fb.error;
    }

    if (error && !data) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data, message: 'تم تسجيل المصروف بنجاح' }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const body = await req.json();
    const { id, title, category, amount, notes } = body;

    if (!id) return NextResponse.json({ error: 'معرف المصروف مطلوب' }, { status: 400 });

    const updates: any = {};
    if (title !== undefined) updates.title = title.trim();
    if (category !== undefined) updates.category = category;
    if (amount !== undefined) updates.amount = Number(amount);
    if (notes !== undefined) updates.notes = notes ? notes.trim() : null;

    let { data, error } = await adminClient.from('expenses').update(updates).eq('id', id).select().maybeSingle();
    if (error || !data) {
      const fb = await supabase.from('expenses').update(updates).eq('id', id).select().maybeSingle();
      data = fb.data;
      error = fb.error;
    }

    if (error) throw error;

    return NextResponse.json({ data, message: 'تم تحديث بيانات المصروف بنجاح' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'معرف المصروف مطلوب' }, { status: 400 });

    let { error } = await adminClient.from('expenses').delete().eq('id', id);
    if (error) {
      const fb = await supabase.from('expenses').delete().eq('id', id);
      error = fb.error;
    }

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'تم حذف المصروف بنجاح' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

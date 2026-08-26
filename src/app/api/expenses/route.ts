import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { logAction } from '@/lib/audit';

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
    const { title, category, amount, notes, created_by } = body;

    const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    const userCreatedBy = created_by || user?.id || null;

    const fullPayload: any = {
      id: crypto.randomUUID(),
      title: (title || 'مصروف عام').trim(),
      category: category || 'تشغيلي',
      amount: Number(amount || 0),
      notes: notes ? String(notes).trim() : null,
      created_by: userCreatedBy,
      created_at: new Date().toISOString()
    };

    let { data, error } = await adminClient.from('expenses').insert(fullPayload).select().maybeSingle();
    
    // If error might be due to created_by column not existing, retry without it
    if (error && error.message?.includes('created_by')) {
      delete fullPayload.created_by;
      const retry = await adminClient.from('expenses').insert(fullPayload).select().maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      const fb = await supabase.from('expenses').insert(fullPayload).select().maybeSingle();
      data = fb.data;
      error = fb.error;
    }

    if (error && !data) {
      return NextResponse.json({ error: error.message || 'فشل حفظ المصروف' }, { status: 400 });
    }

    // Log the expense in audit_logs
    await logAction({
      actionType: 'تسجيل مصروف نثري/تشغيلي',
      category: 'الخزينة والتحصيلات',
      details: `تسجيل مصروف (${title || 'مصروف'}) بقيمة ${amount} ج.م - تصنيف: ${category || 'تشغيلي'}`
    });

    return NextResponse.json({ success: true, data, message: 'تم تسجيل المصروف بنجاح' }, { status: 201 });
  } catch (err: any) {
    console.error('Expense POST error:', err);
    return NextResponse.json({ error: err.message || 'حدث خطأ في الخادم' }, { status: 500 });
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

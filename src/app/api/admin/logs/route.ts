import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMemoryAuditLogs, logSystemActivity } from '@/lib/auditLogger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    let dbLogs: any[] = [];
    try {
      let query = adminClient.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      if (search) {
        query = query.or(`user_name.ilike.%${search}%,action_type.ilike.%${search}%,details.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (!error && data) {
        dbLogs = data;
      } else {
        const fb = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
        dbLogs = fb.data || [];
      }
    } catch {}

    const memLogs = getMemoryAuditLogs();

    // Merge & deduplicate by ID
    const logMap = new Map<string, any>();
    memLogs.forEach(l => logMap.set(l.id, l));
    dbLogs.forEach(l => logMap.set(l.id, l));

    let mergedLogs = Array.from(logMap.values());

    if (category && category !== 'all') {
      mergedLogs = mergedLogs.filter(l => l.category === category);
    }

    if (search) {
      const q = search.toLowerCase();
      mergedLogs = mergedLogs.filter(l => 
        (l.user_name || '').toLowerCase().includes(q) ||
        (l.action_type || '').toLowerCase().includes(q) ||
        (l.details || '').toLowerCase().includes(q)
      );
    }

    mergedLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ success: true, data: mergedLogs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, data: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action_type, details, category } = body;

    const data = await logSystemActivity(
      action_type || 'عملية إدارية',
      details || 'تفاصيل الإجراء',
      category || 'general'
    );

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

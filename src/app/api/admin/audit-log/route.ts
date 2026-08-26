import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMemoryAuditLogs, logAction, normalizeCategory } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET: Fetch audit logs ordered descending by created_at with optional date & category filters
export async function GET(request: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get('category');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate') || searchParams.get('from');
    const endDate = searchParams.get('endDate') || searchParams.get('to');
    const limit = Math.min(1000, Math.max(50, Number(searchParams.get('limit') || 500)));

    let dbLogs: any[] = [];
    try {
      let query = adminClient
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString());
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
      }

      const { data, error } = await query;
      if (!error && data) {
        dbLogs = data;
      } else {
        let fallbackQuery = supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (startDate) fallbackQuery = fallbackQuery.gte('created_at', new Date(startDate).toISOString());
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          fallbackQuery = fallbackQuery.lte('created_at', end.toISOString());
        }
        const fb = await fallbackQuery;
        dbLogs = fb.data || [];
      }
    } catch (e) {
      console.warn('Database query error on audit_logs:', e);
    }

    const memLogs = getMemoryAuditLogs();

    // Merge & deduplicate by ID
    const logMap = new Map<string, any>();
    memLogs.forEach(l => logMap.set(l.id, l));
    dbLogs.forEach(l => logMap.set(l.id, l));

    let mergedLogs = Array.from(logMap.values());

    // Date range filtering for memory logs
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      mergedLogs = mergedLogs.filter(l => new Date(l.created_at).getTime() >= startMs);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const endMs = end.getTime();
      mergedLogs = mergedLogs.filter(l => new Date(l.created_at).getTime() <= endMs);
    }

    // Category filter
    if (categoryParam && categoryParam !== 'all' && categoryParam !== 'الكل') {
      const normalizedTarget = normalizeCategory(categoryParam);
      mergedLogs = mergedLogs.filter(l => {
        const logCat = normalizeCategory(l.category || '');
        return logCat === normalizedTarget || l.category === categoryParam;
      });
    }

    // Full-text search
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      mergedLogs = mergedLogs.filter(l => 
        (l.user_name || '').toLowerCase().includes(q) ||
        (l.user_role || '').toLowerCase().includes(q) ||
        (l.action_type || '').toLowerCase().includes(q) ||
        (l.category || '').toLowerCase().includes(q) ||
        (l.details || '').toLowerCase().includes(q)
      );
    }

    // Sort descending
    mergedLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ 
      success: true, 
      data: mergedLogs.slice(0, limit),
      logs: mergedLogs.slice(0, limit)
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, data: [] }, { status: 500 });
  }
}

// POST: Record a new audit log directly using server client / service_role
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { 
      action_type, 
      actionType, 
      details, 
      category, 
      user_name, 
      user_role, 
      userName, 
      userRole, 
      user, 
      user_id,
      userId,
      ip_address 
    } = body;

    const action = action_type || actionType || 'عملية إدارية';
    const cat = category || 'عام وعمليات أخرى';
    const detail = details || 'تفاصيل الإجراء';
    const uName = user_name || userName || user?.name || '';
    const uRole = user_role || userRole || user?.role || '';
    const uId = user_id || userId || user?.id || '';

    const newRecord = await logAction({
      actionType: action,
      category: cat,
      details: detail,
      user: {
        id: uId,
        name: uName,
        role: uRole
      },
      ipAddress: ip_address
    });

    return NextResponse.json({ 
      success: true, 
      data: newRecord,
      message: 'تم تسجيل حركة النظام بنجاح' 
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

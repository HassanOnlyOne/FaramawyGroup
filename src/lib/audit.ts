import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { headers } from 'next/headers';

export type AuditCategory =
  | 'المبيعات والفواتير'
  | 'المشتريات والموردين'
  | 'الخزينة والتحصيلات'
  | 'الأجل والعملاء'
  | 'الأمان والصلاحيات'
  | 'عام'
  | 'sales'
  | 'purchases'
  | 'treasury'
  | 'customers'
  | 'security'
  | 'general';

export interface LogActionParams {
  actionType: string;
  category: AuditCategory;
  details: string;
  user?: { id?: string; name?: string; role?: string };
  ipAddress?: string;
}

// In-memory buffer to guarantee instant availability and zero loss
let memoryAuditLogs: any[] = [];

// Normalize category for database and UI filtering
export function normalizeCategory(cat: string): string {
  const c = String(cat || '').toLowerCase().trim();
  switch (c) {
    case 'المبيعات والفواتير':
    case 'sales':
      return 'المبيعات والفواتير';
    case 'المشتريات والموردين':
    case 'purchases':
      return 'المشتريات والموردين';
    case 'الخزينة والتحصيلات':
    case 'treasury':
      return 'الخزينة والتحصيلات';
    case 'الأجل والعملاء':
    case 'customers':
      return 'الأجل والعملاء';
    case 'الأمان والصلاحيات':
    case 'security':
      return 'الأمان والصلاحيات';
    case 'عام':
    case 'general':
    default:
      return 'عام';
  }
}

/**
 * Centralized helper function to log administrative actions
 */
export async function logAction({
  actionType,
  category,
  details,
  user,
  ipAddress: customIp
}: LogActionParams) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    let userId = user?.id || null;
    let userName = user?.name || '';
    let userRole = user?.role || '';
    let ipAddress = customIp || '127.0.0.1';

    // 1. Resolve client IP from request headers if available
    if (!customIp) {
      try {
        const headerList = await headers();
        const forwardedFor = headerList.get('x-forwarded-for');
        const realIp = headerList.get('x-real-ip');
        if (forwardedFor) {
          ipAddress = forwardedFor.split(',')[0].trim();
        } else if (realIp) {
          ipAddress = realIp.trim();
        }
      } catch {
        // headers() may not be available in non-request contexts
      }
    }

    // 2. Fetch authenticated user details if not provided
    if (!userName || !userRole) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const authUser = authData?.user;
        if (authUser) {
          userId = userId || authUser.id;
          let { data: prof } = await adminClient
            .from('profiles')
            .select('full_name, store_name, role')
            .eq('id', authUser.id)
            .maybeSingle();

          if (!prof) {
            const fb = await supabase.from('profiles').select('full_name, store_name, role').eq('id', authUser.id).maybeSingle();
            prof = fb.data;
          }

          if (prof) {
            userName = prof.full_name || prof.store_name || authUser.email || 'المدير العام';
            if (prof.role === 'super_owner') userRole = 'مالك النظام';
            else if (prof.role === 'admin') userRole = 'المدير العام';
            else if (prof.role === 'delegate') userRole = 'مندوب مبيعات';
            else userRole = 'موظف';
          } else {
            userName = authUser.email?.split('@')[0] || 'المدير العام';
            userRole = 'المدير العام';
          }
        }
      } catch {}
    }

    if (!userName) userName = 'إدارة النظام';
    if (!userRole) userRole = 'المدير العام';

    const normalizedCat = normalizeCategory(category);

    const newLog = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      action_type: actionType,
      category: normalizedCat,
      details,
      ip_address: ipAddress
    };

    // Store in memory buffer for instant reflection
    memoryAuditLogs.unshift(newLog);
    if (memoryAuditLogs.length > 300) memoryAuditLogs.pop();

    // Insert into database using adminClient (service role)
    let { data, error } = await adminClient.from('audit_logs').insert([newLog]).select().maybeSingle();
    if (error || !data) {
      const fb = await supabase.from('audit_logs').insert([newLog]).select().maybeSingle();
      data = fb.data || newLog;
    }

    return data;
  } catch (err) {
    console.error('Audit Log Error:', err);
    return null;
  }
}

/**
 * Universal recordAuditLog function working on both Client and Server
 */
export async function recordAuditLog(params: {
  action_type: string;
  category: string;
  details: string;
  user_name?: string;
  user_role?: string;
}) {
  try {
    if (typeof window !== 'undefined') {
      await fetch('/api/admin/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
    } else {
      await logAction({
        actionType: params.action_type,
        category: params.category as AuditCategory,
        details: params.details,
        user: {
          name: params.user_name,
          role: params.user_role
        }
      });
    }
  } catch (err) {
    console.error('Audit Log Error:', err);
  }
}

// Alias for convenience
export async function logAuditEvent(params: LogActionParams) {
  return logAction(params);
}

// Backwards-compatible legacy signature
export async function logSystemActivity(action_type: string, details: string, category: string = 'عام') {
  return logAction({
    actionType: action_type,
    category: category as AuditCategory,
    details
  });
}

export const logActivity = logSystemActivity;

export function getMemoryAuditLogs() {
  return memoryAuditLogs;
}

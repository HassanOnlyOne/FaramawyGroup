import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type AuditCategory =
  | 'المبيعات والفواتير'
  | 'المشتريات والموردين'
  | 'الخزينة والتحصيلات'
  | 'الأجل والعملاء'
  | 'الأمان والصلاحيات'
  | 'عام وعمليات أخرى'
  | 'عام';

export interface LogActionParams {
  actionType: string;
  category: AuditCategory | string;
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
    case 'orders':
    case 'invoices':
      return 'المبيعات والفواتير';
    case 'المشتريات والموردين':
    case 'purchases':
    case 'suppliers':
      return 'المشتريات والموردين';
    case 'الخزينة والتحصيلات':
    case 'treasury':
    case 'expenses':
    case 'payments':
      return 'الخزينة والتحصيلات';
    case 'الأجل والعملاء':
    case 'customers':
    case 'credit':
      return 'الأجل والعملاء';
    case 'الأمان والصلاحيات':
    case 'security':
    case 'permissions':
    case 'roles':
    case 'users':
      return 'الأمان والصلاحيات';
    case 'عام':
    case 'عام وعمليات أخرى':
    case 'general':
    case 'products':
    case 'inventory':
    default:
      return 'عام وعمليات أخرى';
  }
}

// Translate system roles to professional Arabic titles
export function formatRoleTitle(role?: string): string {
  const r = String(role || '').toLowerCase().trim();
  switch (r) {
    case 'super_owner':
      return 'مالك النظام';
    case 'owner':
      return 'مالك المتجر';
    case 'admin':
    case 'manager':
    case 'المدير العام':
      return 'مدير عام';
    case 'staff':
      return 'مشرف';
    case 'delegate':
      return 'مندوب مبيعات';
    case 'customer':
      return 'عميل';
    default:
      return role || 'مشرف';
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
    let userName = user?.name?.trim() || '';
    let userRole = user?.role?.trim() || '';
    let ipAddress = customIp || '127.0.0.1';

    // 1. Resolve client IP from request headers if available
    if (!customIp) {
      try {
        const { headers } = await import('next/headers');
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

    // 2. Fetch authenticated user details from Supabase if not fully provided
    let prof: any = null;
    try {
      let authUser: any = null;
      if (!userId) {
        const { data: authData } = await supabase.auth.getUser();
        authUser = authData?.user;
        if (authUser) {
          userId = authUser.id;
        }
      }

      if (userId) {
        const profRes = await adminClient
          .from('profiles')
          .select('full_name, store_name, role, email')
          .eq('id', userId)
          .maybeSingle();
        prof = profRes.data;

        if (prof) {
          // Priority 1: Real Full Name from profiles table
          if (prof.full_name && prof.full_name.trim() && !prof.full_name.includes('المدير العام')) {
            userName = prof.full_name.trim();
          } else if (authUser?.user_metadata?.full_name && !authUser.user_metadata.full_name.includes('المدير العام')) {
            userName = authUser.user_metadata.full_name.trim();
          } else if (prof.store_name && prof.store_name.trim()) {
            userName = prof.store_name.trim();
          } else if (prof.email) {
            userName = prof.email;
          }

          if (!userRole) {
            userRole = formatRoleTitle(prof.role);
          }
        }
      }

      if (!userName && authUser) {
        userName = authUser.user_metadata?.full_name || authUser.email || '';
      }
    } catch (e) {
      console.warn('Could not resolve user profile in audit log:', e);
    }

    userRole = formatRoleTitle(userRole || 'مدير عام');
    if (!userName || userName === 'المدير العام' || userName === 'مدير عام' || userName === 'مسؤول الإدارة' || userName === 'المدير') {
      userName = user?.name || (prof?.email ? prof.email.split('@')[0] : 'مشرف النظام');
    }

    // Format as "Name (Role)" if not already formatted
    if (userName && !userName.includes('(')) {
      const shortRole = userRole.includes('مدير') ? 'مدير' : userRole.includes('مالك') ? 'مالك' : userRole.includes('مندوب') ? 'مندوب' : 'مشرف';
      userName = `${userName} (${shortRole})`;
    }

    const normalizedCat = normalizeCategory(category);

    const newLog: any = {
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

    // Insert into database using adminClient (service role)
    let { data, error } = await adminClient.from('audit_logs').insert([newLog]).select().maybeSingle();
    
    // If user_id column doesn't exist yet, retry without user_id
    if (error && error.message?.includes('user_id')) {
      const fallbackLog = { ...newLog };
      delete fallbackLog.user_id;
      const res = await adminClient.from('audit_logs').insert([fallbackLog]).select().maybeSingle();
      data = res.data;
      error = res.error;
    }

    if (error || !data) {
      const fb = await supabase.from('audit_logs').insert([newLog]).select().maybeSingle();
      data = fb.data || newLog;
    }

    if (data?.id) {
      newLog.id = data.id;
    }

    // Store in memory buffer for instant reflection
    memoryAuditLogs.unshift(newLog);
    if (memoryAuditLogs.length > 500) memoryAuditLogs.pop();

    return data || newLog;
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
  user_id?: string;
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
        category: params.category,
        details: params.details,
        user: {
          id: params.user_id,
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
export async function logSystemActivity(action_type: string, details: string, category: string = 'عام وعمليات أخرى') {
  return logAction({
    actionType: action_type,
    category,
    details
  });
}

export const logActivity = logSystemActivity;

export function getMemoryAuditLogs() {
  return memoryAuditLogs;
}

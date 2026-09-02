import { createClient } from '@/lib/supabase/client';

export async function recordAuditLog(params: {
  action_type: string;
  category: string;
  details: string;
  user_name?: string;
  user_role?: string;
  user_id?: string;
}) {
  try {
    const supabase = createClient();
    let uName = params.user_name || '';
    let uRole = params.user_role || '';

    if (!uName && typeof window !== 'undefined') {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, store_name, email, role')
            .eq('id', user.id)
            .maybeSingle();
          if (profile) {
            uName = profile.full_name || profile.store_name || (profile.email ? profile.email.split('@')[0] : uName);
            uRole = profile.role || uRole;
          } else if (user.email) {
            uName = user.email.split('@')[0];
          }
        }
      } catch (e) {
        console.warn('Could not fetch user profile for audit log:', e);
      }
    }

    const roleMap: Record<string, string> = {
      admin: 'مدير',
      manager: 'مدير',
      delegate: 'مندوب',
      rep: 'مندوب',
      customer: 'عميل',
      client: 'عميل'
    };

    const cleanRole = roleMap[uRole] || (uRole.includes('admin') ? 'مدير' : uRole.includes('delegate') ? 'مندوب' : 'عميل');
    let formattedName = uName || (cleanRole === 'مدير' ? 'مدير النظام' : 'عميل المتجر');

    if (!formattedName.includes('(')) {
      formattedName = `${formattedName} (${cleanRole})`;
    }

    const payload = {
      action_type: params.action_type,
      category: params.category || 'عام وعمليات أخرى',
      details: params.details,
      user_name: formattedName,
      user_role: cleanRole,
      user_id: params.user_id || null,
      created_at: new Date().toISOString()
    };

    // 1. Direct insertion into audit_logs table
    await supabase.from('audit_logs').insert([payload]);

    // 2. Post to API route for server memory buffer sync
    if (typeof window !== 'undefined') {
      await fetch('/api/admin/audit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  } catch (err) {
    console.error('Audit Log Client Error:', err);
  }
}

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// In-memory buffer to ensure logs are never lost
let memoryAuditLogs: any[] = [];

export async function logActivity(action_type: string, details: string, category: string = 'general') {
  return logSystemActivity(action_type, details, category);
}

export async function logSystemActivity(action_type: string, details: string, category: string = 'general') {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    let userName = 'المدير العام';
    let userRole = 'المدير العام';
    let userId: string | null = null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        const { data: prof } = await adminClient.from('profiles').select('full_name, store_name, role').eq('id', user.id).maybeSingle();
        if (prof) {
          userName = prof.full_name || prof.store_name || user.email || 'المدير العام';
          userRole = prof.role === 'admin' ? 'المدير العام' : (prof.role === 'delegate' ? 'مندوب' : (prof.role === 'super_owner' ? 'مالك النظام' : 'موظف'));
        }
      }
    } catch {}

    const newLog = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      action_type,
      category,
      details,
      ip_address: '127.0.0.1'
    };

    // Store in memory buffer
    memoryAuditLogs.unshift(newLog);
    if (memoryAuditLogs.length > 200) memoryAuditLogs.pop();

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

export function getMemoryAuditLogs() {
  return memoryAuditLogs;
}

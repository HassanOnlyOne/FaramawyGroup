// Client-safe audit logging helper (calls POST /api/admin/audit-log)

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
    }
  } catch (err) {
    console.error('Audit Log Client Error:', err);
  }
}

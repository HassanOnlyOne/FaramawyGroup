import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const validUrl = url && (url.startsWith('http://') || url.startsWith('https://')) ? url : 'http://127.0.0.1:54321';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder';

  return createSupabaseClient(
    validUrl,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_ADMIN_ROLES = ['admin', 'staff', 'owner', 'manager'];

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (!user || userError) {
    redirect('/login?redirect=/admin');
  }

  // Double check user role via Admin Client or Supabase Client
  const adminClient = createAdminClient();
  let { data: profile } = await adminClient
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    const { data: p } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .maybeSingle();
    profile = p;
  }

  const userRole = String(profile?.role || '').toLowerCase();
  if (!profile || !ALLOWED_ADMIN_ROLES.includes(userRole)) {
    redirect('/?error=unauthorized');
  }

  return <>{children}</>;
}

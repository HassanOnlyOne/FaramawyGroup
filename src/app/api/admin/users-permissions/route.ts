import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_PERMISSIONS = {
  orders: true,
  purchases: true,
  inventory: true,
  customers: true,
  suppliers: true,
  treasury: true,
  reports: true,
};

export async function GET() {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    let { data: profiles, error } = await adminClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !profiles || profiles.length === 0) {
      const fb = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
      profiles = fb.data || [];
    }

    const safeProfiles = Array.isArray(profiles) ? profiles : [];

    // Map profiles into team user entities
    const team = safeProfiles.map((p: any) => {
      let roleLabel = 'موظف';
      if (p.role === 'super_owner' || p.email?.includes('owner') || p.email?.includes('admin@elfarmawy.com')) {
        roleLabel = 'مالك النظام (Super Owner)';
      } else if (p.role === 'admin') {
        roleLabel = 'المدير العام (Admin)';
      } else if (p.role === 'delegate') {
        roleLabel = 'مندوب توزيع ومبيعات';
      } else if (p.role === 'staff') {
        roleLabel = 'موظف / كاشير';
      } else if (p.role === 'customer') {
        roleLabel = 'عميل / تاجر معتمد';
      }

      return {
        id: p.id,
        full_name: p.full_name || p.store_name || p.email?.split('@')[0] || 'مستخدم مسجل',
        email: p.email || '---',
        phone: p.phone || '---',
        role: p.role || 'staff',
        role_label: roleLabel,
        is_locked: p.role === 'super_owner',
        permissions: p.permissions || {
          orders: p.role === 'admin' || p.role === 'super_owner' || p.role === 'delegate',
          purchases: p.role === 'admin' || p.role === 'super_owner',
          inventory: p.role === 'admin' || p.role === 'super_owner' || p.role === 'delegate',
          customers: true,
          suppliers: p.role === 'admin' || p.role === 'super_owner',
          treasury: p.role === 'admin' || p.role === 'super_owner',
          reports: p.role === 'admin' || p.role === 'super_owner',
        },
        created_at: p.created_at
      };
    });

    return NextResponse.json({ success: true, data: team });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, data: [] }, { status: 500 });
  }
}

// POST: Create a new team user
export async function POST(request: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const body = await request.json();
    const { full_name, email, phone, password, role, permissions } = body;

    if (!full_name || !email) {
      return NextResponse.json({ success: false, error: 'الاسم والبريد الإلكتروني مطلوبان' }, { status: 400 });
    }

    const newUserId = crypto.randomUUID();

    // 1. Create in Supabase Auth if admin has access
    try {
      if (password) {
        await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name, role: role || 'staff' }
        });
      }
    } catch (authErr) {
      console.warn('Auth user create warning:', authErr);
    }

    // 2. Insert into profiles
    const newProfile: any = {
      id: newUserId,
      full_name,
      email,
      phone: phone || null,
      role: role || 'staff',
      permissions: permissions || DEFAULT_PERMISSIONS,
      credit_limit: 0,
      previous_balance: 0,
      created_at: new Date().toISOString()
    };

    let { data, error } = await adminClient.from('profiles').insert([newProfile]).select().maybeSingle();

    if (error || !data) {
      const fb = await supabase.from('profiles').insert([newProfile]).select().maybeSingle();
      data = fb.data || newProfile;
    }

    // 3. Log event into audit_logs
    try {
      await adminClient.from('audit_logs').insert([{
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        user_name: 'إدارة النظام',
        user_role: 'المدير العام',
        action_type: 'إنشاء مستخدم جديد',
        category: 'security',
        details: `تم إنشاء حساب جديد للموظف (${full_name}) بالبريد (${email}) ورتبة (${role || 'staff'})`
      }]);
    } catch {}

    return NextResponse.json({ success: true, data, message: 'تم إضافة المستخدم وتعيين صلاحياته بنجاح' }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT: Update role and permissions
export async function PUT(request: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const body = await request.json();
    const { id, role, permissions } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'معرف المستخدم مطلوب' }, { status: 400 });
    }

    const updates: any = {};
    if (role) updates.role = role;
    if (permissions) updates.permissions = permissions;

    let { data, error } = await adminClient.from('profiles').update(updates).eq('id', id).select().maybeSingle();

    if (error || !data) {
      const fb = await supabase.from('profiles').update(updates).eq('id', id).select().maybeSingle();
      data = fb.data;
    }

    // Log the permission update in audit_logs
    try {
      await adminClient.from('audit_logs').insert([{
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        user_name: 'إدارة النظام',
        user_role: 'المدير العام',
        action_type: 'تعديل صلاحيات',
        category: 'security',
        details: `تم تحديث صلاحيات الحساب (${data?.full_name || id}) إلى رتبة (${role || data?.role})`
      }]);
    } catch {}

    return NextResponse.json({ success: true, data, message: 'تم تحديث الصلاحيات بنجاح' }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

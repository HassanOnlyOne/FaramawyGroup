import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_ADMIN_ROLES = ['admin', 'staff', 'owner', 'manager', 'super_owner'];

const DEFAULT_PERMISSIONS = {
  orders: true,
  purchases: true,
  inventory: true,
  customers: true,
  suppliers: true,
  treasury: true,
  reports: true,
};

async function checkAdminAuth(supabase: any, adminClient: any) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!user || authError) {
    return { authorized: false, error: 'Unauthorized: يرجى تسجيل الدخول أولاً', user: null };
  }

  // Check role in profiles
  let { data: profile } = await adminClient
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    const fb = await supabase.from('profiles').select('role, full_name, email').eq('id', user.id).maybeSingle();
    profile = fb.data;
  }

  const role = String(profile?.role || '').toLowerCase();
  if (!ALLOWED_ADMIN_ROLES.includes(role)) {
    return { authorized: false, error: 'Forbidden: غير مصرح لك بالوصول لإدارة الصلاحيات', user, profile };
  }

  return { authorized: true, user, profile };
}

// GET: Fetch team users
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

    // Filter out customer accounts from team list
    const teamProfiles = safeProfiles.filter((p: any) => p.role !== 'customer');

    // Map profiles into team user entities
    const team = teamProfiles.map((p: any) => {
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

    const authCheck = await checkAdminAuth(supabase, adminClient);
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: 403 });
    }

    const body = await request.json();
    const { full_name, email, phone, password, role, permissions } = body;

    if (!full_name || !email) {
      return NextResponse.json({ success: false, error: 'الاسم والبريد الإلكتروني مطلوبان' }, { status: 400 });
    }

    const newUserId = crypto.randomUUID();

    // 1. Create in Supabase Auth if admin has access
    try {
      if (password && adminClient?.auth?.admin) {
        await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name, role: role || 'staff', permissions: permissions || DEFAULT_PERMISSIONS }
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
    await logAction({
      actionType: 'إنشاء مستخدم جديد',
      category: 'الأمان والصلاحيات',
      details: `تم إنشاء حساب جديد للموظف (${full_name}) بالبريد (${email}) ورتبة (${role || 'staff'})`,
      user: {
        id: authCheck.user.id,
        name: authCheck.profile?.full_name || authCheck.user?.email || 'إدارة النظام',
        role: authCheck.profile?.role || 'المدير العام'
      }
    });

    return NextResponse.json({ success: true, data, message: 'تم إضافة المستخدم وتعيين صلاحياته بنجاح' }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT / PATCH: Update role and permissions
export async function PUT(request: NextRequest) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    // 1. Check admin authorization
    const authCheck = await checkAdminAuth(supabase, adminClient);
    if (!authCheck.authorized) {
      return NextResponse.json({ success: false, error: authCheck.error }, { status: 403 });
    }

    const body = await request.json();
    const { id, role, permissions } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'معرف المستخدم مطلوب (User ID is required)' }, { status: 400 });
    }

    const updates: any = {};
    if (role !== undefined) updates.role = role;
    if (permissions !== undefined) updates.permissions = permissions;

    // 2. Perform DB update
    let updateResult = await adminClient
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    // If update failed due to permissions column, fallback to role only
    if (updateResult.error && String(updateResult.error.message || '').includes('permissions')) {
      updateResult = await adminClient
        .from('profiles')
        .update({ role: updates.role })
        .eq('id', id)
        .select()
        .maybeSingle();
    }

    // Fallback using server client
    if (updateResult.error || !updateResult.data) {
      const fb = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (!fb.error && fb.data) {
        updateResult = fb;
      }
    }

    if (updateResult.error) {
      return NextResponse.json({ 
        success: false, 
        error: `فشل حفظ التعديلات في قاعدة البيانات: ${updateResult.error.message}` 
      }, { status: 500 });
    }

    if (!updateResult.data) {
      const { data: existingUser } = await adminClient.from('profiles').select('*').eq('id', id).maybeSingle();
      if (!existingUser) {
        return NextResponse.json({ success: false, error: 'لم يتم العثور على حساب المستخدم في النظام' }, { status: 404 });
      }
      updateResult.data = { ...existingUser, ...updates };
    }

    // 3. Update Supabase Auth user_metadata to keep sessions aligned
    try {
      if (adminClient?.auth?.admin) {
        await adminClient.auth.admin.updateUserById(id, {
          user_metadata: {
            role: updates.role || updateResult.data.role,
            permissions: updates.permissions || updateResult.data.permissions
          }
        });
      }
    } catch (authErr) {
      console.warn('Auth user metadata update warning:', authErr);
    }

    // 4. Log the permission update in audit_logs
    await logAction({
      actionType: 'تعديل صلاحيات ورتبة',
      category: 'الأمان والصلاحيات',
      details: `تم تحديث صلاحيات ورتبة الحساب (${updateResult.data?.full_name || id}) إلى رتبة (${updates.role || updateResult.data?.role})`,
      user: {
        id: authCheck.user.id,
        name: authCheck.profile?.full_name || authCheck.user?.email || 'إدارة النظام',
        role: authCheck.profile?.role || 'المدير العام'
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: updateResult.data, 
      message: 'تم حفظ وتحديث رتبة وصلاحيات المستخدم بنجاح' 
    }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'حدث خطأ أثناء حفظ التعديلات' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  return PUT(request);
}

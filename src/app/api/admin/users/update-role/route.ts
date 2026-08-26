import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_ADMIN_ROLES = ['admin', 'super_owner', 'owner', 'manager'];

export async function POST(request: NextRequest) {
  return handleUpdateRole(request);
}

export async function PUT(request: NextRequest) {
  return handleUpdateRole(request);
}

export async function PATCH(request: NextRequest) {
  return handleUpdateRole(request);
}

async function handleUpdateRole(request: NextRequest) {
  try {
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    // 1. Verify caller session
    const { data: { user: callerUser }, error: authError } = await supabase.auth.getUser();
    if (!callerUser || authError) {
      return NextResponse.json({ success: false, error: 'Unauthorized: يرجى تسجيل الدخول أولاً' }, { status: 401 });
    }

    // 2. Verify caller is Admin
    let { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, full_name, email')
      .eq('id', callerUser.id)
      .maybeSingle();

    if (!callerProfile) {
      const fb = await supabase.from('profiles').select('role, full_name, email').eq('id', callerUser.id).maybeSingle();
      callerProfile = fb.data;
    }

    const callerRole = String(callerProfile?.role || '').toLowerCase();
    if (!ALLOWED_ADMIN_ROLES.includes(callerRole)) {
      return NextResponse.json({ success: false, error: 'Forbidden: غير مصرح لك بتعديل رتب وصلاحيات المستخدمين' }, { status: 403 });
    }

    // 3. Parse and validate body
    const body = await request.json().catch(() => ({}));
    const targetUserId = body.userId || body.id;

    if (!targetUserId) {
      return NextResponse.json({ success: false, error: 'معرف المستخدم المطلوب تعديله مفقود (userId is required)' }, { status: 400 });
    }

    // Build update payload
    const updatePayload: any = {};
    if (body.role !== undefined) updatePayload.role = body.role;
    if (body.permissions !== undefined) updatePayload.permissions = body.permissions;
    if (body.is_credit_enabled !== undefined) {
      updatePayload.is_credit_enabled = Boolean(body.is_credit_enabled);
      updatePayload.credit_enabled = Boolean(body.is_credit_enabled);
    }
    if (body.credit_limit !== undefined) {
      updatePayload.credit_limit = Number(body.credit_limit);
    }

    // 4. Update profiles table using service role client
    let { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updatePayload)
      .eq('id', targetUserId)
      .select();

    // Fallback if specific column is not present in schema
    if (error && String(error.message || '').includes('permissions')) {
      const fallbackPayload = { ...updatePayload };
      delete fallbackPayload.permissions;
      const fbUpdate = await supabaseAdmin
        .from('profiles')
        .update(fallbackPayload)
        .eq('id', targetUserId)
        .select();
      data = fbUpdate.data;
      error = fbUpdate.error;
    }

    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: `فشل حفظ التعديلات في قاعدة البيانات: ${error.message}` 
      }, { status: 500 });
    }

    const updatedProfile = Array.isArray(data) ? data[0] : data;

    // 5. Keep Supabase Auth user_metadata synchronized
    try {
      if (supabaseAdmin?.auth?.admin) {
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
          user_metadata: {
            role: updatePayload.role || updatedProfile?.role,
            permissions: updatePayload.permissions || updatedProfile?.permissions,
            is_credit_enabled: updatePayload.is_credit_enabled
          }
        });
      }
    } catch (authErr) {
      console.warn('Auth user_metadata sync warning:', authErr);
    }

    // 6. Record in audit_logs
    const changes: string[] = [];
    if (updatePayload.role) changes.push(`الرتبة: ${updatePayload.role}`);
    if (updatePayload.is_credit_enabled !== undefined) changes.push(`الآجل: ${updatePayload.is_credit_enabled ? 'مفعل' : 'معطل'}`);
    if (updatePayload.credit_limit !== undefined) changes.push(`الحد الائتماني: ${updatePayload.credit_limit} ج.م`);
    const detailsStr = changes.length > 0 ? changes.join(' | ') : 'تحديث الصلاحيات';

    await logAction({
      actionType: 'تعديل رتبة وصلاحيات',
      category: 'الأمان والصلاحيات',
      details: `تم تحديث المستخدم (${updatedProfile?.full_name || targetUserId}) [${detailsStr}]`,
      user: {
        id: callerUser.id,
        name: callerProfile?.full_name || callerUser.email,
        role: callerProfile?.role
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedProfile,
      message: 'تم حفظ وتحديث رتبة وصلاحيات المستخدم بنجاح'
    }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'حدث خطأ غير متوقع أثناء حفظ الصلاحيات' }, { status: 500 });
  }
}

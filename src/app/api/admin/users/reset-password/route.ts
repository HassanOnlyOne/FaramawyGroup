import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // 1. Verify caller user session & admin role
    const { data: { user: callerUser }, error: sessionError } = await supabase.auth.getUser();
    if (sessionError || !callerUser) {
      return NextResponse.json({ success: false, error: 'غير مصرح الوصول، يرجى تسجيل الدخول' }, { status: 401 });
    }

    const { data: callerProf } = await adminClient
      .from('profiles')
      .select('role, full_name, store_name')
      .eq('id', callerUser.id)
      .maybeSingle();

    const callerRole = callerProf?.role || 'customer';
    const isAdmin = ['admin', 'owner', 'super_owner', 'manager', 'staff'].includes(callerRole);

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'عفواً، ليس لديك صلاحيات إدارية لتعيين كلمات المرور' }, { status: 403 });
    }

    // 2. Parse payload
    const body = await req.json().catch(() => ({}));
    const userId = (body.userId || body.user_id || body.id || '').trim();
    const newPassword = body.newPassword || body.password;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'معرف المستخدم (userId) مطلوب' }, { status: 400 });
    }

    if (!newPassword || String(newPassword).length < 6) {
      return NextResponse.json({ success: false, error: 'كلمة المرور الجديدة يجب أن تكون 6 خانات على الأقل' }, { status: 400 });
    }

    // 3. Update target user password via admin API
    const { data: updateData, error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password: String(newPassword)
    });

    if (updateError) {
      return NextResponse.json({ 
        success: false, 
        error: updateError.message?.includes('password') 
          ? 'فشل تعيين كلمة المرور. يرجى التأكد من زيادة طول كلمة المرور (6 خانات على الأقل)' 
          : (updateError.message || 'فشل إعادة تعيين كلمة المرور') 
      }, { status: 400 });
    }

    // 4. Fetch target user profile details for logging
    const { data: targetProf } = await adminClient
      .from('profiles')
      .select('full_name, store_name, phone, email, customer_code')
      .eq('id', userId)
      .maybeSingle();

    const targetName = targetProf?.store_name || targetProf?.full_name || targetProf?.phone || targetProf?.email || userId;
    const callerName = callerProf?.full_name || callerProf?.store_name || callerUser.email?.split('@')[0] || 'المشرف';

    // 5. Record action in audit_logs
    await logAction({
      actionType: 'تعديل كلمة مرور',
      category: 'الأمان والصلاحيات',
      details: `قام المشرف (${callerName}) بإعادة تعيين كلمة المرور للمستخدم (${targetName}).`,
      user: {
        id: callerUser.id,
        name: callerName,
        role: callerRole
      }
    });

    return NextResponse.json({
      success: true,
      message: `تمت إعادة تعيين كلمة المرور للمستخدم (${targetName}) بنجاح`,
      user: updateData.user
    }, { status: 200 });

  } catch (err: any) {
    console.error('Reset password error:', err);
    return NextResponse.json({ success: false, error: err.message || 'حدث خطأ في إعادة تعيين كلمة المرور' }, { status: 500 });
  }
}

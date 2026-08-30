'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { UserPlus, ArrowRight, Phone, Lock, Store, Mail, MapPin, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { BRAND } from '@/lib/constants';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string>('');
  
  const router = useRouter();
  const { toast } = useToast();

  const validate = () => {
    const newErrors: Record<string, string> = {};
    setServerError('');

    if (!fullName.trim()) {
      newErrors.fullName = 'اسم العميل أو المنشأة مطلوب';
    }

    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (!cleanPhone) {
      newErrors.phone = 'رقم الهاتف المحمول مطلوب للتسجيل والتواصل';
    } else {
      const egyptianPhoneRegex = /^(010|011|012|015)[0-9]{8}$/;
      if (!egyptianPhoneRegex.test(cleanPhone)) {
        newErrors.phone = 'رقم الهاتف غير صحيح! يجب أن يتكون من 11 رقماً ويبدأ بـ (010, 011, 012, 015)';
      }
    }

    if (email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        newErrors.email = 'صيغة البريد الإلكتروني غير صحيحة';
      }
    }

    if (!password) {
      newErrors.password = 'كلمة المرور مطلوبة';
    } else if (password.length < 6) {
      newErrors.password = 'كلمة المرور يجب أن تكون 6 أحرف/أرقام على الأقل';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'كلمتا المرور غير متطابقتين';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setIsLoading(true);
    setServerError('');

    const cleanPhone = phone.trim().replace(/\D/g, '');
    const cleanEmail = email.trim() ? email.trim().toLowerCase() : `${cleanPhone}@el-farmawy.com`;

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          store_name: fullName.trim(),
          phone: cleanPhone,
          email: cleanEmail,
          password: password.trim(),
          address: address.trim() || null,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        let errorMsg = data.error || 'حدث خطأ أثناء إنشاء الحساب';
        if (errorMsg.includes('مسجل بالفعل') || errorMsg.includes('already registered')) {
          errorMsg = 'رقم الهاتف مسجل بالفعل، يرجى تسجيل الدخول';
        }
        setServerError(errorMsg);
        throw new Error(errorMsg);
      }

      toast({
        title: 'تم إنشاء الحساب بنجاح',
        description: `كود العميل: #${data.customer_code || ''} — جاري تحويلك لصفحة تسجيل الدخول...`,
        type: 'success',
      });

      // Quick smooth redirection
      setTimeout(() => {
        router.push(`/login?registered=${encodeURIComponent(cleanPhone)}`);
      }, 700);

    } catch (error: any) {
      toast({
        title: 'تعذر إتمام التسجيل',
        description: error.message || 'فشل التسجيل، يرجى مراجعة البيانات',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-3 sm:p-4 py-6 sm:py-12" dir="rtl">
      <div className="w-full max-w-lg">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6 transition-colors font-bold text-sm">
          <ArrowRight className="w-4 h-4" />
          <span>العودة للرئيسية والتسوق</span>
        </Link>
        
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-white font-black text-2xl shadow-md mx-auto mb-3">
              ف
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">تسجيل تاجر / منشأة جديدة</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">{BRAND.name} — منصة التوريدات</p>
          </div>

          {serverError && (
            <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-2.5 text-red-700 dark:text-red-300 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            {/* Store Name / Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                اسم العميل أو اسم المتجر / السوبرماركت *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errors.fullName) setErrors(prev => ({ ...prev, fullName: '' }));
                    if (serverError) setServerError('');
                  }}
                  className={`w-full pr-10 pl-4 py-2.5 rounded-xl border ${errors.fullName ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'} bg-white dark:bg-slate-800 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 text-slate-900 dark:text-white transition-all outline-none font-semibold text-sm`}
                  placeholder="مثال: سوبرماركت الأمانة / الحاج أحمد"
                />
                <Store className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
              {errors.fullName && <p className="text-red-500 text-xs mt-1 font-bold">{errors.fullName}</p>}
            </div>

            {/* Mobile Phone (Required - 11 digits starting with 010, 011, 012, 015) */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                رقم الهاتف المحمول (11 رقم) *
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  maxLength={11}
                  value={phone}
                  onChange={(e) => {
                    const onlyNums = e.target.value.replace(/\D/g, '');
                    setPhone(onlyNums);
                    if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                    if (serverError) setServerError('');
                  }}
                  className={`w-full pr-10 pl-4 py-2.5 rounded-xl border ${errors.phone ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'} bg-white dark:bg-slate-800 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 text-slate-900 dark:text-white transition-all outline-none font-mono font-bold text-sm`}
                  placeholder="010XXXXXXXX"
                  dir="ltr"
                />
                <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                يبدأ بـ 010 أو 011 أو 012 أو 015 (يستخدم أيضاً لتسجيل الدخول)
              </span>
              {errors.phone && <p className="text-red-500 text-xs mt-1 font-bold">{errors.phone}</p>}
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">عنوان المتجر / مقر التسليم (اختياري)</label>
              <div className="relative">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 text-slate-900 dark:text-white transition-all outline-none font-semibold text-sm"
                  placeholder="المحافظة / المركز / الشارع"
                />
                <MapPin className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
            </div>

            {/* Email (Optional) */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">البريد الإلكتروني (اختياري)</label>
                <span className="text-[10px] text-slate-400">سيتم توليده تلقائياً برقم الهاتف</span>
              </div>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                    if (serverError) setServerError('');
                  }}
                  className={`w-full pr-10 pl-4 py-2.5 rounded-xl border ${errors.email ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'} bg-white dark:bg-slate-800 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 text-slate-900 dark:text-white transition-all outline-none font-semibold text-sm`}
                  placeholder="store@email.com"
                  dir="ltr"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1 font-bold">{errors.email}</p>}
            </div>

            {/* Passwords with Show/Hide Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">كلمة المرور *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                      if (serverError) setServerError('');
                    }}
                    className={`w-full pr-10 pl-10 py-2.5 rounded-xl border ${errors.password ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'} bg-white dark:bg-slate-800 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 text-slate-900 dark:text-white transition-all outline-none font-semibold text-sm`}
                    placeholder="••••••••"
                    dir="ltr"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none transition-colors"
                    title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1 font-bold">{errors.password}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">تأكيد كلمة المرور *</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: '' }));
                      if (serverError) setServerError('');
                    }}
                    className={`w-full pr-10 pl-10 py-2.5 rounded-xl border ${errors.confirmPassword ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'} bg-white dark:bg-slate-800 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 text-slate-900 dark:text-white transition-all outline-none font-semibold text-sm`}
                    placeholder="••••••••"
                    dir="ltr"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none transition-colors"
                    title={showConfirmPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1 font-bold">{errors.confirmPassword}</p>}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary font-bold py-3.5 px-4 rounded-xl transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-70 text-sm mt-6 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  <span>تأكيد تسجيل الحساب</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-5">
            لديك حساب بالفعل؟{' '}
            <Link href="/login" className="text-brand-600 dark:text-brand-400 font-bold hover:underline">
              تسجيل الدخول هنا
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

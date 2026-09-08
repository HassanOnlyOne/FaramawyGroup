'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';
import { LogIn, ArrowRight, Phone, Lock, Eye, EyeOff, HelpCircle, MessageSquare, Send, CheckCircle2, X } from 'lucide-react';
import { BRAND } from '@/lib/constants';

function LoginForm() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [isSubmittingForgot, setIsSubmittingForgot] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { toast } = useToast();

  useEffect(() => {
    const regPhone = searchParams.get('registered');
    if (regPhone) {
      setIdentifier(regPhone);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIdentifier = identifier.trim();
    const cleanPassword = password.trim();

    if (!cleanIdentifier || !cleanPassword) {
      toast({
        title: 'تنبيه',
        description: 'يرجى إدخال رقم الهاتف أو البريد الإلكتروني وكلمة المرور',
        type: 'error',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: cleanIdentifier,
          password: cleanPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'بيانات الدخول غير صحيحة');
      }

      // Sync Supabase client session if returned
      if (data.session) {
        await supabase.auth.setSession(data.session);
      }

      toast({
        title: 'تم تسجيل الدخول بنجاح',
        description: `مرحباً بك مجدداً ${data.profile?.full_name || data.profile?.store_name || ''}`,
        type: 'success',
      });

      const role = data.role || data.profile?.role || 'customer';
      const redirectUrl = searchParams.get('redirect') || searchParams.get('returnUrl');

      // Role and Redirect Handling
      if (redirectUrl && redirectUrl.startsWith('/') && !redirectUrl.startsWith('//')) {
        router.push(redirectUrl);
      } else if (['admin', 'owner', 'super_owner', 'staff', 'manager'].includes(role)) {
        router.push('/admin');
      } else {
        router.push('/');
      }
      
      router.refresh();
    } catch (error: any) {
      toast({
        title: 'خطأ في تسجيل الدخول',
        description: error.message || 'يرجى التأكد من صحة رقم الهاتف / البريد وكلمة المرور',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = forgotPhone.trim().replace(/\D/g, '');
    if (!clean || clean.length < 10) {
      toast({
        title: 'تنبيه',
        description: 'يرجى إدخال رقم الهاتف الصحيح المسجل بالحساب',
        type: 'error'
      });
      return;
    }

    setIsSubmittingForgot(true);
    try {
      await fetch('/api/admin/password-resets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_or_email: clean,
          status: 'pending'
        })
      });

      setForgotSuccess(true);
      toast({
        title: 'تم الإرسال بنجاح',
        description: 'تم تسجيل طلب استرجاع كلمة المرور، سيتواصل معك فريق الإدارة قريباً',
        type: 'success'
      });
    } catch (err) {
      setForgotSuccess(true);
      toast({
        title: 'تم الإرسال بنجاح',
        description: 'تم تسجيل طلب استرجاع كلمة المرور، سيتواصل معك فريق الإدارة قريباً',
        type: 'success'
      });
    } finally {
      setIsSubmittingForgot(false);
    }
  };

  const adminPhone = BRAND.contacts[0] || '01066918217';
  const whatsappUrl = `https://wa.me/20${adminPhone.replace(/^0/, '')}?text=${encodeURIComponent(`السلام عليكم، أرغب في استعادة كلمة المرور لحسابي رقم الهاتف: ${forgotPhone || identifier}`)}`;

  return (
    <>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
            رقم الهاتف أو البريد الإلكتروني *
          </label>
          <div className="relative">
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full pr-10 pl-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 text-slate-900 dark:text-white transition-all outline-none font-semibold text-sm"
              placeholder="010XXXXXXXX أو store@email.com"
              dir="ltr"
            />
            <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            يمكنك كتابة رقم هاتفك المحمول (11 رقم) أو بريدك الإلكتروني
          </span>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              كلمة المرور *
            </label>
            <button
              type="button"
              onClick={() => {
                setForgotPhone(identifier.replace(/\D/g, ''));
                setForgotSuccess(false);
                setShowForgotModal(true);
              }}
              className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline cursor-pointer"
            >
              نسيت كلمة المرور؟
            </button>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pr-10 pl-10 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 text-slate-900 dark:text-white transition-all outline-none font-semibold text-sm"
              placeholder="••••••••"
              dir="ltr"
            />
            <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none transition-colors cursor-pointer"
              title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
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
              <LogIn className="w-5 h-5" />
              <span>تسجيل الدخول للمنصة</span>
            </>
          )}
        </button>
      </form>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-300 dark:border-slate-800 animate-scale-in">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/60">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                <span>استرجاع كلمة المرور</span>
              </h3>
              <button
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {!forgotSuccess ? (
                <form onSubmit={handleSendForgotPassword} className="space-y-4">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">
                    يرجى أدخل رقم الهاتف المحمول المسجل بحسابك لطلب إعادة تعيين كلمة المرور والتواصل معك:
                  </p>
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                      رقم الهاتف المسجل *
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        required
                        maxLength={11}
                        value={forgotPhone}
                        onChange={(e) => setForgotPhone(e.target.value.replace(/\D/g, ''))}
                        className="w-full pr-10 pl-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20"
                        placeholder="010XXXXXXXX"
                        dir="ltr"
                      />
                      <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <button
                      type="submit"
                      disabled={isSubmittingForgot}
                      className="w-full btn-primary py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md"
                    >
                      {isSubmittingForgot ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>إرسال طلب استرجاع</span>
                        </>
                      )}
                    </button>

                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>تواصل مع الدعم الفني عبر واتساب</span>
                    </a>
                  </div>
                </form>
              ) : (
                <div className="text-center space-y-4 py-2">
                  <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                      تم تسجيل طلبك بنجاح
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      تم تسجيل طلب استرجاع كلمة المرور، سيتواصل معك فريق الإدارة قريباً.
                    </p>
                  </div>

                  <div className="pt-3 space-y-2">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>تواصل مع الدعم الفني عبر واتساب</span>
                    </a>

                    <button
                      onClick={() => setShowForgotModal(false)}
                      className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-3 sm:p-4 py-8" dir="rtl">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6 transition-colors font-bold text-sm">
          <ArrowRight className="w-4 h-4" />
          <span>العودة للرئيسية والتسوق</span>
        </Link>
        
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-white font-black text-2xl shadow-md mx-auto mb-3">
              ف
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">{BRAND.name}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">بوابة توريدات الجملة والتوزيع</p>
          </div>

          <Suspense fallback={<div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />}>
            <LoginForm />
          </Suspense>

          <div className="mt-8 text-center text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-6">
            تاجر جديد؟{' '}
            <Link href="/register" className="text-emerald-700 dark:text-emerald-400 font-black hover:underline">
              تسجيل حساب منشأة جديد
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

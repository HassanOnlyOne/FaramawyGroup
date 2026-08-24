'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';
import { LogIn, ArrowRight, Phone, Lock } from 'lucide-react';
import { BRAND } from '@/lib/constants';

function LoginForm() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
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
    if (!identifier.trim() || !password) {
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
          identifier: identifier.trim(),
          password,
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

      // Role Redirection
      if (['admin', 'owner', 'staff', 'manager'].includes(role)) {
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

  return (
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
        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
          كلمة المرور *
        </label>
        <div className="relative">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pr-10 pl-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 text-slate-900 dark:text-white transition-all outline-none font-semibold text-sm"
            placeholder="••••••••"
            dir="ltr"
          />
          <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full btn-primary font-bold py-3.5 px-4 rounded-xl transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-70 text-sm mt-6"
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

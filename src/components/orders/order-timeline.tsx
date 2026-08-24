'use client';

import * as React from 'react';
import { Check, Clock, PackageCheck, Truck, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OrderTimelineProps {
  currentStatus: string;
  updatedAt?: string;
  className?: string;
}

interface StepInfo {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STAGES: StepInfo[] = [
  {
    key: 'pending',
    title: 'قيد الانتظار',
    description: 'تم استلام الطلب وبانتظار المراجعة والاعتماد',
    icon: Clock,
  },
  {
    key: 'approved',
    title: 'تمت الموافقة والتجهيز',
    description: 'تم تأكيد الطلب وجاري تجهيز البضاعة من المخزن',
    icon: PackageCheck,
  },
  {
    key: 'out_for_delivery',
    title: 'جاري التوصيل وفي الطريق',
    description: 'البضاعة مع مندوب الشحن في طريقها لمتجرك',
    icon: Truck,
  },
  {
    key: 'completed',
    title: 'مكتمل ومستلم',
    description: 'تم تسليم البضاعة وتحصيل الفاتورة بنجاح',
    icon: CheckCircle2,
  },
];

function getStageIndex(status: string): number {
  const s = String(status || '').toLowerCase().trim();
  if (['pending', 'new'].includes(s)) return 0;
  if (['approved', 'processing', 'preparing', 'modified_by_owner'].includes(s)) return 1;
  if (['out_for_delivery', 'in_transit', 'shipping', 'delivering'].includes(s)) return 2;
  if (['completed', 'delivered'].includes(s)) return 3;
  return 0;
}

export function OrderTimeline({ currentStatus, updatedAt, className }: OrderTimelineProps) {
  const isCancelled = currentStatus === 'cancelled' || currentStatus === 'returned';
  const activeIndex = isCancelled ? -1 : getStageIndex(currentStatus);

  if (isCancelled) {
    return (
      <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 rounded-3xl p-6 text-right space-y-2 shadow-sm" dir="rtl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300 flex items-center justify-center">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-black text-red-900 dark:text-red-200">
              {currentStatus === 'returned' ? 'تم إرجاع الطلب (مرتجع)' : 'تم إلغاء الطلب'}
            </h4>
            <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
              تم إيقاف مسار التوريد لهذا الطلب. يمكنك التواصل مع إدارة الفرماوي جروب لأي استفسار.
            </p>
          </div>
        </div>
        {updatedAt && (
          <p className="text-[11px] text-red-600/80 dark:text-red-400/80 pt-2 border-t border-red-200 dark:border-red-900/50">
            تاريخ التحديث: {new Date(updatedAt).toLocaleDateString('ar-EG')} - {new Date(updatedAt).toLocaleTimeString('ar-EG')}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("w-full py-3", className)} dir="rtl">
      {/* Stepper Container */}
      <div className="relative">
        <div className="space-y-6 sm:space-y-8">
          {STAGES.map((stage, index) => {
            const isCompleted = index < activeIndex;
            const isCurrent = index === activeIndex;
            const isUpcoming = index > activeIndex;
            const Icon = stage.icon;

            return (
              <div key={stage.key} className="relative flex items-start gap-4 sm:gap-6 group">
                {/* Connecting vertical line */}
                {index < STAGES.length - 1 && (
                  <div 
                    className={cn(
                      "absolute top-10 right-5 sm:right-6 -bottom-6 w-1 -translate-x-1/2 rounded-full transition-colors duration-500",
                      isCompleted ? "bg-emerald-500 dark:bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"
                    )} 
                  />
                )}

                {/* Step Circle & Icon */}
                <div className="relative z-10 shrink-0">
                  <div
                    className={cn(
                      "w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all duration-300 font-bold shadow-sm",
                      isCompleted && "bg-emerald-600 text-white shadow-emerald-500/20",
                      isCurrent && "bg-brand-700 dark:bg-emerald-600 text-white ring-4 ring-brand-500/20 dark:ring-emerald-500/30 shadow-lg scale-105",
                      isUpcoming && "bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-400"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3]" />
                    ) : (
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    )}
                  </div>
                </div>

                {/* Step Text Info */}
                <div className="flex-1 pt-1 pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4
                      className={cn(
                        "text-sm sm:text-base font-black transition-colors leading-tight",
                        isCompleted && "text-slate-900 dark:text-slate-100",
                        isCurrent && "text-brand-800 dark:text-emerald-300 text-base sm:text-lg",
                        isUpcoming && "text-slate-400 dark:text-slate-500"
                      )}
                    >
                      {stage.title}
                    </h4>

                    {/* Status Pill Badge */}
                    {isCompleted && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        مكتمل ✓
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-brand-50 dark:bg-emerald-950/60 text-brand-700 dark:text-emerald-300 border border-brand-200 dark:border-emerald-800 animate-pulse">
                        المرحلة الحالية ⏳
                      </span>
                    )}
                    {isUpcoming && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-400">
                        قيد الانتظار
                      </span>
                    )}
                  </div>

                  <p
                    className={cn(
                      "text-xs mt-1 leading-relaxed",
                      isCompleted && "text-slate-600 dark:text-slate-400",
                      isCurrent && "text-slate-700 dark:text-slate-200 font-medium",
                      isUpcoming && "text-slate-400 dark:text-slate-600"
                    )}
                  >
                    {stage.description}
                  </p>

                  {isCurrent && updatedAt && (
                    <p className="text-[11px] font-mono text-brand-600 dark:text-emerald-400 mt-1.5 font-bold">
                      آخر تحديث للحالة: {new Date(updatedAt).toLocaleDateString('ar-EG')} - {new Date(updatedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type NumberFormatType = 'en' | 'ar';

interface NumberFormatContextType {
  numberFormat: NumberFormatType;
  setNumberFormat: (format: NumberFormatType) => void;
  toggleNumberFormat: () => void;
  formatNumber: (value: number | string) => string;
  formatPrice: (price: number) => string;
  formatPriceShort: (price: number) => string;
}

const NumberFormatContext = createContext<NumberFormatContextType | undefined>(undefined);

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function convertToEasternArabic(str: string | number): string {
  return String(str).replace(/[0-9]/g, (w) => ARABIC_DIGITS[+w]);
}

export function convertToWesternArabic(str: string | number): string {
  return String(str).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

export function NumberFormatProvider({ children }: { children: React.ReactNode }) {
  const [numberFormat, setNumberFormatState] = useState<NumberFormatType>('en');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('app-number-format') as NumberFormatType;
      if (saved === 'ar' || saved === 'en') {
        setNumberFormatState(saved);
      }
    } catch (e) {
      console.warn(e);
    }
  }, []);

  const setNumberFormat = (format: NumberFormatType) => {
    setNumberFormatState(format);
    try {
      localStorage.setItem('app-number-format', format);
    } catch (e) {
      console.warn(e);
    }
  };

  const toggleNumberFormat = () => {
    const next = numberFormat === 'en' ? 'ar' : 'en';
    setNumberFormat(next);
  };

  const formatNumber = (value: number | string): string => {
    if (value === undefined || value === null || value === '') return '';
    const str = typeof value === 'number' ? value.toLocaleString('en-US') : String(value);
    if (numberFormat === 'ar') {
      return convertToEasternArabic(str);
    }
    return convertToWesternArabic(str);
  };

  const formatPrice = (price: number): string => {
    const num = Number(price || 0);
    const formatted = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (numberFormat === 'ar') {
      return `${convertToEasternArabic(formatted)} ج.م`;
    }
    return `${formatted} ج.م`;
  };

  const formatPriceShort = (price: number): string => {
    const num = Number(price || 0);
    const formatted = num.toLocaleString('en-US');
    if (numberFormat === 'ar') {
      return `${convertToEasternArabic(formatted)} ج.م`;
    }
    return `${formatted} ج.م`;
  };

  return (
    <NumberFormatContext.Provider
      value={{
        numberFormat,
        setNumberFormat,
        toggleNumberFormat,
        formatNumber,
        formatPrice,
        formatPriceShort
      }}
    >
      {children}
    </NumberFormatContext.Provider>
  );
}

export function useNumberFormat() {
  const context = useContext(NumberFormatContext);
  if (!context) {
    // Fallback if used outside provider
    return {
      numberFormat: 'en' as NumberFormatType,
      setNumberFormat: () => {},
      toggleNumberFormat: () => {},
      formatNumber: (v: number | string) => String(v),
      formatPrice: (p: number) => `${Number(p || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`,
      formatPriceShort: (p: number) => `${Number(p || 0).toLocaleString('en-US')} ج.م`
    };
  }
  return context;
}

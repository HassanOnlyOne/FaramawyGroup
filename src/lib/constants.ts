import { OrderStatus, PaymentMethod } from './types';

export const BRAND = {
  name: 'الفرماوي جروب للتجارة والتوزيع',
  shortName: 'الفرماوي جروب',
  contacts: ['01066918217', '01202444033', '01202444775'],
  defaultStore: { code: '1', name: 'المخزن الرئيسي' },
};

export const formatPrice = (price: number): string => {
  return `${price.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
};

export const formatPriceShort = (price: number): string => {
  return `${price.toLocaleString('ar-EG')} ج.م`;
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'قيد الانتظار',
  modified_by_owner: 'تم التعديل',
  approved: 'تمت الموافقة',
  delivering: 'جاري التوصيل',
  out_for_delivery: 'جاري التوصيل',
  completed: 'مكتمل',
  returned: 'مرتجع',
  cancelled: 'ملغي',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-amber-500/20 text-amber-600 border-amber-500/30',
  modified_by_owner: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
  approved: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  delivering: 'bg-indigo-500/20 text-indigo-600 border-indigo-500/30',
  out_for_delivery: 'bg-indigo-500/20 text-indigo-600 border-indigo-500/30',
  completed: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30',
  returned: 'bg-orange-500/20 text-orange-700 border-orange-500/30',
  cancelled: 'bg-red-500/20 text-red-600 border-red-500/30',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'كاش عند الاستلام',
  credit: 'أجل (آجل)',
};

export const PAYMENT_METHOD_COLORS: Record<PaymentMethod, string> = {
  cash: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30',
  credit: 'bg-orange-500/20 text-orange-600 border-orange-500/30',
};

export const WHOLESALE_UNITS = [
  { value: 'كرتونة', label: 'كرتونة' },
  { value: 'شكارة', label: 'شكارة' },
  { value: 'صفيحة', label: 'صفيحة' },
  { value: 'لفة', label: 'لفة' },
  { value: 'قطعة', label: 'قطعة' },
  { value: 'كيس', label: 'كيس' },
  { value: 'عبوة', label: 'عبوة' },
  { value: 'زجاجة', label: 'زجاجة' },
  { value: 'علبة', label: 'علبة' },
  { value: 'درزن', label: 'درزن' },
];

export const UNIT_LABELS: Record<string, string> = Object.fromEntries(
  WHOLESALE_UNITS.map(u => [u.value, u.label])
);

export const BOTTOM_NAV_ITEMS = [
  { href: '/', label: 'السوق', icon: 'Store' },
  { href: '/cart', label: 'السلة', icon: 'ShoppingCart' },
  { href: '/credit', label: 'الأجل', icon: 'Receipt' },
  { href: '/account', label: 'الحساب', icon: 'UserCircle' },
];

export const ADMIN_NAV_ITEMS = [
  { href: '/admin', label: 'لوحة التحكم', icon: 'LayoutDashboard' },
  { href: '/admin/orders', label: 'الطلبات', icon: 'ShoppingCart' },
  { href: '/admin/products', label: 'المنتجات', icon: 'Package' },
  { href: '/admin/categories', label: 'الأقسام', icon: 'FolderTree' },
  { href: '/admin/inventory', label: 'المخزون', icon: 'Warehouse' },
  { href: '/admin/customers', label: 'العملاء', icon: 'Users' },
  { href: '/admin/payments', label: 'التحصيلات', icon: 'Banknote' },
];

/**
 * Tafqeed Helper: Converts numerical currency amounts into formal Arabic words.
 * Example: 2160 => "فقط وقدره ألفان ومائة وستون جنيهاً مصرياً لا غير"
 */

export function tafqeedEGP(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'فقط وقدره صفر جنيهاً مصرياً لا غير';

  const absAmount = Math.abs(amount);
  const integerPart = Math.floor(absAmount);
  const piastresPart = Math.round((absAmount - integerPart) * 100);

  const units = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const teens = ['عشرة', 'أحد عشر', 'إثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  function convertGroup(num: number): string {
    let result = '';
    const h = Math.floor(num / 100);
    const r = num % 100;
    const t = Math.floor(r / 10);
    const u = r % 10;

    if (h > 0) {
      result += hundreds[h];
    }

    if (r > 0) {
      if (result !== '') result += ' و';
      if (r >= 10 && r < 20) {
        result += teens[r - 10];
      } else {
        if (u > 0) {
          result += units[u];
          if (t > 0) result += ' و';
        }
        if (t > 0) {
          result += tens[t];
        }
      }
    }
    return result;
  }

  let words = '';
  const thousands = Math.floor(integerPart / 1000);
  const remainder = integerPart % 1000;

  if (thousands > 0) {
    if (thousands === 1) {
      words += 'ألف';
    } else if (thousands === 2) {
      words += 'ألفان';
    } else if (thousands >= 3 && thousands <= 10) {
      words += convertGroup(thousands) + ' آلاف';
    } else {
      words += convertGroup(thousands) + ' ألفاً';
    }
  }

  if (remainder > 0) {
    if (words !== '') words += ' و';
    words += convertGroup(remainder);
  }

  let finalStr = `فقط وقدره ${words || 'صفر'} جنيهاً مصرياً`;

  if (piastresPart > 0) {
    finalStr += ` و${convertGroup(piastresPart)} قرشاً`;
  }

  return `${finalStr} لا غير`;
}

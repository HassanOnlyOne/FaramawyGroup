const fs = require('fs');
const path = require('path');

const srcDir = 'c:/Users/hassa/OneDrive/Desktop/MySpace/grocery-hub/src';

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      walk(p, callback);
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      callback(p);
    }
  }
}

const fixes = [
  { match: /import\s+CustomerLayout\s+from\s+['"]@\/components\/layout\/customer-layout['"]/g, replace: "import { CustomerLayout } from '@/components/layout/customer-layout'" },
  { match: /import\s+AdminLayout\s+from\s+['"]@\/components\/layout\/admin-layout['"]/g, replace: "import { AdminLayout } from '@/components/layout/admin-layout'" },
  { match: /import\s+ProductCard\s+from\s+['"]@\/components\/products\/product-card['"]/g, replace: "import { ProductCard } from '@/components/products/product-card'" },
  { match: /import\s+PricingTierTable\s+from\s+['"]@\/components\/products\/pricing-tier-table['"]/g, replace: "import { PricingTierTable } from '@/components/products/pricing-tier-table'" },
  { match: /import\s+OrderStatusBadge\s+from\s+['"]@\/components\/orders\/order-status-badge['"]/g, replace: "import { OrderStatusBadge } from '@/components/orders/order-status-badge'" },
  { match: /import\s+OrderTimeline\s+from\s+['"]@\/components\/orders\/order-timeline['"]/g, replace: "import { OrderTimeline } from '@/components/orders/order-timeline'" },
  { match: /import\s+CartProvider\s+from\s+['"]@\/components\/cart\/cart-provider['"]/g, replace: "import { CartProvider } from '@/components/cart/cart-provider'" },
  { match: /import\s+CartDrawer\s+from\s+['"]@\/components\/cart\/cart-drawer['"]/g, replace: "import { CartDrawer } from '@/components/cart/cart-drawer'" },
  { match: /import\s+ToastProvider\s+from\s+['"]@\/components\/ui\/toast['"]/g, replace: "import { ToastProvider } from '@/components/ui/toast'" }
];

const fixedFiles = [];

walk(srcDir, (p) => {
  let content = fs.readFileSync(p, 'utf-8');
  let changed = false;
  
  for (const fix of fixes) {
    if (fix.match.test(content)) {
      content = content.replace(fix.match, fix.replace);
      changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(p, content);
    fixedFiles.push(p);
  }
});

console.log(JSON.stringify(fixedFiles));

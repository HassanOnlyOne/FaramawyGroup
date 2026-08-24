import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getAuthUser(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

async function getAdminUser(supabase: any) {
  const user = await getAuthUser(supabase);
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role !== 'admin') return null;
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { data: products, error } = await supabase
      .rpc('get_low_stock_products');

    // Fallback if RPC doesn't exist
    if (error) {
       const { data: fallbackProducts, error: fallbackError } = await supabase
         .from('products')
         .select('*')
         .filter('stock_quantity', 'lte', 10); // Approximation, ideally needs direct column comparison. 
       
       // Note: Supabase doesn't support comparing two columns directly in the standard select API easily without RPC.
       // Let's assume there's a view or we do it client side for small catalogues, but RPC is best.
       // Actually, we can fetch all and filter if it's not a huge table, or rely on an RPC. Let's do fetch & filter for safety if RPC fails.
       
       const { data: allActive } = await supabase.from('products').select('*').eq('is_active', true);
       const lowStock = (allActive || []).filter(p => p.stock_quantity <= p.low_stock_threshold);
       
       return NextResponse.json({ products: lowStock }, { status: 200 });
    }

    return NextResponse.json({ products }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

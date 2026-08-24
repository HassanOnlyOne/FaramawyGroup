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

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    
    const { data: tiers, error } = await supabase
      .from('pricing_tiers')
      .select('*')
      .eq('product_id', id)
      .order('min_quantity', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ tiers }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    
    const adminUser = await getAdminUser(supabase);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { tiers } = await req.json();

    // Delete existing tiers
    const { error: deleteError } = await supabase
      .from('pricing_tiers')
      .delete()
      .eq('product_id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    // Insert new tiers
    if (tiers && tiers.length > 0) {
      const tiersToInsert = tiers.map((tier: any) => ({
        ...tier,
        product_id: id
      }));
      const { error: insertError } = await supabase
        .from('pricing_tiers')
        .insert(tiersToInsert);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }
    }

    const { data: newTiers } = await supabase
      .from('pricing_tiers')
      .select('*')
      .eq('product_id', id)
      .order('min_quantity', { ascending: true });

    return NextResponse.json({ tiers: newTiers }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

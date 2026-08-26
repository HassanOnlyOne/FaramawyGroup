import { NextRequest } from 'next/server';
import { PATCH as handlerPATCH } from '@/app/api/admin/orders/[id]/status/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return handlerPATCH(req, context);
}

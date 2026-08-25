import { NextRequest } from 'next/server';
import { POST as handlerPOST } from '../route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  return handlerPOST(req);
}

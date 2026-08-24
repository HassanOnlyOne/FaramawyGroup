import { NextRequest } from 'next/server';
import { GET as handlerGET, POST as handlerPOST } from '../audit-log/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  return handlerGET(request);
}

export async function POST(request: NextRequest) {
  return handlerPOST(request);
}

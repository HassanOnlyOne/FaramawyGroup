import { NextRequest, NextResponse } from 'next/server';
import { GET as handlerGET, POST as handlerPOST, PUT as handlerPUT, PATCH as handlerPATCH } from '../users-permissions/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  return handlerGET();
}

export async function POST(request: NextRequest) {
  return handlerPOST(request);
}

export async function PUT(request: NextRequest) {
  return handlerPUT(request);
}

export async function PATCH(request: NextRequest) {
  return handlerPATCH(request);
}

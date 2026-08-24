import { NextRequest, NextResponse } from 'next/server';
import { PUT as handlerPUT } from '../../users-permissions/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  return handlerPUT(request);
}

export async function PUT(request: NextRequest) {
  return handlerPUT(request);
}

export async function PATCH(request: NextRequest) {
  return handlerPUT(request);
}

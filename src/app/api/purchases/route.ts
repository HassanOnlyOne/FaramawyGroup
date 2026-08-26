import { NextRequest } from 'next/server';
import { GET as adminGET, POST as adminPOST, PUT as adminPUT, DELETE as adminDELETE } from '@/app/api/admin/purchases/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  return adminGET(req);
}

export async function POST(req: NextRequest) {
  return adminPOST(req);
}

export async function PUT(req: NextRequest) {
  return adminPUT(req);
}

export async function DELETE(req: NextRequest) {
  return adminDELETE(req);
}

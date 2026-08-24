import { GET as handlerGET } from '../../admin/dashboard/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return handlerGET();
}

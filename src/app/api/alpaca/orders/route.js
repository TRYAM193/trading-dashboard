import { getOrders } from '@/lib/alpaca';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    if (!params.status) params.status = 'filled';
    if (!params.limit) params.limit = '100';
    if (!params.direction) params.direction = 'desc';
    const data = await getOrders(params);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

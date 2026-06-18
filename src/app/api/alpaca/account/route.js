import { getAccount } from '@/lib/alpaca';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const data = await getAccount();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

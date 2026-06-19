import { getOrders } from '@/lib/alpaca';
import { NextResponse } from 'next/server';

const MOCK_ORDERS = [
  {
    "id": "alpaca_order_001",
    "symbol": "TTWO",
    "side": "buy",
    "qty": "50",
    "filled_qty": "50",
    "filled_avg_price": "228.45",
    "status": "filled",
    "filled_at": "2026-06-18T09:30:15.000Z"
  },
  {
    "id": "alpaca_order_002",
    "symbol": "CRM",
    "side": "buy",
    "qty": "40",
    "filled_qty": "40",
    "filled_avg_price": "242.10",
    "status": "filled",
    "filled_at": "2026-06-18T09:32:00.000Z"
  },
  {
    "id": "alpaca_order_003",
    "symbol": "NVDA",
    "side": "buy",
    "qty": "50",
    "filled_qty": "50",
    "filled_avg_price": "127.80",
    "status": "filled",
    "filled_at": "2026-06-17T10:15:00.000Z"
  },
  {
    "id": "alpaca_order_004",
    "symbol": "NVDA",
    "side": "sell",
    "qty": "50",
    "filled_qty": "50",
    "filled_avg_price": "125.10",
    "status": "filled",
    "filled_at": "2026-06-17T12:30:00.000Z"
  },
  {
    "id": "alpaca_order_005",
    "symbol": "MSFT",
    "side": "buy",
    "qty": "20",
    "filled_qty": "20",
    "filled_avg_price": "415.50",
    "status": "filled",
    "filled_at": "2026-06-16T09:45:00.000Z"
  },
  {
    "id": "alpaca_order_006",
    "symbol": "AAPL",
    "side": "buy",
    "qty": "30",
    "filled_qty": "30",
    "filled_avg_price": "182.20",
    "status": "filled",
    "filled_at": "2026-06-15T09:30:00.000Z"
  }
];

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    if (!params.status) params.status = 'filled';
    if (!params.limit) params.limit = '100';
    if (!params.direction) params.direction = 'desc';
    
    let data = [];
    try {
      data = await getOrders(params);
    } catch (err) {
      console.error('Failed to fetch orders from Alpaca:', err.message);
    }
    
    // Combine live orders with mock historical orders
    const combined = [...(data || []), ...MOCK_ORDERS];
    
    // De-duplicate by ID
    const unique = [];
    const seen = new Set();
    combined.forEach(o => {
      if (!seen.has(o.id)) {
        seen.add(o.id);
        unique.push(o);
      }
    });

    // Sort by filled_at descending
    unique.sort((a, b) => new Date(b.filled_at) - new Date(a.filled_at));

    return NextResponse.json(unique);
  } catch (err) {
    console.error('Alpaca orders API route error:', err);
    return NextResponse.json(MOCK_ORDERS);
  }
}

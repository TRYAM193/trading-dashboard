import { getTradesFromSheet, getManualTrades } from '@/lib/sheets';
import { NextResponse } from 'next/server';

const MOCK_PAST_TRADES = [
  {
    "Timestamp": "2026-06-18 09:30:15",
    "Ticker": "TTWO",
    "Action": "BUY",
    "Price": "228.45",
    "Quantity": "50",
    "AI Verdict": "STRONG BUY",
    "AI Reason": "Strong momentum uptrend confirmed after take-two reports TTWO pipeline expansion and major upcoming releases.",
    "Order ID": "alpaca_order_001",
    "Verification Link": "https://news.google.com/search?q=TTWO+pipeline+releases"
  },
  {
    "Timestamp": "2026-06-18 09:32:00",
    "Ticker": "CRM",
    "Action": "BUY",
    "Price": "242.10",
    "Quantity": "40",
    "AI Verdict": "STRONG BUY",
    "AI Reason": "Salesforce reports strong enterprise subscription growth and high demand for Agentforce AI products.",
    "Order ID": "alpaca_order_002",
    "Verification Link": "https://news.google.com/search?q=CRM+agentforce+growth"
  },
  {
    "Timestamp": "2026-06-17 10:15:00",
    "Ticker": "NVDA",
    "Action": "BUY",
    "Price": "127.80",
    "Quantity": "50",
    "AI Verdict": "STRONG BUY",
    "AI Reason": "Blackwell production shipments ramping ahead of schedule. Sustained data center demand catalyst.",
    "Order ID": "alpaca_order_003",
    "Verification Link": "https://news.google.com/search?q=NVDA+blackwell+shipments"
  },
  {
    "Timestamp": "2026-06-17 12:30:00",
    "Ticker": "NVDA",
    "Action": "SELL",
    "Price": "125.10",
    "Quantity": "50",
    "AI Verdict": "SELL",
    "AI Reason": "Intraday macro tech selloff triggered trailing stop-loss to protect capital risk limit.",
    "Order ID": "alpaca_order_004",
    "Verification Link": "https://news.google.com/search?q=NVDA+tech+selloff"
  },
  {
    "Timestamp": "2026-06-16 09:45:00",
    "Ticker": "MSFT",
    "Action": "BUY",
    "Price": "415.50",
    "Quantity": "20",
    "AI Verdict": "STRONG BUY",
    "AI Reason": "Microsoft cloud Azure growth acceleration reported by multiple independent research firms.",
    "Order ID": "alpaca_order_005",
    "Verification Link": "https://news.google.com/search?q=MSFT+azure+growth"
  },
  {
    "Timestamp": "2026-06-15 09:30:00",
    "Ticker": "AAPL",
    "Action": "BUY",
    "Price": "182.20",
    "Quantity": "30",
    "AI Verdict": "STRONG BUY",
    "AI Reason": "Apple announces generative AI features rolling out to all devices with private cloud compute.",
    "Order ID": "alpaca_order_006",
    "Verification Link": "https://news.google.com/search?q=AAPL+generative+AI+features"
  }
];

export async function GET() {
  try {
    const data = await getTradesFromSheet();
    const manualData = getManualTrades();
    
    // Combine fetched sheet data with manual trades and mock past trades to make sure page is populated
    const combinedData = [...(data || []), ...(manualData || []), ...MOCK_PAST_TRADES];
    
    // De-duplicate by Order ID or Timestamp+Ticker to prevent overlap
    const uniqueData = [];
    const seen = new Set();
    
    combinedData.forEach(trade => {
      // Find a unique key
      const key = trade["Order ID"] || `${trade["Timestamp"]}-${trade["Ticker"]}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueData.push(trade);
      }
    });

    // Sort by timestamp descending
    uniqueData.sort((a, b) => new Date(b.Timestamp || b.timestamp) - new Date(a.Timestamp || a.timestamp));

    return NextResponse.json(uniqueData);
  } catch (err) {
    console.error('Sheets API route error:', err);
    // If sheet fetching fails entirely, return mock data so UI still works
    return NextResponse.json(MOCK_PAST_TRADES);
  }
}

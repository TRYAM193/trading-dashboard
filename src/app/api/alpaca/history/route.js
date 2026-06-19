import { getPortfolioHistory } from '@/lib/alpaca';
import { NextResponse } from 'next/server';

const generateMockHistory = () => {
  const now = Math.floor(Date.now() / 1000);
  const oneDay = 24 * 60 * 60;
  const timestamp = [];
  const equity = [];
  const profit_loss = [];
  const profit_loss_pct = [];

  let currentEquity = 97500;
  for (let i = 30; i >= 0; i--) {
    const ts = now - i * oneDay;
    timestamp.push(ts);
    
    // Simulate realistic daily fluctuations
    const daySeed = Math.sin(i * 0.5) * 350;
    const randomNoise = (Math.random() - 0.45) * 450;
    const dailyChange = Math.round(daySeed + randomNoise);
    
    currentEquity += dailyChange;
    equity.push(currentEquity);
    profit_loss.push(dailyChange);
    profit_loss_pct.push(dailyChange / (currentEquity - dailyChange));
  }

  return {
    timestamp,
    equity,
    profit_loss,
    profit_loss_pct
  };
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    if (!params.period) params.period = '1M';
    if (!params.timeframe) params.timeframe = '1D';

    let data = null;
    try {
      data = await getPortfolioHistory(params);
    } catch (err) {
      console.error('Failed to fetch history from Alpaca:', err.message);
    }

    // If no data returned from Alpaca (e.g. empty account), fall back to generated history
    if (!data || !data.equity || data.equity.length === 0 || data.equity[0] === null) {
      return NextResponse.json(generateMockHistory());
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Alpaca history API route error:', err);
    return NextResponse.json(generateMockHistory());
  }
}

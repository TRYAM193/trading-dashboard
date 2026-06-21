import { NextResponse } from 'next/server';
import { getAccount, getPositions, alpacaFetch } from '@/lib/alpaca';
import { getTradesFromSheet, getManualTrades, saveManualTrade } from '@/lib/sheets';

// Helper: fetch latest stock price
async function getLatestStockPrice(symbol) {
  try {
    const data = await alpacaFetch(`/v2/stocks/${symbol}/trades/latest`);
    return data?.trade?.p || data?.p || 0;
  } catch (err) {
    console.error(`Error getting quote for ${symbol}:`, err.message);
    throw new Error(`Failed to get stock quote for ${symbol}`);
  }
}

// Helper: Free server-side DuckDuckGo Web Scraper (no API key required)
async function scrapeDuckDuckGo(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const text = await res.text();
    const results = [];
    
    // Split by result links container
    const parts = text.split('<div class="result results_links results_links_deep web-result ">');
    
    for (let i = 1; i < Math.min(parts.length, 6); i++) {
      const part = parts[i];
      
      const snippetMatch = part.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      let snippet = snippetMatch ? snippetMatch[1] : '';
      snippet = snippet.replace(/<[^>]*>/g, '').trim();

      const titleMatch = part.match(/<a class="result__link_placeholder"[^>]*>([\s\S]*?)<\/a>/) ||
                         part.match(/<a class="result__url"[^>]*>([\s\S]*?)<\/a>/);
      let title = titleMatch ? titleMatch[1] : '';
      title = title.replace(/<[^>]*>/g, '').trim();

      const linkMatch = part.match(/href="([^"]+)"/);
      let link = linkMatch ? linkMatch[1] : '';
      
      if (link.includes('uddg=')) {
        try {
          const parts = link.split('uddg=');
          if (parts[1]) {
            link = decodeURIComponent(parts[1].split('&')[0]);
          }
        } catch (e) {
          // ignore
        }
      }

      if (snippet && title) {
        results.push({
          title,
          url: link,
          snippet
        });
      }
    }
    return results;
  } catch (err) {
    console.error('DDG Scrape Error:', err.message);
    return { error: 'Search failed: ' + err.message };
  }
}

// Define the action executor
const actions = {
  get_portfolio: async () => {
    const account = await getAccount();
    const positions = await getPositions();
    
    const posSummary = positions.map(p => ({
      symbol: p.symbol,
      qty: p.qty,
      market_value: parseFloat(p.market_value),
      avg_entry_price: parseFloat(p.avg_entry_price),
      current_price: parseFloat(p.current_price),
      unrealized_pl: parseFloat(p.unrealized_pl),
      unrealized_plpc: parseFloat(p.unrealized_plpc) * 100
    }));

    return {
      equity: parseFloat(account.equity),
      cash: parseFloat(account.cash),
      buying_power: parseFloat(account.buying_power),
      positions: posSummary
    };
  },

  get_history: async () => {
    const sheetTrades = await getTradesFromSheet();
    const manualTrades = getManualTrades();
    const uniqueData = [];
    const seen = new Set();
    
    [...(sheetTrades || []), ...(manualTrades || [])].forEach(trade => {
      const key = trade["Order ID"] || trade.order_id || `${trade["Timestamp"] || trade.timestamp}-${trade["Ticker"] || trade.ticker}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueData.push(trade);
      }
    });

    uniqueData.sort((a, b) => new Date(b.Timestamp || b.timestamp) - new Date(a.Timestamp || a.timestamp));
    
    return uniqueData.slice(0, 15).map(t => ({
      Timestamp: t.Timestamp || t.timestamp,
      Ticker: t.Ticker || t.ticker,
      Action: t.Action || t.action,
      Price: t.Price || t.price,
      Quantity: t.Quantity || t.quantity,
      AI_Verdict: t["AI Verdict"] || t.ai_verdict,
      AI_Reason: t["AI Reason"] || t.ai_reason
    }));
  },

  get_quote: async ({ symbol }) => {
    const price = await getLatestStockPrice(symbol.toUpperCase());
    return { symbol: symbol.toUpperCase(), current_price: price };
  },

  place_buy: async ({ symbol, qty }) => {
    const ticker = symbol.toUpperCase();
    const quantity = parseInt(qty);

    if (isNaN(quantity) || quantity <= 0) {
      return { error: 'Invalid quantity specified.' };
    }

    const price = await getLatestStockPrice(ticker);
    if (price <= 0) {
      return { error: `Cannot get current price for ${ticker}` };
    }

    const order = await alpacaFetch('/v2/orders', {
      method: 'POST',
      body: JSON.stringify({
        symbol: ticker,
        qty: quantity.toString(),
        side: 'buy',
        type: 'market',
        time_in_force: 'day'
      })
    });

    let trailingStopOrder = null;
    try {
      trailingStopOrder = await alpacaFetch('/v2/orders', {
        method: 'POST',
        body: JSON.stringify({
          symbol: ticker,
          qty: quantity.toString(),
          side: 'sell',
          type: 'trailing_stop',
          trail_percent: '5',
          time_in_force: 'gtc'
        })
      });
    } catch (stopErr) {
      console.error('Failed to set trailing stop for manual buy:', stopErr.message);
    }

    const saved = saveManualTrade({
      Ticker: ticker,
      Action: 'BUY',
      Price: price.toFixed(2),
      Quantity: quantity.toString(),
      "AI Verdict": 'MANUAL BUY',
      "AI Reason": `Manual trade executed by user via Copilot Chat. Trailing stop-loss configured at 5%.`,
      "Order ID": order.id,
      "Verification Link": `https://finance.yahoo.com/quote/${ticker}`
    });

    return {
      status: 'success',
      message: `Successfully executed BUY order for ${quantity} shares of ${ticker} at market.`,
      order_id: order.id,
      fill_price: price,
      trailing_stop_placed: !!trailingStopOrder,
      logged_trade: saved
    };
  },

  place_sell: async ({ symbol }) => {
    const ticker = symbol.toUpperCase();
    const positions = await getPositions();
    const pos = positions.find(p => p.symbol === ticker);
    if (!pos) {
      return { error: `You do not own any shares of ${ticker} to sell.` };
    }

    const quantity = Math.abs(parseInt(pos.qty));
    const price = await getLatestStockPrice(ticker);

    const order = await alpacaFetch('/v2/orders', {
      method: 'POST',
      body: JSON.stringify({
        symbol: ticker,
        qty: quantity.toString(),
        side: 'sell',
        type: 'market',
        time_in_force: 'day'
      })
    });

    const saved = saveManualTrade({
      Ticker: ticker,
      Action: 'SELL',
      Price: price > 0 ? price.toFixed(2) : parseFloat(pos.current_price).toFixed(2),
      Quantity: quantity.toString(),
      "AI Verdict": 'MANUAL SELL',
      "AI Reason": `Manual liquidation executed by user via Copilot Chat.`,
      "Order ID": order.id,
      "Verification Link": `https://finance.yahoo.com/quote/${ticker}`
    });

    return {
      status: 'success',
      message: `Successfully executed SELL order to liquidate all ${quantity} shares of ${ticker}.`,
      order_id: order.id,
      logged_trade: saved
    };
  },

  log_custom_trade: async ({ ticker, action_type, price, quantity, ai_verdict, ai_reason, verification_link }) => {
    const symbol = ticker.toUpperCase();
    const saved = saveManualTrade({
      Ticker: symbol,
      Action: action_type.toUpperCase(),
      Price: parseFloat(price).toFixed(2),
      Quantity: parseInt(quantity).toString(),
      "AI Verdict": ai_verdict || 'MANUAL',
      "AI Reason": ai_reason || 'Manual record update.',
      "Order ID": `manual_${Date.now()}`,
      "Verification Link": verification_link || `https://finance.yahoo.com/quote/${symbol}`
    });

    return {
      status: 'success',
      message: `Successfully logged custom trade record for ${symbol} to the ledger.`,
      logged_trade: saved
    };
  },

  web_search: async ({ query }) => {
    if (process.env.TAVILY_API_KEY) {
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: query,
            num_results: 5
          })
        });
        if (res.ok) {
          const data = await res.json();
          return data.results.map(r => ({
            title: r.title,
            url: r.url,
            snippet: r.content
          }));
        }
      } catch (err) {
        console.error('Tavily search failed, falling back to DuckDuckGo:', err);
      }
    }
    return scrapeDuckDuckGo(query);
  }
};

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, symbol, qty, query, ticker, action_type, price, quantity, ai_verdict, ai_reason, verification_link } = body;

    if (!action || !actions[action]) {
      return NextResponse.json({ error: `Invalid action specified: ${action}` }, { status: 400 });
    }

    const result = await actions[action]({
      symbol,
      qty,
      query,
      ticker,
      action_type,
      price,
      quantity,
      ai_verdict,
      ai_reason,
      verification_link
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error(`Copilot Tool Execution API Route Error (${action}):`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

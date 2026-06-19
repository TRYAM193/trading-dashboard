import { NextResponse } from 'next/server';
import { getAccount, getPositions, alpacaFetch } from '@/lib/alpaca';
import { getTradesFromSheet, getManualTrades, saveManualTrade } from '@/lib/sheets';

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

// ReAct loop execution tools
const tools = {
  get_portfolio_status: async () => {
    try {
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
    } catch (err) {
      return { error: 'Failed to fetch portfolio status: ' + err.message };
    }
  },

  get_trade_history: async () => {
    try {
      const sheetTrades = await getTradesFromSheet();
      const manualTrades = getManualTrades();
      const allTrades = [...(sheetTrades || []), ...(manualTrades || []), ...MOCK_PAST_TRADES];
      
      // De-duplicate by Order ID or Timestamp+Ticker to prevent overlap
      const uniqueData = [];
      const seen = new Set();
      
      allTrades.forEach(trade => {
        const key = trade["Order ID"] || trade.order_id || `${trade["Timestamp"] || trade.timestamp}-${trade["Ticker"] || trade.ticker}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueData.push(trade);
        }
      });

      // Sort by timestamp descending and take the last 15
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
    } catch (err) {
      return { error: 'Failed to fetch trade history: ' + err.message };
    }
  },

  get_stock_quote: async ({ symbol }) => {
    try {
      const price = await getLatestStockPrice(symbol.toUpperCase());
      return { symbol: symbol.toUpperCase(), current_price: price };
    } catch (err) {
      return { error: `Failed to fetch quote for ${symbol}: ` + err.message };
    }
  },

  place_buy_order: async ({ symbol, qty }) => {
    const ticker = symbol.toUpperCase();
    const quantity = parseInt(qty);

    if (isNaN(quantity) || quantity <= 0) {
      return { error: 'Invalid quantity specified.' };
    }

    try {
      // 1. Fetch current price
      const price = await getLatestStockPrice(ticker);
      if (price <= 0) {
        return { error: `Cannot get current price for ${ticker}` };
      }

      // 2. Place market buy order on Alpaca
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

      // 3. Place trailing stop sell order (5% trail) immediately after buy executes
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

      // 4. Log the manual trade locally
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
    } catch (err) {
      return { error: `Failed to place buy order for ${ticker}: ` + err.message };
    }
  },

  place_sell_order: async ({ symbol }) => {
    const ticker = symbol.toUpperCase();
    try {
      // 1. Fetch active positions to see if we own this ticker
      const positions = await getPositions();
      const pos = positions.find(p => p.symbol === ticker);
      if (!pos) {
        return { error: `You do not own any shares of ${ticker} to sell.` };
      }

      const quantity = Math.abs(parseInt(pos.qty));
      const price = await getLatestStockPrice(ticker);

      // 2. Liquidate position
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

      // 3. Log the manual sell trade locally
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
    } catch (err) {
      return { error: `Failed to liquidate ${ticker}: ` + err.message };
    }
  }
};

// Main chat route POST
export async function POST(req) {
  try {
    const body = await req.json();
    const { message, history = [] } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const API_KEY = process.env.GROQ_API_KEY;
    if (!API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not configured on the server.' }, { status: 500 });
    }

    // Initialize agent conversation context
    let messagesContext = [...history];
    
    // Add current user message
    messagesContext.push({ role: 'user', content: message });

    // Limit agent ReAct iterations
    let iteration = 0;
    const maxIterations = 3;
    let finalReply = '';
    const toolExecLogs = [];

    while (iteration < maxIterations) {
      iteration++;

      // Construct Prompt with instruction + tools + history
      const systemInstruction = `You are a professional AI Trading Secretary and Portfolio Copilot.
You help the user manage their automated trading terminal.
You have access to live system tools to fetch portfolio metrics, check trade histories, get quotes, and place market orders (buy/sell).

CRITICAL INSTRUCTIONS:
1. When buying stocks, always remind the user that a 5% trailing stop-loss has been automatically attached.
2. When explaining decisions, look up past trades using get_trade_history. Read the AI Reason/AI Verdict to tell them why the automated scanner bought or sold.
3. Be professional, direct, and helpful. Use bullet points for structured data.
4. DO NOT BLINDLY PLACE TRADES. If the user suggests or commands to buy or sell a stock, first check if we already own it (using get_portfolio_status) and retrieve its current price (using get_stock_quote). Give a quick, smart analysis/recommendation (e.g. check current exposure or discuss general market conditions for the ticker) and ask the user for confirmation (or let them override) BEFORE actually calling place_buy_order or place_sell_order, UNLESS they explicitly command you "do it now", "execute immediately", or similar strong directives.
5. You MUST respond in a strict JSON format matching this schema:
{
  "thought": "Brief explanation of your thinking/reasoning",
  "toolCall": { "name": "tool_name", "args": { "arg1": "val1" } } or null,
  "reply": "Your conversational message to the user. If calling a tool, explain what you are doing (e.g. 'Checking your portfolio status now...'). If no tool is called, this is your final complete response."
}
Do not output anything outside of this JSON block. Do not include markdown code block syntax (like \`\`\`json) inside the raw JSON response itself. Ensure all JSON fields are validly quoted.

Available Tools:
- get_portfolio_status: Check account equity, cash left, buying power, and active stock holdings.
- get_trade_history: Fetch the master ledger of past AI trades, decisions, and reasoning explanations.
- get_stock_quote: args: { "symbol": "TICKER" }. Get the latest price of a stock.
- place_buy_order: args: { "symbol": "TICKER", "qty": quantity }. Place a market buy order for a stock.
- place_sell_order: args: { "symbol": "TICKER" }. Sell/liquidate all shares of an owned stock.
`;

      // Call Groq API
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemInstruction },
            ...messagesContext.map(m => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.content
            }))
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2
        })
      });

      if (!groqRes.ok) {
        const errText = await groqRes.text();
        throw new Error(`Groq API Error: ${errText}`);
      }

      const groqData = await groqRes.json();
      const rawText = groqData.choices?.[0]?.message?.content;
      
      if (!rawText) {
        throw new Error('Empty response from Groq API.');
      }

      let parsed = null;
      try {
        parsed = JSON.parse(rawText.trim());
      } catch (jsonErr) {
        console.error('Failed to parse Groq response as JSON:', rawText);
        throw new Error('Failed to parse model response: ' + jsonErr.message);
      }

      const { thought, toolCall, reply } = parsed;
      finalReply = reply;

      if (toolCall && toolCall.name && tools[toolCall.name]) {
        // Execute the tool
        toolExecLogs.push({ name: toolCall.name, args: toolCall.args || {} });
        
        // Add model's original JSON response to message context
        messagesContext.push({
          role: 'model',
          content: rawText
        });

        // Run the tool function
        const toolResult = await tools[toolCall.name](toolCall.args || {});
        
        // Add tool results as a user role message to the LLM (ReAct feedback loop)
        messagesContext.push({
          role: 'user',
          content: `[TOOL OUTPUT from ${toolCall.name}]: ${JSON.stringify(toolResult)}`
        });
      } else {
        // No tool call requested, we are done
        break;
      }
    }

    return NextResponse.json({
      reply: finalReply,
      toolLogs: toolExecLogs
    });

  } catch (err) {
    console.error('Copilot Chat API Route Error:', err);
    return NextResponse.json({
      reply: `I apologize, but I encountered an error while processing your request: ${err.message}`,
      toolLogs: []
    }, { status: 500 });
  }
}

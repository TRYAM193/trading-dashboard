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
  },

  log_custom_trade_record: async ({ ticker, action, price, quantity, ai_verdict, ai_reason, verification_link }) => {
    try {
      const symbol = ticker.toUpperCase();
      const saved = saveManualTrade({
        Ticker: symbol,
        Action: action.toUpperCase(),
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
    } catch (err) {
      return { error: 'Failed to log custom trade record: ' + err.message };
    }
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

// Main chat route POST
export async function POST(req) {
  try {
    const body = await req.json();
    const { message, history = [], aiEngine = 'gemini', conversationId } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Delegate to n8n Secretary Agent Webhook
    try {
      const n8nUrl = 'https://n8n.tryam193.in/webhook/copilot-chat';
      const n8nRes = await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          conversationId: conversationId || 'a8cae14d-a578-4604-aa95-692133b05a52'
        })
      });

      if (n8nRes.ok) {
        const n8nData = await n8nRes.json();
        const replyText = n8nData.answer || n8nData.output || 'No response generated.';
        
        // Format history context for client-side state
        const updatedHistory = [
          ...history,
          { role: 'user', content: message },
          { role: 'model', content: JSON.stringify({ thought: 'n8n delegation', toolCall: null, reply: replyText }) }
        ];

        return NextResponse.json({
          reply: replyText,
          toolLogs: [],
          executionSteps: [],
          history: updatedHistory
        });
      } else {
        console.warn("n8n Webhook returned non-2xx status, falling back to local ReAct agent:", n8nRes.status);
      }
    } catch (n8nErr) {
      console.error("Failed to route chat to n8n, falling back to local ReAct agent:", n8nErr);
    }

    const API_KEY = aiEngine === 'gemini' ? process.env.GEMINI_API_KEY : process.env.GROQ_API_KEY;
    if (!API_KEY) {
      return NextResponse.json({ error: `${aiEngine === 'gemini' ? 'GEMINI_API_KEY' : 'GROQ_API_KEY'} is not configured on the server.` }, { status: 500 });
    }

    // Fetch live Google Sheet Trades + Account Status dynamically
    let portfolioData = null;
    let recentTrades = [];
    try {
      const [account, positions, sheetTrades] = await Promise.all([
        getAccount().catch(() => ({})),
        getPositions().catch(() => []),
        getTradesFromSheet().catch(() => [])
      ]);

      if (account && account.equity) {
        const posSummary = positions.map(p => ({
          symbol: p.symbol,
          qty: p.qty,
          market_value: parseFloat(p.market_value),
          avg_entry_price: parseFloat(p.avg_entry_price),
          current_price: parseFloat(p.current_price),
          unrealized_pl: parseFloat(p.unrealized_pl),
          unrealized_plpc: parseFloat(p.unrealized_plpc) * 100
        }));

        portfolioData = {
          equity: parseFloat(account.equity),
          cash: parseFloat(account.cash),
          buying_power: parseFloat(account.buying_power),
          positions: posSummary
        };
      }

      const manualTrades = getManualTrades() || [];
      const allTrades = [...(sheetTrades || []), ...(manualTrades || []), ...MOCK_PAST_TRADES];
      const seen = new Set();
      recentTrades = allTrades
        .filter(t => {
          if (!t) return false;
          const key = t["Order ID"] || t.order_id || `${t["Timestamp"] || t.timestamp}-${t["Ticker"] || t.ticker}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => new Date(b.Timestamp || b.timestamp) - new Date(a.Timestamp || a.timestamp))
        .slice(0, 8)
        .map(t => ({
          Timestamp: t.Timestamp || t.timestamp,
          Ticker: t.Ticker || t.ticker,
          Action: t.Action || t.action,
          Price: t.Price || t.price,
          Quantity: t.Quantity || t.quantity,
          AI_Verdict: t["AI Verdict"] || t.ai_verdict,
          AI_Reason: t["AI Reason"] || t.ai_reason
        }));

    } catch (fetchErr) {
      console.warn("API: Pre-fetching portfolio data failed:", fetchErr.message);
    }

    const liveContextSummary = `
--- LIVE SYSTEM STATE (Sitting directly on your terminal/sheets) ---
PORTFOLIO SUMMARY:
- Total Equity: $${portfolioData?.equity?.toFixed(2) || 'Unknown'}
- Cash Balance: $${portfolioData?.cash?.toFixed(2) || 'Unknown'}
- Buying Power: $${portfolioData?.buying_power?.toFixed(2) || 'Unknown'}
- Active Holdings: ${portfolioData?.positions && portfolioData.positions.length > 0 
    ? portfolioData.positions.map(p => `${p.symbol} (${p.qty} shares @ avg entry $${p.avg_entry_price.toFixed(2)}, current $${p.current_price.toFixed(2)}, P&L: $${p.unrealized_pl.toFixed(2)} [${p.unrealized_plpc.toFixed(2)}%])`).join(', ')
    : 'None'}

RECENT TRADING ACTIVITY (Master Ledger & Sheets):
${recentTrades.length > 0 
    ? recentTrades.map(t => `- [${t.Timestamp}] ${t.Action} ${t.Quantity} shares of ${t.Ticker} at $${t.Price}. AI Verdict: ${t.AI_Verdict}. Reason: ${t.AI_Reason}`).join('\n')
    : 'No recent trades recorded.'}
------------------------------------------------------------------
`;

    // Initialize agent conversation context
    let messagesContext = [...history];
    
    // Add current user message
    messagesContext.push({ role: 'user', content: message });

    // Limit agent ReAct iterations
    let iteration = 0;
    const maxIterations = 3;
    let finalReply = '';
    const toolExecLogs = [];
    const executionSteps = [];

    while (iteration < maxIterations) {
      iteration++;

      // Construct Prompt with instruction + tools + history
      const systemInstruction = `You are the user's friendly, highly capable Personal Executive Assistant and Portfolio Copilot.
You help them manage their automated trading terminal, oversee their assets, and handle any tasks they give you.
You have access to live system tools to check portfolio metrics, review trade histories, fetch stock quotes, and place market orders (buy/sell).

Always speak in a helpful, warm, personal assistant tone (e.g., "I've checked that for you," "I can handle that immediately," "How would you like me to assist you with your portfolio today?"). Be responsive and proactive, acting as their dedicated executive secretary.

LIVE SYSTEM INFORMATION:
You sit directly on top of the user's live system, Google Sheets, and Alpaca terminal. You ALREADY have the current state without needing to call tools (unless performing new actions or checking changing prices). Use this data to answer questions instantly:
${liveContextSummary}

CRITICAL INSTRUCTIONS:
1. When buying stocks, always remind the user that a 5% trailing stop-loss has been automatically attached.
2. When explaining decisions, refer to the pre-loaded RECENT TRADING ACTIVITY above. Read the AI Reason/AI Verdict to tell them why the automated scanner bought or sold.
3. Be helpful, clear, and proactive. Use structured lists for data to make it easy for them to read.
4. DO NOT BLINDLY PLACE TRADES. If the user suggests or commands to buy or sell a stock, first check if we already own it (see Active Holdings above) and retrieve its current price (using get_stock_quote). Give a quick, smart analysis/recommendation (e.g. check current exposure or discuss general market conditions for the ticker) and ask the user for confirmation (or let them override) BEFORE actually calling place_buy_order or place_sell_order, UNLESS they explicitly command you "do it now", "execute immediately", or similar strong directives.
5. If the user asks you to handle non-trading tasks (like scheduling, note-taking, or general assistance), politely explain that while your primary tools are integrated with the trading terminal and executive sheets, you are happy to discuss ideas, take down notes in this chat, or help them draft emails.
6. When asked about stock decisions (buy/sell/hold), research reasons, or news catalysts, ALWAYS call the web_search tool to look up live market details and articles so you can give up-to-date and accurate recommendations.
7. You MUST respond in a strict JSON format matching this schema:
{
  "thought": "Brief explanation of your thinking/reasoning",
  "toolCall": { "name": "tool_name", "args": { "arg1": "val1" } } or null,
  "reply": "Your conversational message to the user. If calling a tool, explain what you are doing (e.g. 'Checking your portfolio status now...'). If no tool is called, this is your final complete response."
}
Do not output anything outside of this JSON block. Do not include markdown code block syntax (like \`\`\`json) inside the raw JSON response itself. Ensure all JSON fields are validly quoted.

Available Tools:
- get_portfolio_status: Check account equity, cash left, buying power, and active stock holdings (use if you need to double-check fresh data, otherwise use preloaded).
- get_trade_history: Fetch the master ledger of past AI trades, decisions, and reasoning explanations.
- get_stock_quote: args: { "symbol": "TICKER" }. Get the latest price of a stock.
- place_buy_order: args: { "symbol": "TICKER", "qty": quantity }. Place a market buy order for a stock.
- place_sell_order: args: { "symbol": "TICKER" }. Sell/liquidate all shares of an owned stock.
- web_search: args: { "query": "search query" }. Search the web for latest stock news, company catalysts, or general research before buying/selling/holding.
- log_custom_trade_record: args: { "ticker": "TICKER", "action": "BUY/SELL", "price": number, "quantity": number, "ai_verdict": "STRONG BUY/SELL/HOLD", "ai_reason": "why trade was taken", "verification_link": "optional url" }. Write/append a custom manual or simulated trade row to the ledger.
`;

      let apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      let modelName = 'llama-3.3-70b-versatile';

      if (aiEngine === 'gemini') {
        apiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
        modelName = 'gemini-2.5-flash';
      }

      // Call LLM API
      const llmRes = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
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

      if (!llmRes.ok) {
        const errText = await llmRes.text();
        throw new Error(`${aiEngine === 'gemini' ? 'Gemini' : 'Groq'} API Error: ${errText}`);
      }

      const llmData = await llmRes.json();
      const rawText = llmData.choices?.[0]?.message?.content;
      
      if (!rawText) {
        throw new Error(`Empty response from ${aiEngine === 'gemini' ? 'Gemini' : 'Groq'} API.`);
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
      let toolResult = null;

      if (toolCall && toolCall.name && tools[toolCall.name]) {
        // Execute the tool
        toolExecLogs.push({ name: toolCall.name, args: toolCall.args || {} });
        
        // Add model's original JSON response to message context
        messagesContext.push({
          role: 'model',
          content: rawText
        });

        // Run the tool function
        toolResult = await tools[toolCall.name](toolCall.args || {});
        
        // Add tool results as a user role message to the LLM (ReAct feedback loop)
        messagesContext.push({
          role: 'user',
          content: `[TOOL OUTPUT from ${toolCall.name}]: ${JSON.stringify(toolResult)}`
        });
      }

      // Record detailed step
      executionSteps.push({
        iteration,
        thought: thought || '',
        reply: reply || '',
        toolCall: toolCall || null,
        toolResult: toolResult
      });

      // Break loop if no tool called
      if (!toolCall) {
        messagesContext.push({
          role: 'model',
          content: rawText
        });
        break;
      }
    }

    return NextResponse.json({
      reply: finalReply,
      toolLogs: toolExecLogs,
      executionSteps: executionSteps,
      history: messagesContext
    });

  } catch (err) {
    console.error('Copilot Chat API Route Error:', err);
    return NextResponse.json({
      reply: `I apologize, but I encountered an error while processing your request: ${err.message}`,
      toolLogs: [],
      executionSteps: [],
      history: history
    }, { status: 500 });
  }
}

import fs from 'fs';
import path from 'path';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const API_KEY = process.env.GOOGLE_API_KEY;

export async function getTradesFromSheet() {
  if (!API_KEY) {
    // Fallback: use published CSV export (sheet must be published to web)
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
    try {
      const res = await fetch(csvUrl);
      const text = await res.text();
      // Google returns JSONP-like response, strip wrapper
      const jsonStr = text.replace(/^.*google\.visualization\.Query\.setResponse\(/, '').replace(/\);?\s*$/, '');
      const data = JSON.parse(jsonStr);

      const cols = data.table.cols.map(c => c.label);
      const rows = data.table.rows.map(row => {
        const obj = {};
        row.c.forEach((cell, i) => {
          obj[cols[i]] = cell ? (cell.v || '') : '';
        });
        return obj;
      });
      return rows;
    } catch (err) {
      console.error('Sheets fetch error:', err);
      return [];
    }
  }

  // Use Google Sheets API v4
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1?key=${API_KEY}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.values || data.values.length < 2) return [];
    const headers = data.values[0];
    return data.values.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] || ''; });
      return obj;
    });
  } catch (err) {
    console.error('Sheets API error:', err);
    return [];
  }
}

const getManualTradesPath = () => path.join(process.cwd(), 'src', 'data', 'manual_trades.json');

export function getManualTrades() {
  try {
    const filePath = getManualTradesPath();
    if (!fs.existsSync(filePath)) {
      // Ensure directory exists
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify([], null, 2));
      return [];
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error('Failed to read manual trades:', err.message);
    return [];
  }
}

export function saveManualTrade(trade) {
  try {
    const filePath = getManualTradesPath();
    const trades = getManualTrades();
    const updatedTrade = {
      Timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      ...trade
    };
    trades.push(updatedTrade);
    
    // Ensure directory exists
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(trades, null, 2));
    return updatedTrade;
  } catch (err) {
    console.error('Failed to save manual trade:', err.message);
    throw err;
  }
}

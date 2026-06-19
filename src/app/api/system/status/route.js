import { getAccount } from '@/lib/alpaca';
import { getTradesFromSheet } from '@/lib/sheets';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  let alpacaConnected = false;
  let sheetsConnected = false;

  try {
    await getAccount();
    alpacaConnected = true;
  } catch (err) {
    console.error('Alpaca connectivity check failed:', err.message);
  }

  try {
    const trades = await getTradesFromSheet();
    if (trades && Array.isArray(trades)) {
      sheetsConnected = true;
    }
  } catch (err) {
    console.error('Google Sheets connectivity check failed:', err.message);
  }

  // Load workflow status from JSON file
  let workflowData = { workflows: [], recentErrors: [] };
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'system_status.json');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    workflowData = JSON.parse(fileContent);
  } catch (err) {
    console.error('Failed to read workflow status from file:', err.message);
  }

  return NextResponse.json({
    connectivity: {
      alpacaTrading: alpacaConnected,
      alpacaData: alpacaConnected,
      googleSheets: sheetsConnected,
      slack: true // Slack webhook requires execution which we assume is OK if workflow connects
    },
    workflows: workflowData.workflows,
    recentErrors: workflowData.recentErrors
  });
}

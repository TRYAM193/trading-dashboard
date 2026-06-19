'use client';

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  RefreshCw, 
  AlertTriangle,
  LayoutGrid,
  Percent,
  CheckCircle,
  TrendingDown,
  Clock
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip as RechartsTooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ReferenceLine 
} from 'recharts';
import { 
  SECTOR_MAP, 
  SECTOR_COLORS, 
  formatCurrency, 
  formatPercent 
} from '@/lib/utils';
import styles from './page.module.css';

export default function PositionsMonitor() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [account, setAccount] = useState(null);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [accountRes, positionsRes, ordersRes] = await Promise.all([
        fetch('/api/alpaca/account').then(r => { if (!r.ok) throw new Error('Account fetch failed'); return r.json(); }),
        fetch('/api/alpaca/positions').then(r => { if (!r.ok) throw new Error('Positions fetch failed'); return r.json(); }),
        fetch('/api/alpaca/orders?status=filled&limit=20').then(r => { if (!r.ok) throw new Error('Orders fetch failed'); return r.json(); })
      ]);

      setAccount(accountRes);
      setPositions(positionsRes);
      setOrders(ordersRes);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Data fetching error:', err);
      setError(err.message || 'Failed to fetch positions data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchData();

    // Auto refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return <div className="animate-fade" style={{ color: 'var(--text-secondary)' }}>Loading Copilot...</div>;
  }

  const equity = account ? parseFloat(account.equity) : 0;
  const lastEquity = account ? parseFloat(account.last_equity) : 0;
  const todayPL = equity - lastEquity;

  // Process Positions
  const processedPositions = positions.map(pos => {
    const symbol = pos.symbol;
    const qty = parseFloat(pos.qty);
    const avgEntry = parseFloat(pos.avg_entry_price);
    const currentPrice = parseFloat(pos.current_price);
    const marketValue = parseFloat(pos.market_value);
    const unrealizedPL = parseFloat(pos.unrealized_pl);
    const unrealizedPLPct = parseFloat(pos.unrealized_plpc) * 100;
    const sector = SECTOR_MAP[symbol] || 'Other';
    const weight = equity > 0 ? (marketValue / equity) * 100 : 0;

    return {
      symbol,
      sector,
      qty,
      avgEntry,
      currentPrice,
      marketValue,
      unrealizedPL,
      unrealizedPLPct,
      weight
    };
  }).sort((a, b) => Math.abs(b.unrealizedPL) - Math.abs(a.unrealizedPL)); // Sort by absolute P&L by default

  // Sector Allocation Calculations
  const sectorAlloc = {};
  processedPositions.forEach(pos => {
    sectorAlloc[pos.sector] = (sectorAlloc[pos.sector] || 0) + pos.marketValue;
  });

  const pieData = Object.keys(sectorAlloc).map(sector => ({
    name: sector,
    value: sectorAlloc[sector],
    percentage: equity > 0 ? (sectorAlloc[sector] / equity) * 100 : 0
  })).sort((a, b) => b.value - a.value);

  // Highest Sector concentration
  const highestSector = pieData.length > 0 ? pieData[0] : { name: 'None', percentage: 0 };

  // Check Cooldown Status
  // Sells within last 2 hours
  const recentSells = orders.filter(o => o.side === 'sell' && o.status === 'filled');
  let isCooldownActive = false;
  let cooldownTimeRemaining = '';
  if (recentSells.length > 0) {
    const lastSellTime = new Date(recentSells[0].filled_at);
    const diffMs = new Date() - lastSellTime;
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 2) {
      isCooldownActive = true;
      const minsLeft = Math.ceil(120 - (diffMs / (1000 * 60)));
      cooldownTimeRemaining = `${minsLeft}m left`;
    }
  }

  // Calculate Market Open/Closed Status (9:30 AM - 4:00 PM EST, Weekdays)
  const isMarketOpen = () => {
    // Current date and time in New York timezone
    const nyDateStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    const nyDate = new Date(nyDateStr);
    const day = nyDate.getDay(); // 0 is Sunday, 6 is Saturday
    const hours = nyDate.getHours();
    const minutes = nyDate.getMinutes();
    const isWeekday = day >= 1 && day <= 5;
    const isBetweenHours = (hours === 9 && minutes >= 30) || (hours > 9 && hours < 16);
    return isWeekday && isBetweenHours;
  };
  const marketOpen = isMarketOpen();

  // Safety Gates Status Definitions
  const dailyLossLimit = -500;
  const gates = [
    {
      id: 'daily_loss',
      name: 'Daily Loss Limit',
      value: formatCurrency(todayPL),
      detail: `Limit: ${formatCurrency(dailyLossLimit)}`,
      status: todayPL <= dailyLossLimit ? 'red' : todayPL <= dailyLossLimit * 0.8 ? 'yellow' : 'green',
      icon: TrendingDown
    },
    {
      id: 'position_cap',
      name: 'Position Cap',
      value: `${processedPositions.length} / 8`,
      detail: 'Max 8 positions cap',
      status: processedPositions.length >= 8 ? 'red' : processedPositions.length >= 7 ? 'yellow' : 'green',
      icon: LayoutGrid
    },
    {
      id: 'sector_guard',
      name: 'Sector Guard',
      value: `${highestSector.percentage.toFixed(1)}%`,
      detail: `Max: 30% (${highestSector.name})`,
      status: highestSector.percentage >= 35 ? 'red' : highestSector.percentage >= 30 ? 'yellow' : 'green',
      icon: Percent
    },
    {
      id: 'cooldown',
      name: 'Cooldown Gate',
      value: isCooldownActive ? 'Cooldown' : 'Clear',
      detail: isCooldownActive ? `Recent sell • ${cooldownTimeRemaining}` : 'No recent loss sells',
      status: isCooldownActive ? 'yellow' : 'green',
      icon: CheckCircle
    },
    {
      id: 'market_hours',
      name: 'Market Hours',
      value: marketOpen ? 'Open' : 'Closed',
      detail: '9:30 AM - 4:00 PM EST',
      status: marketOpen ? 'green' : 'yellow',
      icon: Clock
    }
  ];

  return (
    <div className="animate-fade">
      <header className={styles.positionsHeader}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Positions & Risk Monitor</h1>
            <p className="section-title" style={{ marginBottom: 0, fontSize: '12px' }}>
              Real-time exposure auditing, risk threshold validation, and asset allocation
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {lastUpdated && (
              <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button 
              onClick={fetchData} 
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-card)',
                color: 'var(--text-primary)',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Refresh Data"
            >
              <RefreshCw size={14} className={loading ? 'animate-pulse' : ''} />
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="card" style={{ border: '1px solid var(--color-loss)', background: 'var(--color-loss-bg)', display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px' }}>
          <AlertTriangle color="var(--color-loss)" />
          <div>
            <h3 style={{ color: 'var(--color-loss)', fontWeight: 600 }}>API Connection Alert</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{error}. Running in disconnected view.</p>
          </div>
        </div>
      )}

      {/* Open Positions Table */}
      <section className={styles.tableCard}>
        <h2 className={styles.tableTitle}>Current Open Positions ({processedPositions.length})</h2>
        {loading && processedPositions.length === 0 ? (
          <div className={`${styles.skeletonTable} skeleton`} />
        ) : processedPositions.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '60px 0' }}>
            No open stock positions found. AI scanner will evaluate trades at market open.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Sector</th>
                <th style={{ textAlign: 'right' }}>Entry Price</th>
                <th style={{ textAlign: 'right' }}>Current Price</th>
                <th style={{ textAlign: 'right' }}>Shares</th>
                <th style={{ textAlign: 'right' }}>Market Value</th>
                <th style={{ textAlign: 'right' }}>Weight</th>
                <th style={{ textAlign: 'right' }}>Unrealized P&L</th>
              </tr>
            </thead>
            <tbody>
              {processedPositions.map((pos) => {
                const isProfit = pos.unrealizedPL >= 0;
                const plColor = isProfit ? 'var(--color-profit)' : 'var(--color-loss)';
                const sectorColor = SECTOR_COLORS[pos.sector] || '#8b8fa3';
                
                return (
                  <tr 
                    key={pos.symbol} 
                    style={{ 
                      background: isProfit 
                        ? 'rgba(0, 212, 170, 0.015)' 
                        : 'rgba(255, 71, 87, 0.015)' 
                    }}
                  >
                    <td>
                      <span className="mono" style={{ fontWeight: 700, fontSize: '15px' }}>{pos.symbol}</span>
                    </td>
                    <td>
                      <span 
                        className="badge" 
                        style={{ 
                          background: `${sectorColor}15`, 
                          color: sectorColor,
                          border: `1px solid ${sectorColor}30`,
                          padding: '2px 8px',
                          fontSize: '11px'
                        }}
                      >
                        {pos.sector}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(pos.avgEntry)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(pos.currentPrice)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{pos.qty}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{formatCurrency(pos.marketValue)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {pos.weight.toFixed(1)}%
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: plColor, fontWeight: 600 }}>
                      <div>{isProfit ? '+' : ''}{formatCurrency(pos.unrealizedPL)}</div>
                      <div style={{ fontSize: '11px', fontWeight: 500 }}>
                        {isProfit ? '▲' : '▼'} {formatPercent(pos.unrealizedPLPct)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Risk Analysis Grid */}
      <section className={styles.chartsGrid}>
        {loading && pieData.length === 0 ? (
          <>
            <div className={`${styles.chartCard} ${styles.skeletonChart} skeleton`} />
            <div className={`${styles.chartCard} ${styles.skeletonChart} skeleton`} />
          </>
        ) : (
          <>
            {/* Sector Allocation */}
            <div className={styles.chartCard}>
              <h2 className={styles.chartTitle}>Sector Allocation</h2>
              <div className={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => {
                        const color = SECTOR_COLORS[entry.name] || '#8b8fa3';
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)', borderRadius: '8px' }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                      formatter={(value, name, props) => {
                        const percentage = props.payload.percentage.toFixed(1);
                        return [`${formatCurrency(value)} (${percentage}%)`, name];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className={styles.donutCenter}>
                  <div className={styles.donutCenterLabel}>Total Value</div>
                  <div className={styles.donutCenterValue}>{formatCurrency(processedPositions.reduce((s, p) => s + p.marketValue, 0))}</div>
                </div>
              </div>
            </div>

            {/* Position Concentration */}
            <div className={styles.chartCard}>
              <h2 className={styles.chartTitle}>Position Concentration Weight (%)</h2>
              <div className={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={processedPositions} 
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                  >
                    <XAxis 
                      type="number" 
                      stroke="var(--text-muted)" 
                      fontSize={11} 
                      axisLine={false}
                      tickLine={false}
                      domain={[0, Math.max(25, ...processedPositions.map(p => p.weight + 5))]}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <YAxis 
                      dataKey="symbol" 
                      type="category" 
                      stroke="var(--text-primary)" 
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsTooltip 
                      contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)', borderRadius: '8px' }}
                      formatter={(value) => [`${value.toFixed(2)}%`, 'Portfolio Weight']}
                    />
                    <ReferenceLine x={20} stroke="var(--color-loss)" strokeDasharray="3 3" label={{ value: '20% Limit', fill: 'var(--color-loss)', position: 'insideTopRight', fontSize: 10 }} />
                    <Bar dataKey="weight" radius={[0, 4, 4, 0]}>
                      {processedPositions.map((entry, index) => {
                        const color = SECTOR_COLORS[entry.sector] || '#8b8fa3';
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Safety Gates Status Panel */}
      <section className={styles.gatesCard}>
        <h2 className={styles.chartTitle}>Risk Management Gates</h2>
        {loading && !account ? (
          <div className={`${styles.skeletonGates} skeleton`} />
        ) : (
          <div className={styles.gatesGrid}>
            {gates.map((gate) => {
              const Icon = gate.icon;
              return (
                <div key={gate.id} className={styles.gateItem}>
                  <div className={styles.gateHeader}>
                    <div className={styles.gateIconLabel}>
                      <Icon size={16} />
                      <span>{gate.name}</span>
                    </div>
                    <span className={`${styles.statusIndicator} ${styles[gate.status]}`} />
                  </div>
                  <div className={styles.gateValue}>{gate.value}</div>
                  <div className={styles.gateStatusRow} style={{ color: gate.status === 'green' ? 'var(--color-profit)' : gate.status === 'yellow' ? 'var(--color-warning)' : 'var(--color-loss)' }}>
                    <span>{gate.detail}</span>
                    <span>{gate.status === 'green' ? 'Pass' : gate.status === 'yellow' ? 'Alert' : 'Halted'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

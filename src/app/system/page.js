'use client';

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  RefreshCw, 
  Server, 
  Terminal, 
  Play, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import styles from './page.module.css';

export default function SystemStatus() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [status, setStatus] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/system/status');
      if (!res.ok) throw new Error('Failed to retrieve system status API data');
      const data = await res.json();
      setStatus(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to load system diagnostics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchData();

    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return <div className="animate-fade" style={{ color: 'var(--text-secondary)' }}>Loading System Status...</div>;
  }

  const connData = status?.connectivity || {
    alpacaTrading: false,
    alpacaData: false,
    googleSheets: false,
    slack: false
  };

  const workflows = status?.workflows || [];
  const recentErrors = status?.recentErrors || [];

  return (
    <div className="animate-fade">
      <header className={styles.systemHeader}>
        <div className="header-container">
          <div>
            <h1 className="page-title">System & Workflow Status</h1>
            <p className="section-title" style={{ marginBottom: 0, fontSize: '12px' }}>
              Microservices connectivity audit, N8N daemon orchestration, and cron engine diagnostics
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
              title="Refresh Diagnostics"
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
            <h3 style={{ color: 'var(--color-loss)', fontWeight: 600 }}>Daemon Offline</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{error}. System reporting daemon status failed.</p>
          </div>
        </div>
      )}

      {/* Connectivity Status Row */}
      <section className={styles.connGrid}>
        {loading && !status ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className={`${styles.connCard} ${styles.skeletonConn} skeleton`} />
          ))
        ) : (
          <>
            <div className={styles.connCard}>
              <div className={styles.connLeft}>
                <span className={styles.connLabel}>Alpaca Trading API</span>
                <span className={styles.connStatusText} style={{ color: connData.alpacaTrading ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                  {connData.alpacaTrading ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
              </div>
              <span className={`${styles.statusIndicator} ${connData.alpacaTrading ? styles.green : styles.red}`} />
            </div>

            <div className={styles.connCard}>
              <div className={styles.connLeft}>
                <span className={styles.connLabel}>Alpaca Market Data</span>
                <span className={styles.connStatusText} style={{ color: connData.alpacaData ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                  {connData.alpacaData ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
              </div>
              <span className={`${styles.statusIndicator} ${connData.alpacaData ? styles.green : styles.red}`} />
            </div>

            <div className={styles.connCard}>
              <div className={styles.connLeft}>
                <span className={styles.connLabel}>Google Sheets Ledger</span>
                <span className={styles.connStatusText} style={{ color: connData.googleSheets ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                  {connData.googleSheets ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
              </div>
              <span className={`${styles.statusIndicator} ${connData.googleSheets ? styles.green : styles.red}`} />
            </div>

            <div className={styles.connCard}>
              <div className={styles.connLeft}>
                <span className={styles.connLabel}>Slack Alerts API</span>
                <span className={styles.connStatusText} style={{ color: connData.slack ? 'var(--color-profit)' : 'var(--color-loss)' }}>
                  {connData.slack ? 'ACTIVE' : 'OFFLINE'}
                </span>
              </div>
              <span className={`${styles.statusIndicator} ${connData.slack ? styles.green : styles.red}`} />
            </div>
          </>
        )}
      </section>

      {/* Workflow Health Grid */}
      <h2 className={styles.logsTitle} style={{ marginBottom: '16px' }}>N8N Daemon Workflows ({workflows.length})</h2>
      <section className={styles.workflowGrid}>
        {loading && workflows.length === 0 ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className={`${styles.workflowCard} ${styles.skeletonWorkflow} skeleton`} />
          ))
        ) : workflows.length === 0 ? (
          <div className="card" style={{ color: 'var(--text-muted)', gridColumn: 'span 2', textAlign: 'center', padding: '40px 0' }}>
            No workflows found. Make sure the N8N local docker daemon is online.
          </div>
        ) : (
          workflows.map((wf) => {
            const isSuccess = wf.lastStatus === 'success';
            const isError = wf.lastStatus === 'error';
            const isWaiting = wf.lastStatus === 'waiting';

            let statusColor = 'var(--text-muted)';
            let statusIcon = HelpCircle;
            if (isSuccess) {
              statusColor = 'var(--color-profit)';
              statusIcon = CheckCircle2;
            } else if (isError) {
              statusColor = 'var(--color-loss)';
              statusIcon = XCircle;
            } else if (isWaiting) {
              statusColor = 'var(--color-warning)';
              statusIcon = Activity;
            }

            const StatusIconComponent = statusIcon;

            return (
              <div key={wf.id} className={styles.workflowCard}>
                <div className={styles.workflowHeader}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className={styles.workflowName}>{wf.name}</span>
                    <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {wf.id}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: statusColor }}>
                    <StatusIconComponent size={18} />
                    <span className="mono" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                      {wf.lastStatus}
                    </span>
                  </div>
                </div>

                <div className={styles.workflowMetaRow}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Schedule Trigger</span>
                    <span className={styles.metaValue}>{wf.schedule}</span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Orchestration Status</span>
                    <span className="badge badge-profit" style={{ padding: '2px 8px', alignSelf: 'flex-start', fontSize: '10px' }}>
                      🟢 ACTIVE
                    </span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Last Execution</span>
                    <span className={styles.metaValue} style={{ fontFamily: 'var(--font-mono)' }}>
                      {wf.lastRun ? timeAgo(wf.lastRun) : 'Never Run'}
                    </span>
                  </div>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Next Trigger</span>
                    <span className={styles.metaValue} style={{ fontFamily: 'var(--font-mono)' }}>
                      {timeAgo(wf.nextRun).replace('ago', 'from now')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* System Error Logs Table */}
      <section className={styles.logsCard}>
        <h2 className={styles.logsTitle}>Daemon Error Logs</h2>
        {loading && recentErrors.length === 0 ? (
          <div className={`${styles.skeletonLogs} skeleton`} />
        ) : recentErrors.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
            No system error events logged recently. All cron flows executing normally.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Workflow</th>
                <th>Failing Node</th>
                <th>Diagnostic Exception Message</th>
              </tr>
            </thead>
            <tbody>
              {recentErrors.map((error, idx) => (
                <tr key={idx} style={{ background: 'rgba(255, 71, 87, 0.015)' }}>
                  <td style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(error.timestamp).toLocaleString()}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{error.workflowName}</span>
                  </td>
                  <td>
                    <span className="badge badge-warning" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '2px 8px' }}>
                      {error.node}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {error.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

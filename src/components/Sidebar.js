'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Shield, 
  History, 
  Brain, 
  Activity,
  MessageSquare
} from 'lucide-react';
import styles from './Sidebar.module.css';

const navItems = [
  { name: 'Portfolio Overview', path: '/', icon: LayoutDashboard },
  { name: 'Positions & Risk', path: '/positions', icon: Shield },
  { name: 'Trade History', path: '/history', icon: History },
  { name: 'AI Intelligence', path: '/ai', icon: Brain },
  { name: 'AI Secretary', path: '/copilot', icon: MessageSquare },
  { name: 'System Status', path: '/system', icon: Activity },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [estTime, setEstTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const timeString = new Date().toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      setEstTime(timeString);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.logoText}>AI Trading Copilot</span>
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className={`${styles.navLink} ${isActive ? styles.active : ''}`}
            >
              <Icon size={18} className={styles.navIcon} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <div className={styles.badge}>
          <span className={styles.badgeDot}></span>
          Paper Trading
        </div>
        <div className={styles.clock}>
          <span className={styles.clockLabel}>EST TIME</span>
          <span className={styles.clockTime}>{estTime || '00:00:00'}</span>
        </div>
      </div>
    </aside>
  );
}

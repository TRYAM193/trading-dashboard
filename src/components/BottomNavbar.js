'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Shield, 
  History, 
  Brain, 
  MessageSquare, 
  Activity
} from 'lucide-react';
import styles from './BottomNavbar.module.css';

const navItems = [
  { name: 'Overview', path: '/', icon: LayoutDashboard },
  { name: 'Positions', path: '/positions', icon: Shield },
  { name: 'History', path: '/history', icon: History },
  { name: 'AI', path: '/ai', icon: Brain },
  { name: 'Secretary', path: '/copilot', icon: MessageSquare },
  { name: 'System', path: '/system', icon: Activity },
];

export default function BottomNavbar() {
  const pathname = usePathname();

  return (
    <nav className={styles.bottomNav}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.path;
        return (
          <Link 
            key={item.path} 
            href={item.path}
            className={`${styles.navLink} ${isActive ? styles.active : ''}`}
          >
            <Icon size={20} className={styles.navIcon} />
            <span className={styles.navLabel}>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

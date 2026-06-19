'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import styles from './PageTransition.module.css';

const routeOrder = {
  '/': 0,
  '/positions': 1,
  '/history': 2,
  '/ai': 3,
  '/copilot': 4,
  '/system': 5,
};

export default function PageTransition({ children }) {
  const pathname = usePathname();
  const [animationClass, setAnimationClass] = useState('');
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    const prevPath = prevPathRef.current;
    if (prevPath === pathname) return;

    const prevIndex = routeOrder[prevPath] ?? 0;
    const currIndex = routeOrder[pathname] ?? 0;

    const direction = currIndex >= prevIndex ? styles.slideForward : styles.slideBackward;
    
    // Set direction and trigger animation
    setAnimationClass(direction);
    
    // Save current path as previous path for next transition
    prevPathRef.current = pathname;
    
    // Clear animation class after transition finishes (300ms)
    const timer = setTimeout(() => {
      setAnimationClass('');
    }, 300);

    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div className={`${styles.transitionWrapper} ${animationClass}`}>
      {children}
    </div>
  );
}

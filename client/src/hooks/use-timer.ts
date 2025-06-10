import { useState, useEffect, useCallback } from 'react';

interface TimerState {
  isActive: boolean;
  startTime: Date | null;
  elapsedTime: number;
}

const STORAGE_KEY = 'shiftTimer';

export function useTimer() {
  const [isActive, setIsActive] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Load timer state from localStorage on mount
  useEffect(() => {
    const savedTimerState = localStorage.getItem(STORAGE_KEY);
    if (savedTimerState) {
      try {
        const { isActive: savedIsActive, startTime: savedStartTime } = JSON.parse(savedTimerState);
        if (savedIsActive && savedStartTime) {
          const savedStart = new Date(savedStartTime);
          setIsActive(true);
          setStartTime(savedStart);
          
          // Calculate elapsed time since the saved start time
          const now = new Date();
          const elapsed = Math.floor((now.getTime() - savedStart.getTime()) / 1000);
          setElapsedTime(elapsed);
        }
      } catch (error) {
        console.error('Failed to load timer state:', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Timer update effect - runs continuously when active
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isActive && startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setElapsedTime(elapsed);
        
        // Update localStorage periodically
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          isActive: true,
          startTime: startTime.toISOString()
        }));
      }, 1000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isActive, startTime]);

  const startTimer = useCallback(() => {
    const now = new Date();
    setStartTime(now);
    setIsActive(true);
    setElapsedTime(0);
    
    // Save timer state to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      isActive: true,
      startTime: now.toISOString()
    }));
  }, []);

  const stopTimer = useCallback(() => {
    setIsActive(false);
    setStartTime(null);
    setElapsedTime(0);
    
    // Clear timer state from localStorage
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const formatElapsedTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }, []);

  return {
    isActive,
    startTime,
    elapsedTime,
    startTimer,
    stopTimer,
    formatElapsedTime
  };
}
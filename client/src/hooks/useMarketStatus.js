import { useState, useEffect } from 'react';
import { getMarketStatus } from '../lib/utils/marketHours';

// Re-evaluates market open/closed status every minute.
export function useMarketStatus() {
  const [status, setStatus] = useState(() => getMarketStatus());

  useEffect(() => {
    const id = setInterval(() => setStatus(getMarketStatus()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return status;
}

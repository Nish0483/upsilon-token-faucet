import { useEffect, useState } from "react";

/** Countdown that ticks every second from a remaining-seconds value. */
export function useCountdown(initialSeconds: number | undefined) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    setRemaining(Math.max(0, Math.floor(initialSeconds ?? 0)));
  }, [initialSeconds]);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = window.setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [remaining]);

  return remaining;
}

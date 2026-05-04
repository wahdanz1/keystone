import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "wheel"] as const;

export function useAutoLock(active: boolean, timeoutMs: number, onLock: () => void) {
  const timerRef = useRef<number | null>(null);
  const onLockRef = useRef(onLock);
  const lastActivityRef = useRef(Date.now());
  onLockRef.current = onLock;

  useEffect(() => {
    if (!active) return;

    const reset = () => {
      lastActivityRef.current = Date.now();
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        onLockRef.current();
      }, timeoutMs);
    };

    // After system sleep the tab becomes visible again; check if timeout elapsed while asleep.
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (Date.now() - lastActivityRef.current >= timeoutMs) {
          onLockRef.current();
        }
      }
    };

    reset();
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, reset, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, reset);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [active, timeoutMs]);
}

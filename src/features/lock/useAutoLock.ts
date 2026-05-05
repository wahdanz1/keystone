import { useCallback, useEffect, useRef, useState } from "react";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "wheel"] as const;
const TICK_MS = 100;

export interface AutoLockOptions {
  active: boolean;
  autoLockMs: number;
  showWarning: boolean;
  warningLeadMs: number;
  onLock: () => void;
}

export interface AutoLockState {
  warningActive: boolean;
  msRemaining: number;
  keepUnlocked: () => void;
  lockNow: () => void;
}

export function useAutoLock(opts: AutoLockOptions): AutoLockState {
  const { active, autoLockMs, showWarning, warningLeadMs, onLock } = opts;

  const lastActivityRef = useRef(Date.now());
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;
  const warningActiveRef = useRef(false);

  const [warningActive, setWarningActive] = useState(false);
  const [msRemaining, setMsRemaining] = useState(0);

  const reset = useCallback(() => {
    lastActivityRef.current = Date.now();
    warningActiveRef.current = false;
    setWarningActive(false);
  }, []);

  useEffect(() => {
    if (!active || autoLockMs <= 0) {
      warningActiveRef.current = false;
      setWarningActive(false);
      return;
    }

    lastActivityRef.current = Date.now();
    warningActiveRef.current = false;
    setWarningActive(false);

    const tick = () => {
      const elapsed = Date.now() - lastActivityRef.current;
      const remaining = autoLockMs - elapsed;

      if (remaining <= 0) {
        warningActiveRef.current = false;
        setWarningActive(false);
        onLockRef.current();
        return;
      }

      const inWarningWindow = showWarning && remaining <= warningLeadMs;
      if (inWarningWindow !== warningActiveRef.current) {
        warningActiveRef.current = inWarningWindow;
        setWarningActive(inWarningWindow);
      }
      if (inWarningWindow) {
        setMsRemaining(remaining);
      }
    };

    const onActivity = () => {
      // During the warning window, ignore passive activity — only an explicit
      // "Keep unlocked" click extends the session.
      if (warningActiveRef.current) return;
      lastActivityRef.current = Date.now();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (Date.now() - lastActivityRef.current >= autoLockMs) {
          onLockRef.current();
        }
      }
    };

    const intervalId = window.setInterval(tick, TICK_MS);
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [active, autoLockMs, showWarning, warningLeadMs]);

  const keepUnlocked = useCallback(() => {
    reset();
  }, [reset]);

  const lockNow = useCallback(() => {
    onLockRef.current();
  }, []);

  return { warningActive, msRemaining, keepUnlocked, lockNow };
}

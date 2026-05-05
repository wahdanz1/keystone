import { LuLock, LuShieldCheck } from "react-icons/lu";
import { Button } from "@/components/ui";

interface LockWarningOverlayProps {
  msRemaining: number;
  totalMs: number;
  onKeepUnlocked: () => void;
  onLockNow: () => void;
}

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function LockWarningOverlay({ msRemaining, totalMs, onKeepUnlocked, onLockNow }: LockWarningOverlayProps) {
  const progress = Math.max(0, Math.min(1, msRemaining / totalMs));
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const seconds = Math.max(1, Math.ceil(msRemaining / 1000));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-md">
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        <div className="relative flex h-32 w-32 items-center justify-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--color-muted)" strokeWidth="4" opacity="0.4" />
            <circle
              cx="50"
              cy="50"
              r={RADIUS}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 100ms linear" }}
            />
          </svg>
          <span className="font-mono text-4xl font-semibold tabular-nums text-foreground">{seconds}</span>
        </div>

        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">Locking due to inactivity</h2>
          <p className="text-sm text-muted-foreground">
            Your vault will lock in {seconds} second{seconds === 1 ? "" : "s"}.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onLockNow}>
            <LuLock /> Lock now
          </Button>
          <Button variant="primary" onClick={onKeepUnlocked} autoFocus>
            <LuShieldCheck /> Keep unlocked
          </Button>
        </div>
      </div>
    </div>
  );
}

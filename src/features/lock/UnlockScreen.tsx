import { useState, type FormEvent } from "react";
import { LuEye, LuEyeOff } from "react-icons/lu";
import { Button, Input, IconButton } from "@/components/ui";
import { cn } from "@/lib/utils";

interface PasswordStrength {
  level: 1 | 2 | 3 | 4;
  label: string;
  barClass: string;
}

function passwordStrength(password: string): PasswordStrength | null {
  if (password.length === 0) return null;

  let charset = 0;
  if (/[a-z]/.test(password)) charset += 26;
  if (/[A-Z]/.test(password)) charset += 26;
  if (/\d/.test(password)) charset += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charset += 32;

  const bits = password.length * Math.log2(Math.max(charset, 1));

  if (bits < 40) return { level: 1, label: "Weak", barClass: "bg-destructive" };
  if (bits < 60) return { level: 2, label: "Fair", barClass: "bg-warning" };
  if (bits < 80) return { level: 3, label: "Good", barClass: "bg-warning" };
  return { level: 4, label: "Strong", barClass: "bg-success" };
}

function toMessage(err: unknown): string {
  if (typeof err === "string") return capitalize(err);
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

interface UnlockScreenProps {
  mode: "unlock" | "create";
  onSubmit: (password: string, confirmation?: string) => Promise<void>;
}

export function UnlockScreen({ mode, onSubmit }: UnlockScreenProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const isCreate = mode === "create";
  const strength = isCreate ? passwordStrength(password) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (isCreate && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (isCreate && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsPending(true);
    try {
      await onSubmit(password, isCreate ? confirm : undefined);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col items-center gap-3">
          <img src="/keystone-logo.svg" alt="" className="h-16 w-16" />
          <h1 className="text-xl font-semibold tracking-tight">
            {isCreate ? "Create vault" : "Unlock vault"}
          </h1>
        </div>

        <Input
          type={showPassword ? "text" : "password"}
          placeholder="Master password"
          autoFocus
          autoComplete={isCreate ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          disabled={isPending}
          trailingIcon={
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
            >
              {showPassword ? <LuEyeOff /> : <LuEye />}
            </IconButton>
          }
        />

        {strength && (
          <div className="-mt-2 flex flex-col gap-1.5">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i <= strength.level ? strength.barClass : "bg-muted",
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{strength.label}</p>
          </div>
        )}

        {isCreate && (
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Confirm password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.currentTarget.value)}
            disabled={isPending}
          />
        )}

        {error && <p className="text-center text-sm text-destructive">{error}</p>}

        <Button type="submit" fullWidth disabled={isPending || password.length === 0}>
          {isPending ? "Working…" : isCreate ? "Create vault" : "Unlock"}
        </Button>
      </form>
    </div>
  );
}

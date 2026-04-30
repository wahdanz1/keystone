import { useState, type FormEvent } from "react";
import { LuEye, LuEyeOff } from "react-icons/lu";
import { Button, Input, IconButton } from "@/components/ui";

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
        <h1 className="text-center text-xl font-semibold tracking-tight">
          {isCreate ? "Create your vault" : "Unlock Keystone"}
        </h1>

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

import { useState } from "react";
import { Button } from "@/components/ui";

interface StatusErrorScreenProps {
  message: string;
  onRetry: () => Promise<void>;
}

export function StatusErrorScreen({ message, onRetry }: StatusErrorScreenProps) {
  const [isPending, setIsPending] = useState(false);

  async function handleRetry() {
    setIsPending(true);
    try {
      await onRetry();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col items-center gap-3">
          <img src="/keystone-logo.svg" alt="" className="h-16 w-16" />
          <h1 className="text-xl font-semibold tracking-tight">Couldn't open vault</h1>
        </div>
        <p className="text-center text-sm text-destructive">{message}</p>
        <Button fullWidth onClick={handleRetry} disabled={isPending}>
          {isPending ? "Retrying…" : "Retry"}
        </Button>
      </div>
    </div>
  );
}

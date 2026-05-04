import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, leadingIcon, trailingIcon, ...props }, ref) => (
    <div
      className={cn(
        "flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background",
        className,
      )}
    >
      {leadingIcon && (
        <span className="flex shrink-0 items-center text-muted-foreground [&_svg]:size-4">
          {leadingIcon}
        </span>
      )}
      <input
        ref={ref}
        className="h-full w-full min-w-0 flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      {trailingIcon && (
        <span className="flex shrink-0 items-center text-muted-foreground [&_svg]:size-4">
          {trailingIcon}
        </span>
      )}
    </div>
  ),
);
Input.displayName = "Input";

import { forwardRef, type HTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const List = forwardRef<HTMLUListElement, HTMLAttributes<HTMLUListElement>>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn("flex flex-col gap-0.5", className)} {...props} />
  ),
);
List.displayName = "List";

export interface ListItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const ListItem = forwardRef<HTMLButtonElement, ListItemProps>(
  ({ className, selected, leadingIcon, trailingIcon, children, ...props }, ref) => (
    <li className="contents">
      <button
        ref={ref}
        type="button"
        data-selected={selected ? "true" : undefined}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm outline-none transition-colors",
          "text-foreground hover:bg-accent hover:text-accent-foreground",
          "focus-visible:ring-2 focus-visible:ring-ring",
          "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
          className,
        )}
        {...props}
      >
        {leadingIcon && (
          <span className="flex shrink-0 items-center text-muted-foreground group-hover:text-accent-foreground group-data-[selected=true]:text-accent-foreground [&_svg]:size-4">
            {leadingIcon}
          </span>
        )}
        <span className="flex-1 truncate">{children}</span>
        {trailingIcon && (
          <span className="flex shrink-0 items-center text-muted-foreground [&_svg]:size-4">
            {trailingIcon}
          </span>
        )}
      </button>
    </li>
  ),
);
ListItem.displayName = "ListItem";

export const ListSection = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1", className)} {...props} />
  ),
);
ListSection.displayName = "ListSection";

export const ListSectionLabel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "px-2.5 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
);
ListSectionLabel.displayName = "ListSectionLabel";

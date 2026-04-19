import React, { type ButtonHTMLAttributes } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, active = false, className = "", children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={[
        "flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9a4f2c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f3ea] disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-[#e9dcc7] text-[#2f261f]"
          : "text-[#75695b] hover:bg-[#eee7dc] hover:text-[#2f261f]",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </button>
  )
);
IconButton.displayName = "IconButton";

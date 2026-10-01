import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        success: "bg-[#e7f4ec] text-success",
        warning: "bg-[#fbf3df] text-warning",
        destructive: "bg-[#fbeae8] text-destructive",
        muted: "bg-muted text-muted-foreground",
        outline: "border border-border text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const STATUS_BADGE: Record<string, "success" | "warning" | "destructive" | "muted" | "secondary"> = {
  aktif: "success",
  diajukan_finance: "warning",
  diverifikasi_doni: "secondary",
  ditolak: "destructive",
  draft: "muted",
};

const STATUS_LABEL: Record<string, string> = {
  aktif: "Aktif",
  diajukan_finance: "Diajukan Finance",
  diverifikasi_doni: "Verifikasi Doni",
  ditolak: "Ditolak",
  draft: "Draft",
};

export { Badge, badgeVariants, STATUS_BADGE, STATUS_LABEL };

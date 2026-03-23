import { cn } from "@/lib/cn";

export type MetricCardVariant = "default" | "indigo" | "rose" | "emerald";

type MetricCardProps = {
  value: number;
  label: string;
  variant?: MetricCardVariant;
};

export function MetricCard({ value, label, variant = "default" }: MetricCardProps) {
  return (
    <div
      className={cn(
        "statCard",
        variant === "indigo" && "statCardIndigo",
        variant === "rose" && "statCardRose",
        variant === "emerald" && "statCardEmerald"
      )}
    >
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

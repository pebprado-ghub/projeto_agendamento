import { cn } from "@/lib/cn";

type TabsProps = {
  value: string;
  onChange: (value: string) => void;
  items: Array<{ value: string; label: string }>;
  className?: string;
  /** `line`: aba com sublinhado (padrão). `segmented`: mesmo padrão dos modais de formulário. */
  variant?: "line" | "segmented";
  "aria-label"?: string;
};

export function Tabs({
  value,
  onChange,
  items,
  className,
  variant = "line",
  "aria-label": ariaLabel
}: TabsProps) {
  if (variant === "segmented") {
    return (
      <div className={cn("structuredFormTabsTrack structuredFormTabsTrack--toolbar", className)}>
        <div className="structuredFormTabs" role="tablist" aria-label={ariaLabel}>
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={value === item.value}
              className={value === item.value ? "isActive" : ""}
              onClick={() => onChange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("tabsRow", className)}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={value === item.value ? "tabActive" : "tabIdle"}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

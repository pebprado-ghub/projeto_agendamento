type TabsProps = {
  value: string;
  onChange: (value: string) => void;
  items: Array<{ value: string; label: string }>;
};

export function Tabs({ value, onChange, items }: TabsProps) {
  return (
    <div className="tabsRow">
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

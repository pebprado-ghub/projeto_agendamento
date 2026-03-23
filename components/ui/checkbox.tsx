import { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
};

export function Checkbox({ className, label, ...props }: CheckboxProps) {
  return (
    <label className={cn("uiCheckboxLabel", className)}>
      <input type="checkbox" className="uiCheckbox" {...props} />
      {label ? <span>{label}</span> : null}
    </label>
  );
}

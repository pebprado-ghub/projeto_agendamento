import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Texto ou fragmento à direita da caixa; a caixa fica sempre à esquerda na mesma linha. */
  label?: ReactNode;
};

export function Checkbox({ className, label, ...props }: CheckboxProps) {
  const showLabel = label != null && label !== "";
  return (
    <label className={cn("uiCheckboxLabel", className)}>
      <input type="checkbox" className="uiCheckbox" {...props} />
      {showLabel ? <span className="uiCheckboxLabelText">{label}</span> : null}
    </label>
  );
}

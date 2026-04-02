"use client";

import type { ReactNode } from "react";

/**
 * Dica opcional revelada no hover/foco no "?" — não substitui descrições de interface.
 * Mantenha visível: título/subtítulo de cards (`AdminCard` `description`), intros de fluxo,
 * instruções que o usuário precisa ler para continuar, estados vazios e erros (`helperText`).
 * Use `HelpHint` só para detalhe extra que esconder reduz ruído (como no painel do dev).
 */
export type HelpHintProps = {
  children: ReactNode;
  /** Card acima do "?" (padrão). "below" evita corte próximo ao topo de modais/abas. */
  placement?: "above" | "below";
  /** Rótulo acessível do controle de ajuda. */
  label?: string;
  /** Textos longos (ex.: LGPD): largura maior e rolagem vertical. */
  variant?: "default" | "wide";
  className?: string;
};

export function HelpHint({
  children,
  placement = "above",
  label = "Dica",
  variant = "default",
  className
}: HelpHintProps) {
  return (
    <span
      className={[
        "metricInfoTooltipWrap",
        placement === "below" ? "metricInfoTooltipWrap--below" : "",
        className ?? ""
      ]
        .filter(Boolean)
        .join(" ")}
      tabIndex={0}
    >
      <span className="metricInfoTooltipTrigger" aria-label={label}>
        ?
      </span>
      <span
        className={[
          "metricInfoTooltipCard",
          variant === "wide" ? "metricInfoTooltipCard--wide" : ""
        ]
          .filter(Boolean)
          .join(" ")}
        role="tooltip"
      >
        {children}
      </span>
    </span>
  );
}

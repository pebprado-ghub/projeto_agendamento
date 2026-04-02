import { ReactNode } from "react";

type FieldGroupProps = {
  title: string;
  children: ReactNode;
  /** Grupo acordeão (painel do desenvolvedor — cadastro de empresa). */
  accordionId?: string;
  accordionOpen?: boolean;
  onAccordionToggle?: () => void;
};

export function FieldGroup({
  title,
  children,
  accordionId,
  accordionOpen,
  onAccordionToggle
}: FieldGroupProps) {
  const isAccordion =
    accordionId != null &&
    typeof onAccordionToggle === "function" &&
    typeof accordionOpen === "boolean";

  if (isAccordion) {
    const panelId = `business-form-section-${accordionId}`;
    return (
      <section className="developerPlanCategory businessFormAccordionGroup">
        <button
          type="button"
          className="developerPlanCategoryTrigger"
          aria-expanded={accordionOpen}
          aria-controls={panelId}
          id={`${panelId}-label`}
          onClick={onAccordionToggle}
        >
          <span className="developerPlanCategoryTriggerStart">
            <svg
              className={`developerPlanCategoryChevron ${accordionOpen ? "isOpen" : ""}`}
              viewBox="0 0 12 12"
              width={14}
              height={14}
              aria-hidden
            >
              <path
                d="M2.5 4.25 L6 7.75 L9.5 4.25"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="developerPlanCategoryTitleWrap">
              <span className="developerPlanCategoryTitle">{title}</span>
              <span className="developerPlanCategoryHint">
                {accordionOpen ? "Clique para recolher" : "Clique para expandir"}
              </span>
            </span>
          </span>
        </button>
        <div
          id={panelId}
          role="region"
          aria-labelledby={`${panelId}-label`}
          className={`developerPlanCategoryBody ${accordionOpen ? "isOpen" : ""}`}
        >
          <div className="developerPlanCategoryBodyInner">
            <div className="businessFormAccordionPanel">{children}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="formGroup">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

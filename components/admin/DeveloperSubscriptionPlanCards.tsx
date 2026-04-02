"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ADMIN_PLAN_FEATURE_GROUPS,
  AdminPlanFeatureId,
  tierFeaturePreset
} from "@/lib/adminPlanFeatures";

type PlanCode = "free" | "pro" | "enterprise";

export type DeveloperCatalogPlan = {
  code: PlanCode;
  name: string;
  monthly_price_cents: number;
  monthly_appointment_limit: number | null;
  professional_limit: number | null;
  allows_automations: boolean;
  allows_multi_unit: boolean;
};

type EditablePlan = {
  code: PlanCode;
  name: string;
  priceInput: string;
  features: Record<AdminPlanFeatureId, boolean>;
  appointmentLimit: string;
  professionalLimit: string;
};

const PLAN_ORDER: PlanCode[] = ["free", "pro", "enterprise"];

const BADGE_LABEL: Record<PlanCode, string> = {
  free: "Essencial",
  pro: "Profissional",
  enterprise: "Enterprise"
};

function groupStateKey(planCode: PlanCode, groupId: string) {
  return `${planCode}:${groupId}`;
}

function buildDefaultOpenGroups(): Record<string, boolean> {
  const o: Record<string, boolean> = {};
  for (const code of PLAN_ORDER) {
    for (const g of ADMIN_PLAN_FEATURE_GROUPS) {
      o[groupStateKey(code, g.id)] = false;
    }
  }
  return o;
}

function centsToBrlInput(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(cents / 100);
}

function seedFromCatalog(plans: DeveloperCatalogPlan[]): EditablePlan[] {
  return PLAN_ORDER.map((code) => {
    const api = plans.find((p) => p.code === code);
    const base = tierFeaturePreset(code);
    if (api) {
      base.automations_n8n = api.allows_automations;
      base.multi_unit = api.allows_multi_unit;
    }
    const defaultName =
      code === "free" ? "Grátis" : code === "pro" ? "Profissional" : "Enterprise";
    return {
      code,
      name: api?.name ?? defaultName,
      priceInput: centsToBrlInput(api?.monthly_price_cents ?? 0),
      features: { ...base },
      appointmentLimit:
        api?.monthly_appointment_limit == null ? "" : String(api.monthly_appointment_limit),
      professionalLimit: api?.professional_limit == null ? "" : String(api.professional_limit)
    };
  });
}

export function DeveloperSubscriptionPlanCards({
  monetizationPlans
}: {
  monetizationPlans: DeveloperCatalogPlan[];
}) {
  const [drafts, setDrafts] = useState<EditablePlan[]>(() => seedFromCatalog(monetizationPlans));
  const [dirty, setDirty] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(buildDefaultOpenGroups);
  /** Só um plano expandido por vez; os demais mostram só o cabeçalho. */
  const [expandedPlanCode, setExpandedPlanCode] = useState<PlanCode | null>("free");

  useEffect(() => {
    setDrafts(seedFromCatalog(monetizationPlans));
    setDirty(false);
  }, [monetizationPlans]);

  function updatePlan(code: PlanCode, patch: Partial<EditablePlan>) {
    setDirty(true);
    setDrafts((prev) => prev.map((p) => (p.code === code ? { ...p, ...patch } : p)));
  }

  function toggleFeature(code: PlanCode, id: AdminPlanFeatureId, checked: boolean) {
    setDirty(true);
    setDrafts((prev) =>
      prev.map((p) =>
        p.code === code ? { ...p, features: { ...p.features, [id]: checked } } : p
      )
    );
  }

  function handleReset() {
    setDrafts(seedFromCatalog(monetizationPlans));
    setDirty(false);
  }

  /** Uma categoria aberta por plano; abrir outra fecha a anterior. Clicar na aberta recolhe. */
  function toggleGroup(planCode: PlanCode, groupId: string) {
    const key = groupStateKey(planCode, groupId);
    setOpenGroups((prev) => {
      const wasOpen = prev[key] ?? false;
      const next = { ...prev };
      if (wasOpen) {
        next[key] = false;
        return next;
      }
      for (const g of ADMIN_PLAN_FEATURE_GROUPS) {
        next[groupStateKey(planCode, g.id)] = g.id === groupId;
      }
      return next;
    });
  }

  function collapseAllGroupsForPlan(planCode: PlanCode) {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const g of ADMIN_PLAN_FEATURE_GROUPS) {
        next[groupStateKey(planCode, g.id)] = false;
      }
      return next;
    });
  }

  function togglePlanExpanded(code: PlanCode) {
    setExpandedPlanCode((prev) => {
      if (prev === code) return null;
      return code;
    });
  }

  return (
    <div className="developerPlanCatalog">
      <div className="developerPlanCatalogToolbar">
        <p className="developerPlanCatalogHint">
          Ajuste nome, preço e o escopo de funcionalidades por plano. O catálogo do servidor é a
          referência inicial; use <strong>Restaurar catálogo</strong> para recarregar os valores
          publicados na API.
        </p>
        {dirty ? (
          <Button type="button" variant="outline" size="sm" onClick={handleReset}>
            Restaurar catálogo
          </Button>
        ) : null}
      </div>
      <div className="developerPlanCardsGrid">
        {drafts.map((plan) => {
          const planExpanded = expandedPlanCode === plan.code;
          const planBodyId = `plan-body-${plan.code}`;
          const planHeadId = `plan-head-${plan.code}`;

          return (
          <article
            key={plan.code}
            className={`developerPlanCard ${planExpanded ? "isPlanExpanded" : ""}`}
          >
            <button
              type="button"
              className="developerPlanCardExpandTrigger"
              aria-expanded={planExpanded}
              aria-controls={planBodyId}
              id={planHeadId}
              onClick={() => togglePlanExpanded(plan.code)}
            >
              <div className="developerPlanCardHeading">
                <span className={`developerPlanBadge developerPlanBadge-${plan.code}`}>
                  {BADGE_LABEL[plan.code]}
                </span>
                <h3 className="developerPlanCardTitle">Plano {plan.code.toUpperCase()}</h3>
              </div>
              <svg
                className={`developerPlanCardChevron ${planExpanded ? "isOpen" : ""}`}
                viewBox="0 0 12 12"
                width={18}
                height={18}
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
            </button>
            {planExpanded ? (
              <div
                className="developerPlanCardBody"
                id={planBodyId}
                role="region"
                aria-labelledby={planHeadId}
              >
            <div className="developerPlanCardForm">
              <div className="developerPlanCardFormTop">
                <label className="developerPlanField">
                  <span>Nome exibido</span>
                  <Input
                    value={plan.name}
                    onChange={(e) => updatePlan(plan.code, { name: e.target.value })}
                    placeholder="Ex.: Profissional"
                    autoComplete="off"
                  />
                </label>
                <label className="developerPlanField">
                  <span>Preço mensal (R$)</span>
                  <Input
                    value={plan.priceInput}
                    onChange={(e) => updatePlan(plan.code, { priceInput: e.target.value })}
                    inputMode="decimal"
                    placeholder="0,00"
                    autoComplete="off"
                  />
                </label>
              </div>
              <div className="developerPlanLimitsRow">
                <label className="developerPlanField developerPlanFieldCompact">
                  <span>Limite mensal de agendamentos</span>
                  <Input
                    value={plan.appointmentLimit}
                    onChange={(e) => updatePlan(plan.code, { appointmentLimit: e.target.value })}
                    placeholder="Ilimitado se vazio"
                    inputMode="numeric"
                  />
                </label>
                <label className="developerPlanField developerPlanFieldCompact">
                  <span>Limite de profissionais</span>
                  <Input
                    value={plan.professionalLimit}
                    onChange={(e) => updatePlan(plan.code, { professionalLimit: e.target.value })}
                    placeholder="Ilimitado se vazio"
                    inputMode="numeric"
                  />
                </label>
              </div>
            </div>
            <div className="developerPlanFeaturePanel">
              <div className="developerPlanFeaturePanelHead">
                <div className="developerPlanFeaturePanelIntro">
                  <p className="developerPlanFeaturePanelTitle">Funcionalidades do administrador</p>
                  <p className="developerPlanFeaturePanelSubtitle">
                    Somente <strong>uma</strong> categoria fica aberta por vez; ao abrir outra, a que
                    estava visível fecha automaticamente.
                  </p>
                </div>
                <div className="developerPlanFeatureBulkActions">
                  <button
                    type="button"
                    className="developerPlanBulkLink"
                    onClick={() => collapseAllGroupsForPlan(plan.code)}
                  >
                    Recolher categorias
                  </button>
                </div>
              </div>
              <div className="developerPlanFeatureScroll">
                {ADMIN_PLAN_FEATURE_GROUPS.map((group) => {
                  const selected = group.items.filter((i) => plan.features[i.id]).length;
                  const total = group.items.length;
                  const panelId = `plan-${plan.code}-cat-${group.id}`;
                  const categoryOpen = openGroups[groupStateKey(plan.code, group.id)] ?? false;

                  return (
                    <section key={group.id} className="developerPlanCategory">
                      <button
                        type="button"
                        className="developerPlanCategoryTrigger"
                        aria-expanded={categoryOpen}
                        aria-controls={panelId}
                        id={`${panelId}-label`}
                        onClick={() => toggleGroup(plan.code, group.id)}
                      >
                        <span className="developerPlanCategoryTriggerStart">
                          <svg
                            className={`developerPlanCategoryChevron ${categoryOpen ? "isOpen" : ""}`}
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
                            <span className="developerPlanCategoryTitle">{group.title}</span>
                            <span className="developerPlanCategoryHint">
                              {categoryOpen ? "Clique para recolher" : "Clique para ver os itens"}
                            </span>
                          </span>
                        </span>
                        <span
                          className={`developerPlanCategoryPill ${selected > 0 ? "hasSelection" : ""}`}
                        >
                          {selected}/{total}
                        </span>
                      </button>
                      <div
                        id={panelId}
                        role="region"
                        aria-labelledby={`${panelId}-label`}
                        className={`developerPlanCategoryBody ${categoryOpen ? "isOpen" : ""}`}
                      >
                        <div className="developerPlanCategoryBodyInner">
                          <ul className="developerPlanFeatureList">
                            {group.items.map((item) => (
                              <li key={item.id}>
                                <label className="developerPlanFeatureRow">
                                  <input
                                    type="checkbox"
                                    className="uiCheckbox"
                                    checked={plan.features[item.id]}
                                    onChange={(e) =>
                                      toggleFeature(plan.code, item.id, e.target.checked)
                                    }
                                  />
                                  <span className="developerPlanFeatureTexts">
                                    <span className="developerPlanFeatureLabel">{item.label}</span>
                                    <span className="developerPlanFeatureDesc">{item.description}</span>
                                  </span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
              </div>
            ) : null}
          </article>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { ADMIN_PLAN_FEATURE_GROUPS, type AdminPlanFeatureId } from "@/lib/adminPlanFeatures";

type Props = {
  features: Record<AdminPlanFeatureId, boolean>;
  commercialName: string;
};

export function OwnerPlanFeaturesList({ features, commercialName }: Props) {
  const enabledCount = Object.values(features).filter(Boolean).length;
  const totalCount = Object.keys(features).length;

  return (
    <div className="ownerPlanFeaturesList">
      <p className="helperText">
        Plano <strong>{commercialName}</strong> · {enabledCount}/{totalCount} funcionalidades
        incluídas.
      </p>
      <div className="ownerPlanFeaturesGroups">
        {ADMIN_PLAN_FEATURE_GROUPS.map((group) => {
          const items = group.items.map((item) => ({
            ...item,
            enabled: features[item.id] === true
          }));
          const active = items.filter((i) => i.enabled).length;
          return (
            <section key={group.id} className="ownerPlanFeaturesGroup">
              <h3 className="ownerPlanFeaturesGroupTitle">
                {group.title}{" "}
                <span className="ownerPlanFeaturesGroupCount">
                  {active}/{items.length}
                </span>
              </h3>
              <ul className="ownerPlanFeaturesItems">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className={
                      item.enabled
                        ? "ownerPlanFeaturesItem ownerPlanFeaturesItem--on"
                        : "ownerPlanFeaturesItem ownerPlanFeaturesItem--off"
                    }
                  >
                    <span className="ownerPlanFeaturesStatus" aria-hidden>
                      {item.enabled ? "✓" : "—"}
                    </span>
                    <span className="ownerPlanFeaturesTexts">
                      <span className="ownerPlanFeaturesLabel">{item.label}</span>
                      <span className="ownerPlanFeaturesDesc">{item.description}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

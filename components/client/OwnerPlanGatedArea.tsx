import type { ReactNode } from "react";
import type { AdminPlanFeatureId } from "@/lib/adminPlanFeatures";
import { PlanFeatureNotice } from "@/components/client/PlanFeatureNotice";

type Props = {
  loading: boolean;
  locked: boolean;
  featureId: AdminPlanFeatureId;
  planCommercialName: string;
  onGoToSubscription: () => void;
  children: ReactNode;
};

export function OwnerPlanGatedArea({
  loading,
  locked,
  featureId,
  planCommercialName,
  onGoToSubscription,
  children
}: Props) {
  if (loading) {
    return <p className="helperText">Carregando permissões do plano…</p>;
  }
  if (locked) {
    return (
      <PlanFeatureNotice
        featureId={featureId}
        planCommercialName={planCommercialName}
        onGoToSubscription={onGoToSubscription}
      />
    );
  }
  return <>{children}</>;
}

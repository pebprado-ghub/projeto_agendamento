import { Button } from "@/components/ui/button";
import { featureLabel } from "@/lib/subscriptionTiers";
import type { AdminPlanFeatureId } from "@/lib/adminPlanFeatures";

type Props = {
  featureId: AdminPlanFeatureId;
  planCommercialName?: string;
  onGoToSubscription?: () => void;
};

export function PlanFeatureNotice({ featureId, planCommercialName, onGoToSubscription }: Props) {
  const label = featureLabel(featureId);
  return (
    <div className="planFeatureNotice" role="status">
      <p className="planFeatureNoticeTitle">Recurso não incluído no seu plano</p>
      <p className="helperText">
        <strong>{label}</strong> faz parte de um plano superior
        {planCommercialName ? ` (você está no plano ${planCommercialName})` : ""}. Faça upgrade da
        assinatura para liberar esta área.
      </p>
      {onGoToSubscription ? (
        <div className="actionsRow">
          <Button type="button" variant="primary" size="sm" onClick={onGoToSubscription}>
            Ver assinatura e upgrade
          </Button>
        </div>
      ) : null}
    </div>
  );
}

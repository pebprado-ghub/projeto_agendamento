import { Button } from "@/components/ui/button";

export type DeveloperMetricSeverity = "critical" | "warning" | "ok";

export type DeveloperMetricBreakdownRow = {
  id: string;
  name: string;
  slug: string;
  value: number | string;
  /** Quando definido, ativa estilo NOC (cor na linha + coluna de prioridade). */
  severity?: DeveloperMetricSeverity;
};

type DeveloperMetricTableProps = {
  rows: DeveloperMetricBreakdownRow[];
  valueHeader: string;
  emptyText: string;
  /** Quando definido, exibe coluna com atalho (ex.: abrir modal de contato). */
  onContactRow?: (row: DeveloperMetricBreakdownRow) => void;
  contactActionLabel?: string;
};

const SEVERITY_LABEL: Record<DeveloperMetricSeverity, string> = {
  critical: "Crítico",
  warning: "Atenção",
  ok: "Ok"
};

export function DeveloperMetricTable({
  rows,
  valueHeader,
  emptyText,
  onContactRow,
  contactActionLabel = "Contatar"
}: DeveloperMetricTableProps) {
  if (rows.length === 0) {
    return <p className="helperText developerMetricTableEmpty">{emptyText}</p>;
  }

  const showNoc = rows.some((row) => row.severity != null);
  const showContact = typeof onContactRow === "function";

  return (
    <div className="developerMetricTableWrap">
      <table className={`statCardExpandableTable${showNoc ? " statCardExpandableTable--noc" : ""}`}>
        <thead>
          <tr>
            {showNoc ? (
              <th scope="col" className="nocSeverityTh">
                Prioridade
              </th>
            ) : null}
            <th scope="col">Empresa</th>
            <th scope="col">Slug</th>
            <th scope="col" className="statCardExpandableThNum">
              {valueHeader}
            </th>
            {showContact ? (
              <th scope="col" className="statCardExpandableThContact">
                Contato
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={row.severity ? `nocRow nocRow--${row.severity}` : undefined}
            >
              {showNoc ? (
                <td className="nocSeverityCell">
                  {row.severity ? (
                    <span className={`nocPill nocPill--${row.severity}`}>
                      <span className="nocPillDot" aria-hidden />
                      {SEVERITY_LABEL[row.severity]}
                    </span>
                  ) : (
                    <span className="helperText">—</span>
                  )}
                </td>
              ) : null}
              <td>{row.name}</td>
              <td>
                <code className="statCardExpandableSlug">{row.slug}</code>
              </td>
              <td className="statCardExpandableTdNum">{row.value}</td>
              {showContact ? (
                <td className="statCardExpandableTdContact">
                  <Button type="button" size="sm" variant="outline" onClick={() => onContactRow(row)}>
                    {contactActionLabel}
                  </Button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef, type GridApi } from "ag-grid-community";
import { GitCompare, Plus } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import { AG_GRID_LOCALE_PT_BR } from "@/lib/ag-grid-locale-pt-br";
import { repairUtf8MisinterpretedAsLatin1 } from "@/lib/repairMojibake";
import {
  ADMIN_PLAN_FEATURE_GROUPS,
  emptyFeatureMap,
  type AdminPlanFeatureId,
} from "@/lib/adminPlanFeatures";
import { AgGridToolbar } from "@/components/admin/AgGridToolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

ModuleRegistry.registerModules([AllCommunityModule]);

export type DeveloperPlanGridRow = {
  code: string;
  name: string;
  monthly_price_cents: number;
  monthly_appointment_limit: number | null;
  professional_limit: number | null;
  allows_automations: boolean;
  allows_multi_unit: boolean;
  is_active: boolean;
  feature_flags?: Record<string, boolean> | null;
};

type Props = {
  rowData: DeveloperPlanGridRow[];
  onCreated?: () => Promise<void> | void;
};

const OPTIONAL_COLS = [
  "monthly_appointment_limit",
  "professional_limit",
  "allows_automations",
  "allows_multi_unit",
  "is_active",
  "feature_count",
] as const;
type OptionalCol = (typeof OPTIONAL_COLS)[number];

const COL_LABELS: Record<OptionalCol, string> = {
  monthly_appointment_limit: "Limite agendamentos",
  professional_limit: "Limite profissionais",
  allows_automations: "Automações",
  allows_multi_unit: "Multi-unidade",
  is_active: "Ativo",
  feature_count: "Funcionalidades",
};

function centsToBrl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function parseMoneyToCents(input: string) {
  const n = Number(input.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function countFeatures(map: Record<string, boolean> | null | undefined) {
  if (!map) return 0;
  return Object.values(map).filter(Boolean).length;
}

function normalizeFeatureMap(plan: DeveloperPlanGridRow) {
  const base = emptyFeatureMap();
  if (plan.feature_flags) {
    for (const key of Object.keys(base) as AdminPlanFeatureId[]) {
      if (plan.feature_flags[key] === true) base[key] = true;
    }
  }
  if (plan.allows_automations) base.automations_n8n = true;
  if (plan.allows_multi_unit) base.multi_unit = true;
  return base;
}

function complexityByFeatureCount(count: number) {
  if (count <= 6) return { level: "Básico", priceHint: "R$ 0 a R$ 49/mês" };
  if (count <= 12) return { level: "Intermediário", priceHint: "R$ 49 a R$ 119/mês" };
  if (count <= 17) return { level: "Avançado", priceHint: "R$ 119 a R$ 249/mês" };
  return { level: "Enterprise", priceHint: "R$ 249+/mês" };
}

export function DeveloperPlansAgGrid({ rowData, onCreated }: Props) {
  const gridApiRef = useRef<GridApi | null>(null);
  const [quickFilter, setQuickFilter] = useState("");
  const [visibleCols, setVisibleCols] = useState<Record<OptionalCol, boolean>>({
    monthly_appointment_limit: true,
    professional_limit: true,
    allows_automations: true,
    allows_multi_unit: true,
    is_active: true,
    feature_count: true,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [price, setPrice] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [professionalLimit, setProfessionalLimit] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [features, setFeatures] = useState<Record<AdminPlanFeatureId, boolean>>(emptyFeatureMap);
  const [openFeatureGroups, setOpenFeatureGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ADMIN_PLAN_FEATURE_GROUPS.map((g) => [g.id, true]))
  );
  const [selectedPlanCodes, setSelectedPlanCodes] = useState<string[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  const defaultColDef = useMemo<ColDef<DeveloperPlanGridRow>>(
    () => ({ sortable: true, filter: false, resizable: true, suppressHeaderMenuButton: true }),
    []
  );

  const columnDefs = useMemo<ColDef<DeveloperPlanGridRow>[]>(
    () => [
      { field: "name", headerName: "Plano", minWidth: 180, flex: 1.2 },
      { field: "code", headerName: "Código", width: 140 },
      {
        field: "monthly_price_cents",
        headerName: "Preço",
        width: 130,
        valueFormatter: (p) => centsToBrl(Number(p.value || 0)),
      },
      {
        field: "monthly_appointment_limit",
        headerName: "Limite agend.",
        hide: !visibleCols.monthly_appointment_limit,
        width: 130,
        valueFormatter: (p) => (p.value == null ? "Ilimitado" : String(p.value)),
      },
      {
        field: "professional_limit",
        headerName: "Limite prof.",
        hide: !visibleCols.professional_limit,
        width: 130,
        valueFormatter: (p) => (p.value == null ? "Ilimitado" : String(p.value)),
      },
      {
        field: "allows_automations",
        headerName: "Automações",
        hide: !visibleCols.allows_automations,
        width: 115,
        valueFormatter: (p) => (p.value ? "Sim" : "Não"),
      },
      {
        field: "allows_multi_unit",
        headerName: "Multi-unidade",
        hide: !visibleCols.allows_multi_unit,
        width: 120,
        valueFormatter: (p) => (p.value ? "Sim" : "Não"),
      },
      {
        field: "is_active",
        headerName: "Ativo",
        hide: !visibleCols.is_active,
        width: 90,
        valueFormatter: (p) => (p.value ? "Sim" : "Não"),
      },
      {
        colId: "feature_count",
        headerName: "Funcionalidades",
        hide: !visibleCols.feature_count,
        width: 130,
        valueGetter: (p) => countFeatures(normalizeFeatureMap(p.data as DeveloperPlanGridRow)),
      },
    ],
    [visibleCols]
  );

  const exportColumns = useMemo(() => {
    const base = [
      { key: "name", label: "Plano" },
      { key: "code", label: "Código" },
      { key: "monthly_price_cents", label: "Preço" },
    ] as Array<{ key: string; label: string }>;
    for (const c of OPTIONAL_COLS) {
      if (visibleCols[c]) base.push({ key: c, label: COL_LABELS[c] });
    }
    return base;
  }, [visibleCols]);

  const exportRows = useMemo(
    () =>
      rowData.map((row) =>
        exportColumns.map((c) => {
          if (c.key === "monthly_price_cents") return centsToBrl(row.monthly_price_cents);
          if (c.key === "monthly_appointment_limit")
            return row.monthly_appointment_limit == null ? "Ilimitado" : String(row.monthly_appointment_limit);
          if (c.key === "professional_limit")
            return row.professional_limit == null ? "Ilimitado" : String(row.professional_limit);
          if (c.key === "feature_count") return String(countFeatures(row.feature_flags));
          const val = (row as Record<string, unknown>)[c.key];
          if (typeof val === "boolean") return val ? "Sim" : "Não";
          if (val == null || val === "") return "—";
          if (c.key === "name") return repairUtf8MisinterpretedAsLatin1(String(val));
          return String(val);
        })
      ),
    [exportColumns, rowData]
  );

  const downloadBlob = useCallback((content: string, mime: string, filename: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportCsv = useCallback(() => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = exportColumns.map((c) => esc(c.label)).join(";");
    const lines = exportRows.map((r) => r.map((v) => esc(v)).join(";"));
    downloadBlob([header, ...lines].join("\n"), "text/csv;charset=utf-8", "planos-export.csv");
  }, [downloadBlob, exportColumns, exportRows]);

  const buildHtml = useCallback(() => {
    const header = exportColumns.map((c) => `<th>${c.label}</th>`).join("");
    const body = exportRows
      .map((r) => `<tr>${r.map((v) => `<td>${v.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>`).join("")}</tr>`)
      .join("");
    return `<!doctype html><html><head><meta charset="utf-8" /><title>Planos</title><style>body{font-family:Arial,sans-serif;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#e2e8f0}</style></head><body><h2>Planos</h2><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  }, [exportColumns, exportRows]);

  const handleExportHtml = useCallback(() => {
    downloadBlob(buildHtml(), "text/html;charset=utf-8", "planos-export.html");
  }, [buildHtml, downloadBlob]);

  const handlePrint = useCallback(() => {
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    w.document.open();
    w.document.write(buildHtml());
    w.document.close();
    w.onload = () => w.print();
  }, [buildHtml]);

  const handleExportPdf = useCallback(() => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    autoTable(doc, {
      head: [exportColumns.map((c) => c.label)],
      body: exportRows,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [226, 232, 240], textColor: [30, 41, 59] },
      margin: { top: 24, left: 24, right: 24, bottom: 24 },
    });
    doc.save("planos-export.pdf");
  }, [exportColumns, exportRows]);

  const resetForm = useCallback(() => {
    setName("");
    setCode("");
    setPrice("");
    setMonthlyLimit("");
    setProfessionalLimit("");
    setIsActive(true);
    setFeatures(emptyFeatureMap());
    setOpenFeatureGroups(Object.fromEntries(ADMIN_PLAN_FEATURE_GROUPS.map((g) => [g.id, true])));
    setFeedback("");
  }, []);

  const selectedFeatureCount = useMemo(() => countFeatures(features), [features]);
  const complexity = useMemo(
    () => complexityByFeatureCount(selectedFeatureCount),
    [selectedFeatureCount]
  );

  const submit = useCallback(async () => {
    if (!name.trim()) {
      setFeedback("Informe o nome do plano.");
      return;
    }
    setSaving(true);
    setFeedback("");
    const res = await fetch("/api/monetization/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.trim() || undefined,
        name: name.trim(),
        monthly_price_cents: parseMoneyToCents(price || "0"),
        monthly_appointment_limit: monthlyLimit.trim() ? Number(monthlyLimit) : null,
        professional_limit: professionalLimit.trim() ? Number(professionalLimit) : null,
        allows_automations: features.automations_n8n === true,
        allows_multi_unit: features.multi_unit === true,
        is_active: isActive,
        feature_flags: features,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setFeedback(data?.error || "Falha ao criar plano.");
      return;
    }
    setModalOpen(false);
    resetForm();
    await onCreated?.();
  }, [code, features, isActive, monthlyLimit, name, onCreated, price, professionalLimit, resetForm]);

  const comparedPlans = useMemo(
    () => rowData.filter((p) => selectedPlanCodes.includes(p.code)),
    [rowData, selectedPlanCodes]
  );

  return (
    <div className="empresasGridContainer">
      <AgGridToolbar<OptionalCol>
        searchInputId="planos-quick-filter"
        searchLabel="Buscar planos"
        searchPlaceholder="Nome, código, limites..."
        searchValue={quickFilter}
        onSearchChange={(value) => {
          setQuickFilter(value);
          gridApiRef.current?.setGridOption("quickFilterText", value);
        }}
        countLabel={rowData.length === 1 ? "1 plano" : `${rowData.length} planos`}
        columns={OPTIONAL_COLS.map((key) => ({ key, label: COL_LABELS[key] }))}
        visibleColumns={visibleCols}
        onToggleColumn={(key, checked) => setVisibleCols((p) => ({ ...p, [key]: checked }))}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        onExportHtml={handleExportHtml}
        onPrint={handlePrint}
        extraActions={[
          {
            key: "compare",
            label: "Comparar planos",
            icon: <GitCompare size={13} aria-hidden />,
            disabled: selectedPlanCodes.length < 2,
            onClick: () => setCompareModalOpen(true),
          },
        ]}
        primaryActionLabel="Adicionar plano"
        primaryActionIcon={<Plus size={13} aria-hidden />}
        onPrimaryAction={() => setModalOpen(true)}
      />

      <div className="ag-theme-quartz developerBusinessesAgGridWrap">
        <AgGridReact<DeveloperPlanGridRow>
          theme="legacy"
          localeText={AG_GRID_LOCALE_PT_BR}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          quickFilterText={quickFilter}
          rowHeight={48}
          headerHeight={44}
          getRowId={(p) => p.data.code}
          rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true }}
          suppressCellFocus
          enableCellTextSelection
          onSelectionChanged={(e) => {
            const selected = e.api.getSelectedRows().map((r) => r.code);
            setSelectedPlanCodes(selected);
          }}
          onGridReady={(e) => {
            gridApiRef.current = e.api;
            requestAnimationFrame(() => e.api.sizeColumnsToFit());
          }}
        />
      </div>

      {modalOpen ? (
        <div className="detailsModalBackdrop developerNewBusinessModalBackdrop" onClick={() => !saving && setModalOpen(false)}>
          <article
            className="detailsModalCard developerNewBusinessModalCard structuredFormModal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="structuredFormModalHeader">
              <h2 className="integrationName">Novo plano</h2>
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)} disabled={saving}>
                Fechar
              </Button>
            </div>
            <div className="structuredFormScroll form businessFormGrid">
              <label>
                Nome
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Premium Plus" />
              </label>
              <label>
                Código
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="premium-plus" />
              </label>
              <label>
                Preço mensal (R$)
                <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="99,90" />
              </label>
              <label>
                Limite mensal de agendamentos
                <Input value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} placeholder="vazio = ilimitado" />
              </label>
              <label>
                Limite de profissionais
                <Input
                  value={professionalLimit}
                  onChange={(e) => setProfessionalLimit(e.target.value)}
                  placeholder="vazio = ilimitado"
                />
              </label>
              <label className="uiCheckboxLabel">
                <input
                  className="uiCheckbox"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>Plano ativo</span>
              </label>

              <div className="full">
                <p className="helperText" style={{ marginBottom: 8 }}>
                  Funcionalidades disponíveis para administradores das empresas:
                </p>
                <div className="developerPlanFeatureBulkActions">
                  <button
                    type="button"
                    className="developerPlanBulkLink"
                    onClick={() =>
                      setOpenFeatureGroups(
                        Object.fromEntries(ADMIN_PLAN_FEATURE_GROUPS.map((g) => [g.id, true]))
                      )
                    }
                  >
                    Expandir tudo
                  </button>
                  <button
                    type="button"
                    className="developerPlanBulkLink"
                    onClick={() =>
                      setOpenFeatureGroups(
                        Object.fromEntries(ADMIN_PLAN_FEATURE_GROUPS.map((g) => [g.id, false]))
                      )
                    }
                  >
                    Recolher tudo
                  </button>
                </div>
                <div className="developerPlanFeatureScroll">
                  {ADMIN_PLAN_FEATURE_GROUPS.map((group) => (
                    <section key={group.id} className="developerPlanCategory">
                      <button
                        type="button"
                        className="developerPlanCategoryTrigger"
                        onClick={() =>
                          setOpenFeatureGroups((prev) => ({
                            ...prev,
                            [group.id]: !prev[group.id],
                          }))
                        }
                      >
                        <span className="developerPlanCategoryTriggerStart">
                          <span className="developerPlanCategoryTitleWrap">
                            <span className="developerPlanCategoryTitle">{group.title}</span>
                            <span className="developerPlanCategoryHint">
                              {openFeatureGroups[group.id] ? "Clique para recolher" : "Clique para expandir"}
                            </span>
                          </span>
                        </span>
                        <span className="developerPlanCategoryPill">
                          {group.items.filter((i) => features[i.id]).length}/{group.items.length}
                        </span>
                      </button>
                      <div className={`developerPlanCategoryBody ${openFeatureGroups[group.id] ? "isOpen" : ""}`}>
                        <div className="developerPlanCategoryBodyInner">
                          <ul className="developerPlanFeatureList">
                            {group.items.map((item) => (
                              <li key={item.id}>
                                <label className="developerPlanFeatureRow">
                                  <input
                                    type="checkbox"
                                    className="uiCheckbox"
                                    checked={features[item.id]}
                                    onChange={(e) =>
                                      setFeatures((prev) => ({ ...prev, [item.id]: e.target.checked }))
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
                  ))}
                </div>
                <div className="developerPlanComplexityBox">
                  <p className="developerPlanComplexityTitle">
                    Complexidade do plano: <strong>{complexity.level}</strong>
                  </p>
                  <p className="developerPlanComplexityHint">
                    {selectedFeatureCount} funcionalidades selecionadas. Faixa sugerida para precificação:{" "}
                    {complexity.priceHint}.
                  </p>
                </div>
              </div>

              {feedback ? <p className="feedbackError">{feedback}</p> : null}
            </div>
            <div className="structuredFormFooter">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" onClick={submit} disabled={saving}>
                {saving ? "Salvando..." : "Salvar plano"}
              </Button>
            </div>
          </article>
        </div>
      ) : null}
      {compareModalOpen ? (
        <div
          className="detailsModalBackdrop developerNewBusinessModalBackdrop"
          onClick={() => setCompareModalOpen(false)}
        >
          <article
            className="detailsModalCard developerNewBusinessModalCard structuredFormModal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="structuredFormModalHeader">
              <h2 className="integrationName">Comparar planos</h2>
              <Button type="button" variant="outline" size="sm" onClick={() => setCompareModalOpen(false)}>
                Fechar
              </Button>
            </div>
            <div className="structuredFormScroll developerPlanFeatureScroll">
              <table className="developerOverviewTable">
                <thead>
                  <tr>
                    <th>Critério</th>
                    {comparedPlans.map((p) => (
                      <th key={p.code}>{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Preço mensal</td>
                    {comparedPlans.map((p) => (
                      <td key={`price-${p.code}`}>{centsToBrl(p.monthly_price_cents)}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>Limite de agendamentos</td>
                    {comparedPlans.map((p) => (
                      <td key={`app-limit-${p.code}`}>
                        {p.monthly_appointment_limit == null ? "Ilimitado" : p.monthly_appointment_limit}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>Limite de profissionais</td>
                    {comparedPlans.map((p) => (
                      <td key={`prof-limit-${p.code}`}>
                        {p.professional_limit == null ? "Ilimitado" : p.professional_limit}
                      </td>
                    ))}
                  </tr>
                  {ADMIN_PLAN_FEATURE_GROUPS.flatMap((g) => g.items).map((item) => (
                    <tr key={item.id}>
                      <td>{item.label}</td>
                      {comparedPlans.map((p) => (
                        <td key={`${item.id}-${p.code}`}>
                          {normalizeFeatureMap(p)[item.id] ? "Incluído" : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type RowClickedEvent
} from "ag-grid-community";
import type { CustomInnerHeaderProps } from "ag-grid-react";
import { Pencil, Plus } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import { AG_GRID_LOCALE_PT_BR } from "@/lib/ag-grid-locale-pt-br";
import { repairUtf8MisinterpretedAsLatin1 } from "@/lib/repairMojibake";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs } from "@/components/ui/tabs";
import { AgGridToolbar } from "@/components/admin/AgGridToolbar";

export const CUSTOMER_INACTIVE_DAY_PRESETS = [30, 60, 90] as const;
export type CustomerInactiveDaysPreset = (typeof CUSTOMER_INACTIVE_DAY_PRESETS)[number];

/** Filtros rápidos na faixa CRM (união: linha aparece se bater em qualquer filtro ativo). */
export type OwnerCustomersCrmQuickFilters = {
  inactive: boolean;
  birthdays: boolean;
  vip: boolean;
};

ModuleRegistry.registerModules([AllCommunityModule]);

function GridInnerHeader({ displayName, enableSorting }: CustomInnerHeaderProps) {
  return (
    <span className="empresasGridHeaderCell">
      <span className="empresasGridHeaderLabel">{displayName}</span>
    </span>
  );
}

export type OwnerCustomersAgGridRow = {
  id: string;
  full_name: string;
  phone_display: string;
  email: string | null;
  whatsapp_profile_name: string | null;
  is_vip: boolean;
  is_blocked: boolean;
  tags_display: string;
  source_label: string;
  created_display: string;
  document_id: string | null;
  city: string | null;
  marketing_opt_in: boolean;
};

type Props = {
  rowData: OwnerCustomersAgGridRow[];
  selectedCustomerId: string | null;
  onRowActivate: (row: OwnerCustomersAgGridRow) => void;
  onEditRow: (row: OwnerCustomersAgGridRow) => void;
  onAddCustomer: () => void;
  /** Inativos/aniversariantes dependem da API de insights; sem isso os checkboxes ficam desabilitados. */
  crmInsightsReady: boolean;
  crmQuickFilters: OwnerCustomersCrmQuickFilters;
  onCrmQuickFiltersChange: (next: OwnerCustomersCrmQuickFilters) => void;
  inactiveDaysPreset: CustomerInactiveDaysPreset;
  onInactiveDaysPresetChange: (preset: CustomerInactiveDaysPreset) => void;
  /** Prévias opcionais (ex.: primeiros aniversariantes/inativos), abaixo da faixa de números. */
  crmPreviewSlot?: ReactNode;
};

function cellText(value: unknown): string {
  if (value == null || value === "") return "—";
  return repairUtf8MisinterpretedAsLatin1(String(value));
}

const ALL_OPTIONAL_COLS = [
  "whatsapp_profile_name",
  "tags_display",
  "document_id",
  "city",
  "marketing_opt_in"
] as const;
type OptionalCol = (typeof ALL_OPTIONAL_COLS)[number];

const COL_LABELS: Record<OptionalCol, string> = {
  whatsapp_profile_name: "Nome no WhatsApp",
  tags_display: "Tags",
  document_id: "CPF/CNPJ",
  city: "Cidade",
  marketing_opt_in: "Marketing OK"
};

type ExportColumn = {
  key:
    | "full_name"
    | "phone"
    | "email"
    | "vip"
    | "blocked"
    | "source"
    | "created"
    | OptionalCol;
  header: string;
};

export function OwnerCustomersAgGrid({
  rowData,
  selectedCustomerId,
  onRowActivate,
  onEditRow,
  onAddCustomer,
  crmInsightsReady,
  crmQuickFilters,
  onCrmQuickFiltersChange,
  inactiveDaysPreset,
  onInactiveDaysPresetChange,
  crmPreviewSlot
}: Props) {
  const quickFiltersTitleId = useId();
  const gridApiRef = useRef<GridApi | null>(null);
  const onEditRowRef = useRef(onEditRow);
  onEditRowRef.current = onEditRow;

  const [quickFilter, setQuickFilter] = useState("");
  const [visibleCols, setVisibleCols] = useState<Record<OptionalCol, boolean>>({
    whatsapp_profile_name: false,
    tags_display: true,
    document_id: false,
    city: false,
    marketing_opt_in: false
  });

  const onGridReady = useCallback((e: GridReadyEvent) => {
    gridApiRef.current = e.api;
    requestAnimationFrame(() => e.api.sizeColumnsToFit());
  }, []);

  const defaultColDef = useMemo<ColDef<OwnerCustomersAgGridRow>>(
    () => ({
      sortable: true,
      filter: false,
      resizable: true,
      suppressHeaderMenuButton: true,
      minWidth: 72,
      headerComponentParams: {
        innerHeaderComponent: GridInnerHeader
      }
    }),
    []
  );

  const columnDefs = useMemo<ColDef<OwnerCustomersAgGridRow>[]>(
    () => [
      {
        field: "full_name",
        headerName: "Nome",
        flex: 1.2,
        minWidth: 160,
        valueFormatter: (p) => cellText(p.value),
        getQuickFilterText: (p) => {
          const d = p.data;
          if (!d) return "";
          return [
            d.full_name,
            d.phone_display,
            d.email,
            d.tags_display,
            d.whatsapp_profile_name
          ]
            .filter(Boolean)
            .map((x) => repairUtf8MisinterpretedAsLatin1(String(x)))
            .join(" ");
        },
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        field: "phone_display",
        headerName: "Telefone",
        width: 138,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        field: "email",
        headerName: "E-mail",
        flex: 1,
        minWidth: 160,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        colId: "is_vip",
        field: "is_vip",
        headerName: "VIP",
        width: 88,
        sortable: false,
        getQuickFilterText: () => "",
        cellStyle: { display: "flex", alignItems: "center" },
        cellRenderer: (p: { data?: OwnerCustomersAgGridRow }) => {
          const data = p.data;
          if (!data) return null;
          return (
            <Checkbox checked={data.is_vip} disabled label={data.is_vip ? "Sim" : "Não"} />
          );
        },
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        colId: "is_blocked",
        field: "is_blocked",
        headerName: "Bloqueado",
        width: 108,
        sortable: false,
        getQuickFilterText: () => "",
        cellStyle: { display: "flex", alignItems: "center" },
        cellRenderer: (p: { data?: OwnerCustomersAgGridRow }) => {
          const data = p.data;
          if (!data) return null;
          return (
            <Checkbox
              checked={data.is_blocked}
              disabled
              label={data.is_blocked ? "Sim" : "Não"}
            />
          );
        },
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        field: "source_label",
        headerName: "Origem",
        width: 118,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        field: "created_display",
        headerName: "Cadastro",
        width: 132,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        colId: "whatsapp_profile_name",
        field: "whatsapp_profile_name",
        headerName: COL_LABELS.whatsapp_profile_name,
        flex: 1,
        minWidth: 140,
        hide: !visibleCols.whatsapp_profile_name,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        colId: "tags_display",
        field: "tags_display",
        headerName: COL_LABELS.tags_display,
        flex: 1,
        minWidth: 120,
        hide: !visibleCols.tags_display,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        colId: "document_id",
        field: "document_id",
        headerName: COL_LABELS.document_id,
        width: 124,
        hide: !visibleCols.document_id,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        colId: "city",
        field: "city",
        headerName: COL_LABELS.city,
        width: 130,
        hide: !visibleCols.city,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        colId: "marketing_opt_in",
        field: "marketing_opt_in",
        headerName: COL_LABELS.marketing_opt_in,
        width: 118,
        hide: !visibleCols.marketing_opt_in,
        sortable: false,
        valueFormatter: (p) => ((p.value as boolean) ? "Sim" : "Não"),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        colId: "actions",
        headerName: "Ações",
        minWidth: 184,
        width: 188,
        flex: 0,
        pinned: "right",
        lockPosition: true,
        suppressMovable: true,
        sortable: false,
        suppressHeaderMenuButton: true,
        getQuickFilterText: () => "",
        cellStyle: { display: "flex", alignItems: "center" },
        cellRenderer: (p: { data?: OwnerCustomersAgGridRow }) => {
          const data = p.data;
          if (!data) return null;
          return (
            <div className="agGridEditActionsRow">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="developerBusinessesGridEditBtn gap-1 h-8 shrink-0 px-2.5 font-medium"
                onClick={() => onEditRowRef.current(data)}
              >
                <Pencil size={13} aria-hidden />
                Editar
              </Button>
            </div>
          );
        }
      }
    ],
    [visibleCols]
  );

  const total = rowData.length;
  const anyCrmQuickFilter =
    crmQuickFilters.inactive || crmQuickFilters.birthdays || crmQuickFilters.vip;
  const countLabel =
    total === 0
      ? anyCrmQuickFilter
        ? "Nenhum cliente neste filtro"
        : "Nenhum cliente"
      : total === 1
        ? "1 cliente"
        : `${total} clientes`;

  const exportColumns = useMemo<ExportColumn[]>(() => {
    const cols: ExportColumn[] = [
      { key: "full_name", header: "Nome" },
      { key: "phone", header: "Telefone" },
      { key: "email", header: "E-mail" },
      { key: "vip", header: "VIP" },
      { key: "blocked", header: "Bloqueado" },
      { key: "source", header: "Origem" },
      { key: "created", header: "Cadastro" }
    ];
    for (const key of ALL_OPTIONAL_COLS) {
      if (visibleCols[key]) cols.push({ key, header: COL_LABELS[key] });
    }
    return cols;
  }, [visibleCols]);

  const formatExportCell = useCallback(
    (row: OwnerCustomersAgGridRow, key: ExportColumn["key"]) => {
      switch (key) {
        case "full_name":
          return cellText(row.full_name);
        case "phone":
          return cellText(row.phone_display);
        case "email":
          return cellText(row.email);
        case "vip":
          return row.is_vip ? "Sim" : "Não";
        case "blocked":
          return row.is_blocked ? "Sim" : "Não";
        case "source":
          return cellText(row.source_label);
        case "created":
          return cellText(row.created_display);
        case "whatsapp_profile_name":
          return cellText(row.whatsapp_profile_name);
        case "tags_display":
          return cellText(row.tags_display);
        case "document_id":
          return cellText(row.document_id);
        case "city":
          return cellText(row.city);
        case "marketing_opt_in":
          return row.marketing_opt_in ? "Sim" : "Não";
        default:
          return "—";
      }
    },
    []
  );

  const getExportRows = useCallback(
    () =>
      rowData.map((row) =>
        exportColumns.map((col) => ({
          header: col.header,
          value: formatExportCell(row, col.key)
        }))
      ),
    [exportColumns, formatExportCell, rowData]
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
    const rows = getExportRows();
    const escapeCsv = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = exportColumns.map((c) => escapeCsv(c.header)).join(";");
    const lines = rows.map((row) => row.map((cell) => escapeCsv(cell.value)).join(";"));
    const csv = [header, ...lines].join("\n");
    downloadBlob(csv, "text/csv;charset=utf-8", "clientes-export.csv");
  }, [downloadBlob, exportColumns, getExportRows]);

  const handleExportHtml = useCallback(() => {
    const rows = getExportRows();
    const headerHtml = exportColumns.map((c) => `<th>${c.header}</th>`).join("");
    const bodyHtml = rows
      .map(
        (row) =>
          `<tr>${row
            .map((cell) => `<td>${cell.value.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>`)
            .join("")}</tr>`
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Clientes</title><style>body{font-family:Arial,sans-serif;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#e2e8f0}</style></head><body><h2>Clientes</h2><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></body></html>`;
    downloadBlob(html, "text/html;charset=utf-8", "clientes-export.html");
  }, [downloadBlob, exportColumns, getExportRows]);

  const buildExportHtml = useCallback(() => {
    const rows = getExportRows();
    const headerHtml = exportColumns.map((c) => `<th>${c.header}</th>`).join("");
    const bodyHtml = rows
      .map(
        (row) =>
          `<tr>${row
            .map((cell) => `<td>${cell.value.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>`)
            .join("")}</tr>`
      )
      .join("");
    return `<!doctype html><html><head><meta charset="utf-8" /><title>Clientes</title><style>body{font-family:Arial,sans-serif;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#e2e8f0}@media print{body{padding:0}}</style></head><body><h2>Clientes</h2><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></body></html>`;
  }, [exportColumns, getExportRows]);

  const handlePrint = useCallback(() => {
    const html = buildExportHtml();
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.onload = () => {
      w.print();
    };
  }, [buildExportHtml]);

  const handleExportPdf = useCallback(() => {
    const rows = getExportRows();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    autoTable(doc, {
      head: [exportColumns.map((c) => c.header)],
      body: rows.map((row) => row.map((cell) => cell.value)),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [226, 232, 240], textColor: [30, 41, 59] },
      margin: { top: 24, left: 24, right: 24, bottom: 24 }
    });
    doc.save("clientes-export.pdf");
  }, [exportColumns, getExportRows]);

  const onRowClicked = useCallback(
    (e: RowClickedEvent<OwnerCustomersAgGridRow>) => {
      const target = e.event?.target as HTMLElement | null;
      if (target?.closest("button") || target?.closest("input")) return;
      const data = e.data;
      if (data) onRowActivate(data);
    },
    [onRowActivate]
  );

  return (
    <div className="empresasGridContainer ownerCustomersAgGridContainer">
      <AgGridToolbar<OptionalCol>
        searchInputId="clientes-quick-filter"
        searchLabel="Filtrar na lista carregada"
        searchPlaceholder="Nome, telefone, e-mail, tags..."
        searchValue={quickFilter}
        onSearchChange={(value) => {
          setQuickFilter(value);
          gridApiRef.current?.setGridOption("quickFilterText", value);
        }}
        countLabel={countLabel}
        columns={ALL_OPTIONAL_COLS.map((key) => ({ key, label: COL_LABELS[key] }))}
        visibleColumns={visibleCols}
        onToggleColumn={(key, checked) => setVisibleCols((prev) => ({ ...prev, [key]: checked }))}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
        onExportHtml={handleExportHtml}
        onPrint={handlePrint}
        primaryActionLabel="Novo cliente"
        primaryActionIcon={<Plus size={13} aria-hidden />}
        onPrimaryAction={onAddCustomer}
        exportTitle="Exportar"
      />
      <div className="customersCrmStripWrap">
        <section
          className={
            anyCrmQuickFilter
              ? "customersCrmQuickFiltersCard customersCrmQuickFiltersCard--active"
              : "customersCrmQuickFiltersCard"
          }
          aria-labelledby={quickFiltersTitleId}
        >
          <div className="customersCrmQuickFiltersBar">
            <h4 className="customersCrmQuickFiltersTitle" id={quickFiltersTitleId}>
              Filtros Rápidos
            </h4>
            <div
              className="customersCrmQuickFiltersControls"
              role="group"
              aria-label="Opções de filtro da lista"
            >
              <div className="customersCrmQuickFilterInactiveGroup">
                <Checkbox
                  className="customersCrmQuickFilterCheck"
                  checked={crmQuickFilters.inactive}
                  disabled={!crmInsightsReady}
                  label="Inativos (sem visita)"
                  onChange={(e) =>
                    onCrmQuickFiltersChange({
                      ...crmQuickFilters,
                      inactive: e.target.checked
                    })
                  }
                />
                {crmQuickFilters.inactive ? (
                  <div className="customersCrmMetricsInactiveRow">
                    <Tabs
                      className="tabsRowOverflow customersCrmInactiveTabsTrack"
                      variant="segmented"
                      aria-label="Prazo em dias para considerar inativo"
                      value={String(inactiveDaysPreset)}
                      onChange={(v) => {
                        const n = Number(v);
                        if (n === 30 || n === 60 || n === 90) onInactiveDaysPresetChange(n);
                      }}
                      items={CUSTOMER_INACTIVE_DAY_PRESETS.map((d) => ({
                        value: String(d),
                        label: `${d} dias`
                      }))}
                    />
                  </div>
                ) : null}
              </div>
              <Checkbox
                className="customersCrmQuickFilterCheck"
                checked={crmQuickFilters.birthdays}
                disabled={!crmInsightsReady}
                label="Aniversariantes (mês)"
                onChange={(e) =>
                  onCrmQuickFiltersChange({
                    ...crmQuickFilters,
                    birthdays: e.target.checked
                  })
                }
              />
              <Checkbox
                className="customersCrmQuickFilterCheck"
                checked={crmQuickFilters.vip}
                label="VIP"
                onChange={(e) =>
                  onCrmQuickFiltersChange({
                    ...crmQuickFilters,
                    vip: e.target.checked
                  })
                }
              />
            </div>
          </div>
        </section>
        {crmPreviewSlot ? (
          <div className="customersCrmPreviewSlot">{crmPreviewSlot}</div>
        ) : null}
      </div>
      <div className="ag-theme-quartz developerBusinessesAgGridWrap ownerCustomersAgGridWrap">
        <AgGridReact<OwnerCustomersAgGridRow>
          theme="legacy"
          localeText={AG_GRID_LOCALE_PT_BR}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          quickFilterText={quickFilter}
          animateRows
          rowHeight={48}
          headerHeight={44}
          getRowId={(p) => p.data.id}
          suppressCellFocus
          enableCellTextSelection
          getRowStyle={(p) =>
            p.data?.id === selectedCustomerId
              ? { background: "var(--ag-selected-row-background-color, rgba(5, 150, 105, 0.12))" }
              : p.data?.is_blocked
                ? { background: "color-mix(in srgb, #f87171 8%, transparent)" }
                : undefined
          }
          onGridReady={onGridReady}
          onRowClicked={onRowClicked}
        />
      </div>
    </div>
  );
}

"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
} from "ag-grid-community";
import type { CustomInnerHeaderProps } from "ag-grid-react";
import { ArrowUpDown, Pencil, Plus } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import { AG_GRID_LOCALE_PT_BR } from "@/lib/ag-grid-locale-pt-br";
import { repairUtf8MisinterpretedAsLatin1 } from "@/lib/repairMojibake";
import { Button } from "@/components/ui/button";
import { AgGridToolbar } from "@/components/admin/AgGridToolbar";

ModuleRegistry.registerModules([AllCommunityModule]);

/* ─── Header customizado com ícone de ordenação ─── */
function GridInnerHeader({ displayName, enableSorting }: CustomInnerHeaderProps) {
  return (
    <span className="empresasGridHeaderCell">
      <span className="empresasGridHeaderLabel">{displayName}</span>
      {enableSorting ? (
        <ArrowUpDown className="empresasGridSortIcon" aria-hidden size={13} />
      ) : null}
    </span>
  );
}

export type DeveloperBusinessGridRow = {
  id: string;
  name: string;
  slug: string;
  timezone?: string | null;
  calendar_mode?: string | null;
  cnpj?: string | null;
  legal_name?: string | null;
  trade_name?: string | null;
  address_line?: string | null;
  neighborhood?: string | null;
  postal_code?: string | null;
  city?: string | null;
  state?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  whatsapp_number?: string | null;
  cnae_code?: string | null;
  subscription_plan_code?: string | null;
  subscription_status?: string | null;
  created_at?: string | null;
};

type Props = {
  rowData: DeveloperBusinessGridRow[];
  onEditRow?: (row: DeveloperBusinessGridRow) => void;
  onNewBusiness?: () => void;
};

function digitsOnly(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "");
}

function cellText(value: unknown): string {
  if (value == null || value === "") return "—";
  return repairUtf8MisinterpretedAsLatin1(String(value));
}

const SUBSCRIPTION_STATUS_PT: Record<string, string> = {
  active: "Ativa",
  trialing: "Em teste",
  past_due: "Pagamento atrasado",
  cancelled: "Cancelada"
};

function formatSubscriptionStatus(value: unknown): string {
  if (value == null || value === "") return "—";
  const raw = repairUtf8MisinterpretedAsLatin1(String(value));
  const key = raw.toLowerCase();
  return SUBSCRIPTION_STATUS_PT[key] ?? raw;
}

function formatCnpjCell(value: string | null | undefined) {
  const d = digitsOnly(value).slice(0, 14);
  if (!d) return "—";
  if (d.length !== 14) return value || d;
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

const ALL_OPTIONAL_COLS = [
  "legal_name",
  "trade_name",
  "cnpj",
  "timezone",
  "address_line",
  "neighborhood",
  "postal_code",
  "city",
  "state",
  "contact_name",
  "contact_phone",
  "contact_email",
  "whatsapp_number",
  "cnae_code",
  "calendar_mode",
  "subscription_plan_code",
  "subscription_status",
] as const;
type OptionalCol = (typeof ALL_OPTIONAL_COLS)[number];

const COL_LABELS: Record<OptionalCol, string> = {
  legal_name: "Razão social",
  trade_name: "Nome fantasia",
  cnpj: "CNPJ",
  timezone: "Fuso horário",
  address_line: "Endereço",
  neighborhood: "Bairro",
  postal_code: "CEP",
  city: "Cidade",
  state: "UF",
  contact_name: "Contato",
  contact_phone: "Telefone",
  contact_email: "E-mail",
  whatsapp_number: "WhatsApp",
  cnae_code: "CNAE",
  calendar_mode: "Agenda",
  subscription_plan_code: "Plano",
  subscription_status: "Assinatura",
};

type ExportColumn = {
  key: "name" | OptionalCol;
  header: string;
};

export function DeveloperBusinessesAgGrid({ rowData, onEditRow, onNewBusiness }: Props) {
  const gridApiRef = useRef<GridApi | null>(null);
  const onEditRowRef = useRef(onEditRow);
  onEditRowRef.current = onEditRow;

  const [quickFilter, setQuickFilter] = useState("");
  const [visibleCols, setVisibleCols] = useState<Record<OptionalCol, boolean>>({
    legal_name: false,
    trade_name: false,
    cnpj: true,
    timezone: false,
    address_line: false,
    neighborhood: false,
    postal_code: false,
    city: true,
    state: true,
    contact_name: false,
    contact_phone: false,
    contact_email: false,
    whatsapp_number: false,
    cnae_code: false,
    calendar_mode: true,
    subscription_plan_code: true,
    subscription_status: true,
  });

  const onGridReady = useCallback((e: GridReadyEvent) => {
    gridApiRef.current = e.api;
    requestAnimationFrame(() => e.api.sizeColumnsToFit());
  }, []);

  const defaultColDef = useMemo<ColDef<DeveloperBusinessGridRow>>(
    () => ({
      sortable: true,
      filter: false,
      resizable: true,
      suppressHeaderMenuButton: true,
      minWidth: 80,
      headerComponentParams: {
        innerHeaderComponent: GridInnerHeader,
      },
    }),
    []
  );

  const columnDefs = useMemo<ColDef<DeveloperBusinessGridRow>[]>(
    () => [
      {
        field: "name",
        headerName: "Nome",
        flex: 1.8,
        minWidth: 180,
        valueFormatter: (p) => cellText(p.value),
        getQuickFilterText: (p) => {
          const n = p.data?.name;
          if (n == null || n === "") return "";
          return repairUtf8MisinterpretedAsLatin1(String(n));
        },
        headerComponentParams: { innerHeaderComponent: GridInnerHeader },
      },
      {
        field: "legal_name",
        headerName: "Razão social",
        minWidth: 200,
        hide: !visibleCols.legal_name,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader },
      },
      {
        field: "trade_name",
        headerName: "Nome fantasia",
        minWidth: 180,
        hide: !visibleCols.trade_name,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader },
      },
      {
        field: "cnpj",
        headerName: "CNPJ",
        width: 160,
        hide: !visibleCols.cnpj,
        valueFormatter: (p) => formatCnpjCell(p.value as string | null),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader },
      },
      {
        field: "timezone",
        headerName: "Fuso",
        width: 130,
        hide: !visibleCols.timezone,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader },
      },
      {
        field: "address_line",
        headerName: "Endereço",
        minWidth: 220,
        hide: !visibleCols.address_line,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader },
      },
      {
        field: "neighborhood",
        headerName: "Bairro",
        minWidth: 140,
        hide: !visibleCols.neighborhood,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader },
      },
      {
        field: "postal_code",
        headerName: "CEP",
        width: 112,
        hide: !visibleCols.postal_code,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader },
      },
      {
        field: "city",
        headerName: "Cidade",
        flex: 1,
        minWidth: 120,
        hide: !visibleCols.city,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader },
      },
      {
        field: "state",
        headerName: "UF",
        width: 72,
        hide: !visibleCols.state,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader },
      },
      {
        field: "contact_name",
        headerName: "Contato",
        minWidth: 170,
        hide: !visibleCols.contact_name,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader },
      },
      {
        field: "contact_phone",
        headerName: "Telefone",
        width: 138,
        hide: !visibleCols.contact_phone,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader },
      },
      {
        field: "contact_email",
        headerName: "E-mail",
        minWidth: 220,
        hide: !visibleCols.contact_email,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader },
      },
      {
        field: "whatsapp_number",
        headerName: "WhatsApp",
        width: 140,
        hide: !visibleCols.whatsapp_number,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader },
      },
      {
        field: "cnae_code",
        headerName: "CNAE",
        width: 116,
        hide: !visibleCols.cnae_code,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader },
      },
      {
        field: "calendar_mode",
        headerName: "Agenda",
        width: 112,
        hide: !visibleCols.calendar_mode,
        valueFormatter: (p) =>
          p.value === "google"
            ? "Google"
            : p.value === "internal"
              ? "Interna"
              : "—",
        headerComponentParams: { innerHeaderComponent: GridInnerHeader },
      },
      {
        field: "subscription_plan_code",
        headerName: "Plano",
        width: 96,
        hide: !visibleCols.subscription_plan_code,
        valueFormatter: (p) =>
          p.value == null || p.value === ""
            ? "—"
            : repairUtf8MisinterpretedAsLatin1(String(p.value)).toUpperCase(),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader },
      },
      {
        field: "subscription_status",
        headerName: "Assinatura",
        width: 132,
        hide: !visibleCols.subscription_status,
        valueFormatter: (p) => formatSubscriptionStatus(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader },
      },
      {
        colId: "actions",
        headerName: "Ações",
        minWidth: 112,
        width: 116,
        pinned: "right",
        lockPosition: true,
        suppressMovable: true,
        sortable: false,
        suppressHeaderMenuButton: true,
        getQuickFilterText: () => "",
        cellStyle: { display: "flex", alignItems: "center" },
        cellRenderer: (p: { data?: DeveloperBusinessGridRow }) => {
          const data = p.data;
          if (!data) return null;
          return (
            <div className="agGridEditActionsRow">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="developerBusinessesGridEditBtn gap-1 h-8 shrink-0 px-2.5 font-medium"
                onClick={() => onEditRowRef.current?.(data)}
              >
                <Pencil size={13} aria-hidden />
                Editar
              </Button>
            </div>
          );
        },
      },
    ],
    [visibleCols]
  );

  const total = rowData.length;
  const countLabel =
    total === 0
      ? "Nenhuma empresa"
      : total === 1
        ? "1 empresa"
        : `${total} empresas`;

  const exportColumns = useMemo<ExportColumn[]>(() => {
    const cols: ExportColumn[] = [{ key: "name", header: "Nome" }];
    for (const key of ALL_OPTIONAL_COLS) {
      if (visibleCols[key]) cols.push({ key, header: COL_LABELS[key] });
    }
    return cols;
  }, [visibleCols]);

  const formatExportCell = useCallback(
    (row: DeveloperBusinessGridRow, key: ExportColumn["key"]) => {
      if (key === "name") return cellText(row.name);
      if (key === "cnpj") return formatCnpjCell(row.cnpj);
      if (key === "calendar_mode") {
        return row.calendar_mode === "google"
          ? "Google"
          : row.calendar_mode === "internal"
            ? "Interna"
            : "—";
      }
      if (key === "subscription_plan_code") {
        return row.subscription_plan_code == null || row.subscription_plan_code === ""
          ? "—"
          : repairUtf8MisinterpretedAsLatin1(String(row.subscription_plan_code)).toUpperCase();
      }
      if (key === "subscription_status") return formatSubscriptionStatus(row.subscription_status);
      const value = row[key];
      if (value == null || value === "") return "—";
      return typeof value === "string" ? cellText(value) : String(value);
    },
    []
  );

  const getExportRows = useCallback(
    () =>
      rowData.map((row) =>
        exportColumns.map((col) => ({
          header: col.header,
          value: formatExportCell(row, col.key),
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
    downloadBlob(csv, "text/csv;charset=utf-8", "empresas-export.csv");
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
    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Empresas</title><style>body{font-family:Arial,sans-serif;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#e2e8f0}</style></head><body><h2>Empresas</h2><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></body></html>`;
    downloadBlob(html, "text/html;charset=utf-8", "empresas-export.html");
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
    return `<!doctype html><html><head><meta charset="utf-8" /><title>Empresas</title><style>body{font-family:Arial,sans-serif;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#e2e8f0}@media print{body{padding:0}}</style></head><body><h2>Empresas</h2><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></body></html>`;
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
      margin: { top: 24, left: 24, right: 24, bottom: 24 },
    });
    doc.save("empresas-export.pdf");
  }, [exportColumns, getExportRows]);

  return (
    <div className="empresasGridContainer">
        <AgGridToolbar<OptionalCol>
          searchInputId="empresas-quick-filter"
          searchLabel="Buscar na lista"
          searchPlaceholder="Nome, CNPJ, cidade, plano..."
          searchValue={quickFilter}
          onSearchChange={(value) => {
            setQuickFilter(value);
            gridApiRef.current?.setGridOption("quickFilterText", value);
          }}
          countLabel={countLabel}
          columns={ALL_OPTIONAL_COLS.map((key) => ({ key, label: COL_LABELS[key] }))}
          visibleColumns={visibleCols}
          onToggleColumn={(key, checked) =>
            setVisibleCols((prev) => ({
              ...prev,
              [key]: checked,
            }))
          }
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
          onExportHtml={handleExportHtml}
          onPrint={handlePrint}
          primaryActionLabel="Adicionar empresa"
          primaryActionIcon={<Plus size={13} aria-hidden />}
          onPrimaryAction={onNewBusiness}
        />

        <div className="ag-theme-quartz developerBusinessesAgGridWrap">
          <AgGridReact<DeveloperBusinessGridRow>
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
            tooltipShowDelay={400}
            onGridReady={onGridReady}
          />
        </div>
    </div>
  );
}

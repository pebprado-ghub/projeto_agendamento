"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GridApi,
  type GridReadyEvent
} from "ag-grid-community";
import type { CustomInnerHeaderProps } from "ag-grid-react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  LayoutTemplate,
  Pencil,
  Plus
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import { AG_GRID_LOCALE_PT_BR } from "@/lib/ag-grid-locale-pt-br";
import { repairUtf8MisinterpretedAsLatin1 } from "@/lib/repairMojibake";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AgGridToolbar } from "@/components/admin/AgGridToolbar";

ModuleRegistry.registerModules([AllCommunityModule]);

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

/** Subconjunto do item retornado por GET /api/services — campos usados na grade. */
export type OwnerServicesAgGridRow = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  duration_minutes: number;
  price_cents: number | null;
  is_active: boolean;
  image_urls: string[];
  icon: string | null;
  color: string | null;
  display_order: number | null;
  booking_cancel_cutoff_minutes: number;
  booking_reschedule_cutoff_minutes: number;
};

type Props = {
  rowData: OwnerServicesAgGridRow[];
  onEditRow: (row: OwnerServicesAgGridRow) => void;
  onAddService: () => void;
  /** Template sugerido pelo CNAE / ramo da empresa (painel de sugestões acima da grade). */
  onViewServiceTemplate?: () => void;
  onToggleActive: (row: OwnerServicesAgGridRow) => void;
  onDuplicate: (row: OwnerServicesAgGridRow) => void;
  onMove: (row: OwnerServicesAgGridRow, direction: -1 | 1) => void;
};

function cellText(value: unknown): string {
  if (value == null || value === "") return "—";
  return repairUtf8MisinterpretedAsLatin1(String(value));
}

function formatPrice(cents: number | null): string {
  if (cents == null) return "Sob consulta";
  return `R$ ${(cents / 100).toFixed(2)}`;
}

const ALL_OPTIONAL_COLS = [
  "description",
  "display_order",
  "cancel_cutoff",
  "reschedule_cutoff",
  "image_count"
] as const;
type OptionalCol = (typeof ALL_OPTIONAL_COLS)[number];

const COL_LABELS: Record<OptionalCol, string> = {
  description: "Descrição",
  display_order: "Ordem",
  cancel_cutoff: "Limite cancelar (min)",
  reschedule_cutoff: "Limite reagendar (min)",
  image_count: "Fotos"
};

type ExportColumn = { key: "name" | "category" | "duration" | "price" | "active" | OptionalCol; header: string };

export function OwnerServicesAgGrid({
  rowData,
  onEditRow,
  onAddService,
  onViewServiceTemplate,
  onToggleActive,
  onDuplicate,
  onMove
}: Props) {
  const gridApiRef = useRef<GridApi | null>(null);
  const onEditRowRef = useRef(onEditRow);
  const onToggleActiveRef = useRef(onToggleActive);
  const onDuplicateRef = useRef(onDuplicate);
  const onMoveRef = useRef(onMove);
  onEditRowRef.current = onEditRow;
  onToggleActiveRef.current = onToggleActive;
  onDuplicateRef.current = onDuplicate;
  onMoveRef.current = onMove;

  const [quickFilter, setQuickFilter] = useState("");
  const [visibleCols, setVisibleCols] = useState<Record<OptionalCol, boolean>>({
    description: false,
    display_order: false,
    cancel_cutoff: true,
    reschedule_cutoff: true,
    image_count: true
  });

  const onGridReady = useCallback((e: GridReadyEvent) => {
    gridApiRef.current = e.api;
    requestAnimationFrame(() => e.api.sizeColumnsToFit());
  }, []);

  const defaultColDef = useMemo<ColDef<OwnerServicesAgGridRow>>(
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

  const columnDefs = useMemo<ColDef<OwnerServicesAgGridRow>[]>(
    () => [
      {
        field: "name",
        headerName: "Nome",
        flex: 1.4,
        minWidth: 160,
        valueFormatter: (p) => cellText(p.value),
        getQuickFilterText: (p) => {
          const parts = [
            p.data?.name,
            p.data?.category,
            p.data?.description
          ]
            .filter(Boolean)
            .map((x) => repairUtf8MisinterpretedAsLatin1(String(x)));
          return parts.join(" ");
        },
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        field: "category",
        headerName: "Categoria",
        width: 130,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        field: "duration_minutes",
        headerName: "Duração",
        width: 100,
        valueFormatter: (p) => `${p.value ?? 0} min`,
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        field: "price_cents",
        headerName: "Preço",
        width: 118,
        valueFormatter: (p) => formatPrice(p.value as number | null),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        colId: "is_active",
        field: "is_active",
        headerName: "Ativo",
        width: 108,
        sortable: false,
        getQuickFilterText: () => "",
        cellStyle: { display: "flex", alignItems: "center" },
        cellRenderer: (p: { data?: OwnerServicesAgGridRow }) => {
          const data = p.data;
          if (!data) return null;
          return (
            <Checkbox
              checked={data.is_active}
              onChange={() => onToggleActiveRef.current(data)}
              label={data.is_active ? "Sim" : "Não"}
            />
          );
        },
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        colId: "description",
        field: "description",
        headerName: "Descrição",
        flex: 1,
        minWidth: 180,
        hide: !visibleCols.description,
        valueFormatter: (p) => cellText(p.value),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        colId: "display_order",
        field: "display_order",
        headerName: "Ordem",
        width: 88,
        hide: !visibleCols.display_order,
        valueFormatter: (p) => (p.value == null ? "—" : String(p.value)),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        colId: "cancel_cutoff",
        field: "booking_cancel_cutoff_minutes",
        headerName: "Cancelar (min)",
        width: 120,
        hide: !visibleCols.cancel_cutoff,
        valueFormatter: (p) => String(p.value ?? 0),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        colId: "reschedule_cutoff",
        field: "booking_reschedule_cutoff_minutes",
        headerName: "Reagendar (min)",
        width: 130,
        hide: !visibleCols.reschedule_cutoff,
        valueFormatter: (p) => String(p.value ?? 0),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        colId: "image_count",
        headerName: "Fotos",
        width: 84,
        hide: !visibleCols.image_count,
        valueGetter: (p) => p.data?.image_urls?.length ?? 0,
        valueFormatter: (p) => String(p.value ?? 0),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        colId: "actions",
        headerName: "Ações",
        minWidth: 224,
        width: 228,
        flex: 0,
        pinned: "right",
        lockPosition: true,
        suppressMovable: true,
        sortable: false,
        suppressHeaderMenuButton: true,
        getQuickFilterText: () => "",
        cellStyle: { display: "flex", alignItems: "center" },
        cellRenderer: (p: { data?: OwnerServicesAgGridRow }) => {
          const data = p.data;
          if (!data) return null;
          const idx = rowData.findIndex((r) => r.id === data.id);
          const canUp = idx > 0;
          const canDown = idx >= 0 && idx < rowData.length - 1;
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 p-0"
                title="Duplicar"
                onClick={() => onDuplicateRef.current(data)}
              >
                <Copy size={15} aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 p-0"
                title="Subir"
                disabled={!canUp}
                onClick={() => onMoveRef.current(data, -1)}
              >
                <ArrowUp size={15} aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 p-0"
                title="Descer"
                disabled={!canDown}
                onClick={() => onMoveRef.current(data, 1)}
              >
                <ArrowDown size={15} aria-hidden />
              </Button>
            </div>
          );
        }
      }
    ],
    [visibleCols, rowData]
  );

  const total = rowData.length;
  const countLabel =
    total === 0 ? "Nenhum serviço" : total === 1 ? "1 serviço" : `${total} serviços`;

  const statsStrip = useMemo(() => {
    const active = rowData.filter((r) => r.is_active).length;
    const ticketCents =
      rowData.length > 0
        ? Math.round(
            rowData.reduce((sum, r) => sum + (r.price_cents ?? 0), 0) / rowData.length
          )
        : 0;
    const categoryCount = new Set(
      rowData.map((r) => (r.category || "").trim()).filter(Boolean)
    ).size;
    const withPhotos = rowData.filter((r) => (r.image_urls?.length ?? 0) > 0).length;
    return { active, ticketCents, categoryCount, withPhotos };
  }, [rowData]);

  const exportColumns = useMemo<ExportColumn[]>(() => {
    const cols: ExportColumn[] = [
      { key: "name", header: "Nome" },
      { key: "category", header: "Categoria" },
      { key: "duration", header: "Duração (min)" },
      { key: "price", header: "Preço" },
      { key: "active", header: "Ativo" }
    ];
    for (const key of ALL_OPTIONAL_COLS) {
      if (visibleCols[key]) cols.push({ key, header: COL_LABELS[key] });
    }
    return cols;
  }, [visibleCols]);

  const formatExportCell = useCallback((row: OwnerServicesAgGridRow, key: ExportColumn["key"]) => {
    switch (key) {
      case "name":
        return cellText(row.name);
      case "category":
        return cellText(row.category);
      case "duration":
        return String(row.duration_minutes);
      case "price":
        return formatPrice(row.price_cents);
      case "active":
        return row.is_active ? "Sim" : "Não";
      case "description":
        return cellText(row.description);
      case "display_order":
        return row.display_order == null ? "—" : String(row.display_order);
      case "cancel_cutoff":
        return String(row.booking_cancel_cutoff_minutes ?? 0);
      case "reschedule_cutoff":
        return String(row.booking_reschedule_cutoff_minutes ?? 0);
      case "image_count":
        return String(row.image_urls?.length ?? 0);
      default:
        return "—";
    }
  }, []);

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
    downloadBlob(csv, "text/csv;charset=utf-8", "servicos-export.csv");
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
    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>Serviços</title><style>body{font-family:Arial,sans-serif;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#e2e8f0}</style></head><body><h2>Catálogo de serviços</h2><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></body></html>`;
    downloadBlob(html, "text/html;charset=utf-8", "servicos-export.html");
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
    return `<!doctype html><html><head><meta charset="utf-8" /><title>Serviços</title><style>body{font-family:Arial,sans-serif;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#e2e8f0}@media print{body{padding:0}}</style></head><body><h2>Catálogo de serviços</h2><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></body></html>`;
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
    doc.save("servicos-export.pdf");
  }, [exportColumns, getExportRows]);

  return (
    <div className="empresasGridContainer ownerServicesAgGridContainer">
      <AgGridToolbar<OptionalCol>
        searchInputId="servicos-quick-filter"
        searchLabel="Buscar na lista"
        searchPlaceholder="Nome, categoria, descrição..."
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
        secondaryActionLabel={
          onViewServiceTemplate ? "Visualizar template de serviços" : undefined
        }
        secondaryActionIcon={
          onViewServiceTemplate ? <LayoutTemplate size={13} aria-hidden /> : undefined
        }
        onSecondaryAction={onViewServiceTemplate}
        primaryActionLabel="Adicionar serviço"
        primaryActionIcon={<Plus size={13} aria-hidden />}
        onPrimaryAction={onAddService}
        exportTitle="Exportar"
      />
      <div className="ownerServicesAgGridStats" role="status" aria-label="Resumo do catálogo">
        <div className="ownerServicesAgGridStat">
          <small>Total</small>
          <strong>{total}</strong>
        </div>
        <div className="ownerServicesAgGridStat">
          <small>Ativos</small>
          <strong>{statsStrip.active}</strong>
        </div>
        <div className="ownerServicesAgGridStat">
          <small>Ticket médio</small>
          <strong>
            {rowData.length === 0
              ? "—"
              : `R$ ${(statsStrip.ticketCents / 100).toFixed(2)}`}
          </strong>
        </div>
        <div className="ownerServicesAgGridStat">
          <small>Categorias</small>
          <strong>{statsStrip.categoryCount}</strong>
        </div>
        <div className="ownerServicesAgGridStat">
          <small>Com fotos</small>
          <strong>{statsStrip.withPhotos}</strong>
        </div>
      </div>
      <div className="ag-theme-quartz developerBusinessesAgGridWrap ownerServicesAgGridWrap">
        <AgGridReact<OwnerServicesAgGridRow>
          theme="legacy"
          localeText={AG_GRID_LOCALE_PT_BR}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          quickFilterText={quickFilter}
          animateRows
          rowHeight={52}
          headerHeight={44}
          getRowId={(p) => p.data.id}
          suppressCellFocus
          enableCellTextSelection
          getRowStyle={(p) =>
            p.data?.is_active ? undefined : { background: "var(--surface-soft, #f8fafc)" }
          }
          onGridReady={onGridReady}
        />
      </div>
    </div>
  );
}

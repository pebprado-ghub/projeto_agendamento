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
import { ArrowUpDown, CalendarX, Pencil, Plus } from "lucide-react";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import { AG_GRID_LOCALE_PT_BR } from "@/lib/ag-grid-locale-pt-br";
import { Button } from "@/components/ui/button";
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

export type HourScheduleGridRow = {
  id: string;
  validityType: string;
  validFrom: string;
  validTo: string | null;
  isVigenteHoje: boolean;
  createdAt: string;
  updatedAt: string;
};

const VALIDITY_LABELS: Record<string, string> = {
  indeterminate: "Indeterminada",
  monthly: "Mensal",
  annual: "Anual",
  custom: "Personalizado"
};

type Props = {
  rowData: HourScheduleGridRow[];
  onEditRow: (row: HourScheduleGridRow) => void;
  onAddSchedule: () => void;
  onAddClosure?: () => void;
};

type OptionalCol = "updatedAt";

const COL_META: Record<OptionalCol, string> = {
  updatedAt: "Atualizada em"
};

function formatDateTimePt(iso: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(d);
  } catch {
    return iso;
  }
}

export function DeveloperHourSchedulesAgGrid({
  rowData,
  onEditRow,
  onAddSchedule,
  onAddClosure
}: Props) {
  const gridApiRef = useRef<GridApi | null>(null);
  const onEditRowRef = useRef(onEditRow);
  onEditRowRef.current = onEditRow;

  const [quickFilter, setQuickFilter] = useState("");
  const [visibleCols, setVisibleCols] = useState<Record<OptionalCol, boolean>>({
    updatedAt: false
  });

  const onGridReady = useCallback((e: GridReadyEvent) => {
    gridApiRef.current = e.api;
    requestAnimationFrame(() => e.api.sizeColumnsToFit());
  }, []);

  const defaultColDef = useMemo<ColDef<HourScheduleGridRow>>(
    () => ({
      sortable: true,
      filter: false,
      resizable: true,
      suppressHeaderMenuButton: true,
      minWidth: 80,
      headerComponentParams: {
        innerHeaderComponent: GridInnerHeader
      }
    }),
    []
  );

  const columnDefs = useMemo<ColDef<HourScheduleGridRow>[]>(
    () => [
      {
        field: "validityType",
        headerName: "Tipo",
        width: 160,
        valueFormatter: (p) => VALIDITY_LABELS[p.value as string] ?? String(p.value ?? "—"),
        getQuickFilterText: (p) => {
          const t = p.data?.validityType;
          const base = t ? (VALIDITY_LABELS[t] ?? t) : "";
          return [base, p.data?.validFrom, p.data?.validTo ?? ""].filter(Boolean).join(" ");
        },
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        field: "validFrom",
        headerName: "Início",
        width: 118,
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        field: "validTo",
        headerName: "Fim",
        width: 118,
        valueFormatter: (p) => (p.value == null || p.value === "" ? "—" : String(p.value)),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        field: "isVigenteHoje",
        headerName: "Vigente hoje",
        width: 124,
        valueFormatter: (p) => (p.value ? "Sim" : "Não"),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        field: "createdAt",
        headerName: "Criada em",
        minWidth: 148,
        flex: 0.7,
        valueFormatter: (p) => formatDateTimePt(String(p.value ?? "")),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
      },
      {
        field: "updatedAt",
        headerName: "Atualizada em",
        minWidth: 140,
        hide: !visibleCols.updatedAt,
        valueFormatter: (p) => formatDateTimePt(String(p.value ?? "")),
        headerComponentParams: { innerHeaderComponent: GridInnerHeader }
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
        cellRenderer: (p: { data?: HourScheduleGridRow }) => {
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
  const countLabel =
    total === 0 ? "Nenhuma agenda" : total === 1 ? "1 agenda" : `${total} agendas`;

  const handleExportCsv = useCallback(() => {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const headers = ["Tipo", "Início", "Fim", "Vigente hoje", "Criada em"];
    if (visibleCols.updatedAt) headers.push("Atualizada em");
    const lines = rowData.map((row) => {
      const cells = [
        VALIDITY_LABELS[row.validityType] ?? row.validityType,
        row.validFrom,
        row.validTo ?? "—",
        row.isVigenteHoje ? "Sim" : "Não",
        formatDateTimePt(row.createdAt)
      ];
      if (visibleCols.updatedAt) cells.push(formatDateTimePt(row.updatedAt));
      return cells.map(escape).join(";");
    });
    const csv = [headers.map(escape).join(";"), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agendas-horario-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [rowData, visibleCols]);

  return (
    <div className="empresasGridContainer hourSchedulesAgGridContainer">
      <AgGridToolbar<OptionalCol>
        searchInputId="hour-schedules-quick-filter"
        searchLabel="Buscar na lista"
        searchPlaceholder="Tipo, datas..."
        searchValue={quickFilter}
        onSearchChange={(v) => {
          setQuickFilter(v);
          gridApiRef.current?.setGridOption("quickFilterText", v);
        }}
        countLabel={countLabel}
        columns={[{ key: "updatedAt", label: COL_META.updatedAt }]}
        visibleColumns={visibleCols}
        onToggleColumn={(key, checked) => setVisibleCols((p) => ({ ...p, [key]: checked }))}
        onExportCsv={handleExportCsv}
        primaryActionLabel="Adicionar agenda"
        primaryActionIcon={<Plus size={13} aria-hidden />}
        onPrimaryAction={onAddSchedule}
        secondaryActionLabel={onAddClosure ? "Adicionar bloqueio" : undefined}
        secondaryActionIcon={
          onAddClosure ? <CalendarX size={13} aria-hidden /> : undefined
        }
        onSecondaryAction={onAddClosure}
        exportTitle="Exportar"
      />
      <div className="ag-theme-quartz developerBusinessesAgGridWrap developerHourSchedulesAgGridWrap">
        <AgGridReact<HourScheduleGridRow>
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
            p.data?.isVigenteHoje
              ? { background: "var(--surface-highlight, #eff6ff)" }
              : undefined
          }
          onGridReady={onGridReady}
        />
      </div>
    </div>
  );
}

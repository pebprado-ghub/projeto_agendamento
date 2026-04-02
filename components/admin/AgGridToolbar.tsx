"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Download,
  FileCode2,
  FileSpreadsheet,
  FileType2,
  FilterX,
  Printer,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type ColumnOption<TColKey extends string> = {
  key: TColKey;
  label: string;
};

type Props<TColKey extends string> = {
  searchInputId: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  countLabel: string;
  columnsTitle?: string;
  clearLabel?: string;
  columns: Array<ColumnOption<TColKey>>;
  visibleColumns: Record<TColKey, boolean>;
  onToggleColumn: (key: TColKey, checked: boolean) => void;
  primaryActionLabel?: string;
  primaryActionIcon?: ReactNode;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionIcon?: ReactNode;
  onSecondaryAction?: () => void;
  exportTitle?: string;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  onExportHtml?: () => void;
  onPrint?: () => void;
  extraActions?: Array<{
    key: string;
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    disabled?: boolean;
  }>;
};

export function AgGridToolbar<TColKey extends string>({
  searchInputId,
  searchLabel,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  countLabel,
  columnsTitle = "Colunas",
  clearLabel = "Limpar busca",
  columns,
  visibleColumns,
  onToggleColumn,
  primaryActionLabel,
  primaryActionIcon,
  onPrimaryAction,
  secondaryActionLabel,
  secondaryActionIcon,
  onSecondaryAction,
  exportTitle = "Exportar",
  onExportCsv,
  onExportPdf,
  onExportHtml,
  onPrint,
  extraActions,
}: Props<TColKey>) {
  const columnsButtonRef = useRef<HTMLDivElement | null>(null);
  const columnsPanelRef = useRef<HTMLDivElement | null>(null);
  const exportButtonRef = useRef<HTMLDivElement | null>(null);
  const exportPanelRef = useRef<HTMLDivElement | null>(null);
  const [columnsPanelOpen, setColumnsPanelOpen] = useState(false);
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const [columnsPanelPosition, setColumnsPanelPosition] = useState({ top: 0, left: 0 });
  const [exportPanelPosition, setExportPanelPosition] = useState({ top: 0, left: 0 });

  const hasExport = Boolean(onExportCsv || onExportPdf || onExportHtml || onPrint);

  const updateColumnsPanelPosition = useCallback(() => {
    const anchor = columnsButtonRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setColumnsPanelPosition({
      top: rect.bottom + 6,
      left: Math.max(12, rect.right - 180),
    });
  }, []);

  const updateExportPanelPosition = useCallback(() => {
    const anchor = exportButtonRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setExportPanelPosition({
      top: rect.bottom + 6,
      left: Math.max(12, rect.right - 190),
    });
  }, []);

  useEffect(() => {
    if (!columnsPanelOpen && !exportPanelOpen) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      const clickedColumns =
        columnsPanelRef.current?.contains(target) || columnsButtonRef.current?.contains(target);
      const clickedExport =
        exportPanelRef.current?.contains(target) || exportButtonRef.current?.contains(target);
      if (!clickedColumns) {
        setColumnsPanelOpen(false);
      }
      if (!clickedExport) setExportPanelOpen(false);
    }
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [columnsPanelOpen, exportPanelOpen]);

  useEffect(() => {
    if (!columnsPanelOpen && !exportPanelOpen) return;
    if (columnsPanelOpen) updateColumnsPanelPosition();
    if (exportPanelOpen) updateExportPanelPosition();
    const handleReposition = () => updateColumnsPanelPosition();
    const handleExportReposition = () => updateExportPanelPosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("resize", handleExportReposition);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("scroll", handleExportReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("resize", handleExportReposition);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("scroll", handleExportReposition, true);
    };
  }, [
    columnsPanelOpen,
    exportPanelOpen,
    updateColumnsPanelPosition,
    updateExportPanelPosition,
  ]);

  const clearSearch = useCallback(() => onSearchChange(""), [onSearchChange]);

  return (
    <div className="empresasSearchBlock">
      <div className="empresasSearchTopRow">
        <label htmlFor={searchInputId} className="empresasSearchLabel">
          {searchLabel}
        </label>
        {onPrimaryAction && primaryActionLabel ? (
          <div className="empresasSearchTopRowActions">
            {onSecondaryAction && secondaryActionLabel ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 h-9 shrink-0"
                onClick={onSecondaryAction}
              >
                {secondaryActionIcon}
                {secondaryActionLabel}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="gap-1.5 h-9 shrink-0 developerEmpresasPrimaryButton"
              onClick={onPrimaryAction}
            >
              {primaryActionIcon}
              {primaryActionLabel}
            </Button>
          </div>
        ) : onSecondaryAction && secondaryActionLabel ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-9 shrink-0"
            onClick={onSecondaryAction}
          >
            {secondaryActionIcon}
            {secondaryActionLabel}
          </Button>
        ) : null}
      </div>

      <div className="empresasSearchRow">
        <div className="empresasSearchInputWrap">
          <Search className="empresasSearchInputIcon" size={15} aria-hidden />
          <Input
            id={searchInputId}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full empresasSearchInput"
            autoComplete="off"
            type="search"
          />
        </div>

        <div ref={columnsButtonRef}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-9 shrink-0"
            onClick={() => {
              if (!columnsPanelOpen) updateColumnsPanelPosition();
              setColumnsPanelOpen((o) => !o);
            }}
          >
            <SlidersHorizontal size={13} aria-hidden />
            {columnsTitle}
          </Button>
          {columnsPanelOpen && (
            <div
              ref={columnsPanelRef}
              className="empresasColumnsPanel empresasColumnsPanelFloating"
              style={{
                top: `${columnsPanelPosition.top}px`,
                left: `${columnsPanelPosition.left}px`,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {columns.map((col) => (
                <Checkbox
                  key={col.key}
                  label={col.label}
                  checked={visibleColumns[col.key]}
                  onChange={(e) => onToggleColumn(col.key, e.target.checked)}
                />
              ))}
            </div>
          )}
        </div>

        {hasExport ? (
          <div ref={exportButtonRef}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 shrink-0"
              onClick={() => {
                if (!exportPanelOpen) updateExportPanelPosition();
                setExportPanelOpen((o) => !o);
              }}
            >
              <Download size={13} aria-hidden />
              {exportTitle}
            </Button>
            {exportPanelOpen && (
              <div
                ref={exportPanelRef}
                className="empresasColumnsPanel empresasColumnsPanelFloating"
                style={{
                  top: `${exportPanelPosition.top}px`,
                  left: `${exportPanelPosition.left}px`,
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {onExportCsv ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="empresasExportOptionBtn"
                    onClick={() => {
                      onExportCsv();
                      setExportPanelOpen(false);
                    }}
                  >
                    <FileSpreadsheet size={13} aria-hidden />
                    CSV
                  </Button>
                ) : null}
                {onExportPdf ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="empresasExportOptionBtn"
                    onClick={() => {
                      onExportPdf();
                      setExportPanelOpen(false);
                    }}
                  >
                    <FileType2 size={13} aria-hidden />
                    PDF
                  </Button>
                ) : null}
                {onExportHtml ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="empresasExportOptionBtn"
                    onClick={() => {
                      onExportHtml();
                      setExportPanelOpen(false);
                    }}
                  >
                    <FileCode2 size={13} aria-hidden />
                    HTML
                  </Button>
                ) : null}
                {onPrint ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="empresasExportOptionBtn"
                    onClick={() => {
                      onPrint();
                      setExportPanelOpen(false);
                    }}
                  >
                    <Printer size={13} aria-hidden />
                    Imprimir
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {extraActions?.map((action) => (
          <Button
            key={action.key}
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-9 shrink-0"
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 h-9 shrink-0"
          disabled={!searchValue.trim()}
          onClick={clearSearch}
        >
          <FilterX size={13} aria-hidden />
          {clearLabel}
        </Button>

        <span className="empresasCountBadge">{countLabel}</span>
      </div>
    </div>
  );
}

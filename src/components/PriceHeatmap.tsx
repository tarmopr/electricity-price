"use client";

import { useState, useMemo } from "react";
import { ElectricityPrice } from "@/lib/api";
import {
  buildCalendarHeatmap,
  buildPatternHeatmap,
  priceToColor,
  HeatmapData,
} from "@/lib/heatmapData";
import { CheapestWindow, getCheapestWindowHours } from "@/lib/cheapestWindow";

type HeatmapMode = "calendar" | "pattern";

interface SelectedCell {
  row: number;
  hour: number;
  price: number | null;
  label: string;
  isPredicted: boolean;
  isCheapest: boolean;
}

/** Max day columns for the transposed mobile grid before falling back to the scrollable grid. */
const MAX_TRANSPOSED_COLUMNS = 8;

/** Short column header for the transposed mobile grid: "Mon 3 Mar" → "Mon" / "3". */
function shortRowLabel(label: string): { top: string; bottom: string | null } {
  const [first, second] = label.split(" ");
  return { top: first.slice(0, 3), bottom: second ?? null };
}

interface PriceHeatmapProps {
  data: ElectricityPrice[];
  includeVat: boolean;
  highlightedDates?: string[];
  cheapestWindow?: CheapestWindow | null;
}

export default function PriceHeatmap({
  data,
  includeVat,
  highlightedDates,
  cheapestWindow,
}: PriceHeatmapProps) {
  const [mode, setMode] = useState<HeatmapMode>("calendar");
  const [hoveredCell, setHoveredCell] = useState<SelectedCell | null>(null);

  const calendarData = useMemo(
    () => buildCalendarHeatmap(data, includeVat, highlightedDates),
    [data, includeVat, highlightedDates]
  );

  const patternData = useMemo(
    () => buildPatternHeatmap(data, includeVat),
    [data, includeVat]
  );

  const heatmapData: HeatmapData =
    mode === "calendar" ? calendarData : patternData;

  // Compute cheapest window hour keys for highlighting
  const cheapestHourKeys = useMemo(() => {
    if (!cheapestWindow) return new Set<string>();
    return getCheapestWindowHours(cheapestWindow);
  }, [cheapestWindow]);

  if (heatmapData.rows.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-zinc-500">
        No data available for heatmap
      </div>
    );
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);
  // Beyond ~a week, day columns get too narrow on a phone (30 days ≈ 9px each);
  // fall back to the horizontally scrollable day-rows grid instead.
  const useTransposedOnMobile = heatmapData.rows.length <= MAX_TRANSPOSED_COLUMNS;

  /** Shared cell rendering for desktop (day rows) and mobile (hour rows) layouts. */
  function renderCell(
    row: HeatmapData["rows"][number],
    rowIdx: number,
    cell: HeatmapData["rows"][number]["cells"][number],
    sizeClass: string,
    key: string | number
  ) {
    const isCheapestCell = row.dateKey
      ? cheapestHourKeys.has(`${row.dateKey}:${cell.hour}`)
      : false;

    const cellTitle = cell.price !== null
      ? `${row.label} ${cell.hour.toString().padStart(2, "0")}:00 — ${cell.price.toFixed(2)} ¢/kWh${cell.isPredicted ? " (predicted)" : ""}${isCheapestCell ? " (cheapest window)" : ""}`
      : "No data";

    const selection: SelectedCell = {
      row: rowIdx,
      hour: cell.hour,
      price: cell.price,
      label: row.label,
      isPredicted: cell.isPredicted,
      isCheapest: isCheapestCell,
    };
    const isSelected =
      hoveredCell !== null && hoveredCell.row === rowIdx && hoveredCell.hour === cell.hour;

    return (
      <div
        key={key}
        role="gridcell"
        tabIndex={0}
        className={`${sizeClass} m-[1px] rounded-sm cursor-crosshair transition-all duration-150 hover:ring-1 hover:ring-white/30 hover:scale-110 hover:z-10 focus:outline-none focus:ring-2 focus:ring-white/50 focus:z-10 ${
          isCheapestCell ? "ring-2 ring-emerald-400/70 z-10" : ""
        } ${isSelected ? "outline outline-1 outline-white/70" : ""}`}
        style={{
          backgroundColor: priceToColor(
            cell.price,
            heatmapData.minPrice,
            heatmapData.maxPrice,
            cell.isPredicted
          ),
        }}
        onMouseEnter={() => setHoveredCell(selection)}
        onMouseLeave={() => setHoveredCell(null)}
        onFocus={() => setHoveredCell(selection)}
        onBlur={() => setHoveredCell(null)}
        // Tap support on touch devices (no hover)
        onClick={() => setHoveredCell(selection)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setHoveredCell(selection);
          }
        }}
        title={cellTitle}
        aria-label={cellTitle}
      />
    );
  }

  return (
    <div className="space-y-4" aria-label="Price heatmap">
      {/* Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2" role="group" aria-label="Heatmap mode">
          <button
            onClick={() => setMode("calendar")}
            aria-pressed={mode === "calendar"}
            className={`px-3 py-1.5 min-h-11 sm:min-h-0 rounded-lg text-sm transition-all border ${
              mode === "calendar"
                ? "bg-emerald-400/20 text-emerald-300 border-emerald-400/50"
                : "bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-800"
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setMode("pattern")}
            aria-pressed={mode === "pattern"}
            className={`px-3 py-1.5 min-h-11 sm:min-h-0 rounded-lg text-sm transition-all border ${
              mode === "pattern"
                ? "bg-indigo-400/20 text-indigo-300 border-indigo-400/50"
                : "bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-800"
            }`}
          >
            Weekly Pattern
          </button>
        </div>

        {/* Tooltip */}
        {hoveredCell && hoveredCell.price !== null && (
          <div className="text-sm text-zinc-300">
            <span className="text-zinc-500">{hoveredCell.label}</span>{" "}
            <span className="font-medium">
              {hoveredCell.hour.toString().padStart(2, "0")}:00
            </span>{" "}
            —{" "}
            <span className="font-bold text-emerald-400">
              {hoveredCell.price.toFixed(2)} ¢/kWh
            </span>
            {hoveredCell.isPredicted && (
              <span className="text-zinc-500 ml-1">(predicted)</span>
            )}
            {hoveredCell.isCheapest && (
              <span className="text-emerald-400 ml-1">(cheapest window)</span>
            )}
          </div>
        )}
      </div>

      {/* Heatmap Grid — desktop/tablet: rows = days, columns = hours.
          Also used on mobile when there are too many days to transpose legibly. */}
      <div className={useTransposedOnMobile ? "hidden sm:block overflow-x-auto" : "overflow-x-auto"}>
        <div className="min-w-[700px]" role="grid" aria-label="Price heatmap by day and hour">
          {/* Hour Headers */}
          <div className="flex" role="row">
            <div className="w-24 shrink-0" role="columnheader" aria-label="Row label" /> {/* spacer for row labels */}
            {hours.map((h) => (
              <div
                key={h}
                role="columnheader"
                aria-label={`${h.toString().padStart(2, "0")}:00`}
                className="flex-1 text-center text-[10px] text-zinc-500 pb-1"
              >
                {h.toString().padStart(2, "0")}
              </div>
            ))}
          </div>

          {/* Rows */}
          {heatmapData.rows.map((row, rowIdx) => (
            <div
              key={row.label + rowIdx}
              role="row"
              className={`flex items-center transition-opacity duration-200 ${
                row.isHighlighted === false ? "opacity-40" : ""
              }`}
            >
              {/* Row Label */}
              <div role="rowheader" className="w-24 shrink-0 text-xs text-zinc-400 pr-2 text-right truncate">
                {row.label}
              </div>

              {/* Cells */}
              {row.cells.map((cell) => renderCell(row, rowIdx, cell, "flex-1 aspect-square", cell.hour))}
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap Grid — mobile: transposed (rows = hours, columns = days), fits phone width */}
      {useTransposedOnMobile && (
      <div className="sm:hidden" role="grid" aria-label="Price heatmap by hour and day">
        <div className="flex" role="row">
          <div className="w-8 shrink-0" role="columnheader" aria-label="Hour" />
          {heatmapData.rows.map((row, rowIdx) => {
            const { top, bottom } = shortRowLabel(row.label);
            return (
              <div
                key={row.label + rowIdx}
                role="columnheader"
                aria-label={row.label}
                className={`flex-1 min-w-0 text-center text-[10px] leading-tight pb-1 ${
                  row.isHighlighted === false ? "text-zinc-500 opacity-40" : "text-zinc-300"
                }`}
              >
                <div>{top}</div>
                {bottom && <div>{bottom}</div>}
              </div>
            );
          })}
        </div>
        {hours.map((h) => (
          <div key={h} role="row" className="flex items-center">
            <div role="rowheader" className="w-8 shrink-0 text-[10px] text-zinc-500 pr-1 text-right tabular-nums">
              {h.toString().padStart(2, "0")}
            </div>
            {heatmapData.rows.map((row, rowIdx) => {
              const cell = row.cells[h];
              if (!cell) return null;
              const sizeClass =
                row.isHighlighted === false ? "flex-1 min-w-0 h-5 opacity-40" : "flex-1 min-w-0 h-5";
              return renderCell(row, rowIdx, cell, sizeClass, `${row.label}-${rowIdx}`);
            })}
          </div>
        ))}
      </div>
      )}

      <div>
          {/* Color Legend */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-4 pt-3 border-t border-zinc-800/50">
            <span className="text-xs text-zinc-500">Cheap</span>
            <div className="flex h-3 w-40 rounded-full overflow-hidden">
              {Array.from({ length: 20 }, (_, i) => {
                const t = i / 19;
                const price =
                  heatmapData.minPrice +
                  t * (heatmapData.maxPrice - heatmapData.minPrice);
                return (
                  <div
                    key={i}
                    className="flex-1"
                    style={{
                      backgroundColor: priceToColor(
                        price,
                        heatmapData.minPrice,
                        heatmapData.maxPrice
                      ),
                    }}
                  />
                );
              })}
            </div>
            <span className="text-xs text-zinc-500">Expensive</span>
            <span className="text-xs text-zinc-600 ml-2">
              {heatmapData.minPrice.toFixed(1)}–
              {heatmapData.maxPrice.toFixed(1)} ¢/kWh
            </span>
          </div>

          {/* Predicted & Cheapest Window Legend */}
          {(heatmapData.hasPredictions || cheapestHourKeys.size > 0) && (
            <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
              {heatmapData.hasPredictions && (
                <>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-sm"
                      style={{
                        backgroundColor: priceToColor(
                          (heatmapData.minPrice + heatmapData.maxPrice) / 2,
                          heatmapData.minPrice,
                          heatmapData.maxPrice,
                          false
                        ),
                      }}
                    />
                    <span className="text-xs text-zinc-500">Actual</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-sm"
                      style={{
                        backgroundColor: priceToColor(
                          (heatmapData.minPrice + heatmapData.maxPrice) / 2,
                          heatmapData.minPrice,
                          heatmapData.maxPrice,
                          true
                        ),
                      }}
                    />
                    <span className="text-xs text-zinc-500">
                      Predicted (4-week avg)
                    </span>
                  </div>
                </>
              )}
              {cheapestHourKeys.size > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-sm ring-2 ring-emerald-400/70" />
                  <span className="text-xs text-zinc-500">Cheapest window</span>
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}

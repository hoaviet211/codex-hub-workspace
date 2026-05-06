import { ArrowDownUp, Search } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { cn } from "../lib/utils";

export interface DataColumn<T> {
  key: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | undefined;
}

interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  emptyText?: string;
  filterPlaceholder?: string;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading,
  error,
  emptyText = "No records.",
  filterPlaceholder = "Filter",
}: DataTableProps<T>) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState(columns[0]?.key ?? "");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");

  const sortedRows = useMemo(() => {
    const filtered = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(filter.toLowerCase()));
    const column = columns.find((item) => item.key === sortKey);
    if (!column?.sortValue) return filtered;
    return [...filtered].sort((a, b) => {
      const left = column.sortValue?.(a) ?? "";
      const right = column.sortValue?.(b) ?? "";
      const result = String(left).localeCompare(String(right), undefined, { numeric: true });
      return direction === "asc" ? result : -result;
    });
  }, [columns, direction, filter, rows, sortKey]);

  if (error) {
    return <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800">{String((error as Error).message ?? error)}</div>;
  }

  return (
    <div className="space-y-3">
      <label className="flex max-w-sm items-center gap-2 rounded border border-stone-300 bg-white px-3 py-2 text-sm">
        <Search className="h-4 w-4 text-stone-500" />
        <input
          className="w-full bg-transparent outline-none"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={filterPlaceholder}
        />
      </label>
      <div className="overflow-hidden rounded border border-stone-300 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-stone-100 text-xs uppercase text-stone-600">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className="px-3 py-3 font-semibold">
                    <button
                      className={cn("inline-flex items-center gap-1", column.sortValue ? "cursor-pointer" : "cursor-default")}
                      onClick={() => {
                        if (!column.sortValue) return;
                        setSortKey(column.key);
                        setDirection(sortKey === column.key && direction === "asc" ? "desc" : "asc");
                      }}
                    >
                      {column.header}
                      {column.sortValue ? <ArrowDownUp className="h-3.5 w-3.5" /> : null}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-3 py-6 text-stone-500" colSpan={columns.length}>Loading...</td></tr>
              ) : sortedRows.length === 0 ? (
                <tr><td className="px-3 py-6 text-stone-500" colSpan={columns.length}>{emptyText}</td></tr>
              ) : (
                sortedRows.map((row) => (
                  <tr key={getRowKey(row)} className="border-t border-stone-200">
                    {columns.map((column) => <td key={column.key} className="px-3 py-3 align-top">{column.accessor(row)}</td>)}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-stone-200 px-3 py-2 text-xs text-stone-500">{sortedRows.length} shown / {rows.length} total</div>
      </div>
    </div>
  );
}

"use client";

import { toCsv } from "@/lib/csv";

type ExportButtonProps = {
  label: string;
  filename: string;
  headers: string[];
  rows: string[][];
};

export function ExportButton({ label, filename, headers, rows }: ExportButtonProps) {
  function download() {
    const csv = toCsv(headers, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button
      type="button"
      onClick={download}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
    >
      {label}
    </button>
  );
}

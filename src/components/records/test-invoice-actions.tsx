"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type TestInvoiceActionsProps = {
  kind: "sale" | "purchase";
  id: string;
  isTest: boolean;
  canMark: boolean;
  canDelete: boolean;
  testLabel: string;
  deleteLabel: string;
  backHref: string;
};

export function TestInvoiceActions({
  kind,
  id,
  isTest,
  canMark,
  canDelete,
  testLabel,
  deleteLabel,
  backHref,
}: TestInvoiceActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function markTest(next: boolean) {
    if (!canMark) {
      return;
    }
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc(
      kind === "sale" ? "set_sale_test" : "set_purchase_test",
      { p_id: id, p_is_test: next },
    );
    setPending(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }
  async function remove() {
    if (!canDelete || !isTest) {
      return;
    }
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc(
      kind === "sale" ? "delete_sale" : "delete_purchase",
      { p_id: id },
    );
    setPending(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.push(backHref);
    router.refresh();
  }
  return (
    <div className="print:hidden flex flex-wrap items-center gap-3">
      {canMark ? (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={isTest}
            disabled={pending}
            onChange={(e) => markTest(e.target.checked)}
          />
          {testLabel}
        </label>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          onClick={remove}
          disabled={pending || !isTest}
          className="rounded-md border border-red-800 px-3 py-2 text-sm font-medium text-red-800 disabled:opacity-40"
        >
          {deleteLabel}
        </button>
      ) : null}
      {error ? <p className="text-sm text-red-800">{error}</p> : null}
    </div>
  );
}

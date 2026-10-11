"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type DeleteProductButtonProps = {
  productId: string;
  label: string;
};

export function DeleteProductButton({ productId, label }: DeleteProductButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function remove() {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("delete_product", { p_id: productId });
    setPending(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.push("/products");
    router.refresh();
  }
  return (
    <div>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="rounded-md border border-red-800 px-3 py-2 text-sm font-medium text-red-800 disabled:opacity-40"
      >
        {label}
      </button>
      {error ? <p className="mt-2 text-sm text-red-800">{error}</p> : null}
    </div>
  );
}

export type StockCheck =
  | { ok: true }
  | { ok: false; message: string };

export function checkAddQty(
  currentQty: number,
  stockQty: number,
  name: string,
): StockCheck {
  const nextQty = currentQty + 1;
  if (nextQty <= 0) {
    return { ok: false, message: "Quantity must be greater than zero" };
  }
  if (nextQty > stockQty) {
    if (stockQty < 1) {
      return { ok: false, message: `${name} is out of stock` };
    }
    return { ok: false, message: `Not enough stock for ${name}` };
  }
  return { ok: true };
}

export function checkCheckout(
  lines: Array<{ qty: number; stockQty: number; name: string }>,
): StockCheck {
  if (lines.length === 0) {
    return { ok: false, message: "Cart is empty" };
  }
  for (const line of lines) {
    if (line.qty <= 0) {
      return { ok: false, message: "Quantity must be greater than zero" };
    }
    if (line.qty > line.stockQty) {
      return { ok: false, message: `Not enough stock for ${line.name}` };
    }
  }
  return { ok: true };
}

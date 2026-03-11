import type { ShoppingListItem } from "../../domain/types";

function prettyCategory(cat: string) {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function roundUp(value: number, step: number) {
  if (step <= 0) return value;
  return Math.ceil(value / step) * step;
}

const PACK_SIZES: Record<string, number[]> = {
  egg: [6, 10, 12],
  kind_bar: [6, 12],
};

function roundToPackSize(ingredientId: string, count: number) {
  const packs = PACK_SIZES[ingredientId];
  if (!packs) return Math.ceil(count);
  for (const p of packs) if (count <= p) return p;
  const max = packs[packs.length - 1];
  return Math.ceil(count / max) * max;
}

function stepFor(category: string, unit: string, amount: number) {
  if (unit === "piece") return 1;

  switch (category) {
    case "veg":
    case "fruit":
    case "dairy":
    case "pantry":
      return amount < 250 ? 50 : 100;

    case "protein":
    case "carb":
      return amount < 500 ? 100 : 250;

    case "fat":
      return amount < 250 ? 50 : 250;

    default:
      return amount < 250 ? 50 : 100;
  }
}

function formatAmount(n: number) {
  return Math.round(n);
}

function oliveOilMlApproxFromG(g: number) {
  return Math.round(g / 0.91);
}

export default function CategorySection({
  category,
  items,
  showRounded,
}: {
  category: string;
  items: ShoppingListItem[];
  showRounded: boolean;
}) {
  const safeItems = items.filter((it) => it.totalAmount > 0);
  if (!safeItems.length) return null;

  return (
    <div className="card card-pad">
      <div className="card-header" style={{ marginBottom: 8 }}>
        <div className="card-title" style={{ fontSize: 16 }}>
          {prettyCategory(category)}
        </div>
        <div className="small">{safeItems.length} items</div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {safeItems
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((it) => {
            const exact = formatAmount(it.totalAmount);

            let rounded: number;
            if (it.unit === "piece") {
              rounded = roundToPackSize(it.ingredientId, it.totalAmount);
            } else {
              const step = stepFor(it.category, it.unit, exact);
              rounded = roundUp(exact, step);
            }

            const displayAmount = showRounded ? rounded : exact;
            const note = showRounded
              ? `exact ${exact}${it.unit}`
              : `buy ~${rounded}${it.unit}`;

            const oilHint =
              it.ingredientId === "olive_oil" && it.unit === "g"
                ? ` • ~${oliveOilMlApproxFromG(displayAmount)}ml`
                : "";

            return (
              <div
                key={`${it.ingredientId}:${it.unit}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "baseline",
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(36,36,36,0.08)",
                  background: "rgba(36,36,36,0.02)",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{it.name}</div>

                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {displayAmount}
                    {it.unit}
                    <span style={{ opacity: 0.65 }}>{oilHint}</span>
                  </div>
                  <div className="small" style={{ marginTop: 2 }}>
                    {note}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
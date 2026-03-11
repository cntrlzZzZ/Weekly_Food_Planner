import type { ShoppingListItem } from "../../domain/types";
import { jsPDF } from "jspdf";

function roundUp(value: number, step: number) {
  if (step <= 0) return value;
  return Math.ceil(value / step) * step;
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

function toLines(items: ShoppingListItem[], useRounded: boolean) {
  const sorted = items
    .filter((x) => x.totalAmount > 0)
    .slice()
    .sort((a, b) =>
      a.category === b.category ? a.name.localeCompare(b.name) : a.category.localeCompare(b.category)
    );

  return sorted.map((it) => {
    const exact = formatAmount(it.totalAmount);
    const step = stepFor(it.category, it.unit, exact);
    const rounded = it.unit === "piece" ? Math.ceil(it.totalAmount) : roundUp(exact, step);

    const amount = useRounded ? rounded : exact;
    const suffix = useRounded ? ` (exact ${exact}${it.unit})` : ` (buy ~${rounded}${it.unit})`;

    return `${it.category.toUpperCase()} — ${it.name}: ${amount}${it.unit}${suffix}`;
  });
}

export default function ExportButtons({
  items,
  useRounded,
}: {
  items: ShoppingListItem[];
  useRounded: boolean;
}) {
  async function copy() {
    const text = toLines(items, useRounded).join("\n");
    await navigator.clipboard.writeText(text);
    alert("Copied shopping list to clipboard.");
  }

  function downloadPdf() {
    const doc = new jsPDF();
    const lines = toLines(items, useRounded);

    doc.setFontSize(16);
    doc.text("Shopping list", 14, 18);

    doc.setFontSize(10);
    let y = 28;
    const lineHeight = 5;

    for (const line of lines) {
      const wrapped = doc.splitTextToSize(line, 180);
      for (const w of wrapped) {
        if (y > 285) {
          doc.addPage();
          y = 20;
        }
        doc.text(w, 14, y);
        y += lineHeight;
      }
    }

    doc.save("shopping-list.pdf");
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button className="btn" onClick={copy} disabled={!items.length}>
        Copy
      </button>
      <button className="btn" onClick={downloadPdf} disabled={!items.length}>
        Download PDF
      </button>

      <span className="small" style={{ marginLeft: 6 }}>
        {useRounded ? "Rounded amounts" : "Exact amounts"}
      </span>
    </div>
  );
}
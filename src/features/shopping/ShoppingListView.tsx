import type { ShoppingListItem } from "../../domain/types";
import CategorySection from "./CategorySection";

function groupByCategory(items: ShoppingListItem[]) {
  const m = new Map<string, ShoppingListItem[]>();
  for (const it of items) {
    if (it.totalAmount <= 0) continue;
    const key = it.category;
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(it);
  }
  return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

export default function ShoppingListView({
  items,
  showRounded,
}: {
  items: ShoppingListItem[];
  showRounded: boolean;
}) {
  const grouped = groupByCategory(items);

  if (!items.length) {
    return (
      <div className="card card-pad">
        <div className="small">No items yet — build a few days first.</div>
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      {grouped.map(([category, list]) => (
        <CategorySection key={category} category={category} items={list} showRounded={showRounded} />
      ))}
    </div>
  );
}
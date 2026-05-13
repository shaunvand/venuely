import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { INVENTORY_FIELDS, type InventoryType } from "@/lib/inventory/schemas";

export const runtime = "nodejs";

const EXAMPLES: Record<InventoryType, Array<Record<string, string | number>>> = {
  catalogue: [
    { Category: "Menu", Name: "3-course plated dinner", Description: "Starter, main, dessert", "Price (R)": 595, Unit: "per_person", "Image URL": "" },
    { Category: "Beverage", Name: "Welcome drink", Description: "Sparkling MCC on arrival", "Price (R)": 85, Unit: "per_person", "Image URL": "" },
  ],
  rentals: [
    { Category: "Furniture", Name: "Wooden trestle table", Description: "Seats 8", "Price (R)": 350, Stock: 12, "Image URL": "" },
    { Category: "Lighting", Name: "Fairy light curtain", Description: "4m × 3m warm white", "Price (R)": 450, Stock: 6, "Image URL": "" },
  ],
  accommodation: [
    { Name: "Vineyard Cottage 1", Type: "cottage", Sleeps: 2, "Price / night (R)": 1850, Description: "Open-plan with fireplace + slipper bath", "Image URL": "" },
    { Name: "Garden Suite", Type: "suite", Sleeps: 4, "Price / night (R)": 2400, Description: "Two queen beds, garden access", "Image URL": "" },
  ],
};

export async function GET(req: NextRequest) {
  const type = (req.nextUrl.searchParams.get("type") || "") as InventoryType;
  if (!INVENTORY_FIELDS[type]) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

  const ws = XLSX.utils.json_to_sheet(EXAMPLES[type]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, type);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${type}-template.xlsx"`,
    },
  });
}

export type InventoryType = "catalogue" | "rentals" | "accommodation";

export const INVENTORY_TABLES: Record<InventoryType, string> = {
  catalogue: "catalogue_items",
  rentals: "rental_items",
  accommodation: "accommodation_rooms",
};

export const INVENTORY_PATHS: Record<InventoryType, string> = {
  catalogue: "/venue/catalogue",
  rentals: "/venue/rentals",
  accommodation: "/venue/accommodation",
};

export type FieldSpec = {
  key: string;
  label: string;
  type: "string" | "number" | "select";
  options?: string[];
  required?: boolean;
};

export const INVENTORY_FIELDS: Record<InventoryType, FieldSpec[]> = {
  catalogue: [
    { key: "category", label: "Category", type: "string", required: true },
    { key: "name", label: "Name", type: "string", required: true },
    { key: "description", label: "Description", type: "string" },
    { key: "price", label: "Price (R)", type: "number" },
    { key: "price_unit", label: "Unit", type: "select", options: ["fixed", "per_person", "per_hour"] },
    { key: "image_url", label: "Image URL", type: "string" },
  ],
  rentals: [
    { key: "category", label: "Category", type: "string", required: true },
    { key: "name", label: "Name", type: "string", required: true },
    { key: "description", label: "Description", type: "string" },
    { key: "price", label: "Price (R)", type: "number" },
    { key: "stock_total", label: "Stock", type: "number" },
    { key: "image_url", label: "Image URL", type: "string" },
  ],
  accommodation: [
    { key: "name", label: "Name", type: "string", required: true },
    { key: "room_type", label: "Type", type: "string" },
    { key: "sleeps", label: "Sleeps", type: "number" },
    { key: "price_per_night", label: "Price / night (R)", type: "number" },
    { key: "description", label: "Description", type: "string" },
    { key: "image_url", label: "Image URL", type: "string" },
  ],
};

export function defaultsFor(type: InventoryType): Record<string, unknown> {
  switch (type) {
    case "catalogue": return { price_unit: "fixed", active: true };
    case "rentals":   return { stock_total: 1, active: true };
    case "accommodation": return { sleeps: 2, active: true };
  }
}

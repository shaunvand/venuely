export type InventoryType =
  | "catalogue" | "rentals" | "accommodation"
  | "caterers" | "planners" | "florists" | "djs" | "photographers" | "decor" | "bar";

export const VENDOR_TYPES = ["caterers","planners","florists","djs","photographers","decor","bar"] as const;
export type VendorType = (typeof VENDOR_TYPES)[number];

// Map plural slug → singular enum value stored in DB
export const VENDOR_DB_VALUE: Record<VendorType, string> = {
  caterers: "caterer",
  planners: "planner",
  florists: "florist",
  djs: "dj",
  photographers: "photographer",
  decor: "decor",
  bar: "bar",
};

export const VENDOR_LABELS: Record<VendorType, string> = {
  caterers: "Caterers",
  planners: "Planners",
  florists: "Florists",
  djs: "DJs",
  photographers: "Photographers",
  decor: "Decor",
  bar: "Bar services",
};

export const INVENTORY_TABLES: Record<InventoryType, string> = {
  catalogue: "catalogue_items",
  rentals: "rental_items",
  accommodation: "accommodation_rooms",
  caterers: "vendor_partners",
  planners: "vendor_partners",
  florists: "vendor_partners",
  djs: "vendor_partners",
  photographers: "vendor_partners",
  decor: "vendor_partners",
  bar: "vendor_partners",
};

export const INVENTORY_PATHS: Record<InventoryType, string> = {
  catalogue: "/venue/catalogue",
  rentals: "/venue/rentals",
  accommodation: "/venue/accommodation",
  caterers: "/venue/marketplace/caterers",
  planners: "/venue/marketplace/planners",
  florists: "/venue/marketplace/florists",
  djs: "/venue/marketplace/djs",
  photographers: "/venue/marketplace/photographers",
  decor: "/venue/marketplace/decor",
  bar: "/venue/marketplace/bar",
};

export function isVendorType(t: string): t is VendorType {
  return (VENDOR_TYPES as readonly string[]).includes(t);
}

export type FieldSpec = {
  key: string;
  label: string;
  type: "string" | "number" | "select";
  options?: string[];
  required?: boolean;
};

const VENDOR_FIELDS: FieldSpec[] = [
  { key: "name", label: "Name", type: "string", required: true },
  { key: "description", label: "Description", type: "string" },
  { key: "price_from", label: "Price from (R)", type: "number" },
  { key: "commission_type", label: "Commission type", type: "select", options: ["fixed", "percent"] },
  { key: "commission_value", label: "Commission (R or %)", type: "number" },
  { key: "contact_email", label: "Contact email", type: "string" },
  { key: "contact_phone", label: "Contact phone", type: "string" },
  { key: "website_url", label: "Website", type: "string" },
  { key: "image_url", label: "Image URL", type: "string" },
];

export const INVENTORY_FIELDS: Record<InventoryType, FieldSpec[]> = {
  catalogue: [
    { key: "category", label: "Category", type: "string", required: true },
    { key: "name", label: "Name", type: "string", required: true },
    { key: "description", label: "Description", type: "string" },
    { key: "price", label: "Price (R)", type: "number" },
    { key: "price_unit", label: "Unit", type: "select", options: ["fixed", "per_person", "per_hour"] },
    { key: "commission_type", label: "Commission type", type: "select", options: ["fixed", "percent"] },
    { key: "commission_value", label: "Commission (R or %)", type: "number" },
    { key: "image_url", label: "Image URL", type: "string" },
  ],
  rentals: [
    { key: "category", label: "Category", type: "string", required: true },
    { key: "name", label: "Name", type: "string", required: true },
    { key: "description", label: "Description", type: "string" },
    { key: "price", label: "Price (R)", type: "number" },
    { key: "stock_total", label: "Stock", type: "number" },
    { key: "commission_type", label: "Commission type", type: "select", options: ["fixed", "percent"] },
    { key: "commission_value", label: "Commission (R or %)", type: "number" },
    { key: "image_url", label: "Image URL", type: "string" },
  ],
  accommodation: [
    { key: "name", label: "Name", type: "string", required: true },
    { key: "room_type", label: "Type", type: "string" },
    { key: "sleeps", label: "Sleeps", type: "number" },
    { key: "price_per_night", label: "Price / night (R)", type: "number" },
    { key: "description", label: "Description", type: "string" },
    { key: "commission_type", label: "Commission type", type: "select", options: ["fixed", "percent"] },
    { key: "commission_value", label: "Commission (R or %)", type: "number" },
    { key: "image_url", label: "Image URL", type: "string" },
  ],
  caterers: VENDOR_FIELDS,
  planners: VENDOR_FIELDS,
  florists: VENDOR_FIELDS,
  djs: VENDOR_FIELDS,
  photographers: VENDOR_FIELDS,
  decor: VENDOR_FIELDS,
  bar: VENDOR_FIELDS,
};

export function defaultsFor(type: InventoryType): Record<string, unknown> {
  switch (type) {
    case "catalogue": return { price_unit: "fixed", active: true, commission_type: "fixed", commission_value: 0 };
    case "rentals":   return { stock_total: 1, active: true, commission_type: "fixed", commission_value: 0 };
    case "accommodation": return { sleeps: 2, active: true, commission_type: "fixed", commission_value: 0 };
    default:
      if (isVendorType(type)) return { active: true, vendor_type: VENDOR_DB_VALUE[type], commission_type: "fixed", commission_value: 0 };
      return { active: true };
  }
}

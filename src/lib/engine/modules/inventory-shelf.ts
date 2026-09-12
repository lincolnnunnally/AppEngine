// inventory-shelf — stock with quantity and use-by, mined from Plenty's pantry shelf.

import { simpleListModule } from "./simple-list.ts";

export const inventoryShelfModule = simpleListModule({
  slug: "inventory-shelf",
  name: "Shelf",
  flag: "FEATURE_SHELF",
  table: "shelf_items",
  path: "/shelf",
  heading: "What's on the shelf",
  blurb: "Name, how many, and when it should go out — so short-dated goods leave first.",
  empty: "The shelf is empty.",
  button: "Add to the shelf",
  fields: [
    { key: "name", column: "name", label: "Item name" },
    { key: "quantity", column: "quantity", label: "How many", kind: "number" },
    { key: "useBy", column: "use_by", label: "Use by" },
    { key: "notes", column: "notes", label: "Notes", kind: "textarea" }
  ],
  titleField: "name",
  bodyField: "useBy"
});

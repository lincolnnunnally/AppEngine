// group-buy-campaigns — lock a shared buy so a group can order together.
// Mined from AppEngine group-buy (United Under God Connect).

import { simpleListModule } from "./simple-list.ts";

export const groupBuyCampaignsModule = simpleListModule({
  slug: "group-buy-campaigns",
  name: "Group buy",
  flag: "FEATURE_GROUP_BUY",
  table: "group_buy_campaigns",
  path: "/group-buy",
  heading: "Buy together",
  blurb: "Name what the group is buying and when the order locks.",
  empty: "No group buys yet.",
  button: "Start a group buy",
  fields: [
    { key: "title", column: "title", label: "What we're buying" },
    { key: "vendor", column: "vendor", label: "Vendor or source" },
    { key: "lockDate", column: "lock_date", label: "Lock date" },
    { key: "notes", column: "notes", label: "Notes", kind: "textarea" }
  ],
  titleField: "title",
  bodyField: "vendor"
});

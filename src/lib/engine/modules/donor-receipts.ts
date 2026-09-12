// donor-receipts — in-kind / cash receipts with a plain tax note. Mined from Plenty grocery-donor flow.

import { simpleListModule } from "./simple-list.ts";

export const donorReceiptsModule = simpleListModule({
  slug: "donor-receipts",
  name: "Receipts",
  flag: "FEATURE_RECEIPTS",
  table: "donor_receipts",
  path: "/receipts",
  heading: "Donor receipts",
  blurb: "Record what was given and a plain note for the donor. Not tax advice — a record they can keep.",
  empty: "No receipts yet.",
  button: "Save receipt",
  fields: [
    { key: "donor", column: "donor", label: "Donor name" },
    { key: "whatGiven", column: "what_given", label: "What they gave" },
    { key: "valueNote", column: "value_note", label: "Value / tax note" },
    { key: "dateGiven", column: "date_given", label: "Date" }
  ],
  titleField: "donor",
  bodyField: "whatGiven"
});

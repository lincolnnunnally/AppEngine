// Top prospects name rule. Port of ChurchConnect backend/utils/top_prospects_rule.py
// name_excluded at main 8aa17b18. The AV list keeps avNameExcluded in
// av-prospects-core.ts (PR #416). This function is the top-prospects path only.

export type TopNameRow = Record<string, unknown> | null | undefined;

const s = (value: unknown): string => (value === null || value === undefined ? "" : String(value).trim());

function folded(name: string): string {
  return s(name)
    .toLowerCase()
    .replace(/á/g, "a")
    .replace(/é/g, "e")
    .replace(/í/g, "i")
    .replace(/ó/g, "o")
    .replace(/ú/g, "u");
}

function nameWords(name: string): string[] {
  return folded(name).replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
}

const CHURCH_WORDS = new Set([
  "church", "churches", "baptist", "methodist", "presbyterian", "episcopal",
  "lutheran", "catholic", "nazarene", "ame", "pentecostal", "holiness",
  "assembly", "tabernacle", "chapel", "fellowship", "ministries", "ministry",
  "congregation", "worship", "cathedral", "missionary", "faith", "bethel",
  "christ", "gospel", "apostolic", "deliverance", "praise", "holy",
  "cog", "cogic", "cogiu", "cme", "mbc", "umc"
]);
const FUND_ENDINGS = new Set(["foundation", "endowment", "trust", "fund"]);
const FUND_ANYWHERE = new Set(["foundation", "endowment"]);
const CEMETERY_WORDS = new Set(["cemetery", "cemetary"]);
const CONGREGATION_ENDINGS = new Set([
  "church", "ministries", "ministry", "missionary", "tabernacle", "temple",
  "chapel", "assembly", "fellowship", "congregation"
]);
const PLACE_ENDINGS = new Set(["fields", "field", "park", "complex", "gym", "cemetery", "cemetary", "campground"]);
const FACILITY_BEFORE_PLACE = new Set(["soccer", "ball", "athletic", "sports", "recreation", "rec"]);
const WORSHIP_WORDS = new Set([...CHURCH_WORDS, "parish"]);
const NAME_DROP = new Set(["inc", "incorporated", "llc", "corp", "corporation", "co"]);
const TEMPLE_SECOND = new Set([
  "beth", "bet", "beit", "emanu", "emanuel", "emmanuel",
  "sholom", "shalom", "sinai", "israel", "bnai", "am"
]);
const TEMPLE_BODY_MARKERS = new Set([
  "synagogue", "jewish", "umbanda", "hindu", "sikh",
  "buddhist", "buddhism", "buddha", "islamic", "islam",
  "masjid", "mosque", "muslim", "moslem"
]);
const NON_CHRISTIAN_DENOM = /\b(jewish|judaism|hebrew|islam|islamic|muslim|hindu|buddhist|sikh|umbanda|unitarian|universalist|mormon)\b|\blatter\s*-?\s*day\b/;
const EXPLICIT_DROP_ID_PREFIXES = ["4780f99b", "9df34bd4", "771a11d8", "53f9f8e1", "3c054fcf", "d12daa6d", "fe11b9a8", "b70a9179"];
const EXPLICIT_KEEP_ID_PREFIXES = ["5f1f1277"];
const CHRISTIAN_NAME_WORDS = new Set(["church", "churches", "baptist", "methodist", "christ", "jesus", "christian"]);
const JEWISH_BODY_WORDS = new Set(["torah", "judaism", "shalom", "kodesh", "chesed"]);
const NONCHRISTIAN_START_WORDS = new Set(["beit", "kahal", "wat"]);
const ALWAYS_DROP = new Set([
  "unitarian", "universalist", "diocese", "archdiocese", "convention", "distribution",
  "masjed", "musalla", "mormon", "sikh", "gurdwara", "mandir", "swaminarayan", "shrine",
  "scientology", "spiritualist", "hindu", "buddhist", "buddhism", "buddha", "synagogue",
  "lds", "jewish", "vedanta", "kollel", "vaisnava", "vaishnava", "umbanda", "spiritist",
  "theosophical", "islamic", "islam", "masjid", "muhammad", "mohammed", "muslim", "moslem",
  "hebrew", "chabad", "mosque", "conference"
]);

function isRow(row: TopNameRow): row is Record<string, unknown> {
  return Boolean(row) && typeof row === "object";
}

function nteeCode(row: TopNameRow): string {
  if (!isRow(row)) return "";
  const raw = row.ntee === undefined || row.ntee === null || row.ntee === "" ? row.ntee_code : row.ntee;
  return s(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function recordedChurch(row: TopNameRow): boolean {
  if (!isRow(row)) return false;
  if (s(row.denomination)) return true;
  return nteeCode(row).startsWith("X2");
}

function christianRecorded(row: TopNameRow): boolean {
  if (!recordedChurch(row) || !isRow(row)) return false;
  const denom = folded(s(row.denomination));
  if (denom && NON_CHRISTIAN_DENOM.test(denom)) return false;
  return true;
}

function rowId(row: TopNameRow): string {
  if (!isRow(row)) return "";
  return s(row.id).toLowerCase().replace(/[^a-f0-9]/g, "");
}

function idStarts(row: TopNameRow, prefixes: readonly string[]): boolean {
  const ident = rowId(row);
  if (!ident) return false;
  return prefixes.some((prefix) => ident.startsWith(prefix));
}

export function topHasChurchWord(name: string): boolean {
  return hasChurchWord(name);
}

function hasChurchWord(name: string): boolean {
  const raw = folded(name);
  const words = nameWords(name);
  if (words.some((word) => CHURCH_WORDS.has(word))) return true;
  return /\ba\s*\.?\s*m\s*\.?\s*e\b/.test(raw);
}

function withoutLegalSuffix(words: string[]): string[] {
  const kept = [...words];
  while (kept.length && NAME_DROP.has(kept[kept.length - 1])) kept.pop();
  return kept;
}

function foundationCongregation(words: string[]): boolean {
  if (!words.includes("foundation")) return false;
  const text = words.join(" ");
  if (/\bfoundation\b.*\bworship\s+center\b/.test(text)) return true;
  return /\bfoundation\b.*\bchurch\s+of\s+god\b/.test(text);
}

function fundNameExcluded(name: string): boolean {
  const words = withoutLegalSuffix(nameWords(name));
  if (!words.length) return false;
  if (FUND_ENDINGS.has(words[words.length - 1])) return true;
  if (foundationCongregation(words)) return false;
  if (CONGREGATION_ENDINGS.has(words[words.length - 1])) return false;
  return words.some((word) => FUND_ANYWHERE.has(word));
}

function christianNameWord(words: string[]): boolean {
  return words.some((word) => CHRISTIAN_NAME_WORDS.has(word));
}

function christianDenomination(row: TopNameRow): boolean {
  if (!isRow(row)) return false;
  const denom = folded(s(row.denomination));
  if (!denom || NON_CHRISTIAN_DENOM.test(denom)) return false;
  return true;
}

function houseOfGod(words: string[]): boolean {
  for (let index = 0; index < words.length - 2; index += 1) {
    if (words[index] === "house" && words[index + 1] === "of" && words[index + 2] === "god") return true;
  }
  return false;
}

function worshipCongregationWord(words: string[]): boolean {
  return words.includes("tabernacle") || words.includes("worship") || houseOfGod(words);
}

function christianMarker(row: TopNameRow, words: string[]): boolean {
  if (christianDenomination(row)) return true;
  if (isRow(row) && nteeCode(row).startsWith("X2")) return true;
  if (christianNameWord(words)) return true;
  return worshipCongregationWord(words);
}

function x30WorshipSaved(name: string, row: TopNameRow): boolean {
  if (!isRow(row) || !nteeCode(row).startsWith("X30")) return false;
  return worshipCongregationWord(nameWords(name));
}

function x20OrX21(row: TopNameRow): boolean {
  if (!isRow(row)) return false;
  const code = nteeCode(row);
  return code.startsWith("X20") || code.startsWith("X21");
}

function x21(row: TopNameRow): boolean {
  return isRow(row) && nteeCode(row).startsWith("X21");
}

function nteeNonchristianFamily(row: TopNameRow): boolean {
  return isRow(row) && /^X[3-8]/.test(nteeCode(row));
}

function nonChristianTemple(name: string): boolean {
  const raw = folded(name);
  const words = nameWords(raw);
  if (words.some((word) => TEMPLE_BODY_MARKERS.has(word))) return true;
  if (/\bhebrew\s+congregation\b/.test(raw)) return true;
  if (words.includes("temple") && words.includes("israel")) return true;
  if (/\btemple\s+beth\b/.test(raw)) return true;
  if (words[0] === "temple" && words.length > 1 && TEMPLE_SECOND.has(words[1])) return true;
  if (words[0] === "temple" && words.length > 2 && words[1] === "b" && words[2] === "nai") return true;
  return false;
}

function templeNamesTheCongregation(name: string): boolean {
  const words = nameWords(name);
  for (let index = 0; index < words.length; index += 1) {
    if (words[index] !== "temple") continue;
    const prev = index ? words[index - 1] : "";
    const next = index + 1 < words.length ? words[index + 1] : "";
    if (prev === "of" && !CHURCH_WORDS.has(next) && next !== "god" && next !== "christ" && next !== "the") continue;
    return true;
  }
  return false;
}

function placeEndingExcluded(significant: string[], row: TopNameRow): boolean {
  if (!significant.length || !PLACE_ENDINGS.has(significant[significant.length - 1])) return false;
  if (recordedChurch(row)) return false;
  if (significant.length >= 3 && significant.slice(-3).join(" ") === "in the fields") return false;
  if (significant[significant.length - 1] === "park" && significant.includes("of")) {
    const ofAt = significant.lastIndexOf("of");
    const town = significant.slice(ofAt + 1, -1);
    const before = significant.slice(0, ofAt);
    if (town.length > 0 && before.some((word) => word === "church" || word === "churches" || word === "chapel")) return false;
  }
  if (significant.length >= 2 && FACILITY_BEFORE_PLACE.has(significant[significant.length - 2])) return true;
  if (!significant.slice(0, -1).some((word) => WORSHIP_WORDS.has(word))) return true;
  return false;
}

function agencyNameExcluded(raw: string, words: string[], row: TopNameRow): boolean {
  if (/\bbroadcasting\b/.test(raw)) return true;
  if (/\bemmaus\b/.test(raw) && !christianNameWord(words)) return true;
  if (/\bstate\s+council\b/.test(raw)) return true;
  if (/\bfor\s+worldwide\b/.test(raw)) return true;
  if (/\bto\s+the\s+nations\b/.test(raw) && !x21(row)) return true;
  return false;
}

function bodyNameExcluded(words: string[], row: TopNameRow): boolean {
  if (!words.length) return false;
  const body = words[0] === "the" ? words.slice(1) : words;
  if (!body.length) return false;
  const started = body[0];
  if (NONCHRISTIAN_START_WORDS.has(started)) return true;
  const marker = christianMarker(row, words);
  if (started === "beth" && !marker) return true;
  if (words.some((word) => JEWISH_BODY_WORDS.has(word)) && !marker) return true;
  if (started === "congregation" && !marker) return true;
  return false;
}

function cemeteryNameExcluded(name: string, row: TopNameRow): boolean {
  const words = withoutLegalSuffix(nameWords(name));
  if (!words.length || !words.some((word) => CEMETERY_WORDS.has(word))) return false;
  if (CONGREGATION_ENDINGS.has(words[words.length - 1])) return false;
  if (recordedChurch(row)) return false;
  return true;
}

/**
 * Non-church names for Top prospects. A stored denomination or NTEE X2 keeps a
 * place name, a cemetery, or a Temple congregation with no non-Christian marker.
 * It does not keep a fund, a school, a camp, a retreat, a diocese, or another body.
 */
export function topNameExcluded(name: string, row: TopNameRow = null): boolean {
  const raw = folded(name);
  if (idStarts(row, EXPLICIT_DROP_ID_PREFIXES)) return true;
  if (idStarts(row, EXPLICIT_KEEP_ID_PREFIXES)) return false;
  if (nteeNonchristianFamily(row) && !x30WorshipSaved(raw, row)) return true;
  if (fundNameExcluded(raw)) return true;
  const compact = raw.replace(/[^a-z]/g, "");
  if (compact.includes("kingdomhall")) return true;
  if (/\bjehovah'?s?\s+witness/.test(raw)) return true;
  if (/\bkingdom\s+kids\b/.test(raw)) return true;
  const street = raw.replace(/\bmosque\s+street\b/g, " ").replace(/\bold\s+school\b/g, " ");
  const words = nameWords(street);
  const has = (word: string) => words.includes(word);
  const church = has("church") || has("churches");
  const christian = hasChurchWord(raw) || /\bold\s+school\b/.test(raw);
  if (agencyNameExcluded(raw, words, row)) return true;
  if (/\bcenters?\s+for\s+spiritual\s+living\b/.test(raw)) return true;
  if (bodyNameExcluded(words, row)) return true;
  if (words.some((word) => ALWAYS_DROP.has(word))) return true;
  if (has("synod") && !church) return true;
  if (/\bb['’]?nai\b/.test(raw)) return true;
  if (/\blatter\s*-?\s*day\b/.test(raw) || compact.includes("latterday")) {
    if (!(has("deliverance") && x20OrX21(row))) return true;
  }
  if (/\b\d+(st|nd|rd|th)\s+ward\b/.test(street) || (has("ward") && !christian)) return true;
  if (/\bstake\s+center\b/.test(raw)) return true;
  if (/\bbeth\s+israel\b/.test(raw) || /\btemple\s+beth\b/.test(raw)) return true;
  if (/\bchristian\s+science\b/.test(raw) || /\bbaha['’]?is?\b/.test(raw)) return true;
  if (has("congregation") && has("israel")) return true;
  if (/\bchildrens?\s+homes?\b/.test(raw.replace(/['’]/g, ""))) return true;
  if (has("temple") && nonChristianTemple(raw)) return true;
  if (/\bmission\s+inc\b/.test(raw)) {
    if (!x20OrX21(row) && !(has("temple") && templeNamesTheCongregation(raw) && christianRecorded(row))) return true;
  }
  const significant = words.filter((word) => !NAME_DROP.has(word));
  if (placeEndingExcluded(significant, row)) return true;
  if (cemeteryNameExcluded(raw, row)) return true;
  if (!church && !recordedChurch(row) && (has("fields") || /\bsoccer\s+fields\b/.test(raw))) return true;
  if (!church && (has("district") || has("retreat") || has("messianic"))) return true;
  const endsChurch = significant.length > 0 && significant[significant.length - 1] === "church";
  if (has("association") && !endsChurch) return true;
  if (/\bchristian\s+(academy|schools?)\b/.test(street) && !church) return true;
  if (["academy", "school", "schools", "campus"].some(has) && !church) return true;
  if (/\bcollege\s+ministr(?:y|ies)\b/.test(raw)) return true;
  const last = significant[significant.length - 1];
  if (last === "mba" || last === "ba") return true;
  if (significant.length >= 2 && significant[significant.length - 2] === "community" && significant[significant.length - 1] === "center") return true;
  if (has("preschool") && !church) return true;
  if (/\bfood\s+(bank|pantry)\b/.test(raw) && !christian) return true;
  if (!christian && ["camp", "college", "university", "seminary"].some(has)) return true;
  if (has("temple") && !christian && !(christianRecorded(row) && templeNamesTheCongregation(raw))) return true;
  return false;
}

export const CATEGORIES = [
  "Car Maintenance", "Clothes", "Costco", "Eating Out", "Entertainment", "Gas", "Gifts",
  "Giving", "Groceries", "Healthcare", "Miscellaneous Needs", "Non-Essentials (Wants)"
];

// Own-account money movement; the matching card charges are imported instead.
const SKIP_DETAILED = new Set([
  "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT",
  "TRANSFER_OUT_ACCOUNT_TRANSFER",
  "TRANSFER_OUT_SAVINGS",
  "TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS"
]);

const CLOTHING = /\b(ross|tj ?maxx|tjx|marshalls|bealls?|kohl'?s|old navy|nordstrom|children'?s place|carter'?s|jc ?penney|burlington)\b/;
const MISC_STORES = /\b(hobby lobby|dollar tree|dollar general|family dollar|michaels|home depot|lowe'?s)\b/;
const DESSERT = /\b(cold ?stone|bahama buck'?s|baskin|ice ?cream|shaved ice|gelato|frozen yogurt)\b/;
const FUEL = /\b(gas|fuel)\b/;

export function merchantKey(name) {
  return String(name || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
}

export function shouldSkip(txn) {
  if (txn.pending || !(txn.amount > 0)) return true;
  const detailed = txn.personal_finance_category?.detailed || "";
  return SKIP_DETAILED.has(detailed) || detailed.startsWith("TRANSFER_IN") || detailed.startsWith("INCOME");
}

// Store names used 2+ times with one category at least 75% of the time.
export function buildHistoryRules(rows) {
  const byKey = new Map();
  for (const { Store, Category, n } of rows) {
    const key = merchantKey(Store);
    if (key.length < 4 || !CATEGORIES.includes(Category)) continue;
    const entry = byKey.get(key) || { total: 0, best: null, bestN: 0 };
    entry.total += n;
    if (n > entry.bestN) Object.assign(entry, { best: Category, bestN: n });
    byKey.set(key, entry);
  }
  const rules = [];
  for (const [key, { total, best, bestN }] of byKey) {
    if (total >= 2 && bestN / total >= 0.75) rules.push([key, best]);
  }
  return rules.sort((a, b) => b[0].length - a[0].length);
}

function fromPlaidCategory(pfc) {
  const detailed = pfc?.detailed || "";
  const primary = pfc?.primary || detailed;
  const confident = ["HIGH", "VERY_HIGH"].includes(pfc?.confidence_level);
  if (detailed === "FOOD_AND_DRINK_GROCERIES") return ["Groceries", !confident];
  if (primary.startsWith("FOOD_AND_DRINK")) return ["Eating Out", !confident];
  if (detailed === "TRANSPORTATION_GAS") return ["Gas", !confident];
  if (detailed === "GENERAL_SERVICES_AUTOMOTIVE") return ["Car Maintenance", true];
  if (primary.startsWith("MEDICAL")) return ["Healthcare", true];
  if (primary.startsWith("ENTERTAINMENT") || primary.startsWith("TRAVEL")) return ["Entertainment", true];
  if (detailed === "GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES") return ["Clothes", true];
  if (detailed === "GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES") return ["Gifts", true];
  if (detailed === "GOVERNMENT_AND_NON_PROFIT_DONATIONS") return ["Giving", true];
  return ["Miscellaneous Needs", true];
}

// Returns [category, needsReview].
export function categorize(txn, { learned, historyRules }) {
  const text = `${txn.merchant_name || ""} ${txn.name || ""}`.toLowerCase();
  const key = merchantKey(txn.merchant_name || txn.name);
  const isFuel = FUEL.test(text) || txn.personal_finance_category?.detailed === "TRANSPORTATION_GAS";

  if (/\b(walmart|wal-mart|wm supercenter)\b/.test(text)) {
    return /pharm/.test(text) ? ["Healthcare", false] : ["Groceries", true];
  }
  if (/\b(amazon|amzn)\b/.test(text)) return ["Miscellaneous Needs", true];
  if (/\btarget\b/.test(text)) return ["Miscellaneous Needs", true];
  if (/\bcostco\b/.test(text)) return [isFuel ? "Gas" : "Costco", false];
  if (/\bfry'?s\b/.test(text)) return [isFuel ? "Gas" : "Groceries", false];

  if (learned.has(key)) return [learned.get(key), false];

  if (DESSERT.test(text)) return ["Entertainment", false];
  if (CLOTHING.test(text)) return ["Clothes", false];
  if (MISC_STORES.test(text)) return ["Miscellaneous Needs", false];

  for (const [historyKey, category] of historyRules) {
    if (key === historyKey || key.startsWith(historyKey)) return [category, false];
  }
  return fromPlaidCategory(txn.personal_finance_category);
}

// Merchants that are always flagged, so corrections there shouldn't become rules.
export function isAlwaysReviewed(storeName) {
  const text = String(storeName || "").toLowerCase();
  return /\b(walmart|wal-mart|wm supercenter|amazon|amzn|target)\b/.test(text) && !/pharm/.test(text);
}

const FALLBACK = "Miscellaneous Needs";

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

// Drops words containing digits (Zelle/check reference numbers) so recurring payees share a key.
export function merchantKey(name) {
  const text = String(name || "").toLowerCase().normalize("NFKD");
  const key = text.split(/\s+/).filter((word) => !/\d/.test(word)).join("").replace(/[^a-z0-9]/g, "");
  return key.length >= 3 ? key : text.replace(/[^a-z0-9]/g, "");
}

export function shouldSkip(txn) {
  if (!(txn.amount > 0)) return true;
  const detailed = txn.personal_finance_category?.detailed || "";
  return SKIP_DETAILED.has(detailed) || detailed.startsWith("TRANSFER_IN") || detailed.startsWith("INCOME");
}

// Rule parts have fixed amounts except the last, which takes the remainder.
// Returns null when the payment is too small to cover the fixed parts.
export function applySplitRule(ruleParts, amount, activeNames) {
  if (!ruleParts?.length || ruleParts.some((p) => !activeNames.has(p.category))) return null;
  const fixed = ruleParts.slice(0, -1);
  const fixedCents = fixed.reduce((sum, p) => sum + Math.round(p.amount * 100), 0);
  const remainderCents = Math.round(amount * 100) - fixedCents;
  if (remainderCents <= 0) return null;
  return [
    ...fixed.map((p) => ({ category: p.category, amount: p.amount })),
    { category: ruleParts.at(-1).category, amount: remainderCents / 100 }
  ];
}

// Store names used 2+ times with one category at least 75% of the time.
export function buildHistoryRules(rows, activeNames) {
  const byKey = new Map();
  for (const { Store, Category, n } of rows) {
    const key = merchantKey(Store);
    if (key.length < 4 || !activeNames.has(Category)) continue;
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
  const primary = detailed || pfc?.primary || "";
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
export function categorize(txn, context) {
  const [category, needsReview] = pickCategory(txn, context);
  if (context.activeNames.has(category)) return [category, needsReview];
  const fallback = context.activeNames.has(FALLBACK) ? FALLBACK : [...context.activeNames][0];
  return [fallback, true];
}

// Category settings rows -> sorted [bankCategoryPrefix, categoryName] pairs.
export function buildPlaidMatches(categoryRows) {
  const pairs = [];
  for (const row of categoryRows) {
    if (!row.Active || !row.PlaidMatch) continue;
    for (const prefix of row.PlaidMatch.split(",")) {
      if (prefix.trim()) pairs.push([prefix.trim(), row.Name]);
    }
  }
  return pairs.sort((a, b) => b[0].length - a[0].length);
}

function pickCategory(txn, { learned, historyRules, plaidMatches }) {
  const text = `${txn.merchant_name || ""} ${txn.name || ""}`.toLowerCase();
  const key = merchantKey(txn.merchant_name || txn.name);
  const detailed = txn.personal_finance_category?.detailed || "";
  const isFuel = FUEL.test(text) || detailed === "TRANSPORTATION_GAS";

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

  const plaidMatch = plaidMatches.find(([prefix]) => detailed.startsWith(prefix));
  if (plaidMatch) return [plaidMatch[1], false];

  for (const [historyKey, category] of historyRules) {
    if (key === historyKey || key.startsWith(historyKey)) return [category, false];
  }
  return fromPlaidCategory(txn.personal_finance_category);
}

// Merchants that are always flagged, so corrections there shouldn't become rules.
export function isAlwaysReviewed(storeName) {
  const text = String(storeName || "").toLowerCase();
  return (/\b(walmart|wal-mart|wm supercenter|amazon|amzn|target)\b/.test(text) && !/pharm/.test(text)) || /^check\b/.test(text);
}

import { shouldSkip } from "./categorize.js";
import { decryptToken, localIsoDate, plaid } from "./plaid.js";

// Candidate categories for spending the original budget didn't track, keyed by bank category prefixes.
const CANDIDATES = [
  { name: "Mortgage & Rent", match: ["LOAN_PAYMENTS_MORTGAGE_PAYMENT", "RENT_AND_UTILITIES_RENT"] },
  { name: "Utilities", match: ["RENT_AND_UTILITIES_GAS_AND_ELECTRICITY", "RENT_AND_UTILITIES_WATER", "RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT", "RENT_AND_UTILITIES_OTHER_UTILITIES"] },
  { name: "Phone & Internet", match: ["RENT_AND_UTILITIES_TELEPHONE", "RENT_AND_UTILITIES_INTERNET_AND_CABLE"] },
  { name: "Insurance", match: ["GENERAL_SERVICES_INSURANCE"] },
  { name: "Car Payment", match: ["LOAN_PAYMENTS_CAR_PAYMENT"] },
  { name: "Other Loan Payments", match: ["LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT", "LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT", "LOAN_PAYMENTS_BNPL", "LOAN_PAYMENTS_OTHER_PAYMENT"] },
  { name: "Subscriptions & Streaming", match: ["ENTERTAINMENT_TV_AND_MOVIES", "ENTERTAINMENT_MUSIC_AND_AUDIO"] },
  { name: "Childcare & School", match: ["GENERAL_SERVICES_CHILDCARE", "GENERAL_SERVICES_EDUCATION"] },
  { name: "Personal Care", match: ["PERSONAL_CARE"] },
  { name: "Home & Garden", match: ["HOME_IMPROVEMENT"] },
  { name: "Pets", match: ["MEDICAL_VETERINARY_SERVICES", "GENERAL_MERCHANDISE_PET_SUPPLIES"] },
  { name: "Travel", match: ["TRAVEL"] },
  { name: "Transfers to People", match: ["TRANSFER_OUT_TRANSFER_OUT_FROM_APPS", "TRANSFER_OUT_OTHER_TRANSFER_OUT", "TRANSFER_OUT_WITHDRAWAL"] },
  { name: "Taxes & Fees", match: ["GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT", "GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES", "BANK_FEES"] }
];

function isoDaysAgo(days) {
  return localIsoDate(new Date(Date.now() - days * 86400000));
}

export async function buildSuggestions(env) {
  const [{ results: items }, { results: categories }, { results: missing }] = await env.DB.batch([
    env.DB.prepare("SELECT ItemId, InstitutionName, AccessToken FROM PlaidItems"),
    env.DB.prepare("SELECT Name FROM Categories"),
    env.DB.prepare("SELECT PlaidTransactionId FROM Expenses WHERE Source = 'plaid' AND PlaidCategory IS NULL")
  ]);
  const existing = new Set(categories.map((c) => c.Name.toLowerCase()));
  const needsBackfill = new Set(missing.map((r) => r.PlaidTransactionId));
  const groups = CANDIDATES.map((c) => ({ ...c, total: 0, merchants: new Map() }));
  const endDate = localIsoDate();
  let earliest = endDate;
  const skippedInstitutions = [];
  const backfill = [];

  for (const item of items) {
    try {
      const accessToken = await decryptToken(env, item.ItemId, item.AccessToken);
      let offset = 0;
      let totalCount = Infinity;
      while (offset < totalCount) {
        const page = await plaid(env, "/transactions/get", {
          access_token: accessToken,
          start_date: isoDaysAgo(90),
          end_date: endDate,
          options: { count: 500, offset }
        });
        totalCount = page.total_transactions;
        offset += page.transactions.length;
        if (page.transactions.length === 0) break;

        for (const txn of page.transactions) {
          const detailed = txn.personal_finance_category?.detailed;
          if (!detailed) continue;
          if (needsBackfill.has(txn.transaction_id)) backfill.push([detailed, txn.transaction_id]);
          if (shouldSkip(txn)) continue;
          const date = txn.authorized_date || txn.date;
          if (date < earliest) earliest = date;
          const group = groups.find((g) => g.match.some((prefix) => detailed.startsWith(prefix)));
          if (!group) continue;
          const merchant = txn.merchant_name || txn.name;
          group.total += txn.amount;
          group.merchants.set(merchant, (group.merchants.get(merchant) || 0) + txn.amount);
        }
      }
    } catch (err) {
      console.error("suggestions skipped item", item.ItemId, err.code || err.message);
      skippedInstitutions.push(item.InstitutionName);
    }
  }

  if (backfill.length) {
    await env.DB.batch(backfill.map(([detailed, id]) =>
      env.DB.prepare("UPDATE Expenses SET PlaidCategory = ? WHERE PlaidTransactionId = ?").bind(detailed, id)
    ));
  }

  const days = Math.max(28, Math.round((Date.parse(endDate) - Date.parse(earliest)) / 86400000) + 1);
  const suggestions = groups
    .filter((g) => g.total > 0 && !existing.has(g.name.toLowerCase()))
    .map((g) => ({
      name: g.name,
      plaidMatch: g.match.join(","),
      monthly: Math.ceil((g.total / days) * 30.44 / 5) * 5,
      total: Math.round(g.total * 100) / 100,
      merchants: [...g.merchants]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([name, total]) => ({ name, total: Math.round(total * 100) / 100 }))
    }))
    .sort((a, b) => b.monthly - a.monthly);

  return { days, suggestions, skippedInstitutions };
}

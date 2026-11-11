import { buildHistoryRules, buildPlaidMatches, categorize, shouldSkip } from "./categorize.js";

const SYNCABLE_TYPES = new Set(["depository", "credit"]);
const TIME_ZONE = "America/Phoenix";

export class PlaidError extends Error {
  constructor(code, type) {
    super(code || "PLAID_ERROR");
    this.code = code;
    this.type = type;
  }
}

export async function plaid(env, path, body) {
  const host = env.PLAID_ENV === "production" ? "production" : "sandbox";
  const res = await fetch(`https://${host}.plaid.com${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "PLAID-CLIENT-ID": env.PLAID_CLIENT_ID,
      "PLAID-SECRET": env.PLAID_SECRET
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new PlaidError(data.error_code, data.error_type);
  return data;
}

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

async function tokenKey(env) {
  const raw = unb64(env.PLAID_TOKEN_KEY || "");
  if (raw.length !== 32) throw new Error("PLAID_TOKEN_KEY must be a base64-encoded 32-byte key");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

// Item id is bound as additional data so a token can't be swapped onto another row.
async function encryptToken(env, itemId, token) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(itemId) },
    await tokenKey(env),
    new TextEncoder().encode(token)
  );
  return `${b64(iv)}.${b64(cipher)}`;
}

export async function decryptToken(env, itemId, stored) {
  const [iv, cipher] = stored.split(".");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(iv), additionalData: new TextEncoder().encode(itemId) },
    await tokenKey(env),
    unb64(cipher)
  );
  return new TextDecoder().decode(plain);
}

export function localIsoDate(date = new Date()) {
  return date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

function toStoredDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function parseStoredDate(value) {
  const [m, d, y] = String(value).split("/").map(Number);
  return Number.isFinite(y) ? Date.UTC(y, m - 1, d) : NaN;
}

export async function createLinkToken(env, itemId) {
  const body = {
    client_name: "Household Budget",
    language: "en",
    country_codes: ["US"],
    user: { client_user_id: "household" }
  };
  if (env.PLAID_REDIRECT_URI) body.redirect_uri = env.PLAID_REDIRECT_URI;
  if (itemId) {
    const item = await env.DB.prepare("SELECT AccessToken FROM PlaidItems WHERE ItemId = ?").bind(itemId).first();
    if (!item) return null;
    body.access_token = await decryptToken(env, itemId, item.AccessToken);
  } else {
    body.products = ["transactions"];
    body.transactions = { days_requested: 30 };
    body.account_filters = {
      depository: { account_subtypes: ["checking", "savings"] },
      credit: { account_subtypes: ["credit card"] }
    };
  }
  const { link_token } = await plaid(env, "/link/token/create", body);
  return link_token;
}

export async function exchangePublicToken(env, publicToken, institutionName) {
  const { access_token, item_id } = await plaid(env, "/item/public_token/exchange", { public_token: publicToken });
  const { accounts } = await plaid(env, "/accounts/get", { access_token });
  const today = localIsoDate();
  const importFrom = `${today.slice(0, 8)}01`;
  const statements = [
    env.DB.prepare(
      "INSERT INTO PlaidItems (ItemId, InstitutionName, AccessToken, Status, ImportFrom) VALUES (?, ?, ?, 'ok', ?)"
    ).bind(item_id, institutionName, await encryptToken(env, item_id, access_token), importFrom),
    ...accounts.filter((a) => SYNCABLE_TYPES.has(a.type)).map((a) =>
      env.DB.prepare(
        "INSERT OR REPLACE INTO PlaidAccounts (AccountId, ItemId, Name, Mask, Type, Subtype) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(a.account_id, item_id, a.name, a.mask, a.type, a.subtype)
    )
  ];
  await env.DB.batch(statements);
  return item_id;
}

export async function removeItem(env, itemId) {
  const item = await env.DB.prepare("SELECT AccessToken FROM PlaidItems WHERE ItemId = ?").bind(itemId).first();
  if (!item) return false;
  await plaid(env, "/item/remove", { access_token: await decryptToken(env, itemId, item.AccessToken) });
  await env.DB.batch([
    env.DB.prepare("DELETE FROM PlaidAccounts WHERE ItemId = ?").bind(itemId),
    env.DB.prepare("DELETE FROM PlaidItems WHERE ItemId = ?").bind(itemId)
  ]);
  return true;
}

export async function listItems(env) {
  const [{ results: items }, { results: accounts }] = await env.DB.batch([
    env.DB.prepare("SELECT ItemId, InstitutionName, Status, ImportFrom, LastSyncedAt FROM PlaidItems ORDER BY CreatedAt"),
    env.DB.prepare("SELECT AccountId, ItemId, Name, Mask, Subtype FROM PlaidAccounts")
  ]);
  return items.map((item) => ({ ...item, Accounts: accounts.filter((a) => a.ItemId === item.ItemId) }));
}

async function fetchUpdates(accessToken, env, startCursor) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const updates = { added: [], modified: [], removed: [], cursor: startCursor };
    try {
      let hasMore = true;
      while (hasMore) {
        const page = await plaid(env, "/transactions/sync", {
          access_token: accessToken,
          count: 250,
          ...(updates.cursor ? { cursor: updates.cursor } : {})
        });
        updates.added.push(...page.added);
        updates.modified.push(...page.modified);
        updates.removed.push(...page.removed);
        updates.cursor = page.next_cursor;
        hasMore = page.has_more;
      }
      return updates;
    } catch (err) {
      if (err.code !== "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION") throw err;
    }
  }
  throw new PlaidError("TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION");
}

export async function syncItem(env, item) {
  let accessToken;
  let updates;
  try {
    accessToken = await decryptToken(env, item.ItemId, item.AccessToken);
    updates = await fetchUpdates(accessToken, env, item.Cursor);
  } catch (err) {
    if (err instanceof PlaidError && err.type === "ITEM_ERROR") {
      await env.DB.prepare("UPDATE PlaidItems SET Status = 'login_required' WHERE ItemId = ?").bind(item.ItemId).run();
      return { itemId: item.ItemId, status: "login_required" };
    }
    throw err;
  }

  const statements = [];
  for (const { transaction_id } of updates.removed) {
    statements.push(env.DB.prepare("DELETE FROM Expenses WHERE PlaidTransactionId = ? AND Source = 'plaid'").bind(transaction_id));
  }
  for (const txn of updates.modified) {
    if (shouldSkip(txn)) continue;
    statements.push(env.DB.prepare(
      "UPDATE Expenses SET Amount = ?, Date = ? WHERE PlaidTransactionId = ?"
    ).bind(Number(txn.amount.toFixed(2)), toStoredDate(txn.authorized_date || txn.date), txn.transaction_id));
  }

  let added = 0;
  if (updates.added.length) {
    const [{ results: accountRows }, { results: ruleRows }, { results: historyRows }, { results: manualRows }, { results: categoryRows }] = await env.DB.batch([
      env.DB.prepare("SELECT AccountId, Name, Mask FROM PlaidAccounts WHERE ItemId = ?").bind(item.ItemId),
      env.DB.prepare("SELECT MerchantKey, Category FROM CategoryRules"),
      env.DB.prepare(
        "SELECT TRIM(Store) AS Store, Category, COUNT(*) AS n FROM Expenses WHERE Source IS NULL OR Source = 'manual' GROUP BY LOWER(TRIM(Store)), Category"
      ),
      env.DB.prepare(
        `SELECT Id, Date, CAST(Amount AS REAL) AS Amount FROM Expenses
         WHERE (Source IS NULL OR Source = 'manual') AND substr(Date, -4, 4) >= ?
           AND Id NOT IN (SELECT DuplicateOf FROM Expenses WHERE DuplicateOf IS NOT NULL)`
      ).bind(item.ImportFrom.slice(0, 4)),
      env.DB.prepare("SELECT Name, Active, PlaidMatch FROM Categories")
    ]);
    const accounts = new Map(accountRows.map((a) => [a.AccountId, a]));
    const activeNames = new Set(categoryRows.filter((c) => c.Active).map((c) => c.Name));
    const context = {
      learned: new Map(ruleRows.map((r) => [r.MerchantKey, r.Category])),
      historyRules: buildHistoryRules(historyRows, activeNames),
      plaidMatches: buildPlaidMatches(categoryRows),
      activeNames
    };
    const usedManual = new Set();

    for (const txn of updates.added) {
      const account = accounts.get(txn.account_id);
      const isoDate = txn.authorized_date || txn.date;
      if (!account || shouldSkip(txn) || isoDate < item.ImportFrom) continue;

      const amount = Number(txn.amount.toFixed(2));
      const store = txn.merchant_name || txn.name;
      let [category, needsReview] = categorize(txn, context);
      const txnTime = Date.parse(isoDate);
      const duplicate = manualRows.find((row) =>
        !usedManual.has(row.Id) &&
        Math.abs(row.Amount - amount) < 0.005 &&
        Math.abs(parseStoredDate(row.Date) - txnTime) <= 3 * 86400000
      );
      if (duplicate) {
        usedManual.add(duplicate.Id);
        needsReview = true;
      }
      statements.push(env.DB.prepare(
        `INSERT OR IGNORE INTO Expenses (Date, Amount, Store, Items, Category, Source, PlaidTransactionId, AccountId, NeedsReview, DuplicateOf, PlaidCategory)
         VALUES (?, ?, ?, ?, ?, 'plaid', ?, ?, ?, ?, ?)`
      ).bind(
        toStoredDate(isoDate), amount, store, `${account.Name}${account.Mask ? ` ••${account.Mask}` : ""}`,
        category, txn.transaction_id, txn.account_id, needsReview ? 1 : 0, duplicate?.Id ?? null,
        txn.personal_finance_category?.detailed ?? null
      ));
      added++;
    }
  }

  statements.push(env.DB.prepare(
    "UPDATE PlaidItems SET Cursor = ?, Status = 'ok', LastSyncedAt = datetime('now') WHERE ItemId = ?"
  ).bind(updates.cursor, item.ItemId));
  await env.DB.batch(statements);
  return { itemId: item.ItemId, status: "ok", added, removed: updates.removed.length };
}

export async function syncAll(env) {
  const { results: items } = await env.DB.prepare("SELECT * FROM PlaidItems").all();
  const outcomes = [];
  for (const item of items) {
    try {
      outcomes.push(await syncItem(env, item));
    } catch (err) {
      console.error("sync failed", item.ItemId, err.code || err.message);
      outcomes.push({ itemId: item.ItemId, status: "error" });
    }
  }
  return outcomes;
}

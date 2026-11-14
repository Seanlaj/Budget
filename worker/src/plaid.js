import { applySplitRule, buildHistoryRules, buildPlaidMatches, categorize, merchantKey, shouldSkip } from "./categorize.js";

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
    env.DB.prepare("SELECT ItemId, InstitutionName, Status, ImportFrom, LastSyncedAt, AccessToken FROM PlaidItems ORDER BY CreatedAt"),
    env.DB.prepare("SELECT AccountId, ItemId, Name, Mask, Subtype FROM PlaidAccounts")
  ]);
  return Promise.all(items.map(async ({ AccessToken, ...item }) => {
    // When Plaid itself last pulled new transactions from the bank, which bounds how fresh syncs can be.
    let BankUpdatedAt = null;
    try {
      const info = await plaid(env, "/item/get", { access_token: await decryptToken(env, item.ItemId, AccessToken) });
      BankUpdatedAt = info.status?.transactions?.last_successful_update ?? null;
    } catch (err) {
      console.error("item/get failed", item.ItemId, err.code || err.message);
    }
    return { ...item, BankUpdatedAt, Accounts: accounts.filter((a) => a.ItemId === item.ItemId) };
  }));
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
  // A posted transaction replaces its pending version; the pending row is converted in place below.
  const replacedPending = new Set(updates.added.map((t) => t.pending_transaction_id).filter(Boolean));
  for (const { transaction_id } of updates.removed) {
    if (replacedPending.has(transaction_id)) continue;
    statements.push(
      env.DB.prepare("DELETE FROM Expenses WHERE SplitOf IN (SELECT Id FROM Expenses WHERE PlaidTransactionId = ?)").bind(transaction_id),
      env.DB.prepare("DELETE FROM Expenses WHERE PlaidTransactionId = ? AND Source = 'plaid'").bind(transaction_id)
    );
  }
  for (const txn of updates.modified) {
    if (shouldSkip(txn)) continue;
    statements.push(env.DB.prepare(
      `UPDATE Expenses SET Amount = ?, Date = ?, Pending = ? WHERE PlaidTransactionId = ?
       AND Id NOT IN (SELECT SplitOf FROM Expenses WHERE SplitOf IS NOT NULL)`
    ).bind(Number(txn.amount.toFixed(2)), toStoredDate(txn.authorized_date || txn.date), txn.pending ? 1 : 0, txn.transaction_id));
  }

  let added = 0;
  if (updates.added.length) {
    const [{ results: accountRows }, { results: ruleRows }, { results: historyRows }, { results: manualRows }, { results: categoryRows }, { results: splitRows }, { results: pendingRows }] = await env.DB.batch([
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
      env.DB.prepare("SELECT Name, Active, PlaidMatch FROM Categories"),
      env.DB.prepare("SELECT MerchantKey, Parts FROM SplitRules"),
      env.DB.prepare(
        `SELECT e.Id, e.PlaidTransactionId, EXISTS (SELECT 1 FROM Expenses c WHERE c.SplitOf = e.Id) AS HasParts
         FROM Expenses e WHERE e.PlaidTransactionId IN (SELECT value FROM json_each(?))`
      ).bind(JSON.stringify([...replacedPending]))
    ]);
    const pendingRowsById = new Map(pendingRows.map((r) => [r.PlaidTransactionId, r]));
    const splitRules = new Map(splitRows.map((r) => [r.MerchantKey, JSON.parse(r.Parts)]));
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
      if (!account || shouldSkip(txn) || isoDate < item.ImportFrom) {
        if (txn.pending_transaction_id) {
          statements.push(
            env.DB.prepare("DELETE FROM Expenses WHERE SplitOf IN (SELECT Id FROM Expenses WHERE PlaidTransactionId = ?)").bind(txn.pending_transaction_id),
            env.DB.prepare("DELETE FROM Expenses WHERE PlaidTransactionId = ? AND Source = 'plaid'").bind(txn.pending_transaction_id)
          );
        }
        continue;
      }

      const amount = Number(txn.amount.toFixed(2));
      const store = txn.merchant_name || txn.name;

      // Keeps the category, review state and split parts already set on the pending version.
      const pendingRow = txn.pending_transaction_id && pendingRowsById.get(txn.pending_transaction_id);
      if (pendingRow) {
        statements.push(
          env.DB.prepare(
            `UPDATE Expenses SET PlaidTransactionId = ?, Date = ?, Pending = ?, Store = ?,
               Amount = CASE WHEN ? THEN Amount ELSE ? END WHERE Id = ?`
          ).bind(txn.transaction_id, toStoredDate(isoDate), txn.pending ? 1 : 0, store, pendingRow.HasParts, amount, pendingRow.Id),
          env.DB.prepare(
            "UPDATE Expenses SET PlaidTransactionId = ?1 || substr(PlaidTransactionId, ?2), Pending = ?3, Date = ?4 WHERE SplitOf = ?5"
          ).bind(txn.transaction_id, txn.pending_transaction_id.length + 1, txn.pending ? 1 : 0, toStoredDate(isoDate), pendingRow.Id)
        );
        continue;
      }

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
      const parts = duplicate ? null : applySplitRule(splitRules.get(merchantKey(store)), amount, activeNames);
      if (parts) [category, needsReview] = [parts[0].category, false];
      const items = `${account.Name}${account.Mask ? ` ••${account.Mask}` : ""}`;
      const plaidCategory = txn.personal_finance_category?.detailed ?? null;
      statements.push(env.DB.prepare(
        `INSERT OR IGNORE INTO Expenses (Date, Amount, Store, Items, Category, Source, PlaidTransactionId, AccountId, NeedsReview, DuplicateOf, PlaidCategory, Pending)
         VALUES (?, ?, ?, ?, ?, 'plaid', ?, ?, ?, ?, ?, ?)`
      ).bind(
        toStoredDate(isoDate), parts ? parts[0].amount : amount, store, items,
        category, txn.transaction_id, txn.account_id, needsReview ? 1 : 0, duplicate?.Id ?? null, plaidCategory, txn.pending ? 1 : 0
      ));
      for (const [i, part] of (parts?.slice(1) ?? []).entries()) {
        statements.push(env.DB.prepare(
          `INSERT OR IGNORE INTO Expenses (Date, Amount, Store, Items, Category, Source, PlaidTransactionId, AccountId, NeedsReview, PlaidCategory, SplitOf, Pending)
           VALUES (?, ?, ?, ?, ?, 'plaid', ?, ?, 0, ?, (SELECT Id FROM Expenses WHERE PlaidTransactionId = ?), ?)`
        ).bind(
          toStoredDate(isoDate), part.amount, store, items, part.category, `${txn.transaction_id}#${i + 1}`,
          txn.account_id, plaidCategory, txn.transaction_id, txn.pending ? 1 : 0
        ));
      }
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

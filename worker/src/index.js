import { createRemoteJWKSet, jwtVerify } from "jose";
import { isAlwaysReviewed, merchantKey } from "./categorize.js";
import { createLinkToken, exchangePublicToken, listItems, PlaidError, removeItem, syncAll } from "./plaid.js";
import { buildSuggestions } from "./suggest.js";

let jwks;
const ITEM_ID = /^[A-Za-z0-9_-]{10,100}$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    if (!(await isAuthorized(request, env))) return json({ error: "Forbidden" }, 403);

    // Blocks cross-site form posts riding on the Access cookie.
    if (request.method === "POST" && request.headers.get("Origin") !== url.origin) {
      return json({ error: "Forbidden" }, 403);
    }

    try {
      const { pathname, searchParams } = url;
      if (pathname === "/api/expensebydate" && request.method === "GET")
        return await GetExpenseByDate(searchParams, env);
      if (pathname === "/api/create" && request.method === "POST")
        return await CreateNew(request, env);
      if (pathname === "/api/delete" && request.method === "POST")
        return await DeleteExpense(searchParams, env);
      if (pathname === "/api/getallexpenses" && request.method === "GET")
        return await GetAllExpenses(env);
      if (pathname === "/api/spendingcategory" && request.method === "POST")
        return await GetExpensesByCategory(request, env);
      if (pathname === "/api/expense/review" && request.method === "POST")
        return await ReviewExpense(request, env);
      if (pathname === "/api/expense/split" && request.method === "POST")
        return await SplitExpense(request, env);
      if (pathname === "/api/categories" && request.method === "GET")
        return await ListCategories(env);
      if (pathname === "/api/admin/category" && request.method === "POST")
        return await SaveCategory(request, env);
      if (pathname === "/api/admin/suggestions" && request.method === "GET")
        return json(await buildSuggestions(env));
      if (pathname === "/api/plaid/items" && request.method === "GET")
        return json(await listItems(env));
      if (pathname === "/api/plaid/link-token" && request.method === "POST")
        return await LinkToken(request, env);
      if (pathname === "/api/plaid/exchange" && request.method === "POST")
        return await Exchange(request, env, ctx);
      if (pathname === "/api/plaid/sync" && request.method === "POST")
        return json(await syncAll(env));
      if (pathname === "/api/plaid/remove" && request.method === "POST")
        return await RemoveItem(request, env);
      return json({ error: "Not found" }, 404);
    } catch (err) {
      if (err instanceof PlaidError) {
        console.error("plaid error", err.code);
        return json({ error: "The bank connection service returned an error.", code: err.code }, 502);
      }
      console.error(err);
      return json({ error: "Server error" }, 500);
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(syncAll(env));
  }
};

async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

async function LinkToken(request, env) {
  const { itemId } = await readJson(request);
  if (itemId !== undefined && !ITEM_ID.test(itemId)) return json({ error: "Invalid item" }, 400);
  const linkToken = await createLinkToken(env, itemId);
  return linkToken ? json({ linkToken }) : json({ error: "Not found" }, 404);
}

async function Exchange(request, env, ctx) {
  const { publicToken, institutionName } = await readJson(request);
  if (typeof publicToken !== "string" || !publicToken.startsWith("public-") || publicToken.length > 200) {
    return json({ error: "Invalid token" }, 400);
  }
  const name = typeof institutionName === "string" ? institutionName.slice(0, 100) : "Bank";
  const itemId = await exchangePublicToken(env, publicToken, name);
  ctx.waitUntil(syncAll(env));
  return json({ itemId });
}

async function RemoveItem(request, env) {
  const { itemId } = await readJson(request);
  if (!ITEM_ID.test(itemId)) return json({ error: "Invalid item" }, 400);
  return (await removeItem(env, itemId)) ? json({ removed: true }) : json({ error: "Not found" }, 404);
}

// Saving a category clears review flags and, for bank imports, teaches the merchant rule.
async function ReviewExpense(request, env) {
  const { id, category } = await readJson(request);
  if (!Number.isInteger(id) || id <= 0 || typeof category !== "string") return json({ error: "Invalid request" }, 400);
  const known = await env.DB.prepare("SELECT Name FROM Categories WHERE Name = ? AND Active = 1").bind(category).first();
  if (!known) return json({ error: "Invalid request" }, 400);
  const row = await env.DB.prepare(
    "SELECT Store, Source, SplitOf, EXISTS (SELECT 1 FROM Expenses WHERE SplitOf = ?1) AS HasParts FROM Expenses WHERE Id = ?1"
  ).bind(id).first();
  if (!row) return json({ error: "Not found" }, 404);
  const statements = [
    env.DB.prepare("UPDATE Expenses SET Category = ?, NeedsReview = 0, DuplicateOf = NULL WHERE Id = ?").bind(category, id)
  ];
  const key = merchantKey(row.Store);
  if (row.Source === "plaid" && key && !isAlwaysReviewed(row.Store) && row.SplitOf === null && !row.HasParts) {
    statements.push(env.DB.prepare(
      `INSERT INTO CategoryRules (MerchantKey, Category) VALUES (?, ?)
       ON CONFLICT(MerchantKey) DO UPDATE SET Category = excluded.Category, UpdatedAt = datetime('now')`
    ).bind(key, category));
  }
  await env.DB.batch(statements);
  return json({ ok: true });
}

// Splits one payment across categories. The original row keeps the first part; a single
// part merges an existing split back together. `remember` applies the split to future
// bank payments to the same payee, with the last part taking whatever is left.
async function SplitExpense(request, env) {
  const { id, parts, remember } = await readJson(request);
  if (!Number.isInteger(id) || id <= 0 || !Array.isArray(parts) || parts.length < 1 || parts.length > 6) {
    return json({ error: "Invalid request" }, 400);
  }
  const { results: active } = await env.DB.prepare("SELECT Name FROM Categories WHERE Active = 1").all();
  const activeNames = new Set(active.map((c) => c.Name));
  const clean = parts.map((p) => ({ category: p?.category, cents: Math.round(Number(p?.amount) * 100) }));
  if (clean.some((p) => !activeNames.has(p.category) || !Number.isSafeInteger(p.cents) || p.cents <= 0)) {
    return json({ error: "Each part needs a category and an amount above $0." }, 400);
  }

  let parent = await env.DB.prepare("SELECT * FROM Expenses WHERE Id = ?").bind(id).first();
  if (parent?.SplitOf) parent = await env.DB.prepare("SELECT * FROM Expenses WHERE Id = ?").bind(parent.SplitOf).first();
  if (!parent) return json({ error: "Not found" }, 404);
  const { total } = await env.DB.prepare(
    "SELECT COALESCE(SUM(ROUND(CAST(Amount AS REAL) * 100)), 0) AS total FROM Expenses WHERE SplitOf = ?"
  ).bind(parent.Id).first();
  const totalCents = Math.round(Number(parent.Amount) * 100) + total;
  if (clean.reduce((sum, p) => sum + p.cents, 0) !== totalCents) {
    return json({ error: `The parts must add up to $${(totalCents / 100).toFixed(2)}.` }, 400);
  }

  const statements = [
    env.DB.prepare("DELETE FROM Expenses WHERE SplitOf = ?").bind(parent.Id),
    env.DB.prepare("UPDATE Expenses SET Amount = ?, Category = ?, NeedsReview = 0, DuplicateOf = NULL WHERE Id = ?")
      .bind(clean[0].cents / 100, clean[0].category, parent.Id)
  ];
  clean.slice(1).forEach((part, i) => {
    statements.push(env.DB.prepare(
      `INSERT INTO Expenses (Date, Amount, Store, Items, Category, Source, PlaidTransactionId, AccountId, NeedsReview, PlaidCategory, SplitOf)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).bind(
      parent.Date, part.cents / 100, parent.Store, parent.Items, part.category, parent.Source ?? "manual",
      parent.PlaidTransactionId ? `${parent.PlaidTransactionId}#${i + 1}` : null,
      parent.AccountId ?? null, parent.PlaidCategory ?? null, parent.Id
    ));
  });
  const key = merchantKey(parent.Store);
  if (remember && parent.Source === "plaid" && key) {
    if (clean.length > 1) {
      const rule = clean.map((p, i) => ({ category: p.category, amount: i < clean.length - 1 ? p.cents / 100 : null }));
      statements.push(env.DB.prepare(
        `INSERT INTO SplitRules (MerchantKey, Parts) VALUES (?, ?)
         ON CONFLICT(MerchantKey) DO UPDATE SET Parts = excluded.Parts, UpdatedAt = datetime('now')`
      ).bind(key, JSON.stringify(rule)));
    } else {
      statements.push(env.DB.prepare("DELETE FROM SplitRules WHERE MerchantKey = ?").bind(key));
    }
  }
  await env.DB.batch(statements);
  return json({ ok: true });
}

async function ListCategories(env) {
  const { results } = await env.DB.prepare(
    "SELECT Name, MonthlyBudget, Active, PlaidMatch FROM Categories ORDER BY SortOrder, Name"
  ).all();
  return json(results);
}

// Creates or updates a category; renames carry existing expenses and learned rules along.
async function SaveCategory(request, env) {
  const { originalName, name, monthlyBudget, active, plaidMatch, applyToImported } = await readJson(request);
  const cleanName = typeof name === "string" ? name.trim() : "";
  const budget = Number(monthlyBudget);
  if (!cleanName || cleanName.length > 40 || !Number.isFinite(budget) || budget < 0 || budget > 1000000) {
    return json({ error: "Enter a name (up to 40 characters) and an allowance of $0 or more." }, 400);
  }
  if (plaidMatch !== undefined && (typeof plaidMatch !== "string" || !/^[A-Z_,]{0,1000}$/.test(plaidMatch))) {
    return json({ error: "Invalid request" }, 400);
  }
  const activeFlag = active === false ? 0 : 1;
  const clash = await env.DB.prepare("SELECT Name FROM Categories WHERE lower(Name) = lower(?)").bind(cleanName).first();
  const statements = [];

  if (typeof originalName === "string") {
    const current = await env.DB.prepare("SELECT Name FROM Categories WHERE Name = ?").bind(originalName).first();
    if (!current) return json({ error: "Not found" }, 404);
    if (clash && clash.Name !== originalName) return json({ error: "A category with that name already exists." }, 409);
    statements.push(env.DB.prepare("UPDATE Categories SET Name = ?, MonthlyBudget = ?, Active = ? WHERE Name = ?")
      .bind(cleanName, budget, activeFlag, originalName));
    if (cleanName !== originalName) {
      statements.push(
        env.DB.prepare("UPDATE Expenses SET Category = ? WHERE Category = ?").bind(cleanName, originalName),
        env.DB.prepare("UPDATE CategoryRules SET Category = ? WHERE Category = ?").bind(cleanName, originalName)
      );
    }
  } else {
    if (clash) return json({ error: "A category with that name already exists." }, 409);
    statements.push(env.DB.prepare(
      `INSERT INTO Categories (Name, MonthlyBudget, SortOrder, Active, PlaidMatch)
       VALUES (?, ?, (SELECT COALESCE(MAX(SortOrder), 0) + 1 FROM Categories), ?, ?)`
    ).bind(cleanName, budget, activeFlag, plaidMatch || null));
    if (applyToImported && plaidMatch) {
      for (const prefix of plaidMatch.split(",").filter(Boolean)) {
        statements.push(env.DB.prepare(
          `UPDATE Expenses SET Category = ?, NeedsReview = 0
           WHERE Source = 'plaid' AND NeedsReview = 1 AND DuplicateOf IS NULL AND PlaidCategory LIKE ?`
        ).bind(cleanName, `${prefix}%`));
      }
    }
  }
  await env.DB.batch(statements);
  return json({ ok: true });
}

async function isAuthorized(request, env) {
  const { TEAM_DOMAIN, POLICY_AUD, ALLOWED_EMAILS } = env;
  if (!TEAM_DOMAIN || !POLICY_AUD || !ALLOWED_EMAILS) return false;
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return false;
  try {
    jwks ??= createRemoteJWKSet(new URL(`${TEAM_DOMAIN}/cdn-cgi/access/certs`));
    const { payload } = await jwtVerify(token, jwks, { issuer: TEAM_DOMAIN, audience: POLICY_AUD });
    const allowed = ALLOWED_EMAILS.split(",").map((e) => e.trim().toLowerCase());
    return typeof payload.email === "string" && allowed.includes(payload.email.toLowerCase());
  } catch {
    return false;
  }
}

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function GetAllExpenses(env) {
  const { results } = await env.DB.prepare("SELECT * FROM Expenses").all();
  return json(results);
}

async function GetExpensesByCategory(request, env) {
  const category = (await request.formData()).get("Category");
  const { results } = await env.DB.prepare(
    "SELECT * FROM Expenses WHERE Category = ?"
  ).bind(category).all();
  return json(results);
}

async function DeleteExpense(searchParams, env) {
  const id = Number(searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return json({ error: "Invalid id" }, 400);
  const { results } = await env.DB.prepare(
    "DELETE FROM Expenses WHERE Id = ?1 OR SplitOf = ?1"
  ).bind(id).all();
  return json(results);
}

async function GetExpenseByDate(searchParams, env) {
  const monthIndex = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11 || !Number.isInteger(year) || year < 2000 || year > 2100) {
    return json({ error: "Invalid month or year" }, 400);
  }
  // Frontend sends a 0-based month; dates are stored as MM/DD/YYYY strings.
  const month = String(monthIndex + 1).padStart(2, "0");
  const { results } = await env.DB.prepare(
    `SELECT * FROM Expenses
     WHERE substr(Date, 1, 2) = ?
       AND substr(Date, -4, 4) = ?`
  ).bind(month, String(year)).all();
  return json(results);
}

async function CreateNew(request, env) {
  let DateInput = "";
  let Amount = "";
  let Items = "";
  let Store = "";
  let Category = "";
  for (const [key, value] of (await request.formData()).entries()) {
    switch (key) {
      case "Date":
        DateInput = value.toString();
        break;
      case "Amount":
        Amount = value.toString();
        break;
      case "Store":
        Store = value.toString();
        break;
      case "Items":
        Items = value.toString();
        break;
      case "Category":
        Category = value.toString();
        break;
      default:
        break;
    }
  }
  const updatedDate = new Date(DateInput);
  const newDate = updatedDate.getMonth() >= 9
    ? updatedDate.toLocaleDateString()
    : `0${updatedDate.toLocaleDateString()}`;
  const { results } = await env.DB.prepare(
    "INSERT INTO Expenses (Date, Amount, Store, Items, Category, Source) VALUES (?, ?, ?, ?, ?, 'manual')"
  ).bind(newDate, Amount, Store, Items, Category).all();
  return json(results);
}

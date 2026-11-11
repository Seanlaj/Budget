import { createRemoteJWKSet, jwtVerify } from "jose";
import { CATEGORIES, isAlwaysReviewed, merchantKey } from "./categorize.js";
import { createLinkToken, exchangePublicToken, listItems, PlaidError, removeItem, syncAll } from "./plaid.js";

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
  if (!Number.isInteger(id) || id <= 0 || !CATEGORIES.includes(category)) return json({ error: "Invalid request" }, 400);
  const row = await env.DB.prepare("SELECT Store, Source FROM Expenses WHERE Id = ?").bind(id).first();
  if (!row) return json({ error: "Not found" }, 404);
  const statements = [
    env.DB.prepare("UPDATE Expenses SET Category = ?, NeedsReview = 0, DuplicateOf = NULL WHERE Id = ?").bind(category, id)
  ];
  const key = merchantKey(row.Store);
  if (row.Source === "plaid" && key && !isAlwaysReviewed(row.Store)) {
    statements.push(env.DB.prepare(
      `INSERT INTO CategoryRules (MerchantKey, Category) VALUES (?, ?)
       ON CONFLICT(MerchantKey) DO UPDATE SET Category = excluded.Category, UpdatedAt = datetime('now')`
    ).bind(key, category));
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
    "DELETE FROM Expenses WHERE Id = ?"
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

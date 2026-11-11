import { createRemoteJWKSet, jwtVerify } from "jose";

let jwks;

export default {
  async fetch(request, env) {
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
      return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: "Server error" }, 500);
    }
  }
};

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
    "INSERT INTO Expenses (Date, Amount, Store, Items, Category) VALUES (?, ?, ?, ?, ?)"
  ).bind(newDate, Amount, Store, Items, Category).all();
  return json(results);
}

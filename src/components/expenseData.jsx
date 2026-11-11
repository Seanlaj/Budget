const API_URL = ''

export async function getTableData(month, year) {
  if (!Number.isInteger(Number(month)) || !Number.isInteger(Number(year))) throw new Error('Unable to load expenses for an invalid date.')
  const response = await fetch(`${API_URL}/api/expensebydate?month=${month}&year=${year}`)
  if (!response.ok) throw new Error('Expenses could not be loaded. Please try again.')
  const expenses = await response.json()
  return Array.isArray(expenses) ? expenses : []
}

export async function createExpense(formData) {
  const response = await fetch(`${API_URL}/api/create`, { method: 'POST', body: formData })
  if (!response.ok) throw new Error('The expense could not be saved.')
}

export async function deleteExpense(id) {
  const response = await fetch(`${API_URL}/api/delete?id=${encodeURIComponent(id)}`, { method: 'POST' })
  if (!response.ok) throw new Error('The expense could not be deleted.')
}

async function postJson(path, body, errorMessage) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (!response.ok) throw new Error(errorMessage)
  return response.json()
}

export function reviewExpense(id, category) {
  return postJson('/api/expense/review', { id, category }, 'The category could not be saved.')
}

export async function getCategories() {
  const response = await fetch(`${API_URL}/api/categories`)
  if (!response.ok) throw new Error('Categories could not be loaded.')
  return response.json()
}

export async function saveCategory(category) {
  const response = await fetch(`${API_URL}/api/admin/category`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(category),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'The category could not be saved.')
  return body
}

export async function getSuggestions() {
  const response = await fetch(`${API_URL}/api/admin/suggestions`)
  if (!response.ok) throw new Error('Suggestions could not be loaded. Please try again.')
  return response.json()
}

export async function getConnections() {
  const response = await fetch(`${API_URL}/api/plaid/items`)
  if (!response.ok) throw new Error('Bank connections could not be loaded.')
  return response.json()
}

export async function createLinkToken(itemId) {
  const { linkToken } = await postJson('/api/plaid/link-token', itemId ? { itemId } : {}, 'Could not start the bank connection.')
  return linkToken
}

export function exchangePublicToken(publicToken, institutionName) {
  return postJson('/api/plaid/exchange', { publicToken, institutionName }, 'The bank connection could not be saved.')
}

export function syncNow() {
  return postJson('/api/plaid/sync', {}, 'Sync failed. Please try again.')
}

export function removeConnection(itemId) {
  return postJson('/api/plaid/remove', { itemId }, 'The connection could not be removed.')
}

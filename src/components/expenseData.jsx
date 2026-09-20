const API_URL = 'https://d1-budget.slajeun217.workers.dev'

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

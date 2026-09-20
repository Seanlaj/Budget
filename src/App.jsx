import { useCallback, useEffect, useMemo, useState } from 'react'
import "bootstrap/dist/css/bootstrap.min.css"
import './App.css'
import Expense from './components/Expense'
import Table from './components/Table'
import { getTableData } from './components/expenseData'
import RemainingBalance from './components/RemainingBalance'
import { BUDGETS } from './components/budgetConfig'
import Title from './components/Title'

function App() {
  const today = new Date()
  const [expenseData, setExpenseData] = useState({ Expenses: [], Month: today.getMonth(), Year: today.getFullYear() })
  const [status, setStatus] = useState({ loading: true, error: '' })

  const loadExpenses = useCallback(async (selection) => {
    setStatus({ loading: true, error: '' })
    try {
      const expenses = await getTableData(selection.Month, selection.Year)
      setExpenseData({ ...selection, Expenses: expenses })
      setStatus({ loading: false, error: '' })
    } catch (error) {
      setStatus({ loading: false, error: error.message })
    }
  }, [])

  useEffect(() => {
    const date = new Date()
    loadExpenses({ Expenses: [], Month: date.getMonth(), Year: date.getFullYear() })
  }, [loadExpenses])

  const totals = useMemo(() => {
    const spent = expenseData.Expenses.reduce((sum, expense) => sum + Number(expense.Amount || 0), 0)
    const budget = Object.values(BUDGETS).reduce((sum, amount) => sum + amount, 0)
    return { spent, budget, remaining: budget - spent }
  }, [expenseData.Expenses])

  return (
    <main className="app-shell">
      <Title getExpenseData={loadExpenses} expenseData={expenseData} />
      <section className="summary-strip" aria-label="Monthly summary">
        <div><span>Monthly budget</span><strong>{totals.budget.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</strong></div>
        <div><span>Spent so far</span><strong>{totals.spent.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</strong></div>
        <div><span>Available</span><strong className={totals.remaining < 0 ? 'negative' : 'positive'}>{totals.remaining.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</strong></div>
      </section>
      {status.error && <div className="alert-banner" role="alert">{status.error}</div>}
      <section className="dashboard-grid">
        <Expense expenseData={expenseData} setExpenseData={loadExpenses} />
        <RemainingBalance expenseData={expenseData} />
      </section>
      <Table expenseData={expenseData} setExpenseData={loadExpenses} loading={status.loading} />
    </main>
  )
}

export default App

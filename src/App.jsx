import { useCallback, useEffect, useMemo, useState } from 'react'
import "bootstrap/dist/css/bootstrap.min.css"
import './App.css'
import ExpenseModal from './components/ExpenseModal'
import Table from './components/Table'
import { getCategories, getTableData } from './components/expenseData'
import RemainingBalance from './components/RemainingBalance'
import Title from './components/Title'
import Admin from './components/Admin'

// Banks using OAuth redirect back with this parameter; the connection finishes on the settings screen.
const returningFromBank = window.location.search.includes('oauth_state_id=')

function App() {
  const today = new Date()
  const [expenseData, setExpenseData] = useState({ Expenses: [], Month: today.getMonth(), Year: today.getFullYear() })
  const [status, setStatus] = useState({ loading: true, error: '' })
  const [categories, setCategories] = useState([])
  const [showSettings, setShowSettings] = useState(returningFromBank)
  const [showAddExpense, setShowAddExpense] = useState(false)

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await getCategories())
    } catch (error) {
      setStatus(s => ({ ...s, error: error.message }))
    }
  }, [])

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
    loadCategories()
    loadExpenses({ Expenses: [], Month: date.getMonth(), Year: date.getFullYear() })
  }, [loadCategories, loadExpenses])

  const activeCategories = useMemo(() => categories.filter(c => c.Active), [categories])

  const totals = useMemo(() => {
    const spent = expenseData.Expenses.reduce((sum, expense) => sum + Number(expense.Amount || 0), 0)
    const budget = activeCategories.reduce((sum, c) => sum + c.MonthlyBudget, 0)
    return { spent, budget, remaining: budget - spent }
  }, [expenseData.Expenses, activeCategories])

  const reloadAll = useCallback(async () => {
    await Promise.all([loadCategories(), loadExpenses(expenseData)])
  }, [loadCategories, loadExpenses, expenseData])

  if (showSettings) {
    return (
      <main className="app-shell">
        <Title getExpenseData={loadExpenses} expenseData={expenseData} settingsOpen onToggleSettings={() => setShowSettings(false)} />
        {status.error && <div className="alert-banner" role="alert">{status.error}</div>}
        <Admin categories={categories} onCategoriesChanged={reloadAll} onSynced={() => loadExpenses(expenseData)} />
      </main>
    )
  }

  return (
    <main className="app-shell">
      <Title getExpenseData={loadExpenses} expenseData={expenseData} settingsOpen={false} onToggleSettings={() => setShowSettings(true)} />
      <section className="summary-strip" aria-label="Monthly summary">
        <div><span>Monthly budget</span><strong>{totals.budget.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</strong></div>
        <div><span>Spent so far</span><strong>{totals.spent.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</strong></div>
        <div><span>Available</span><strong className={totals.remaining < 0 ? 'negative' : 'positive'}>{totals.remaining.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</strong></div>
      </section>
      {status.error && <div className="alert-banner" role="alert">{status.error}</div>}
      <RemainingBalance expenseData={expenseData} categories={activeCategories} />
      <Table expenseData={expenseData} setExpenseData={loadExpenses} loading={status.loading} categories={activeCategories.map(c => c.Name)} />
      <button type="button" className="add-expense-fab" onClick={() => setShowAddExpense(true)} aria-label="Add an expense" title="Add an expense">+</button>
      {showAddExpense && (
        <ExpenseModal expenseData={expenseData} setExpenseData={loadExpenses} categories={activeCategories.map(c => c.Name)} onClose={() => setShowAddExpense(false)} />
      )}
    </main>
  )
}

export default App

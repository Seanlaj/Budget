import { useState } from 'react'
import PropTypes from 'prop-types'
import { deleteExpense, reviewExpense } from './expenseData'
import { BUDGETS } from './budgetConfig'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const categories = Object.keys(BUDGETS)

export default function Table({ expenseData, setExpenseData, loading }) {
  const [deletingId, setDeletingId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [error, setError] = useState('')
  const reviewCount = expenseData.Expenses.filter(row => row.NeedsReview).length

  async function handleReview(row) {
    setSavingId(row.Id)
    setError('')
    try {
      await reviewExpense(row.Id, drafts[row.Id] ?? row.Category)
      setEditingId(null)
      await setExpenseData(expenseData)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId(null)
    }
  }

  function renderCategory(row) {
    if (!row.NeedsReview && editingId !== row.Id) {
      return row.Source === 'plaid'
        ? <button type="button" className="category-tag category-edit" onClick={() => setEditingId(row.Id)} title="Change category">{row.Category}</button>
        : <span className="category-tag">{row.Category}</span>
    }
    return (
      <div className="review-cell">
        {row.DuplicateOf
          ? <span className="review-note">Possible duplicate of a manual entry. Keep this one, or delete it with &times;.</span>
          : row.NeedsReview ? <span className="review-note">Needs review</span> : null}
        <div className="review-controls">
          <select aria-label={`Category for ${row.Store}`} value={drafts[row.Id] ?? row.Category} onChange={e => setDrafts({ ...drafts, [row.Id]: e.target.value })}>
            {categories.map(category => <option key={category}>{category}</option>)}
          </select>
          <button type="button" className="small-primary-button" onClick={() => handleReview(row)} disabled={savingId === row.Id}>
            {savingId === row.Id ? 'Saving...' : row.DuplicateOf ? 'Keep' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return
    setDeletingId(id)
    setError('')
    try {
      await deleteExpense(id)
      await setExpenseData(expenseData)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="panel transactions-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">Activity</p><h2>Recent expenses</h2></div>
        <span className="item-count">{reviewCount > 0 && <strong className="review-count">{reviewCount} to review · </strong>}{expenseData.Expenses.length} transactions</span>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Store</th><th>Items</th><th>Category</th><th className="amount-cell">Amount</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="empty-state"><span className="spinner-border spinner-border-sm" /> Loading expenses...</td></tr>
            ) : expenseData.Expenses.length === 0 ? (
              <tr><td colSpan="6" className="empty-state">No expenses recorded for this month.</td></tr>
            ) : expenseData.Expenses.filter(row => row.Date !== 'Invalid Date').map(row => (
              <tr key={row.Id} className={row.NeedsReview ? 'needs-review' : undefined}>
                <td data-label="Date">{row.Date}</td>
                <td data-label="Store" className="primary-cell">{row.Store}{row.Source === 'plaid' && <span className="source-tag">Bank</span>}</td>
                <td data-label="Items">{row.Items}</td>
                <td data-label="Category">{renderCategory(row)}</td>
                <td data-label="Amount" className="amount-cell">{currency.format(Number(row.Amount || 0))}</td>
                <td className="action-cell">
                  <button type="button" className="delete-button" onClick={() => handleDelete(row.Id)} disabled={deletingId === row.Id} aria-label={`Delete expense from ${row.Store}`} title="Delete expense">
                    {deletingId === row.Id ? <span className="spinner-border spinner-border-sm" /> : <span aria-hidden="true">&times;</span>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

Table.propTypes = {
  expenseData: PropTypes.shape({
    Expenses: PropTypes.arrayOf(PropTypes.object).isRequired,
    Month: PropTypes.number.isRequired,
    Year: PropTypes.number.isRequired,
  }).isRequired,
  setExpenseData: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
}

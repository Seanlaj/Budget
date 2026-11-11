import { Fragment, useState } from 'react'
import PropTypes from 'prop-types'
import { deleteExpense, reviewExpense } from './expenseData'
import SplitEditor from './SplitEditor'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// Dates are stored as MM/DD/YYYY; this gives a sortable YYYYMMDD string.
const dateKey = date => {
  const [month = '', day = '', year = ''] = String(date).split('/')
  return `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`
}

const SORTS = {
  newest: (a, b) => dateKey(b.Date).localeCompare(dateKey(a.Date)),
  oldest: (a, b) => dateKey(a.Date).localeCompare(dateKey(b.Date)),
  category: (a, b) => String(a.Category).localeCompare(String(b.Category)) || SORTS.newest(a, b),
  store: (a, b) => String(a.Store).localeCompare(String(b.Store), undefined, { sensitivity: 'base' }) || SORTS.newest(a, b),
  amount: (a, b) => Number(b.Amount || 0) - Number(a.Amount || 0),
}

// Keeps split parts directly under their original payment.
const bySplitGroup = (a, b) => (b.SplitOf || b.Id) - (a.SplitOf || a.Id) || a.Id - b.Id

export default function Table({ expenseData, setExpenseData, loading, categories }) {
  const [deletingId, setDeletingId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [drafts, setDrafts] = useState({})
  const [error, setError] = useState('')
  const [splitting, setSplitting] = useState(null)
  const [sort, setSort] = useState('newest')
  const [search, setSearch] = useState('')
  const reviewCount = expenseData.Expenses.filter(row => row.NeedsReview).length
  const isSplit = row => row.SplitOf || expenseData.Expenses.some(other => other.SplitOf === row.Id)
  const query = search.trim().toLowerCase()
  const rows = expenseData.Expenses
    .filter(row => row.Date !== 'Invalid Date')
    .filter(row => !query || `${row.Store ?? ''} ${row.Items ?? ''}`.toLowerCase().includes(query))
    .sort((a, b) => SORTS[sort](a, b) || bySplitGroup(a, b))

  function renderSplitEditor(row) {
    if (splitting?.anchorId !== row.Id) return null
    const parent = expenseData.Expenses.find(other => other.Id === splitting.parentId)
    if (!parent) return null
    const parts = [parent, ...expenseData.Expenses.filter(other => other.SplitOf === parent.Id)]
    const close = () => setSplitting(null)
    return (
      <tr className="split-row">
        <td colSpan="6">
          <SplitEditor parent={parent} parts={parts} categories={categories} onCancel={close} onDone={async () => { close(); await setExpenseData(expenseData) }} />
        </td>
      </tr>
    )
  }

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
            {(categories.includes(row.Category) ? categories : [row.Category, ...categories]).map(category => <option key={category}>{category}</option>)}
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
        <span className="item-count">{reviewCount > 0 && <strong className="review-count">{reviewCount} to review · </strong>}{query ? `${rows.length} of ${expenseData.Expenses.length}` : expenseData.Expenses.length} transactions</span>
      </div>
      <div className="table-toolbar">
        <input type="search" placeholder="Search store or description" aria-label="Search transactions" value={search} onChange={e => setSearch(e.target.value)} />
        <label>
          <span>Sort by</span>
          <select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="newest">Date (newest first)</option>
            <option value="oldest">Date (oldest first)</option>
            <option value="category">Category</option>
            <option value="store">Store</option>
            <option value="amount">Amount (largest first)</option>
          </select>
        </label>
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
            ) : rows.length === 0 ? (
              <tr><td colSpan="6" className="empty-state">No transactions match &ldquo;{search.trim()}&rdquo;.</td></tr>
            ) : rows.map(row => (
              <Fragment key={row.Id}>
              <tr className={row.NeedsReview ? 'needs-review' : undefined}>
                <td data-label="Date">{row.Date}</td>
                <td data-label="Store" className="primary-cell">{row.Store}{row.Source === 'plaid' && <span className="source-tag">Bank</span>}{isSplit(row) && <span className="source-tag">Split</span>}</td>
                <td data-label="Items">{row.Items}</td>
                <td data-label="Category">{renderCategory(row)}</td>
                <td data-label="Amount" className="amount-cell">{currency.format(Number(row.Amount || 0))}</td>
                <td className="action-cell">
                  <button type="button" className="split-button" onClick={() => setSplitting({ parentId: row.SplitOf || row.Id, anchorId: row.Id })} aria-label={`Split expense from ${row.Store}`} title="Split across categories">
                    <span aria-hidden="true">&#x2702;</span>
                  </button>
                  <button type="button" className="delete-button" onClick={() => handleDelete(row.Id)} disabled={deletingId === row.Id} aria-label={`Delete expense from ${row.Store}`} title={row.SplitOf ? 'Delete this part' : isSplit(row) ? 'Delete expense and all its parts' : 'Delete expense'}>
                    {deletingId === row.Id ? <span className="spinner-border spinner-border-sm" /> : <span aria-hidden="true">&times;</span>}
                  </button>
                </td>
              </tr>
              {renderSplitEditor(row)}
              </Fragment>
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
  categories: PropTypes.arrayOf(PropTypes.string).isRequired,
}

import { useState } from 'react'
import PropTypes from 'prop-types'
import Modal from './Modal'
import { deleteExpense, reviewExpense } from './expenseData'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export default function ReviewModal({ rows, categories, onChanged, onClose }) {
  const [drafts, setDrafts] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')

  async function run(id, action) {
    setBusyId(id)
    setError('')
    try {
      await action()
      await onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal label="Transactions to review" onClose={onClose} className="review-modal">
      <section className="panel review-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Needs review</p><h2>{rows.length ? `${rows.length} ${rows.length === 1 ? 'transaction' : 'transactions'}` : 'All caught up'}</h2></div>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {rows.length === 0 ? (
          <p className="empty-note">Nothing left to review this month.</p>
        ) : (
          <ul className="review-list">
            {rows.map(row => {
              const category = drafts[row.Id] ?? row.Category
              const busy = busyId === row.Id
              return (
                <li key={row.Id}>
                  <div className="review-line">
                    <strong>{row.Store}</strong>
                    <span className="review-amount">{currency.format(Number(row.Amount || 0))}</span>
                  </div>
                  <div className="review-meta">
                    {row.Date} &middot; {row.Items}
                    {row.DuplicateOf && <span className="review-note"> &middot; Possible duplicate of a manual entry</span>}
                  </div>
                  <div className="review-controls">
                    <select aria-label={`Category for ${row.Store}`} value={category} onChange={e => setDrafts({ ...drafts, [row.Id]: e.target.value })}>
                      {(categories.includes(row.Category) ? categories : [row.Category, ...categories]).map(c => <option key={c}>{c}</option>)}
                    </select>
                    <button type="button" className="small-primary-button" disabled={busy} onClick={() => run(row.Id, () => reviewExpense(row.Id, category))}>
                      {busy ? 'Saving...' : row.DuplicateOf ? 'Keep' : 'Save'}
                    </button>
                    {row.DuplicateOf && (
                      <button type="button" className="text-button" disabled={busy}
                        onClick={() => window.confirm('Delete this bank entry? The manual entry stays.') && run(row.Id, () => deleteExpense(row.Id))}>
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </Modal>
  )
}

ReviewModal.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  categories: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChanged: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}

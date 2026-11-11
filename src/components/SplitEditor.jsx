import { useState } from 'react'
import PropTypes from 'prop-types'
import { splitExpense } from './expenseData'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const toCents = value => Math.round(Number(value || 0) * 100)

export default function SplitEditor({ parent, parts: existing, categories, onDone, onCancel }) {
  const totalCents = existing.reduce((sum, row) => sum + toCents(row.Amount), 0)
  const [parts, setParts] = useState(() => existing.length > 1
    ? existing.map(row => ({ category: row.Category, amount: String(Number(row.Amount)) }))
    : [{ category: parent.Category, amount: '' }, { category: categories[0] ?? '', amount: '' }])
  const [remember, setRemember] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const leftCents = totalCents - parts.reduce((sum, p) => sum + toCents(p.amount), 0)

  function update(index, field, value) {
    setParts(parts.map((part, i) => (i === index ? { ...part, [field]: value } : part)))
  }

  async function save(nextParts) {
    setSaving(true)
    setError('')
    try {
      await splitExpense(parent.Id, nextParts.map(p => ({ category: p.category, amount: Number(p.amount) })), parent.Source === 'plaid' && remember)
      await onDone()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="split-editor">
      <p className="split-heading">Split {currency.format(totalCents / 100)} from {parent.Store}</p>
      {parts.map((part, index) => (
        <div className="split-part" key={index}>
          <select aria-label={`Category for part ${index + 1}`} value={part.category} onChange={e => update(index, 'category', e.target.value)}>
            {(categories.includes(part.category) ? categories : [part.category, ...categories]).map(c => <option key={c}>{c}</option>)}
          </select>
          <input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" aria-label={`Amount for part ${index + 1}`} value={part.amount} onChange={e => update(index, 'amount', e.target.value)} />
          {parts.length > 2 && <button type="button" className="link-button" onClick={() => setParts(parts.filter((_, i) => i !== index))}>Remove</button>}
          {leftCents > 0 && !part.amount && <button type="button" className="link-button" onClick={() => update(index, 'amount', String(leftCents / 100))}>Use rest</button>}
        </div>
      ))}
      {parts.length < 6 && <button type="button" className="link-button" onClick={() => setParts([...parts, { category: categories[0] ?? '', amount: '' }])}>+ Add part</button>}
      <p className={leftCents === 0 ? 'split-left done' : 'split-left'}>
        {leftCents === 0 ? 'Fully assigned' : leftCents > 0 ? `${currency.format(leftCents / 100)} left to assign` : `${currency.format(-leftCents / 100)} over`}
      </p>
      {parent.Source === 'plaid' && (
        <label className="split-remember">
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
          Split future payments to this payee the same way (the last part gets whatever is left)
        </label>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="split-actions">
        <button type="button" className="small-primary-button" disabled={saving || leftCents !== 0} onClick={() => save(parts)}>{saving ? 'Saving...' : 'Save split'}</button>
        {existing.length > 1 && <button type="button" className="link-button" disabled={saving} onClick={() => save([{ category: parts[0].category, amount: totalCents / 100 }])}>Undo split</button>}
        <button type="button" className="link-button" disabled={saving} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

SplitEditor.propTypes = {
  parent: PropTypes.object.isRequired,
  parts: PropTypes.arrayOf(PropTypes.object).isRequired,
  categories: PropTypes.arrayOf(PropTypes.string).isRequired,
  onDone: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}

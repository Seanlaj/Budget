import { useState } from 'react'
import PropTypes from 'prop-types'
import { createExpense } from './expenseData'

const categories = ['Car Maintenance', 'Clothes', 'Costco', 'Eating Out', 'Entertainment', 'Gas', 'Gifts', 'Giving', 'Groceries', 'Healthcare', 'Miscellaneous Needs', 'Non-Essentials (Wants)']

export default function Expense({ expenseData, setExpenseData }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const [year, month] = String(formData.get('Date')).split('-').map(Number)
    setSaving(true)
    setError('')
    try {
      await createExpense(formData)
      form.reset()
      await setExpenseData({ ...expenseData, Month: month - 1, Year: year })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel add-expense-panel">
      <div className="panel-heading"><div><p className="eyebrow">New transaction</p><h2>Add an expense</h2></div></div>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>Date<input type="date" name="Date" required /></label>
          <label>Amount<div className="currency-input"><span>$</span><input type="number" name="Amount" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" required /></div></label>
          <label>Store<input type="text" name="Store" placeholder="Where did you shop?" required /></label>
          <label>Items<input type="text" name="Items" placeholder="What did you buy?" required /></label>
          <label className="full-width">Category<select defaultValue="" name="Category" required><option value="" disabled>Choose a category</option>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={saving}>{saving ? <><span className="spinner-border spinner-border-sm" aria-hidden="true" /> Saving...</> : 'Add expense'}</button>
      </form>
    </section>
  )
}

Expense.propTypes = {
  expenseData: PropTypes.shape({
    Expenses: PropTypes.arrayOf(PropTypes.object).isRequired,
    Month: PropTypes.number.isRequired,
    Year: PropTypes.number.isRequired,
  }).isRequired,
  setExpenseData: PropTypes.func.isRequired,
}

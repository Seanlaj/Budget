import { useState } from 'react'
import PropTypes from 'prop-types'
import Accounts from './Accounts'
import { getSuggestions, saveCategory } from './expenseData'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const categoryShape = PropTypes.shape({
  Name: PropTypes.string.isRequired,
  MonthlyBudget: PropTypes.number.isRequired,
  Active: PropTypes.number.isRequired,
})

function CategoryRow({ category, onSaved }) {
  const [name, setName] = useState(category.Name)
  const [budget, setBudget] = useState(String(category.MonthlyBudget))
  const [active, setActive] = useState(Boolean(category.Active))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dirty = name.trim() !== category.Name || Number(budget) !== category.MonthlyBudget || active !== Boolean(category.Active)

  async function save() {
    const renamed = name.trim() !== category.Name
    if (renamed && !window.confirm(`Rename "${category.Name}" to "${name.trim()}"? Existing expenses in this category move to the new name.`)) return
    setSaving(true)
    setError('')
    try {
      await saveCategory({ originalName: category.Name, name, monthlyBudget: Number(budget), active })
      await onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className={active ? undefined : 'inactive-row'}>
      <td data-label="Category"><input aria-label="Category name" value={name} maxLength={40} onChange={e => setName(e.target.value)} /></td>
      <td data-label="Monthly">
        <div className="currency-input"><span>$</span><input aria-label={`Monthly allowance for ${category.Name}`} type="number" min="0" step="1" inputMode="decimal" value={budget} onChange={e => setBudget(e.target.value)} /></div>
      </td>
      <td data-label="Shown"><label className="check-label"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Shown</label></td>
      <td className="admin-actions">
        <button type="button" className="small-primary-button" onClick={save} disabled={!dirty || saving}>{saving ? 'Saving...' : 'Save'}</button>
        {error && <span className="form-error inline-error">{error}</span>}
      </td>
    </tr>
  )
}

CategoryRow.propTypes = { category: categoryShape.isRequired, onSaved: PropTypes.func.isRequired }

function NewCategoryRow({ onSaved }) {
  const [name, setName] = useState('')
  const [budget, setBudget] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function add() {
    setSaving(true)
    setError('')
    try {
      await saveCategory({ name, monthlyBudget: Number(budget || 0) })
      setName('')
      setBudget('')
      await onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="new-row">
      <td data-label="Category"><input aria-label="New category name" placeholder="New category" value={name} maxLength={40} onChange={e => setName(e.target.value)} /></td>
      <td data-label="Monthly">
        <div className="currency-input"><span>$</span><input aria-label="New category monthly allowance" type="number" min="0" step="1" inputMode="decimal" placeholder="0" value={budget} onChange={e => setBudget(e.target.value)} /></div>
      </td>
      <td />
      <td className="admin-actions">
        <button type="button" className="small-primary-button" onClick={add} disabled={!name.trim() || saving}>{saving ? 'Adding...' : 'Add'}</button>
        {error && <span className="form-error inline-error">{error}</span>}
      </td>
    </tr>
  )
}

NewCategoryRow.propTypes = { onSaved: PropTypes.func.isRequired }

function Suggestions({ onAdded }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [choices, setChoices] = useState({})
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function analyze() {
    setLoading(true)
    setError('')
    try {
      const data = await getSuggestions()
      setResult(data)
      setChoices(Object.fromEntries(data.suggestions.map(s => [s.plaidMatch, { checked: true, name: s.name, monthly: String(s.monthly) }])))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function update(key, change) {
    setChoices({ ...choices, [key]: { ...choices[key], ...change } })
  }

  async function addSelected() {
    setAdding(true)
    setError('')
    try {
      for (const suggestion of result.suggestions) {
        const choice = choices[suggestion.plaidMatch]
        if (!choice.checked) continue
        await saveCategory({ name: choice.name, monthlyBudget: Number(choice.monthly || 0), plaidMatch: suggestion.plaidMatch, applyToImported: true })
      }
      setResult(null)
      await onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const selectedCount = Object.values(choices).filter(c => c.checked).length

  return (
    <section className="panel admin-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">From your bank history</p><h2>Suggested new categories</h2></div>
        <button type="button" className="secondary-button" onClick={analyze} disabled={loading || adding}>{loading ? 'Analyzing...' : result ? 'Analyze again' : 'Analyze bank history'}</button>
      </div>
      <p className="empty-note">Looks at recent transactions from your connected accounts for spending your current categories don&apos;t cover, like your mortgage, insurance and utilities, and proposes a monthly allowance for each. Your existing categories and allowances are not changed.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {result && (
        result.suggestions.length === 0 ? (
          <p className="form-note">No new categories to suggest from the last {result.days} days.</p>
        ) : (
          <>
            <p className="form-note">Based on {result.days} days of bank history{result.skippedInstitutions.length ? ` (couldn't read: ${result.skippedInstitutions.join(', ')})` : ''}.</p>
            <ul className="suggestion-list">
              {result.suggestions.map(s => {
                const choice = choices[s.plaidMatch]
                return (
                  <li key={s.plaidMatch} className={choice.checked ? undefined : 'unchecked'}>
                    <input type="checkbox" aria-label={`Add ${s.name}`} checked={choice.checked} onChange={e => update(s.plaidMatch, { checked: e.target.checked })} />
                    <div className="suggestion-fields">
                      <input aria-label="Category name" value={choice.name} maxLength={40} onChange={e => update(s.plaidMatch, { name: e.target.value })} />
                      <div className="currency-input"><span>$</span><input aria-label={`Monthly allowance for ${choice.name}`} type="number" min="0" step="1" value={choice.monthly} onChange={e => update(s.plaidMatch, { monthly: e.target.value })} /></div>
                    </div>
                    <span className="suggestion-detail">
                      {currency.format(s.total)} in {result.days} days: {s.merchants.map(m => `${m.name} ${currency.format(m.total)}`).join(', ')}
                    </span>
                  </li>
                )
              })}
            </ul>
            <button type="button" className="primary-button" onClick={addSelected} disabled={adding || selectedCount === 0}>
              {adding ? 'Adding...' : `Add ${selectedCount} selected categor${selectedCount === 1 ? 'y' : 'ies'}`}
            </button>
          </>
        )
      )}
    </section>
  )
}

Suggestions.propTypes = { onAdded: PropTypes.func.isRequired }

export default function Admin({ categories, onCategoriesChanged, onSynced }) {
  const total = categories.filter(c => c.Active).reduce((sum, c) => sum + c.MonthlyBudget, 0)

  return (
    <div className="admin-view">
      <section className="panel admin-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Budget plan</p><h2>Categories &amp; monthly allowances</h2></div>
          <span className="item-count">Total {currency.format(total)} / month</span>
        </div>
        <p className="empty-note">Unchecking <strong>Shown</strong> hides a category from the budget and pickers without deleting any expenses.</p>
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Category</th><th>Monthly allowance</th><th>Shown</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {categories.map(category => <CategoryRow key={category.Name} category={category} onSaved={onCategoriesChanged} />)}
              <NewCategoryRow onSaved={onCategoriesChanged} />
            </tbody>
          </table>
        </div>
      </section>
      <Suggestions onAdded={onCategoriesChanged} />
      <Accounts onSynced={onSynced} />
    </div>
  )
}

Admin.propTypes = {
  categories: PropTypes.arrayOf(categoryShape).isRequired,
  onCategoriesChanged: PropTypes.func.isRequired,
  onSynced: PropTypes.func.isRequired,
}

import { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { addIncome, getCashflow, removeIncome } from './expenseData'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const wholeCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const RING_RADIUS = 52
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

const monthLabel = (key, style = 'short') => {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: style })
}

const formatIsoDate = iso => {
  const [year, month, day] = iso.split('-')
  return `${month}/${day}/${year}`
}

const localToday = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function SavingsRing({ rate }) {
  const fraction = rate === null ? 0 : Math.min(1, Math.abs(rate))
  const tone = rate === null ? 'empty' : rate >= 0 ? 'saved' : 'over'
  return (
    <div className={`savings-ring ${tone}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="ring-track" cx="60" cy="60" r={RING_RADIUS} />
        <circle className="ring-fill" cx="60" cy="60" r={RING_RADIUS} strokeDasharray={RING_LENGTH} strokeDashoffset={RING_LENGTH * (1 - fraction)} />
      </svg>
      <div className="ring-copy">
        <strong>{rate === null ? '—' : `${Math.round(rate * 100)}%`}</strong>
        <span>{rate === null ? 'no income' : rate >= 0 ? 'of income saved' : 'over income'}</span>
      </div>
    </div>
  )
}

SavingsRing.propTypes = { rate: PropTypes.number }

function AddIncomeForm({ onSaved, onCancel }) {
  const [form, setForm] = useState({ date: localToday(), source: '', amount: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await addIncome({ date: form.date, source: form.source, amount: Number(form.amount) })
      await onSaved()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form className="income-form" onSubmit={handleSubmit}>
      <label>Date<input type="date" value={form.date} required onChange={e => setForm({ ...form, date: e.target.value })} /></label>
      <label>Source<input type="text" value={form.source} maxLength={100} placeholder="Paycheck, side job..." required autoFocus onChange={e => setForm({ ...form, source: e.target.value })} /></label>
      <label>Amount<div className="currency-input"><span>$</span><input type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" value={form.amount} required onChange={e => setForm({ ...form, amount: e.target.value })} /></div></label>
      <div className="income-form-actions">
        <button type="submit" className="small-primary-button" disabled={saving}>{saving ? 'Saving...' : 'Add'}</button>
        <button type="button" className="secondary-button" onClick={onCancel} disabled={saving}>Cancel</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  )
}

AddIncomeForm.propTypes = { onSaved: PropTypes.func.isRequired, onCancel: PropTypes.func.isRequired }

export default function Cashflow({ month, year, spent, expenses }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState(null)

  const load = useCallback(async () => {
    try {
      setData(await getCashflow(month, year))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [month, year])

  // Spending totals change whenever the month's expenses do.
  useEffect(() => { load() }, [load, expenses])

  async function handleRemove(entry) {
    const message = entry.Origin === 'plaid'
      ? 'Stop counting this bank deposit as income?'
      : 'Delete this income entry?'
    if (!window.confirm(message)) return
    setRemovingId(entry.Id)
    try {
      await removeIncome(entry.Id)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setRemovingId(null)
    }
  }

  const income = data ? data.months.at(-1).income : 0
  const net = income - spent
  const rate = income > 0 ? net / income : null
  const previous = data?.months.at(-2)
  const previousNet = previous && (previous.income || previous.spent) ? previous.income - previous.spent : null
  const barMax = Math.max(income, spent, 1)
  const trend = data ? data.months.map((m, i) => ({ ...m, net: i === data.months.length - 1 ? net : m.income - m.spent })) : []
  const trendMax = Math.max(1, ...trend.map(m => Math.abs(m.net)))

  return (
    <section className="panel cashflow-panel" aria-label="Income and savings">
      <div className="panel-heading">
        <div><p className="eyebrow">Cash flow</p><h2>Income vs. spending</h2></div>
        {!adding && <button type="button" className="secondary-button" onClick={() => setAdding(true)}>+ Add income</button>}
      </div>
      {adding && <AddIncomeForm onCancel={() => setAdding(false)} onSaved={async () => { setAdding(false); await load() }} />}
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="cashflow-hero">
        <SavingsRing rate={rate} />
        <div className="cashflow-net">
          <span className="cashflow-label">{net >= 0 ? 'Saved this month' : 'Overspent this month'}</span>
          <strong className={net >= 0 ? 'positive' : 'negative'}>{net >= 0 ? '+' : '−'}{currency.format(Math.abs(net))}</strong>
          {previousNet !== null && (
            <span className={`cashflow-compare ${net >= previousNet ? 'up' : 'down'}`}>
              {net >= previousNet ? '▲' : '▼'} {currency.format(Math.abs(net - previousNet))} {net >= previousNet ? 'better' : 'worse'} than {monthLabel(previous.month, 'long')}
            </span>
          )}
        </div>
        <div className="cashflow-bars">
          <div className="flow-bar">
            <div className="flow-bar-copy"><span>Income</span><strong>{currency.format(income)}</strong></div>
            <div className="flow-track"><span className="flow-income" style={{ width: `${(income / barMax) * 100}%` }} /></div>
          </div>
          <div className="flow-bar">
            <div className="flow-bar-copy"><span>Spending</span><strong>{currency.format(spent)}</strong></div>
            <div className="flow-track"><span className={spent > income ? 'flow-spent over' : 'flow-spent'} style={{ width: `${(spent / barMax) * 100}%` }} /></div>
          </div>
        </div>
      </div>

      {trend.length > 0 && (
        <div className="cashflow-trend" role="img" aria-label={`Saved or overspent over the last ${trend.length} months`}>
          {trend.map((m, i) => {
            const empty = !m.income && !m.spent && i !== trend.length - 1
            const height = empty ? 0 : (Math.abs(m.net) / trendMax) * 100
            return (
              <div key={m.month} className={`trend-col${i === trend.length - 1 ? ' current' : ''}`}
                title={empty ? `${monthLabel(m.month, 'long')}: no data` : `${monthLabel(m.month, 'long')}: ${m.net >= 0 ? 'saved' : 'overspent'} ${currency.format(Math.abs(m.net))}`}>
                <div className="trend-half up">{!empty && m.net >= 0 && <span style={{ height: `${height}%` }} />}</div>
                <div className="trend-half down">{!empty && m.net < 0 && <span style={{ height: `${height}%` }} />}</div>
                <span className="trend-value">{empty ? '' : `${m.net >= 0 ? '+' : '−'}${wholeCurrency.format(Math.abs(m.net))}`}</span>
                <span className="trend-label">{monthLabel(m.month)}</span>
              </div>
            )
          })}
        </div>
      )}

      {data && (
        data.income.length === 0 ? (
          <p className="empty-note">No income recorded this month yet. Paychecks and other deposits into checking or savings show up here automatically, or add one yourself.</p>
        ) : (
          <details className="income-list">
            <summary>{data.income.length} income {data.income.length === 1 ? 'entry' : 'entries'}</summary>
            <ul>
              {data.income.map(entry => (
                <li key={entry.Id}>
                  <span className="income-date">{formatIsoDate(entry.Date)}</span>
                  <span className="income-source">
                    {entry.Source}
                    {entry.Origin === 'plaid' && <span className="source-tag">Bank</span>}
                    {entry.Pending ? <span className="source-tag pending-tag">Pending</span> : null}
                  </span>
                  <strong>{currency.format(entry.Amount)}</strong>
                  <button type="button" className="delete-button" onClick={() => handleRemove(entry)} disabled={removingId === entry.Id}
                    aria-label={`Remove income from ${entry.Source}`} title={entry.Origin === 'plaid' ? 'Don\u2019t count as income' : 'Delete'}>
                    <span aria-hidden="true">&times;</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )
      )}
    </section>
  )
}

Cashflow.propTypes = {
  month: PropTypes.number.isRequired,
  year: PropTypes.number.isRequired,
  spent: PropTypes.number.isRequired,
  expenses: PropTypes.array.isRequired,
}

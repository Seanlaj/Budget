import { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { findDuplicates, resolveDuplicates } from './expenseData'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const groupKey = group => group.map(row => row.Id).join('-')

export default function DuplicateFinder({ month, year, onChanged, onClose }) {
  const [groups, setGroups] = useState(null)
  const [keep, setKeep] = useState({})
  const [busy, setBusy] = useState('scan')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const found = await findDuplicates(month, year)
      setGroups(found)
      setKeep(Object.fromEntries(found.map(group => [groupKey(group), [group[0].Id]])))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }, [month, year])

  useEffect(() => { load() }, [load])

  function scan() {
    setBusy('scan')
    setError('')
    load()
  }

  async function resolve(group, keepIds) {
    const key = groupKey(group)
    setBusy(key)
    setError('')
    try {
      await resolveDuplicates(group.map(row => row.Id), keepIds)
      setGroups(groups.filter(other => groupKey(other) !== key))
      await onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  function toggle(key, id) {
    const current = keep[key] ?? []
    setKeep({ ...keep, [key]: current.includes(id) ? current.filter(x => x !== id) : [...current, id] })
  }

  return (
    <div className="duplicate-finder">
      <div className="duplicate-header">
        <p>Entries this month with the same store, description and amount dated within 3 days of each other.</p>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={scan} disabled={busy === 'scan'}>{busy === 'scan' ? 'Checking...' : 'Check again'}</button>
          <button type="button" className="link-button" onClick={onClose}>Close</button>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {groups?.length === 0 && <p className="form-note">No potential duplicates found.</p>}
      {groups?.map(group => {
        const key = groupKey(group)
        const kept = keep[key] ?? []
        const removeCount = group.length - kept.length
        return (
          <div className="duplicate-group" key={key}>
            <p className="duplicate-title">{group[0].Store} &middot; {currency.format(group[0].Amount)}</p>
            <ul>
              {group.map(row => (
                <li key={row.Id}>
                  <label className="check-label">
                    <input type="checkbox" checked={kept.includes(row.Id)} onChange={() => toggle(key, row.Id)} />
                    <span>{row.Date} &middot; {row.Items || 'No description'} &middot; {row.Category}{row.Source === 'plaid' && <span className="source-tag">Bank</span>}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="button-row">
              <button type="button" className="small-primary-button" disabled={busy === key || kept.length === 0 || removeCount === 0}
                onClick={() => window.confirm(`Delete ${removeCount} unchecked ${removeCount === 1 ? 'entry' : 'entries'}? This cannot be undone.`) && resolve(group, kept)}>
                {busy === key ? 'Saving...' : `Keep checked, delete ${removeCount}`}
              </button>
              <button type="button" className="link-button" disabled={busy === key} onClick={() => resolve(group, group.map(row => row.Id))}>Not duplicates</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

DuplicateFinder.propTypes = {
  month: PropTypes.number.isRequired,
  year: PropTypes.number.isRequired,
  onChanged: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}

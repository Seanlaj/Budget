import { useCallback, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { usePlaidLink } from 'react-plaid-link'
import { createLinkToken, exchangePublicToken, getConnections, removeConnection, syncNow } from './expenseData'

// Banks using OAuth (e.g. Chase) redirect back here, so the in-progress Link session is kept across the redirect.
const TOKEN_KEY = 'plaidLinkToken'
const ITEM_KEY = 'plaidLinkItem'
const returningFromOAuth = window.location.search.includes('oauth_state_id=')

function formatSynced(value) {
  if (!value) return 'Not synced yet'
  return `Synced ${new Date(`${value.replace(' ', 'T')}Z`).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
}

function formatBankUpdated(value) {
  if (!value) return ''
  return ` · Bank data as of ${new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
}

export default function Accounts({ onSynced }) {
  const [connections, setConnections] = useState([])
  const [linkToken, setLinkToken] = useState(returningFromOAuth ? sessionStorage.getItem(TOKEN_KEY) : null)
  const [updateItemId, setUpdateItemId] = useState(returningFromOAuth ? sessionStorage.getItem(ITEM_KEY) : null)
  const [redirectUri, setRedirectUri] = useState(returningFromOAuth ? window.location.href : undefined)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      setConnections(await getConnections())
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const finishLink = useCallback(() => {
    setLinkToken(null)
    setUpdateItemId(null)
    setRedirectUri(undefined)
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(ITEM_KEY)
    if (window.location.search) window.history.replaceState(null, '', '/')
  }, [])

  const runSync = useCallback(async (refreshBanks = false) => {
    const { refreshed, results } = await syncNow(refreshBanks)
    const added = results.reduce((sum, r) => sum + (r.added || 0), 0)
    setMessage(added
      ? `${added} new transaction${added === 1 ? '' : 's'} imported.`
      : refreshed
        ? 'No new transactions yet. Banks were asked for their latest activity; check again in a few minutes.'
        : 'No new transactions yet. Banks report new activity a few times a day.')
    await refresh()
    await onSynced()
  }, [refresh, onSynced])

  const onSuccess = useCallback(async (publicToken, metadata) => {
    setBusy('saving')
    setError('')
    try {
      if (!updateItemId) await exchangePublicToken(publicToken, metadata.institution?.name)
      await runSync()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
      finishLink()
    }
  }, [updateItemId, runSync, finishLink])

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess, onExit: finishLink, receivedRedirectUri: redirectUri })

  useEffect(() => {
    if (linkToken && ready) open()
  }, [linkToken, ready, open])

  async function startLink(itemId) {
    setBusy(itemId || 'connect')
    setError('')
    setMessage('')
    try {
      const token = await createLinkToken(itemId)
      sessionStorage.setItem(TOKEN_KEY, token)
      if (itemId) sessionStorage.setItem(ITEM_KEY, itemId)
      else sessionStorage.removeItem(ITEM_KEY)
      setUpdateItemId(itemId || null)
      setLinkToken(token)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function handleSync() {
    setBusy('sync')
    setError('')
    try {
      await runSync(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function handleRemove(item) {
    if (!window.confirm(`Disconnect ${item.InstitutionName}? Already-imported expenses stay; new ones stop syncing.`)) return
    setBusy(item.ItemId)
    setError('')
    try {
      await removeConnection(item.ItemId)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="panel connections-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">Bank sync</p><h2>Connected accounts</h2></div>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={handleSync} disabled={!!busy || connections.length === 0}>
            {busy === 'sync' ? 'Syncing...' : 'Sync now'}
          </button>
          <button type="button" className="small-primary-button" onClick={() => startLink()} disabled={!!busy}>
            {busy === 'connect' || busy === 'saving' ? 'Connecting...' : 'Connect account'}
          </button>
        </div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-note" role="status">{message}</p>}
      {connections.length === 0 ? (
        <p className="empty-note">No accounts connected yet. Purchases sync automatically every hour once connected.</p>
      ) : (
        <ul className="connection-list">
          {connections.map(item => (
            <li key={item.ItemId}>
              <div>
                <strong>{item.InstitutionName}</strong>
                <span className="connection-accounts">{item.Accounts.map(a => `${a.Name}${a.Mask ? ` ••${a.Mask}` : ''}`).join(', ') || 'No accounts'}</span>
                {item.Status === 'login_required'
                  ? <span className="status-warning">Bank login expired — reconnect to resume syncing</span>
                  : <span className="connection-meta">{formatSynced(item.LastSyncedAt)}{formatBankUpdated(item.BankUpdatedAt)}</span>}
              </div>
              <div className="button-row">
                {item.Status === 'login_required' && (
                  <button type="button" className="small-primary-button" onClick={() => startLink(item.ItemId)} disabled={!!busy}>Reconnect</button>
                )}
                <button type="button" className="text-button" onClick={() => handleRemove(item)} disabled={!!busy}>Disconnect</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

Accounts.propTypes = {
  onSynced: PropTypes.func.isRequired,
}

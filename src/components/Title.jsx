import { useState } from 'react'
import PropTypes from 'prop-types'

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.dataset.bsTheme = theme
  localStorage.setItem('theme', theme)
}

export default function Title({ getExpenseData, expenseData, settingsOpen, onToggleSettings }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light')
  const now = new Date()
  const isFirstMonth = expenseData.Month === 2 && Number(expenseData.Year) === 2024
  const isCurrentMonth = expenseData.Month === now.getMonth() && Number(expenseData.Year) === now.getFullYear()

  function changeMonth(direction) {
    const date = new Date(Number(expenseData.Year), expenseData.Month + direction, 1)
    getExpenseData({ ...expenseData, Month: date.getMonth(), Year: date.getFullYear() })
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  return (
    <header className="app-header">
      <div>
        <p className="brand">Household budget</p>
        <h1>{settingsOpen ? 'Settings' : `${months[expenseData.Month]} ${expenseData.Year}`}</h1>
      </div>
      <nav className="month-nav" aria-label={settingsOpen ? 'Settings' : 'Change month'}>
        {!settingsOpen && (
          <>
            <button type="button" onClick={() => changeMonth(-1)} disabled={isFirstMonth} aria-label="Previous month" title="Previous month">
              <span aria-hidden="true">&lsaquo;</span>
            </button>
            <button type="button" onClick={() => changeMonth(1)} disabled={isCurrentMonth} aria-label="Next month" title="Next month">
              <span aria-hidden="true">&rsaquo;</span>
            </button>
          </>
        )}
        <button type="button" className="settings-button" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
          <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
        </button>
        <button type="button" className="settings-button" onClick={onToggleSettings} aria-label={settingsOpen ? 'Back to budget' : 'Settings'} title={settingsOpen ? 'Back to budget' : 'Settings'}>
          <span aria-hidden="true">{settingsOpen ? '←' : '⚙'}</span>
        </button>
      </nav>
    </header>
  )
}

Title.propTypes = {
  getExpenseData: PropTypes.func.isRequired,
  expenseData: PropTypes.shape({
    Expenses: PropTypes.arrayOf(PropTypes.object).isRequired,
    Month: PropTypes.number.isRequired,
    Year: PropTypes.number.isRequired,
  }).isRequired,
  settingsOpen: PropTypes.bool.isRequired,
  onToggleSettings: PropTypes.func.isRequired,
}

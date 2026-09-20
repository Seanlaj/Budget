import PropTypes from 'prop-types'

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function Title({ getExpenseData, expenseData }) {
  const now = new Date()
  const isFirstMonth = expenseData.Month === 2 && Number(expenseData.Year) === 2024
  const isCurrentMonth = expenseData.Month === now.getMonth() && Number(expenseData.Year) === now.getFullYear()

  function changeMonth(direction) {
    const date = new Date(Number(expenseData.Year), expenseData.Month + direction, 1)
    getExpenseData({ ...expenseData, Month: date.getMonth(), Year: date.getFullYear() })
  }

  return (
    <header className="app-header">
      <div>
        <p className="brand">Household budget</p>
        <h1>{months[expenseData.Month]} {expenseData.Year}</h1>
      </div>
      <nav className="month-nav" aria-label="Change month">
        <button type="button" onClick={() => changeMonth(-1)} disabled={isFirstMonth} aria-label="Previous month" title="Previous month">
          <span aria-hidden="true">&lsaquo;</span>
        </button>
        <button type="button" onClick={() => changeMonth(1)} disabled={isCurrentMonth} aria-label="Next month" title="Next month">
          <span aria-hidden="true">&rsaquo;</span>
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
}

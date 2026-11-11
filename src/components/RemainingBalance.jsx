import PropTypes from 'prop-types'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export default function RemainingBalance({ expenseData, categories }) {
  const spentByCategory = expenseData.Expenses.reduce((totals, expense) => {
    totals[expense.Category] = (totals[expense.Category] || 0) + Number(expense.Amount || 0)
    return totals
  }, {})

  return (
    <section className="panel budget-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">Plan overview</p><h2>Category balances</h2></div>
        <span className="item-count">{categories.length} categories</span>
      </div>
      <div className="budget-list">
        {categories.map(({ Name: category, MonthlyBudget: budget }) => {
          const spent = spentByCategory[category] || 0
          const remaining = budget - spent
          const used = budget > 0 ? Math.min(100, Math.max(0, (spent / budget) * 100)) : (spent > 0 ? 100 : 0)
          return (
            <div className="budget-row" key={category}>
              <div className="budget-copy"><span>{category}</span><strong className={remaining < 0 ? 'negative' : ''}>{currency.format(remaining)}</strong></div>
              <div className="progress-track"><span className={remaining < 0 ? 'over' : ''} style={{ width: `${used}%` }} /></div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

RemainingBalance.propTypes = {
  expenseData: PropTypes.shape({
    Expenses: PropTypes.arrayOf(PropTypes.object).isRequired,
  }).isRequired,
  categories: PropTypes.arrayOf(PropTypes.shape({
    Name: PropTypes.string.isRequired,
    MonthlyBudget: PropTypes.number.isRequired,
  })).isRequired,
}

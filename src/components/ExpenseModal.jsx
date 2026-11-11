import PropTypes from 'prop-types'
import Expense from './Expense'
import Modal from './Modal'

export default function ExpenseModal({ onClose, ...expenseProps }) {
  return (
    <Modal label="Add an expense" onClose={onClose}>
      <Expense {...expenseProps} onSaved={onClose} />
    </Modal>
  )
}

ExpenseModal.propTypes = {
  onClose: PropTypes.func.isRequired,
}

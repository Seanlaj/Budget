import { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import Expense from './Expense'

export default function ExpenseModal({ onClose, ...expenseProps }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])

  return (
    <dialog ref={dialogRef} className="expense-modal" aria-label="Add an expense" onClose={onClose}
      onClick={e => { if (e.target === dialogRef.current) onClose() }}>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
      <Expense {...expenseProps} onSaved={onClose} />
    </dialog>
  )
}

ExpenseModal.propTypes = {
  onClose: PropTypes.func.isRequired,
}

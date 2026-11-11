import { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

export default function Modal({ label, onClose, className = '', children }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])

  return (
    <dialog ref={dialogRef} className={`app-modal ${className}`} aria-label={label} onClose={onClose}
      onClick={e => { if (e.target === dialogRef.current) onClose() }}>
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
      {children}
    </dialog>
  )
}

Modal.propTypes = {
  label: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
}

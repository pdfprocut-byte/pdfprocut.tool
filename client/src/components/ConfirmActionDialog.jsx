import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../styles/confirmActionDialog.css';

export default function ConfirmActionDialog({ open, title, message, onConfirm, onCancel, confirmLabel = 'OK', cancelLabel = 'Cancel' }) {
  const cancelButtonRef = useRef(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !pending) onCancel?.();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, pending, onCancel]);

  useEffect(() => {
    if (!open) setPending(false);
  }, [open]);

  if (!open) return null;

  const confirm = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onConfirm?.();
    } finally {
      setPending(false);
    }
  };

  return createPortal(
    <div className="confirm-action-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !pending) onCancel?.(); }}>
      <section className="confirm-action-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-action-title" aria-describedby="confirm-action-message">
        <span className="confirm-action-icon" aria-hidden="true">!</span>
        <div className="confirm-action-copy">
          <h2 id="confirm-action-title">{title}</h2>
          <p id="confirm-action-message">{message}</p>
        </div>
        <div className="confirm-action-buttons">
          <button ref={cancelButtonRef} className="confirm-action-cancel" type="button" onClick={onCancel} disabled={pending}>{cancelLabel}</button>
          <button className="confirm-action-ok" type="button" onClick={confirm} disabled={pending}>{pending ? 'Removing…' : confirmLabel}</button>
        </div>
      </section>
    </div>,
    document.body
  );
}

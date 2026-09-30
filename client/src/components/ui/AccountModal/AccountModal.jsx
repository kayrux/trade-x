import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAccounts } from '../../../context/AccountContext';
import './AccountModal.css';

// Free-label account types; the server stores whatever string it's given, so
// this list is just a convenience (mirrors the picker in TradesPanel).
const ACCOUNT_TYPES = ['TFSA', 'RRSP', 'FHSA', 'RESP', 'LIRA', 'Margin', 'Cash', 'Other'];

// Create or edit an investment account. Pass `account` to edit it (settings),
// omit it to create a new one. The nickname is optional — the account falls back
// to its type for display. onSaved receives the created/updated account.
function AccountModal({ account = null, onCancel, onSaved }) {
  const { accounts, createAccount, renameAccount } = useAccounts();
  const editing = Boolean(account);

  const [name, setName] = useState(account?.name || '');
  const [type, setType] = useState(account?.type || 'TFSA');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  // Case-insensitive duplicate check against the user's other accounts (the one
  // being edited doesn't clash with itself), matching the server's unique index.
  const trimmed = name.trim();
  const duplicate =
    trimmed !== '' &&
    accounts.some(
      (a) => a.id !== account?.id && a.name?.trim().toLowerCase() === trimmed.toLowerCase(),
    );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  async function submit(e) {
    e.preventDefault();
    if (duplicate || submitting) return;
    setSubmitting(true);
    // Send "" so a cleared nickname persists as null; the server normalizes it.
    const payload = { name: trimmed, type };
    const saved = editing
      ? await renameAccount(account.id, payload)
      : await createAccount(payload);
    setSubmitting(false);
    if (saved) onSaved(saved);
  }

  return createPortal(
    <div className="account-modal__overlay" onMouseDown={onCancel}>
      <form
        className="account-modal"
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label={editing ? 'Account settings' : 'New account'}
      >
        <h2 className="account-modal__title">{editing ? 'Account settings' : 'New account'}</h2>

        <label className="account-modal__label" htmlFor="account-modal-name">
          Nickname <span className="account-modal__optional">(optional)</span>
        </label>
        <input
          id="account-modal-name"
          ref={inputRef}
          className="account-modal__input"
          value={name}
          placeholder="e.g. My TFSA"
          maxLength={60}
          aria-invalid={duplicate}
          aria-describedby="account-modal-name-help"
          onChange={(e) => setName(e.target.value)}
        />
        {duplicate ? (
          <p className="account-modal__error" id="account-modal-name-help" role="alert">
            You already have an account with that name
          </p>
        ) : (
          <p className="account-modal__hint" id="account-modal-name-help">
            Leave blank to just show the type (e.g. “{type}”).
          </p>
        )}

        <label className="account-modal__label" htmlFor="account-modal-type">Type</label>
        <select
          id="account-modal-type"
          className="account-modal__input"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <div className="account-modal__actions">
          <button type="button" className="account-modal__btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="account-modal__btn account-modal__btn--primary"
            disabled={duplicate || submitting}
          >
            {submitting ? 'Saving…' : editing ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

export default AccountModal;

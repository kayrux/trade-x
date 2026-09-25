import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../components/layouts/PageLayout/PageLayout';
import Avatar from '../../components/ui/Avatar/Avatar';
import { useAuth } from '../../context/AuthContext';
import { AVATARS, DEFAULT_AVATAR_KEY } from '../../lib/constants/avatars';
import './Account.css';

function formatJoined(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function Account() {
  const { user, isAdmin, logout, updateAvatar } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // The selected avatar; missing/unknown falls back to the default.
  const selectedKey = user.avatar ?? DEFAULT_AVATAR_KEY;

  function handleLogout() {
    logout();
    navigate('/', { replace: true });
  }

  async function handleSelectAvatar(key) {
    if (key === selectedKey || saving) return;
    setError(null);
    setSaving(true);
    try {
      await updateAvatar(key);
    } catch (err) {
      setError(err.message || 'Could not update avatar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageLayout>
      <div className="account">
        <div className="account__grid">
          <aside className="account__profile">
            <Avatar avatarKey={user.avatar} size={96} alt="Your profile picture" />
            <h2 className="account__name">{user.username}</h2>
            {isAdmin && <span className="account__badge">Admin</span>}

            <button
              type="button"
              className="account__profile-btn"
              aria-expanded={editing}
              onClick={() => setEditing((open) => !open)}
            >
              {editing ? 'Done' : 'Change avatar'}
            </button>

            {editing && (
              <div
                className="account__avatar-grid"
                role="radiogroup"
                aria-label="Profile picture"
              >
                {AVATARS.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    role="radio"
                    aria-checked={a.key === selectedKey}
                    aria-label={a.label}
                    className={
                      'account__avatar-option' +
                      (a.key === selectedKey ? ' account__avatar-option--selected' : '')
                    }
                    disabled={saving}
                    onClick={() => handleSelectAvatar(a.key)}
                  >
                    <Avatar avatarKey={a.key} size={48} alt="" />
                  </button>
                ))}
              </div>
            )}
            {error && <span className="account__avatar-error">{error}</span>}

            <button
              type="button"
              className="account__profile-btn account__logout"
              onClick={handleLogout}
            >
              Log out
            </button>
          </aside>

          <section className="account__card">
            <div className="account__card-header">Details</div>
            <div className="account__row">
              <span className="account__label">Username</span>
              <span className="account__value">{user.username}</span>
            </div>
            <div className="account__row">
              <span className="account__label">Email</span>
              <span className="account__value">{user.email}</span>
            </div>
            <div className="account__row">
              <span className="account__label">Joined</span>
              <span className="account__value">{formatJoined(user.created_at)}</span>
            </div>
          </section>
        </div>
      </div>
    </PageLayout>
  );
}

export default Account;

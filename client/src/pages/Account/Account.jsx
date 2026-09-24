import { useNavigate } from 'react-router-dom';
import PageLayout from '../../components/layouts/PageLayout/PageLayout';
import { useAuth } from '../../context/AuthContext';
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
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/', { replace: true });
  }

  return (
    <PageLayout>
      <div className="account">
        <h1 className="account__title">Account</h1>

        <div className="account__card">
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
          {isAdmin && (
            <div className="account__row">
              <span className="account__label">Role</span>
              <span className="account__badge">Admin</span>
            </div>
          )}
        </div>

        <div className="account__actions">
          <button className="account__logout" type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
    </PageLayout>
  );
}

export default Account;

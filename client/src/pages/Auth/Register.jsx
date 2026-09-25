import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '../../components/layouts/PageLayout/PageLayout';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

// Mirrors the server-side rules in server/src/routes/auth.js — the server is
// still the authority; this just avoids a round trip for obvious mistakes.
const MIN_PASSWORD_LENGTH = 8;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!USERNAME_RE.test(username)) {
      setError('Username must be 3-30 characters, letters, numbers, and underscores only');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await register({ email, username, password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <PageLayout>
      <div className="auth">
        <form className="auth__card" onSubmit={handleSubmit}>
          <h1 className="auth__title">Create account</h1>
          <p className="auth__subtitle">Track the market your way.</p>

          {error && <div className="auth__error">{error}</div>}

          <div className="auth__field">
            <label className="auth__label" htmlFor="register-email">Email</label>
            <input
              id="register-email"
              className="auth__input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth__field">
            <label className="auth__label" htmlFor="register-username">Username</label>
            <input
              id="register-username"
              className="auth__input"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <span className="auth__hint">3-30 characters. Letters, numbers, underscores.</span>
          </div>

          <div className="auth__field">
            <label className="auth__label" htmlFor="register-password">Password</label>
            <input
              id="register-password"
              className="auth__input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <span className="auth__hint">At least {MIN_PASSWORD_LENGTH} characters.</span>
          </div>

          <button className="auth__submit" type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>

          <p className="auth__footer">
            Already have an account?{' '}
            <button
              className="auth__link"
              type="button"
              onClick={() => navigate('/login')}
            >
              Log in
            </button>
          </p>
        </form>
      </div>
    </PageLayout>
  );
}

export default Register;

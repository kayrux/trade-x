import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PageLayout from '../../components/layouts/PageLayout/PageLayout';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Return the user to whatever protected page bounced them here.
  const from = location.state?.from?.pathname || '/';

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <PageLayout>
      <div className="auth">
        <form className="auth__card" onSubmit={handleSubmit}>
          <h1 className="auth__title">Log in</h1>
          <p className="auth__subtitle">Welcome back to Trade X.</p>

          {error && <div className="auth__error">{error}</div>}

          <div className="auth__field">
            <label className="auth__label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="auth__input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth__field">
            <label className="auth__label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="auth__input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="auth__submit" type="submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>

          <p className="auth__footer">
            Don't have an account?{' '}
            <button
              className="auth__link"
              type="button"
              onClick={() => navigate('/register')}
            >
              Create one
            </button>
          </p>
        </form>
      </div>
    </PageLayout>
  );
}

export default Login;

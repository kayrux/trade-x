import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LayoutProvider } from './context/LayoutContext';
import { WatchlistProvider } from './context/WatchlistContext';
import { AccountProvider } from './context/AccountContext';
import { SnackbarProvider } from './context/SnackbarContext';
import { AuthProvider } from './context/AuthContext';
import RequireAuth from './components/RequireAuth';
import Home from './pages/Home/Home';
import SymbolPage from './pages/Symbol/SymbolPage';
import YouTuberPicks from './pages/YouTuberPicks/YouTuberPicks';
import VideoPicksDetail from './pages/YouTuberPicks/VideoPicksDetail';
import SyncHistoryPage from './pages/YouTuberPicks/SyncHistoryPage';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import Account from './pages/Account/Account';
import './App.css';

// Legacy /dashboard?symbol=AAPL links — bookmarks, shared URLs — land on the
// canonical symbol page.
function DashboardRedirect() {
  const [searchParams] = useSearchParams();
  const symbol = searchParams.get('symbol');
  return <Navigate to={symbol ? `/symbol/${encodeURIComponent(symbol)}` : '/'} replace />;
}

function App() {
  return (
    <ThemeProvider>
      {/* Wraps AuthProvider so auth can raise its own messages. */}
      <SnackbarProvider>
        <AuthProvider>
          <LayoutProvider>
            <WatchlistProvider>
              <AccountProvider>
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/symbol/:ticker" element={<SymbolPage />} />
                    <Route path="/dashboard" element={<DashboardRedirect />} />
                    <Route path="/picks" element={<YouTuberPicks />} />
                    <Route path="/picks/video/:videoId" element={<VideoPicksDetail />} />
                    <Route path="/picks/sync-history" element={<SyncHistoryPage />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route
                      path="/account"
                      element={
                        <RequireAuth>
                          <Account />
                        </RequireAuth>
                      }
                    />
                  </Routes>
                </BrowserRouter>
              </AccountProvider>
            </WatchlistProvider>
          </LayoutProvider>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LayoutProvider } from './context/LayoutContext';
import { SnackbarProvider } from './context/SnackbarContext';
import { AuthProvider } from './context/AuthContext';
import RequireAuth from './components/RequireAuth';
import Home from './pages/Home/Home';
import Dashboard from './pages/Dashboard/Dashboard';
import Watchlist from './pages/Watchlist/Watchlist';
import YouTuberPicks from './pages/YouTuberPicks/YouTuberPicks';
import VideoPicksDetail from './pages/YouTuberPicks/VideoPicksDetail';
import SyncHistoryPage from './pages/YouTuberPicks/SyncHistoryPage';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import Account from './pages/Account/Account';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      {/* Wraps AuthProvider so auth can raise its own messages. */}
      <SnackbarProvider>
        <AuthProvider>
          <LayoutProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/watchlist" element={<Watchlist />} />
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
          </LayoutProvider>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;

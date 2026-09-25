import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LayoutProvider } from './context/LayoutContext';
import Home from './pages/Home/Home';
import Dashboard from './pages/Dashboard/Dashboard';
import Watchlist from './pages/Watchlist/Watchlist';
import YouTuberPicks from './pages/YouTuberPicks/YouTuberPicks';
import VideoPicksDetail from './pages/YouTuberPicks/VideoPicksDetail';
import SyncHistoryPage from './pages/YouTuberPicks/SyncHistoryPage';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <LayoutProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/picks" element={<YouTuberPicks />} />
            <Route path="/picks/video/:videoId" element={<VideoPicksDetail />} />
            <Route path="/picks/sync-history" element={<SyncHistoryPage />} />
          </Routes>
        </BrowserRouter>
      </LayoutProvider>
    </ThemeProvider>
  );
}

export default App;

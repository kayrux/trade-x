import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Home from './pages/Home/Home';
import Dashboard from './pages/Dashboard/Dashboard';
import YouTuberPicks from './pages/YouTuberPicks/YouTuberPicks';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/picks" element={<YouTuberPicks />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

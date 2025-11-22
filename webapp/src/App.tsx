import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { initTelegramWebApp } from './utils/telegram';
import Home from './pages/Home';
import Upload from './pages/Upload';
import Puzzle from './pages/Puzzle';
import Profile from './pages/Profile';
import Claim from './pages/Claim';
import Report from './pages/Report';
import Marketplace from './pages/Marketplace';

function App() {
  useEffect(() => {
    initTelegramWebApp();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/puzzle" element={<Puzzle />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/claim" element={<Claim />} />
        <Route path="/report" element={<Report />} />
      </Routes>
    </Router>
  );
}

export default App;


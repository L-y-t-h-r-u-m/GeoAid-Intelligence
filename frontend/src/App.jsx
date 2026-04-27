import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import NgoPortal from './components/NgoPortal';
import ImpactStats from './components/ImpactStats';
import ProfileLeaderboard from './components/ProfileLeaderboard';
import AuthModal from './components/AuthModal';

const API_BASE = 'http://localhost:5000/api';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [missions, setMissions] = useState([]);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [pickedCoords, setPickedCoords] = useState(null);

  const fetchTasks = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const parsed = data.map(m => {
          // Normalise urgency — Task model uses `priority`, Survey model uses `urgency`
          const urgencyLevel = m.priority || m.urgency || 'Medium';

          const THEME_MAP = {
            Critical: { bg: 'bg-rose-500',    text: 'text-rose-500',    glow: 'shadow-rose-500/30' },
            High:     { bg: 'bg-amber-500',   text: 'text-amber-500',   glow: 'shadow-amber-500/30' },
            Medium:   { bg: 'bg-indigo-500',  text: 'text-indigo-500',  glow: 'shadow-indigo-500/30' },
            Low:      { bg: 'bg-emerald-500', text: 'text-emerald-500', glow: 'shadow-emerald-500/30' },
          };
          const theme = THEME_MAP[urgencyLevel] || THEME_MAP['Medium'];

          return {
            ...m,
            id: m._id || m.id,
            priority: urgencyLevel,
            coords: m.lat && m.lon ? [m.lat, m.lon] : [40.7128, -74.0060],
            theme
          };
        });
        setMissions(parsed);
      }
    } catch (err) {
      console.error('Failed to fetch global tasks:', err);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  const handleLogin = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', authToken);
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  const navProps = {
    navigateToMap: () => setCurrentView('dashboard'),
    navigateToPortal: () => {
      if (user) setCurrentView('ngo');
      else setShowAuthModal(true);
    },
    navigateToAnalytics: () => {
      if (user?.role === 'ngo_admin') setCurrentView('analytics');
      else if (user) setCurrentView('dashboard');
      else setShowAuthModal(true);
    },
    navigateToProfile: () => setCurrentView('profile'),
    isDarkMode,
    toggleTheme,
    user,
    onSignInClick: () => setShowAuthModal(true),
    onSignOutClick: handleLogout,
    missions,
    setMissions,
    fetchTasks,
    isPickingLocation,
    setIsPickingLocation,
    pickedCoords,
    setPickedCoords
  };

  return (
    <>
      {currentView === 'dashboard' && <Dashboard {...navProps} />}
      {currentView === 'ngo' && <NgoPortal {...navProps} />}
      {currentView === 'analytics' && (user?.role === 'ngo_admin' ? <ImpactStats {...navProps} /> : <Dashboard {...navProps} />)}
      {currentView === 'profile' && <ProfileLeaderboard {...navProps} />}

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onLogin={handleLogin}
        />
      )}
    </>
  );
}

export default App;

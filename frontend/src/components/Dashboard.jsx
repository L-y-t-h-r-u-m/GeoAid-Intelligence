import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Home, Building2, BarChart3, AlertTriangle,
  Search, User, MapPin, Sun, Moon, CheckCircle2,
  Clock, Sparkles, Zap, SlidersHorizontal, X, Trash2, Target
} from 'lucide-react';
import { useEffect } from 'react';

// ── Map Controller ─────────────────────────────────────────────────────────────
function MapController({ coords, onMapClick }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 14, { duration: 1.5, easeLinearity: 0.25 });
  }, [coords, map]);
  
  const mapEvents = useMapEvents({
    click: (e) => {
      onMapClick([e.latlng.lat, e.latlng.lng]);
    }
  });
  
  return null;
}

const createIcon = (colorClass, isCritical) => L.divIcon({
  className: 'custom-icon',
  html: `
    <div class="relative flex items-center justify-center w-6 h-6">
      ${isCritical ? `<div class="absolute inset-0 bg-rose-500 rounded-full animate-ping opacity-60"></div>` : ''}
      <div class="relative z-10 w-4 h-4 rounded-full border-2 border-white ${colorClass}"></div>
    </div>
  `,
  iconSize: [24, 24], iconAnchor: [12, 12],
});

const focalIcon = L.divIcon({
  className: 'focal-icon',
  html: `
    <div class="relative flex items-center justify-center w-10 h-10">
      <div class="absolute inset-0 bg-indigo-500 rounded-full animate-pulse opacity-20 scale-150"></div>
      <div class="relative z-10 w-6 h-6 rounded-full border-4 border-white bg-indigo-600 shadow-xl flex items-center justify-center">
        <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
      </div>
    </div>
  `,
  iconSize: [40, 40], iconAnchor: [20, 20],
});

// ── Haversine ─────────────────────────────────────────────────────────────────
function haversineKm([lat1, lon1], [lat2, lon2]) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


// ── Skill Panel ─────────────────────────────────────────────────────────────
function SkillPanel({ skills, onChange, onClose }) {
  const ALL_SKILLS = ['Medical', 'Logistics', 'Emergency', 'Infrastructure', 'Food', 'Water'];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="absolute bottom-[120%] left-0 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 p-5 rounded-3xl shadow-2xl z-50 backdrop-blur-xl"
    >
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" /> My Capabilities
        </h4>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {ALL_SKILLS.map(s => {
          const active = skills.includes(s);
          return (
            <button key={s} onClick={() => onChange(active ? skills.filter(x => x !== s) : [...skills, s])}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${active ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
              {s}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

const API_BASE = 'http://localhost:5000/api';

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard({ 
  navigateToMap, navigateToPortal, navigateToAnalytics, navigateToProfile, 
  isDarkMode, toggleTheme, user, onSignInClick, onSignOutClick,
  missions, setMissions, isPickingLocation, setIsPickingLocation, setPickedCoords 
}) {
  const token = localStorage.getItem('token');
  const [flippedCardId,   setFlippedCardId]   = useState(null);
  const [activeTask,      setActiveTask]       = useState(missions[0] || null);
  const [rangeKm,         setRangeKm]          = useState(200);
  const [userCoords,      setUserCoords]       = useState([40.7150, -73.9980]); // Default to simulation center
  const [mapZoomCoords,   setMapZoomCoords]    = useState(null);
  const [searchQuery,     setSearchQuery]      = useState('');
  const [focalCoords,     setFocalCoords]      = useState([40.7150, -73.9980]); // Center of geofence
  const [smartMatch,      setSmartMatch]       = useState(false);
  const [volunteerSkills, setVolunteerSkills]  = useState(['Medical', 'Logistics']);
  const [showSkillPanel,  setShowSkillPanel]   = useState(false);
  const [ongoingTask,     setOngoingTask]      = useState(null);

  // Vouching handler
  const handleVouch = async (missionId) => {
    if (!user) {
      if (onSignInClick) onSignInClick();
      return;
    }
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/tasks/${missionId}/vouch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        // Update local state with the returned task or refresh missions
        setMissions(prev => prev.map(m => (m._id === missionId || m.id === missionId) ? { ...m, ...data.task } : m));
      } else {
        console.error(data.message);
      }
    } catch (err) {
      console.error('Vouch failed:', err);
    }
  };


  // Get actual geolocation and set initial focal point
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setUserCoords(coords);
        setFocalCoords(coords);
      });
    }
  }, []);

  const handlePlaceSearch = async (query) => {
    if (!query || query.length < 3) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const coords = [parseFloat(lat), parseFloat(lon)];
        setMapZoomCoords(coords);
        setFocalCoords(coords);
      }
    } catch (err) {
      console.error('Geocoding failed:', err);
    }
  };

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  // Process distance to user
  const processedMissions = useMemo(() =>
    missions.map(m => ({ 
      ...m, 
      distanceKm: haversineKm(focalCoords, m.coords)
    })),
    [focalCoords, missions]
  );

  // Filter by range and moderation
  const displayMissions = useMemo(() => {
    let filtered = processedMissions.filter(m => {
      const isAdmin = user?.role === 'ngo_admin';
      
      if (isAdmin) {
        if (m.status === 'resolved') return false;
        if (m.distanceKm > rangeKm) return false;
      } else {
        if (m.status === 'Moderation' || m.status === 'resolved') return false;
        
        // Shadow Verification / Geofence Filter
        const limit = Math.min(m.radiusLimit || 200, rangeKm);
        if (m.distanceKm > limit) return false;

        // Visibility Condition A (urgency >= 4) or B (status === 'verified')
        const urgencyScore = m.urgencyScore || 2;
        const isBypass = urgencyScore >= 4 || m.urgency === 'Critical' || m.urgency === 'High';
        const isVerified = m.status === 'verified' || m.verificationStatus === 'Verified';
        
        if (!isBypass && !isVerified) return false;

        // Smart Match functionality
        if (smartMatch) {
          const textToMatch = `${m.title || ''} ${m.description || ''} ${m.category || ''} ${m.requiredSkill || ''}`.toLowerCase();
          const hasRequiredSkill = volunteerSkills.some(s => textToMatch.includes(s.toLowerCase()));
          if (!hasRequiredSkill && volunteerSkills.length > 0) return false;
        }
      }

      // Search filter
      if (searchQuery.length > 0) {
        const query = searchQuery.toLowerCase();
        const matches = 
          (m.title && m.title.toLowerCase().includes(query)) || 
          (m.description && m.description.toLowerCase().includes(query)) ||
          (m.requiredSkill && m.requiredSkill.toLowerCase().includes(query)) ||
          (m.category && m.category.toLowerCase().includes(query));
        if (!matches) return false;
      }
      
      return true;
    });

    // Default sorting
    return [...filtered].sort((a, b) => a.distanceKm - b.distanceKm);
  }, [processedMissions, user, searchQuery, rangeKm, volunteerSkills, smartMatch]);

  const mapTiles = isDarkMode
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors duration-500 text-slate-800 dark:text-slate-100 font-sans">

      {/* Map */}
      <div className="absolute inset-0 z-0">
        <MapContainer center={userCoords} zoom={13} className="w-full h-full z-0">
          <TileLayer url={isDarkMode ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"} />
          <MapController coords={mapZoomCoords} onMapClick={(coords) => {
            if (isPickingLocation) {
              setPickedCoords(coords);
              setIsPickingLocation(false);
              navigateToPortal();
            } else {
              setFocalCoords(coords);
            }
          }} />
          
          {/* Focal Point Marker */}
          <Marker position={focalCoords} icon={focalIcon} zIndexOffset={1000} />

          {displayMissions.map(m => (
            <Marker key={m.id} position={m.coords}
              icon={createIcon(m.theme.bg, m.priority === 'Critical')}
              eventHandlers={{ click: () => setActiveTask(m) }} />
          ))}
        </MapContainer>
        <div className="absolute inset-0 bg-white/10 dark:bg-slate-900/40 pointer-events-none z-10" />
      </div>

      {/* Top Nav */}
      <header className="absolute top-6 left-6 right-6 z-20 flex justify-between items-center pointer-events-none">
        <div className="pl-24 w-full max-w-xl pointer-events-auto flex gap-3">
          <div className="relative group flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input type="text" placeholder="Search any place (e.g. Tokyo)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handlePlaceSearch(searchQuery);
                  
                  // Also check local missions
                  const match = missions.find(m => 
                    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    m.description.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                  if (match) {
                    setMapZoomCoords(match.coords);
                    setFocalCoords(match.coords);
                  }
                }
              }}
              className="w-full bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-full py-3.5 pl-12 pr-4 outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-lg transition-all text-sm" />
          </div>
          <button 
            onClick={() => { setFocalCoords(userCoords); setMapZoomCoords(userCoords); }}
            className="w-12 h-12 shrink-0 flex items-center justify-center bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-full hover:bg-indigo-500 hover:text-white transition-all shadow-lg group"
            title="Reset to my location"
          >
            <Target className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>
        {isPickingLocation && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-3 border border-indigo-400"
          >
            <MapPin className="w-5 h-5 animate-bounce" />
            <span className="font-bold">Click on Map to select task location</span>
            <button onClick={() => setIsPickingLocation(false)} className="ml-4 p-1 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
        <div className="flex gap-4 items-center pointer-events-auto">
          {user ? (
            <div className="flex items-center gap-3 bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 px-4 py-2 rounded-full shadow-lg">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Hi, {user.name.split(' ')[0]}</span>
              <button onClick={onSignOutClick} className="text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors">Sign Out</button>
            </div>
          ) : (
            <button onClick={onSignInClick} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-full shadow-lg transition-colors">
              Sign In
            </button>
          )}

          <button onClick={toggleTheme} className="w-12 h-12 flex items-center justify-center rounded-full bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-700/50 shadow-lg text-slate-600 dark:text-slate-300 transition-all">
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          {user && (
            <button onClick={navigateToProfile} className="w-12 h-12 flex items-center justify-center rounded-full bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 shadow-lg text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <User className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Sidebar */}
      <nav className="absolute left-6 top-1/2 -translate-y-1/2 z-30 pointer-events-auto">
          <ul className="bg-white/70 dark:bg-slate-800/80 backdrop-blur-2xl border border-slate-200 dark:border-slate-700/50 rounded-full p-2 flex flex-col gap-2 shadow-2xl">
            {[
              { icon: <Home className="w-5 h-5" />, active: true, id: 'home' },
              { icon: <Building2 className="w-5 h-5" />, id: 'ngo' },
              { icon: <BarChart3 className="w-5 h-5" />, id: 'analytics', role: 'ngo_admin' },
            ].filter(item => {
              if (!user) return item.id === 'home';
              if (item.role && user.role !== item.role) return false;
              return true;
            })
            .map((item, idx) => (
              <li key={idx}>
                <button
                  onClick={() => {
                    if (item.id === 'ngo' && navigateToPortal) navigateToPortal();
                    if (item.id === 'analytics' && navigateToAnalytics) navigateToAnalytics();
                  }}
                  className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${item.active ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-500 shadow-inner' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'}`}>
                  {item.icon}
                </button>
              </li>
            ))}
          </ul>
        </nav>

      {/* Bottom Glass + Cards */}
      <div className="absolute bottom-0 left-0 w-full h-[50%] bg-gradient-to-t from-white via-white/80 to-transparent dark:from-slate-900/95 dark:via-slate-900/60 dark:to-transparent backdrop-blur-[1px] z-20 flex flex-col justify-end pointer-events-none pb-8 transition-colors duration-500">

        {/* Toolbar */}
        <div className="w-full px-24 mb-3 flex items-center gap-3 pointer-events-auto relative">
          {user?.role !== 'ngo_admin' && (
            <button
              onClick={() => setSmartMatch(s => !s)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border transition-all duration-200 ${
                smartMatch
                  ? 'bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/30'
                  : 'bg-white/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/50 backdrop-blur-xl'
              }`}>
              <Zap className={`w-3.5 h-3.5 ${smartMatch ? 'text-white' : 'text-indigo-400'}`} />
              Smart Match
            </button>
          )}

          {user?.role !== 'ngo_admin' && (
            <div className="relative">
              <button
                onClick={() => setShowSkillPanel(s => !s)}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border bg-white/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/50 backdrop-blur-xl hover:border-indigo-400 transition-all">
                <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                My Skills
                <span className="ml-0.5 bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {volunteerSkills.length}
                </span>
              </button>
              <AnimatePresence>
                {showSkillPanel && (
                  <SkillPanel
                    skills={volunteerSkills}
                    onChange={s => { setVolunteerSkills(s); }}
                    onClose={() => setShowSkillPanel(false)}
                  />
                )}
              </AnimatePresence>
            </div>
          )}

          {smartMatch && (
            <motion.p initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              className="text-xs text-indigo-500 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-full">
              Showing only tasks matching your skills
            </motion.p>
          )}

          <div className="ml-auto flex items-center gap-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 px-6 py-2.5 rounded-2xl shadow-sm group">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none mb-1">Range Filter</span>
              <span className="text-sm font-black text-slate-900 dark:text-white leading-none">{rangeKm} KM</span>
            </div>
            <input 
              type="range" min="1" max="200" value={rangeKm} 
              onChange={(e) => setRangeKm(parseInt(e.target.value))}
              className="w-32 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              style={{
                background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${(rangeKm / 200) * 100}%, #e2e8f0 ${(rangeKm / 200) * 100}%, #e2e8f0 100%)`
              }}
            />
          </div>
        </div>

        {/* Card Row */}
        <div className="w-full flex gap-5 overflow-x-auto snap-x snap-mandatory px-24 pb-6 pt-3 no-scrollbar pointer-events-auto" style={{ scrollPaddingLeft: '6rem' }}>
          <AnimatePresence mode="popLayout">
            {displayMissions.map((mission, idx) => {
              const isFlipped      = flippedCardId === mission.id;
              const isActive       = activeTask?.id  === mission.id;
              const isHighPriority = mission.priority === 'Urgent' || mission.urgency === 'Urgent';


              return (
                <motion.div
                  key={mission.id}
                  layout
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 24 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 26, delay: idx * 0.04 }}
                  className="perspective-1000 shrink-0 snap-center"
                >
                  <motion.div
                    className="w-80 h-56 relative preserve-3d cursor-pointer"
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    onClick={() => { 
                      setActiveTask(mission); 
                      setFlippedCardId(isFlipped ? null : mission.id); 
                      setShowSkillPanel(false);
                      if (mission.coords) setMapZoomCoords(mission.coords);
                    }}
                  >
                    {/* ── FRONT ── */}
                    <div className={`absolute inset-0 backface-hidden bg-white dark:bg-slate-800 backdrop-blur-2xl border rounded-[2rem] p-6 flex flex-col justify-between transition-all duration-300 ${
                      isActive
                        ? 'border-indigo-500 shadow-indigo-500/25 shadow-2xl ring-2 ring-indigo-500/20'
                        : isHighPriority
                        ? 'border-indigo-300/60 dark:border-indigo-500/30 shadow-xl'
                        : 'border-white/50 dark:border-slate-700/50 shadow-xl'
                    }`}>

                      <div className="flex justify-between items-start">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full backdrop-blur-md border ${
                          {
                            Critical: 'bg-rose-500/90 text-white border-rose-400',
                            High: 'bg-amber-500/90 text-white border-amber-400',
                            Medium: 'bg-indigo-500/90 text-white border-indigo-400',
                            Low: 'bg-emerald-500/90 text-white border-emerald-400'
                          }[mission.priority || mission.urgency || 'Medium'] || 'bg-indigo-500/90 text-white border-indigo-400'
                        }`}>
                          {mission.priority || mission.urgency || 'Medium'}
                        </span>
                        <div className="flex items-center text-sm font-medium text-slate-500 dark:text-slate-400">
                          <MapPin className="w-4 h-4 mr-1" />
                          {mission.distanceKm.toFixed(1)}km
                        </div>
                      </div>

                      <div className="mt-2">
                        <h3 className="text-xl font-bold mb-0.5">{mission.title}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 opacity-60">Tap to expand details</p>
                      </div>

                      <div className="mt-4 border-t border-slate-200 dark:border-slate-700/50 pt-3 flex justify-between items-center relative">
                        {mission.verificationStatus === 'Verified' || mission.status === 'verified' ? (
                          <span className="px-2 py-1 text-[11px] font-bold rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 
                            {mission.verifiedBy === 'NGO Admin' || mission.creatorRole === 'NGO' ? 'NGO Vouched' : 'Community Vouched'}
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 text-[11px] font-bold rounded-lg bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> Pending
                            </span>
                            {user?.role !== 'ngo_admin' && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleVouch(mission._id || mission.id);
                                }}
                                className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1 group/vouch ${
                                  mission.vouches?.includes(user?.id) 
                                    ? 'bg-emerald-500 text-white border-emerald-400' 
                                    : 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500 hover:text-white hover:border-amber-400'
                                }`}
                              >
                                <Target className="w-3.5 h-3.5 group-hover/vouch:animate-spin" /> 
                                Vouch ({mission.vouches?.length || 0}/4)
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                    </div>

                    {/* ── BACK ── */}
                    <div
                      className="absolute inset-0 backface-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600/50 rounded-[2rem] p-5 flex flex-col justify-between shadow-2xl"
                      style={{ transform: 'rotateY(180deg)' }}
                    >
                      <div>
                        <h3 className={`text-lg font-bold mb-2 ${mission.theme.text}`}>Task Intelligence</h3>
                        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-3">{mission.description || mission.aiSummary}</p>
                      </div>
                      <div className="flex flex-col gap-2 mt-3">
                        {user?.role === 'ngo_admin' ? (
                          <div className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-xl text-center">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Admin View Mode</span>
                          </div>
                        ) : (() => {
                          const textToMatch = `${mission.title || ''} ${mission.description || ''} ${mission.category || ''} ${mission.requiredSkill || ''}`.toLowerCase();
                          const hasRequiredSkill = volunteerSkills.some(s => textToMatch.includes(s.toLowerCase()));
                          const isPending = mission.status !== 'verified' && mission.verificationStatus !== 'Verified';
                          
                          return (
                            <div className="space-y-2">
                              {isPending && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleVouch(mission._id || mission.id);
                                  }}
                                  className={`w-full py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                                    mission.vouches?.includes(user?.id)
                                      ? 'bg-emerald-500 text-white border-emerald-400'
                                      : 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20'
                                  }`}
                                >
                                  <Target className="w-4 h-4" /> 
                                  {mission.vouches?.includes(user?.id) ? 'Vouched' : `Vouch for this Need (${mission.vouches?.length || 0}/4)`}
                                </button>
                              )}

                              <button
                                disabled={!hasRequiredSkill || isPending}
                                className={`w-full py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-transform ${
                                  hasRequiredSkill && !isPending
                                    ? `active:scale-95 ${mission.theme.bg} ${mission.theme.glow}`
                                    : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-60 shadow-none'
                                }`}
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if(hasRequiredSkill && !isPending) setOngoingTask(mission); 
                                }}>
                                {isPending ? 'Needs Verification' : hasRequiredSkill ? 'Accept Task' : 'Skill Missing'}
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div className="w-12 shrink-0" />
        </div>
        
        {/* Ongoing Task Banner */}
        <AnimatePresence>
          {ongoingTask && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-lg bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-indigo-200 dark:border-indigo-500/50 rounded-[2rem] p-5 shadow-2xl flex items-center justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="animate-pulse w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Active Operation</span>
                </div>
                <h3 className="font-bold text-slate-800 dark:text-white text-base leading-tight truncate max-w-[200px]">{ongoingTask.title}</h3>
              </div>
              <button onClick={() => {
                setMissions(prev => prev.map(m => m.id === ongoingTask.id ? { ...m, status: 'Moderation' } : m));
                setOngoingTask(null);
                setActiveTask(null);
              }} className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/30 text-white font-bold text-sm transition-all active:scale-95 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Complete Task
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

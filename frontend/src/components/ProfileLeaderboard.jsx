import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CheckCircle2, User, Calendar, MapPin, Activity } from 'lucide-react';

const API_BASE = 'https://geoaid-intelligence.onrender.com/api';

function haversineKm([lat1, lon1], [lat2, lon2]) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function ProfileLeaderboard({ navigateToMap, navigateToPortal, navigateToAnalytics, isDarkMode, toggleTheme, user }) {
  const isAdmin = user?.role === 'ngo_admin';
  const [resolvedTasks, setResolvedTasks] = useState([]);
  const [userCoords, setUserCoords] = useState([40.7150, -73.9980]); // Default
  const [skills, setSkills] = useState(user?.skills || ['Medical', 'Logistics']);
  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserCoords([pos.coords.latitude, pos.coords.longitude]);
      });
    }

    const fetchTasks = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE}/surveys`, { headers });
        const data = await res.json();
        // Filter for verified or resolved tasks for the user's service record
        const filtered = data.filter(t => t.status === 'resolved' || t.status === 'verified' || t.verificationStatus === 'Verified');
        setResolvedTasks(filtered);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTasks();
  }, []);

  // Process distance for records
  const recordsWithDistance = resolvedTasks.map(task => ({
    ...task,
    distanceKm: haversineKm(userCoords, [task.lat, task.lon])
  })).filter(t => t.distanceKm <= 200).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  const profile = {
    name: user?.name || (isAdmin ? 'NGO Manager' : 'Field Responder'),
    role: isAdmin ? 'NGO Manager' : 'Volunteer',
    totalTasks: recordsWithDistance.length,
    activeSince: 'Jan 2026',
  };

  const handleAddSkill = async () => {
    if (!newSkill.trim() || skills.includes(newSkill.trim())) return;
    const updatedSkills = [...skills, newSkill.trim()];
    setSkills(updatedSkills);
    setNewSkill('');
    saveSkillsToBackend(updatedSkills);
  };

  const handleRemoveSkill = async (skillToRemove) => {
    const updatedSkills = skills.filter(s => s !== skillToRemove);
    setSkills(updatedSkills);
    saveSkillsToBackend(updatedSkills);
  };

  const saveSkillsToBackend = async (updatedSkills) => {
    if (!user || !user._id) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE}/users/${user._id}/skills`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ skills: updatedSkills })
      });
      // Optionally update local storage user payload
      const storedUser = JSON.parse(localStorage.getItem('user'));
      if (storedUser) {
        storedUser.skills = updatedSkills;
        localStorage.setItem('user', JSON.stringify(storedUser));
      }
    } catch (err) {
      console.error('Failed to update skills:', err);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300 pb-20">
      
      {/* ── Top Nav ── */}
      <header className="sticky top-0 z-30 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700/50 p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-500" />
            Service Record
          </h1>
        </div>
        <div className="flex gap-2">
          <button onClick={navigateToMap} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors">Map</button>
          {isAdmin && (
            <>
              <button onClick={navigateToPortal} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors">Portal</button>
              <button onClick={navigateToAnalytics} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors">Analytics</button>
            </>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 mt-6 space-y-8">
        
        {/* ── Professional Resume Header ── */}
        <section className="bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-[2rem] p-8 shadow-sm flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 p-1 shrink-0">
            <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
              <User className="w-10 h-10 text-emerald-500" />
            </div>
          </div>
          
          <div className="flex-1 text-center md:text-left z-10">
            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
              <h2 className="text-3xl font-black text-slate-800 dark:text-white">{profile.name}</h2>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 w-fit mx-auto md:mx-0">
                {profile.role}
              </span>
            </div>
            {isAdmin ? (
              <p className="text-slate-500 dark:text-slate-400 max-w-lg italic">
                Manage volunteer performance, review disaster response efforts, and audit high-impact tasks.
              </p>
            ) : (
              <p className="text-slate-500 dark:text-slate-400 max-w-lg">Certified field responder. All recorded actions are verified impact events.</p>
            )}
          </div>
        </section>

        {/* ── Impact Vitals ── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-700/50 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Tasks Resolved</p>
              <p className="text-3xl font-black text-slate-800 dark:text-white">{profile.totalTasks}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-700/50 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Active Since</p>
              <p className="text-3xl font-black text-slate-800 dark:text-white">{profile.activeSince}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-indigo-500" />
            </div>
          </div>
        </section>



        {/* ── Certified Skills ── */}
        {!isAdmin && (
          <section className="bg-white/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-[2rem] p-8 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-indigo-500"/> Certified Skills</h3>
              <button onClick={() => setIsEditingSkills(!isEditingSkills)} className="text-xs font-bold text-indigo-500 hover:text-indigo-600 transition-colors">
                {isEditingSkills ? 'Done' : 'Edit'}
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {skills.map(skill => (
                <span key={skill} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 flex items-center gap-2">
                  {skill}
                  {isEditingSkills && (
                    <button onClick={() => handleRemoveSkill(skill)} className="hover:text-rose-500 transition-colors">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </span>
              ))}
              {skills.length === 0 && !isEditingSkills && (
                <span className="text-sm text-slate-400 italic">No skills listed yet.</span>
              )}
            </div>

            {isEditingSkills && (
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                  placeholder="Add a new skill..."
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button onClick={handleAddSkill} className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors">
                  Add
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Record List ── */}
        <section className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><CheckCircle2 className="w-5 h-5 text-emerald-500"/> Verified Operations</h3>
          {recordsWithDistance.length > 0 ? recordsWithDistance.map((task) => (
            <div key={task._id || task.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 flex items-center gap-4 hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="flex-1">
                <h4 className="font-bold text-slate-800 dark:text-white text-lg">{task.title || task.aiSummary || task.category || 'General Task'}</h4>
                <div className="text-xs font-semibold text-slate-500 flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5"/> {task.distanceKm.toFixed(1)} km away</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5"/> {new Date(task.updatedAt || task.createdAt || Date.now()).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Verified
                </span>
              </div>
            </div>
          )) : (
             <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[2rem]">
                <Activity className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg font-bold text-slate-600 dark:text-slate-300">No verified tasks yet.</h3>
                <p className="text-sm text-slate-400">Complete field operations to build your service record.</p>
             </div>
          )}
        </section>
      </div>
    </div>
  );
}

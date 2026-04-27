import React, { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  Search, Home, Building2, BarChart3, User, Activity, AlertTriangle, TrendingUp, Target, Sun, Moon, LayoutDashboard
} from 'lucide-react';

// ── Data ──────────────────────────────────────────────────────────────────────

const RESOURCES = [
  { label: 'Food Packets', needed: 2400, available: 1450, color: '#3B82F6', darkColor: '#60A5FA' },
  { label: 'Water (L)',    needed: 8000, available: 5200, color: '#6366F1', darkColor: '#818CF8' },
  { label: 'Blankets',    needed: 900,  available: 620,  color: '#22C55E', darkColor: '#4ADE80' },
  { label: 'Medical Kits',needed: 500,  available: 320,  color: '#F59E0B', darkColor: '#FCD34D' },
  { label: 'Tarpaulins',  needed: 300,  available: 190,  color: '#EC4899', darkColor: '#F472B6' },
];

const TREND_DATA = [
  { day: 'Mon', accepted: 12, completed: 8  },
  { day: 'Tue', accepted: 9,  completed: 6  },
  { day: 'Wed', accepted: 18, completed: 14 },
  { day: 'Thu', accepted: 15, completed: 11 },
  { day: 'Fri', accepted: 24, completed: 19 },
  { day: 'Sat', accepted: 31, completed: 26 },
  { day: 'Sun', accepted: 28, completed: 23 },
];

const MONTHLY_TREND_DATA = [
  { day: 'Wk 1', accepted: 68,  completed: 51  },
  { day: 'Wk 2', accepted: 84,  completed: 63  },
  { day: 'Wk 3', accepted: 112, completed: 89  },
  { day: 'Wk 4', accepted: 97,  completed: 78  },
];

const YEARLY_TREND_DATA = [
  { day: 'Jan', accepted: 210, completed: 158 },
  { day: 'Feb', accepted: 185, completed: 141 },
  { day: 'Mar', accepted: 264, completed: 207 },
  { day: 'Apr', accepted: 298, completed: 236 },
  { day: 'May', accepted: 321, completed: 261 },
  { day: 'Jun', accepted: 344, completed: 289 },
  { day: 'Jul', accepted: 309, completed: 248 },
  { day: 'Aug', accepted: 276, completed: 219 },
  { day: 'Sep', accepted: 331, completed: 274 },
  { day: 'Oct', accepted: 358, completed: 302 },
  { day: 'Nov', accepted: 387, completed: 321 },
  { day: 'Dec', accepted: 412, completed: 349 },
];

// ── Local dataset — ~200km radius subset (~40% of global) ──────────────────────────────
const LOCAL_RESOURCES = RESOURCES.map(r => ({
  ...r,
  needed:    Math.round(r.needed    * 0.4),
  available: Math.round(r.available * 0.38),
}));

const scaleData = (data, factor = 0.41) =>
  data.map(d => ({ ...d, accepted: Math.round(d.accepted * factor), completed: Math.round(d.completed * (factor - 0.01)) }));

const LOCAL_TREND_DATA         = scaleData(TREND_DATA);
const LOCAL_MONTHLY_TREND_DATA = scaleData(MONTHLY_TREND_DATA);
const LOCAL_YEARLY_TREND_DATA  = scaleData(YEARLY_TREND_DATA);

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedNumber({ value }) {
  const [display, setDisplay] = React.useState(0);
  useEffect(() => {
    let current = 0;
    const step = Math.ceil(value / 30);
    const interval = setInterval(() => {
      current += step;
      if (current >= value) {
        current = value;
        clearInterval(interval);
      }
      setDisplay(current);
    }, 30);
    return () => clearInterval(interval);
  }, [value]);
  return <span>{display.toLocaleString()}</span>;
}

// ── Supply Gap Row ────────────────────────────────────────────────────────────
// TTZ = estimated hours until stock depletes at current demand rate
// Assumes a steady consumption rate of (needed - available) units over 48h
function computeTTZ(available, needed) {
  const rate = (needed - available) / 48; // units consumed per hour
  if (rate <= 0) return null;
  const hours = Math.round(available / rate);
  if (hours >= 72) return null; // not urgent enough to show
  return hours;
}

function GapRow({ item, index }) {
  const pct      = Math.round(item.available / item.needed * 100);
  const deficit  = item.needed - item.available;
  const critical = pct < 65;
  const ttz      = computeTTZ(item.available, item.needed);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1,  x: 0   }}
      transition={{ delay: index * 0.07 }}
      className="flex flex-col gap-1.5"
    >
      <div className="flex justify-between text-xs">
        <span className="font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
        <span className={critical ? 'text-rose-500 font-bold' : 'text-slate-400'}>
          −{deficit.toLocaleString()} short
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-200/60 dark:bg-slate-700/40 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-indigo-500"
          style={{ opacity: critical ? 1 : 0.55 }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: index * 0.07 + 0.2 }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400">
        <span className="flex flex-col leading-tight">
          <span>{item.available.toLocaleString()} available</span>
          {ttz != null && (
            <span className={`font-semibold mt-0.5 ${
              ttz <= 12 ? 'text-rose-500' : ttz <= 24 ? 'text-amber-500' : 'text-slate-400'
            }`}>
              ~{ttz}h remaining
            </span>
          )}
        </span>
        <span>{pct}% met</span>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ImpactStats({ navigateToMap, navigateToPortal, navigateToAnalytics, navigateToProfile, isDarkMode, toggleTheme, user, missions }) {
  const [viewScope,      setViewScope]      = React.useState('local');
  const [showGapTooltip, setShowGapTooltip] = React.useState(false);
  const [timePeriod,     setTimePeriod]     = React.useState('weekly'); // 'weekly' | 'monthly' | 'yearly'

  // ── Active dataset: scope × time period ────────────────────────────────────────────
  const activeResources = viewScope === 'local' ? LOCAL_RESOURCES : RESOURCES;

  const TREND_MAP = {
    weekly:  { global: TREND_DATA,         local: LOCAL_TREND_DATA         },
    monthly: { global: MONTHLY_TREND_DATA,  local: LOCAL_MONTHLY_TREND_DATA },
    yearly:  { global: YEARLY_TREND_DATA,   local: LOCAL_YEARLY_TREND_DATA  },
  };
  const activeTrend = TREND_MAP[timePeriod][viewScope === 'local' ? 'local' : 'global'];

  const PERIOD_LABEL = { weekly: 'Last 7 Days', monthly: 'Last 4 Weeks', yearly: 'Last 12 Months' };

  const criticalGaps   = activeResources.filter(r => r.available / r.needed < 0.65).length;
  const totalCompleted = activeTrend.reduce((s, d) => s + d.completed, 0);

  // Top 3 deficit categories for the Critical Gaps tooltip
  const topDeficits = [...activeResources]
    .filter(r => r.available / r.needed < 0.65)
    .sort((a, b) => (a.available / a.needed) - (b.available / b.needed))
    .slice(0, 3);
    
  // ── Mission Success Rate Logic ─────────────────────────────
  const tasksList = missions || [];
  const resolvedCount = tasksList.filter(t => t.status === 'resolved').length;
  const totalCount = tasksList.length;
  const successRate = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;

  const card = 'bg-white dark:bg-slate-800 shadow-xl border border-slate-200/50 dark:border-slate-700/50 rounded-3xl';

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300">

      {/* ── Top Nav (Floating Dashboard style) ── */}
      <header className="absolute top-6 left-6 right-6 z-20 flex justify-between items-center pointer-events-none">
        
        <div className="flex items-center gap-3 pointer-events-auto shrink-0 mr-6">
          <div className="hidden sm:block">
            <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white pointer-events-auto flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-500 shrink-0" />
              Impact Analytics
            </h1>
          </div>
          {/* Local / Global scope toggle */}
          <button
            onClick={() => setViewScope(v => v === 'local' ? 'global' : 'local')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all shadow-sm ${
              viewScope === 'local'
                ? 'bg-indigo-500 text-white border-indigo-400 shadow-indigo-500/30'
                : 'bg-white/70 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/60 hover:border-indigo-400 hover:text-indigo-500'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              viewScope === 'local' ? 'bg-white' : 'bg-emerald-400'
            }`} />
            {viewScope === 'local' ? '200km · Local' : 'Global · All'}
          </button>
        </div>

        <div className="flex-1 w-full max-w-xl pointer-events-auto" />
        
        <div className="flex gap-4 pointer-events-auto shrink-0">
          <button onClick={toggleTheme} className="w-12 h-12 flex items-center justify-center rounded-full bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-700/50 shadow-lg transition-all text-slate-500 dark:text-slate-400">
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={navigateToProfile} className="w-12 h-12 flex items-center justify-center rounded-full bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 shadow-lg text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            <User className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Sidebar (Floating Dashboard style) ── */}
      <nav className="absolute left-6 top-1/2 -translate-y-1/2 z-30 pointer-events-auto">
        <ul className="bg-white/70 dark:bg-slate-800/80 backdrop-blur-2xl border border-slate-200 dark:border-slate-700/50 rounded-full p-2 flex flex-col gap-2 shadow-2xl">
          {[
            { icon: <Home className="w-5 h-5" />, id: 'home' },
            { icon: <Building2 className="w-5 h-5" />, id: 'ngo', role: 'ngo_admin' },
            { icon: <BarChart3 className="w-5 h-5" />, active: true, id: 'analytics', role: 'ngo_admin' },
          ]
          .filter(item => !item.role || user?.role === item.role)
          .map((item, idx) => (
            <li key={idx}>
              <button
                onClick={() => {
                  if (item.id === 'home' && navigateToMap) navigateToMap();
                  if (item.id === 'ngo' && navigateToPortal) navigateToPortal();
                  if (item.id === 'analytics' && navigateToAnalytics) navigateToAnalytics();
                }}
                className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
                  item.active  ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' :
                  'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
                }`}>
                {item.icon}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Main Content Area ── */}
      <main className="w-full h-full overflow-y-auto pt-28 pl-32 pr-8 pb-12 no-scrollbar">
        <div className="max-w-6xl mx-auto grid grid-cols-12 gap-6">

          {/* ── Stat: Critical Gaps ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
            className={`col-span-12 md:col-span-4 ${card} p-8 flex flex-col justify-between min-h-[140px] relative`}
            onMouseEnter={() => setShowGapTooltip(true)}
            onMouseLeave={() => setShowGapTooltip(false)}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Critical Gaps</span>
              <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
            </div>
            <div>
              <div className="text-5xl font-extrabold text-slate-800 dark:text-white leading-none">
                <AnimatedNumber value={criticalGaps} />
              </div>
              <p className="text-xs text-amber-500 mt-2 font-medium">Resources below 65% supply</p>
            </div>

            {/* Hover tooltip — top 3 deficit categories */}
            {showGapTooltip && topDeficits.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-2xl p-4"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Top Deficits</p>
                {topDeficits.map((r, i) => {
                  const pct = Math.round(r.available / r.needed * 100);
                  return (
                    <div key={r.label} className="flex items-center justify-between mb-2 last:mb-0">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500" />
                        {r.label}
                      </span>
                      <span className="text-[11px] font-bold text-rose-500">{pct}% met</span>
                    </div>
                  );
                })}
                {/* Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-white dark:border-t-slate-800" />
              </motion.div>
            )}
          </motion.div>

          {/* ── Stat: Tasks Completed ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className={`col-span-12 md:col-span-4 ${card} p-8 flex flex-col justify-between min-h-[140px]`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Tasks Completed</span>
              <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
            </div>
            <div>
              <div className="text-5xl font-extrabold text-slate-800 dark:text-white leading-none">
                <AnimatedNumber value={totalCompleted} />
              </div>
              <p className="text-xs text-blue-500 mt-2 font-medium">Community tasks resolved</p>
            </div>
          </motion.div>

          {/* ── Stat: Mission Success Rate ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
            className={`col-span-12 md:col-span-4 ${card} p-8 flex flex-col justify-between min-h-[140px]`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">MISSION SUCCESS RATE</span>
              <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                <Target className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
            <div className="mt-auto">
              <div className="flex justify-between items-end mb-2">
                <span className="text-3xl font-extrabold text-slate-800 dark:text-white">
                  {totalCount === 0 ? <span className="text-lg">No tasks reported</span> : resolvedCount}
                </span>
                {totalCount > 0 && (
                  <span className="text-[11px] font-bold text-emerald-500">Out of {totalCount} total reports</span>
                )}
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-700/60 rounded-full overflow-hidden">
                <motion.div className="h-full bg-emerald-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${successRate}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Real-time mission tracking active</p>
            </div>
          </motion.div>

          {/* ── Supply vs Demand ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
            className={`col-span-12 ${card} p-8`}>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Supply vs Demand</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 px-3 py-1.5 rounded-full">
                {viewScope === 'local' ? '200km Radius' : 'Global Deficit'}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-6">
              {activeResources.map((r, i) => <GapRow key={r.label} item={r} index={i} />)}
            </div>
          </motion.div>

          {/* ── Task Trend Graph ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
            className={`col-span-12 ${card} p-8`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Task Resolution Velocity</h2>
              {/* Period dropdown */}
              <div className="relative">
                <select
                  value={timePeriod}
                  onChange={e => setTimePeriod(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-1.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer transition-all"
                >
                  <option value="weekly">Last 7 Days</option>
                  <option value="monthly">Last 4 Weeks</option>
                  <option value="yearly">Last 12 Months</option>
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                  <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activeTrend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="day" stroke={isDarkMode ? '#475569' : '#cbd5e1'} tickLine={false} axisLine={false} fontSize={11} dy={10} />
                  <YAxis stroke={isDarkMode ? '#475569' : '#cbd5e1'} tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className={`px-4 py-3 rounded-2xl text-xs shadow-xl border ${
                          isDarkMode ? 'bg-slate-800 border-slate-700/50 text-slate-200' : 'bg-white border-slate-100 text-slate-700'
                        }`}>
                          <p className="font-bold mb-2 text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[10px]">{label}</p>
                          {payload.map((p, i) => (
                            <p key={i} className="flex justify-between gap-8">
                              <span className="text-slate-500">{p.name}</span>
                              <span className="font-bold text-indigo-500">{p.value}</span>
                            </p>
                          ))}
                        </div>
                      );
                    }}
                    cursor={{ stroke: isDarkMode ? '#334155' : '#e2e8f0', strokeWidth: 1 }}
                  />
                  {/* Legend: New Requests first (top), Resolved Tasks second */}
                  <Legend
                    verticalAlign="top"
                    align="right"
                    content={() => (
                      <div className="flex items-center justify-end gap-5 mb-4 pr-1">
                        <span className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          <svg width="24" height="2" viewBox="0 0 24 2">
                            <line x1="0" y1="1" x2="24" y2="1" stroke="#6366f1" strokeWidth="2" strokeDasharray="5 4" strokeOpacity="0.55" />
                          </svg>
                          New Requests
                        </span>
                        <span className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          <span className="inline-block w-6 h-0.5 bg-indigo-500 rounded-full" />
                          Resolved Tasks
                        </span>
                      </div>
                    )}
                  />
                  {/* Resolved Tasks — solid, rendered first (below) */}
                  <Line
                    type="monotone" dataKey="completed" name="Resolved Tasks"
                    stroke="#6366f1" strokeWidth={2.5} strokeOpacity={1}
                    dot={false}
                    activeDot={{ r: 5, fill: '#6366f1', strokeWidth: 0 }}
                  />
                  {/* New Requests — dashed, rendered last (on top) */}
                  <Line
                    type="monotone" dataKey="accepted" name="New Requests"
                    stroke="#6366f1" strokeWidth={2} strokeOpacity={0.55}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
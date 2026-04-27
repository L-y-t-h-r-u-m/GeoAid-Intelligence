import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud, Upload, FileText, CheckCircle2,
  Home, Building2, BarChart3,
  Search, Sun, Moon, MapPin, Clock,
  Sparkles, X, User,
  Activity, Flame, Edit2, Trash2, Lock, Package
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import EXIF from 'exif-js';
import imageCompression from 'browser-image-compression';
import { useVirtualizer } from '@tanstack/react-virtual';

const API_BASE = 'https://geoaid-intelligence.onrender.com/api';

// ── Haversine (client-side fallback) ─────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const PRIORITY_PILLS = ['All', 'Critical', 'High', 'Medium', 'Low'];
const URGENCY_COLOR = {
  Critical: 'bg-rose-500/90 text-white border-rose-400',
  High: 'bg-amber-500/90 text-white border-amber-400',
  Medium: 'bg-indigo-500/90 text-white border-indigo-400',
  Low: 'bg-emerald-500/90 text-white border-emerald-400',
};

// ── OCR passthrough ── no AI parsing, raw text returned as-is ─────────────────────────────
// The NGO Admin reads the raw text and fills the verify form manually.
function buildOcrResult(rawText) {
  return {
    summary: rawText.slice(0, 120),
    needs: [],
    location: null,
    urgency: 'Medium',
    slate: null,   // no AI extraction — admin fills manually
  };
}

// kept for callsites that still await it
async function summarizeWithClaude(rawText) {
  return buildOcrResult(rawText);
}

// ── Custom Hooks ──────────────────────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

// ── Time Utility ──────────────────────────────────────────────────────────────
function formatTimeAgo(survey) {
  const dateInput = survey.createdAt || survey.timestamp || survey._id || survey.id;
  if (!dateInput) return survey.date || 'Just now';
  let date;
  if (typeof dateInput === 'string' && dateInput.length === 24 && /^[0-9a-fA-F]{24}$/.test(dateInput)) {
    date = new Date(parseInt(dateInput.substring(0, 8), 16) * 1000);
  } else {
    date = new Date(dateInput);
  }
  if (isNaN(date.getTime())) return survey.date || 'Just now';

  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
// ── Survey Card — clean, no-fluff ────────────────────────────────────────────
function SurveyCard({ survey, distanceKm, onClick, onDelete, onResolve, onVerify, isAdmin }) {
  const urgency = survey.priority || survey.urgency || survey.ai?.urgency || 'Medium';
  const title = survey.title || survey.aiSummary || survey.ai?.summary || survey.rawOcr?.slice(0, 60) || 'Untitled Task';
  const location = survey.location || survey.ai?.location || '';
  const isVerified = survey.status === 'verified' || survey.verificationStatus === 'Verified';
  const isResolved = survey.status === 'resolved';

  return (
    <motion.div
      onClick={() => onClick(survey._id || survey.id)}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -5 }}
      className={`bg-white dark:bg-slate-800 border rounded-2xl overflow-hidden transition-all duration-300 relative group cursor-pointer mb-4 break-inside-avoid flex flex-col ${urgency === 'Critical'
        ? 'border-rose-400 dark:border-rose-500/50'
        : 'border-slate-200 dark:border-slate-700/50 shadow-sm hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-600'
        }`}
    >
      {/* Status + Urgency Badges */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {isResolved && (
          <div className="px-2 py-1 rounded-full text-xs font-bold backdrop-blur-md bg-slate-500/90 text-white border border-slate-400 flex items-center gap-1">
            Resolved
          </div>
        )}
        {isVerified && !isResolved && (
          <div className="px-2 py-1 rounded-full text-xs font-bold backdrop-blur-md bg-emerald-500/90 text-white border border-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Verified
          </div>
        )}
        <div className={`px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md border ${URGENCY_COLOR[urgency] || URGENCY_COLOR.Medium}`}>
          {urgency}
        </div>
      </div>

      <div className="p-5 flex flex-col gap-2 relative z-10 flex-1 mt-6">
        <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight pr-4">
          {title}
        </h3>

        <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
          {location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-indigo-400" /> {location}
            </span>
          )}
          {distanceKm != null && (
            <span className="flex items-center gap-1">
              <span className="text-indigo-400 font-bold">{distanceKm.toFixed(1)} km</span>
            </span>
          )}
        </div>

        {survey.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {survey.tags.slice(0, 4).map(tag => (
              <span key={tag} className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-[10px] font-medium text-slate-400">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTimeAgo(survey)}</span>
          {(survey.lat != null) && <CheckCircle2 className="w-3 h-3 text-emerald-500" title="GPS attached" />}
        </div>
      </div>

      {/* Hover Action Dock */}
      {isAdmin && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 z-20">
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
            <button onClick={(e) => { e.stopPropagation(); onVerify(survey._id || survey.id); }} className={`p-1.5 rounded-xl transition-colors ${isVerified ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/20' : 'text-slate-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/20'}`} title="Verify">
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
            {!isResolved && (
              <button onClick={(e) => { e.stopPropagation(); onResolve(survey._id || survey.id); }} className="p-1.5 text-slate-500 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-xl transition-colors" title="Mark Resolved">
                <FileText className="w-4 h-4" />
              </button>
            )}
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
            <button onClick={(e) => { e.stopPropagation(); onDelete(survey._id || survey.id); }} className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 rounded-xl transition-colors" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Main Layout ───────────────────────────────────────────────────────────────
export default function NgoPortal({
  navigateToMap, navigateToPortal, navigateToAnalytics, navigateToProfile,
  isDarkMode, toggleTheme, user,
  missions, setMissions, fetchTasks, isPickingLocation, setIsPickingLocation, pickedCoords, setPickedCoords
}) {
  const isAdmin = user?.role === 'ngo_admin';
  const token = localStorage.getItem('token');

  // ── Geofence state ──────────────────────────────────────────────────────────
  const [viewCenter, setViewCenter] = useState({ lat: null, lon: null });  // null = user GPS
  const GEOFENCE_KM = 200;

  // ── Priority pill filter ────────────────────────────────────────────────────
  const [selectedPriority, setSelectedPriority] = useState('All');
  const [statusFilter, setStatusFilter] = useState('unresolved'); // 'all' | 'unresolved' | 'resolved'
  const [sortOrder, setSortOrder] = useState('newest');     // 'newest' | 'oldest'
  const [scopeFilter, setScopeFilter] = useState('Local');

  // ── UI state ────────────────────────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStage, setOcrStage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cols, setCols] = useState(1);
  const [expandedNoteId, setExpandedNoteId] = useState(null);

  // ── Unified Task Editor (create NEW task OR edit/verify EXISTING task) ────────
  const [taskEditor, setTaskEditor] = useState({
    open: false, mode: 'create', taskId: null, isSaving: false, error: '',
    fields: { location: '', title: '', needs: '', notes: '', urgency: 'Critical' }
  });

  // Delete Password State
  const [deletingId, setDeletingId] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);


  // ── Seed view center from GPS on mount ──────────────────────────────────────
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setViewCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => setViewCenter({ lat: 40.7128, lon: -74.0060 }) // NYC fallback
      );
    } else {
      setViewCenter({ lat: 40.7128, lon: -74.0060 });
    }
  }, []);

  // ── (fetchSurveys removed in favor of global fetchTasks) ───────────────────

  // pickedCoords effect — pre-fill location in the editor when map pin is placed
  useEffect(() => {
    if (pickedCoords) {
      setTaskEditor(e => ({
        ...e, open: true,
        fields: { ...e.fields, location: `${pickedCoords[0].toFixed(4)}, ${pickedCoords[1].toFixed(4)}` }
      }));
    }
  }, [pickedCoords]);

  // ── Unified Task Editor helpers ───────────────────────────────────────────────
  const EDITOR_RESET = { open: false, mode: 'create', taskId: null, isSaving: false, error: '', fields: { location: '', title: '', needs: '', notes: '', urgency: 'Critical' } };

  const openTaskEditor = useCallback((task = null) => {
    if (task) {
      setTaskEditor({
        open: true, mode: 'edit', taskId: task._id || task.id,
        isSaving: false, error: '',
        fields: {
          location: task.location || task.locationHint || '',
          title: task.title || '',
          needs: (task.tags || []).join(', ') || task.category || '',
          notes: task.aiSummary || task.description || task.rawOcr || '',
          urgency: task.priority || task.urgency || 'Critical',
        }
      });
    } else {
      setTaskEditor({ ...EDITOR_RESET, open: true });
    }
  }, []);

  const closeTaskEditor = useCallback(() => {
    setTaskEditor(EDITOR_RESET);
    if (setPickedCoords) setPickedCoords(null);
  }, [setPickedCoords]);

  const handleTaskEditorSave = async () => {
    const { mode, taskId, fields } = taskEditor;
    if (!fields.location && !fields.needs && !fields.notes) return;
    setTaskEditor(e => ({ ...e, isSaving: true, error: '' }));

    const needsArr = fields.needs.split(',').map(n => n.trim()).filter(Boolean);
    const [latStr, lonStr] = fields.location.split(',').map(s => s.trim());
    const lat = parseFloat(latStr) || pickedCoords?.[0] || null;
    const lon = parseFloat(lonStr) || pickedCoords?.[1] || null;

    try {
      if (mode === 'create') {
        const body = {
          title: needsArr[0] || fields.notes.slice(0, 40) || 'Manual Task',
          location: fields.location || 'Unknown',
          lat, lon,
          urgency: fields.urgency,
          priority: fields.urgency,
          aiSummary: fields.notes,
          rawOcr: fields.notes,
        };
        if (token) {
          const res = await fetch(`${API_BASE}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (data?.task?._id || data?._id) {
            if (fetchTasks) await fetchTasks();
          } else {
            setMissions(prev => [{ id: Date.now(), ...body, coords: lat && lon ? [lat, lon] : [40.7150, -73.9980], verificationStatus: isAdmin ? 'Verified' : 'Pending', status: isAdmin ? 'verified' : 'pending', theme: { bg: 'bg-indigo-500', text: 'text-indigo-500', glow: 'shadow-indigo-500/30' } }, ...prev]);
          }
        } else {
          setMissions(prev => [{ id: Date.now(), ...body, coords: lat && lon ? [lat, lon] : [40.7150, -73.9980], verificationStatus: isAdmin ? 'Verified' : 'Pending', status: isAdmin ? 'verified' : 'pending', theme: { bg: 'bg-indigo-500', text: 'text-indigo-500', glow: 'shadow-indigo-500/30' } }, ...prev]);
        }
      } else {
        // Edit / Verify existing task
        const body = {
          location: fields.location,
          tags: needsArr,
          aiSummary: fields.notes,
          priority: fields.urgency,
          title: needsArr[0] || fields.notes.slice(0, 40) || fields.title || 'Verified Task',
        };
        if (token) {
          const res = await fetch(`${API_BASE}/tasks/${taskId}/verify`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const err = await res.json();
            setTaskEditor(e => ({ ...e, isSaving: false, error: err.message || 'Save failed.' }));
            return;
          }
          if (fetchTasks) await fetchTasks();
        } else {
          setMissions(prev => prev.map(s =>
            (s._id === taskId || s.id === taskId)
              ? { ...s, verificationStatus: 'Verified', status: 'verified', priority: fields.urgency, ...body }
              : s
          ));
        }
      }
      closeTaskEditor();
    } catch (e) {
      setTaskEditor(prev => ({ ...prev, isSaving: false, error: 'Network error. Please try again.' }));
    }
  };

  // SurveyCard onVerify prop — opens editor in edit mode for that task
  const handleVerify = (id) => {
    const task = missions.find(s => (s._id || s.id) === id);
    openTaskEditor(task || { _id: id });
  };

  const handleResolve = async (id) => {
    try {
      if (token) {
        await fetch(`${API_BASE}/tasks/${id}/resolve`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (fetchTasks) await fetchTasks();
      } else {
        setMissions(prev => prev.map(s => s.id === id ? { ...s, verificationStatus: 'Resolved', status: 'resolved' } : s));
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteConfirm = async () => {
    if (!deletePassword.trim()) {
      setDeleteError('Password cannot be empty.');
      return;
    }
    setIsVerifying(true);
    setDeleteError('');
    try {
      if (token) {
        const res = await fetch(`${API_BASE}/tasks/${deletingId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ password: deletePassword }),
        });
        if (!res.ok) {
          const err = await res.json();
          setDeleteError(err.message || 'Incorrect password.');
          setIsVerifying(false);
          return;
        }
        if (fetchTasks) await fetchTasks();
      } else {
        // Offline fallback — no password check
        setMissions(prev => prev.filter(s => s.id !== deletingId));
      }
    } catch (e) {
      setDeleteError('Network error. Please try again.');
      setIsVerifying(false);
      return;
    }
    setDeletingId(null);
    setDeletePassword('');
    setDeleteError('');
    setIsVerifying(false);
  };

  useEffect(() => {
    const updateCols = () => setCols(window.innerWidth >= 1280 ? 2 : 1);
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  const fileInputRef = useRef(null);
  const parentRef = useRef(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // ── Merged list: global missions state ──────────
  const allSurveys = missions;

  // ── Filter: geofence + urgency + status + search → sort ────────────────────
  const RESOLVED_STATUSES = new Set(['resolved']);

  const filteredSurveys = allSurveys
    .filter(s => {
      // Geofence (Local vs Global)
      if (scopeFilter === 'Local' && viewCenter.lat != null && s.lat != null && s.lon != null) {
        const dist = haversineKm(viewCenter.lat, viewCenter.lon, s.lat, s.lon);
        if (dist > GEOFENCE_KM) return false;
      }
      // Urgency dropdown — check both field names (backend uses 'urgency', legacy uses 'priority')
      const urgency = s.urgency || s.priority || s.ai?.urgency;
      if (selectedPriority !== 'All' && urgency !== selectedPriority) return false;
      // Status filter
      const isResolved = RESOLVED_STATUSES.has(s.status?.toLowerCase());
      if (statusFilter === 'resolved' && !isResolved) return false;
      if (statusFilter === 'unresolved' && isResolved) return false;
      // Text search
      if (debouncedSearchQuery) {
        const q = debouncedSearchQuery.toLowerCase();
        return (
          s.title?.toLowerCase().includes(q) ||
          s.aiSummary?.toLowerCase().includes(q) ||
          s.location?.toLowerCase().includes(q) ||
          s.rawOcr?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      // Primary: unresolved before resolved (when showing 'all')
      if (statusFilter === 'all') {
        const aRes = RESOLVED_STATUSES.has(a.status?.toLowerCase());
        const bRes = RESOLVED_STATUSES.has(b.status?.toLowerCase());
        if (aRes !== bRes) return aRes ? 1 : -1;
      }
      // Secondary: user-selected time direction
      const aTime = a.createdAt ? new Date(a.createdAt).getTime()
        : a.updatedAt ? new Date(a.updatedAt).getTime()
          : typeof a.id === 'number' ? a.id : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime()
        : b.updatedAt ? new Date(b.updatedAt).getTime()
          : typeof b.id === 'number' ? b.id : 0;
      return sortOrder === 'newest' ? bTime - aTime : aTime - bTime;
    });


  // ── Stats ────────────────────────────────────────────────────────────────────
  const totalActive = filteredSurveys.filter(s => s.status !== 'resolved').length;
  const criticalCount = filteredSurveys.filter(s => (s.urgency || s.priority || s.ai?.urgency) === 'Critical' && s.status !== 'resolved').length;


  // ── Distance helper for card display ─────────────────────────────────────────
  const getDistanceKm = (s) => {
    if (!viewCenter.lat || s.lat == null || s.lon == null) return null;
    return haversineKm(viewCenter.lat, viewCenter.lon, s.lat, s.lon);
  };

  // ── File Processing ──
  const processFile = async (file) => {
    setIsDragging(false);
    setIsUploading(true);
    setOcrProgress(0);

    let hasGps = false;
    EXIF.getData(file, function () {
      const lat = EXIF.getTag(this, 'GPSLatitude');
      const lon = EXIF.getTag(this, 'GPSLongitude');
      if (lat && lon) hasGps = true;
    });

    setOcrStage('Compressing Asset...');
    let processedFile = file;
    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        initialQuality: 0.8
      };
      processedFile = await imageCompression(file, options);
    } catch (error) {
      console.warn("Compression failed, using original", error);
    }

    setOcrStage('Running Batch OCR...');

    const newId = Date.now();
    const placeholder = {
      id: newId,
      img: URL.createObjectURL(processedFile),
      date: 'Just now',
      rawOcr: '',
      ai: { summary: '', needs: [], location: null, urgency: 'Medium' },
      hasGps,
      isProcessing: true,
      status: user?.role === 'ngo_admin' ? 'pending' : 'Moderation',
      isVisibleToAll: user?.role === 'ngo_admin' ? true : false
    };

    setMissions(prev => [placeholder, ...prev]);

    let rawOcr = 'No readable text found.';
    let ocrSuccess = false;

    try {
      // Backend Azure OCR
      setOcrStage('Connecting to Azure OCR...');
      setOcrProgress(50);

      const formData = new FormData();
      formData.append('image', processedFile);

      const response = await fetch('https://geoaid-intelligence.onrender.com/api/scan-sync', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success === false) {
        rawOcr = data.error || 'Processing failed.';
      } else if (data.extractedText) {
        rawOcr = data.extractedText.trim() || 'No readable text found.';
        ocrSuccess = true;
      }

      // Update with OCR result first
      setMissions(prev => prev.map(s => s.id === newId ? { ...s, rawOcr, isProcessing: true } : s));

      // AI Summarization (Now from Backend Gemini)
      if (ocrSuccess && data.ai) {
        try {
          setOcrStage('Generating Intelligence...');
          const ai = data.ai; // Use backend AI result
          
          // Update in-memory state
          setMissions(prev => prev.map(s => s.id === newId ? { ...s, ai, isProcessing: false } : s));
          
          // Persist to MongoDB
          try {
            if (token) {
              const body = {
                title: ai.tags?.[0] || ai.category || rawOcr.slice(0, 40) || 'OCR Task',
                location: ai.location || 'Unknown',
                urgency: ai.urgency || 'Medium',
                aiSummary: ai.summary || '',
                rawOcr,
                category: ai.category || 'Other',
                tags: ai.tags || []
              };
              const res = await fetch(`${API_BASE}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
              });
              const saved = await res.json();
              if (saved?.task?._id || saved?._id) {
                if (fetchTasks) await fetchTasks();
                setMissions(prev => prev.filter(s => s.id !== newId));
              }
            }
          } catch (dbErr) { console.warn('DB persist failed, keeping local:', dbErr); }
        } catch (aiError) {
          console.error('AI processing failed:', aiError);
          setMissions(prev => prev.map(s => s.id === newId ? { ...s, isProcessing: false } : s));
        }
      } else {
        setMissions(prev => prev.map(s => s.id === newId ? { ...s, isProcessing: false } : s));
      }
    } catch (e) {
      console.error('OCR processing failed:', e);
      setMissions(prev => prev.map(s =>
        s.id === newId
          ? { ...s, rawOcr: ocrSuccess ? rawOcr : 'Processing failed.', isProcessing: false }
          : s
      ));
    }

    setIsUploading(false);
    setOcrStage('');
    setOcrProgress(0);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) processFile(file);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300">

      {/* ── Unified Task Editor Modal (create NEW or edit/verify EXISTING) ── */}
      <AnimatePresence>
        {taskEditor.open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
            onClick={closeTaskEditor}
          >
            <motion.div
              initial={{ scale: 0.95, y: -16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: -16, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-xl overflow-hidden"
            >
              {/* Header bar */}
              <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 ${taskEditor.mode === 'edit' ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''}`}>
                <div className="flex items-center gap-2">
                  {taskEditor.mode === 'edit'
                    ? <><CheckCircle2 className="w-4 h-4 text-indigo-500" /><span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Edit &amp; Verify Task</span></>
                    : <><Sparkles className="w-4 h-4 text-slate-400" /><span className="text-sm font-bold text-slate-600 dark:text-slate-300">New Task</span></>
                  }
                  {taskEditor.mode === 'edit' && taskEditor.fields.title && (
                    <span className="text-xs text-slate-400 font-medium truncate max-w-[200px]">— {taskEditor.fields.title}</span>
                  )}
                </div>
                <button onClick={closeTaskEditor} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Form body */}
              <div className="p-4 space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={taskEditor.fields.location}
                    onChange={e => setTaskEditor(ed => ({ ...ed, fields: { ...ed.fields, location: e.target.value } }))}
                    placeholder="Location (e.g., Sector 7 or Lat,Lon)"
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none"
                  />
                  <button
                    onClick={() => { setIsPickingLocation(true); navigateToMap(); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${pickedCoords ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:border-indigo-500/30'}`}
                  >
                    <MapPin className="w-4 h-4" />
                    {pickedCoords ? 'Location Set' : 'Pick on Map'}
                  </button>
                </div>

                <input
                  type="text"
                  value={taskEditor.fields.needs}
                  onChange={e => setTaskEditor(ed => ({ ...ed, fields: { ...ed.fields, needs: e.target.value } }))}
                  className="w-full bg-transparent text-sm text-slate-600 dark:text-slate-300 outline-none placeholder:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-700/50 pb-2"
                  placeholder="Needs / tags (comma separated)..."
                />

                <textarea
                  value={taskEditor.fields.notes}
                  onChange={e => setTaskEditor(ed => ({ ...ed, fields: { ...ed.fields, notes: e.target.value } }))}
                  className="w-full bg-transparent text-sm text-slate-600 dark:text-slate-300 outline-none resize-none placeholder:text-slate-400 font-mono"
                  placeholder="Detailed description..."
                  rows={4}
                />

                <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                  <span>Urgency:</span>
                  {['Critical', 'High', 'Medium', 'Low'].map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => setTaskEditor(ed => ({ ...ed, fields: { ...ed.fields, urgency: lvl } }))}
                      className={`px-3 py-1 rounded-full border text-xs font-bold transition-all ${taskEditor.fields.urgency === lvl ? URGENCY_COLOR[lvl] : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 border-transparent'}`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>

                {taskEditor.error && <p className="text-xs font-semibold text-rose-500">{taskEditor.error}</p>}
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700/50">
                <span className="text-[10px] text-slate-400 font-medium">
                  {taskEditor.mode === 'edit' ? 'Changes will be saved & task marked Verified' : 'Task will be submitted for review'}
                </span>
                <div className="flex gap-2">
                  <button onClick={closeTaskEditor} disabled={taskEditor.isSaving} className="px-4 py-1.5 text-sm font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleTaskEditorSave}
                    disabled={taskEditor.isSaving}
                    className="px-4 py-1.5 text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors flex items-center gap-2 shadow-md shadow-indigo-500/20 disabled:opacity-70"
                  >
                    {taskEditor.isSaving
                      ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Saving...</>
                      : taskEditor.mode === 'edit' ? 'Save & Verify' : 'Create Task'
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Password Modal Overlay ── */}
      <AnimatePresence>
        {deletingId !== null && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="w-full max-w-sm bg-white/10 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-[2rem] p-8 shadow-2xl relative text-center"
            >
              <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center mx-auto mb-4 border border-rose-100 dark:border-rose-500/20">
                <Lock className="w-8 h-8 text-rose-500" />
              </div>

              <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Authorize Deletion</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Enter NGO Admin Password to confirm.</p>

              {/* Single Password Input */}
              <div className="mb-2">
                <input
                  type="password"
                  value={deletePassword}
                  onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }}
                  onKeyDown={e => e.key === 'Enter' && !isVerifying && handleDeleteConfirm()}
                  placeholder="Admin password"
                  autoFocus
                  className="w-full bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl px-4 py-3 text-center text-sm font-semibold text-slate-800 dark:text-white outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>

              {/* Inline error */}
              {deleteError && (
                <p className="text-xs font-semibold text-rose-500 mb-4 mt-1">{deleteError}</p>
              )}

              <div className={`flex gap-4 ${deleteError ? 'mt-2' : 'mt-8'}`}>
                <button
                  onClick={() => { setDeletingId(null); setDeletePassword(''); setDeleteError(''); }}
                  disabled={isVerifying}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-500 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isVerifying || !deletePassword.trim()}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/30 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isVerifying ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Verifying...
                    </>
                  ) : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expanded Note Modal Overlay ── */}
      {expandedNoteId !== null && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          onClick={() => setExpandedNoteId(null)}
        >
          <motion.div
            initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]"
          >
            {(() => {
              const note = allSurveys.find(s => (s._id || s.id) === expandedNoteId);
              if (!note) return (
                <div className="p-12 text-center text-slate-400">
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-semibold">Task not found.</p>
                  <button onClick={() => setExpandedNoteId(null)} className="mt-4 px-5 py-2 text-sm font-bold text-slate-600 bg-slate-100 dark:bg-slate-700 rounded-xl">Close</button>
                </div>
              );

              const urgency = note.urgency || note.ai?.urgency || 'Medium';
              const title = note.title || note.ai?.summary?.slice(0, 60) || 'Task Detail';
              const locText = note.location || note.ai?.location || null;
              const summary = note.aiSummary || note.ai?.summary || '';
              const sourceOcr = note.rawOcr || '';
              const noteId = note._id || note.id;
              const isVerified = note.status === 'verified' || note.verificationStatus === 'Verified';

              const URGENCY_CHIP = {
                Critical: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
                High: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
                Medium: 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
                Low: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
              };

              return (
                <>
                  <div className="p-0 overflow-y-auto flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 min-h-[420px]">

                      {/* Left Pane: Source Feed */}
                      <div className="p-8 border-r border-slate-100 dark:border-slate-700/50 bg-black/5 dark:bg-black/20 relative flex flex-col">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-4">
                          <FileText className="w-3.5 h-3.5" /> Source Feed
                        </div>
                        {sourceOcr ? (
                          <textarea
                            defaultValue={sourceOcr}
                            className="flex-1 resize-none bg-transparent text-sm text-slate-600 dark:text-slate-400 outline-none font-mono leading-relaxed"
                            readOnly
                          />
                        ) : (
                          <p className="text-sm text-slate-400 italic">No raw source text available.</p>
                        )}
                      </div>

                      {/* Right Pane: Intelligence Brief */}
                      <div className="p-8 space-y-5 flex flex-col">
                        <div>
                          <h2 className="text-3xl font-black text-slate-800 dark:text-white leading-tight mb-1">{title}</h2>
                          {locText && (
                            <div className="text-sm font-semibold text-slate-500 flex items-center gap-2 mt-1">
                              <MapPin className="w-4 h-4 text-indigo-500" /> {locText}
                            </div>
                          )}
                        </div>

                        {summary && (
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">AI Situational Brief</h3>
                            <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{summary}</p>
                          </div>
                        )}

                        {(note.ai?.needs?.length > 0) && (
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Identified Needs</h3>
                            <div className="flex flex-wrap gap-2">
                              {note.ai.needs.map((tag, idx) => (
                                <span key={idx} className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 px-3 py-1 rounded-lg">{tag}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="mt-auto pt-4 flex items-center gap-2 flex-wrap">
                          <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${URGENCY_CHIP[urgency] || URGENCY_CHIP.Medium}`}>
                            {urgency} Urgency
                          </span>
                          {isVerified && (
                            <span className="px-3 py-1.5 rounded-full text-sm font-bold border bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                            </span>
                          )}
                          {note.lat != null && (
                            <span className="px-3 py-1.5 rounded-full text-sm font-bold border bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" /> GPS Attached
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex justify-between items-center p-3 px-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700/50 shrink-0">
                    <div className="flex gap-1 text-slate-400">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => { handleVerify(noteId); }}
                            className={`p-2 rounded-full transition-colors ${isVerified ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/20' : 'hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/20'}`}
                            title="Toggle Verify"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { handleResolve(noteId); setExpandedNoteId(null); }}
                            className="p-2 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-full transition-colors"
                            title="Mark Resolved"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setDeletingId(noteId); setExpandedNoteId(null); }}
                            className="p-2 hover:bg-rose-100 hover:text-rose-500 dark:hover:bg-rose-500/20 dark:hover:text-rose-400 rounded-full transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                    <button onClick={() => setExpandedNoteId(null)} className="px-5 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors">
                      Close
                    </button>
                  </div>
                </>
              );
            })()}
          </motion.div>
        </motion.div>
      )}

      {/* ── Top Nav ── */}
      <header className="absolute top-6 left-6 right-6 z-20 flex justify-between items-center pointer-events-none">

        <div className="flex items-center gap-3 pointer-events-auto shrink-0">
          <div className="hidden sm:block">
            <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white pointer-events-auto flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-500 shrink-0" />
              NGO Field Hub
            </h1>
          </div>
        </div>

        <div className="flex gap-4 pointer-events-auto shrink-0">
          <button onClick={toggleTheme} className="w-12 h-12 flex items-center justify-center rounded-full bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-700/50 shadow-lg transition-all text-slate-500 dark:text-slate-400">
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          {user && (
            <button onClick={navigateToProfile} className="w-12 h-12 flex items-center justify-center rounded-full bg-white/70 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 shadow-lg text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <User className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* ── Sidebar (Floating Dashboard style) ── */}
      <nav className="absolute left-6 top-1/2 -translate-y-1/2 z-30 pointer-events-auto">
        <ul className="bg-white/70 dark:bg-slate-800/80 backdrop-blur-2xl border border-slate-200 dark:border-slate-700/50 rounded-full p-2 flex flex-col gap-2 shadow-2xl">
          {[
            { icon: <Home className="w-5 h-5" />, id: 'home' },
            { icon: <Building2 className="w-5 h-5" />, active: true, id: 'ngo' },
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
                    if (item.id === 'home' && navigateToMap) navigateToMap();
                    if (item.id === 'ngo' && navigateToPortal) navigateToPortal();
                    if (item.id === 'analytics' && navigateToAnalytics) navigateToAnalytics();
                  }}
                  className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${item.active ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' :
                    item.danger ? 'text-rose-500 hover:bg-rose-500/10' :
                      'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
                    }`}>
                  {item.icon}
                </button>
              </li>
            ))}
        </ul>
      </nav>

      {/* ── Main Content Area ── */}
      <main ref={parentRef} className="w-full h-full overflow-y-auto pt-28 pl-32 pr-8 pb-12 no-scrollbar">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">

          {/* Global Insights Bento */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-700/50 shadow-sm flex items-center justify-between transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Unresolved Tasks</p>
                <p className="text-3xl font-extrabold text-slate-800 dark:text-white">{totalActive}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <Activity className="w-6 h-6 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-700/50 shadow-sm flex items-center justify-between transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Critical Cases</p>
                <p className="text-3xl font-extrabold text-slate-800 dark:text-white">{criticalCount}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center">
                <Flame className="w-6 h-6 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]" />
              </div>
            </div>
          </section>

          {/* Task entry trigger bar */}
          <section className="flex justify-center mt-2 mb-6">
            <div className="w-full max-w-2xl relative">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); }} />

              {isUploading ? (
                <div className="w-full bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-500/50 rounded-xl p-4 shadow-lg flex items-center gap-4">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center">
                      <Cloud className="w-5 h-5 text-indigo-500 animate-pulse" />
                    </div>
                    <svg className="absolute inset-0 w-10 h-10 transform -rotate-90">
                      <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2" fill="none" className="text-indigo-500 transition-all duration-300" strokeDasharray="113" strokeDashoffset={113 - (113 * ocrProgress) / 100} strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{ocrStage}</h3>
                    <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1.5">
                      <motion.div className="h-full bg-indigo-500 rounded-full" animate={{ width: `${ocrProgress}%` }} transition={{ duration: 0.2 }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => openTaskEditor()}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3 px-5 shadow-sm hover:shadow-md cursor-text flex items-center justify-between group transition-shadow"
                >
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Enter Tasks or upload survey images...</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-full transition-colors"
                    title="Upload image for OCR"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Filter Bar: Search · Urgency · Status · Sort */}
          <section className="mb-20">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6 flex-wrap">

              {/* Search */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks by title, location, summary..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all shadow-sm"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Urgency */}
              <div className="relative shrink-0">
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="appearance-none pl-4 pr-9 py-2.5 rounded-xl text-sm font-bold bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 cursor-pointer transition-all shadow-sm"
                >
                  <option value="All">All Urgency</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>

              {/* Status */}
              <div className="relative shrink-0">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none pl-4 pr-9 py-2.5 rounded-xl text-sm font-bold bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 cursor-pointer transition-all shadow-sm"
                >
                  <option value="all">All Status</option>
                  <option value="unresolved">Unresolved</option>
                  <option value="resolved">Resolved</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>

              {/* Sort Order */}
              <div className="relative shrink-0">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="appearance-none pl-4 pr-9 py-2.5 rounded-xl text-sm font-bold bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 cursor-pointer transition-all shadow-sm"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>

              {/* Scope Filter */}
              <div className="relative shrink-0">
                <select
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value)}
                  className="appearance-none pl-4 pr-9 py-2.5 rounded-xl text-sm font-bold bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 text-indigo-600 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 cursor-pointer transition-all shadow-sm"
                >
                  <option value="Local">Local</option>
                  <option value="Global">Global</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>

              {/* Result count */}
              <div className="shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200/80 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 shadow-sm whitespace-nowrap">
                {filteredSurveys.length} task{filteredSurveys.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
              <AnimatePresence>
                {filteredSurveys.map(survey => (
                  <SurveyCard
                    key={survey._id || survey.id}
                    survey={survey}
                    distanceKm={getDistanceKm(survey)}
                    onClick={setExpandedNoteId}
                    onDelete={setDeletingId}
                    onVerify={handleVerify}
                    onResolve={handleResolve}
                    isAdmin={isAdmin}
                  />
                ))}
              </AnimatePresence>
            </div>

            {filteredSurveys.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[2.5rem]">
                <Search className="w-10 h-10 mb-4 opacity-30" />
                <p className="font-semibold text-slate-500 dark:text-slate-400">No tasks matched your search.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function DatabaseIcon() {
  return (
    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  );
}
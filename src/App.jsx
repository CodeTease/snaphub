import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Upload, Search, FileArchive, 
  CheckCircle, AlertCircle, Copy, Download, 
  Loader2, LogOut, Menu, X, Box, Trash2,
  Clock, HardDrive, ArrowRight, Eye, FileCode, Image as ImageIcon, File, Tag, User, Calendar
} from 'lucide-react';

// --- FIREBASE SETUP ---
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  signInWithCustomToken
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  deleteDoc
} from "firebase/firestore";

// --- CONFIGURATION ---
// Safe environment variable access for ES2015 targets
const getEnv = () => {
  try {
    return import.meta.env || {};
  } catch (e) {
    return {};
  }
};

const env = getEnv();

// Fallback to empty string if env vars are missing to prevent crash during init
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: env.VITE_FIREBASE_APP_ID || ""
};

const WORKER_URL = "https://snap-hub-worker.whysos482.workers.dev";
const SECRET_TOKEN = env.VITE_WORKER_SECRET_TOKEN;
const VEGH_WORKER_PATH = "/worker.js"; 

// Initialize Firebase
let auth, db;
try {
  if (firebaseConfig.apiKey) {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } else {
    console.warn("Firebase Config missing. Check .env variables.");
  }
} catch (e) {
  console.error("Firebase init failed", e);
}

// --- TOAST COMPONENT ---
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const styles = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    info: 'bg-slate-700 text-white'
  };
  return (
    <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-5 py-3 rounded-lg shadow-xl animate-in slide-in-from-bottom-5 z-[100] font-medium ${styles[type] || styles.info}`}>
      {type === 'success' ? <CheckCircle size={20}/> : type === 'error' ? <AlertCircle size={20}/> : <Box size={20}/>}
      <span>{message}</span>
    </div>
  );
};

// --- LOGIN SCREEN ---
const LoginScreen = ({ onLogin }) => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
     <div className="max-w-md w-full text-center bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"></div>
        
        <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
           <span className="font-bold text-white text-4xl">S</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Snap Hub</h1>
        <p className="text-slate-400 mb-8 font-medium">VeghJS Registry & Viewer</p>
        
        <button 
          onClick={onLogin}
          className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-3 group"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G"/>
          <span>Login with Google</span>
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform text-slate-400"/>
        </button>
        
        {!SECRET_TOKEN && (
             <div className="mt-6 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs font-mono text-left">
                <strong>Config Error:</strong> SECRET_TOKEN is missing.
             </div>
        )}
     </div>
  </div>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  const [activeTab, setActiveTab] = useState('ship');
  const [toast, setToast] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadData, setUploadData] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');

  const [searchId, setSearchId] = useState('');
  const [inspectData, setInspectData] = useState(null);
  const [isInspecting, setIsInspecting] = useState(false);
  
  // Viewer States (VeghJS Integration)
  const [viewMode, setViewMode] = useState(false);
  const [veghFiles, setVeghFiles] = useState([]);
  const [liveMeta, setLiveMeta] = useState(null); // New state for Real-time Metadata
  const [currentContent, setCurrentContent] = useState(null);
  const [currentPath, setCurrentPath] = useState(null);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [viewerBlob, setViewerBlob] = useState(null); 

  const [mySnaps, setMySnaps] = useState([]);
  const [loadingSnaps, setLoadingSnaps] = useState(false);

  const fileInputRef = useRef(null);
  const workerRef = useRef(null);

  // --- INIT WORKER & AUTH ---
  useEffect(() => {
    try {
        workerRef.current = new Worker(VEGH_WORKER_PATH, { type: 'module' });
        workerRef.current.onmessage = (e) => {
            const { type, payload } = e.data;
            if (type === 'READY') {
                setIsWorkerReady(true);
                console.log("🥬 VeghJS Worker Ready");
            } else if (type === 'RESULT_FILES') {
                setVeghFiles(payload.sort((a, b) => a.path.localeCompare(b.path)));
                setLoadingContent(false);
            } else if (type === 'RESULT_FILE_CONTENT') {
                setCurrentContent(payload.data);
                setLoadingContent(false);
            } else if (type === 'RESULT_METADATA') {
                // Receive real metadata from WASM core
                setLiveMeta(payload);
                console.log("🥬 Live Metadata Hydrated:", payload);
            } else if (type === 'ERROR') {
                showToast(`Worker Error: ${payload}`, 'error');
                setLoadingContent(false);
            }
        };
    } catch (err) {
        console.error("Worker init failed", err);
    }

    if (!auth) { setLoadingAuth(false); return; }
    
    const initAuth = async () => {
        if (typeof window.__initial_auth_token !== 'undefined' && window.__initial_auth_token) {
            try { await signInWithCustomToken(auth, window.__initial_auth_token); } catch(e) { console.error(e); }
        }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, u => { setUser(u); setLoadingAuth(false); });
    return () => {
        unsubscribe();
        if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'mine' && user) fetchMySnaps();
  }, [activeTab, user]);

  const showToast = (msg, type = 'info') => setToast({ message: msg, type, id: Date.now() });

  const authenticatedFetch = async (endpoint, options = {}) => {
    if (!SECRET_TOKEN) throw new Error("Missing Token");
    const headers = { ...(options.headers || {}), 'Authorization': `Bearer ${SECRET_TOKEN}` };
    const res = await fetch(`${WORKER_URL}${endpoint}`, { ...options, headers });
    if (res.status === 403) throw new Error("Forbidden Origin");
    if (res.status === 401) throw new Error("Unauthorized Token");
    return res;
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || !user) return;
    setIsUploading(true); setUploadData(null);
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('uid', user.uid);
    formData.append('username', user.email.split('@')[0]);
    formData.append('description', description);

    try {
      const res = await authenticatedFetch('', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.success) {
        await setDoc(doc(db, "snaps", data.data.snapId), {
          ...data.data.metadata,
          description: description,
          syncedAt: new Date().toISOString()
        });
        
        setUploadData(data.data);
        showToast('Sent successfully', 'success');
        setSelectedFile(null);
        setDescription('');
      } else throw new Error(data.error);
    } catch (err) { showToast(err.message, 'error'); } 
    finally { setIsUploading(false); }
  };

  const fetchMySnaps = async () => {
    setLoadingSnaps(true);
    try {
      const q = query(collection(db, "snaps"), where("uid", "==", user.uid));
      const qs = await getDocs(q);
      const snaps = qs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      snaps.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      setMySnaps(snaps);
    } catch (err) { console.error(err); } 
    finally { setLoadingSnaps(false); }
  };

  const handleDeleteSnap = async (snapId) => {
    if(!confirm("Delete this entry?")) return;
    try {
      await deleteDoc(doc(db, "snaps", snapId));
      setMySnaps(prev => prev.filter(s => s.id !== snapId));
      showToast("Deleted", "success");
    } catch(err) { showToast("Failed", "error"); }
  };

  const handleInspect = async (e) => {
    e.preventDefault();
    if (!searchId) return;
    performInspect(searchId);
  };

  const performInspect = async (id) => {
    setIsInspecting(true); 
    setInspectData(null);
    setLiveMeta(null); // Reset live data
    setViewMode(false); 
    setVeghFiles([]);
    
    try {
      const res = await authenticatedFetch(`/${id}`);
      const data = await res.json();
      if (data.success) {
          setInspectData(data.data);
          setActiveTab('inspect'); 
          setSearchId(id);
      } else throw new Error(data.error);
    } catch (err) { showToast(err.message, 'error'); } 
    finally { setIsInspecting(false); }
  }

  const handleDownload = async (snapId, filename) => {
     try {
        const res = await authenticatedFetch(`/${snapId}/content`);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
     } catch (err) { showToast('Download failed', 'error'); }
  };

  // --- VEGH JS VIEWER LOGIC ---
  const handleLoadViewer = async () => {
      if (!inspectData || !isWorkerReady) return;
      setViewMode(true);
      setLoadingContent(true);
      
      try {
          const res = await authenticatedFetch(`/${inspectData.snapId}/content`);
          const blob = await res.blob();
          setViewerBlob(blob);

          // 1. Get List Files
          workerRef.current.postMessage({
              command: 'LIST_FILES',
              payload: { file: blob }
          });

          // 2. Get Real-time Metadata (Fix for incorrect DB data)
          workerRef.current.postMessage({
              command: 'GET_METADATA',
              payload: { file: blob }
          });

      } catch (err) {
          showToast("Failed to load viewer data", "error");
          setViewMode(false);
          setLoadingContent(false);
      }
  };

  const handleFileClick = (path) => {
      if (!viewerBlob) return;
      setCurrentPath(path);
      setLoadingContent(true);
      workerRef.current.postMessage({
          command: 'GET_FILE_CONTENT',
          payload: { file: viewerBlob, path: path }
      });
  };

  const renderContentPreview = () => {
      if (loadingContent) return <div className="flex items-center justify-center h-full text-slate-500 gap-2"><Loader2 className="animate-spin"/> Extracting...</div>;
      if (!currentContent) return <div className="flex items-center justify-center h-full text-slate-600">Select a file to preview</div>;

      const ext = currentPath?.split('.').pop().toLowerCase();
      
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
          const blob = new Blob([currentContent], { type: `image/${ext === 'svg' ? 'svg+xml' : ext}` });
          const url = URL.createObjectURL(blob);
          return <div className="flex items-center justify-center h-full bg-[url('https://transparenttextures.com/patterns/cubes.png')] bg-slate-900"><img src={url} className="max-w-full max-h-full shadow-lg rounded" alt="Preview"/></div>;
      }

      let isBinary = false;
      for (let i = 0; i < Math.min(currentContent.length, 50); i++) {
          if (currentContent[i] === 0) { isBinary = true; break; }
      }

      if (isBinary) {
          return (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                  <FileArchive size={48} className="opacity-50"/>
                  <div className="text-center">
                      <p>Binary File ({formatBytes(currentContent.length)})</p>
                      <button onClick={() => {
                          const blob = new Blob([currentContent]);
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a'); a.href = url; a.download = currentPath.split('/').pop(); a.click();
                      }} className="mt-2 text-emerald-500 hover:text-emerald-400 text-sm font-bold">Download to View</button>
                  </div>
              </div>
          );
      }

      const text = new TextDecoder().decode(currentContent);
      return (
          <pre className="p-4 text-xs md:text-sm font-mono text-slate-300 overflow-auto h-full w-full whitespace-pre-wrap">
              {text}
          </pre>
      );
  };

  function formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + ['B', 'KB', 'MB', 'GB'][i];
  }

  // Helper to merge DB data with Live data
  const getDisplayMeta = () => {
     if (!inspectData) return {};
     if (!liveMeta) return inspectData; // Fallback to DB if live not ready
     // Merge live data over DB data for correctness
     return {
         ...inspectData,
         format_version: liveMeta.format_version,
         tool_version: liveMeta.tool_version,
         author: liveMeta.author || inspectData.username // Prefer internal author
     };
  };

  const displayMeta = getDisplayMeta();

  if (loadingAuth) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-600"><Loader2 className="animate-spin" size={32}/></div>;
  if (!user) return <LoginScreen onLogin={() => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => showToast(e.message, 'error'))} />;

  const SidebarItem = ({ id, icon: Icon, label }) => (
    <button 
      onClick={() => { setActiveTab(id); setMobileMenuOpen(false); if(id!=='inspect') {setInspectData(null); setLiveMeta(null); setViewMode(false);} }}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${activeTab === id ? 'bg-emerald-600/10 text-emerald-500 border border-emerald-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-300 font-sans overflow-hidden selection:bg-emerald-500/30">
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* SIDEBAR */}
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-900 bg-slate-950 flex-shrink-0 z-20">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-900/50">S</div>
            <span className="font-bold text-lg text-white tracking-tight">Snap Hub</span>
          </div>
        </div>
        
        <div className="flex-1 px-3 space-y-1 overflow-y-auto">
          <SidebarItem id="ship" icon={Upload} label="Ship Artifact" />
          <SidebarItem id="mine" icon={LayoutDashboard} label="My Snaps" />
          <SidebarItem id="inspect" icon={Search} label="Inspect & View" />
        </div>

        <div className="p-4 border-t border-slate-900">
           <div className="flex items-center gap-3 mb-4 px-2">
              <img src={user.photoURL} className="w-8 h-8 rounded-full border border-slate-700" alt="Avatar"/>
              <div className="overflow-hidden">
                 <div className="font-medium text-white text-sm truncate">{user.email.split('@')[0]}</div>
                 <div className="text-xs text-slate-500">Developer</div>
              </div>
           </div>
           <button onClick={() => signOut(auth)} className="w-full flex items-center gap-2 text-slate-500 hover:text-rose-400 px-2 py-2 rounded text-xs font-medium hover:bg-slate-900 transition-colors">
              <LogOut size={14}/> Sign Out
           </button>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-950 border-b border-slate-900 flex items-center justify-between px-4 z-50">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-lg flex items-center justify-center font-bold text-white">S</div>
             <span className="font-bold text-lg text-white">Snap Hub</span>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-white">
             {mobileMenuOpen ? <X size={24}/> : <Menu size={24}/>}
          </button>
      </div>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
         <div className="md:hidden fixed inset-0 z-40 bg-slate-950 pt-20 px-4 space-y-2">
            <SidebarItem id="ship" icon={Upload} label="Ship Artifact" />
            <SidebarItem id="mine" icon={LayoutDashboard} label="My Snaps" />
            <SidebarItem id="inspect" icon={Search} label="Inspect & View" />
            <button onClick={() => signOut(auth)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-500 hover:text-rose-400 mt-4 border-t border-slate-900">
               <LogOut size={18}/> Sign Out
            </button>
         </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto bg-slate-950 relative scrollbar-thin scrollbar-thumb-slate-800">
         <div className="w-full max-w-5xl mx-auto px-6 md:px-10 p-6 md:p-10 pt-24 md:pt-10">
            
            {/* 1. SHIP ARTIFACT */}
            {activeTab === 'ship' && (
               <div className="animate-in fade-in duration-300">
                  <h2 className="text-3xl font-extrabold text-white mb-2">Ship Artifact</h2>
                  <p className="text-slate-500 mb-8">Package your code, push to the edge.</p>
                  
                  <form onSubmit={handleUpload} className="space-y-4 max-w-2xl">
                     <div 
                        onClick={() => fileInputRef.current.click()}
                        className={`
                           relative w-full h-64 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group
                           ${selectedFile ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-800 hover:border-slate-600 hover:bg-slate-900'}
                        `}
                     >
                        <input type="file" ref={fileInputRef} accept=".vegh" onChange={e => setSelectedFile(e.target.files[0])} className="hidden" />
                        
                        {selectedFile ? (
                           <div className="text-center animate-in zoom-in-50 duration-200">
                              <FileArchive size={48} className="mx-auto mb-4 text-emerald-500"/>
                              <p className="font-bold text-white text-lg">{selectedFile.name}</p>
                              <p className="text-emerald-500 text-sm font-mono mt-1">{(selectedFile.size/1024).toFixed(1)} KB</p>
                           </div>
                        ) : (
                           <div className="text-center text-slate-500 group-hover:text-slate-400">
                              <Upload size={48} className="mx-auto mb-4 opacity-50 group-hover:scale-110 transition-transform"/>
                              <p className="text-lg font-medium text-white mb-1">Drop .vegh file here</p>
                              <p className="text-sm">or click to browse</p>
                           </div>
                        )}
                     </div>

                     <div className="grid gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Manifest Description</label>
                        <input 
                          type="text" 
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="e.g. Initial build v1.0.0"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all placeholder:text-slate-600"
                        />
                     </div>
                     
                     <button 
                        type="submit" 
                        disabled={!selectedFile || isUploading}
                        className="w-full bg-white hover:bg-slate-200 disabled:bg-slate-800 disabled:text-slate-600 text-slate-900 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/5"
                     >
                        {isUploading && <Loader2 className="animate-spin" size={20}/>}
                        <span>{isUploading ? 'Shipping...' : 'Push to Cloud'}</span>
                     </button>
                  </form>

                  {uploadData && (
                     <div className="mt-8 max-w-2xl bg-emerald-950/30 border border-emerald-500/20 p-6 rounded-2xl flex items-start gap-4 animate-in slide-in-from-bottom-2">
                        <div className="bg-emerald-500/20 p-2 rounded-full">
                           <CheckCircle className="text-emerald-500" size={24}/>
                        </div>
                        <div className="flex-1 overflow-hidden">
                           <div className="text-lg font-bold text-white mb-1">Artifact Shipped!</div>
                           <p className="text-slate-400 text-sm mb-3">Your snapshot is now available on the edge.</p>
                           <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between gap-2 group cursor-pointer hover:border-emerald-500/50 transition-colors" onClick={() => {navigator.clipboard.writeText(uploadData.snapId); showToast('Copied ID', 'success')}}>
                              <code className="text-emerald-400 font-mono text-sm truncate">{uploadData.snapId}</code>
                              <Copy size={16} className="text-slate-500 group-hover:text-emerald-400"/>
                           </div>
                        </div>
                     </div>
                  )}
               </div>
            )}

            {/* 2. MY SNAPS */}
            {activeTab === 'mine' && (
               <div className="animate-in fade-in duration-300">
                  <div className="flex items-center justify-between mb-8">
                     <div>
                        <h2 className="text-3xl font-extrabold text-white mb-1">My Snaps</h2>
                        <p className="text-slate-500">Manage your deployed artifacts.</p>
                     </div>
                     <div className="bg-slate-900 px-4 py-2 rounded-full text-xs font-bold text-slate-400 border border-slate-800">
                        {mySnaps.length} Items
                     </div>
                  </div>
                  
                  {loadingSnaps ? (
                     <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-600" size={32}/></div>
                  ) : mySnaps.length === 0 ? (
                     <div className="text-center py-20 border-2 border-dashed border-slate-900 rounded-2xl">
                        <p className="text-slate-600 mb-4">No artifacts found.</p>
                        <button onClick={() => setActiveTab('ship')} className="text-emerald-500 font-bold hover:underline">Ship your first Snap</button>
                     </div>
                  ) : (
                     <div className="grid gap-4">
                        {mySnaps.map(snap => (
                           <div key={snap.id} className="bg-slate-900/50 border border-slate-800 p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between group hover:border-slate-700 hover:bg-slate-900 transition-all">
                              <div className="min-w-0 flex-1 pr-4 mb-4 md:mb-0">
                                 <div className="flex items-center gap-3 mb-1">
                                    <FileArchive size={20} className="text-emerald-600"/>
                                    <h4 className="font-bold text-white truncate text-lg">{snap.originalFilename}</h4>
                                 </div>
                                 <p className="text-sm text-slate-400 mb-2 line-clamp-1">{snap.description || "No description provided."}</p>
                                 <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                                    <span className="bg-slate-800 px-2 py-1 rounded">{(snap.fileSize/1024).toFixed(0)} KB</span>
                                    <span>{new Date(snap.uploadedAt).toLocaleDateString()}</span>
                                 </div>
                              </div>
                              <div className="flex items-center gap-2">
                                 <button onClick={() => performInspect(snap.id)} className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2">
                                    <Eye size={16}/> View
                                 </button>
                                 <div className="h-8 w-px bg-slate-800 mx-1 hidden md:block"></div>
                                 <button onClick={() => {navigator.clipboard.writeText(snap.id); showToast('ID Copied', 'success')}} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Copy ID">
                                    <Copy size={18}/>
                                 </button>
                                 <button onClick={() => handleDownload(snap.id, snap.originalFilename)} className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors" title="Download">
                                    <Download size={18}/>
                                 </button>
                                 <button onClick={() => handleDeleteSnap(snap.id)} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors" title="Delete">
                                    <Trash2 size={18}/>
                                 </button>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            )}

            {/* 3. INSPECT & VIEWER */}
            {activeTab === 'inspect' && (
               <div className="animate-in fade-in duration-300 h-full flex flex-col">
                  {/* SEARCH HEADER */}
                  <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
                     <div>
                         <h2 className="text-3xl font-extrabold text-white mb-2">Inspect Artifact</h2>
                         <p className="text-slate-500">Deep dive into snapshots with VeghJS.</p>
                     </div>
                     <form onSubmit={handleInspect} className="flex gap-2 w-full md:w-auto">
                        <input 
                           value={searchId} 
                           onChange={e => setSearchId(e.target.value)}
                           placeholder="Enter Snap ID..." 
                           className="flex-1 w-full md:w-64 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-emerald-500 transition-colors font-mono text-sm"
                        />
                        <button type="submit" disabled={isInspecting} className="bg-white hover:bg-slate-200 text-slate-900 px-5 rounded-xl font-bold text-sm transition-colors min-w-[80px] flex items-center justify-center">
                           {isInspecting ? <Loader2 className="animate-spin" size={18}/> : 'Go'}
                        </button>
                     </form>
                  </div>

                  {inspectData && !viewMode && (
                     <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 animate-in slide-in-from-bottom-4 shadow-xl">
                        <div className="flex items-start justify-between mb-6">
                           <div>
                              <div className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
                                  {displayMeta.originalFilename}
                                  <span className={`text-xs px-2 py-1 rounded border font-bold ${liveMeta ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                      {liveMeta ? 'LIVE' : 'CACHED'} v{displayMeta.format_version || '1'}
                                  </span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-400">
                                 <span>@{displayMeta.author || displayMeta.username}</span>
                                 <span>•</span>
                                 <span className="font-mono text-xs">{displayMeta.snapId}</span>
                              </div>
                           </div>
                           <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                              <FileArchive size={32} className="text-slate-600"/>
                           </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                           <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                              <div className="text-xs text-slate-500 font-bold uppercase mb-1">Size</div>
                              <div className="text-white font-mono">{(displayMeta.fileSize/1024).toFixed(2)} KB</div>
                           </div>
                           <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                              <div className="text-xs text-slate-500 font-bold uppercase mb-1">Tool</div>
                              <div className="text-white">{displayMeta.tool_version || "Unknown"}</div>
                           </div>
                           <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 col-span-2">
                              <div className="text-xs text-slate-500 font-bold uppercase mb-1">Created</div>
                              <div className="text-white">{new Date(displayMeta.uploadedAt).toLocaleString()}</div>
                           </div>
                        </div>
                        
                        {displayMeta.description && (
                            <div className="mb-8 p-4 bg-slate-950/50 rounded-xl border border-slate-800/50">
                                <div className="text-xs text-slate-500 font-bold uppercase mb-2">Description</div>
                                <p className="text-slate-300 italic">"{displayMeta.description}"</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <button onClick={handleLoadViewer} disabled={!isWorkerReady} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold text-base transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed">
                              {isWorkerReady ? <Eye size={20}/> : <Loader2 className="animate-spin" size={20}/>}
                              <span>{isWorkerReady ? "Live Preview (VeghJS)" : "Loading Core..."}</span>
                           </button>
                           <button onClick={() => handleDownload(displayMeta.snapId, displayMeta.originalFilename)} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-xl font-bold text-base transition-colors flex items-center justify-center gap-2">
                              <Download size={20}/> <span>Download Archive</span>
                           </button>
                        </div>
                     </div>
                  )}

                  {/* VIEWER INTERFACE */}
                  {viewMode && (
                      <div className="flex-1 bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-200 h-[600px]">
                          {/* Sidebar File List */}
                          <div className="w-full md:w-72 bg-slate-950 border-r border-slate-900 flex flex-col">
                              <div className="p-4 border-b border-slate-900 flex items-center justify-between">
                                  <span className="font-bold text-white text-sm">Explorer</span>
                                  <button onClick={() => setViewMode(false)} className="text-xs text-slate-500 hover:text-white">Close</button>
                              </div>
                              
                              {/* LIVE METADATA IN EXPLORER */}
                              {liveMeta && (
                                <div className="p-3 bg-emerald-900/10 border-b border-slate-900">
                                    <div className="flex items-center gap-2 text-xs text-emerald-500 font-bold mb-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                        LIVE METADATA
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            <Tag size={12}/> <span>Format: <b>v{liveMeta.format_version}</b></span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            <HardDrive size={12}/> <span>Tool: <b>{liveMeta.tool_version}</b></span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            <User size={12}/> <span>Author: <b>{liveMeta.author}</b></span>
                                        </div>
                                    </div>
                                </div>
                              )}

                              <div className="flex-1 overflow-y-auto p-2">
                                  {loadingContent && veghFiles.length === 0 ? (
                                      <div className="flex flex-col items-center justify-center h-40 text-slate-600">
                                          <Loader2 className="animate-spin mb-2"/>
                                          <span className="text-xs">Unpacking...</span>
                                      </div>
                                  ) : (
                                      <div className="space-y-1">
                                          {veghFiles.map((f, idx) => (
                                              <button 
                                                  key={idx}
                                                  onClick={() => handleFileClick(f.path)}
                                                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono truncate flex items-center gap-2 ${currentPath === f.path ? 'bg-emerald-600/20 text-emerald-400' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
                                              >
                                                  {['png','jpg','svg'].includes(f.path.split('.').pop()) ? <ImageIcon size={12}/> : <FileCode size={12}/>}
                                                  {f.path}
                                              </button>
                                          ))}
                                      </div>
                                  )}
                              </div>
                              <div className="p-2 border-t border-slate-900 text-[10px] text-slate-600 text-center uppercase font-bold tracking-wider">
                                  Powered by VeghJS WASM
                              </div>
                          </div>
                          
                          {/* Content Area */}
                          <div className="flex-1 bg-slate-900 relative overflow-hidden flex flex-col">
                              {currentPath && (
                                  <div className="absolute top-4 right-4 z-10 bg-slate-950/80 backdrop-blur px-3 py-1 rounded-full text-xs font-mono text-slate-400 border border-slate-800">
                                      {currentPath}
                                  </div>
                              )}
                              <div className="flex-1 overflow-auto">
                                  {renderContentPreview()}
                              </div>
                          </div>
                      </div>
                  )}
               </div>
            )}
         </div>
      </main>
    </div>
  );
}
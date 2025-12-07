import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Upload, Search, FileArchive, 
  CheckCircle, AlertCircle, Copy, Download, 
  Terminal, Shield, Loader2, ArrowRight, X,
  LogOut, User as UserIcon, Lock
} from 'lucide-react';

// --- FIREBASE SETUP ---
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";

// LOAD CONFIG FROM ENV (UY TÍN)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// HARDCODED ENDPOINT (CHÍNH CHỦ)
const API_URL = "https://snap-hub-worker.whysos482.workers.dev";

// Initialize Firebase
let auth;
try {
  // Check if env vars are present to prevent immediate crash in preview
  if (firebaseConfig.apiKey) {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } else {
    console.warn("⚠️ Firebase Config missing in .env file");
  }
} catch (e) {
  console.error("Firebase init failed", e);
}

// --- COMPONENTS ---

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const styles = {
    success: 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400',
    error: 'bg-red-500/10 border-red-500/50 text-red-400',
    info: 'bg-blue-500/10 border-blue-500/50 text-blue-400'
  };
  return (
    <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-xl animate-in slide-in-from-bottom-5 z-50 ${styles[type] || styles.info}`}>
      {type === 'success' ? <CheckCircle size={18}/> : type === 'error' ? <AlertCircle size={18}/> : <Terminal size={18}/>}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};

const LoginScreen = ({ onLogin }) => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
     <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>
     <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>

     <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-2xl shadow-2xl backdrop-blur-xl max-w-md w-full text-center z-10">
        <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-emerald-700 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 mx-auto mb-6">
           <span className="font-bold text-slate-950 text-3xl">V</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Snap Hub Access</h1>
        <p className="text-slate-400 mb-8 text-sm">Official Registry. Protected Area.</p>
        
        <button 
          onClick={onLogin}
          className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-3 group"
        >
          <img src="https://www.google.com/favicon.ico" alt="G" className="w-5 h-5" />
          <span>Authenticate</span>
          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
        </button>
        
        {!import.meta.env.VITE_FIREBASE_API_KEY && (
             <div className="mt-4 p-2 bg-red-900/20 border border-red-900/50 rounded text-xs text-red-400">
                ⚠️ Missing .env configuration
             </div>
        )}
     </div>
  </div>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  
  // App States
  const [activeTab, setActiveTab] = useState('ship');
  const [toast, setToast] = useState(null);
  
  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadData, setUploadData] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  // Inspect States
  const [searchId, setSearchId] = useState('');
  const [inspectData, setInspectData] = useState(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectError, setInspectError] = useState(null);

  // --- EFFECTS ---

  useEffect(() => {
    if (!auth) { setLoadingAuth(false); return; }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // --- ACTIONS ---

  const handleLogin = async () => {
    if (!auth) return showToast("Firebase not configured in .env!", "error");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleLogout = () => signOut(auth);

  const showToast = (msg, type = 'info') => setToast({ message: msg, type, id: Date.now() });

  const copyToClipboard = (text) => {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position="fixed"; ta.style.left="-9999px";
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); showToast('Copied ID!', 'success'); } 
    catch (e) { showToast('Manual copy required.', 'error'); }
    document.body.removeChild(ta);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(null); setUploadData(null);
    if (file) {
      if (!file.name.toLowerCase().endsWith('.vegh')) {
        showToast('Only .vegh allowed', 'error');
        e.target.value = null;
      } else if (file.size > 1024 * 1024) {
        showToast('Max 1MB', 'error');
        e.target.value = null;
      } else {
        setSelectedFile(file);
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return showToast('Select .vegh file', 'error');
    if (!user) return showToast('Login required', 'error');

    setIsUploading(true); setUploadData(null);
    const formData = new FormData(e.target);
    
    // ENFORCE IDENTITY
    formData.set('uid', user.uid);
    formData.set('username', user.email.split('@')[0]);
    
    try {
      // Use Hardcoded API_URL
      const res = await fetch(API_URL, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setUploadData(data.data);
        showToast('Artifact shipped!', 'success');
        e.target.reset(); setSelectedFile(null);
      } else throw new Error(data.error || 'Unknown error');
    } catch (err) { showToast(err.message, 'error'); } 
    finally { setIsUploading(false); }
  };

  const handleInspect = async (e) => {
    e.preventDefault();
    if (!searchId) return;
    setIsInspecting(true); setInspectData(null); setInspectError(null);
    try {
      // Use Hardcoded API_URL
      const res = await fetch(`${API_URL}/${searchId}`);
      if (res.status === 404) throw new Error('Snap not found');
      const data = await res.json();
      if (data.success) setInspectData(data.data); else throw new Error(data.error);
    } catch (err) { setInspectError(err.message); } 
    finally { setIsInspecting(false); }
  };

  // --- RENDERERS ---

  if (loadingAuth) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500"><Loader2 className="animate-spin" size={32}/></div>;
  if (!user) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30 selection:text-emerald-400 overflow-x-hidden">
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-tr from-emerald-500 to-emerald-700 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
              <span className="font-bold text-slate-950 text-xl">V</span>
            </div>
            <div className="hidden sm:block min-w-0">
              <h1 className="font-bold text-lg leading-tight tracking-tight text-white">Snap Hub</h1>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Vegh Registry</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-end">
             {/* Connection Status (LOCKED) */}
             <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-full border border-slate-800 bg-slate-900 text-slate-400 whitespace-nowrap">
                <Lock size={12} className="text-emerald-500 flex-shrink-0" />
                <span className="font-mono text-[10px] opacity-70 tracking-tight hidden lg:inline">whysos482.workers.dev</span>
             </div>

             {/* User Profile */}
             <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full pl-1 pr-3 py-1">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-7 h-7 rounded-full border border-slate-700 flex-shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-emerald-800 flex items-center justify-center flex-shrink-0"><UserIcon size={14}/></div>
                )}
                <span className="text-xs font-medium text-slate-300 truncate max-w-[120px]">{user.displayName || user.email?.split('@')[0] || 'User'}</span>
             </div>

             <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-colors flex-shrink-0" title="Sign Out">
               <LogOut size={18} />
             </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
        <div className="flex justify-center mb-8 md:mb-10">
          <div className="bg-slate-900/80 p-1 rounded-xl border border-slate-800 inline-flex shadow-xl backdrop-blur-sm">
            <button onClick={() => {setActiveTab('ship'); setUploadData(null);}} className={`px-4 md:px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'ship' ? 'bg-slate-800 text-white shadow-md ring-1 ring-slate-700' : 'text-slate-400 hover:text-slate-200'}`}><Upload size={16} /><span>Ship Artifact</span></button>
            <button onClick={() => {setActiveTab('inspect'); setInspectError(null);}} className={`px-4 md:px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${activeTab === 'inspect' ? 'bg-slate-800 text-white shadow-md ring-1 ring-slate-700' : 'text-slate-400 hover:text-slate-200'}`}><Search size={16} /><span>Inspect Registry</span></button>
          </div>
        </div>

        {activeTab === 'ship' ? (
           <div className="animate-in fade-in zoom-in-95 duration-300">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1 shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none group-hover:bg-emerald-500/10 transition-colors duration-700"></div>
                 <form onSubmit={handleUpload} className="bg-slate-950/50 rounded-xl p-8 space-y-6 relative z-10">
                    
                    {/* Identity Section (Read Only) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-75">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Shield size={10}/> Authenticated UID</label>
                        <input value={user.uid} disabled className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-2.5 text-sm font-mono text-slate-400 cursor-not-allowed" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><UserIcon size={10}/> Username</label>
                        <input value={user.email.split('@')[0]} disabled className="w-full bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-2.5 text-sm font-mono text-slate-400 cursor-not-allowed" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Archive (.vegh)</label>
                      <div onClick={() => fileInputRef.current.click()} className="relative border-2 border-dashed border-slate-800 rounded-xl hover:border-emerald-500/30 hover:bg-slate-900/80 transition-all group/file bg-slate-900/30 h-32 flex flex-col items-center justify-center cursor-pointer">
                          <input type="file" name="file" accept=".vegh" required ref={fileInputRef} onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                          {selectedFile ? (
                              <div className="p-3 bg-slate-800 rounded-lg border border-slate-700 w-full max-w-xs text-center shadow-lg relative">
                                  <p className="font-mono text-emerald-400 truncate text-sm">{selectedFile.name}</p>
                                  <p className="text-xs text-slate-500 mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                                  <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); fileInputRef.current.value = null; }} className="absolute -top-2 -right-2 bg-slate-700 hover:bg-red-500 text-white p-1 rounded-full shadow-md transition-colors"><X size={12} /></button>
                              </div>
                          ) : (
                              <>
                                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center mb-3 group-hover/file:scale-110 transition-transform"><FileArchive className="text-slate-400 group-hover/file:text-emerald-400" size={20} /></div>
                                  <p className="text-sm font-medium text-slate-400">Click to select .vegh file</p>
                              </>
                          )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                      <textarea name="description" rows="2" placeholder="Manifest description..." className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all resize-none"></textarea>
                    </div>

                    <button type="submit" disabled={isUploading || !selectedFile} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-lg transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 flex items-center justify-center gap-2">
                      {isUploading ? <Loader2 className="animate-spin" size={18} /> : <Box size={18} />} {isUploading ? 'Pushing...' : 'Publish Artifact'}
                    </button>
                 </form>
              </div>

              {uploadData && (
                <div className="mt-6 bg-emerald-900/10 border border-emerald-500/20 rounded-xl p-4 animate-in slide-in-from-bottom-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg"><CheckCircle className="text-emerald-400" size={20} /></div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="font-bold text-emerald-400 text-sm">Shipped!</h4>
                      <div className="mt-2 flex items-center gap-2 bg-slate-950/50 border border-emerald-500/20 p-2 rounded-lg cursor-pointer hover:bg-slate-950" onClick={() => copyToClipboard(uploadData.snapId)}>
                         <span className="font-mono text-xs text-emerald-300 truncate flex-1">{uploadData.snapId}</span>
                         <Copy size={14} className="text-slate-500" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
           </div>
        ) : (
           <div className="animate-in fade-in zoom-in-95 duration-300">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl max-w-2xl mx-auto">
                <form onSubmit={handleInspect} className="flex gap-2">
                  <div className="relative flex-1">
                     <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Search size={16} /></div>
                     <input value={searchId} onChange={(e) => setSearchId(e.target.value)} placeholder="Snap ID..." className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-emerald-500 outline-none font-mono text-slate-200" />
                  </div>
                  <button disabled={isInspecting} className="bg-slate-800 hover:bg-slate-700 text-white px-5 rounded-lg text-sm font-medium transition-colors border border-slate-700 disabled:opacity-50">{isInspecting ? <Loader2 className="animate-spin" size={18} /> : 'Fetch'}</button>
                </form>
                {inspectError && <div className="mt-4 p-3 bg-red-900/10 border border-red-900/30 rounded-lg text-red-400 text-sm flex items-center gap-2"><AlertCircle size={16} />{inspectError}</div>}
                {inspectData && (
                  <div className="mt-6 border border-slate-700 bg-slate-950 rounded-lg overflow-hidden animate-in slide-in-from-top-2">
                    <div className="p-4 border-b border-slate-800 flex justify-between items-start bg-slate-900/50">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded flex items-center justify-center"><Box className="text-emerald-500" size={20} /></div>
                          <div><div className="font-bold text-sm text-white">{inspectData.originalFilename}</div><div className="text-xs text-slate-500 font-mono">{(inspectData.fileSize / 1024).toFixed(2)} KB</div></div>
                       </div>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div><div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Publisher</div><div className="text-sm text-slate-300 font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800 inline-block">@{inspectData.username}</div></div>
                         <div><div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Uploaded</div><div className="text-sm text-slate-300">{new Date(inspectData.uploadedAt).toLocaleDateString()}</div></div>
                      </div>
                      <a href={`${API_URL}/${inspectData.snapId}/content`} target="_blank" className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded text-center transition-colors flex items-center justify-center gap-2 mt-4"><Download size={16} />Download .vegh</a>
                    </div>
                  </div>
                )}
              </div>
           </div>
        )}
      </main>
      <footer className="border-t border-slate-800 py-6 mt-auto"><div className="container mx-auto text-center"><p className="text-slate-600 text-sm">© 2025 CodeTease. Built for the <span className="text-emerald-500">Teaserverse</span>.</p></div></footer>
    </div>
  );
}
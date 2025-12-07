import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Upload, Search, FileArchive, 
  CheckCircle, AlertCircle, Copy, Download, 
  Loader2, LogOut, Menu, X, Box, Trash2,
  Clock, HardDrive, ArrowRight
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
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const WORKER_URL = "https://snap-hub-worker.whysos482.workers.dev";
const SECRET_TOKEN = import.meta.env.VITE_WORKER_SECRET_TOKEN;

// Initialize Firebase
let auth, db;
try {
  if (firebaseConfig.apiKey) {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (e) {
  console.error("Firebase init failed", e);
}

// --- TOAST COMPONENT ---
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const styles = {
    success: 'bg-emerald-500 text-black',
    error: 'bg-rose-500 text-white',
    info: 'bg-slate-700 text-white'
  };
  return (
    <div className={`fixed bottom-8 right-8 flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5 z-[100] font-bold ${styles[type] || styles.info}`}>
      {type === 'success' ? <CheckCircle size={24}/> : type === 'error' ? <AlertCircle size={24}/> : <Box size={24}/>}
      <span className="text-lg">{message}</span>
    </div>
  );
};

// --- LOGIN SCREEN ---
const LoginScreen = ({ onLogin }) => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
     <div className="max-w-lg w-full text-center space-y-8">
        <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-white/10">
           <span className="font-black text-slate-950 text-5xl">S</span>
        </div>
        <div className="space-y-2">
           <h1 className="text-5xl font-black text-white tracking-tight">Snap Hub</h1>
           <p className="text-xl text-slate-400">Teaserverse Internal Registry</p>
        </div>
        
        <button 
          onClick={onLogin}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xl py-5 rounded-2xl transition-all flex items-center justify-center gap-4 group"
        >
          <span>Authenticate Identity</span>
          <ArrowRight className="group-hover:translate-x-1 transition-transform" size={24} />
        </button>
        
        {!SECRET_TOKEN && (
             <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 font-mono text-sm">
                SYSTEM ERROR: VITE_WORKER_SECRET_TOKEN MISSING
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
  const [searchId, setSearchId] = useState('');
  const [inspectData, setInspectData] = useState(null);
  const [isInspecting, setIsInspecting] = useState(false);
  
  const [mySnaps, setMySnaps] = useState([]);
  const [loadingSnaps, setLoadingSnaps] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!auth) { setLoadingAuth(false); return; }
    const unsubscribe = onAuthStateChanged(auth, u => { setUser(u); setLoadingAuth(false); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeTab === 'mine' && user) fetchMySnaps();
  }, [activeTab, user]);

  const showToast = (msg, type = 'info') => setToast({ message: msg, type, id: Date.now() });

  // --- API ---
  const authenticatedFetch = async (endpoint, options = {}) => {
    if (!SECRET_TOKEN) throw new Error("Missing Token");
    const headers = { ...(options.headers || {}), 'Authorization': `Bearer ${SECRET_TOKEN}` };
    const res = await fetch(`${WORKER_URL}${endpoint}`, { ...options, headers });
    if (res.status === 403) throw new Error("Forbidden Origin");
    if (res.status === 401) throw new Error("Unauthorized Token");
    return res;
  };

  // --- HANDLERS ---
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || !user) return;
    setIsUploading(true); setUploadData(null);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('uid', user.uid);
    formData.append('username', user.email.split('@')[0]);

    try {
      const res = await authenticatedFetch('', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        await setDoc(doc(db, "snaps", data.data.snapId), {
          ...data.data.metadata,
          syncedAt: new Date().toISOString()
        });
        setUploadData(data.data);
        showToast('Artifact Secured!', 'success');
        setSelectedFile(null);
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
    if(!confirm("Remove from list?")) return;
    try {
      await deleteDoc(doc(db, "snaps", snapId));
      setMySnaps(prev => prev.filter(s => s.id !== snapId));
      showToast("Removed", "success");
    } catch(err) { showToast("Failed", "error"); }
  };

  const handleInspect = async (e) => {
    e.preventDefault();
    if (!searchId) return;
    setIsInspecting(true); setInspectData(null);
    try {
      const res = await authenticatedFetch(`/${searchId}`);
      const data = await res.json();
      if (data.success) setInspectData(data.data);
      else throw new Error(data.error);
    } catch (err) { showToast(err.message, 'error'); } 
    finally { setIsInspecting(false); }
  };

  const handleDownload = async (snapId, filename) => {
     try {
        const res = await authenticatedFetch(`/${snapId}/content`);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
        showToast('Retrieving...', 'success');
     } catch (err) { showToast('Download failed', 'error'); }
  };

  if (loadingAuth) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500"><Loader2 className="animate-spin" size={48}/></div>;
  if (!user) return <LoginScreen onLogin={() => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => showToast(e.message, 'error'))} />;

  // --- LAYOUT COMPONENTS ---
  const SidebarItem = ({ id, icon: Icon, label }) => (
    <button 
      onClick={() => { setActiveTab(id); setMobileMenuOpen(false); setUploadData(null); setInspectData(null); }}
      className={`w-full flex items-center gap-4 px-6 py-5 text-lg font-bold rounded-2xl transition-all ${activeTab === id ? 'bg-white text-slate-950 shadow-xl shadow-white/5' : 'text-slate-500 hover:text-white hover:bg-slate-900'}`}
    >
      <Icon size={24} strokeWidth={2.5} />
      <span>{label}</span>
    </button>
  );

  return (
    // FIX 1: Flex Layout - Sidebar takes physical space, no overlap
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* SIDEBAR - DESKTOP */}
      <aside className="hidden md:flex w-80 flex-col border-r border-slate-900 bg-slate-950 flex-shrink-0">
        <div className="p-8 pb-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center font-black text-slate-950 text-xl">S</div>
            <span className="font-black text-2xl text-white tracking-tight">Snap Hub</span>
          </div>
        </div>
        
        <div className="flex-1 px-4 space-y-2 overflow-y-auto">
          <SidebarItem id="ship" icon={Upload} label="Ship Artifact" />
          <SidebarItem id="mine" icon={LayoutDashboard} label="My Registry" />
          <SidebarItem id="inspect" icon={Search} label="Inspect ID" />
        </div>

        <div className="p-6 border-t border-slate-900">
           <div className="flex items-center gap-4 mb-6 px-2">
              <img src={user.photoURL} className="w-12 h-12 rounded-full ring-2 ring-slate-800" alt="Avatar"/>
              <div className="overflow-hidden">
                 <div className="font-bold text-white text-lg truncate">{user.displayName}</div>
                 <div className="text-sm text-slate-500 truncate">Operator</div>
              </div>
           </div>
           <button onClick={() => signOut(auth)} className="w-full flex items-center justify-center gap-3 text-slate-500 hover:text-rose-400 py-4 rounded-xl hover:bg-slate-900 transition-colors font-bold">
              <LogOut size={20}/> Sign Out
           </button>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-20 bg-slate-950 border-b border-slate-900 flex items-center justify-between px-6 z-50">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-slate-950">S</div>
             <span className="font-bold text-xl text-white">Snap Hub</span>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-white">
             {mobileMenuOpen ? <X size={28}/> : <Menu size={28}/>}
          </button>
      </div>

      {/* MOBILE MENU OVERLAY */}
      {mobileMenuOpen && (
         <div className="md:hidden fixed inset-0 z-40 bg-slate-950 pt-24 px-6 space-y-4">
            <SidebarItem id="ship" icon={Upload} label="Ship Artifact" />
            <SidebarItem id="mine" icon={LayoutDashboard} label="My Registry" />
            <SidebarItem id="inspect" icon={Search} label="Inspect ID" />
            <button onClick={() => signOut(auth)} className="w-full flex items-center gap-4 px-6 py-5 rounded-2xl text-slate-500 hover:text-rose-400 mt-8 font-bold border border-slate-800">
               <LogOut size={24}/> Sign Out
            </button>
         </div>
      )}

      {/* MAIN CONTENT - SCROLLABLE AREA */}
      <main className="flex-1 overflow-y-auto bg-[#0B0C10] relative">
         <div className="max-w-7xl mx-auto p-6 md:p-12 pt-28 md:pt-12">
            
            {/* HEADER - Minimal */}
            <header className="mb-12">
               <h2 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tight">
                  {activeTab === 'mine' ? 'My Artifacts' : activeTab === 'ship' ? 'Deploy Artifact' : 'Global Inspection'}
               </h2>
               <p className="text-slate-500 text-lg">Secure storage operations for {user.email}</p>
            </header>

            {/* TAB CONTENT */}
            
            {/* 1. SHIP ARTIFACT - BIGGER & BOLDER */}
            {activeTab === 'ship' && (
               <div className="animate-in fade-in duration-500">
                  <form onSubmit={handleUpload} className="space-y-8">
                     {/* DROPZONE - FIX 3: HUGE SPACE FILLER */}
                     <div 
                        onClick={() => fileInputRef.current.click()}
                        className={`
                           relative w-full h-[400px] md:h-[500px] rounded-3xl border-4 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group
                           ${selectedFile ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-800 hover:border-slate-600 hover:bg-slate-900'}
                        `}
                     >
                        <input type="file" ref={fileInputRef} accept=".vegh" onChange={e => setSelectedFile(e.target.files[0])} className="hidden" />
                        
                        {selectedFile ? (
                           <div className="text-center space-y-4 animate-in zoom-in-50 duration-300">
                              <div className="w-24 h-24 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20">
                                 <FileArchive size={48} className="text-slate-950"/>
                              </div>
                              <div>
                                 <p className="font-bold text-white text-3xl">{selectedFile.name}</p>
                                 <p className="text-emerald-500 text-lg font-mono mt-2">{(selectedFile.size/1024).toFixed(1)} KB</p>
                              </div>
                              <p className="text-slate-500">Click to change file</p>
                           </div>
                        ) : (
                           <div className="text-center space-y-6">
                              <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                                 <Upload size={40} className="text-slate-400 group-hover:text-white"/>
                              </div>
                              <div className="space-y-2">
                                 <p className="text-3xl font-bold text-slate-300 group-hover:text-white">Drop .vegh archive here</p>
                                 <p className="text-lg text-slate-600">or click to browse local system</p>
                              </div>
                           </div>
                        )}
                     </div>
                     
                     {/* ACTION BUTTON - HUGE */}
                     <button 
                        type="submit" 
                        disabled={!selectedFile || isUploading}
                        className="w-full bg-white hover:bg-emerald-400 hover:text-slate-900 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black text-2xl py-8 rounded-3xl transition-all flex items-center justify-center gap-4 shadow-2xl shadow-white/5"
                     >
                        {isUploading ? <Loader2 className="animate-spin" size={32}/> : <ArrowRight size={32}/>}
                        <span>{isUploading ? 'Encrypting & Pushing...' : 'Initiate Secure Transfer'}</span>
                     </button>
                  </form>

                  {/* RESULT - BIG */}
                  {uploadData && (
                     <div className="mt-8 bg-emerald-900/20 border border-emerald-500/30 p-8 rounded-3xl flex flex-col md:flex-row items-center gap-6 animate-in slide-in-from-bottom-10">
                        <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 text-slate-950">
                           <CheckCircle size={32} strokeWidth={3}/>
                        </div>
                        <div className="flex-1 text-center md:text-left">
                           <h4 className="text-2xl font-bold text-white">Upload Successful</h4>
                           <p className="text-emerald-400">Artifact stored in R2 & Indexed in Firestore.</p>
                        </div>
                        <button 
                           onClick={() => {navigator.clipboard.writeText(uploadData.snapId); showToast('ID Copied!', 'success')}}
                           className="px-6 py-4 bg-slate-950 rounded-xl border border-emerald-500/30 text-emerald-400 font-mono text-lg hover:bg-black transition-colors flex items-center gap-3"
                        >
                           <Copy size={20}/>
                           <span className="max-w-[200px] truncate">{uploadData.snapId}</span>
                        </button>
                     </div>
                  )}
               </div>
            )}

            {/* 2. MY SNAPS - GRID */}
            {activeTab === 'mine' && (
               <div className="animate-in fade-in duration-500">
                  {loadingSnaps ? (
                     <div className="flex justify-center py-32"><Loader2 className="animate-spin text-emerald-500" size={64}/></div>
                  ) : mySnaps.length === 0 ? (
                     <div className="text-center py-40 border-4 border-dashed border-slate-800 rounded-[3rem]">
                        <Box className="mx-auto text-slate-700 mb-6" size={80} />
                        <h3 className="text-2xl text-slate-400 font-bold">Registry Empty</h3>
                        <button onClick={() => setActiveTab('ship')} className="mt-4 text-emerald-500 hover:text-emerald-400 text-lg font-bold underline decoration-2 underline-offset-4">Deploy your first artifact</button>
                     </div>
                  ) : (
                     <div className="grid md:grid-cols-2 gap-6">
                        {mySnaps.map(snap => (
                           <div key={snap.id} className="bg-slate-900 hover:bg-slate-800 p-6 rounded-3xl transition-all group border border-transparent hover:border-slate-700">
                              <div className="flex justify-between items-start mb-6">
                                 <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-200 group-hover:bg-white group-hover:text-black transition-colors">
                                    <FileArchive size={28}/>
                                 </div>
                                 <button onClick={() => handleDeleteSnap(snap.id)} className="p-3 text-slate-600 hover:bg-rose-500 hover:text-white rounded-xl transition-all"><Trash2 size={20}/></button>
                              </div>
                              
                              <h4 className="text-xl font-bold text-white truncate mb-2">{snap.originalFilename}</h4>
                              <div className="flex items-center gap-6 text-sm text-slate-500 font-medium mb-6">
                                 <span className="flex items-center gap-2"><Clock size={16}/> {new Date(snap.uploadedAt).toLocaleDateString()}</span>
                                 <span className="flex items-center gap-2"><HardDrive size={16}/> {(snap.fileSize/1024).toFixed(0)} KB</span>
                              </div>

                              <div className="grid grid-cols-4 gap-3">
                                 <button onClick={() => {navigator.clipboard.writeText(snap.id); showToast('ID Copied', 'success')}} className="col-span-3 bg-slate-950 text-slate-400 py-4 rounded-xl text-sm font-mono truncate px-4 border border-slate-800 hover:border-slate-600 transition-colors text-center">
                                    {snap.id}
                                 </button>
                                 <button onClick={() => handleDownload(snap.id, snap.originalFilename)} className="col-span-1 bg-white hover:bg-emerald-400 text-black rounded-xl flex items-center justify-center transition-colors">
                                    <Download size={24}/>
                                 </button>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            )}

            {/* 3. INSPECT - BIG SEARCH */}
            {activeTab === 'inspect' && (
               <div className="animate-in fade-in duration-500 mt-8 max-w-4xl">
                  <div className="relative group">
                     <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-white transition-colors" size={32} />
                     <input 
                        value={searchId} 
                        onChange={e => setSearchId(e.target.value)}
                        placeholder="Paste Artifact ID..." 
                        className="w-full bg-slate-900 border-2 border-slate-800 rounded-3xl py-8 pl-24 pr-48 text-2xl font-bold text-white focus:border-white outline-none transition-all placeholder:text-slate-700"
                     />
                     <button 
                        onClick={handleInspect} 
                        disabled={isInspecting} 
                        className="absolute right-4 top-4 bottom-4 px-8 bg-white hover:bg-emerald-400 text-black rounded-2xl font-bold text-lg disabled:opacity-50 transition-colors"
                     >
                        {isInspecting ? <Loader2 className="animate-spin" size={24}/> : 'Scan'}
                     </button>
                  </div>

                  {inspectData && (
                     <div className="mt-12 bg-slate-900 rounded-[2.5rem] p-10 border border-slate-800 animate-in slide-in-from-bottom-10">
                        <div className="flex flex-col md:flex-row items-center gap-8 mb-10 text-center md:text-left">
                           <div className="w-24 h-24 bg-emerald-500/10 rounded-3xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                              <Box size={48}/>
                           </div>
                           <div>
                              <div className="text-3xl font-black text-white mb-2">{inspectData.originalFilename}</div>
                              <div className="text-xl text-slate-500 font-medium">Publisher: @{inspectData.username}</div>
                           </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-6 mb-10">
                           <div className="bg-slate-950 p-6 rounded-2xl">
                              <div className="text-slate-500 font-bold uppercase tracking-wider text-sm mb-2">File Size</div>
                              <div className="text-2xl text-white font-mono">{(inspectData.fileSize/1024).toFixed(2)} KB</div>
                           </div>
                           <div className="bg-slate-950 p-6 rounded-2xl">
                              <div className="text-slate-500 font-bold uppercase tracking-wider text-sm mb-2">Indexed At</div>
                              <div className="text-2xl text-white font-mono">{new Date(inspectData.uploadedAt).toLocaleDateString()}</div>
                           </div>
                        </div>

                        <button 
                           onClick={() => handleDownload(inspectData.snapId, inspectData.originalFilename)} 
                           className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-2xl py-6 rounded-2xl flex items-center justify-center gap-3 transition-colors"
                        >
                           <Download size={28}/>
                           <span>Retrieve Content</span>
                        </button>
                     </div>
                  )}
               </div>
            )}
         </div>
      </main>
    </div>
  );
}
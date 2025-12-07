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
     <div className="max-w-md w-full text-center bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
        <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center mx-auto mb-6">
           <span className="font-bold text-slate-950 text-3xl">S</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Snap Hub</h1>
        <p className="text-slate-400 mb-8">Internal Registry Access</p>
        
        <button 
          onClick={onLogin}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
        >
          <span>Login with Google</span>
        </button>
        
        {!SECRET_TOKEN && (
             <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded text-rose-400 text-xs font-mono">
                Error: SECRET_TOKEN missing
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
  const [description, setDescription] = useState(''); // Added Description State

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
    formData.append('description', description); // Send description to Worker (if needed later) or mostly for Firestore

    try {
      // 1. Upload to Worker (R2)
      const res = await authenticatedFetch('', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.success) {
        // 2. Save metadata to Firestore
        await setDoc(doc(db, "snaps", data.data.snapId), {
          ...data.data.metadata,
          description: description, // Save description here
          syncedAt: new Date().toISOString()
        });
        
        setUploadData(data.data);
        showToast('Sent successfully', 'success');
        setSelectedFile(null);
        setDescription(''); // Reset description
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
     } catch (err) { showToast('Download failed', 'error'); }
  };

  if (loadingAuth) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-600"><Loader2 className="animate-spin" size={32}/></div>;
  if (!user) return <LoginScreen onLogin={() => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => showToast(e.message, 'error'))} />;

  // --- LAYOUT COMPONENTS ---
  const SidebarItem = ({ id, icon: Icon, label }) => (
    <button 
      onClick={() => { setActiveTab(id); setMobileMenuOpen(false); setUploadData(null); setInspectData(null); }}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all ${activeTab === id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-300 font-sans overflow-hidden">
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* SIDEBAR - Compact & Functional */}
      <aside className="hidden md:flex w-72 flex-col border-r border-slate-900 bg-slate-950 flex-shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-bold text-slate-950">S</div>
            <span className="font-bold text-lg text-white">Snap Hub</span>
          </div>
        </div>
        
        <div className="flex-1 px-3 space-y-1 overflow-y-auto">
          <SidebarItem id="ship" icon={Upload} label="Ship" />
          <SidebarItem id="mine" icon={LayoutDashboard} label="My Snaps" />
          <SidebarItem id="inspect" icon={Search} label="Inspect" />
        </div>

        <div className="p-4 border-t border-slate-900">
           <div className="flex items-center gap-3 mb-4 px-2">
              <img src={user.photoURL} className="w-8 h-8 rounded-full" alt="Avatar"/>
              <div className="overflow-hidden">
                 <div className="font-medium text-white text-sm truncate">{user.email.split('@')[0]}</div>
              </div>
           </div>
           <button onClick={() => signOut(auth)} className="w-full flex items-center gap-2 text-slate-500 hover:text-rose-400 px-2 py-2 rounded text-xs font-medium hover:bg-slate-900 transition-colors">
              <LogOut size={14}/> Sign Out
           </button>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-20 bg-slate-950 border-b border-slate-900 flex items-center justify-between px-4 z-50">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-bold text-slate-950">S</div>
             <span className="font-bold text-lg text-white">Snap Hub</span>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-white">
             {mobileMenuOpen ? <X size={24}/> : <Menu size={24}/>}
          </button>
      </div>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
         <div className="md:hidden fixed inset-0 z-40 bg-slate-950 pt-20 px-4 space-y-2">
            <SidebarItem id="ship" icon={Upload} label="Ship" />
            <SidebarItem id="mine" icon={LayoutDashboard} label="My Snaps" />
            <SidebarItem id="inspect" icon={Search} label="Inspect" />
            <button onClick={() => signOut(auth)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-500 hover:text-rose-400 mt-4 border-t border-slate-900">
               <LogOut size={18}/> Sign Out
            </button>
         </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto bg-slate-950 relative">
         <div className="w-full px-6 md:px-10 p-6 md:p-10 pt-20 md:pt-10">
            
            {/* 1. SHIP ARTIFACT - Compact */}
            {activeTab === 'ship' && (
               <div className="animate-in fade-in duration-300">
                  <h2 className="text-3xl font-extrabold text-white mb-6">Ship Artifact</h2>
                  
                  <form onSubmit={handleUpload} className="space-y-4">
                     {/* DROPZONE - Fixed height, standard look */}
                     <div 
                        onClick={() => fileInputRef.current.click()}
                        className={`
                           relative w-full h-56 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors
                           ${selectedFile ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-800 hover:border-slate-600 hover:bg-slate-900'}
                        `}
                     >
                        <input type="file" ref={fileInputRef} accept=".vegh" onChange={e => setSelectedFile(e.target.files[0])} className="hidden" />
                        
                        {selectedFile ? (
                           <div className="text-center">
                              <p className="font-bold text-white text-lg">{selectedFile.name}</p>
                              <p className="text-emerald-500 text-sm font-mono">{(selectedFile.size/1024).toFixed(1)} KB</p>
                              <p className="text-slate-600 text-xs mt-2">Click to change</p>
                           </div>
                        ) : (
                           <div className="text-center text-slate-500">
                              <Upload size={24} className="mx-auto mb-2 opacity-50"/>
                              <p className="text-sm font-medium">Select .vegh file</p>
                           </div>
                        )}
                     </div>

                     {/* DESCRIPTION INPUT - Added back */}
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description (Optional)</label>
                        <input 
                          type="text" 
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Note about this artifact..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-white focus:border-emerald-600 outline-none transition-colors"
                        />
                     </div>
                     
                     {/* ACTION BUTTON - Simple Text */}
                     <button 
                        type="submit" 
                        disabled={!selectedFile || isUploading}
                        className="w-full bg-white hover:bg-slate-200 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                     >
                        {isUploading && <Loader2 className="animate-spin" size={18}/>}
                        <span>{isUploading ? 'Sending...' : 'Send Snap'}</span>
                     </button>
                  </form>

                  {/* RESULT - Compact */}
                  {uploadData && (
                     <div className="mt-6 bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-lg flex items-center gap-4 animate-in slide-in-from-bottom-2">
                        <CheckCircle className="text-emerald-500" size={20}/>
                        <div className="flex-1 overflow-hidden">
                           <div className="text-sm font-medium text-white">Sent Successfully</div>
                           <div className="text-xs text-slate-400 font-mono truncate cursor-pointer hover:text-white" onClick={() => {navigator.clipboard.writeText(uploadData.snapId); showToast('Copied', 'success')}}>
                              ID: {uploadData.snapId}
                           </div>
                        </div>
                     </div>
                  )}
               </div>
            )}

            {/* 2. MY SNAPS - Clean Grid */}
            {activeTab === 'mine' && (
               <div className="animate-in fade-in duration-300">
                  <h2 className="text-3xl font-extrabold text-white mb-6">My Snaps</h2>
                  
                  {loadingSnaps ? (
                     <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-600" size={24}/></div>
                  ) : mySnaps.length === 0 ? (
                     <div className="text-center py-20 border-2 border-dashed border-slate-900 rounded-xl">
                        <p className="text-slate-600">No snaps found.</p>
                     </div>
                  ) : (
                     <div className="grid gap-4">
                        {mySnaps.map(snap => (
                           <div key={snap.id} className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between group hover:border-slate-700 transition-colors">
                              <div className="min-w-0 flex-1 pr-4">
                                 <h4 className="font-bold text-white truncate text-xl">{snap.originalFilename}</h4>
                                 <p className="text-sm text-slate-400 mb-2">{snap.description || "No description"}</p>
                                 <div className="flex items-center gap-4 text-[12px] text-slate-500 font-mono uppercase">
                                    <span>{(snap.fileSize/1024).toFixed(0)} KB</span>
                                    <span>•</span>
                                    <span>{new Date(snap.uploadedAt).toLocaleDateString()}</span>
                                 </div>
                              </div>
                              <div className="flex items-center gap-3 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button onClick={() => {navigator.clipboard.writeText(snap.id); showToast('ID Copied', 'success')}} className="w-11 h-11 p-2 bg-slate-950 text-slate-300 rounded-md hover:text-white flex items-center justify-center shadow-sm transition-colors" title="Copy ID" aria-label="Copy ID">
                                    <Copy size={18}/>
                                 </button>
                                 <button onClick={() => handleDownload(snap.id, snap.originalFilename)} className="w-11 h-11 p-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-500 flex items-center justify-center shadow transition-colors" title="Download" aria-label="Download">
                                    <Download size={18}/>
                                 </button>
                                 <button onClick={() => handleDeleteSnap(snap.id)} className="w-11 h-11 p-2 bg-slate-950 text-rose-400 rounded-md hover:bg-rose-600 hover:text-white flex items-center justify-center shadow-sm transition-colors" title="Delete" aria-label="Delete">
                                    <Trash2 size={18}/>
                                 </button>
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            )}

            {/* 3. INSPECT - Functional */}
            {activeTab === 'inspect' && (
               <div className="animate-in fade-in duration-300">
                  <h2 className="text-3xl font-extrabold text-white mb-6">Inspect</h2>
                  <div className="flex gap-2 mb-6">
                     <input 
                        value={searchId} 
                        onChange={e => setSearchId(e.target.value)}
                        placeholder="Snap ID" 
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white outline-none focus:border-emerald-600"
                     />
                     <button onClick={handleInspect} disabled={isInspecting} className="bg-white hover:bg-slate-200 text-black px-6 rounded-lg font-bold text-sm">
                        {isInspecting ? <Loader2 className="animate-spin" size={16}/> : 'Go'}
                     </button>
                  </div>

                  {inspectData && (
                     <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 animate-in slide-in-from-top-2">
                        <div className="font-bold text-white text-xl mb-1">{inspectData.originalFilename}</div>
                        <div className="text-base text-slate-400 mb-4">@{inspectData.username}</div>
                        
                        <div className="grid grid-cols-2 gap-4 text-xs text-slate-400 mb-6 font-mono">
                           <div>SIZE: {(inspectData.fileSize/1024).toFixed(2)} KB</div>
                           <div>DATE: {new Date(inspectData.uploadedAt).toLocaleDateString()}</div>
                        </div>

                        <button onClick={() => handleDownload(inspectData.snapId, inspectData.originalFilename)} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-lg text-base font-medium transition-colors flex items-center justify-center gap-2">
                           <Download size={18}/> <span>Download</span>
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
import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot, deleteDoc, addDoc } from 'firebase/firestore';
import { 
  Users, 
  ShoppingCart, 
  Utensils, 
  LayoutDashboard, 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon,
  Wallet,
  CreditCard,
  Banknote,
  User,
  Lock,
  Unlock,
  ShieldCheck,
  AlertCircle,
  LogOut,
  MessageSquare
} from 'lucide-react';

// --- Firebase Configuration ---
// আপনার আসল এপিআই কী এখানে দেওয়া আছে
const firebaseConfig = {
  apiKey: "AIzaSyDSlgcEMZfPuUeIviUyFy4HcIjSK6z5Q20",
  authDomain: "shipon-meal.firebaseapp.com",
  projectId: "shipon-meal",
  storageBucket: "shipon-meal.firebasestorage.app",
  messagingSenderId: "7235669895",
  appId: "1:7235669895:web:bd952fc5189c18f0548d22"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'shopnodhara-meal-manager';

const App = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [members, setMembers] = useState([]);
  const [bazarList, setBazarList] = useState([]);
  const [meals, setMeals] = useState({}); 
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Manager States
  const [isManager, setIsManager] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [managerPin, setManagerPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const CORRECT_PIN = "1234"; 

  const [newMemberName, setNewMemberName] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Auth Initialization
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Data Syncing
  useEffect(() => {
    if (!user) return;

    // ডাটাবেস ফাঁকা থাকলেও যাতে ৫ সেকেন্ড পর লোডিং বন্ধ হয় তার জন্য টাইমার
    const timer = setTimeout(() => setLoading(false), 5000);

    const membersRef = collection(db, 'artifacts', appId, 'public', 'data', 'members');
    const unsubMembers = onSnapshot(membersRef, (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false); // মেম্বার ডাটা আসলে লোডিং বন্ধ হবে
    }, (err) => {
      console.error("Members sync error", err);
      setLoading(false);
    });

    const bazarRef = collection(db, 'artifacts', appId, 'public', 'data', 'bazar');
    const unsubBazar = onSnapshot(bazarRef, (snapshot) => {
      setBazarList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Bazar sync error", err));

    const mealsRef = collection(db, 'artifacts', appId, 'public', 'data', 'meals');
    const unsubMeals = onSnapshot(mealsRef, (snapshot) => {
      const mealsData = {};
      snapshot.docs.forEach(doc => {
        mealsData[doc.id] = doc.data();
      });
      setMeals(mealsData);
    }, (err) => console.error("Meals sync error", err));

    const depositsRef = collection(db, 'artifacts', appId, 'public', 'data', 'deposits');
    const unsubDeposits = onSnapshot(depositsRef, (snapshot) => {
      setDeposits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      clearTimeout(timer);
    }, (err) => console.error("Deposits sync error", err));

    return () => {
      unsubMembers();
      unsubBazar();
      unsubMeals();
      unsubDeposits();
      clearTimeout(timer);
    };
  }, [user]);

  // Manager Login Logic
  const handleManagerLogin = (e) => {
    e.preventDefault();
    if (managerPin === CORRECT_PIN) {
      setIsManager(true);
      setShowManagerModal(false);
      setManagerPin('');
      setPinError(false);
    } else {
      setPinError(true);
      setManagerPin('');
    }
  };

  const handleLogoutManager = () => {
    setIsManager(false);
  };

  // Calculations
  const cashBazar = bazarList
    .filter(item => item.type === 'cash' || !item.type)
    .reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
  
  const creditBazar = bazarList
    .filter(item => item.type === 'credit')
    .reduce((acc, item) => acc + (Number(item.amount) || 0), 0);

  const totalBazar = cashBazar + creditBazar;
  
  const totalMeals = Object.values(meals).reduce((acc, day) => {
    return acc + Object.values(day).reduce((dayAcc, count) => dayAcc + (Number(count) || 0), 0);
  }, 0);
  
  const mealRate = totalMeals > 0 ? (totalBazar / totalMeals).toFixed(2) : 0;

  const getMemberStats = (memberId) => {
    const memberMeals = Object.values(meals).reduce((acc, day) => acc + (Number(day[memberId]) || 0), 0);
    const memberDeposits = deposits
      .filter(d => d.memberId === memberId)
      .reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
    const cost = (memberMeals * mealRate).toFixed(2);
    const balance = (memberDeposits - cost).toFixed(2);
    return { meals: memberMeals, deposits: memberDeposits, cost, balance };
  };

  const getMemberName = (id) => members.find(m => m.id === id)?.name || "অজানা";

  // Actions
  const addMember = async () => {
    if (!isManager || !newMemberName.trim()) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'members'), {
      name: newMemberName,
      createdAt: new Date().toISOString()
    });
    setNewMemberName('');
  };

  const deleteMember = async (id) => {
    if (!isManager) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'members', id));
  };

  const updateMeal = async (memberId, count) => {
    if (!isManager) return;
    const dayRef = doc(db, 'artifacts', appId, 'public', 'data', 'meals', selectedDate);
    const currentDayData = meals[selectedDate] || {};
    await setDoc(dayRef, { ...currentDayData, [memberId]: Number(count) });
  };

  const addBazarEntry = async (e) => {
    e.preventDefault();
    if (!isManager) return;
    const form = e.target;
    const item = form.item.value;
    const amount = form.amount.value;
    const type = form.type.value; 
    const memberId = form.memberId.value;
    const date = form.date.value;
    if (!item || !amount || !memberId || !date) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bazar'), {
      item,
      amount: Number(amount),
      type: type,
      memberId: memberId,
      date: date
    });
    form.reset();
  };

  const deleteBazarItem = async (id) => {
    if (!isManager) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bazar', id));
  };

  const addDepositEntry = async (e) => {
    e.preventDefault();
    if (!isManager) return;
    const form = e.target;
    const memberId = form.memberId.value;
    const amount = form.amount.value;
    if (!memberId || !amount) return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'deposits'), {
      memberId,
      amount: Number(amount),
      date: new Date().toISOString().split('T')[0]
    });
    form.reset();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-slate-500 font-medium animate-pulse">ডাটাবেসের সাথে কানেক্ট হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 md:pb-0 font-sans">
      {/* Manager Pin Modal */}
      {showManagerModal && (
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-2">
                <Lock size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800">ম্যানেজার লগইন</h3>
              <p className="text-slate-500 text-sm leading-relaxed">সিস্টেমে হিসাব এন্ট্রি করার জন্য ৪ ডিজিটের পিন নম্বর দিন।</p>
              
              <form onSubmit={handleManagerLogin} className="space-y-4 pt-2">
                <input 
                  type="password" 
                  maxLength={4}
                  value={managerPin}
                  onChange={(e) => { setManagerPin(e.target.value); setPinError(false); }}
                  placeholder="পিন দিন (ডিফল্ট ১২৩৪)"
                  className={`w-full p-4 rounded-2xl border ${pinError ? 'border-red-500 bg-red-50' : 'border-slate-200'} text-center text-2xl tracking-[1rem] font-black focus:ring-2 focus:ring-blue-100 outline-none transition-all`}
                  autoFocus
                />
                {pinError && <p className="text-red-500 text-xs font-bold flex items-center justify-center gap-1"><AlertCircle size={14}/> ভুল পিন নম্বর!</p>}
                
                <div className="grid grid-cols-2 gap-3">
                   <button 
                    type="button"
                    onClick={() => { setShowManagerModal(false); setPinError(false); setManagerPin(''); }}
                    className="p-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                  >বাতিল</button>
                  <button 
                    type="submit"
                    className="p-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
                  >প্রবেশ করুন</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Manager Status Bar */}
      <div className={`sticky top-0 w-full z-[60] shadow-sm transition-all duration-300 ${isManager ? 'bg-green-600 border-b border-green-700' : 'bg-white border-b border-slate-200'}`}>
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between">
          {isManager ? (
            <>
              <div className="flex items-center gap-2.5 text-white">
                <div className="bg-white/20 p-1.5 rounded-lg">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase opacity-80 leading-none mb-0.5">অ্যাক্সেস লেভেল</p>
                  <p className="text-sm font-black tracking-tight">ম্যানেজার মোড সক্রিয়</p>
                </div>
              </div>
              <button 
                onClick={handleLogoutManager} 
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-white/20"
              >
                <LogOut size={14} /> লগআউট
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5 text-slate-600">
                <div className="bg-slate-100 p-1.5 rounded-lg text-slate-400">
                  <Lock size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400 leading-none mb-0.5">অ্যাক্সেস লেভেল</p>
                  <p className="text-sm font-bold tracking-tight">ভিউ-অনলি মোড</p>
                </div>
              </div>
              <button 
                onClick={() => setShowManagerModal(true)} 
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-100"
              >
                <Unlock size={14} /> ম্যানেজার লগইন
              </button>
            </>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 flex justify-around p-3 md:top-auto md:bottom-0 md:border-t md:px-10 z-50 shadow-lg">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-slate-400'}`}>
          <LayoutDashboard size={20} />
          <span className="text-[10px] font-bold">ড্যাশবোর্ড</span>
        </button>
        <button onClick={() => setActiveTab('meals')} className={`flex flex-col items-center gap-1 ${activeTab === 'meals' ? 'text-blue-600' : 'text-slate-400'}`}>
          <Utensils size={20} />
          <span className="text-[10px] font-bold">মিল এন্ট্রি</span>
        </button>
        <button onClick={() => setActiveTab('bazar')} className={`flex flex-col items-center gap-1 ${activeTab === 'bazar' ? 'text-blue-600' : 'text-slate-400'}`}>
          <ShoppingCart size={20} />
          <span className="text-[10px] font-bold">বাজার ও জমা</span>
        </button>
        <button onClick={() => setActiveTab('members')} className={`flex flex-col items-center gap-1 ${activeTab === 'members' ? 'text-blue-600' : 'text-slate-400'}`}>
          <Users size={20} />
          <span className="text-[10px] font-bold">মেম্বার</span>
        </button>
      </nav>

      <main className="max-w-4xl mx-auto p-4 md:pb-24 pb-20">
        <header className="mb-6">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">স্বপ্নধারা মিল সিট</h1>
          <p className="text-slate-500 text-sm">সহজ মেস ম্যানেজমেন্ট সিস্টেম</p>
        </header>

        {/* Dashboard View */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-blue-500">
                <p className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider flex items-center gap-1"><Banknote size={12}/> নগদ বাজার</p>
                <h2 className="text-lg font-black text-slate-800">৳{cashBazar}</h2>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-red-500">
                <p className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider flex items-center gap-1"><CreditCard size={12}/> বাকি বাজার</p>
                <h2 className="text-lg font-black text-slate-800">৳{creditBazar}</h2>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <p className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">মোট মিল</p>
                <h2 className="text-lg font-black text-orange-500">{totalMeals}</h2>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <p className="text-[10px] text-slate-500 font-bold mb-1 uppercase tracking-wider">মিল রেট</p>
                <h2 className="text-lg font-black text-green-600">৳{mealRate}</h2>
              </div>
            </div>

            {members.length === 0 ? (
              <div className="bg-blue-50 border border-blue-100 p-8 rounded-3xl text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm">
                  <Users size={24}/>
                </div>
                <h3 className="font-bold text-slate-800">কোন মেম্বার পাওয়া যায়নি</h3>
                <p className="text-slate-600 text-sm max-w-xs mx-auto">সিস্টেম শুরু করতে প্রথমে 'ম্যানেজার লগইন' করুন এবং 'মেম্বার' ট্যাবে গিয়ে অন্তত একজন মেম্বার যোগ করুন।</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-700">মেম্বার সামারি</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[11px] uppercase text-slate-500">
                        <th className="p-4 font-bold">নাম</th>
                        <th className="p-4 font-bold">মিল</th>
                        <th className="p-4 font-bold">খরচ</th>
                        <th className="p-4 font-bold">জমা</th>
                        <th className="p-4 font-bold">ব্যালেন্স</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {members.map(member => {
                        const stats = getMemberStats(member.id);
                        const isDue = Number(stats.balance) < 0;
                        return (
                          <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-medium">{member.name}</td>
                            <td className="p-4 font-bold">{stats.meals}</td>
                            <td className="p-4">৳{stats.cost}</td>
                            <td className="p-4 text-blue-600 font-bold">৳{stats.deposits}</td>
                            <td className={`p-4 font-black ${!isDue ? 'text-green-600' : 'text-red-500'}`}>
                              ৳{stats.balance}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Meals Entry View */}
        {activeTab === 'meals' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <CalendarIcon size={20} className="text-blue-600" />
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 bg-transparent border-none focus:ring-0 font-bold text-slate-700 cursor-pointer"
              />
            </div>

            <div className="grid gap-3">
              {members.length === 0 ? (
                <p className="text-center text-slate-400 py-10 italic">মেম্বার যোগ করার পর এখানে মিল এন্ট্রি করতে পারবেন।</p>
              ) : (
                members.map(member => (
                  <div key={member.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <span className="font-bold text-slate-700">{member.name}</span>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => updateMeal(member.id, Math.max(0, (meals[selectedDate]?.[member.id] || 0) - 0.5))}
                        disabled={!isManager}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xl transition-all ${isManager ? 'bg-slate-100 active:scale-90' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}
                      >-</button>
                      <span className="w-12 text-center font-black text-blue-600 text-xl">
                        {meals[selectedDate]?.[member.id] || 0}
                      </span>
                      <button 
                        onClick={() => updateMeal(member.id, (meals[selectedDate]?.[member.id] || 0) + 0.5)}
                        disabled={!isManager}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xl transition-all ${isManager ? 'bg-blue-600 text-white active:scale-90 shadow-md shadow-blue-100' : 'bg-blue-100 text-blue-200 cursor-not-allowed'}`}
                      >+</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Bazar & Deposit View */}
        {activeTab === 'bazar' && (
          <div className="space-y-6">
            {isManager ? (
              <>
                <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <ShoppingCart size={18} className="text-blue-600" /> বাজার খরচ যোগ করুন
                  </h3>
                  <form onSubmit={addBazarEntry} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">আইটেমের নাম</label>
                        <input name="item" placeholder="যেমন: চাল, ডাল" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500" required />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">টাকার পরিমাণ</label>
                        <input name="amount" type="number" placeholder="টাকা" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500" required />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">বাজার কে করেছে?</label>
                        <select name="memberId" className="w-full p-3 rounded-xl border border-slate-200 outline-none bg-white focus:border-blue-500" required>
                          <option value="">মেম্বার সিলেক্ট করুন</option>
                          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">বাজারের তারিখ</label>
                        <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500" required />
                      </div>
                    </div>

                    <div className="flex gap-4 items-center bg-slate-50 p-3 rounded-xl">
                      <span className="text-sm font-bold text-slate-500">ধরণ:</span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="type" value="cash" defaultChecked className="text-blue-600" />
                        <span className="text-sm font-bold">নগদ</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="type" value="credit" className="text-red-600" />
                        <span className="text-sm font-bold">বাকি</span>
                      </label>
                    </div>

                    <button className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-100 hover:bg-blue-700 transition-colors">
                      <Plus size={18} /> বাজার সেভ করুন
                    </button>
                  </form>
                </section>

                <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Wallet size={18} className="text-green-600" /> টাকা জমা নিন
                  </h3>
                  <form onSubmit={addDepositEntry} className="flex flex-col md:flex-row gap-3">
                    <select name="memberId" className="flex-1 p-3 rounded-xl border border-slate-200 outline-none bg-white" required>
                      <option value="">মেম্বার সিলেক্ট করুন</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <input name="amount" type="number" placeholder="টাকা" className="w-full md:w-32 p-3 rounded-xl border border-slate-200 outline-none" required />
                    <button className="bg-green-600 text-white p-3 px-6 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-100">
                      <Plus size={18} /> জমা করুন
                    </button>
                  </form>
                </section>
              </>
            ) : (
              <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-100 text-center space-y-4">
                  <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                    <Lock size={32} />
                  </div>
                  <h4 className="font-black text-slate-800 text-xl tracking-tight">অ্যাক্সেস সংরক্ষিত</h4>
                  <p className="text-slate-500 text-sm max-w-[280px] mx-auto leading-relaxed">নতুন বাজার খরচ বা টাকা জমা যোগ করার জন্য ম্যানেজার পিন দিয়ে লগইন করুন।</p>
                  <button 
                  onClick={() => setShowManagerModal(true)}
                  className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-lg shadow-blue-100 active:scale-95 transition-all"
                  >ম্যানেজার লগইন</button>
              </div>
            )}

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
               <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-700">বাজারের তালিকা</h3>
               </div>
               <div className="divide-y divide-slate-50">
                  {bazarList.length === 0 ? (
                    <p className="p-10 text-center text-slate-400 italic">কোন বাজারের তথ্য নেই।</p>
                  ) : (
                    bazarList.slice().sort((a,b) => new Date(b.date) - new Date(a.date)).map(item => (
                      <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                             <p className="font-bold text-slate-800">{item.item}</p>
                             <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${item.type === 'credit' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                               {item.type === 'credit' ? 'বাকি' : 'নগদ'}
                             </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1"><CalendarIcon size={12}/> {item.date}</span>
                            <span className="flex items-center gap-1"><User size={12}/> {getMemberName(item.memberId)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-black text-slate-700 text-lg">৳{item.amount}</span>
                          {isManager && (
                            <button onClick={() => { if(window.confirm('মুছে ফেলতে চান?')) deleteBazarItem(item.id); }} className="text-slate-200 hover:text-red-500 p-2"><Trash2 size={16}/></button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
               </div>
            </div>
          </div>
        )}

        {/* Members Management */}
        {activeTab === 'members' && (
          <div className="space-y-6">
            {isManager && (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-4">নতুন মেম্বার যোগ করুন</h3>
                <div className="flex gap-2">
                  <input 
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="মেম্বারের নাম" 
                    className="flex-1 p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100" 
                  />
                  <button 
                    onClick={addMember}
                    className="bg-slate-800 text-white px-8 rounded-xl font-bold hover:bg-slate-900 transition-all shadow-lg active:scale-95"
                  >যোগ দিন</button>
                </div>
              </div>
            )}

            <div className="grid gap-3">
              {members.length === 0 ? (
                <div className="bg-white p-10 rounded-2xl border border-dashed border-slate-200 text-center">
                  <p className="text-slate-400 italic">কোন মেম্বার নেই। ম্যানেজার মোড থেকে মেম্বার যোগ করুন।</p>
                </div>
              ) : (
                members.map(member => (
                  <div key={member.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between animate-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black shadow-md shadow-blue-100">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 text-lg block">{member.name}</span>
                        <span className="text-xs text-slate-400">সক্রিয় মেম্বার</span>
                      </div>
                    </div>
                    {isManager && (
                      <button 
                        onClick={() => { if(window.confirm(`${member.name} কে রিমুভ করতে চান?`)) deleteMember(member.id); }}
                        className="p-3 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;

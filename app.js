import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// DOM 要素
const taskInput = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');
const taskList = document.getElementById('taskList');
const emptyMessage = document.getElementById('emptyMessage');
const todayEl = document.getElementById('today');
const statusEl = document.getElementById('status');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userInfo = document.getElementById('userInfo');

// アプリの状態
let tasks = [];
let dailyChecks = {}; // { 'YYYY-MM-DD': {taskId: true, ...}, ... }
let currentDate = getToday();
let currentUser = null;
let unsubscribeTasks = null;
let unsubscribeChecks = null;

// 初期化
function init(){
  renderDate();
  setTaskControls(false);
  renderTasks();
  attachEvents();
  subscribeAuth();
  // 日付が変わったか定期チェック（12秒ごと）
  setInterval(checkDateChange, 12000);
}

// 日付を YYYY-MM-DD 形式で取得
function getToday(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function setStatus(message, isError = false){
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function getTasksRef(){
  return collection(db, 'users', currentUser.uid, 'tasks');
}

function getDailyCheckDocRef(date){
  return doc(db, 'users', currentUser.uid, 'dailyChecks', date);
}

function setTaskControls(enabled){
  taskInput.disabled = !enabled;
  addBtn.disabled = !enabled;
}

function clearSubscriptions(){
  if(unsubscribeTasks) unsubscribeTasks();
  if(unsubscribeChecks) unsubscribeChecks();
  unsubscribeTasks = null;
  unsubscribeChecks = null;
}

function renderAuth(){
  const loggedIn = !!currentUser;
  loginBtn.hidden = loggedIn;
  logoutBtn.hidden = !loggedIn;
  userInfo.hidden = !loggedIn;
  userInfo.textContent = loggedIn ? `${currentUser.displayName || currentUser.email} でログイン中` : '';
}

function resetUserData(){
  tasks = [];
  dailyChecks = {};
  renderTasks();
}

function subscribeAuth(){
  onAuthStateChanged(auth, user => {
    clearSubscriptions();
    currentUser = user;
    renderAuth();
    resetUserData();

    if(!currentUser){
      setTaskControls(false);
      setStatus('ログインしてください');
      return;
    }

    setTaskControls(true);
    setStatus('Firebase に接続中...');
    subscribeTasks();
    subscribeDailyChecks();
  });
}

function subscribeTasks(){
  if(!currentUser) return;
  const tasksQuery = query(getTasksRef(), orderBy('createdAt', 'asc'));
  unsubscribeTasks = onSnapshot(tasksQuery, snapshot => {
    tasks = snapshot.docs.map(taskDoc => ({
      id: taskDoc.id,
      ...taskDoc.data()
    }));
    renderTasks();
    setStatus('Firebase に保存中');
  }, error => {
    console.error(error);
    setStatus('Firebase の読み込みに失敗しました', true);
  });
}

function subscribeDailyChecks(){
  if(!currentUser) return;
  if(unsubscribeChecks) unsubscribeChecks();

  const todayDocRef = getDailyCheckDocRef(currentDate);
  unsubscribeChecks = onSnapshot(todayDocRef, snapshot => {
    dailyChecks[currentDate] = snapshot.exists() ? snapshot.data() : {};
    renderTasks();
    setStatus('Firebase に保存中');
  }, error => {
    console.error(error);
    setStatus('Firebase の読み込みに失敗しました', true);
  });
}

// タスク追加（空白のみの入力を防ぐ）
async function addTask(title){
  if(!currentUser) return false;
  const trimmed = title.trim();
  if(!trimmed) return false;
  const id = `t-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const task = {
    title: trimmed,
    createdAt: serverTimestamp()
  };
  await setDoc(doc(getTasksRef(), id), task);
  return true;
}

// タスク削除（確認ダイアログ）
async function deleteTask(id){
  if(!currentUser) return;
  const task = tasks.find(t=>t.id===id);
  if(!task) return;
  const ok = confirm(`タスク「${task.title}」を削除しますか？`);
  if(!ok) return;
  await deleteDoc(doc(getTasksRef(), id));

  const today = getToday();
  const checks = {...(dailyChecks[today] || {})};
  delete checks[id];
  await setDoc(getDailyCheckDocRef(today), checks);
}

// チェックの切替
async function toggleCheck(id){
  if(!currentUser) return;
  const today = getToday();
  if(!dailyChecks[today]) dailyChecks[today] = {};
  dailyChecks[today][id] = !dailyChecks[today][id];
  renderTasks();
  await setDoc(getDailyCheckDocRef(today), dailyChecks[today]);
}

// 表示レンダリング
function renderDate(){
  const d = new Date();
  // ローカル日付表示（例: 2026-06-20）
  todayEl.textContent = `${currentDate}`;
}

function renderTasks(){
  // 今日のチェック状態を取得
  const checks = dailyChecks[currentDate] || {};

  taskList.innerHTML = '';
  if(!currentUser){
    emptyMessage.style.display = 'block';
    emptyMessage.textContent = 'ログインするとタスクを表示できます';
    return;
  }
  if(tasks.length === 0){
    emptyMessage.style.display = 'block';
    emptyMessage.textContent = 'タスクを追加してください';
    return;
  }
  emptyMessage.style.display = 'none';

  tasks.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!checks[task.id];
    checkbox.setAttribute('aria-label', `タスク ${task.title} のチェック`);
    checkbox.addEventListener('change', async ()=> {
      checkbox.disabled = true;
      try{
        await toggleCheck(task.id);
      }catch(error){
        console.error(error);
        setStatus('チェックの保存に失敗しました', true);
        renderTasks();
      }
    });

    const title = document.createElement('div');
    title.className = 'task-title' + (checkbox.checked ? ' done' : '');
    title.textContent = task.title;

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '削除';
    del.setAttribute('aria-label', `タスク ${task.title} を削除`);
    del.addEventListener('click', async ()=> {
      del.disabled = true;
      try{
        await deleteTask(task.id);
      }catch(error){
        console.error(error);
        setStatus('タスクの削除に失敗しました', true);
        del.disabled = false;
      }
    });

    li.appendChild(checkbox);
    li.appendChild(title);
    li.appendChild(del);
    taskList.appendChild(li);
  });
}

// 日付が変わったか確認し、変わっていたら再表示
function checkDateChange(){
  const today = getToday();
  if(today !== currentDate){
    currentDate = today;
    renderDate();
    if(currentUser) subscribeDailyChecks();
    renderTasks(); // 今日のチェック状態が切り替わる
  }
}

// イベントの紐付け
function attachEvents(){
  loginBtn.addEventListener('click', async ()=>{
    loginBtn.disabled = true;
    try{
      await signInWithPopup(auth, provider);
    }catch(error){
      console.error(error);
      setStatus('ログインに失敗しました', true);
    }finally{
      loginBtn.disabled = false;
    }
  });

  logoutBtn.addEventListener('click', async ()=>{
    logoutBtn.disabled = true;
    try{
      await signOut(auth);
    }catch(error){
      console.error(error);
      setStatus('ログアウトに失敗しました', true);
    }finally{
      logoutBtn.disabled = false;
    }
  });

  addBtn.addEventListener('click', async ()=>{
    addBtn.disabled = true;
    try{
      if(await addTask(taskInput.value)) taskInput.value = '';
    }catch(error){
      console.error(error);
      setStatus('タスクの追加に失敗しました', true);
    }finally{
      addBtn.disabled = !currentUser;
      if(currentUser) taskInput.focus();
    }
  });

  taskInput.addEventListener('keydown', async (e)=>{
    if(e.key === 'Enter'){
      addBtn.click();
    }
  });
}

// 初期化実行
init();

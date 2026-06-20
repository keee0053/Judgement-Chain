// 毎日チェックリストの主要ロジック

// localStorage のキー
const STORAGE_KEYS = {
  tasks: 'dailycheck_tasks',
  dailyChecks: 'dailycheck_dailyChecks'
};

// DOM 要素
const taskInput = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');
const taskList = document.getElementById('taskList');
const emptyMessage = document.getElementById('emptyMessage');
const todayEl = document.getElementById('today');

// アプリの状態
let tasks = [];
let dailyChecks = {}; // { 'YYYY-MM-DD': {taskId: true, ...}, ... }
let currentDate = getToday();

// 初期化
function init(){
  loadState();
  renderDate();
  renderTasks();
  attachEvents();
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

// ストレージ読み書き
function loadState(){
  try{
    const t = localStorage.getItem(STORAGE_KEYS.tasks);
    const c = localStorage.getItem(STORAGE_KEYS.dailyChecks);
    tasks = t ? JSON.parse(t) : [];
    dailyChecks = c ? JSON.parse(c) : {};
  }catch(e){
    tasks = [];
    dailyChecks = {};
  }
}

function saveTasks(){
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
}

function saveDailyChecks(){
  localStorage.setItem(STORAGE_KEYS.dailyChecks, JSON.stringify(dailyChecks));
}

// タスク追加（空白のみの入力を防ぐ）
function addTask(title){
  const trimmed = title.trim();
  if(!trimmed) return false;
  const id = `t-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const task = {id, title: trimmed, createdAt: new Date().toISOString()};
  tasks.push(task);
  saveTasks();
  renderTasks();
  return true;
}

// タスク削除（確認ダイアログ）
function deleteTask(id){
  const task = tasks.find(t=>t.id===id);
  if(!task) return;
  const ok = confirm(`タスク「${task.title}」を削除しますか？`);
  if(!ok) return;
  tasks = tasks.filter(t=>t.id!==id);
  // dailyChecks の該当タスクキーを全日付から削除
  Object.keys(dailyChecks).forEach(date => {
    if(dailyChecks[date] && dailyChecks[date][id] !== undefined){
      delete dailyChecks[date][id];
    }
  });
  saveTasks();
  saveDailyChecks();
  renderTasks();
}

// チェックの切替
function toggleCheck(id){
  const today = getToday();
  if(!dailyChecks[today]) dailyChecks[today] = {};
  dailyChecks[today][id] = !dailyChecks[today][id];
  saveDailyChecks();
  renderTasks();
}

// 表示レンダリング
function renderDate(){
  const d = new Date();
  // ローカル日付表示（例: 2026-06-20）
  todayEl.textContent = `${currentDate}`;
}

function renderTasks(){
  // 今日のチェック状態を取得
  const today = getToday();
  const checks = dailyChecks[today] || {};

  taskList.innerHTML = '';
  if(tasks.length === 0){
    emptyMessage.style.display = 'block';
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
    checkbox.addEventListener('change', ()=> toggleCheck(task.id));

    const title = document.createElement('div');
    title.className = 'task-title' + (checkbox.checked ? ' done' : '');
    title.textContent = task.title;

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '削除';
    del.setAttribute('aria-label', `タスク ${task.title} を削除`);
    del.addEventListener('click', ()=> deleteTask(task.id));

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
    renderTasks(); // 今日のチェック状態が切り替わる
  }
}

// イベントの紐付け
function attachEvents(){
  addBtn.addEventListener('click', ()=>{
    if(addTask(taskInput.value)) taskInput.value = '';
  });

  taskInput.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      if(addTask(taskInput.value)) taskInput.value = '';
    }
  });

  // ページ再表示やフォーカス時にも最新の状態にする
  window.addEventListener('focus', ()=>{
    loadState();
    renderTasks();
  });
}

// 初期化実行
init();

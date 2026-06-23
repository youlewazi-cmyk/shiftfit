export function today() {
  return formatDate(new Date());
}

export function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 9) return '早上好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

export function getDateText() {
  const now = new Date();
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 周${days[now.getDay()]}`;
}

export function formatTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function getWeekRange(dateStr) {
  const d = parseDate(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const mon = addDays(d, -diff);
  const sun = addDays(mon, 6);
  return { start: formatDate(mon), end: formatDate(sun) };
}

export function getMonthRange(dateStr) {
  const d = parseDate(dateStr);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: formatDate(first), end: formatDate(last) };
}

export async function calcStreak(db) {
  const all = await db.workouts.orderBy('date').reverse().uniqueKeys();
  if (all.length === 0) return 0;

  const dates = all.map(d => d).sort().reverse();
  const todayStr = today();

  let streak = 0;
  let check = parseDate(todayStr);
  const hasToday = dates[0] === todayStr;
  if (!hasToday) {
    check = addDays(check, -1);
  }

  const dateSet = new Set(dates);
  while (true) {
    if (dateSet.has(formatDate(check))) {
      streak++;
      check = addDays(check, -1);
    } else {
      break;
    }
  }
  return streak;
}

export const TYPE_MAP = {
  strength: { name: '力量', icon: '🏋️' },
  cardio: { name: '有氧', icon: '🏃' },
  stretch: { name: '拉伸', icon: '🧘' },
  other: { name: '其他', icon: '💪' }
};

export const INTENSITY_MAP = {
  light: '轻松',
  moderate: '适中',
  intense: '高强度'
};

export function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => el.classList.add('hidden'), 1800);
}
export const BODY_CATEGORIES = {
  chest: { name: '胸', icon: '🎯', color: '#ff6b6b' },
  back: { name: '背', icon: '🔙', color: '#4ecdc4' },
  legs: { name: '腿', icon: '🦿', color: '#45b7d1' },
  shoulders: { name: '肩', icon: '🏔️', color: '#96ceb4' },
  arms: { name: '手臂', icon: '💪', color: '#ffeaa7' }
};

export const DEFAULT_EXERCISES = [
  { name: '杠铃卧推', category: 'chest', isCustom: 0 },
  { name: '哑铃卧推', category: 'chest', isCustom: 0 },
  { name: '上斜哑铃卧推', category: 'chest', isCustom: 0 },
  { name: '哑铃飞鸟', category: 'chest', isCustom: 0 },
  { name: '绳索夹胸', category: 'chest', isCustom: 0 },
  { name: '引体向上', category: 'back', isCustom: 0 },
  { name: '杠铃划船', category: 'back', isCustom: 0 },
  { name: '高位下拉', category: 'back', isCustom: 0 },
  { name: '坐姿划船', category: 'back', isCustom: 0 },
  { name: '硬拉', category: 'back', isCustom: 0 },
  { name: '杠铃深蹲', category: 'legs', isCustom: 0 },
  { name: '腿举', category: 'legs', isCustom: 0 },
  { name: '腿弯举', category: 'legs', isCustom: 0 },
  { name: '腿屈伸', category: 'legs', isCustom: 0 },
  { name: '保加利亚分腿蹲', category: 'legs', isCustom: 0 },
  { name: '杠铃推举', category: 'shoulders', isCustom: 0 },
  { name: '哑铃推举', category: 'shoulders', isCustom: 0 },
  { name: '侧平举', category: 'shoulders', isCustom: 0 },
  { name: '前平举', category: 'shoulders', isCustom: 0 },
  { name: '面拉', category: 'shoulders', isCustom: 0 },
  { name: '杠铃弯举', category: 'arms', isCustom: 0 },
  { name: '哑铃弯举', category: 'arms', isCustom: 0 },
  { name: '锤式弯举', category: 'arms', isCustom: 0 },
  { name: '绳索下压', category: 'arms', isCustom: 0 },
  { name: '臂屈伸', category: 'arms', isCustom: 0 }
];

/* ---- PPL 训练计划 ---- */

export const PPL_DAYS = { push: { name: '推日', icon: '🏋️', desc: '胸·肩·三头' },
  pull: { name: '拉日', icon: '🔙', desc: '背·二头·后束' },
  legs: { name: '腿日', icon: '🦿', desc: '股四·腘绳·臀' },
  upper: { name: '上肢日', icon: '💪', desc: '胸·背·肩·臂' },
  rest: { name: '恢复日', icon: '💤', desc: '睡眠·拉伸·散步' } };

export const DEFAULT_PPL_PLAN = {
  push: [
    { name: '杠铃卧推', sets: 4, reps: 8, weight: 50 },
    { name: '上斜哑铃卧推', sets: 4, reps: 10, weight: 40 },
    { name: '绳索夹胸', sets: 3, reps: 15, weight: 0 },
    { name: '哑铃肩推', sets: 3, reps: 10, weight: 30 },
    { name: '侧平举', sets: 4, reps: 15, weight: 0 },
    { name: '绳索下压', sets: 3, reps: 12, weight: 0 }
  ],
  pull: [
    { name: '高位下拉', sets: 4, reps: 10, weight: 50 },
    { name: '杠铃划船', sets: 4, reps: 8, weight: 40 },
    { name: '坐姿划船', sets: 3, reps: 12, weight: 0 },
    { name: '引体向上', sets: 3, reps: 0, weight: 0 },
    { name: '哑铃弯举', sets: 3, reps: 12, weight: 0 },
    { name: '锤式弯举', sets: 3, reps: 12, weight: 0 }
  ],
  legs: [
    { name: '杠铃深蹲', sets: 4, reps: 8, weight: 60 },
    { name: '腿举', sets: 4, reps: 10, weight: 80 },
    { name: '罗马尼亚硬拉', sets: 4, reps: 10, weight: 60 },
    { name: '腿弯举', sets: 3, reps: 12, weight: 0 },
    { name: '腿屈伸', sets: 3, reps: 12, weight: 0 },
    { name: '提踵', sets: 5, reps: 20, weight: 0 }
  ],
  upper: [
    { name: '杠铃卧推', sets: 4, reps: 8, weight: 50 },
    { name: '引体向上', sets: 3, reps: 0, weight: 0 },
    { name: '哑铃肩推', sets: 3, reps: 10, weight: 30 },
    { name: '杠铃弯举', sets: 3, reps: 12, weight: 0 },
    { name: '绳索下压', sets: 3, reps: 12, weight: 0 }
  ]

};


function normalizeExercises(exList) {
  if (!exList || !exList.length) return [];
  if (typeof exList[0] === 'string') {
    return exList.map(name => ({ name, sets: 3, reps: 10, weight: 0 }));
  }
  return exList;
}

export async function getShiftInfo(shiftConfig) {
  const { getShiftCycle } = await import('./db.js');
  const cycle = await getShiftCycle();
  if (!cycle || cycle.length === 0) return { shiftName: '未知', plan: 'rest', dayIndex: 0, totalDays: 0 };
  const start = parseDate(shiftConfig.startDate);
  const now = new Date();
  const elapsed = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  const idx = ((elapsed % cycle.length) + cycle.length) % cycle.length;
  const day = cycle[idx];
  return { shiftName: day.name, plan: day.plan || 'rest', dayIndex: idx, totalDays: elapsed, cycleLength: cycle.length };
}

export async function getTomorrowInfo(shiftConfig) {
  const info = await getShiftInfo(shiftConfig);
  const { getShiftCycle } = await import('./db.js');
  const cycle = await getShiftCycle();
  const nextIdx = ((info.dayIndex + 1) % cycle.length + cycle.length) % cycle.length;
  const next = cycle[nextIdx];
  return { shiftName: next.name, plan: next.plan || 'rest', dayIndex: nextIdx };
}

export async function getPlanForShift(shiftInfo) {
  const { getPlanConfig } = await import('./db.js');
  const config = await getPlanConfig();
  const planKey = shiftInfo.plan;
  if (planKey === 'rest') return null;
  const dayInfo = PPL_DAYS[planKey] || PPL_DAYS.rest;
  const exercises = normalizeExercises(config[planKey] || DEFAULT_PPL_PLAN[planKey] || []);
  return { key: planKey, ...dayInfo, exercises, plan: planKey };
}

/* ---- 饮食目标 ---- */

export const DIET_TARGETS = { protein: 110, calories: 2800, milk: 500, eggs: 3, chicken: 200 };

export const FOOD_ITEMS = {
  milk: { name: '牛奶(ml)', target: 500, icon: '🥛' },
  eggs: { name: '鸡蛋(个)', target: 3, icon: '🥚' },
  chicken: { name: '鸡胸肉(g)', target: 200, icon: '🍗' }
};

/* ---- 检查提醒 ---- */

export function checkReminderTime(timeStr) {
  const now = new Date();
  const [h, m] = timeStr.split(':').map(Number);
  return now.getHours() === h && now.getMinutes() >= m && now.getMinutes() < m + 5;
}

const _lastReminders = {};

export async function checkReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const { getReminderConfig, getShiftConfig, getSetting, getDietByDate, getTodayWorkoutExercises } = await import('./db.js');
  const cfg = await getReminderConfig();
  if (!cfg || !cfg.enabled) return;

  const now = new Date();
  const timeKey = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Training reminder
  if (cfg.enabled.training && checkReminderTime(cfg.trainingTime) && !_lastReminders['training_' + today()]) {
    const shiftCfg = await getShiftConfig();
    const info = await getShiftInfo(shiftCfg);
    if (info.plan !== 'rest') {
      _lastReminders['training_' + today()] = true;
      new Notification('ShiftFit', { body: `今天是${info.shiftName}，训练日！`, icon: '/assets/icons/icon-192.png' });
    }

  // Diet reminders
  if (cfg.enabled.diet && cfg.dietTimes) {
    for (const t of cfg.dietTimes) {
      if (checkReminderTime(t) && !_lastReminders['diet_' + today() + '_' + t]) {
        _lastReminders['diet_' + today() + '_' + t] = true;
        const diets = await getDietByDate(today());
        const protein = diets.reduce((s, d) => s + (d.protein || 0), 0);
        new Notification('ShiftFit', { body: `记得记录饮食！今日蛋白 ${protein}/110g`, icon: '/assets/icons/icon-192.png' });
      }
    }
  }
}
/* ---- PR 计算 ---- */

export function calcSetVolume(sets) {
  return sets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
}

export function calcMaxWeightInSets(sets) {
  return Math.max(0, ...sets.map(s => s.weight || 0));
}

export async function checkPRBreak(exerciseId, exerciseName, sets) {
  const { getPRMaxWeight, getPRMaxVolume } = await import('./db.js');
  const prevMaxW = await getPRMaxWeight(exerciseId);
  const prevMaxV = await getPRMaxVolume(exerciseId);

  const newMaxW = calcMaxWeightInSets(sets);
  const newVol = calcSetVolume(sets);

  const breakthroughs = [];
  if (prevMaxW > 0 && newMaxW > prevMaxW) {
    breakthroughs.push({ type: 'weight', exercise: exerciseName, old: prevMaxW, new: newMaxW });
  }
  if (prevMaxV > 0 && newVol > prevMaxV) {
    breakthroughs.push({ type: 'volume', exercise: exerciseName, old: prevMaxV, new: newVol });
  }
  return breakthroughs;
}

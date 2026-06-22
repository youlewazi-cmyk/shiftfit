import { today, getWeekRange, getMonthRange, DEFAULT_EXERCISES, DEFAULT_PPL_PLAN } from './utils.js?v=20260622a';

const db = new Dexie('FitnessTracker');

db.version(1).stores({ workouts: '++id, date, type, createdAt', weightRecords: '++id, date, createdAt', settings: 'key' });
db.version(2).stores({ workouts: '++id, date, type, createdAt', weightRecords: '++id, date, createdAt', settings: 'key', exercises: '++id, category, name' });
db.version(3).stores({ workouts: '++id, date, type, createdAt', weightRecords: '++id, date, createdAt', settings: 'key', exercises: '++id, category, name', workoutExercises: '++id, workoutId, exerciseId, date' });

db.version(4).stores({
  workouts: '++id, date, type, createdAt',
  weightRecords: '++id, date, createdAt',
  settings: 'key',
  exercises: '++id, category, name',
  workoutExercises: '++id, workoutId, exerciseId, date',
  shiftConfig: 'key',
  dietRecords: '++id, date, mealType, createdAt',
  reminders: 'key'
});

/* ---- Workouts ---- */

export async function addWorkoutWithExercises({ type, duration, intensity, note, exercises }) {
  const now = new Date().toISOString();
  const dateStr = today();
  const workoutId = await db.workouts.add({ type, duration, intensity, note: note || '', date: dateStr, createdAt: now });
  const weRecords = exercises.map(ex => ({ workoutId, exerciseId: ex.exerciseId, exerciseName: ex.exerciseName, category: ex.category, sets: ex.sets, date: dateStr, createdAt: now }));
  await db.workoutExercises.bulkAdd(weRecords);
  return workoutId;
}

export async function getWorkoutsByDate(dateStr) { return db.workouts.where('date').equals(dateStr).reverse().sortBy('createdAt'); }
export async function getWorkoutExercises(workoutId) { return db.workoutExercises.where('workoutId').equals(workoutId).toArray(); }
export async function getTodayWorkoutExercises() { return db.workoutExercises.where('date').equals(today()).toArray(); }
export async function getWorkoutDatesInRange(start, end) { const rows = await db.workouts.where('date').between(start, end, true, true).toArray(); return [...new Set(rows.map(r => r.date))]; }
export async function getWorkoutCountInRange(start, end) { return db.workouts.where('date').between(start, end, true, true).count(); }

export async function deleteWorkout(id) {
  await db.workoutExercises.where('workoutId').equals(id).delete();
  return db.workouts.delete(id);
}

export async function getWeekStats() { const { start, end } = getWeekRange(today()); const count = await getWorkoutCountInRange(start, end); const rows = await db.workouts.where('date').between(start, end, true, true).toArray(); const totalMin = rows.reduce((s, r) => s + r.duration, 0); return { count, totalMin }; }
export async function getMonthStats() { const { start, end } = getMonthRange(today()); const count = await getWorkoutCountInRange(start, end); const rows = await db.workouts.where('date').between(start, end, true, true).toArray(); const totalMin = rows.reduce((s, r) => s + r.duration, 0); return { count, totalMin }; }
export async function getTotalStats() { const count = await db.workouts.count(); const rows = await db.workouts.toArray(); const totalMin = rows.reduce((s, r) => s + r.duration, 0); return { count, totalMin }; }
export async function getTypeDistribution(start, end) { const rows = await db.workouts.where('date').between(start, end, true, true).toArray(); const dist = { strength: 0, cardio: 0, stretch: 0, other: 0 }; rows.forEach(r => { dist[r.type] = (dist[r.type] || 0) + 1; }); return dist; }
export async function getAllWorkouts(limit = 200) { return db.workouts.orderBy('createdAt').reverse().limit(limit).toArray(); }

/* ---- PR Queries ---- */

export async function getExerciseHistory(exerciseId) { return db.workoutExercises.where('exerciseId').equals(exerciseId).reverse().sortBy('createdAt'); }
export async function getPRMaxWeight(exerciseId) { const records = await db.workoutExercises.where('exerciseId').equals(exerciseId).toArray(); let max = 0; records.forEach(r => r.sets.forEach(s => { if (s.weight > max) max = s.weight; })); return max; }
export async function getPRMaxVolume(exerciseId) { const records = await db.workoutExercises.where('exerciseId').equals(exerciseId).toArray(); let max = 0; records.forEach(r => { const v = r.sets.reduce((s, set) => s + (set.weight || 0) * (set.reps || 0), 0); if (v > max) max = v; }); return max; }

/* ---- Weight ---- */

export async function setWeight(weight, note) { const dateStr = today(); const existing = await db.weightRecords.where('date').equals(dateStr).first(); if (existing) return db.weightRecords.update(existing.id, { weight, note: note || '', createdAt: new Date().toISOString() }); return db.weightRecords.add({ weight, note: note || '', date: dateStr, createdAt: new Date().toISOString() }); }
export async function getLatestWeight() { return db.weightRecords.orderBy('createdAt').reverse().first(); }
export async function getWeightTrend(days) { var records = await getWeightRecords(days); if (records.length < 2) return 0; records.reverse(); return parseFloat((records[records.length - 1].weight - records[0].weight).toFixed(1)); }
export async function getWeightRecords(limit = 30) { return db.weightRecords.orderBy('date').reverse().limit(limit).toArray(); }

/* ---- Settings ---- */

export async function getSetting(key, defaultValue) { const row = await db.settings.get(key); return row ? row.value : defaultValue; }
export async function setSetting(key, value) { const existing = await db.settings.get(key); if (existing) return db.settings.update(key, { value }); return db.settings.add({ key, value }); }

/* ---- Exercises ---- */

export async function seedDefaultExercises() { const count = await db.exercises.count(); if (count === 0) await db.exercises.bulkAdd(DEFAULT_EXERCISES); }
export async function getExercisesByCategory(category) { if (category === 'all') return db.exercises.toArray(); return db.exercises.where('category').equals(category).toArray(); }
export async function getAllExercises() { return db.exercises.toArray(); }
export async function addExercise({ name, category }) { const exists = await db.exercises.where({ name, category }).first(); if (exists) return exists.id; return db.exercises.add({ name, category, isCustom: 1, createdAt: new Date().toISOString() }); }
export async function updateExercise(id, { name, category }) { return db.exercises.update(id, { name, category }); }
export async function deleteExercise(id) { const ex = await db.exercises.get(id); if (!ex || !ex.isCustom) return false; return db.exercises.delete(id); }

/* ---- PPL Plan ---- */

export async function getPlanConfig() { const row = await db.settings.get('pplPlan'); return row ? row.value : { ...DEFAULT_PPL_PLAN }; }
export async function savePlanConfig(config) { const existing = await db.settings.get('pplPlan'); if (existing) return db.settings.update('pplPlan', { value: config }); return db.settings.add({ key: 'pplPlan', value: config }); }

/* ---- Shift Config ---- */

export async function getShiftConfig() { const row = await db.shiftConfig.get('shift'); if (!row) { const def = { startDate: today() }; await db.shiftConfig.add({ key: 'shift', ...def }); return def; } return row; }
export async function saveShiftConfig(cfg) { const existing = await db.shiftConfig.get('shift'); if (existing) return db.shiftConfig.update('shift', cfg); return db.shiftConfig.add({ key: 'shift', ...cfg }); }

/* ---- Shift Cycle ---- */

const DEFAULT_SHIFT_CYCLE = [
  { name: '值班24h', plan: 'rest', time: '' },
  { name: '白班', plan: 'push', time: '08:00' },
  { name: '夜班A', plan: 'pull', time: '20:00' },
  { name: '夜班B', plan: 'rest', time: '20:00' },
  { name: '休息', plan: 'legs', time: '' },
  { name: '休息', plan: 'upper', time: '' }
];

export async function getShiftCycle() {
  const row = await db.shiftConfig.get('cycle');
  if (!row) {
    await db.shiftConfig.add({ key: 'cycle', value: DEFAULT_SHIFT_CYCLE });
    return [...DEFAULT_SHIFT_CYCLE];
  }
  return row.value;
}

export async function saveShiftCycle(cycle) {
  const existing = await db.shiftConfig.get('cycle');
  if (existing) return db.shiftConfig.update('cycle', { value: cycle });
  return db.shiftConfig.add({ key: 'cycle', value: cycle });

}
/* ---- Diet ---- */

export async function getDietByDate(dateStr) { return db.dietRecords.where('date').equals(dateStr).toArray(); }
export async function saveDietRecord({ mealType, foodItems, protein, calories }) { const dateStr = today(); const existing = await db.dietRecords.where({ date: dateStr, mealType }).first(); if (existing) return db.dietRecords.update(existing.id, { foodItems, protein, calories, createdAt: new Date().toISOString() }); return db.dietRecords.add({ date: dateStr, mealType, foodItems, protein, calories, createdAt: new Date().toISOString() }); }
export async function getDietRecords(limit = 30) { return db.dietRecords.orderBy('date').reverse().limit(limit).toArray(); }

/* ---- Diet Counters ---- */

export async function getDietCounters() {
  const row = await db.dietRecords.where({ date: today(), mealType: 'counters' }).first();
  return row ? row.foodItems : {};
}

/* ---- Recovery ---- */
export async function getRecoveryRecord() { return db.dietRecords.where({ date: today(), mealType: 'recovery' }).first(); }
export async function saveRecoveryRecord(data) { var d = today(); var exist = await db.dietRecords.where({ date: d, mealType: 'recovery' }).first(); if (exist) return db.dietRecords.update(exist.id, { foodItems: data, createdAt: new Date().toISOString() }); return db.dietRecords.add({ date: d, mealType: 'recovery', foodItems: data, protein: 0, calories: 0, createdAt: new Date().toISOString() }); }

export async function saveDietCounters(items) {
  const dateStr = today();
  const existing = await db.dietRecords.where({ date: dateStr, mealType: 'counters' }).first();
  if (existing) return db.dietRecords.update(existing.id, { foodItems: items, createdAt: new Date().toISOString() });
  return db.dietRecords.add({ date: dateStr, mealType: 'counters', foodItems: items, protein: 0, calories: 0, createdAt: new Date().toISOString() });
}

/* ---- Reminders ---- */

export async function getReminderConfig() { const row = await db.reminders.get('reminders'); if (!row) { const def = { trainingTime: '18:00', dietTimes: ['08:00', '12:00', '19:00'], weightTime: '08:00', weightDay: 1, enabled: { training: true, diet: true, weight: true, streak: true } }; await db.reminders.add({ key: 'reminders', ...def }); return def; } return row; }
export async function saveReminderConfig(cfg) { const existing = await db.reminders.get('reminders'); if (existing) return db.reminders.update('reminders', cfg); return db.reminders.add({ key: 'reminders', ...cfg }); }

export { db };
export default db;

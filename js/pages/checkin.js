import { showToast, BODY_CATEGORIES, checkPRBreak, calcSetVolume, calcMaxWeightInSets, today } from '../utils.js?v=20260622b';
import { addWorkoutWithExercises, getTodayWorkoutExercises, getAllExercises, getExerciseHistory, getPRMaxWeight } from '../db.js';

let state = null;

export async function renderCheckin() { try {
  const preset = sessionStorage.getItem('workoutPreset');
  sessionStorage.removeItem('workoutPreset');

  if (preset) {
    const exercises = JSON.parse(preset);
    const allEx = await getAllExercises();
    const resolved = exercises.map(e => {
      const name = typeof e === 'string' ? e : e.name;
      const found = allEx.find(a => a.name === name);
      return {
        exerciseId: found ? found.id : null,
        exerciseName: name,
        category: found ? found.category : 'other',
        targetSets: typeof e === 'object' ? e.sets : 4,
        targetReps: typeof e === 'object' ? e.reps : 8,
        targetWeight: typeof e === 'object' ? (e.weight || 0) : 0
      };
    });
    startWorkoutSession(resolved);
  } else {
    state = null;
    await renderSelectorMode();
    await renderTodaySummary();
  }
} catch(e) { document.getElementById('checkin-form').innerHTML = '<div class="card" style="color:var(--danger);padding:20px;text-align:center">加载失败：' + e.message + '<br><button class="btn btn-primary btn-sm" onclick="location.reload()" style="margin-top:12px">重试</button></div>'; }

/* ---- Selector Mode */
async function renderSelectorMode() {
  const exercises = await getAllExercises();
  const el = document.getElementById('checkin-form');
  el.innerHTML = `
    <div class="card">
      <div class="card-title" style="margin-bottom:10px">选择动作</div>
      <div class="category-tabs" id="cat-tabs">
        <button class="category-tab active" data-cat="all">🏋️ 全部</button>
        ${Object.entries(BODY_CATEGORIES).map(([k, v]) => `<button class="category-tab" data-cat="${k}">${v.icon} ${v.name}</button>`).join('')}
      </div>
      <div class="checkin-exercise-grid" id="ex-grid"></div>
      <div id="selected-list"></div>
      <button class="btn btn-primary btn-block" id="btn-start-session" style="margin-top:14px" disabled>开始训练</button>
    </div>`;

  let selected = [];
  let selectedIds = new Set();

  function renderGrid(filteredEx) {
    document.getElementById('ex-grid').innerHTML = filteredEx.map(ex => {
      const cat = BODY_CATEGORIES[ex.category] || { icon: '🏋️', color: '#888', name: '' };
      const isSel = selectedIds.has(ex.id);
      return `<button class="checkin-ex-item${isSel ? ' selected' : ''}" data-id="${ex.id}"><span style="font-size:18px">${cat.icon}</span><span style="font-size:var(--font-xs);color:var(--text-secondary)">${ex.name}</span></button>`;
    }).join('');
    document.querySelectorAll('#ex-grid .checkin-ex-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        if (selectedIds.has(id)) { selectedIds.delete(id); selected = selected.filter(s => s.exerciseId !== id); }
        else { const ex = exercises.find(e => e.id === id); selectedIds.add(id); selected.push({ exerciseId: id, exerciseName: ex.name, category: ex.category, targetSets: 3, targetReps: 10, targetWeight: 0 }); }
        renderGrid(filteredEx);
        renderSelected();
      });
    });
  }

  function renderSelected() {
    const btn = document.getElementById('btn-start-session');
    btn.disabled = selected.length === 0;
    document.getElementById('selected-list').innerHTML = selected.length
      ? selected.map((ex, i) => `<span class="plan-ex-tag">${i + 1}. ${ex.exerciseName} <button class="rm-sel" data-idx="${i}">✕</button></span>`).join('')
      : '';
    document.querySelectorAll('.rm-sel').forEach(b => b.addEventListener('click', () => {
      const ex = selected[Number(b.dataset.idx)];
      selectedIds.delete(ex.exerciseId);
      selected.splice(Number(b.dataset.idx), 1);
      renderGrid(exercises);
      renderSelected();
    }));
  }

  renderGrid(exercises);
  document.getElementById('cat-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.category-tab'); if (!btn) return;
    document.querySelectorAll('#cat-tabs .category-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.cat;
    renderGrid(cat === 'all' ? exercises : exercises.filter(ex => ex.category === cat));
  });

  document.getElementById('btn-start-session').addEventListener('click', () => startWorkoutSession(selected));
}

/* ---- Workout Session ---- */
function startWorkoutSession(exercises) {
  state = {
    phase: 'active',
    exercises,
    currentExIdx: 0,
    currentSetIdx: 0,
    startTime: Date.now(),
    setsData: exercises.map(ex => ({ ...ex, sets: [] })),
    breakthroughs: []
  };
  renderWorkoutActive().catch(function(e) { document.getElementById('checkin-form').innerHTML = '<div class="card" style="color:var(--danger);padding:20px;text-align:center">训练加载失败：' + e.message + '</div>'; });
}

async function renderWorkoutActive() {
  if (!state || state.phase !== 'active') return;
  const ex = state.exercises[state.currentExIdx];
  const currentData = state.setsData[state.currentExIdx];
  const setIdx = state.currentSetIdx;
  const totalSets = ex.targetSets || 4;

  // Fetch last session + PR
  let lastData = null, prWeight = 0;
  if (ex.exerciseId) {
    const history = await getExerciseHistory(ex.exerciseId);
    if (history.length > 0) lastData = history[0];
    prWeight = await getPRMaxWeight(ex.exerciseId);
  }

  const cat = BODY_CATEGORIES[ex.category] || { icon: '🏋️', color: '#888', name: '' };

  document.getElementById('checkin-form').innerHTML = `
    <div class="card workout-card">
      <div class="workout-progress-header">
        <span style="color:var(--text-tertiary);font-size:var(--font-xs)">动作 ${state.currentExIdx + 1}/${state.exercises.length}</span>
        <div class="progress-bar-lg" style="flex:1;margin:0 10px"><div style="width:${Math.round(((state.currentExIdx) / state.exercises.length) * 100)}%"></div></div>
      </div>

      <div style="text-align:center;margin:16px 0">
        <div style="font-size:40px;margin-bottom:4px">${cat.icon}</div>
        <h2 style="margin-bottom:4px">${ex.exerciseName}</h2>
        <div style="font-size:var(--font-xs);color:var(--text-secondary)">第 ${setIdx + 1}/${totalSets} 组</div>
      </div>

      <div class="workout-targets">
        <div class="wt-item"><span>目标</span><strong>${ex.targetWeight > 0 ? ex.targetWeight + 'kg' : '-'} × ${totalSets}×${ex.targetReps}</strong></div>
        ${lastData ? `<div class="wt-item"><span>上次</span><strong>${calcMaxWeightInSets(lastData.sets)}kg × ${lastData.sets.length}×${lastData.sets[0]?.reps || '-'}</strong></div>` : ''}
        ${prWeight > 0 ? `<div class="wt-item pr"><span>🏆 PR</span><strong>${prWeight}kg</strong></div>` : ''}
      </div>

      ${ex.targetWeight > 0 && setIdx === 0 ? `<div style="text-align:center;font-size:var(--font-sm);color:var(--accent);margin:8px 0">建议起始重量：${ex.targetWeight}kg</div>` : ''}

      <div class="set-input-area">
        <div class="set-input-row">
          <input type="number" id="set-weight" placeholder="重量" value="${ex.targetWeight > 0 ? ex.targetWeight : ''}" step="0.5" min="0" inputmode="decimal" style="font-size:24px;font-weight:700;width:100px;text-align:center;padding:12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text-primary);outline:none">
          <span style="font-size:var(--font-lg);color:var(--text-tertiary)">kg</span>
          <span style="font-size:var(--font-lg);color:var(--text-tertiary);margin:0 4px">×</span>
          <input type="number" id="set-reps" placeholder="次数" value="${ex.targetReps}" step="1" min="0" inputmode="numeric" style="font-size:24px;font-weight:700;width:80px;text-align:center;padding:12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text-primary);outline:none">
          <span style="font-size:var(--font-lg);color:var(--text-tertiary)">次</span>
        </div>
        <button class="btn btn-primary btn-block" id="btn-complete-set" style="margin-top:16px;padding:16px;font-size:var(--font-md)">完成本组</button>
      </div>

      <div class="workout-set-summary" id="set-summary">
        ${currentData.sets.length > 0 ? currentData.sets.map((s, i) => `<span class="set-dot done">${i + 1}: ${s.weight}kg×${s.reps}</span>`).join('') : ''}
      </div>
    </div>`;

  document.getElementById('btn-complete-set').addEventListener('click', async () => {
    const w = parseFloat(document.getElementById('set-weight').value);
    const r = parseInt(document.getElementById('set-reps').value);
    if (!w || !r || w <= 0 || r <= 0) { showToast('请输入重量和次数'); return; }

    currentData.sets.push({ weight: w, reps: r });
    state.currentSetIdx++;

    if (state.currentSetIdx >= totalSets) {
      // Check PR
      if (ex.exerciseId) {
        try { const bts = await checkPRBreak(ex.exerciseId, ex.exerciseName, currentData.sets); state.breakthroughs.push(...bts); } catch(e) { console.warn('PR check failed:', e); }
      }
      state.currentExIdx++;
      state.currentSetIdx = 0;

      if (state.currentExIdx >= state.exercises.length) {
        await completeWorkout();
      } else {
        await renderWorkoutActive();
      }
    } else {
      await renderWorkoutActive();
    }
  });
}

async function completeWorkout() {
  const duration = Math.round((Date.now() - state.startTime) / 60000);
  const allSets = state.setsData.reduce((s, d) => s + d.sets.length, 0);
  const totalVol = state.setsData.reduce((s, d) => s + calcSetVolume(d.sets), 0);

  const valid = state.setsData.filter(d => d.sets.length > 0).map(d => ({
    exerciseId: d.exerciseId,
    exerciseName: d.exerciseName,
    category: d.category,
    sets: d.sets
  }));

  if (valid.length > 0) {
    await addWorkoutWithExercises({ type: 'strength', duration, intensity: 'moderate', note: '', exercises: valid });
  }

  document.getElementById('checkin-form').innerHTML = `
    <div class="card" style="text-align:center;padding:24px 0">
      <div style="font-size:56px;margin-bottom:12px">🎉</div>
      <h2>训练完成！</h2>
      <div style="color:var(--text-secondary);font-size:var(--font-sm);margin:8px 0">
        <div>${state.exercises.length}个动作 · ${allSets}组</div>
        <div>训练时长 ${duration}分钟 · 训练容量 ${totalVol}kg·次</div>
      </div>
      ${state.breakthroughs.length > 0 ? `
        <div style="margin-top:16px;text-align:left">
          <div style="font-size:var(--font-sm);color:var(--accent);margin-bottom:8px">🏆 突破PR</div>
          ${state.breakthroughs.map(b => `<div class="pr-break-item"><span class="pr-ex-name">${b.exercise}</span><span class="pr-type-badge ${b.type}">${b.type === 'weight' ? '最大重量 +' + (b.new - b.old) + 'kg' : '最大容量'}</span></div>`).join('')}
        </div>
      ` : ''}
      <button class="btn btn-primary btn-block" id="btn-done-workout" style="margin-top:20px">完成</button>
    </div>`;

  document.getElementById('btn-done-workout').addEventListener('click', async () => {
    state = null;
    document.getElementById('checkin-form').innerHTML = '';
    await renderSelectorMode();
    await renderTodaySummary();
  });

  state = null;
}

/* ---- Today Summary ---- */
async function renderTodaySummary() {
  const weList = await getTodayWorkoutExercises();
  const el = document.getElementById('today-checkins');
  if (weList.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">今天还没有训练记录</div></div>';
    return;
  }
  const grouped = {};
  weList.forEach(we => { if (!grouped[we.workoutId]) grouped[we.workoutId] = []; grouped[we.workoutId].push(we); });
  el.innerHTML = Object.entries(grouped).map(([wid, exercises]) => `
    <div class="card" style="margin-top:12px">
      <div class="card-title" style="margin-bottom:10px">训练 #${wid}</div>
      ${exercises.map(ex => {
        const cat = BODY_CATEGORIES[ex.category];
        const maxW = calcMaxWeightInSets(ex.sets);
        return `<div class="we-summary-row"><span style="color:${cat ? cat.color : '#888'};font-weight:500">${cat ? cat.icon : ''} ${ex.exerciseName}</span><span style="color:var(--text-secondary);font-size:var(--font-sm)">${ex.sets.length}组 · ${ex.sets.map(s => s.weight + 'kg×' + s.reps).join(', ')}</span></div>`;
      }).join('')}
    </div>`).join('');
}

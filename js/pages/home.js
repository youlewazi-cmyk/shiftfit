import { today, getGreeting, getDateText, calcStreak, calcSetVolume, getShiftInfo, getTomorrowInfo, getPlanForShift, DIET_TARGETS, showToast } from '../utils.js';
import { getTodayWorkoutExercises, getLatestWeight, getMonthStats, getTotalStats, setWeight, getShiftConfig, getSetting, getDietByDate, getWeightTrend, getRecoveryRecord, saveRecoveryRecord, getDietCounters } from '../db.js';
import db from '../db.js';
import { navigate } from '../router.js';

var userName = '';

export async function renderHome() {
  var profile = await getSetting('profile', { height: 175, currentWeight: 55, targetWeight: 65, name: '' });
  userName = profile.name || '';
  document.getElementById('greeting-text').textContent = getGreeting() + (userName ? '，' + userName : '');
  document.getElementById('date-text').textContent = getDateText();
  await renderBlocks();
}

async function renderBlocks() {
  var el = document.getElementById('home-blocks');
  var plan = null;
  try {
  var cfg = await getShiftConfig();
  var info = await getShiftInfo(cfg);
  var tomorrow = await getTomorrowInfo(cfg);
  plan = await getPlanForShift(info);
  var recovery = await getRecoveryRecord();
  var diets = await getDietByDate(today());
  var latest = await getLatestWeight();
  var profile = await getSetting('profile', { height: 175, currentWeight: 55, targetWeight: 65 });
  var monthStats = await getMonthStats();
  var totalStats = await getTotalStats();
  var streak = await calcStreak(db);
  var trend7 = await getWeightTrend(7);
  var currentW = latest ? latest.weight : profile.currentWeight;
  var targetW = profile.targetWeight || 65;
  var startW = profile.currentWeight || 55;
  var gained = Math.max(0, currentW - startW);
  var toGo = targetW - startW;
  var progress = Math.min(100, Math.max(0, Math.round((gained / toGo) * 100)));

  // Diet totals
  var protein = 0, calories = 0;
  diets.forEach(function(d) { protein += d.protein || 0; calories += d.calories || 0; });
  var pPct = Math.min(100, Math.round((protein / DIET_TARGETS.protein) * 100));
  var cPct = Math.min(100, Math.round((calories / DIET_TARGETS.calories) * 100));

  // Diet counters for unfinished items
  var counters = await getDietCounters();
  var unfinishedDiet = [];
  var counterDefs = [
    { key: 'milk', name: '牛奶', unit: 'ml', target: 500, icon: '🥛' },
    { key: 'eggs', name: '鸡蛋', unit: '个', target: 3, icon: '🥚' },
    { key: 'chicken', name: '鸡胸肉', unit: 'g', target: 200, icon: '🍡' },
    { key: 'water', name: '饮水', unit: 'L', target: 3, icon: '🥧' }
  ];
  counterDefs.forEach(function(c) {
    var val = counters[c.key] || 0;
    if (val < c.target) unfinishedDiet.push({ icon: c.icon, name: c.name, current: val, target: c.target, unit: c.unit });
  });

  // Estimated completion date
  var estDate = '';
  if (trend7 > 0 && toGo > 0) {
    var daysNeeded = Math.round((targetW - currentW) / (trend7 / 7));
    if (daysNeeded > 0 && daysNeeded < 3650) {
      var d = new Date(); d.setDate(d.getDate() + daysNeeded);
      estDate = '预计 ' + d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
    }
  }

  var planName = plan ? (plan.name + ' (' + plan.desc + ')') : '';
  var tomorrowPlanName = '';
  if (tomorrow.plan !== 'rest') {
    var tp = await getPlanForShift(tomorrow);
    tomorrowPlanName = tp ? tp.name + ' (' + tp.desc + ')' : '';
  }

  var isRest = info.plan === 'rest';
  var colorMap = { rest: 'var(--text-tertiary)', push: '#ff6b6b', pull: '#4ecdc4', legs: '#45b7d1', upper: '#ffeaa7' };
  var color = colorMap[info.plan] || 'var(--accent)';
  var labelMap = { rest: '恢复日', push: '训练日', pull: '训练日', legs: '训练日', upper: '训练日' };
  var label = labelMap[info.plan] || '训练日';
  var emojiMap = { rest: '🌙', push: '🏸️', pull: '🔊', legs: '🞋', upper: '💭' };
  var emoji = emojiMap[info.plan] || '🏸️';
  var typeNameMap = { push: 'Push（推日）', pull: 'Pull（拉日）', legs: 'Legs（腿日）', upper: 'Upper（上肢日）' };

  var recData = recovery ? (recovery.foodItems || {}) : {};

  // Check today's training completion
  var todayExercises = await getTodayWorkoutExercises();
  var hasTrainedToday = todayExercises.length > 0;
  var completedExercises = 0;
  var totalPlannedExercises = plan ? plan.exercises.length : 0;
  if (hasTrainedToday && plan) {
    var trainedNames = new Set(todayExercises.map(function(we) { return we.exerciseName; }));
    plan.exercises.forEach(function(ex) { if (trainedNames.has(ex.name)) completedExercises++; });
  }

  var html = '';

  // ═══════════════════════════════════════
  // Module 1: 今日任务
  // ═══════════════════════════════════════
  html += '<div class="card task-module" style="margin-bottom:14px;border-left:3px solid ' + color + '">';
  html += '<div class="card-header"><span class="card-title">📋 今日任务</span><span class="task-shift-badge">' + info.shiftName + '</span></div>';

  if (isRest) {
    // Recovery day
    html += '<div style="padding:4px 0;display:flex;flex-direction:column;gap:4px">';
    html += '<div style="color:var(--text-tertiary);font-size:var(--font-sm);margin-bottom:4px">🌙 恢复日 — 优先保证恢复</div>';
    html += '<label class="diet-check"><input type="checkbox" id="rec-sleep"' + (recData.sleep ? ' checked' : '') + '> 😴 保证睡眠 7-8h</label>';
    html += '<label class="diet-check"><input type="checkbox" id="rec-stretch"' + (recData.stretch ? ' checked' : '') + '> 🧘 拉伸 10 分钟</label>';
    html += '<label class="diet-check"><input type="checkbox" id="rec-walk"' + (recData.walk ? ' checked' : '') + '> 🚶 散步 20 分钟</label>';
    html += '<label class="diet-check"><input type="checkbox" id="rec-water"' + (recData.water ? ' checked' : '') + '> 💧 饮水 3L</label>';
    html += '<button class="btn btn-primary btn-sm" id="save-recovery" style="margin-top:6px">保存</button>';
    html += '</div>';
  } else if (plan) {
    // Training day
    html += '<div style="display:flex;align-items:center;gap:10px;margin:6px 0">';
    html += '<span style="font-size:28px">' + plan.icon + '</span>';
    html += '<div>';
    html += '<div style="font-weight:700;font-size:var(--font-md)">' + (typeNameMap[plan.key] || plan.name) + '</div>';
    html += '<div style="font-size:var(--font-xs);color:var(--text-tertiary)">' + plan.exercises.length + ' 个动作 · 预计 75 分钟</div>';
    html += '</div></div>';

    // Completion progress
    if (hasTrainedToday) {
      var compPct = totalPlannedExercises > 0 ? Math.round((completedExercises / totalPlannedExercises) * 100) : 0;
      html += '<div style="margin:8px 0">';
      html += '<div style="display:flex;justify-content:space-between;font-size:var(--font-xs);color:var(--text-secondary);margin-bottom:4px"><span>完成进度</span><span>' + completedExercises + '/' + totalPlannedExercises + ' (' + compPct + '%)</span></div>';
      html += '<div class="progress-bar-sm" style="height:6px"><div style="width:' + compPct + '%"></div></div>';
      html += '</div>';
    }

    // Exercise list
    html += '<div class="plan-exercise-list" style="margin:8px 0">';
    html += plan.exercises.map(function(ex, i) {
      var isDone = hasTrainedToday && completedExercises > 0;
      return '<span class="plan-ex-tag' + (isDone ? ' done' : '') + '">' + (i + 1) + '. ' + ex.name + ' <span style="color:var(--text-tertiary);font-size:var(--font-xs)">' + ex.sets + '×' + ex.reps + (ex.weight ? ' ' + ex.weight + 'kg' : '') + '</span></span>';
    }).join('');
    html += '</div>';

    html += '<button class="btn btn-primary btn-block btn-sm" id="btn-start-plan">▶ 开始训练</button>';
  }
  html += '</div>';

  // ═══════════════════════════════════════
  // Module 2: 今日饮食
  // ═══════════════════════════════════════
  html += '<div class="card" style="margin-bottom:14px;cursor:pointer" id="diet-summary-click">';
  html += '<div class="card-header"><span class="card-title">🍽️ 今日饮食</span><span style="font-size:var(--font-xs);color:var(--text-secondary)">点击详情 →</span></div>';

  // Protein & calorie progress
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">';
  // Protein
  html += '<div>';
  html += '<div style="display:flex;justify-content:space-between;font-size:var(--font-sm);margin-bottom:4px"><span>🥩 蛋白质</span><span style="font-weight:600">' + protein + '/' + DIET_TARGETS.protein + 'g</span></div>';
  html += '<div class="progress-bar-sm" style="height:6px"><div style="width:' + pPct + '%"></div></div>';
  html += '</div>';
  // Calories
  html += '<div>';
  html += '<div style="display:flex;justify-content:space-between;font-size:var(--font-sm);margin-bottom:4px"><span>🔥 热量</span><span style="font-weight:600">' + calories + '/' + DIET_TARGETS.calories + 'kcal</span></div>';
  html += '<div class="progress-bar-sm" style="height:6px"><div style="width:' + cPct + '%"></div></div>';
  html += '</div>';
  html += '</div>';

  // Unfinished diet items
  if (unfinishedDiet.length > 0) {
    html += '<div style="font-size:var(--font-xs);color:var(--warning);border-top:1px solid var(--border);padding-top:8px">⚠ 未完成：';
    html += unfinishedDiet.map(function(item) {
      return item.icon + ' ' + item.name + ' ' + item.current + '/' + item.target + item.unit;
    }).join(' · ');
    html += '</div>';
  } else if (protein > 0) {
    html += '<div style="font-size:var(--font-xs);color:var(--success);border-top:1px solid var(--border);padding-top:8px">✅ 今日摄入项目全部达标</div>';
  }

  html += '</div>';

  // ═══════════════════════════════════════
  // Module 3: 待打卡
  // ═══════════════════════════════════════
  html += '<div class="card" style="margin-bottom:14px">';
  html += '<div class="card-header"><span class="card-title">📌 待打卡</span></div>';
  html += '<div class="checkin-links">';

  // Training
  var trainingDone = hasTrainedToday && (!plan || completedExercises >= totalPlannedExercises);
  html += '<div class="checkin-link-item" id="cl-training">';
  html += '<span class="cl-icon">🏋️</span>';
  html += '<div class="cl-info"><span class="cl-label">训练</span><span class="cl-status" style="color:' + (trainingDone ? 'var(--success)' : (isRest ? 'var(--text-tertiary)' : 'var(--warning)')) + '">' + (trainingDone ? '已完成' : (isRest ? '休息日' : '待打卡')) + '</span></div>';
  html += '<span class="cl-arrow">→</span>';
  html += '</div>';

  // Diet
  var dietDone = pPct >= 90 && cPct >= 90;
  html += '<div class="checkin-link-item" id="cl-diet">';
  html += '<span class="cl-icon">🍽️</span>';
  html += '<div class="cl-info"><span class="cl-label">饮食</span><span class="cl-status" style="color:' + (dietDone ? 'var(--success)' : (protein > 0 ? 'var(--warning)' : 'var(--text-tertiary)')) + '">' + (dietDone ? '已达标' : (protein > 0 ? pPct + '%' : '待打卡')) + '</span></div>';
  html += '<span class="cl-arrow">→</span>';
  html += '</div>';

  // Weight
  var weightDone = !!latest;
  html += '<div class="checkin-link-item" id="cl-weight">';
  html += '<span class="cl-icon">⚖️</span>';
  html += '<div class="cl-info"><span class="cl-label">体重</span><span class="cl-status" style="color:' + (weightDone ? 'var(--success)' : 'var(--text-tertiary)') + '">' + (weightDone ? currentW + 'kg' : '待记录') + '</span></div>';
  html += '<span class="cl-arrow">→</span>';
  html += '</div>';

  // Recovery
  var recoveryDone = recData.sleep && recData.stretch && recData.walk && recData.water;
  html += '<div class="checkin-link-item" id="cl-recovery">';
  html += '<span class="cl-icon">🧘</span>';
  html += '<div class="cl-info"><span class="cl-label">恢复</span><span class="cl-status" style="color:' + (recoveryDone ? 'var(--success)' : (isRest ? 'var(--warning)' : 'var(--text-tertiary)')) + '">' + (recoveryDone ? '已完成' : (Object.keys(recData).length > 0 ? '进行中' : (isRest ? '待打卡' : '—'))) + '</span></div>';
  html += '<span class="cl-arrow">→</span>';
  html += '</div>';

  html += '</div></div>';

  // ═══════════════════════════════════════
  // Block 2: Tomorrow Preview (kept)
  // ═══════════════════════════════════════
  html += '<div class="card" style="margin-bottom:14px">';
  html += '<div class="card-header"><span class="card-title">📮 明日预告</span></div>';
  html += '<div style="font-size:var(--font-sm);color:var(--text-secondary)">明天：' + tomorrow.shiftName + '</div>';
  if (tomorrow.plan === 'rest') {
    html += '<div style="color:var(--text-tertiary);font-size:var(--font-sm);margin-top:4px">恢复日 🌙</div>';
  } else {
    html += '<div style="font-size:var(--font-base);font-weight:600;margin-top:4px">' + (emojiMap[tomorrow.plan] || '') + ' ' + tomorrowPlanName + '</div>';
  }
  html += '</div>';

  // ═══════════════════════════════════════
  // Block 4: Goal Progress (kept)
  // ═══════════════════════════════════════
  html += '<div class="card" style="margin-bottom:14px">';
  html += '<div class="card-header"><span class="card-title">🎆 增肌目标</span><button class="btn-ghost" id="btn-weight-modal">记录体重</button></div>';
  html += '<div class="goal-numbers">';
  html += '<div class="goal-num"><span class="goal-val">' + currentW + '</span><span class="goal-unit">kg</span></div>';
  html += '<div class="goal-arrow">→</div>';
  html += '<div class="goal-num"><span class="goal-val">' + targetW + '</span><span class="goal-unit">kg</span></div>';
  html += '</div>';
  html += '<div class="progress-bar-sm" style="height:6px;margin:8px 0"><div style="width:' + progress + '%"></div></div>';
  html += '<div style="display:flex;justify-content:space-between;font-size:var(--font-xs);color:var(--text-secondary)"><span>进度 ' + progress + '%</span><span>差' + (targetW - currentW).toFixed(1) + 'kg</span></div>';
  if (trend7 !== 0) html += '<div style="font-size:var(--font-xs);color:' + (trend7 > 0 ? 'var(--success)' : 'var(--danger)') + ';margin-top:4px">最近7天' + (trend7 > 0 ? '+' : '') + trend7 + 'kg</div>';
  if (estDate) html += '<div style="font-size:var(--font-xs);color:var(--text-tertiary);margin-top:4px">' + estDate + '</div>';
  html += '</div>';

  // ═══════════════════════════════════════
  // Block 5: Training Stats (kept)
  // ═══════════════════════════════════════
  html += '<div class="card">';
  html += '<div class="card-title">📳 训练统计</div>';
  html += '<div class="stats-row" style="margin-top:10px">';
  html += '<div class="stat-item"><div class="stat-value">' + monthStats.count + '</div><div class="stat-label">本月</div></div>';
  html += '<div class="stat-item"><div class="stat-value">' + totalStats.count + '</div><div class="stat-label">累计</div></div>';
  html += '<div class="stat-item"><div class="stat-value">' + streak + '</div><div class="stat-label">连续</div></div>';
  html += '</div></div>';

  el.innerHTML = html;
  } catch(e) { el.innerHTML = '<div class="card" style="color:var(--danger);padding:20px;text-align:center">加载失败：' + e.message + '<br><button class="btn btn-primary btn-sm" onclick="location.reload()" style="margin-top:12px">重试</button></div>'; return; }

  // Event bindings
  var btn = document.getElementById('btn-start-plan');
  if (btn) btn.addEventListener('click', function() {
    sessionStorage.setItem('workoutPreset', JSON.stringify(plan.exercises));
    navigate('checkin');
  });

  var ds = document.getElementById('diet-summary-click');
  if (ds) ds.addEventListener('click', function() { navigate('diet'); });

  var wm = document.getElementById('btn-weight-modal');
  if (wm) wm.addEventListener('click', openWeightModal);

  var sr = document.getElementById('save-recovery');
  if (sr) sr.addEventListener('click', async function() {
    await saveRecoveryRecord({
      sleep: document.getElementById('rec-sleep').checked,
      stretch: document.getElementById('rec-stretch').checked,
      walk: document.getElementById('rec-walk').checked,
      water: document.getElementById('rec-water').checked
    });
    showToast('已保存');
    renderBlocks();
  });

  // 待打卡 navigation bindings
  var clTraining = document.getElementById('cl-training');
  if (clTraining) clTraining.addEventListener('click', function() { navigate('checkin'); });

  var clDiet = document.getElementById('cl-diet');
  if (clDiet) clDiet.addEventListener('click', function() { navigate('diet'); });

  var clWeight = document.getElementById('cl-weight');
  if (clWeight) clWeight.addEventListener('click', openWeightModal);

  var clRecovery = document.getElementById('cl-recovery');
  if (clRecovery) clRecovery.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('请在今日任务中打卡恢复项目');
  });
}

function openWeightModal() {
  var overlay = document.getElementById('modal-overlay');
  var content = document.getElementById('modal-content');
  content.innerHTML = '<h3 style="margin-bottom:8px">记录体重</h3><div class="weight-input-group"><input type="number" id="weight-input" placeholder="0.0" step="0.1" min="30" max="300" inputmode="decimal"><span class="unit">kg</span></div><input type="text" id="weight-note-input" placeholder="备注（可选）" style="width:100%;margin-bottom:16px"><div style="display:flex;gap:8px"><button class="btn btn-secondary btn-block" id="btn-weight-cancel">取消</button><button class="btn btn-primary btn-block" id="btn-weight-save">保存</button></div>';
  overlay.classList.remove('hidden');
  document.getElementById('btn-weight-cancel').addEventListener('click', function() { overlay.classList.add('hidden'); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.classList.add('hidden'); });
  document.getElementById('btn-weight-save').addEventListener('click', async function() {
    var val = parseFloat(document.getElementById('weight-input').value);
    if (isNaN(val) || val <= 0) return;
    await setWeight(val, document.getElementById('weight-note-input').value);
    overlay.classList.add('hidden');
    renderBlocks();
  });
}

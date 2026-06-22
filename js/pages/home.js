import { today, getGreeting, getDateText, calcStreak, calcSetVolume, getShiftInfo, getTomorrowInfo, getPlanForShift, DIET_TARGETS, showToast } from '../utils.js?v=20260622a';
import { getTodayWorkoutExercises, getLatestWeight, getMonthStats, getTotalStats, setWeight, getShiftConfig, getSetting, getDietByDate, getWeightTrend, getRecoveryRecord, saveRecoveryRecord } from '../db.js';
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
  var emojiMap = { rest: '💤', push: '🏋️', pull: '🔙', legs: '🦿', upper: '💪' };
  var emoji = emojiMap[info.plan] || '🏋️';

  var recData = recovery ? (recovery.foodItems || {}) : {};

  var html = '';

  // Block 1: Today Status
  html += '<div class="card" style="margin-bottom:16px;border-left:3px solid ' + color + '">';
  html += '<div class="card-header"><span class="card-title">' + emoji + ' ' + label + '</span><span style="font-size:var(--font-xs);color:var(--text-secondary)">班次：' + info.shiftName + '</span></div>';
  if (isRest) {
    html += '<div style="padding:8px 0;display:flex;flex-direction:column;gap:6px">';
    html += '<div style="color:var(--text-tertiary);font-size:var(--font-sm)">' + (info.shiftName === '值班24h' ? '值班24小时，恢复优先' : info.shiftName === '夜班B' ? '凌晨3点开始工作，优先保证恢复' : '今天是恢复日') + '</div>';
    html += '<label class="diet-check"><input type="checkbox" id="rec-sleep"' + (recData.sleep ? ' checked' : '') + '> 保证睡眠</label>';
    html += '<label class="diet-check"><input type="checkbox" id="rec-stretch"' + (recData.stretch ? ' checked' : '') + '> 拉伸10分钟</label>';
    html += '<label class="diet-check"><input type="checkbox" id="rec-walk"' + (recData.walk ? ' checked' : '') + '> 散步20分钟</label>';
    html += '<button class="btn btn-primary btn-sm" id="save-recovery" style="margin-top:4px">保存</button>';
    html += '</div>';
  } else if (plan) {
    html += '<div style="font-size:var(--font-lg);font-weight:700;margin:8px 0">' + plan.icon + ' ' + plan.name + '</div>';
    html += '<div style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:10px">' + plan.exercises.length + '个动作 · 预计75分钟</div>';
    html += '<button class="btn btn-primary btn-block btn-sm" id="btn-start-plan">开始训练</button>';
  }
  html += '</div>';

  // Block 2: Tomorrow Preview
  html += '<div class="card" style="margin-bottom:16px">';
  html += '<div class="card-header"><span class="card-title">📅 明日预告</span></div>';
  html += '<div style="font-size:var(--font-sm);color:var(--text-secondary)">明天：' + tomorrow.shiftName + '</div>';
  if (tomorrow.plan === 'rest') {
    html += '<div style="color:var(--text-tertiary);font-size:var(--font-sm);margin-top:4px">恢复日 💤</div>';
  } else {
    html += '<div style="font-size:var(--font-base);font-weight:600;margin-top:4px">' + (emojiMap[tomorrow.plan] || '') + ' ' + tomorrowPlanName + '</div>';
  }
  html += '</div>';

  // Block 3: Diet Summary
  html += '<div class="card" style="margin-bottom:16px;cursor:pointer" id="diet-summary-click">';
  html += '<div class="card-header"><span class="card-title">🍽️ 今日饮食</span><span style="font-size:var(--font-xs);color:var(--text-secondary)">点击详情</span></div>';
  html += '<div style="display:grid;grid-template-columns:56px 1fr;align-items:center;gap:4px 8px;font-size:var(--font-sm);margin-bottom:8px">';
  html += '<span>蛋白质</span><span style="font-weight:600">' + protein + '/' + DIET_TARGETS.protein + 'g</span>';
  html += '<span></span><div class="progress-bar-sm"><div style="width:' + pPct + '%"></div></div>';
  html += '<span>热量</span><span style="font-weight:600">' + calories + '/' + DIET_TARGETS.calories + 'kcal</span>';
  html += '<span></span><div class="progress-bar-sm"><div style="width:' + cPct + '%"></div></div>';
  html += '</div>';
  if (protein < DIET_TARGETS.protein) {
    html += '<div style="font-size:var(--font-xs);color:var(--warning);margin-top:4px">还差蛋白质 ' + (DIET_TARGETS.protein - protein) + 'g，建议鸡胸肉200g + 牛奶500ml</div>';
  }
  html += '</div>';

  // Block 4: Goal Progress
  html += '<div class="card" style="margin-bottom:16px">';
  html += '<div class="card-header"><span class="card-title">🎯 增肌目标</span><button class="btn-ghost" id="btn-weight-modal">记录体重</button></div>';
  html += '<div class="goal-numbers">';
  html += '<div class="goal-num"><span class="goal-val">' + currentW + '</span><span class="goal-unit">kg</span></div>';
  html += '<div class="goal-arrow">→</div>';
  html += '<div class="goal-num"><span class="goal-val">' + targetW + '</span><span class="goal-unit">kg</span></div>';
  html += '</div>';
  html += '<div class="progress-bar-sm" style="height:6px;margin:8px 0"><div style="width:' + progress + '%"></div></div>';
  html += '<div style="display:flex;justify-content:space-between;font-size:var(--font-xs);color:var(--text-secondary)"><span>进度 ' + progress + '%</span><span>差 ' + (targetW - currentW).toFixed(1) + 'kg</span></div>';
  if (trend7 !== 0) html += '<div style="font-size:var(--font-xs);color:' + (trend7 > 0 ? 'var(--success)' : 'var(--danger)') + ';margin-top:4px">最近7天 ' + (trend7 > 0 ? '+' : '') + trend7 + 'kg</div>';
  if (estDate) html += '<div style="font-size:var(--font-xs);color:var(--text-tertiary);margin-top:4px">' + estDate + '</div>';
  html += '</div>';

  // Block 5: Training Stats
  html += '<div class="card">';
  html += '<div class="card-title">📊 训练统计</div>';
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
      walk: document.getElementById('rec-walk').checked
    });
    showToast('已保存');
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

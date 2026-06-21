import { today, formatDate, parseDate, addDays, BODY_CATEGORIES, calcSetVolume, calcMaxWeightInSets, showToast } from '../utils.js';
import { getWorkoutDatesInRange, getTodayWorkoutExercises as getWEByDate, getExerciseHistory, getPRMaxWeight, deleteWorkout } from '../db.js';

let calYear, calMonth, selectedDate;

export async function renderHistory() {
  var now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth() + 1;
  selectedDate = today();
  await renderCalendarAndList();
}

async function getWorkoutExercisesByDate(dateStr) {
  return getWEByDate(dateStr);
}

async function renderCalendarAndList() {
  var monthStr = calYear + '-' + String(calMonth).padStart(2, '0');
  var start = monthStr + '-01';
  var lastDay = new Date(calYear, calMonth, 0).getDate();
  var end = monthStr + '-' + String(lastDay).padStart(2, '0');

  var workoutDates = await getWorkoutDatesInRange(start, end);
  var dateSet = new Set(workoutDates);

  var firstDay = new Date(calYear, calMonth - 1, 1);
  var startDayOfWeek = firstDay.getDay();
  var dayHeaders = ['日', '一', '二', '三', '四', '五', '六'];

  var cells = dayHeaders.map(function(d) { return '<div class="calendar-day-header">' + d + '</div>'; }).join('');
  for (var i = 0; i < startDayOfWeek; i++) cells += '<div class="calendar-day empty"></div>';
  for (var d = 1; d <= lastDay; d++) {
    var ds = monthStr + '-' + String(d).padStart(2, '0');
    var isToday = ds === today();
    var isSelected = ds === selectedDate;
    var hasW = dateSet.has(ds);
    var cls = 'calendar-day' + (isToday ? ' today' : '') + (isSelected ? ' selected' : '');
    cells += '<div class="' + cls + '" data-date="' + ds + '">' + d + (hasW ? '<div class="dot"></div>' : '') + '</div>';
  }

  document.getElementById('calendar-view').innerHTML =
    '<div class="card">' +
    '<div class="calendar-nav">' +
    '<button id="cal-prev">◀</button>' +
    '<span class="month-label">' + calYear + '年' + calMonth + '月</span>' +
    '<button id="cal-next">▶</button>' +
    '</div>' +
    '<div class="calendar-grid">' + cells + '</div>' +
    '</div>';

  document.getElementById('cal-prev').addEventListener('click', function() {
    calMonth--; if (calMonth < 1) { calYear--; calMonth = 12; } renderCalendarAndList();
  });
  document.getElementById('cal-next').addEventListener('click', function() {
    calMonth++; if (calMonth > 12) { calYear++; calMonth = 1; } renderCalendarAndList();
  });
  document.querySelectorAll('.calendar-day[data-date]').forEach(function(day) {
    day.addEventListener('click', async function() {
      selectedDate = day.dataset.date;
      await renderCalendarAndList();
    });
  });

  await renderDayDetail();
}

async function renderDayDetail() {
  var weList = await getWorkoutExercisesByDate(selectedDate);
  var el = document.getElementById('history-list');

  if (weList.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">' + selectedDate + ' 无训练记录</div></div>';
    return;
  }

  var groups = {};
  weList.forEach(function(we) {
    if (!groups[we.workoutId]) groups[we.workoutId] = [];
    groups[we.workoutId].push(we);
  });

  var totalVol = weList.reduce(function(s, we) { return s + calcSetVolume(we.sets); }, 0);
  var totalSets = weList.reduce(function(s, we) { return s + we.sets.length; }, 0);
  var dateLabel = '📅 ' + selectedDate;
  var headerRight = weList.length + '动作 · ' + totalSets + '组 · ' + totalVol + '容量';

  var html = '<div class="card" style="margin-top:12px">';
  html += '<div class="card-header"><span class="card-title">' + dateLabel + '</span><span style="font-size:var(--font-xs);color:var(--text-secondary)">' + headerRight + '</span></div>';
  html += '<button class="btn btn-secondary btn-block btn-sm" id="delete-all-day" style="margin-bottom:12px;color:var(--danger)">🗑️ 删除当天所有记录</button>';

  Object.entries(groups).forEach(function(entry) {
    var wid = entry[0];
    var exercises = entry[1];
    html += '<div class="history-ex-block">';
    html += '<div style="display:flex;justify-content:flex-end;margin-bottom:4px"><button class="btn-ghost btn-sm delete-workout-btn" data-wid="' + wid + '" style="color:var(--danger);font-size:var(--font-xs)">删除此训练</button></div>';

    exercises.forEach(function(we) {
      var cat = BODY_CATEGORIES[we.category] || { icon: '', color: '#888', name: '' };
      var catColor = (cat && cat.color) ? cat.color : '#888';
      var catIcon = cat ? cat.icon : '';
      html += '<div class="history-ex-header">';
      html += '<span style="color:' + catColor + ';font-weight:600">' + catIcon + ' ' + we.exerciseName + '</span>';
      html += '<button class="btn-ghost btn-sm history-ex-detail" data-eid="' + we.exerciseId + '" data-name="' + we.exerciseName + '">查看历史</button>';
      html += '</div>';
      html += '<div class="history-set-list">';
      we.sets.forEach(function(s, i) {
        html += '<span class="history-set-tag">' + (i + 1) + '. ' + s.weight + 'kg × ' + s.reps + '</span>';
      });
      html += '</div>';
    });

    html += '</div>';
  });

  html += '</div>';
  el.innerHTML = html;

  // Delete all
  document.getElementById('delete-all-day').addEventListener('click', async function() {
    if (!confirm('确定删除 ' + selectedDate + ' 的所有训练记录？')) return;
    for (var wid of Object.keys(groups)) await deleteWorkout(Number(wid));
    showToast('已删除');
    renderCalendarAndList();
  });

  // Delete per workout
  el.querySelectorAll('.delete-workout-btn').forEach(function(btn) {
    btn.addEventListener('click', async function() {
      if (!confirm('确定删除这条训练记录？')) return;
      await deleteWorkout(Number(btn.dataset.wid));
      showToast('已删除');
      renderCalendarAndList();
    });
  });

  // Exercise history
  el.querySelectorAll('.history-ex-detail').forEach(function(btn) {
    btn.addEventListener('click', function() {
      renderExerciseHistory(Number(btn.dataset.eid), btn.dataset.name);
    });
  });
}

async function renderExerciseHistory(exerciseId, exerciseName) {
  var history = await getExerciseHistory(exerciseId);
  var prWeight = await getPRMaxWeight(exerciseId);

  var html = '<div class="card" style="margin-top:12px">';
  html += '<div class="card-header"><span class="card-title">📈 ' + exerciseName + ' 历史</span><button class="btn-ghost btn-sm" id="back-to-day">← 返回</button></div>';
  html += '<div style="display:flex;gap:16px;margin-bottom:16px;font-size:var(--font-sm)">';
  html += '<span>🏆 PR: <b style="color:var(--warning)">' + prWeight + 'kg</b></span>';
  html += '<span>📊 共训练 <b>' + history.length + '次</b></span>';
  html += '</div>';

  if (history.length > 0) {
    html += '<div class="exercise-history-list">';
    history.forEach(function(h) {
      var maxW = calcMaxWeightInSets(h.sets);
      var isPR = maxW >= prWeight && prWeight > 0;
      var setStr = h.sets.map(function(s) { return s.weight + 'kg×' + s.reps; }).join(' · ');
      html += '<div class="history-ex-row">';
      html += '<span style="font-size:var(--font-sm);color:var(--text-secondary);min-width:72px">' + h.date + '</span>';
      html += '<span style="flex:1;font-size:var(--font-sm)">' + setStr + '</span>';
      if (isPR) html += '<span class="pr-badge-sm">🔥PR</span>';
      html += '</div>';
    });
    html += '</div>';
  }

  html += '</div>';

  document.getElementById('history-list').innerHTML = html;
  document.getElementById('back-to-day').addEventListener('click', function() { renderCalendarAndList(); });
}

import { showToast, today } from '../utils.js?v=20260622a';
import { getShiftConfig, saveShiftConfig, getShiftCycle, saveShiftCycle, getSetting, setSetting, getReminderConfig, saveReminderConfig, getPlanConfig, savePlanConfig, getAllExercises, getWeightRecords, db } from '../db.js';
import { PPL_DAYS, BODY_CATEGORIES } from '../utils.js?v=20260622a';

export async function renderSettings() {
  const shiftCfg = await getShiftConfig();
  const profile = await getSetting('profile', { height: 175, currentWeight: 55, targetWeight: 65 });
  const reminders = await getReminderConfig();
  const planCfg = await getPlanConfig();

  document.getElementById('settings-content').innerHTML = `
    <!-- 班次管理 -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-title" style="margin-bottom:10px">班次循环</div>
      <div id="shift-cycle-summary" style="font-size:var(--font-xs);color:var(--text-secondary);margin-bottom:14px;line-height:1.6"></div>
      <div id="shift-cycle-cards" style="margin-bottom:12px"></div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-secondary btn-sm" id="shift-add-day">+ 新增班次</button>
        <button class="btn btn-primary btn-sm" id="shift-save-cycle">保存</button>
      </div>
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
        <label style="font-size:var(--font-sm);color:var(--text-secondary)">起始日期</label>
        <input type="date" id="shift-start" value="${shiftCfg.startDate}" style="width:100%;margin-top:6px">
        <button class="btn btn-primary btn-block btn-sm" id="save-shift" style="margin-top:12px">保存起始日</button>
      </div>
    </div>

    <!-- 身体数据 -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-title" style="margin-bottom:14px">身体数据</div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <div style="flex:1"><label style="font-size:var(--font-xs);color:var(--text-tertiary)">身高(cm)</label><input type="number" id="profile-height" value="${profile.height}" style="width:100%;margin-top:4px"></div>
        <div style="flex:1"><label style="font-size:var(--font-xs);color:var(--text-tertiary)">初始体重(kg)</label><input type="number" id="profile-start-weight" value="${profile.currentWeight}" style="width:100%;margin-top:4px" step="0.1"></div>
      </div>
      <label style="font-size:var(--font-xs);color:var(--text-tertiary)">目标体重(kg)</label>
      <input type="number" id="profile-target" value="${profile.targetWeight}" style="width:100%;margin-top:4px" step="0.1">
      <button class="btn btn-primary btn-block btn-sm" id="save-profile" style="margin-top:12px">保存</button>
    </div>

    <!-- 训练计划 -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-title" style="margin-bottom:14px">训练计划编辑</div>
      <div class="ppl-tabs" id="plan-tabs"></div>
      <div id="plan-editor-area" style="margin-top:12px"></div>
      <button class="btn btn-primary btn-block btn-sm" id="save-plan-config" style="margin-top:12px">保存计划</button>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-title" style="margin-bottom:14px">提醒设置</div>
      ${['training','diet','weight','streak'].map(k => {
        const labels = { training: '训练提醒', diet: '饮食提醒', weight: '体重记录提醒', streak: '连续未训练提醒' };
        return `<div class="setting-row"><span class="setting-label">${labels[k]}</span><button class="reminder-toggle ${reminders.enabled[k] ? 'on' : ''}" data-key="${k}">${reminders.enabled[k] ? '开' : '关'}</button></div>`;
      }).join('')}
    </div>

    <!-- 数据管理 -->
    <div class="card">
      <div class="card-title" style="margin-bottom:14px">数据管理</div>
      <button class="btn btn-secondary btn-block" id="btn-export" style="margin-bottom:8px">导出数据</button>
      <button class="btn btn-secondary btn-block" id="btn-clear" style="color:var(--danger)">清空所有数据</button>
    </div>`;

  // ---- Shift Cycle Editor ----
  let shiftCycle = await getShiftCycle();
  let editingIdx = -1;

  var planEmoji = { push: '🏋️', pull: '🔙', legs: '🦿', upper: '💪', rest: '💤' };
  var planNames = { push: 'Push', pull: 'Pull', legs: 'Legs', upper: 'Upper', rest: '恢复' };
  var planColor = { push: '#ff6b6b', pull: '#4ecdc4', legs: '#45b7d1', upper: '#ffeaa7', rest: 'var(--text-tertiary)' };

  function renderCycleEditor() {
    var summary = document.getElementById('shift-cycle-summary');
    summary.innerHTML = '<span style="color:var(--text-tertiary)">循环 ' + shiftCycle.length + '天：</span>' +
      shiftCycle.map(function(d, i) {
        return '<span style="white-space:nowrap">' + (i > 0 ? ' → ' : '') + d.name + '</span>';
      }).join('');

    var cards = document.getElementById('shift-cycle-cards');
    cards.innerHTML = shiftCycle.map(function(day, i) {
      var isEditing = i === editingIdx;
      var pIcon = planEmoji[day.plan] || '💤';
      var pName = planNames[day.plan] || '恢复';
      var pCol = planColor[day.plan] || 'var(--text-tertiary)';
      var timeStr = day.time || '';

      if (!isEditing) {
        return '<div class="shift-card" data-idx="' + i + '" draggable="true">' +
          '<div class="shift-card-preview">' +
          '<span class="shift-drag-handle" title="拖拽排序">⋮⋮</span>' +
          '<span class="shift-card-num">第' + (i + 1) + '天</span>' +
          '<span class="shift-card-name">' + day.name + '</span>' +
          '<span class="shift-card-plan" style="color:' + pCol + '">' + pIcon + ' ' + pName + '</span>' +
          (timeStr ? '<span class="shift-card-time">' + timeStr + '</span>' : '') +
          '<button class="btn-ghost btn-sm shift-card-edit">编辑</button>' +
          '</div>' +
          '</div>';
      } else {
        return '<div class="shift-card editing" data-idx="' + i + '">' +
          '<div class="shift-card-edit-form">' +
          '<label style="font-size:var(--font-xs);color:var(--text-tertiary)">班次名称</label>' +
          '<input type="text" class="shift-edit-name" value="' + day.name + '" placeholder="如：白班、夜班A">' +
          '<div style="display:flex;gap:10px;margin-top:10px">' +
          '<div style="flex:1"><label style="font-size:var(--font-xs);color:var(--text-tertiary)">时间</label>' +
          '<input type="text" class="shift-edit-time" value="' + timeStr + '" placeholder="如：08:00 或 08:00-16:00"></div>' +
          '<div style="flex:1"><label style="font-size:var(--font-xs);color:var(--text-tertiary)">训练计划</label>' +
          '<select class="shift-edit-plan">' +
          '<option value="push"' + (day.plan === 'push' ? ' selected' : '') + '>Push (推)</option>' +
          '<option value="pull"' + (day.plan === 'pull' ? ' selected' : '') + '>Pull (拉)</option>' +
          '<option value="legs"' + (day.plan === 'legs' ? ' selected' : '') + '>Legs (腿)</option>' +
          '<option value="upper"' + (day.plan === 'upper' ? ' selected' : '') + '>Upper (上肢)</option>' +
          '<option value="rest"' + (day.plan === 'rest' ? ' selected' : '') + '>恢复</option>' +
          '</select></div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;margin-top:12px">' +
          '<button class="btn btn-primary btn-sm shift-edit-save">保存</button>' +
          '<button class="btn btn-secondary btn-sm shift-edit-cancel">取消</button>' +
          '<button class="btn btn-secondary btn-sm shift-edit-delete" style="color:var(--danger);margin-left:auto">删除</button>' +
          '</div>' +
          '</div>' +
          '</div>';
      }
    }).join('');

    // Bind edit button (only the button, not the whole preview)
    cards.querySelectorAll('.shift-card-edit').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        editingIdx = Number(btn.closest('.shift-card').dataset.idx);
        renderCycleEditor();
      });
    });

    // Bind save
    cards.querySelectorAll('.shift-edit-save').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var form = btn.closest('.shift-card-edit-form');
        shiftCycle[editingIdx].name = form.querySelector('.shift-edit-name').value || shiftCycle[editingIdx].name;
        shiftCycle[editingIdx].plan = form.querySelector('.shift-edit-plan').value;
        shiftCycle[editingIdx].time = form.querySelector('.shift-edit-time').value || '';
        editingIdx = -1;
        renderCycleEditor();
      });
    });

    // Bind cancel
    cards.querySelectorAll('.shift-edit-cancel').forEach(function(btn) {
      btn.addEventListener('click', function() {
        editingIdx = -1;
        renderCycleEditor();
      });
    });

    // Bind delete
    cards.querySelectorAll('.shift-edit-delete').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (shiftCycle.length <= 1) return;
        shiftCycle.splice(editingIdx, 1);
        editingIdx = -1;
        renderCycleEditor();
      });
    });

    // Drag-and-drop
    bindDragSort(cards);
  }

  function bindDragSort(cardsEl) {
    var allCards = cardsEl.querySelectorAll('.shift-card');
    allCards.forEach(function(card) {
      card.addEventListener('dragstart', function(e) {
        if (editingIdx >= 0) { e.preventDefault(); return; }
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.idx);
        card.classList.add('shift-dragging');
      });
      card.addEventListener('dragend', function() {
        card.classList.remove('shift-dragging');
        allCards.forEach(function(c) { c.classList.remove('shift-drag-over'); });
      });
      card.addEventListener('dragover', function(e) {
        if (editingIdx >= 0) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('shift-drag-over');
      });
      card.addEventListener('dragleave', function() {
        card.classList.remove('shift-drag-over');
      });
      card.addEventListener('drop', function(e) {
        e.preventDefault();
        card.classList.remove('shift-drag-over');
        var from = Number(e.dataTransfer.getData('text/plain'));
        var to = Number(card.dataset.idx);
        if (from !== to && !isNaN(from) && !isNaN(to)) {
          var item = shiftCycle.splice(from, 1)[0];
          shiftCycle.splice(to, 0, item);
          editingIdx = -1;
          renderCycleEditor();
        }
      });
    });
  }

  document.getElementById('shift-add-day').addEventListener('click', function() {
    shiftCycle.push({ name: '新班次', plan: 'rest', time: '' });
    editingIdx = -1;
    renderCycleEditor();
  });

  document.getElementById('shift-save-cycle').addEventListener('click', async function() {
    await saveShiftCycle(shiftCycle);
    showToast('班次循环已保存');
  });

  // Shift start date
  document.getElementById('save-shift').addEventListener('click', async () => {
    const startDate = document.getElementById('shift-start').value;
    await saveShiftConfig({ startDate });
    showToast('起始日期已保存');
  });

  renderCycleEditor();

  // Profile save
  document.getElementById('save-profile').addEventListener('click', async () => {
    await setSetting('profile', {
      height: Number(document.getElementById('profile-height').value),
      currentWeight: Number(document.getElementById('profile-start-weight').value),
      targetWeight: Number(document.getElementById('profile-target').value)
    });
    showToast('身体数据已保存');
  });

  // Reminder toggles
  document.querySelectorAll('.reminder-toggle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.key;
      reminders.enabled[key] = !reminders.enabled[key];
      await saveReminderConfig(reminders);
      btn.classList.toggle('on');
      btn.textContent = reminders.enabled[key] ? '开' : '关';
    });
  });

  // Export
  document.getElementById('btn-export').addEventListener('click', async () => {
    const workouts = await db.workouts.toArray();
    const weights = await db.weightRecords.toArray();
    const we = await db.workoutExercises.toArray();
    const diet = await db.getDietRecords ? await db.dietRecords.toArray() : [];
    const json = JSON.stringify({ workouts, workoutExercises: we, weightRecords: weights, dietRecords: diet, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitness-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('导出成功');
  });

  // Plan editor
  let planEditCfg = { ...(await getPlanConfig()) };
  let activePlanDay = 'push';
  const allExercises = await getAllExercises();

  function renderPlanEditor() {
    const tabs = document.getElementById('plan-tabs');
    tabs.innerHTML = Object.entries(PPL_DAYS).map(([k, v]) => 
      `<button class="ppl-tab${activePlanDay === k ? ' active' : ''}" data-day="${k}">${v.icon} ${v.name}</button>`
    ).join('');
    tabs.querySelectorAll('.ppl-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activePlanDay = tab.dataset.day;
        renderPlanEditor();
      });
    });

    const exs = normalizePlanExercises(planEditCfg[activePlanDay] || []);
    const area = document.getElementById('plan-editor-area');
    area.innerHTML = exs.map((ex, i) => `
      <div class="plan-edit-row">
        <span class="plan-edit-num">${i + 1}</span>
        <input type="text" class="plan-edit-name" value="${ex.name}" data-idx="${i}" style="flex:2">
        <input type="number" class="plan-edit-num-input" value="${ex.sets}" data-idx="${i}" data-field="sets" placeholder="组" min="1" style="width:44px">
        <span style="font-size:10px;color:var(--text-tertiary)">×</span>
        <input type="number" class="plan-edit-num-input" value="${ex.reps}" data-idx="${i}" data-field="reps" placeholder="次" min="0" style="width:44px">
        <input type="number" class="plan-edit-num-input" value="${ex.weight || ''}" data-idx="${i}" data-field="weight" placeholder="kg" min="0" step="0.5" style="width:50px">
        <button class="plan-edit-del" data-idx="${i}">✕</button>
      </div>
    `).join('') + `
      <select id="plan-add-select" style="width:100%;margin-top:6px;padding:8px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-size:var(--font-sm);outline:none">
        <option value="">+ 添加动作</option>
        ${allExercises.filter(e => !exs.some(x => x.name === e.name)).map(e => `<option value="${e.name}">${e.name} · ${(BODY_CATEGORIES[e.category]||{}).name||''}</option>`).join('')}
      </select>`;

    area.querySelectorAll('.plan-edit-name').forEach(inp => {
      inp.addEventListener('input', () => { const i = Number(inp.dataset.idx); if (planEditCfg[activePlanDay][i]) planEditCfg[activePlanDay][i].name = inp.value; });
    });
    area.querySelectorAll('.plan-edit-num-input').forEach(inp => {
      inp.addEventListener('input', () => { const i = Number(inp.dataset.idx); const f = inp.dataset.field; if (planEditCfg[activePlanDay][i]) planEditCfg[activePlanDay][i][f] = Number(inp.value) || 0; });
    });
    area.querySelectorAll('.plan-edit-del').forEach(btn => {
      btn.addEventListener('click', () => { planEditCfg[activePlanDay].splice(Number(btn.dataset.idx), 1); renderPlanEditor(); });
    });
    const addSel = document.getElementById('plan-add-select');
    if (addSel) addSel.addEventListener('change', () => {
      const name = addSel.value; if (!name) return;
      planEditCfg[activePlanDay].push({ name, sets: 3, reps: 10, weight: 0 });
      renderPlanEditor();
    });
  }

  document.getElementById('save-plan-config').addEventListener('click', async () => {
    await savePlanConfig(planEditCfg);
    showToast('计划已保存');
  });

  renderPlanEditor();

  function normalizePlanExercises(list) {
    if (!list || !list.length) return [];
    if (typeof list[0] === 'string') return list.map(name => ({ name, sets: 3, reps: 10, weight: 0 }));
    return list;
  }

  document.getElementById('btn-clear').addEventListener('click', async () => {
    if (confirm('确定清空所有数据？此操作不可恢复。')) {
      await db.workouts.clear();
      await db.weightRecords.clear();
      await db.workoutExercises.clear();
      await db.dietRecords.clear();
      showToast('数据已清空');
      renderSettings();
    }
  });
}

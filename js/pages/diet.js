import { DIET_TARGETS, showToast, today } from '../utils.js?v=20260622b';
import { getDietByDate, saveDietRecord, getDietCounters, saveDietCounters } from '../db.js';

export async function renderDiet() {
  await renderDietPage();
}

async function renderDietPage() {
  const diets = await getDietByDate(today());
  const byMeal = {};
  diets.forEach(d => { byMeal[d.mealType] = d; });

  let totalProtein = 0, totalCalories = 0; const counters = await getDietCounters();
  diets.forEach(d => {
    totalProtein += d.protein || 0;
    totalCalories += d.calories || 0;

  });

  const pPct = Math.min(100, (totalProtein / DIET_TARGETS.protein) * 100);
  const cPct = Math.min(100, (totalCalories / DIET_TARGETS.calories) * 100);

  const meals = [
    { key: 'breakfast', name: '早餐', icon: '🌅', time: '7:00-9:00' },
    { key: 'lunch', name: '午餐', icon: '☀️', time: '11:30-13:00' },
    { key: 'dinner', name: '晚餐', icon: '🌙', time: '17:30-19:00' }
  ];

  document.getElementById('diet-content').innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-title" style="margin-bottom:14px">今日摄入进度</div>
      <div style="display:flex;gap:12px;align-items:center;justify-content:center">
        <div class="ring-progress">
          <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg-elevated)" stroke-width="6"/><circle cx="40" cy="40" r="34" fill="none" stroke="var(--accent)" stroke-width="6" stroke-dasharray="${(pPct * 2.136).toFixed(0)} 213.6" stroke-linecap="round" transform="rotate(-90 40 40)"/></svg>
          <span class="ring-text">${totalProtein}<small>/${DIET_TARGETS.protein}g</small></span>
        </div>
        <div class="ring-progress">
          <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg-elevated)" stroke-width="6"/><circle cx="40" cy="40" r="34" fill="none" stroke="var(--warning)" stroke-width="6" stroke-dasharray="${(cPct * 2.136).toFixed(0)} 213.6" stroke-linecap="round" transform="rotate(-90 40 40)"/></svg>
          <span class="ring-text">${totalCalories}<small>/${DIET_TARGETS.calories}kcal</small></span>
        </div>
      </div>
    </div>

    <!-- 三餐 -->
    ${meals.map(m => {
      const data = byMeal[m.key] || { foodItems: {}, protein: 0, calories: 0 };
      return `<div class="card" style="margin-bottom:12px">
        <div class="card-header"><span class="card-title">${m.icon} ${m.name} <span style="font-size:var(--font-xs);color:var(--text-tertiary);font-weight:400">${m.time}</span></span>
          ${totalProtein + totalCalories > 0 ? `<span style="font-size:var(--font-xs);color:var(--text-secondary)">${data.protein}g · ${data.calories}kcal</span>` : ''}
        </div>
        <input type="text" class="food-input" id="food-${m.key}" placeholder="食物（如：米饭200g、牛肉150g）" value="${data.foodItems?.desc || ''}">
        <div style="display:flex;gap:6px;margin-top:8px">
          <input type="number" class="food-num" id="prot-${m.key}" placeholder="蛋白质g" value="${data.protein || ''}" step="1" min="0" inputmode="numeric">
          <input type="number" class="food-num" id="cal-${m.key}" placeholder="热量kcal" value="${data.calories || ''}" step="10" min="0" inputmode="numeric">
        </div>
        <button class="btn btn-primary btn-sm" id="save-${m.key}" style="margin-top:8px">保存</button>
      </div>`;
    }).join('')}

    <!-- 专项计数 -->
    <div class="card">
      <div class="card-title" style="margin-bottom:14px">今日摄入专项</div>
      <div class="food-counters">
${(() => {
          const items = [
            { key: 'milk', name: '牛奶(ml)', target: 500, icon: '🥛', step: 50 },
            { key: 'eggs', name: '鸡蛋(个)', target: 3, icon: '🥚', step: 1 },
            { key: 'chicken', name: '鸡胸肉(g)', target: 200, icon: '🍗', step: 10 },
            { key: 'banana', name: '香蕉(根)', target: 2, icon: '🍌', step: 1 },
            { key: 'protein', name: '蛋白粉(勺)', target: 2, icon: '🥤', step: 1 },
            { key: 'water', name: '饮水(L)', target: 3, icon: '💧', step: 0.5 }
          ];
          return items.map(item => {
            const val = counters[item.key] || 0;
            const pct = Math.min(100, (val / item.target) * 100);
            return `<div class="food-counter">
              <div class="food-counter-header"><span>${item.icon} ${item.name}</span><span class="food-counter-val">${val}/${item.target}</span></div>
              <div class="food-counter-bar"><div style="width:${pct}%"></div></div>
              <input type="number" id="cnt-${item.key}" placeholder="+" value="" min="0" step="${item.step}" inputmode="numeric" class="food-num" style="margin-top:6px">
            </div>`;
          }).join('');
        })()}
      </div>
      <button class="btn btn-primary btn-block btn-sm" id="save-counters" style="margin-top:12px">保存专项</button>
    </div>`;

  // Bind meal save buttons
  meals.forEach(m => {
    document.getElementById(`save-${m.key}`).addEventListener('click', async () => {
      const desc = document.getElementById(`food-${m.key}`).value.trim();
      const protein = parseFloat(document.getElementById(`prot-${m.key}`).value) || 0;
      const calories = parseFloat(document.getElementById(`cal-${m.key}`).value) || 0;
      await saveDietRecord({ mealType: m.key, foodItems: { desc }, protein, calories });
      showToast(`${m.name}已保存`);
      renderDietPage();
    });
  });

  // Bind counter save
  document.getElementById('save-counters').addEventListener('click', async () => {
    const items = ['milk','eggs','chicken','banana','protein','water'];
    const data = {};
    items.forEach(k => { const v = parseFloat(document.getElementById('cnt-'+k)?.value) || 0; if (v > 0) data[k] = v; });
    if (Object.keys(data).length === 0) return;
    const existing = await getDietCounters();
    items.forEach(k => { if (data[k]) existing[k] = (existing[k] || 0) + data[k]; });
    await saveDietCounters(existing);
    showToast('已保存');
    renderDietPage();
  });
}

import { getPage, navigate } from '../router.js';

export function renderNavbar() {
  var container = document.getElementById('navbar');
  var tabs = [
    { id: 'home', icon: '🏠', label: '首页' },
    { id: 'action', icon: '+', label: '', special: true },
    { id: 'diet', icon: '🍽️', label: '饮食' },
    { id: 'history', icon: '📋', label: '历史' },
    { id: 'settings', icon: '⚙️', label: '设置' }
  ];

  container.innerHTML = tabs.map(function(t) {
    var cls = 'nav-item' + (t.special ? ' nav-item-checkin' : '');
    return '<button class="' + cls + '" data-page="' + t.id + '"><span class="nav-icon">' + t.icon + '</span><span>' + t.label + '</span></button>';
  }).join('');

  container.querySelectorAll('.nav-item').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var page = btn.dataset.page;
      if (page === 'action') {
        showActionSheet();
      } else {
        navigate(page);
      }
    });
  });

  updateActive();
}

export function updateActive() {
  var page = getPage();
  document.querySelectorAll('.nav-item').forEach(function(btn) {
    if (btn.dataset.page === 'action') return;
    btn.classList.toggle('active', btn.dataset.page === page);
  });
}

function showActionSheet() {
  var overlay = document.getElementById('modal-overlay');
  var content = document.getElementById('modal-content');
  content.innerHTML = '' +
    '<div style="text-align:center;padding:8px 0">' +
    '<button class="action-sheet-item" id="as-workout"><span class="as-icon">🏋️</span><span class="as-label">开始训练</span></button>' +
    '<button class="action-sheet-item" id="as-diet"><span class="as-icon">🍗</span><span class="as-label">饮食打卡</span></button>' +
    '<button class="action-sheet-item" id="as-weight"><span class="as-icon">⚖️</span><span class="as-label">记录体重</span></button>' +
    '<button class="action-sheet-item" id="as-recovery"><span class="as-icon">😴</span><span class="as-label">恢复打卡</span></button>' +
    '<button class="action-sheet-cancel" id="as-cancel">取消</button>' +
    '</div>';

  overlay.classList.remove('hidden');

  document.getElementById('as-workout').addEventListener('click', function() { overlay.classList.add('hidden'); navigate('checkin'); });
  document.getElementById('as-diet').addEventListener('click', function() { overlay.classList.add('hidden'); navigate('diet'); });
  document.getElementById('as-weight').addEventListener('click', async function() {
    overlay.classList.add('hidden');
    var { getSetting, setWeight, getLatestWeight } = await import('../db.js');
    var val = parseFloat(prompt('输入体重 (kg):', ''));
    if (!isNaN(val) && val > 0) {
      await setWeight(val, '');
      var { showToast } = await import('../utils.js');
      showToast('已记录');
    }
  });
  document.getElementById('as-recovery').addEventListener('click', function() { overlay.classList.add('hidden'); navigate('home'); });
  document.getElementById('as-cancel').addEventListener('click', function() { overlay.classList.add('hidden'); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.classList.add('hidden'); });
}

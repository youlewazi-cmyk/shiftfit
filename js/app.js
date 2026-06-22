import { navigate, onNavigate } from './router.js';
import { renderNavbar, updateActive } from './components/navbar.js';
import { renderHome } from './pages/home.js';
import { renderCheckin } from './pages/checkin.js';
import { renderDiet } from './pages/diet.js';
import { renderHistory } from './pages/history.js';
import { renderSettings } from './pages/settings.js';
import { seedDefaultExercises } from './db.js';
import { checkReminders } from './utils.js?v=20260622b';

const renderers = { home: renderHome, checkin: renderCheckin, diet: renderDiet, history: renderHistory, settings: renderSettings };

async function init() {
  renderNavbar();

  onNavigate(async function(page) {
    updateActive();
    if (renderers[page]) await renderers[page]();
  });

  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('sw.js'); } catch(e) {}
  }

  await seedDefaultExercises();
  await renderHome();

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  setInterval(checkReminders, 30000);
}

init();

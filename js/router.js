let currentPage = 'home';
const listeners = [];

export function getPage() { return currentPage; }

export function navigate(page) {
  if (page === currentPage) return;
  currentPage = page;
  document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.remove('hidden');
  listeners.forEach(fn => fn(page));
  window.scrollTo(0, 0);
}

export function onNavigate(fn) { listeners.push(fn); }

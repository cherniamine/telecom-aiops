// ═══════════════════════════════════════════════════════════════════════════════
// main.ts — Application bootstrap
// ═══════════════════════════════════════════════════════════════════════════════
import { bootstrapApplication }  from '@angular/platform-browser';
import { AppComponent }          from './app/app.component';
import { appConfig }             from './app/app.config';
 
// ── Dark mode init (before Angular boots to avoid flash) ─────────────────────
(function initTheme() {
  const saved       = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
})();
 
bootstrapApplication(AppComponent, appConfig).catch(err => {
  console.error('[Bootstrap Error]', err);
});
 
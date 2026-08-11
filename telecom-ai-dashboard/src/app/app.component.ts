// ═══════════════════════════════════════════════════════════════════════════════
// app.component.ts — Root standalone component
// ═══════════════════════════════════════════════════════════════════════════════
import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet }                       from '@angular/router';
import { CommonModule }                       from '@angular/common';
import { LoadingService }    from './core/interceptors/loading.interceptor';
import { ToastContainerComponent } from './shared/components/toast/toast.component';
import { ConfirmDialogComponent }  from './shared/components/confirm-dialog/confirm-dialog.component';
import { FormsModule } from '@angular/forms';
 
@Component({
  selector:   'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    ToastContainerComponent,
    ConfirmDialogComponent,
    FormsModule ,
  ],
  template: `
    <!-- Global progress bar -->
    <div class="global-progress" [class.active]="loadingService.isLoading()">
      <div class="gp-bar"></div>
    </div>
 
    <!-- Main router outlet -->
    <router-outlet/>
 
    <!-- Global overlays (toast + confirm) -->
    <app-toast-container/>
    <app-confirm-dialog/>
  `,
  styles: [`
    :host { display:block; min-height:100vh; }
 
    /* Global progress bar */
    .global-progress {
      position:fixed; top:0; left:0; right:0; z-index:9999;
      height:2px; pointer-events:none;
      opacity:0; transition:opacity 200ms;
    }
    .global-progress.active { opacity:1; }
 
    .gp-bar {
      height:100%;
      background:linear-gradient(90deg, transparent, var(--accent,#0ea5e9), transparent);
      animation:progress-sweep 1.2s ease-in-out infinite;
      transform-origin:left center;
    }
    @keyframes progress-sweep {
      0%   { transform:scaleX(0) translateX(0); }
      50%  { transform:scaleX(0.6) translateX(50%); }
      100% { transform:scaleX(0) translateX(200%); }
    }
  `],
})
export class AppComponent implements OnInit {
  readonly loadingService = inject(LoadingService);
 
  ngOnInit(): void {
    // Restore dark mode from localStorage on app start
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  }
}

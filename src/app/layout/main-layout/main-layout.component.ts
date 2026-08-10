import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, CommonModule],
  template: `
    <div class="shell" [class.sidebar-collapsed]="sidebarCollapsed">
      <app-sidebar
        [collapsed]="sidebarCollapsed"
        (toggleCollapse)="sidebarCollapsed = !sidebarCollapsed"
      />
      <div class="main-area">
        <app-topbar
          [isDarkMode]="isDarkMode"
          (toggleSidebar)="sidebarCollapsed = !sidebarCollapsed"
          (themeToggle)="toggleTheme()"
          (refresh)="broadcastRefresh()" />
        <main class="page-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styleUrls: ['./main-layout.component.scss'],
})
export class MainLayoutComponent implements OnInit {
  sidebarCollapsed = false;
  isDarkMode = false;

  ngOnInit(): void {
    this.isDarkMode = document.documentElement.classList.contains('dark');
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    document.documentElement.classList.toggle('dark', this.isDarkMode);
    localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
  }

  broadcastRefresh(): void {
    window.dispatchEvent(new CustomEvent('telecom-dashboard-refresh'));
  }
}

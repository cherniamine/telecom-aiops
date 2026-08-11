import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
 
type TabIconId = 'overview' | 'rca' | 'whatif' | 'copilot' | 'faiss';
 
@Component({
  selector: 'app-tab-icon',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 16 16" fill="none" width="15" height="15" aria-hidden="true">
 
      <!-- overview : 4 carrés -->
      <ng-container *ngIf="id === 'overview'">
        <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5"
              stroke="currentColor" stroke-width="1.3"/>
        <rect x="9"   y="1.5" width="5.5" height="5.5" rx="1.5"
              stroke="currentColor" stroke-width="1.3"/>
        <rect x="1.5" y="9"   width="5.5" height="5.5" rx="1.5"
              stroke="currentColor" stroke-width="1.3"/>
        <rect x="9"   y="9"   width="5.5" height="5.5" rx="1.5"
              stroke="currentColor" stroke-width="1.3"/>
      </ng-container>
 
      <!-- rca : croix + cercle centre -->
      <ng-container *ngIf="id === 'rca'">
        <path d="M8 2v4M8 10v4M2 8h4M10 8h4"
              stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.3"/>
      </ng-container>
 
      <!-- whatif : triangle play -->
      <ng-container *ngIf="id === 'whatif'">
        <path d="M3 2l9 5-9 5V2z" fill="currentColor" opacity=".7"/>
      </ng-container>
 
      <!-- copilot : bulle chat -->
      <ng-container *ngIf="id === 'copilot'">
        <path d="M8 1C4.7 1 2 3.7 2 7s2.7 6 6 6c.8 0 1.5-.15 2.2-.4L13 14l-.9-3A6 6 0 0014 7c0-3.3-2.7-6-6-6z"
              stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
      </ng-container>
 
      <!-- faiss : 2 cercles + lien -->
      <ng-container *ngIf="id === 'faiss'">
        <circle cx="5.5"  cy="5.5"  r="3" stroke="currentColor" stroke-width="1.3"/>
        <circle cx="10.5" cy="10.5" r="3" stroke="currentColor" stroke-width="1.3"/>
        <path d="M7.5 7.5l1 1" stroke="currentColor" stroke-width="1.3"
              stroke-linecap="round"/>
      </ng-container>
 
    </svg>
  `,
  styles: [`:host { display:inline-flex; align-items:center; }`],
})
export class TabIconComponent {
  @Input() id!: TabIconId;
}
 
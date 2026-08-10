// ═══════════════════════════════════════════════════════════════════════════════
// noc/alerts/noc-alerts.component.ts
// ═══════════════════════════════════════════════════════════════════════════════

import { CommonModule } from "@angular/common";
import { Component, OnInit, OnDestroy } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NocService, NocAlert } from "@app/services/noc.service";
import { EmptyStateComponent, LoadingSpinnerComponent, PlatformTagComponent, SearchBarComponent, SeverityBadgeComponent, TimeAgoPipe } from "@app/shared/shared.index";

@Component({
  selector: 'app-noc-alerts',
  standalone: true,
  imports: [
    CommonModule,
    SeverityBadgeComponent,
    PlatformTagComponent,
    FormsModule,
    LoadingSpinnerComponent,
    SearchBarComponent,
    EmptyStateComponent,
    TimeAgoPipe,
  ],
  template: `
    <div class="alerts-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Alertes NOC</h1>
          <p class="page-sub">Incidents CRITICAL et HIGH · Mise à jour automatique</p>
        </div>
        <div class="header-right">
          <span class="count-badge" *ngIf="filtered.length">
            {{ filtered.length }} alerte{{ filtered.length > 1 ? 's' : '' }}
          </span>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-row">
        <app-search-bar placeholder="Rechercher dans les alertes..."
          (valueChange)="onSearch($event)" style="flex:1; max-width:360px"/>
        <div class="filter-pills">
          <button class="pill" [class.active]="sevFilter === ''"
                  (click)="sevFilter = ''; applyFilter()">Toutes</button>
          <button class="pill pill-critical" [class.active]="sevFilter === 'CRITICAL'"
                  (click)="sevFilter = 'CRITICAL'; applyFilter()">CRITICAL</button>
          <button class="pill pill-high" [class.active]="sevFilter === 'HIGH'"
                  (click)="sevFilter = 'HIGH'; applyFilter()">HIGH</button>
          <button class="pill pill-medium" [class.active]="sevFilter === 'MEDIUM'"
                  (click)="sevFilter = 'MEDIUM'; applyFilter()">MEDIUM</button>
        </div>
      </div>

      <app-loading-spinner *ngIf="loading" label="Chargement des alertes..." minHeight="200px"/>

      <app-empty-state *ngIf="!loading && filtered.length === 0"
        title="Aucune alerte active"
        description="Toutes les plateformes fonctionnent normalement."/>

      <!-- Alert list -->
      <div class="alerts-list" *ngIf="!loading && filtered.length > 0">
        <div class="alert-card" *ngFor="let a of filtered; trackBy: trackById"
             [ngClass]="'acard-' + a.severity.toLowerCase()">
          
          <!-- Left column: Severity + Platform -->
          <div class="ac-left">
            <app-severity-badge [severity]="a.severity" size="sm"/>
            <app-platform-tag [platform]="getPlatform(a)" size="sm"/>
          </div>

          <!-- Middle column: Message + Actions -->
          <div class="ac-body">
            <p class="ac-message">{{ a.message }}</p>
            <div class="ac-actions" *ngIf="a.immediate_actions?.length">
              <span class="ac-action-label">Actions :</span>
              <span class="ac-action" *ngFor="let act of a.immediate_actions">{{ act }}</span>
            </div>
          </div>

          <!-- Right column: Time info + ETA + Priority -->
          <div class="ac-right">
            <div class="ac-time-info">
              <span class="ac-time-ago">Créé: {{ a.created_at | timeAgo }}</span>
              <span class="ac-eta" *ngIf="a.metadata?.predicted_resolution_minutes && isAlertRecent(a)">
                ⏱️ Restant: {{ getRemainingTime(a) }}
              </span>
              <span class="ac-eta-detail" *ngIf="a.metadata?.predicted_resolution_minutes">
                📊 Total estimé: {{ a.metadata?.predicted_resolution_minutes }} min
              </span>
              <span class="ac-priority" *ngIf="a.metadata?.operator_priority === 'IMMEDIATE ACTION'">
                🚨 URGENT
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .alerts-page { 
      display: flex; 
      flex-direction: column; 
      gap: 16px; 
    }
    
    .page-header { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start; 
    }
    
    .page-title { 
      margin: 0; 
      font-size: 24px; 
      font-weight: 600; 
      background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 12px;  
    }
    
    .page-title::before {
      content: '';
      display: inline-block;
      width: 4px;
      height: 24px;
      background: linear-gradient(180deg, var(--accent, #0ea5e9), #8b5cf6);
      border-radius: 4px;
    }
    
    .page-sub { 
      margin: 4px 0 0; 
      font-size: 12px; 
      color: var(--text-muted); 
    }
    
    .count-badge { 
      padding: 4px 12px; 
      border-radius: 20px;
      background: rgba(239,68,68,.1); 
      color: #ef4444;
      font-size: 12px; 
      font-weight: 600; 
    }
    
    .filters-row { 
      display: flex; 
      align-items: center; 
      gap: 10px; 
      flex-wrap: wrap; 
    }
    
    .filter-pills { 
      display: flex; 
      gap: 6px; 
    }
    
    .pill {
      padding: 5px 12px; 
      border-radius: 20px; 
      border: 1px solid var(--border-subtle);
      background: transparent; 
      color: var(--text-muted); 
      font-size: 12px;
      font-weight: 500; 
      cursor: pointer; 
      transition: all 150ms;
    }
    
    .pill-medium.active {
      background: rgba(59,130,246,.1);
      color: #3b82f6;
      border-color: rgba(59,130,246,.3);
    }
    
    .pill:hover, .pill.active { 
      background: var(--bg-hover); 
      color: var(--text-primary); 
      border-color: var(--border-default); 
    }
    
    .pill-critical.active { 
      background: rgba(239,68,68,.1); 
      color: #ef4444; 
      border-color: rgba(239,68,68,.3); 
    }
    
    .pill-high.active { 
      background: rgba(245,158,11,.1); 
      color: #f59e0b; 
      border-color: rgba(245,158,11,.3); 
    }
    
    .alerts-list { 
      display: flex; 
      flex-direction: column; 
      gap: 8px; 
    }
    
    .alert-card {
      display: flex; 
      align-items: flex-start; 
      gap: 14px;
      padding: 14px 16px; 
      border-radius: 10px;
      border: 1px solid var(--border-subtle); 
      background: var(--bg-card);
      transition: box-shadow 200ms;
    }
    
    .alert-card:hover { 
      box-shadow: 0 2px 12px rgba(0,0,0,.07); 
    }
    
    .acard-critical { 
      border-left: 3px solid #ef4444; 
    }
    
    .acard-high { 
      border-left: 3px solid #f59e0b; 
    }
    
    .ac-left { 
      display: flex; 
      flex-direction: column; 
      gap: 5px; 
      flex-shrink: 0; 
    }
    
    .ac-body { 
      flex: 1; 
      min-width: 0; 
    }
    
    .ac-message { 
      margin: 0 0 6px; 
      font-size: 13px; 
      color: var(--text-secondary); 
      line-height: 1.5; 
    }
    
    .ac-actions { 
      display: flex; 
      align-items: center; 
      gap: 6px; 
      flex-wrap: wrap; 
    }
    
    .ac-action-label { 
      font-size: 11px; 
      color: var(--text-muted); 
    }
    
    .ac-action {
      font-size: 11px; 
      padding: 1px 7px; 
      border-radius: 4px;
      background: rgba(14,165,233,.1); 
      color: var(--accent, #0ea5e9);
    }
    
    .ac-right { 
      display: flex; 
      flex-direction: column; 
      align-items: flex-end; 
      gap: 3px; 
      flex-shrink: 0; 
    }
    
    /* Time info container */
    .ac-time-info {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }
    
    /* Time ago text */
    .ac-time-ago {
      font-size: 11px;
      color: var(--text-muted);
      white-space: nowrap;
    }
    
    /* ETA badge */
    .ac-eta {
      font-size: 10px;
      font-weight: 500;
      color: var(--accent, #0ea5e9);
      background: rgba(14, 165, 233, 0.1);
      padding: 2px 8px;
      border-radius: 12px;
      white-space: nowrap;
      display: inline-block;
    }

    /* ETA detail badge */
    .ac-eta-detail {
      font-size: 10px;
      font-weight: 500;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.05);
      padding: 2px 8px;
      border-radius: 12px;
      white-space: nowrap;
      display: inline-block;
    }
    
    /* Priority badge */
    .ac-priority {
      font-size: 10px;
      font-weight: 600;
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
      padding: 2px 8px;
      border-radius: 12px;
      white-space: nowrap;
      margin-top: 2px;
    }
  `],
})
export class NocAlertsComponent implements OnInit, OnDestroy {
  loading = true;
  alerts: NocAlert[] = [];
  filtered: NocAlert[] = [];
  sevFilter = '';
  searchTerm = '';
  private refreshInterval: any;

  constructor(private nocService: NocService) {}

  ngOnInit(): void {
    this.loadAlerts();
    
    // Rafraîchir l'affichage toutes les minutes pour mettre à jour les ETA
    this.refreshInterval = setInterval(() => {
      if (!this.loading) {
        this.applyFilter();
      }
    }, 60000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  loadAlerts(): void {
    this.nocService.getAlerts().subscribe({
      next: (response) => {
        this.alerts = response.alerts;
        this.applyFilter();
        this.loading = false;
        
        console.log('=== ALERTES CHARGÉES ===');
        console.log(`📊 Total: ${this.alerts.length} alertes`);
        this.alerts.forEach((alert, index) => {
          this.logAlertDetails(alert, index);
        });
      },
      error: (err) => {
        console.error('Erreur chargement alertes:', err);
        this.loading = false;
      },
    });
  }

  onSearch(q: string): void {
    this.searchTerm = q;
    this.applyFilter();
  }

  applyFilter(): void {
    this.filtered = this.alerts.filter(a => {
      const matchSev = !this.sevFilter || a.severity === this.sevFilter;
      const matchText = !this.searchTerm
        || a.message?.toLowerCase().includes(this.searchTerm.toLowerCase())
        || a.metadata?.platform?.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchSev && matchText;
    });
  }

  trackById = (_: number, a: NocAlert) => a._id;

  /**
   * Récupère le nom de la plateforme depuis les métadonnées
   */
  getPlatform(alert: NocAlert): string {
    return alert.metadata?.platform ?? '';
  }

  /**
   * Parse une date depuis le format backend et retourne un timestamp en millisecondes (heure locale)
   * Le backend envoie "2026-04-20T10:41:01.632000" (heure locale UTC+1)
   */
private parseDateToLocalTimestamp(dateStr: string): number {
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  
  if (!match) {
    return Date.now();
  }
  
  const year = parseInt(match[1]);
  const month = parseInt(match[2]) - 1;
  const day = parseInt(match[3]);
  const hour = parseInt(match[4]);
  const minute = parseInt(match[5]);
  const second = parseInt(match[6]);
  
  // 🔧 CORRECTION: Ajouter 1 heure de décalage
  const localDate = new Date(year, month, day, hour + 1, minute, second);
  
  console.log(`📅 Parse: ${dateStr} → ${localDate.toLocaleString()} (timestamp: ${localDate.getTime()})`);
  
  return localDate.getTime();
}
    

  /**
   * Vérifie si l'alerte est récente (moins de 30 minutes)
   */
  isAlertRecent(alert: NocAlert): boolean {
    const createdAtTimestamp = this.parseDateToLocalTimestamp(alert.created_at);
    const nowTimestamp = Date.now();
    const minutesElapsed = (nowTimestamp - createdAtTimestamp) / 60000;
    const isRecent = minutesElapsed < 30;
    
    console.log(`📊 isAlertRecent - ${alert._id}: ${minutesElapsed.toFixed(2)} min écoulées → ${isRecent ? 'Récente' : 'Ancienne'}`);
    
    return isRecent;
  }

  /**
   * Log les détails d'une alerte dans la console
   */
  private logAlertDetails(alert: NocAlert, index: number): void {
    const predictedMinutes = alert.metadata?.predicted_resolution_minutes;
    const remainingTime = this.getRemainingTime(alert);
    const isRecent = this.isAlertRecent(alert);
    
    console.group(`📋 Alerte #${index + 1} - ${alert._id}`);
    console.log(`📝 Message: ${alert.message.substring(0, 100)}...`);
    console.log(`⚠️ Severité: ${alert.severity}`);
    console.log(`🕐 Créé le: ${alert.created_at}`);
    console.log(`🕐 Time ago: ${alert.time_ago}`);
    console.log(`📊 Total estimé: ${predictedMinutes || 'Non défini'} min`);
    console.log(`⏱️ Restant: ${remainingTime || 'Non calculé'}`);
    console.log(`🎯 Platform: ${this.getPlatform(alert)}`);
    console.log(`🔄 Récente: ${isRecent ? 'Oui' : 'Non'}`);
    if (alert.metadata?.operator_priority) {
      console.log(`🚨 Priorité opérateur: ${alert.metadata.operator_priority}`);
    }
    if (alert.immediate_actions?.length) {
      console.log(`🔧 Actions: ${alert.immediate_actions.join(', ')}`);
    }
    console.groupEnd();
  }

  /**
   * Calculate remaining time for incident resolution
   * @param alert - The alert object
   * @returns Formatted remaining time string
   */
  getRemainingTime(alert: NocAlert): string {
    const predictedMinutes = alert.metadata?.predicted_resolution_minutes;
    
    if (!predictedMinutes || predictedMinutes <= 0) {
      return '';
    }
    
    const createdAtTimestamp = this.parseDateToLocalTimestamp(alert.created_at);
    const nowTimestamp = Date.now();
    const elapsedMinutes = (nowTimestamp - createdAtTimestamp) / 60000;
    const remainingMinutes = Math.max(0, Math.ceil(predictedMinutes - elapsedMinutes));
    
    console.log(`🔍 Debug ETA - Alert: ${alert._id}`);
    console.log(`   - Prédit: ${predictedMinutes} min`);
    console.log(`   - Créé à (locale): ${new Date(createdAtTimestamp).toLocaleString()}`);
    console.log(`   - Maintenant (locale): ${new Date(nowTimestamp).toLocaleString()}`);
    console.log(`   - Temps écoulé: ${elapsedMinutes.toFixed(2)} min`);
    console.log(`   - Temps restant: ${remainingMinutes} min`);
    
    // Si le temps écoulé dépasse largement le temps prédit, ne pas afficher
    if (elapsedMinutes > predictedMinutes + 5) {
      return '';
    }
    
    if (remainingMinutes <= 0) {
      return '⚠️ Résolution dépassée';
    }
    
    if (remainingMinutes <= 5) {
      return `🔥 ${remainingMinutes} min`;
    }
    
    if (remainingMinutes <= 15) {
      return `⚠️ ${remainingMinutes} min`;
    }
    
    return `⏱️ ${remainingMinutes} min`;
  }
}
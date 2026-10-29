import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Incident } from '@app/services/Incident.service';
import {
  IncidentResponseAgentService,
  InvestigationComparison,
  InvestigationSnapshot,
  InvestigationReport,
  InvestigationRequest,
  InvestigationSeverity,
} from '@app/services/incident-response-agent.service';

@Component({
  selector: 'app-incident-investigation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="investigation">
      <header class="panel-header">
        <div>
          <p class="eyebrow">AI Incident Response Agent</p>
          <h2>Investigation assistée</h2>
          <p>Analyse lecture seule basée sur les logs, RCA et incidents similaires.</p>
        </div>
        <span class="read-only">Lecture seule</span>
      </header>

      <form class="request-form" (ngSubmit)="investigate()" #form="ngForm">
        <label>
          <span>ID incident</span>
          <input name="incidentId" [(ngModel)]="request.incident_id" required />
        </label>
        <label>
          <span>Service</span>
          <input name="service" [(ngModel)]="request.service" required />
        </label>
        <label>
          <span>Sévérité</span>
          <select name="severity" [(ngModel)]="request.severity" required>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label>
          <span>Début</span>
          <input name="startedAt" [(ngModel)]="request.started_at" type="datetime-local" />
        </label>
        <label class="alert-field">
          <span>Alerte</span>
          <textarea name="alert" [(ngModel)]="request.alert" rows="3" required></textarea>
        </label>
        <button type="submit" [disabled]="loading || form.invalid">
          {{ loading ? 'Investigation en cours…' : 'Lancer l’investigation' }}
        </button>
      </form>

      <div *ngIf="error" class="state state-error" role="alert">{{ error }}</div>
      <div *ngIf="loading" class="state" aria-live="polite">Recherche des preuves et analyse déterministe en cours…</div>

      <div *ngIf="report as result" class="report">
        <section class="result-hero" [class.hero-degraded]="result.status === 'degraded'" [class.hero-insufficient]="result.status === 'insufficient_data'">
          <div class="result-copy">
            <div class="result-kicker">RCA déterministe · preuves récupérées</div>
            <h3>{{ rootCauseSummary(result) }}</h3>
            <p *ngIf="isRootCauseSupported(result)">Hypothèse générée à partir des signaux retournés par l’API.</p>
            <p *ngIf="!isRootCauseSupported(result)">Aucune cause racine étayée par les preuves disponibles.</p>
          </div>
          <div *ngIf="hasValidScore(result); else invalidScore" class="confidence" [attr.aria-label]="'Score de confiance ' + confidencePercent(result.confidence) + '%'">
            <span>Score final</span><strong>{{ confidencePercent(result.confidence) }}%</strong>
            <small>Force des signaux, pas une probabilité.</small>
          </div>
          <ng-template #invalidScore><div class="confidence"><span>Score final</span><strong>—</strong><small>Indisponible</small></div></ng-template>
        </section>

        <div class="status-grid">
          <div class="status-card">
            <span>État de l’agent</span>
            <strong [class.status-degraded]="result.status === 'degraded'" [class.status-insufficient]="result.status === 'insufficient_data'">{{ statusLabel(result.status) }}</strong>
          </div>
          <div class="status-card">
            <span>Approbation</span>
            <strong class="approval-value">{{ approvalLabel(result.approval_status) }}</strong>
            <small>{{ result.requires_approval ? 'Validation humaine requise' : 'Aucune validation requise' }}</small>
          </div>
          <div class="status-card">
            <span>Preuves utilisées</span>
            <strong>{{ result.evidence.length }}</strong>
            <small>Éléments retournés par l’API</small>
          </div>
        </div>

        <div *ngIf="result.status === 'insufficient_data'" class="state state-insufficient">
          Données insuffisantes : l’agent ne dispose pas de suffisamment de preuves pour étayer une RCA.
        </div>

        <div class="result-layout">
          <section class="result-card recommendation-card" [class.precaution-card]="isPrecautionaryRecommendation(result)">
            <div class="section-heading"><div><span>Réponse proposée</span><h4>Recommandation</h4></div><span class="read-only">Lecture seule</span></div>
            <p class="recommendation-text">{{ result.recommended_action }}</p>
            <p *ngIf="isPrecautionaryRecommendation(result)" class="precaution">Recommandation de précaution : les éléments disponibles ne permettent pas de proposer une remédiation spécifique.</p>
            <small>Aucune action n’est exécutée depuis cet écran.</small>
          </section>

          <section *ngIf="result.confidence_breakdown as breakdown" class="result-card score-card">
            <div class="section-heading"><div><span>Calcul backend</span><h4>Détail du score</h4></div><strong>{{ breakdown.final_score | number:'1.0-2' }}</strong></div>
            <div class="score-grid">
              <div *ngFor="let item of breakdown.signals" class="score-item">
                <span>{{ confidenceLabel(item.name) }}</span><strong>+{{ item.contribution | number:'1.0-3' }}</strong>
                <small>signal {{ item.value | number:'1.0-2' }} · poids {{ item.weight | number:'1.0-2' }}</small>
              </div>
              <div *ngFor="let item of breakdown.penalties" class="score-item penalty">
                <span>{{ confidenceLabel(item.name) }}</span><strong>{{ item.contribution | number:'1.0-3' }}</strong>
                <small>signal {{ item.value | number:'1.0-2' }} · poids {{ item.weight | number:'1.0-2' }}</small>
              </div>
            </div>
            <p class="score-total">Brut {{ breakdown.raw_score | number:'1.0-3' }} <span>→</span> final {{ breakdown.final_score | number:'1.0-2' }}</p>
          </section>
        </div>

        <section class="result-card evidence-card">
          <div class="section-heading"><div><span>Traçabilité</span><h4>Preuves vérifiées</h4></div><strong>{{ result.evidence.length }}</strong></div>
          <p *ngIf="!result.evidence.length" class="empty">Aucune preuve exploitable n’a été retournée pour cet incident.</p>
          <article *ngFor="let evidence of result.evidence" class="evidence-item">
            <div class="evidence-topline">
              <span class="evidence-type">{{ evidenceLabel(evidence.type) }}</span>
              <span class="evidence-source">{{ evidence.source }}</span>
              <span *ngIf="evidence.relevance !== null && evidence.relevance !== undefined" class="relevance">Pertinence {{ evidence.relevance | percent:'1.0-0' }}</span>
            </div>
            <p>{{ evidence.detail }}</p>
            <div class="evidence-footer"><code>Réf. {{ evidence.reference }}</code><time *ngIf="evidence.timestamp">{{ evidence.timestamp | date:'medium' }}</time></div>
            <details *ngIf="evidence.content">
              <summary>Contenu et métadonnées disponibles</summary>
              <pre>{{ evidence.content }}</pre>
              <pre class="raw-metadata">{{ evidence | json }}</pre>
            </details>
          </article>
        </section>

        <section *ngIf="result.llm_reasoning as reasoning; else llmUnavailable" class="result-card llm-section">
          <div class="section-heading"><div><span>Interprétation séparée</span><h4>Analyse LLM non déterministe</h4></div><span>{{ reasoning.source }}</span></div>
          <p>{{ reasoning.proposed_explanation }}</p>
          <p><strong>Incertitude :</strong> {{ reasoning.uncertainty }}</p>
          <p *ngIf="reasoning.supporting_evidence_references.length"><strong>Références citées :</strong> {{ reasoning.supporting_evidence_references.join(', ') }}</p>
          <p *ngIf="reasoning.unsupported_claims.length" class="warning"><strong>Affirmations non supportées :</strong> {{ reasoning.unsupported_claims.join(' · ') }}</p>
        </section>
        <ng-template #llmUnavailable>
          <section *ngIf="result.degraded_components.includes('llm')" class="result-card llm-warning">
            <div class="section-heading"><div><span>Dépendance dégradée</span><h4>Interprétation LLM indisponible</h4></div></div>
            <p>La RCA et les preuves déterministes restent disponibles ; aucune information LLM n’est présentée comme vérifiée.</p>
          </section>
        </ng-template>

        <section *ngIf="result.degraded_components.length" class="degraded">
          <strong>Dépendances dégradées</strong><span>{{ degradedLabels(result.degraded_components) }}</span>
        </section>
      </div>

      <section class="history-card" *ngIf="history.length">
        <div class="section-heading"><div><span>Traçabilité</span><h4>Historique des investigations</h4></div><strong>{{ history.length }}</strong></div>
        <div class="history-list">
          <div *ngFor="let snapshot of history" class="history-item">
            <div><strong>{{ statusLabel(snapshot.report.status) }}</strong><span>{{ snapshot.created_at | date:'medium' }}</span></div>
            <span>{{ confidencePercent(snapshot.report.confidence) }}% · {{ snapshot.report.evidence.length }} preuves</span>
          </div>
        </div>
        <div class="compare-controls" *ngIf="history.length > 1">
          <label>Référence<select [(ngModel)]="baselineId"><option *ngFor="let snapshot of history" [value]="snapshot._id">{{ snapshot.created_at | date:'short' }}</option></select></label>
          <label>Comparer avec<select [(ngModel)]="candidateId"><option *ngFor="let snapshot of history" [value]="snapshot._id">{{ snapshot.created_at | date:'short' }}</option></select></label>
          <button type="button" (click)="compareHistory()" [disabled]="historyLoading || !baselineId || !candidateId || baselineId === candidateId">Comparer</button>
        </div>
        <div *ngIf="comparison as result" class="comparison-result">
          <span>Score {{ comparisonValue(result.changes.confidence_delta) }}</span>
          <span>Preuves {{ comparisonValue(result.changes.evidence_count_delta) }}</span>
          <span>{{ rootCauseComparisonLabel(result.changes.root_cause_changed) }}</span>
          <span *ngIf="result.changes.new_degraded_components.length">Nouvelles dégradations : {{ degradedLabels(result.changes.new_degraded_components) }}</span>
          <span *ngIf="result.changes.recovered_components.length">Composants rétablis : {{ degradedLabels(result.changes.recovered_components) }}</span>
          <span *ngIf="result.changes.missing_data.length">Données historiques incomplètes : {{ result.changes.missing_data.join(', ') }}</span>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .investigation{display:flex;flex-direction:column;gap:18px}.panel-header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.eyebrow,.result-kicker,.section-heading>div>span{margin:0 0 4px;color:var(--accent);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.panel-header h2{margin:0;font-size:20px;color:var(--text-primary)}.panel-header p{margin:5px 0 0;color:var(--text-muted);font-size:13px}.read-only{padding:5px 8px;border-radius:5px;font-size:11px;font-weight:700;white-space:nowrap;background:rgba(14,165,233,.1);color:var(--accent);border:1px solid rgba(14,165,233,.25)}.request-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:16px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-card)}label{display:flex;flex-direction:column;gap:5px;color:var(--text-muted);font-size:11px;font-weight:700}input,select,textarea{box-sizing:border-box;width:100%;border:1px solid var(--border-default);border-radius:5px;background:var(--bg-input,var(--bg-main));color:var(--text-primary);font:inherit;padding:8px}.alert-field{grid-column:span 3}.request-form button,.compare-controls button{align-self:end;min-height:38px;border:0;border-radius:5px;background:var(--accent);color:#fff;font-weight:700;cursor:pointer;padding:8px 12px}.request-form button:disabled,.compare-controls button:disabled{opacity:.65;cursor:wait}.state{padding:12px;border-radius:6px;background:var(--bg-hover);color:var(--text-muted);font-size:13px}.state-error{background:rgba(239,68,68,.1);color:#ef4444}.state-insufficient{background:rgba(245,158,11,.1);color:#b45309}.report{display:flex;flex-direction:column;gap:14px}.result-hero{display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:18px;padding:18px;border:1px solid rgba(14,165,233,.28);border-left:4px solid var(--accent);border-radius:8px;background:linear-gradient(90deg,rgba(14,165,233,.08),var(--bg-card) 48%)}.hero-degraded{border-left-color:#f59e0b}.hero-insufficient{border-left-color:#ef4444}.result-hero h3{margin:0;color:var(--text-primary);font:600 17px var(--font-mono,monospace);line-height:1.45;word-break:break-word}.result-copy p{margin:7px 0 0;color:var(--text-secondary);font-size:12px}.confidence{display:flex;flex-direction:column;align-items:flex-end;justify-content:center;border-left:1px solid var(--border-subtle);padding-left:16px;text-align:right}.confidence span,.confidence small{font-size:10px;color:var(--text-faint);font-weight:700;text-transform:uppercase;letter-spacing:.05em}.confidence strong{font:700 30px var(--font-mono,monospace);line-height:1.1;color:var(--text-primary)}.confidence small{margin-top:4px;text-transform:none;letter-spacing:0;font-weight:500}.status-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.status-card{min-height:62px;padding:11px 13px;border:1px solid var(--border-subtle);border-radius:7px;background:var(--bg-card);display:flex;flex-direction:column;gap:3px}.status-card>span,.status-card small{font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em}.status-card strong{font-size:13px;color:#16a34a}.status-card .approval-value,.status-degraded,.status-insufficient{color:#b45309}.result-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,1.25fr);gap:14px}.result-card,.history-card{border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-card);padding:15px}.section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:11px;margin-bottom:12px;border-bottom:1px solid var(--border-subtle)}.section-heading h4{margin:0;color:var(--text-primary);font-size:15px}.section-heading>strong{font:700 18px var(--font-mono,monospace);color:var(--accent)}.recommendation-card{border-left:3px solid #22c55e}.precaution-card{border-left-color:#f59e0b}.recommendation-text{margin:0;color:var(--text-primary);font-size:14px;line-height:1.55}.result-card p{color:var(--text-secondary);font-size:13px;line-height:1.55}.result-card small{color:var(--text-faint);font-size:11px}.precaution{color:#b45309!important}.score-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.score-item{padding:9px;border:1px solid var(--border-subtle);border-radius:5px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px;font-size:12px;color:var(--text-secondary)}.score-item strong{color:#16a34a;font-family:var(--font-mono)}.score-item small{grid-column:span 2}.score-item.penalty strong{color:#ef4444}.score-total{margin:11px 0 0!important;font:600 12px var(--font-mono,monospace)!important}.score-total span{color:var(--accent);padding:0 4px}.evidence-card{padding-bottom:4px}.evidence-item{padding:13px 0;border-bottom:1px solid var(--border-subtle)}.evidence-item:last-child{border-bottom:0}.evidence-topline,.evidence-footer{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:11px}.evidence-type{padding:3px 6px;border-radius:4px;background:rgba(14,165,233,.1);color:var(--accent);font-weight:800;text-transform:uppercase}.evidence-source{color:var(--text-muted);font-family:var(--font-mono)}.relevance{margin-left:auto;color:#16a34a;font-weight:800}.evidence-item p{margin:8px 0;color:var(--text-primary);font-size:13px}.evidence-footer{color:var(--text-faint)}.evidence-footer code{font-family:var(--font-mono)}.evidence-footer time{margin-left:auto}details{margin-top:9px;border:1px solid var(--border-subtle);border-radius:5px;background:var(--bg-hover)}summary{padding:8px 10px;color:var(--text-muted);font-size:11px;font-weight:700;cursor:pointer}details pre{margin:0;padding:10px;border-top:1px solid var(--border-subtle);white-space:pre-wrap;word-break:break-word;color:var(--text-secondary);font:11px var(--font-mono,monospace)}details .raw-metadata{color:var(--text-faint)}.empty{color:var(--text-faint)!important}.llm-section{border-left:3px solid #8b5cf6}.llm-warning{border-left:3px solid #f59e0b}.warning{color:#b45309!important}.degraded{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 12px;border:1px solid rgba(245,158,11,.25);border-radius:6px;background:rgba(245,158,11,.09);color:#b45309;font-size:12px}.history-list{display:flex;flex-direction:column;border-bottom:1px solid var(--border-subtle)}.history-item{display:flex;justify-content:space-between;gap:12px;padding:9px 0;font-size:12px;color:var(--text-secondary)}.history-item div{display:flex;flex-direction:column;gap:2px}.history-item strong{color:var(--text-primary)}.history-item span{color:var(--text-faint);font-family:var(--font-mono)}.compare-controls{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;margin-top:14px}.compare-controls label{font-size:10px}.compare-controls select{min-width:0}.comparison-result{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;padding:10px;border-radius:5px;background:rgba(14,165,233,.06);color:var(--text-secondary);font-size:12px}.comparison-result span{padding-right:8px;border-right:1px solid var(--border-subtle)}.comparison-result span:last-child{border:0}@media(max-width:900px){.request-form{grid-template-columns:repeat(2,minmax(0,1fr))}.alert-field{grid-column:span 2}.result-layout{grid-template-columns:1fr}.compare-controls{grid-template-columns:1fr 1fr}}@media(max-width:600px){.panel-header,.result-hero{grid-template-columns:1fr;display:grid}.panel-header{display:flex;flex-direction:column}.request-form,.status-grid,.score-grid,.compare-controls{grid-template-columns:1fr}.alert-field{grid-column:auto}.confidence{align-items:flex-start;text-align:left;border-left:0;border-top:1px solid var(--border-subtle);padding:12px 0 0}.evidence-footer time{margin-left:0}.relevance{margin-left:0}}
  `],
})
export class IncidentInvestigationComponent implements OnChanges {
  @Input() incident: Incident | null = null;

  request: InvestigationRequest = this.emptyRequest();
  report: InvestigationReport | null = null;
  history: InvestigationSnapshot[] = [];
  comparison: InvestigationComparison | null = null;
  baselineId = '';
  candidateId = '';
  historyLoading = false;
  loading = false;
  error = '';

  constructor(private readonly agent: IncidentResponseAgentService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['incident'] && this.incident) {
      this.prefill(this.incident);
      this.loadHistory(this.incident._id);
    }
  }

  investigate(): void {
    this.loading = true;
    this.error = '';
    this.report = null;
    const payload: InvestigationRequest = {
      ...this.request,
      started_at: this.request.started_at ? new Date(this.request.started_at).toISOString() : null,
    };
    this.agent.investigate(payload).subscribe({
      next: report => {
        this.report = report;
        this.loading = false;
        this.loadHistory(report.incident_id);
      },
      error: error => { this.error = error?.message ?? 'Impossible de lancer l’investigation.'; this.loading = false; },
    });
  }

  confidencePercent(value: number): number { return Math.round(value * 100); }

  compareHistory(): void {
    if (!this.incident?._id || !this.baselineId || !this.candidateId || this.baselineId === this.candidateId) return;
    this.historyLoading = true;
    this.agent.compareHistory(this.incident._id, this.baselineId, this.candidateId).subscribe({
      next: comparison => { this.comparison = comparison; this.historyLoading = false; },
      error: error => { this.error = error?.message ?? 'Impossible de comparer les investigations.'; this.historyLoading = false; },
    });
  }

  signed(value: number): string {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
  }

  comparisonValue(value: number | null): string {
    return value === null ? 'non disponible' : this.signed(value);
  }

  rootCauseComparisonLabel(changed: boolean | null): string {
    if (changed === null) return 'RCA non comparable';
    return changed ? 'RCA modifiée' : 'RCA inchangée';
  }

  private loadHistory(incidentId: string): void {
    this.historyLoading = true;
    this.agent.getHistory(incidentId).subscribe({
      next: history => {
        this.history = history.investigations;
        this.baselineId = history.investigations[1]?._id ?? history.investigations[0]?._id ?? '';
        this.candidateId = history.investigations[0]?._id ?? '';
        this.comparison = null;
        this.historyLoading = false;
      },
      error: () => { this.history = []; this.historyLoading = false; },
    });
  }

  hasValidScore(report: InvestigationReport): boolean {
    return Number.isFinite(report.confidence) && report.confidence >= 0 && report.confidence <= 1;
  }

  isRootCauseSupported(report: InvestigationReport): boolean {
    const cause = String(report.root_cause ?? '').trim().toLowerCase();
    return report.evidence.length > 0
      && !!cause
      && !cause.includes('no root-cause signal')
      && !cause.includes('no root cause signal');
  }

  rootCauseSummary(report: InvestigationReport): string {
    return this.isRootCauseSupported(report)
      ? report.root_cause
      : 'Aucune cause racine étayée par les preuves disponibles';
  }

  evidenceLabel(type: string): string {
    return ({ log: 'Log', metric: 'Métrique', similar_incident: 'Incident similaire', rca_signal: 'Signal RCA' } as Record<string, string>)[type] ?? type;
  }

  confidenceLabel(name: string): string {
    return ({
      incident_anomalies: 'Anomalies liées à l’incident',
      retrieved_logs: 'Logs récupérés',
      similar_incidents: 'Incidents similaires',
      evidence_coherence: 'Cohérence des preuves',
      recommendation_alignment: 'Cohérence de la recommandation',
      contradictory_root_cause_evidence: 'Contradictions entre preuves RCA',
      degraded_dependency: 'Dépendance dégradée',
    } as Record<string, string>)[name] ?? name;
  }

  statusLabel(status: InvestigationReport['status']): string {
    return ({ investigated: 'Investigé', degraded: 'Investigé avec dépendance dégradée', insufficient_data: 'Données insuffisantes' })[status];
  }

  approvalLabel(status: InvestigationReport['approval_status']): string {
    return ({ pending: 'en attente', approved: 'approuvée', rejected: 'rejetée' })[status];
  }

  degradedLabels(components: string[]): string {
    const labels: Record<string, string> = { llm: 'LLM', faiss: 'Recherche FAISS', mongodb: 'MongoDB', rca_engine: 'Moteur RCA' };
    return components.map(component => labels[component] ?? component).join(', ');
  }

  isPrecautionaryRecommendation(report: InvestigationReport): boolean {
    const action = report.recommended_action.toLowerCase();
    return report.status === 'insufficient_data'
      || action.includes('no remediation recommendation available')
      || action.includes('no automated actions available')
      || action.includes('manual investigation');
  }

  private prefill(incident: Incident): void {
    const service = incident.platforms?.[0] || 'SMSC';
    const cause = incident.root_cause?.root_causes?.[0]?.[0];
    this.request = {
      incident_id: incident._id,
      service,
      severity: this.toSeverity(incident.severity?.label),
      started_at: this.toLocalDateTime(incident.created_at),
      alert: cause ? `${service} incident: ${cause} detected.` : `Investigation requested for incident ${incident._id}.`,
    };
  }

  private emptyRequest(): InvestigationRequest {
    return { incident_id: '', service: '', alert: '', severity: 'medium', started_at: null };
  }

  private toSeverity(value?: string): InvestigationSeverity {
    const normalized = String(value ?? '').toLowerCase();
    return ['low', 'medium', 'high', 'critical'].includes(normalized)
      ? normalized as InvestigationSeverity : 'medium';
  }

  private toLocalDateTime(value?: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }
}

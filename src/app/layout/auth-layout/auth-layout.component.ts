import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="auth-shell">
      <!-- Background grid décoratif -->
      <div class="bg-grid" aria-hidden="true"></div>

      <!-- Panneau gauche : branding -->
      <aside class="auth-brand">
        <div class="brand-content">
          <div class="brand-logo">
            <img src="assets/images/TelecomAI.png" width="100" height="150" alt="Logo" style="border-radius: 10px; POSITION: relative; top: 50px;  left: -30px;">
            <span class="brand-name">TelecomAI</span>
          </div>
          <h1 class="brand-title">
            Supervision<br>Intelligente<br>des Logs
          </h1>
          <p class="brand-desc">
            Détection d'anomalies proactive · RCA topology-aware ·
            What-If simulator · Copilot IA
          </p>
          <div class="brand-stats">
            <div class="bstat">
              <span class="bstat-val">7.2M</span>
              <span class="bstat-lbl">Logs analysés</span>
            </div>
            <div class="bstat">
              <span class="bstat-val">94</span>
              <span class="bstat-lbl">Clusters</span>
            </div>
            <div class="bstat">
              <span class="bstat-val">8</span>
              <span class="bstat-lbl">Liens causaux</span>
            </div>
          </div>
          <div class="brand-badges">
            <span class="bbadge">Tunisie Télécom</span>
            <span class="bbadge">SICAP</span>
            
          </div>
        </div>
      </aside>

      <!-- Panneau droit : formulaire -->
      <main class="auth-main">
        <router-outlet />
      </main>
    </div>
  `,
  styleUrls: ['./auth-layout.component.scss'],
})
export class AuthLayoutComponent {}
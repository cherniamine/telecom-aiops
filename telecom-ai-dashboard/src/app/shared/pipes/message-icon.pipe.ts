// shared/pipes/message-icon.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'messageIcon',
  standalone: true
})
export class MessageIconPipe implements PipeTransform {
  
  constructor(private sanitizer: DomSanitizer) {}
  
  transform(message: string): SafeHtml {
    if (!message) return this.getSvgIcon('default');
    
    const lowerMsg = message.toLowerCase();
    
    // Déterminer le type d'icône
    let iconType = 'default';
    
    if (lowerMsg.includes('error') || lowerMsg.includes('exception') || lowerMsg.includes('failed')) {
      iconType = 'error';
    } else if (lowerMsg.includes('warning') || lowerMsg.includes('warn')) {
      iconType = 'warning';
    } else if (lowerMsg.includes('timeout')) {
      iconType = 'timeout';
    } else if (lowerMsg.includes('connection') && (lowerMsg.includes('closed') || lowerMsg.includes('reset'))) {
      iconType = 'connection';
    } else if (lowerMsg.includes('connector')) {
      iconType = 'connector';
    } else if (lowerMsg.includes('session')) {
      iconType = 'session';
    } else if (lowerMsg.includes('queue')) {
      iconType = 'queue';
    } else if (lowerMsg.includes('database') || lowerMsg.includes('db')) {
      iconType = 'database';
    } else if (lowerMsg.includes('auth') || lowerMsg.includes('authentication')) {
      iconType = 'auth';
    } else if (lowerMsg.includes('success') || lowerMsg.includes('completed')) {
      iconType = 'success';
    } else if (lowerMsg.includes('network')) {
      iconType = 'network';
    } else if (lowerMsg.includes('security')) {
      iconType = 'security';
    } else if (lowerMsg.includes('performance') || lowerMsg.includes('latency')) {
      iconType = 'performance';
    } else if (lowerMsg.includes('server')) {
      iconType = 'server';
    } else if (lowerMsg.includes('api')) {
      iconType = 'api';
    }
    
    return this.sanitizer.bypassSecurityTrustHtml(this.getSvgIcon(iconType));
  }
  
  private getSvgIcon(type: string): string {
    const icons: Record<string, string> = {
      // ⛔ ERREUR
      error: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="9" r="7.5" stroke="#ef4444" stroke-width="1.4"/>
        <path d="M5.5 5.5L12.5 12.5M12.5 5.5L5.5 12.5" stroke="#ef4444" stroke-width="1.4" stroke-linecap="round"/>
      </svg>`,
      
      // ⚠️ ATTENTION
      warning: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 1.5L16.5 15.5H1.5L9 1.5Z" stroke="#f59e0b" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M9 6.5V10M9 12V12.2" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
      
      // ⏱️ TIMEOUT
      timeout: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="9" r="7.5" stroke="#8b5cf6" stroke-width="1.3"/>
        <path d="M9 4.5V9L11.5 11.5" stroke="#8b5cf6" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      
      // 🔗 CONNEXION
      connection: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2.5 9H15.5M9 2.5V15.5" stroke="#06b6d4" stroke-width="1.3" stroke-linecap="round"/>
        <circle cx="9" cy="9" r="2.5" stroke="#06b6d4" stroke-width="1.3"/>
      </svg>`,
      
      // 🔌 CONNECTEUR
      connector: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2.5" y="4.5" width="4" height="9" rx="1" stroke="#3b82f6" stroke-width="1.3"/>
        <rect x="11.5" y="4.5" width="4" height="9" rx="1" stroke="#3b82f6" stroke-width="1.3"/>
        <path d="M6.5 9H11.5" stroke="#3b82f6" stroke-width="1.3" stroke-linecap="round"/>
      </svg>`,
      
      // 🔒 SESSION
      session: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.5 9V5.5C4.5 3 5.5 2 8 2H10C12.5 2 13.5 3 13.5 5.5V9" stroke="#10b981" stroke-width="1.3" stroke-linecap="round"/>
        <rect x="3" y="9" width="12" height="7" rx="1.5" stroke="#10b981" stroke-width="1.3"/>
        <circle cx="9" cy="12.5" r="1" fill="#10b981"/>
      </svg>`,
      
      // 📋 QUEUE
      queue: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2.5" y="3.5" width="13" height="2.5" rx="0.75" stroke="#f97316" stroke-width="1.3"/>
        <rect x="2.5" y="8" width="9" height="2.5" rx="0.75" stroke="#f97316" stroke-width="1.3"/>
        <rect x="2.5" y="12.5" width="7" height="2.5" rx="0.75" stroke="#f97316" stroke-width="1.3"/>
      </svg>`,
      
      // 🗄️ DATABASE
      database: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="9" cy="4" rx="5.5" ry="1.8" stroke="#a855f7" stroke-width="1.3"/>
        <path d="M3.5 4V9C3.5 10.8 6 12 9 12C12 12 14.5 10.8 14.5 9V4" stroke="#a855f7" stroke-width="1.3"/>
        <path d="M3.5 9V14C3.5 15.8 6 17 9 17C12 17 14.5 15.8 14.5 14V9" stroke="#a855f7" stroke-width="1.3"/>
      </svg>`,
      
      // 🪪 AUTHENTIFICATION
      auth: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4.5 8V5.5C4.5 3 5.5 2 8 2H10C12.5 2 13.5 3 13.5 5.5V8" stroke="#ec4899" stroke-width="1.3" stroke-linecap="round"/>
        <rect x="3" y="8" width="12" height="8" rx="1.5" stroke="#ec4899" stroke-width="1.3"/>
        <path d="M9 11.5V13.5" stroke="#ec4899" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
      
      // ✓ SUCCÈS
      success: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="9" r="7.5" stroke="#22c55e" stroke-width="1.3"/>
        <path d="M5.5 9L8 11.5L12.5 6" stroke="#22c55e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      
      // 🌐 RÉSEAU
      network: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="3.5" r="1.8" stroke="#14b8a6" stroke-width="1.2"/>
        <circle cx="9" cy="14.5" r="1.8" stroke="#14b8a6" stroke-width="1.2"/>
        <circle cx="3.5" cy="9" r="1.8" stroke="#14b8a6" stroke-width="1.2"/>
        <circle cx="14.5" cy="9" r="1.8" stroke="#14b8a6" stroke-width="1.2"/>
        <path d="M9 5.3V7.5M9 10.5V12.7M5.3 9H7.5M10.5 9H12.7" stroke="#14b8a6" stroke-width="1.2" stroke-linecap="round"/>
      </svg>`,
      
      // 🛡️ SÉCURITÉ
      security: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 2L3.5 4.5V9C3.5 12.5 9 16 9 16C9 16 14.5 12.5 14.5 9V4.5L9 2Z" stroke="#f43f5e" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M9 6.5V10M9 11.5V11.7" stroke="#f43f5e" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
      
      // ⚡ PERFORMANCE
      performance: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2.5 15.5L7 11L10.5 13L15.5 7" stroke="#eab308" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="2.5" cy="15.5" r="1.2" fill="#eab308" stroke="#eab308" stroke-width="0.8"/>
        <circle cx="7" cy="11" r="1.2" fill="#eab308" stroke="#eab308" stroke-width="0.8"/>
        <circle cx="10.5" cy="13" r="1.2" fill="#eab308" stroke="#eab308" stroke-width="0.8"/>
        <circle cx="15.5" cy="7" r="1.2" fill="#eab308" stroke="#eab308" stroke-width="0.8"/>
      </svg>`,
      
      // 🖥️ SERVEUR
      server: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2.5" y="3.5" width="13" height="4" rx="1" stroke="#6b7280" stroke-width="1.3"/>
        <rect x="2.5" y="10.5" width="13" height="4" rx="1" stroke="#6b7280" stroke-width="1.3"/>
        <circle cx="13" cy="5.5" r="0.8" fill="#6b7280"/>
        <circle cx="13" cy="12.5" r="0.8" fill="#6b7280"/>
      </svg>`,
      
      // 🔌 API
      api: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 5.5L2.5 9L6 12.5" stroke="#6366f1" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 5.5L15.5 9L12 12.5" stroke="#6366f1" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10.5 3L7.5 15" stroke="#6366f1" stroke-width="1.3" stroke-linecap="round"/>
      </svg>`,
      
      // 📄 DÉFAUT
      default: `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 2.5V15.5M2.5 9H15.5" stroke="#94a3b8" stroke-width="1.3" stroke-linecap="round"/>
        <circle cx="9" cy="9" r="1.8" fill="#94a3b8" stroke="#94a3b8" stroke-width="1"/>
      </svg>`
    };
    
    return icons[type] || icons['default'];
  }
}
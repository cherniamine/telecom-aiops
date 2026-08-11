// shared/pipes/format-noc-message.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'formatNocMessage',
  standalone: true
})
export class FormatNocMessagePipe implements PipeTransform {
  
  constructor(private sanitizer: DomSanitizer) {}
  
  transform(message: string, asHtml: boolean = false): string | SafeHtml {
    if (!message) return '';
    
    let formatted = message;
    
    // 1. Nettoyer les préfixes techniques
    formatted = formatted.replace(/^-- ::,?\s*/, '');
    formatted = formatted.replace(/\[\w+--\]\s*/, '');
    formatted = formatted.replace(/\s+(info|debug|warn|error)\s+domain\.\w+\.\w+\s*-\s*/i, ' ');
    
    // 2. Formater selon le contenu avec des SVG
    if (formatted.includes('poststatus:connector:')) {
      const connector = formatted.match(/poststatus:connector:(\w+)/)?.[1] || 'inconnu';
      formatted = this.addSvgIcon('connector') + ` Mise à jour statut connecteur: ${connector.toUpperCase()}`;
    }
    else if (formatted.includes('getconnectorstatus:connector:')) {
      const connector = formatted.match(/getconnectorstatus:connector:(\w+)/)?.[1] || 'inconnu';
      formatted = this.addSvgIcon('check') + ` Vérification connecteur: ${connector.toUpperCase()}`;
    }
    else if (formatted.match(/connection was closed|connection isn't alive/i)) {
      formatted = this.addSvgIcon('connection') + ` Connexion fermée - sera arrêtée`;
    }
    else if (formatted.match(/error|exception|failed/i) && !formatted.includes('⚠️')) {
      formatted = this.addSvgIcon('error') + ` ${formatted}`;
    }
    else if (formatted.match(/timeout/i)) {
      formatted = this.addSvgIcon('timeout') + ` Délai dépassé - ${formatted}`;
    }
    else if (formatted.match(/refused|reject/i)) {
      formatted = this.addSvgIcon('refused') + ` Connexion refusée - ${formatted}`;
    }
    else if (formatted.match(/success|completed|successfully/i)) {
      formatted = this.addSvgIcon('success') + ` ${formatted}`;
    }
    else if (formatted.match(/warning|warn/i)) {
      formatted = this.addSvgIcon('warning') + ` ${formatted}`;
    }
    
    // 3. Nettoyer les doublons d'espaces
    formatted = formatted.replace(/\s+/g, ' ').trim();
    
    // 4. Tronquer si trop long (garder l'essentiel)
    if (formatted.length > 100 && !asHtml) {
      formatted = formatted.substring(0, 97) + '...';
    }
    
    if (asHtml) {
      return this.sanitizer.bypassSecurityTrustHtml(formatted);
    }
    
    // Version texte (sans HTML)
    return formatted.replace(/<svg[^>]*>.*?<\/svg>/g, '');
  }
  
  private addSvgIcon(type: string): string {
    const icons: Record<string, string> = {
      connector: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block; vertical-align:middle; margin-right:4px;">
        <rect x="2" y="4" width="3" height="7" rx="0.8" stroke="#3b82f6" stroke-width="1.2"/>
        <rect x="9" y="4" width="3" height="7" rx="0.8" stroke="#3b82f6" stroke-width="1.2"/>
        <path d="M5 7.5H9" stroke="#3b82f6" stroke-width="1.2" stroke-linecap="round"/>
      </svg>`,
      
      check: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block; vertical-align:middle; margin-right:4px;">
        <circle cx="7" cy="7" r="6" stroke="#06b6d4" stroke-width="1.2"/>
        <path d="M4.5 7L6.5 9L9.5 5" stroke="#06b6d4" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      
      connection: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block; vertical-align:middle; margin-right:4px;">
        <path d="M2 7H12M7 2V12" stroke="#f97316" stroke-width="1.2" stroke-linecap="round"/>
        <circle cx="7" cy="7" r="2" stroke="#f97316" stroke-width="1.2"/>
      </svg>`,
      
      error: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block; vertical-align:middle; margin-right:4px;">
        <circle cx="7" cy="7" r="6" stroke="#ef4444" stroke-width="1.2"/>
        <path d="M4.5 4.5L9.5 9.5M9.5 4.5L4.5 9.5" stroke="#ef4444" stroke-width="1.2" stroke-linecap="round"/>
      </svg>`,
      
      timeout: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block; vertical-align:middle; margin-right:4px;">
        <circle cx="7" cy="7" r="6" stroke="#8b5cf6" stroke-width="1.2"/>
        <path d="M7 3.5V7L9 9" stroke="#8b5cf6" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      
      refused: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block; vertical-align:middle; margin-right:4px;">
        <circle cx="7" cy="7" r="6" stroke="#ef4444" stroke-width="1.2"/>
        <path d="M4 4L10 10" stroke="#ef4444" stroke-width="1.2" stroke-linecap="round"/>
        <path d="M10 4L4 10" stroke="#ef4444" stroke-width="1.2" stroke-linecap="round"/>
      </svg>`,
      
      success: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block; vertical-align:middle; margin-right:4px;">
        <circle cx="7" cy="7" r="6" stroke="#22c55e" stroke-width="1.2"/>
        <path d="M4.5 7L6.5 9L9.5 5" stroke="#22c55e" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
      
      warning: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block; vertical-align:middle; margin-right:4px;">
        <path d="M7 1.5L12.5 12H1.5L7 1.5Z" stroke="#f59e0b" stroke-width="1.1" stroke-linejoin="round"/>
        <path d="M7 5V8M7 9.5V9.7" stroke="#f59e0b" stroke-width="1.2" stroke-linecap="round"/>
      </svg>`
    };
    
    return icons[type] || '';
  }
}
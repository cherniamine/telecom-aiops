// ───────────────────────────────────────────────────────────────────────────────
// UTILS / severity.utils.ts
// ───────────────────────────────────────────────────────────────────────────────
 
export interface SeverityConfig {
  label:       string;
  // Tailwind classes
  bgClass:     string;       // ex: "bg-red-500/10"
  textClass:   string;       // ex: "text-red-500"
  borderClass: string;       // ex: "border-red-500/30"
  dotClass:    string;       // ex: "bg-red-500"
  badgeClass:  string;       // combined for badge element
  // CSS hex values (pour Chart.js, D3, inline styles)
  color:       string;
  colorLight:  string;       // version 20% opacity
  colorBorder: string;       // version 40% opacity
  // Comportement UI
  pulse:       boolean;
  priority:    number;       // 4=CRITICAL, 3=HIGH, 2=MEDIUM, 1=LOW, 0=UNKNOWN
  icon:        string;       // SVG path
}
 
export const SEVERITY_CONFIG: Record<string, SeverityConfig> = {
  CRITICAL: {
    label:       'CRITICAL',
    bgClass:     'bg-red-500/10',
    textClass:   'text-red-500',
    borderClass: 'border-red-500/30',
    dotClass:    'bg-red-500',
    badgeClass:  'bg-red-500/10 text-red-500 border border-red-500/30',
    color:       '#ef4444',
    colorLight:  'rgba(239,68,68,0.12)',
    colorBorder: 'rgba(239,68,68,0.4)',
    pulse:       true,
    priority:    4,
    icon: `<path d="M9 2L16 14H2L9 2z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
           <path d="M9 7v4M9 12.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  },
  HIGH: {
    label:       'HIGH',
    bgClass:     'bg-amber-500/10',
    textClass:   'text-amber-500',
    borderClass: 'border-amber-500/30',
    dotClass:    'bg-amber-500',
    badgeClass:  'bg-amber-500/10 text-amber-500 border border-amber-500/30',
    color:       '#f59e0b',
    colorLight:  'rgba(245,158,11,0.12)',
    colorBorder: 'rgba(245,158,11,0.4)',
    pulse:       true,
    priority:    3,
    icon: `<circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.4"/>
           <path d="M9 6v3.5M9 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  },
  MEDIUM: {
    label:       'MEDIUM',
    bgClass:     'bg-blue-500/10',
    textClass:   'text-blue-500',
    borderClass: 'border-blue-500/30',
    dotClass:    'bg-blue-500',
    badgeClass:  'bg-blue-500/10 text-blue-500 border border-blue-500/30',
    color:       '#3b82f6',
    colorLight:  'rgba(59,130,246,0.12)',
    colorBorder: 'rgba(59,130,246,0.4)',
    pulse:       false,
    priority:    2,
    icon: `<circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.4"/>
           <path d="M9 8v5M9 6v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  },
  LOW: {
    label:       'LOW',
    bgClass:     'bg-green-500/10',
    textClass:   'text-green-500',
    borderClass: 'border-green-500/30',
    dotClass:    'bg-green-500',
    badgeClass:  'bg-green-500/10 text-green-500 border border-green-500/30',
    color:       '#22c55e',
    colorLight:  'rgba(34,197,94,0.12)',
    colorBorder: 'rgba(34,197,94,0.4)',
    pulse:       false,
    priority:    1,
    icon: `<circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.4"/>
           <path d="M6 9l2.5 2.5 3.5-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  UNKNOWN: {
    label:       'UNKNOWN',
    bgClass:     'bg-slate-500/10',
    textClass:   'text-slate-400',
    borderClass: 'border-slate-500/20',
    dotClass:    'bg-slate-400',
    badgeClass:  'bg-slate-500/10 text-slate-400 border border-slate-500/20',
    color:       '#94a3b8',
    colorLight:  'rgba(148,163,184,0.1)',
    colorBorder: 'rgba(148,163,184,0.3)',
    pulse:       false,
    priority:    0,
    icon: `<circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.4"/>
           <path d="M9 6v.5M9 9v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
  },
};
 
/** Retourne la config de sévérité (fallback UNKNOWN) */
export function getSeverityConfig(severity: string | null | undefined): SeverityConfig {
  return SEVERITY_CONFIG[(severity ?? '').toUpperCase()] ?? SEVERITY_CONFIG['UNKNOWN'];
}
 
/** Retourne la couleur hex d'une sévérité */
export function getSeverityColor(severity: string | null | undefined): string {
  return getSeverityConfig(severity).color;
}
 
/** Retourne la couleur légère (bg) d'une sévérité */
export function getSeverityColorLight(severity: string | null | undefined): string {
  return getSeverityConfig(severity).colorLight;
}
 
/** Trie un tableau d'objets par sévérité décroissante */
export function sortBySeverity<T extends { severity?: string | { label?: string } }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const sa = typeof a.severity === 'string' ? a.severity : (a.severity as any)?.label ?? '';
    const sb = typeof b.severity === 'string' ? b.severity : (b.severity as any)?.label ?? '';
    return (getSeverityConfig(sb).priority) - (getSeverityConfig(sa).priority);
  });
}
 
/** Couleur Tailwind hex par plateforme télécom */
export const PLATFORM_COLORS: Record<string, string> = {
  MMG:   '#d97706',
  SMSC:  '#dc2626',
  SMPPS: '#2563eb',
  SMPPC: '#4f46e5',
  DMC:   '#16a34a',
};
 
export function getPlatformColor(platform: string): string {
  return PLATFORM_COLORS[(platform ?? '').toUpperCase()] ?? '#64748b';
}
 
/** Classe Tailwind complète pour un badge de plateforme */
export function getPlatformBadgeClass(platform: string): string {
  const map: Record<string, string> = {
    MMG:   'bg-amber-500/12 text-amber-600',
    SMSC:  'bg-red-500/12 text-red-600',
    SMPPS: 'bg-blue-500/12 text-blue-600',
    SMPPC: 'bg-violet-500/12 text-violet-600',
    DMC:   'bg-green-500/12 text-green-700',
  };
  return map[(platform ?? '').toUpperCase()] ?? 'bg-slate-500/10 text-slate-500';
}
 
/** Vérifie si une sévérité est critique ou haute (nécessite action immédiate) */
export function isHighPriority(severity: string | null | undefined): boolean {
  return ['CRITICAL', 'HIGH'].includes((severity ?? '').toUpperCase());
}
 
/** Retourne un libellé lisible pour le SLA */
export function getSlaStatus(compliance: number): { label: string; class: string } {
  if (compliance >= 95) return { label: '✅ Excellent',  class: 'text-green-500' };
  if (compliance >= 80) return { label: '⚠️ À améliorer', class: 'text-amber-500' };
  return                       { label: '🔴 Non conforme', class: 'text-red-500'  };
}
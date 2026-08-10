// ───────────────────────────────────────────────────────────────────────────────
// UTILS / date.utils.ts
// ───────────────────────────────────────────────────────────────────────────────
 
/** Parse une date ISO ou Date, retourne null si invalide */
export function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}
 
/** Formate une date en "dd/MM/yyyy HH:mm" */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  if (!d) return '—';
  return d.toLocaleString('fr-FR', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}
 
/** Formate une date en "dd/MM/yyyy" */
export function formatDate(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
 
/** Retourne le temps écoulé en français */
export function timeAgo(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  if (!d) return '—';
 
  const diffMs  = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
 
  if (diffSec < 5)     return 'à l\'instant';
  if (diffSec < 60)    return `il y a ${diffSec}s`;
  if (diffSec < 3600)  return `il y a ${Math.floor(diffSec / 60)}min`;
  if (diffSec < 86400) return `il y a ${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 604800) return `il y a ${Math.floor(diffSec / 86400)}j`;
 
  return formatDate(d);
}
 
/** Formate une durée en minutes → "1h 30min" ou "45min" */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h   = Math.floor(minutes / 60);
  const min = minutes % 60;
  return min > 0 ? `${h}h ${min}min` : `${h}h`;
}
 
/** Formate un nombre avec séparateur de milliers */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return value.toLocaleString('fr-FR');
}
 
/** Retourne la date de début de la journée courante (minuit) */
export function startOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
 
/** Retourne la date de début du mois courant */
export function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}
 
/** Retourne un label de période : "il y a 3 jours" ou date formatée */
export function getPeriodLabel(from: Date, to = new Date()): string {
  const diffDays = Math.floor((to.getTime() - from.getTime()) / 86_400_000);
  if (diffDays === 0)  return 'Aujourd\'hui';
  if (diffDays === 1)  return 'Hier';
  if (diffDays <= 7)   return `7 derniers jours`;
  if (diffDays <= 30)  return `30 derniers jours`;
  return `${formatDate(from)} — ${formatDate(to)}`;
}
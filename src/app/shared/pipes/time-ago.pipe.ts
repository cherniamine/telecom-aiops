import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timeAgo',
  standalone: true,
  pure: false,
})
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) return '—';

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);

    if (diffSec < 5) return 'à l\'instant';
    if (diffSec < 60) return `il y a ${diffSec}s`;
    if (diffSec < 3600) return `il y a ${Math.floor(diffSec / 60)}min`;
    if (diffSec < 86400) return `il y a ${Math.floor(diffSec / 3600)}h`;
    if (diffSec < 604800) return `il y a ${Math.floor(diffSec / 86400)}j`;

    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }
}

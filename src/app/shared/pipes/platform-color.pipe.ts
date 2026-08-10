import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'platformColor',
  standalone: true,
})
export class PlatformColorPipe implements PipeTransform {
  private readonly colors: Record<string, string> = {
    mmg: '#d97706',
    smsc: '#dc2626',
    smpps: '#2563eb',
    smppc: '#4f46e5',
    dmc: '#16a34a',
  };

  transform(platform: string): string {
    return this.colors[(platform ?? '').toLowerCase()] ?? '#64748b';
  }
}

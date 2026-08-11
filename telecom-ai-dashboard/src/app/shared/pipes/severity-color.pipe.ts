import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'severityColor',
  standalone: false,
})
export class SeverityColorPipe implements PipeTransform {

  transform(value: string): string {

    switch (value) {

      case 'CRITICAL':
        return 'red';

      case 'HIGH':
        return 'orange';

      case 'MEDIUM':
        return 'blue';

      case 'LOW':
        return 'green';

      default:
        return 'grey';

    }

  }

}
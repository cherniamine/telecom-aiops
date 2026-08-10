// shared/pipes/extract-connector.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'extractConnector',
  standalone: true
})
export class ExtractConnectorPipe implements PipeTransform {
  
  transform(message: string): string | null {
    if (!message) return null;
    
    const patterns = [
      /connector:(\w+)/i,
      /poststatus:connector:(\w+)/i,
      /getconnectorstatus:connector:(\w+)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].toUpperCase();
      }
    }
    
    return null;
  }
}
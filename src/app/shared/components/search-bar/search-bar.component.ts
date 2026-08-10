import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  forwardRef,
  Input,
  Output,
} from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIf],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => SearchBarComponent),
    multi: true,
  }],
  template: `
    <div class="search-wrap" [class.focused]="focused">
      <svg class="search-icon" width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.4"/>
        <path d="M10.5 10.5l3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>

      <input
        class="search-input"
        [type]="type"
        [placeholder]="placeholder"
        [disabled]="disabled"
        [(ngModel)]="value"
        (ngModelChange)="onInput($event)"
        (focus)="focused = true"
        (blur)="focused = false; onTouched()"
        (keydown.enter)="searchSubmit.emit(value)"
        [attr.aria-label]="placeholder"
      />

      <button class="clear-btn" *ngIf="value && !disabled" (click)="clear()" type="button" aria-label="Effacer">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M2 2l9 9M11 2L2 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </button>

      <div class="search-kbd" *ngIf="showKbd && !value">
        <kbd>⌘K</kbd>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .search-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      height: 36px;
      border: 1px solid var(--border-subtle, #e2e8f0);
      border-radius: 8px;
      background: var(--bg-input, #f8fafc);
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }

    .search-wrap.focused {
      border-color: var(--accent, #0ea5e9);
      box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
      background: var(--bg-card, #fff);
    }

    .search-icon { color: var(--text-muted, #64748b); flex-shrink: 0; }

    .search-input {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 13px;
      color: var(--text-primary, #0f172a);
      font-family: var(--font-sans, sans-serif);
      outline: none;
      min-width: 0;
    }

    .search-input::placeholder { color: var(--text-faint, #94a3b8); }
    .search-input:disabled { cursor: not-allowed; opacity: 0.6; }

    .clear-btn {
      background: none;
      border: none;
      color: var(--text-muted, #64748b);
      cursor: pointer;
      padding: 0;
      line-height: 1;
      transition: color 150ms ease;
      flex-shrink: 0;
    }

    .clear-btn:hover { color: var(--text-primary, #0f172a); }

    .search-kbd kbd {
      font-size: 10px;
      padding: 2px 5px;
      border: 1px solid var(--border-subtle, #e2e8f0);
      border-radius: 4px;
      color: var(--text-faint, #94a3b8);
      font-family: var(--font-mono, monospace);
      background: var(--bg-hover, rgba(0, 0, 0, 0.04));
      pointer-events: none;
    }
  `],
})
export class SearchBarComponent implements ControlValueAccessor {
  @Input() placeholder = 'Rechercher...';
  @Input() type = 'text';
  @Input() disabled = false;
  @Input() showKbd = false;

  @Output() searchSubmit = new EventEmitter<string>();
  @Output() valueChange = new EventEmitter<string>();

  value = '';
  focused = false;

  private onChange = (_: string) => {};
  onTouched = () => {};

  writeValue(value: string): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
  }

  onInput(value: string): void {
    this.onChange(value);
    this.valueChange.emit(value);
  }

  clear(): void {
    this.value = '';
    this.onChange('');
    this.valueChange.emit('');
    this.searchSubmit.emit('');
  }
}

import { Directive, HostListener } from '@angular/core';

@Directive({
  selector: 'input[appNumbersOnly]',
  standalone: true,
})
export class NumbersOnlyDirective {
  // List of keys to allow (navigation, deletion, editing shortcuts)
  private allowedKeys: string[] = [
    'Backspace',
    'Delete',
    'Tab',
    'Escape',
    'Enter',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
  ];

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    // Allow control system keys
    if (this.allowedKeys.indexOf(event.key) !== -1) {
      return;
    }

    // Allow standard copy, paste, select shortcuts (Ctrl/Cmd + A, C, V, X)
    if (event.ctrlKey || event.metaKey) {
      return;
    }

    // Block the key if it is not a digit (0-9)
    const isDigit = /^[0-9.]$/.test(event.key);
    if (!isDigit) {
      event.preventDefault();
    }
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent) {
    // Handle context menu pasting of bad text
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const pastedText = clipboardData.getData('text');
    // If the pasted string contains anything other than digits, block the paste
    if (!/^\d+$/.test(pastedText)) {
      event.preventDefault();
    }
  }
}

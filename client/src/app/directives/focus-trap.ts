import {
  Directive,
  ElementRef,
  AfterViewInit,
  HostListener,
  inject,
  OnDestroy,
} from '@angular/core';

@Directive({
  selector: '[appFocusTrap]',
  standalone: true,
})
export class FocusTrapDirective implements AfterViewInit, OnDestroy {
  private el = inject(ElementRef);
  private previouslyFocusedElement: HTMLElement | null = null;

  ngAfterViewInit(): void {
    // Cache the active element in the background so we can restore focus when the modal closes
    this.previouslyFocusedElement = document.activeElement as HTMLElement;

    // Run on a slight macro-task delay to ensure the DOM is painted and visible
    setTimeout(() => {
      this.focusFirstElement();
    }, 50);
  }

  ngOnDestroy(): void {
    // Restore focus to the background page element upon modal closure
    if (this.previouslyFocusedElement) {
      try {
        this.previouslyFocusedElement.focus();
      } catch (e) {
        console.warn('Failed to restore background focus:', e);
      }
    }
  }

  @HostListener('keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }

    const focusables = this.getFocusableElements();
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement;

    if (event.shiftKey) {
      // Backward tab navigation (Shift + Tab)
      if (active === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      // Forward tab navigation (Tab)
      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  private focusFirstElement(): void {
    const focusables = this.getFocusableElements();
    if (focusables.length > 0) {
      // Prefer focusing input fields, textareas, and selects over close buttons on open
      const firstInput = focusables.find(
        (el) =>
          el.tagName.toLowerCase() === 'input' ||
          el.tagName.toLowerCase() === 'textarea' ||
          el.tagName.toLowerCase() === 'select',
      );

      if (firstInput) {
        firstInput.focus();
      } else {
        focusables[0].focus();
      }
    }
  }

  private getFocusableElements(): HTMLElement[] {
    const host = this.el.nativeElement as HTMLElement;
    const selector =
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href], [tabindex="0"]:not([disabled])';
    const rawList = Array.from(host.querySelectorAll(selector)) as HTMLElement[];

    // Filter out hidden elements, closed modal assets, and elements with tabindex="-1"
    return rawList.filter((el) => {
      const style = window.getComputedStyle(el);
      const isVisible =
        el.offsetWidth > 0 &&
        el.offsetHeight > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden';
      const hasValidTabIndex = el.getAttribute('tabindex') !== '-1';
      return isVisible && hasValidTabIndex;
    });
  }
}

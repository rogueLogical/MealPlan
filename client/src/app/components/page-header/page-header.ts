import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, Event } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-header.html',
  styleUrls: ['./page-header.scss'],
})
export class PageHeader implements OnInit {
  currentTitle = 'Home';
  currentIcon = '🏠';

  // Mapping matrix translating URL routes to friendly text and icons
  private routeMap: Record<string, { title: string; icon: string }> = {
    home: { title: 'Home', icon: '🏠' },
    meals: { title: 'Meals Planner', icon: '📅' },
    recipes: { title: 'Recipes Library', icon: '🍳' },
    groceries: { title: 'Grocery List', icon: '🛒' },
    settings: { title: 'Settings', icon: '⚙️' },
  };

  private router = inject(Router);

  private titleService = inject(Title);
  ngOnInit(): void {
    // Parse initial title on first component load
    this.updateHeaderTitle(this.router.url);

    // Listen to active router changes continuously
    this.router.events
      .pipe(filter((event: Event) => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.updateHeaderTitle(event.urlAfterRedirects || event.url);
      });
  }

  private updateHeaderTitle(url: string): void {
    // Extract the active sub-path (e.g., matching /meals out of http://.../meals)
    const segment = url.split('/').pop() || '';

    if (this.routeMap[segment]) {
      this.currentTitle = this.routeMap[segment].title;
      this.currentIcon = this.routeMap[segment].icon;
      this.titleService.setTitle(this.routeMap[segment].title + ' | MealPlan');
    } else {
      // Default fallback
      this.currentTitle = 'Home';
      this.currentIcon = '🏠';
    }
  }
}

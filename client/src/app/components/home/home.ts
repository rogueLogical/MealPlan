import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { PageHeader } from '../page-header/page-header';

// this is the main component for the entire application
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, PageHeader ],
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class Home implements OnInit {
  title: string = 'MealPlan';
  activeTab: string = 'Home';
  isDarkMode: boolean = false;
  isMenuCollapsed: boolean = true; 

  menuItems = [
    { name: 'Home', icon: '🏠', path: 'home' },
    { name: 'Meal Prep Planner', icon: '📅', path: 'meals' },
    { name: 'Recipes Library', icon: '🍳', path: 'recipes' },
    { name: 'Grocery List', icon: '🛒', path: 'groceries' },
    { name: 'Settings', icon: '⚙️', path: 'settings' }
  ];

  ngOnInit(): void {
    // Sync Angular state flag with the root HTML element class state
    if (document.documentElement.classList.contains('dark-mode')) {
      this.isDarkMode = true;
    }
  }

  // if dark mode is toggled in any other tab, apply to all tags
  @HostListener('window:storage', ['$event'])
  onStorageChange(event: StorageEvent): void {
    if (event.key === 'theme') {
      if (event.newValue === 'dark') {
        this.isDarkMode = true;
        document.documentElement.classList.add('dark-mode');
      } else {
        this.isDarkMode = false;
        document.documentElement.classList.remove('dark-mode');
      }
    }
  }

  // function to toggle dark mode / light mode
  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    
    if (this.isDarkMode) {
      document.documentElement.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  }

  // function to open or collapse menu bar in mobile mode
  toggleMenu(): void {
    this.isMenuCollapsed = !this.isMenuCollapsed;
  }

  selectTab(tabName: string): void {
    this.activeTab = tabName;
    this.isMenuCollapsed = true; // Auto-hide menu tray after clicking an option on mobile
  }
}

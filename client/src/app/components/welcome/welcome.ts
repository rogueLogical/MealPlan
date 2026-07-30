import { Component, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './welcome.html',
  styleUrls: ['./welcome.scss'],
})
export class Welcome implements OnInit {
  isDarkMode = false;
  private titleService = inject(Title);

  features = [
    {
      icon: '🎯',
      title: 'Precision Macro Balancing',
      description:
        'Scale recipe ingredients automatically with mathematical optimization to hit your precise protein, fat, and net carb targets per meal.',
    },
    {
      icon: '🗓️',
      title: 'Meal Prep Planning',
      description:
        'Schedule your favorite recipes across weekly prep cycles, calculate required batch portions, and track completion progress with an interactive checklist.',
    },
    {
      icon: '🛒',
      title: 'Consolidated Shopping Lists',
      description:
        'Automatically aggregate and sum ingredients across multiple planned recipes into a single, customizeabile shopping list.',
    },
    {
      icon: '📦',
      title: 'Portion Storage Tracker',
      description:
        'Keep exact counts of cooked meals stored in your fridge or freezer, and log consumption in one click as you eat throughout the week.',
    },
    {
      icon: '🧑‍🍳',
      title: 'AI Recipe Generation',
      description:
        'Transform text prompts into fully structured recipes, with USDA-verified ingredient information tailored to your personal dietary restrictions and nutritional targets.',
    },
    {
      icon: '🥗',
      title: 'Personalized Nutrition Goals',
      description:
        'Set custom daily nutrition targets, macro split ratios, liked/disliked ingredients, and lifestyle restrictions like Keto, Vegan, or Gluten-Free.',
    },
  ];

  ngOnInit(): void {
    if (document.documentElement.classList.contains('dark-mode')) {
      this.isDarkMode = true;
    }
    this.titleService.setTitle('Welcome to MealPlan | Smart Meal Prep & Macro Tracking');
  }

  @HostListener('window:storage', ['$event'])
  onStorageChange(event: StorageEvent): void {
    if (event.key === 'theme') {
      this.isDarkMode = event.newValue === 'dark';
      if (this.isDarkMode) {
        document.documentElement.classList.add('dark-mode');
      } else {
        document.documentElement.classList.remove('dark-mode');
      }
    }
  }

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
}

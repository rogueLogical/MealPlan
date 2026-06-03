import { Routes } from '@angular/router';
import { Home } from './components/home/home';
import { Login } from './components/login/login';
import { authGuard } from './guards/auth-guard';
import { Overview } from './components/overview/overview';
import { MealsPlanner } from './components/meals-planner/meals-planner';
import { RecipesLibrary } from './components/recipes-library/recipes-library';
import { GroceryList } from './components/grocery-list/grocery-list';
import { Settings } from './components/settings/settings';

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: '',
    component: Home,
    canActivate: [authGuard],
    children: [
      { path: 'home', component: Overview },
      { path: 'meals', component: MealsPlanner },
      { path: 'recipes', component: RecipesLibrary },
      { path: 'groceries', component: GroceryList },
      { path: 'settings', component: Settings },
      { path: '', redirectTo: 'home', pathMatch: 'full' }, // Default dashboard view
    ],
  },
  { path: '**', redirectTo: 'login' }, // Global fallback catch-all
];

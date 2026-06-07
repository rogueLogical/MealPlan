import { Routes } from '@angular/router';
import { Home } from './components/home/home';
import { Login } from './components/login/login';
import { authGuard } from './guards/auth-guard';
import { guestGuard } from './guards/guest-guard';
import { Overview } from './components/overview/overview';
import { MealsPlanner } from './components/meals-planner/meals-planner';
import { RecipesLibrary } from './components/recipes-library/recipes-library';
import { GroceryList } from './components/grocery-list/grocery-list';
import { Settings } from './components/settings/settings';
import { Register } from './components/register/register';
import { ForgotPassword } from './components/forgot-password/forgot-password';

export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [guestGuard] },
  { path: 'register', component: Register, canActivate: [guestGuard] },
  { path: 'forgot-password', component: ForgotPassword, canActivate: [guestGuard] },
  { path: 'reset-password', component: ForgotPassword, canActivate: [guestGuard] },
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

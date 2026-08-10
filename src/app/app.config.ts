import { ApplicationConfig } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
  withRouterConfig,
  withInMemoryScrolling,
} from '@angular/router';
import {
  provideHttpClient,
  withInterceptors,
  withFetch,
} from '@angular/common/http';
import { provideAnimations }   from '@angular/platform-browser/animations';
import { authInterceptor }     from './core/interceptors/auth.interceptor';
import { loadingInterceptor }  from './core/interceptors/loading.interceptor';
import { APP_ROUTES } from './app-routing.module';
 
export const appConfig: ApplicationConfig = {
  providers: [
    // Router
    provideRouter(
      APP_ROUTES,
      withComponentInputBinding(),          // route params → @Input()
      withViewTransitions(),                 // smooth page transitions
      withRouterConfig({ onSameUrlNavigation: 'reload' }),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
 
    // HTTP + interceptors
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, loadingInterceptor]),
    ),
 
    // Animations (needed for some Angular Material components if used)
    provideAnimations(),
  ],
};

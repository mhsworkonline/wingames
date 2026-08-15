import './styles.css';
import { App } from './ui/app';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('#app root element is missing');

const app = new App(root);

declare global {
  interface Window {
    wingames: ReturnType<App['testApi']>;
  }
}

// Exposed for Playwright: lets tests build deterministic positions.
window.wingames = app.testApi();

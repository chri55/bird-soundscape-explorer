# Error Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a React error boundary that catches unhandled render errors and shows a user-friendly fallback instead of a blank white screen.

**Architecture:** One class component (`ErrorBoundary`) wrapping `<App />` in `main.tsx`. If any descendant throws during render, it catches the error and renders a centered "Something went wrong — try refreshing" UI with a Refresh button.

**Tech Stack:** React 19 class component (`getDerivedStateFromError` + `componentDidCatch`), React Testing Library + Vitest.

## Global Constraints

- Class component only — React's error boundary API requires `getDerivedStateFromError` / `componentDidCatch`, which only exist on class components
- No external error-reporting service (out of scope for v1)
- Fallback UI uses existing Tailwind dark theme (`bg-gray-950`, `text-white`) to match the app's color scheme
- Refresh button calls `window.location.reload()`

---

### Task 1: ErrorBoundary component and integration

**Files:**
- Create: `src/components/ErrorBoundary.tsx`
- Create: `src/components/ErrorBoundary.test.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: `<ErrorBoundary>` wrapping `<App />` in `main.tsx`
- Props: `children: ReactNode` only — no customisation props needed

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ErrorBoundary.test.tsx
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb(): never {
  throw new Error('test crash');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // suppress jsdom's console.error for expected thrown errors
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error', () => {
    render(<ErrorBoundary><span>ok</span></ErrorBoundary>);
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('renders fallback UI when a child throws', () => {
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('renders a Refresh button in the fallback UI', () => {
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/ErrorBoundary.test.tsx
```

Expected: 3 failures (component doesn't exist yet).

- [ ] **Step 3: Implement ErrorBoundary**

```tsx
// src/components/ErrorBoundary.tsx
import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-sm">
            <p className="text-white text-lg font-semibold">Something went wrong</p>
            <p className="text-gray-400 text-sm">
              An unexpected error occurred. Try refreshing the page.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/ErrorBoundary.test.tsx
```

Expected: 3/3 passing.

- [ ] **Step 5: Wrap App in main.tsx**

Replace the contents of `src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
```

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all tests pass (including the 3 new ones).

- [ ] **Step 7: Commit**

```bash
git add src/components/ErrorBoundary.tsx src/components/ErrorBoundary.test.tsx src/main.tsx
git commit -m "feat: add ErrorBoundary to catch render crashes and show fallback UI"
```

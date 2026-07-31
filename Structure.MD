# React + Vite Project Structure

A scalable, feature-based folder structure for React + Vite applications.

---

## 📁 Root

```
my-app/
├── public/
├── src/
├── index.html
├── vite.config.js
├── .env
├── .gitignore
└── package.json
```

---

## 📁 Full Structure

```
my-app/
│
├── public/                         # Static assets served as-is
│   ├── favicon.ico
│   └── robots.txt
│
├── src/                            # All application source code
│   │
│   ├── assets/                     # Images, fonts, icons
│   │   ├── images/
│   │   ├── fonts/
│   │   └── icons/
│   │
│   ├── components/                 # Reusable UI components
│   │   ├── ui/                     # Atomic UI elements (buttons, inputs, modals)
│   │   │   ├── Button.jsx
│   │   │   ├── Input.jsx
│   │   │   └── Modal.jsx
│   │   ├── layout/                 # Page-level layout components
│   │   │   ├── Navbar.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── Footer.jsx
│   │   └── shared/                 # Components shared across features
│   │       ├── Loader.jsx
│   │       └── ErrorBoundary.jsx
│   │
│   ├── features/                   # Feature-based modules (self-contained)
│   │   ├── auth/
│   │   │   ├── components/         # Auth-specific components
│   │   │   │   ├── LoginForm.jsx
│   │   │   │   └── RegisterForm.jsx
│   │   │   ├── hooks/              # Auth-specific custom hooks
│   │   │   │   └── useAuth.js
│   │   │   └── api.js              # Auth API calls
│   │   │
│   │   ├── dashboard/
│   │   │   ├── components/
│   │   │   │   └── DashboardCard.jsx
│   │   │   ├── hooks/
│   │   │   │   └── useDashboard.js
│   │   │   └── api.js
│   │   │
│   │   └── profile/
│   │       ├── components/
│   │       │   └── ProfileForm.jsx
│   │       ├── hooks/
│   │       │   └── useProfile.js
│   │       └── api.js
│   │
│   ├── hooks/                      # Global reusable custom hooks
│   │   ├── useDebounce.js
│   │   ├── useLocalStorage.js
│   │   └── useMediaQuery.js
│   │
│   ├── pages/                      # Route-level page components
│   │   ├── HomePage.jsx
│   │   ├── LoginPage.jsx
│   │   ├── DashboardPage.jsx
│   │   └── NotFoundPage.jsx
│   │
│   ├── services/                   # API layer & HTTP client configuration
│   │   ├── axiosInstance.js        # Axios base instance with interceptors
│   │   └── apiEndpoints.js         # Centralized API endpoint constants
│   │
│   ├── store/                      # Global state management
│   │   ├── index.js                # Store setup (Redux / Zustand)
│   │   ├── authSlice.js            # Auth global state
│   │   └── uiSlice.js              # UI global state (theme, notifications)
│   │
│   ├── utils/                      # Pure helper functions (no side effects)
│   │   ├── formatDate.js
│   │   ├── validators.js
│   │   └── constants.js
│   │
│   ├── App.jsx                     # Root component with router setup
│   └── main.jsx                    # ReactDOM entry point
│
├── index.html                      # HTML shell / Vite entry point
├── vite.config.js                  # Vite configuration
├── .env                            # Environment variables (do not commit secrets)
├── .env.example                    # Template for required env vars
├── .gitignore                      # Files and folders ignored by Git
└── package.json                    # Dependencies and npm scripts
```

---

## 📖 Folder Responsibilities

### `public/`
Static files served at the root URL. Vite does not process these — use for `favicon.ico`, `robots.txt`, and other assets that need a stable public URL.

### `src/assets/`
Processed static assets (images, fonts, SVG icons) imported directly in components. Vite handles optimization and hashing.

### `src/components/`
Reusable, presentational components with no business logic.

| Sub-folder | Purpose |
|---|---|
| `ui/` | Atomic elements — Button, Input, Modal, Badge |
| `layout/` | Page scaffolding — Navbar, Sidebar, Footer |
| `shared/` | Cross-feature components — Loader, ErrorBoundary, ProtectedRoute |

### `src/features/`
The core of a scalable React app. Each feature is **self-contained** — it owns its own components, hooks, and API calls. This makes features easy to add, remove, or refactor independently.

Each feature follows the same internal structure:
```
feature-name/
├── components/   # UI specific to this feature
├── hooks/        # Custom hooks specific to this feature
└── api.js        # All API calls for this feature
```

### `src/hooks/`
Custom hooks generic enough to be reused across multiple features. Examples: `useDebounce`, `useLocalStorage`, `useMediaQuery`, `useFetch`.

### `src/pages/`
Thin route-level components that compose feature components together. Pages should contain **no business logic** — only layout, routing params, and feature composition.

### `src/services/`
Centralized HTTP client configuration. Keep your axios instance (base URL, headers, interceptors) here so every feature's `api.js` imports from one place.

### `src/store/`
Global state only — auth user, theme, notification queue. Feature-level state stays inside `features/`. Use Redux Toolkit slices or Zustand stores.

### `src/utils/`
Pure functions with no side effects. Date formatters, string validators, numeric helpers, and shared constants all belong here.

---

## ⚙️ Config Files

| File | Purpose |
|---|---|
| `index.html` | Vite HTML entry point — contains `<div id="root">` |
| `vite.config.js` | Vite plugins, path aliases (`@/` → `src/`), proxy settings |
| `.env` | Environment variables (`VITE_API_URL`, etc.) — never commit secrets |
| `.env.example` | Committed template listing required env var keys without values |
| `.gitignore` | Excludes `node_modules/`, `dist/`, `.env`, and build artifacts |
| `package.json` | Dependencies, devDependencies, and npm scripts (`dev`, `build`, `preview`) |

---

## 💡 Tips

- **Path aliases** — Configure `@` as an alias for `src/` in `vite.config.js` to avoid `../../` import hell:
  ```js
  // vite.config.js
  import { defineConfig } from 'vite'
  import react from '@vitejs/plugin-react'
  import path from 'path'

  export default defineConfig({
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
  })
  ```

- **Start flat, scale to features** — For small projects, keep everything flat in `components/`. Migrate to `features/` when a domain area grows beyond 3–4 files.

- **Co-locate tests** — Place `*.test.jsx` or `*.spec.js` files next to the component or util they test rather than in a separate `__tests__/` folder.

- **Index barrel files** — Add `index.js` to each folder to simplify imports:
  ```js
  // src/components/ui/index.js
  export { default as Button } from './Button'
  export { default as Input } from './Input'
  ```

---

*Generated for React + Vite projects. Adapt as needed for your stack (e.g. React Query, TanStack Router, Zustand).*
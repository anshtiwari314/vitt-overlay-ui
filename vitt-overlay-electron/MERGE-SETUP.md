# Merge: React client into Electron (load HTML instead of localhost)

This document describes how the React app from `vitt-overlay-react-client` is merged into `vitt-overlay-electron` so the window loads the **built HTML file** instead of `loadURL('http://localhost:5173')`. The React project **vitt-overlay-react-client** is **not modified**.

---

## What was done (in Electron only)

1. **Config and build**
   - `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` were added to `vitt-overlay-electron` (Vite builds the React app into `dist/`).
   - `vite.config.ts` uses `base: './'` and `build.outDir: 'dist'` so the built app works when loaded via `loadFile` (file protocol).

2. **Dependencies**
   - All React client dependencies and devDependencies were merged into `vitt-overlay-electron/package.json` (Vite, React, Redux, TypeScript, etc.).

3. **Scripts**
   - `build:renderer` – runs `vite build` to produce `dist/`.
   - `dist` – runs `build:renderer` then `electron-builder` so the packaged app includes the built UI.

4. **main.js**
   - Load logic: if `dist/index.html` exists, use `win.loadFile(distPath)`; otherwise fallback to `win.loadURL('http://localhost:5173')`.
   - `fs` is used to check for `dist/index.html`.

5. **Build / packaging**
   - `package.json` `build.files` includes `dist` so the built renderer is shipped with the app.

---

## One-time step you must run: copy React `src/` into Electron

The **src/** directory from the React client was **not** copied by the tooling (shell was unavailable). Do this once on your machine:

### Option A – PowerShell (recommended on Windows)

From the **repo root** `vitt-overlay-ui`:

```powershell
Copy-Item -Path "vitt-overlay-react-client\src" -Destination "vitt-overlay-electron\src" -Recurse -Force
```

### Option B – Node script (from repo root)

```bash
node vitt-overlay-electron/setup-merge.js
```

### Option C – CMD

```cmd
xcopy /E /I /Y vitt-overlay-react-client\src vitt-overlay-electron\src
```

After this, `vitt-overlay-electron/src` should contain the full React app (components, redux, context, assets, etc.).

---

## Optional: copy missing assets

The React app may reference images like `g-meet.png`, `zoom.png`, `teams.png`. If those exist in `vitt-overlay-react-client` (e.g. in `public/` or elsewhere), copy them into `vitt-overlay-electron/src/assets/` so imports resolve. If they are only in the original client’s `public/`, you can copy `vitt-overlay-react-client/public` to `vitt-overlay-electron/public` and ensure Vite serves them (or move assets into `src/assets` and fix imports).

---

## Workflow after merge

1. **Install dependencies (once)**  
   In `vitt-overlay-electron`:
   ```bash
   npm install
   ```

2. **Build the React UI (when you change front-end code)**  
   ```bash
   npm run build:renderer
   ```

3. **Run Electron**  
   ```bash
   npm start
   ```
   - If `dist/index.html` exists → window loads the built HTML from disk.
   - If not → window loads `http://localhost:5173` (you must run `npm run dev` in the React client separately for that to work).

4. **Package the app**  
   ```bash
   npm run dist
   ```
   This builds the renderer and then runs electron-builder; the output includes the `dist/` UI.

---

## Summary

| Item | Location |
|------|----------|
| React source (after you copy) | `vitt-overlay-electron/src/` |
| Built UI (after `npm run build:renderer`) | `vitt-overlay-electron/dist/` |
| Load in main process | `main.js`: `loadFile(dist/index.html)` or fallback `loadURL('http://localhost:5173')` |
| React client project | **Unchanged** in `vitt-overlay-react-client/` |

No files in `vitt-overlay-react-client` were modified.

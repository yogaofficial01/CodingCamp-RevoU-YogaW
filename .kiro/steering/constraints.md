# Project Constraints, Folder Rules & Optional Features

## Folder Rules
- Exactly **one CSS file** lives at `css/style.css`
- Exactly **one JavaScript file** lives at `js/app.js`
- `index.html` is a clean HTML shell only — no inline `<style>` or `<script>` blocks
- Keep code clean, readable, and well-commented

## Optional Challenges Implemented (3 of 5)
1. **Custom categories** — users can add/remove their own spending categories with auto-assigned colours
2. **Sort transactions** — sort the list by newest · oldest · amount high/low · category A-Z
3. **Dark/Light mode toggle** — persisted in localStorage, applied via a `.light` class on `<body>`

---

# Project Constraints & Non-Functional Requirements

## Technical Constraints

### TC-1: Technology Stack
- **HTML** for structure
- **CSS** for styling
- **Vanilla JavaScript only** — no frameworks (React, Vue, Angular, Svelte, etc.)
- No backend server required — purely client-side

### TC-2: Data Storage
- Use the **browser Local Storage API** exclusively
- All data is stored client-side only — no network requests for data persistence

### TC-3: Browser Compatibility
- Must work in all modern browsers: Chrome, Firefox, Edge, Safari
- Must function as a standalone web app (single `.html` file is acceptable)

---

## Non-Functional Requirements

### NFR-1: Simplicity
- Clean, minimal interface — avoid visual clutter
- Easy to understand and use without documentation
- No complex setup required
- No test setup required

### NFR-2: Performance
- Fast load time — minimize external dependencies
- Responsive UI interactions — no lag when adding, deleting, or updating data
- Avoid heavy libraries unless they are loaded from a CDN and do not block rendering

### NFR-3: Visual Design
- User-friendly aesthetic with consistent color palette and spacing
- Clear visual hierarchy — important information (balance, totals) is prominent
- Readable typography — appropriate font sizes and contrast ratios
- Mobile-first layout — must look and work well on small screens

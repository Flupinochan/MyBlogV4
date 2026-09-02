# CLAUDE.md

## Architecture

### Astro or React components (`src/components/`)

- `avatar/` — 3D avatar via Three.js + React Three Fiber (GLB model with shape keys)
- `home/blog/` — blog carousel with TanStack Query infinite pagination
- `home/tool/` — TanStack Table + TanStack Virtual (virtualized rows, View Transitions for sorting)
- `home/charts/` — D3.js charts animated with GSAP; animation state via Nanostores
- `home/chat/` — AI chat section (ChatSection.tsx, chatApi.ts)
- `home/hero/` — Hero section (HeroActions, MainTitle, Skills — Astro components)
- `home/timeline/` — Timeline section (Astro)

### Layouts (`src/layouts/`)

- `Base.astro`, `Header.astro`, `Footer.astro` — page shell
- `BackgroundParticles.astro` — tsparticles background effect
- `error-dialog/` — common error dialog (ErrorDialog.astro + errorDialog.ts)

### Shared & Utilities (`src/`)

- `components/icons/` — 11 SVG icon components (Astro)
- `components/shared/` — Badge.astro/.tsx, SectionHeading.astro
- `lib/` — GSAP animation utilities (gsap.ts, sectionHeadingAnimation.ts)
- `types/` — selectedContent.ts, viewTransition.ts
- `pages/` — index.astro (home)

## CSS Rules

- Use **Tailwind CSS** as the primary approach; vanilla CSS in `.css` files is permitted when Tailwind cannot express the style
- When many duplicate Tailwind classes exist, extract them into a `.css` file using `@apply <tailwind-classes>` with this header:

```css
@reference "../../../styles/global.css";
@variant dark (&:where(.dark, .dark *));

.your-class {
@apply <tailwind-classes>;
}
```

- Avoid `<style>` tags in `.astro` files; use them only when Tailwind cannot express the style
- Color palette: **violet** (primary), cyan/amber/rose/emerald (accents), white/gray/slate/indigo (light/dark surfaces)

## Code Rules

### Async

- No promise chains — use `async/await` + `try/catch` instead of `.then()` / `.catch()`

### Control Flow

- Prefer early return over nested `if` blocks — guard clauses at the top of a function keep the happy path unindented
- Never swallow errors in empty or comment-only `catch` blocks — always log (`console.error`) or surface the error to the user

### No Comment

Please do not add any comments under any circumstances.

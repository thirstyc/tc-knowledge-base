# Thirsty Cunt — Knowledge Base (static HTML)

Ten pages, one shared stylesheet. No build step, no JS.

## Files

| File | Page type |
|---|---|
| `index.html` | Home |
| `answers.html` | Answers index (all answers + filter chips) |
| `search.html` | Search results (includes the empty-state block, commented) |
| `topics.html` | Topics index, grouped |
| `topic-grenache.html` | Single topic page |
| `answer-grenache-alcohol-tannin.html` | Answer detail |
| `audience-enthusiast.html` | Audience archive |
| `difficulty-intermediate.html` | Difficulty archive |
| `about.html` | About |
| `404.html` | Not found |
| `styles.css` | All styles, brand tokens as CSS variables at the top |

## Assets to add

Drop these two files in and both header and footer are done:

- `assets/tc-logo.svg` — header glass/"tc" monogram, renders at 34px tall
- `assets/tc-wordmark.svg` — footer stacked wordmark, renders at 112px tall

Both are height-driven with `width: auto`, so any aspect ratio works. PNG is fine — change the extension in the `<img src>`.

## Templating notes

- Header and footer are identical blocks in every file — lift them straight into partials.
- The nav item for the current page carries `aria-current="page"`; the stylesheet keys the active state off it.
- Confidence badge classes: `.badge.high` (Turquoise), `.badge.moderate` (Burnt Sunset), `.badge.review` (Dark Cherries).
- Filter and archive chips use the same `aria-current="page"` convention.
- Search forms `GET` to `search.html?q=` — wire to whatever your backend expects.
- Answer detail URL pattern: `answer-<slug>.html`. Archives: `audience-<slug>.html`, `difficulty-<slug>.html`, `topic-<slug>.html`.

## Fonts

Instrument Serif, IBM Plex Mono, Outfit — loaded from Google Fonts in each `<head>`. Self-host if you'd rather not hit their CDN.

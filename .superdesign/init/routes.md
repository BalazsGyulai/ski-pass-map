# Routes

File-based App Router. Public pages are under `src/app/[lang]/`. The site is served with a base path (`/ski-pass-map` on GitHub Pages, none on Cloudflare). Every public URL is `/{lang}/…`.

Shared layout for every `[lang]` route: `src/app/[lang]/layout.tsx` (`DocumentShell` + `Chrome`).

| URL | File | What it renders |
| --- | --- | --- |
| `/{lang}/` | `src/app/[lang]/page.tsx` | Map explorer (`ExplorerFrame`) |
| `/{lang}/passes/` | `src/app/[lang]/passes/page.tsx` | Season-pass list (`PassesView`) |
| `/{lang}/plan/` | `src/app/[lang]/plan/page.tsx` | Trip planner (`Planner`) |
| `/{lang}/settings/` | `src/app/[lang]/settings/page.tsx` | Settings (`SettingsView`) |
| `/{lang}/about/` | `src/app/[lang]/about/page.tsx` | About (`AboutView`) |
| `/{lang}/contact/` | `src/app/[lang]/contact/page.tsx` | Contact form (`ContactForm`) |
| `/{lang}/support/` | `src/app/[lang]/support/page.tsx` | Support (`SupportView`) |
| `/{lang}/saved/` | `src/app/[lang]/saved/page.tsx` | Redirect (`LocalRedirect`) |
| `/{lang}/compare/` | `src/app/[lang]/compare/page.tsx` | Redirect (`LocalRedirect`) |
| `/{lang}/for-resorts/` | `src/app/[lang]/for-resorts/page.tsx` | Resort-owner page, markup in the page file |
| `/` | `src/app/(redirect)/page.tsx` | Sends the visitor to their language |

Legal pages (`privacy`, `terms`, `imprint`, `credits`, `resort-terms`, `resort-ranking`) are long-form text beside the same chrome. Admin (`/admin`) and the resort portal (`/portal`) use their own layouts, not `Chrome`.

There is no router config file.

# DisasterLens migration provenance

Source: https://github.com/rockadityav-hash/surakshasetu-mvp

Source revision: `7b34532bd052de8152cda9a96729e77d412c7b94` — `Remove NASA Earthdata integration`.

The source was downloaded as a revision-pinned ZIP on 2026-09-25. Its 79 files were copied to a new DisasterLens directory. The archive contained no Git history; a separate repository was initialized with branch `main`. No changes were made to the original repository and no remote was added to DisasterLens.

The existing UI, SurakshaSetu branding, pages, translations, CSS, maps, algorithms, data, migrations, tests and assets originate from SurakshaSetu. Commit messages in this repository describe copying and integration, not original authorship of these components. No DisasterLens feature expansion is included.

## Independence fixes

- Rename the frontend package to `disasterlens-frontend` and declare the verified pnpm version and Node requirement, retaining the source dependency lockfile.
- Use `disasterlens-` browser-storage keys for state, language and drafts. Existing SurakshaSetu browser records are neither read nor overwritten.
- Centralize the existing API-origin default, make blank configuration use that default, strip trailing slashes and resolve relative hazard-snapshot URLs against the browser origin.
- Make blank `CORS_ORIGINS` fall back to the original localhost origin.
- Fix the Nginx configuration COPY path; pass a frontend API build argument and proxy Docker `/backend/` requests to the API service.
- Give Compose a separate `disasterlens` project/database identity and volume. Require a private database password rather than a committed password default. Forward the existing optional hazard/Routes settings to the API container.
- Expand Git/build exclusions for secrets, local environment files, dependencies, caches and generated artifacts. Keep only blank configuration names in `.env.example` files.
- Document independent setup and verification, retaining the original README as `docs/SOURCE_README.md` for provenance.

No algorithm, threshold, scoring weight, demo datum, CSS rule, original test, image or map-rendering component was changed. The remaining SurakshaSetu strings are intentional inherited branding, source attribution, sample identifiers and API response labels, not runtime links to an old checkout.

## History scope

The migration is grouped into initialization, the copied application baseline, and final independent configuration/verification. Features that are tightly coupled in the source are copied together rather than pretending each component was newly authored. The new history has no parent commits from SurakshaSetu.

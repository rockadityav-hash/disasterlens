# Security guidance

This repository is an MVP and uses synthetic records. Before operational use:

- terminate TLS at a managed gateway and encrypt database/object-storage volumes;
- replace `X-Demo-Role` with state SSO/OIDC and short-lived signed tokens;
- enforce household row-level permissions, purpose limitation, audit trails and configured retention;
- hash or tokenise surveyor and household references;
- keep photographs outside PostgreSQL with private, expiring access URLs;
- validate uploads in an isolated worker, scan archives, limit decompression and reject unsafe paths;
- rotate external-source credentials with a secrets manager;
- use separate Google Maps browser and server keys: restrict the browser key by production HTTP referrers and Maps JavaScript API, and restrict the Routes key by server IP and Routes API;
- run dependency, container and infrastructure scans;
- conduct DPIA/security review with the competent authority;
- never collect Aadhaar numbers in this system.

The system must not automatically issue evacuation, relocation or land-acquisition decisions.

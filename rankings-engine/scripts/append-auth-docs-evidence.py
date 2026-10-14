#!/usr/bin/env python3
# Auth-platforms arena bring-up (2026-09): supplements evidence packs with verbatim passages
# from the CRAWLED vendor docs that the LLM extraction pass missed — the kitty precedent
# (append-kitty-docs-evidence.py): giant single-page docs (Keycloak's 1.1MB server-admin guide)
# and per-source extraction caps starve specific capabilities out of the prompt even though the
# crawled corpus contains them verbatim. Every excerpt below quotes rankings-engine/cache/crawl/
# auth-platforms/<product>/*.md content (checked at authoring time); URLs are the crawled
# sources. Extraction is monotonic and dedups by normalized excerpt, so re-running extract
# after this keeps these items stable.
import datetime
import json

NOW = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

SERVER_ADMIN = 'https://www.keycloak.org/docs/latest/server_admin/index.html'
OIDC_LAYERS = 'https://www.keycloak.org/securing-apps/oidc-layers'

ITEMS = {
    'keycloak': [
        ('kc-supp-orgs', SERVER_ADMIN,
         'Server Administration Guide, "Managing organizations": "In the Organizations section, you can manage all the organizations in your realm. Creating an organization: Click Create Organization. An organization has the following settings: Name — a user-friendly name for the organization. The name is unique within a realm."'),
        ('kc-supp-passkeys', SERVER_ADMIN,
         'Server Administration Guide documents "W3C Web Authentication (WebAuthn)" setup ("Enable WebAuthn authentication in the default browser flow", "WebAuthn together with Two-Factor", "LoginLess WebAuthn") and a dedicated "Passkeys" section: "Passkey Authentication with Conditional UI or autofill", "Passkeys Authentication with Modal UI", "Passkey Mediation".'),
        ('kc-supp-scim', SERVER_ADMIN,
         'Server Administration Guide, "Managing users and groups through SCIM": built-in SCIM endpoints per realm ("Enabling SCIM for a realm", "Obtaining the SCIM API base URL", "Setting up a service account client"), with protected admin users excluded: "resources can only be managed through the Admin Console or the Admin REST API, never through SCIM."'),
        ('kc-supp-device-grant', SERVER_ADMIN,
         'Server Administration Guide, "Device authorization grant": "This is used by clients running on internet-connected devices that have limited input capabilities or lack a suitable browser." The OIDC layers reference documents the endpoint: "/realms/{realm-name}/protocol/openid-connect/auth/device ... used to obtain a device code and a user code."'),
        ('kc-supp-client-credentials', OIDC_LAYERS,
         'OIDC layers reference, "Client credentials": "Client Credentials are used when clients (applications and services) want to obtain access on behalf of themselves rather than on behalf of a user." Clients authenticate via client_id/client_secret or JWT, backing service accounts for machine-to-machine access.'),
        ('kc-supp-kcadm', SERVER_ADMIN,
         'Server Administration Guide documents the Admin CLI: Keycloak "packages the Admin CLI server distribution with the execution scripts in the bin directory. The Linux script is called kcadm.sh", enabling scripted administration of realms, users, roles, and clients; the same operations are available over the Admin REST API.'),
        ('kc-supp-brute-force', SERVER_ADMIN,
         'Server Administration Guide, brute force protection events: "User disabled by permanent lockout — Brute force protection disabled the user account permanently due to too many login failures. User disabled by temporary lockout — Brute force protection disabled the user account temporarily due to too many login failures."'),
        ('kc-supp-social-brokering', 'https://www.keycloak.org',
         'Keycloak site, Identity Brokering and Social Login: "Enabling login with social networks is easy to add through the admin console. It\'s just a matter of selecting the social network you want to add. No code or changes to your application" — brokering also covers external OpenID Connect or SAML identity providers.'),
        ('kc-supp-federation', 'https://www.keycloak.org',
         'Keycloak site, User Federation: "Keycloak has built-in support to connect to existing LDAP or Active Directory servers. You can also implement your own provider if you have users in other stores, such as a relational database."'),
        ('kc-supp-authz-services', 'https://www.keycloak.org/docs/latest/authorization_services/index.html',
         'Authorization Services guide: fine-grained, resource-level authorization — "A resource is part of the assets of an application and the organization... In authorization policy terminology, a resource is the object being protected", with policies evaluated via UMA permission tickets and client-credentials-obtained PATs.'),
    ],
    'clerk': [
        ('clerk-supp-passkeys', 'https://clerk.com/pricing',
         'Clerk pricing matrix: "Passkeys — Authenticate with any form of passkeys": not included on the Free plan, included on Pro and above; "Biometric sign-in — Let returning users sign in to native apps with their device\'s biometrics" is likewise a paid-tier feature.'),
        ('clerk-supp-bot-detection', 'https://clerk.com',
         'Clerk site: "Bot Detection — Dramatically reduce fraudulent sign-ups with built-in, continually updated machine learning" and "Email and SMS one-time passcodes — Fast and reliable one-time passcode delivery with built-in brute force prevention."'),
        ('clerk-supp-session-devices', 'https://clerk.com',
         'Clerk site, Session Management: "Clerk manages the full session lifecycle, including critical security functionality like active device monitoring and session revocation" — with per-device sign-out ("Sign out of device") shown in the user profile UI.'),
        ('clerk-supp-m2m-pricing', 'https://clerk.com/pricing',
         'Clerk pricing: the Free plan carries a "Machine Authentication — API Keys & M2M Tokens limit per month"; machine authentication (API keys and machine-to-machine tokens) is a metered platform feature across plans.'),
        ('clerk-supp-migration-tool', 'https://clerk.com/docs/guides/development/migrating/overview.md',
         'Migration guide, "Migration tooling": "To aid in basic migrations, Clerk provides an open-source tool that takes a JSON or CSV file as input, containing a list of users, and creates a user in Clerk using the Backend API... The tool respects the backend rate limits."'),
    ],
    'workos': [
        ('workos-supp-cli-auth', 'https://workos.com/docs/reference/authkit/cli-auth/device-authorization.md',
         'AuthKit CLI Auth reference: "CLI Auth enables command-line applications to authenticate users through the web using the OAuth 2.0 Device Authorization Flow" (RFC 8628) — a device authorization URL obtains a device code and user code, then tokens are polled for the session.'),
        ('workos-supp-passkeys-pricing', 'https://workos.com/pricing',
         'WorkOS pricing: "First 1M MAUs — Free; each additional 1M MAUs $2,500/mo. AuthKit includes email + password, social login, passkeys, MFA, magic auth, and enterprise SSO — all from one integration."'),
        ('workos-supp-radar', 'https://workos.com/pricing',
         'WorkOS pricing lists "Radar (Bot & Fraud Protection)" — first 1,000 checks free, per-50K-check pricing beyond — and "Log streaming (per SIEM connection) $125/mo" for audit-log export; the Auth0 migration guide describes Radar as "Protect against bots, fraud, and abuse."'),
        ('workos-supp-scim-webhooks', 'https://workos.com/docs/directory-sync.md',
         'Directory Sync docs: "SCIM: System for Cross-domain Identity Management... a standard that many directory providers interface with. WorkOS supports dozens of integrations including SCIM. Directory updates can be delivered to you via webhooks or retrieved using the Events API."'),
        ('workos-supp-rbac-jwt', 'https://workos.com/docs/rbac.md',
         'RBAC docs: roles integrate "with AuthKit user management by assigning roles via API and enforcing access through session JWTs — support for enterprise features like organization-scoped roles and IdP role assignment via SSO and Directory Sync."'),
    ],
}

for pid, items in ITEMS.items():
    path = f'open-rankings/auth-platforms/evidence/{pid}.json'
    ev = json.load(open(path))
    existing = {e['id'] for e in ev}
    for eid, url, excerpt in items:
        if eid in existing:
            print(f'{pid}: {eid} already present, skipping')
            continue
        ev.append({'id': eid, 'tier': 'claimed-docs', 'url': url, 'excerpt': excerpt, 'fetchedAt': NOW})
        print(f'{pid}: appended {eid}')
    with open(path, 'w') as f:
        f.write(json.dumps(ev, indent=2) + '\n')
print('done')

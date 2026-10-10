# Manpost

Manpost is an independent, beginner-friendly API testing and request-management application. It is inspired by the general problem space of API clients, but has its own branding, interface, and implementation.

## Current status

Phase 10 security and deployment preparation is implemented. Manpost is still a learning project and needs production infrastructure choices and an independent security review before public deployment.

## Planned phases

1. MVP requirements and application structure
2. Page, component, API, and database planning
3. Next.js project and development environment
4. Request builder and HTTP request runner
5. Response data, status codes, headers, and timing
6. Query parameters, request headers, and JSON bodies
7. Saved requests and collections
8. Authentication and PostgreSQL storage
9. Request history and environment variables
10. Validation, security, testing, and deployment preparation

## Technology stack

- Next.js with App Router
- TypeScript
- Tailwind CSS
- PostgreSQL and Prisma ORM 6
- CodeMirror for the JSON request body editor
- Lucide icons
- Git

## Local development

Requirements:

- Node.js 22.19 or newer
- npm
- PostgreSQL 14 or newer (local installation or a hosted PostgreSQL provider)

Install dependencies:

```bash
npm install
```

Configure the database:

1. Create a PostgreSQL database named `manpost` (or choose another name).
2. Copy `.env.example` to `.env`.
3. Replace the example `DATABASE_URL` with your PostgreSQL connection URL. Keep `.env` private and out of Git.
4. Generate Prisma Client and create the development tables:

```bash
npm run db:generate
npm run db:migrate
```

Check the configured database connection without changing any data:

```bash
npm run db:check
```

### Configure password-reset email (optional for local testing)

Manpost supports SMTP email for forgotten-password links. Add your email provider's SMTP details to `.env` (never commit this file or share its password):

```dotenv
APP_URL="http://localhost:3000"
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-smtp-username"
SMTP_PASSWORD="your-smtp-password"
SMTP_FROM="Manpost <no-reply@example.com>"
```

Use the host, username, password, and sender address supplied by your email provider. Port 587 normally uses STARTTLS (`SMTP_SECURE="false"`); port 465 normally uses implicit TLS (`SMTP_SECURE="true"`). If SMTP is not configured, local development displays a one-time reset link on the page instead, so the flow can still be tested without sending mail. Restart the development server after editing `.env`.

Test the SMTP connection and authentication without sending an email:

```bash
npm run email:verify
```

Then run Manpost, choose **Forgot password**, and request a reset for a test account to verify actual delivery and the full reset flow.

### Shared rate limits for Vercel

Local development uses a small in-memory limiter so the app works without another account. Production requires a shared Upstash Redis database because Vercel may handle requests in separate function instances. Create a Redis database in Upstash (or through a Vercel Marketplace integration), then copy its REST URL and token into local `.env` for testing. Keep the token private.

```dotenv
UPSTASH_REDIS_REST_URL="https://your-database.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-private-token"
```

Add these as server-only environment variables in Vercel for the deployment environments you use. Do not prefix them with `NEXT_PUBLIC_`. In production, Manpost deliberately returns a temporary service error if the shared limiter is missing or unreachable; it does not silently fall back to per-instance limits. Current limits cover outbound requests, saved requests, history, login attempts, sign-ups, and password recovery.

### Optional error monitoring with Sentry

Sentry can collect unexpected browser and server errors so they can be diagnosed. It does not prevent every failure or replace validation, tests, backups, rate limits, or good error handling. Manpost's Sentry integration is disabled until a DSN is configured.

1. Create a Sentry project for Next.js and copy its DSN.
2. Put it in local `.env` as `NEXT_PUBLIC_SENTRY_DSN="..."` (the DSN is a public reporting identifier, not an account password). Set the same variable in Vercel when ready. Do not put `SENTRY_AUTH_TOKEN` in browser-visible variables or commit it.
3. Restart the local development server. Confirm the project still builds and runs; errors are sent only when a valid DSN is configured.

Manpost disables performance tracing and personally identifying data, and removes request details, user data, breadcrumbs, and extra context before reporting. This is defense in depth, not a guarantee that arbitrary exception text is always free of sensitive information: never put real API credentials or personal data into test requests. Source-map upload is currently disabled; stack traces may be harder to read until a private Sentry build token and project configuration are intentionally set up.

The app includes route-level and root-level fallback screens with a retry action. These catch render errors; they do not catch every event-handler or background-task failure, and retrying cannot fix an underlying database outage or bug.

### Vercel pre-deployment checklist (not deployed yet)

1. Connect the GitHub repository to a Vercel project, but keep deployment protection enabled while testing.
2. Provision a managed PostgreSQL database. Use its production connection string as `DATABASE_URL` in Vercel; do not commit it or send it in chat. Verify connectivity with `npm run db:check` after securely configuring that URL in a local `.env`, then apply committed schema migrations with `npm run db:deploy`.
3. Add `APP_URL` using the exact HTTPS URL that Manpost will use. For a preview deployment, use that preview URL; for production, use the final production domain. Password-reset links are generated from this value.
4. Add the Upstash REST URL and token, plus the SMTP host, port, TLS setting, username/password if required, and a sender address authorized by the mail provider. Configure Preview and Production separately where appropriate.
5. Deploy a protected preview, sign up with a test account, request a password reset, confirm the email arrives, open its link, change the password, and sign in with the new password. Never test with a real password or share provider credentials.
6. Review logs and test the outbound request guardrails before deciding whether to make a production deployment public.

Vercel environment-variable changes apply to new deployments. After editing them, redeploy the protected preview to test the latest values. Do not deploy publicly until the database, shared rate limiter, and SMTP recovery flow have been verified.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

Run the checks used during setup:

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
npm audit --omit=dev
```

The production dependency audit should report no vulnerabilities. The full `npm audit` may still report the current `braces` advisory through the development-only Next.js ESLint tooling; upstream has not published a patched `braces` release, so do not use `npm audit fix --force` to downgrade the Next.js ESLint config.

For a production database, configure the deployment environment variables and apply committed migrations with:

```bash
npm run db:deploy
```

## Current features

- Next.js App Router project structure
- TypeScript configuration with the `@/*` import alias
- Tailwind CSS 4 integration
- ESLint configuration
- Responsive branded starter page
- Original Manpost route-mark logo shared by the workspace, authentication pages, and browser tab
- Basic page metadata and accessible document language
- Request builder with method, URL, parameters, headers, and body controls
- Response status, response time, response headers, and formatted response body
- JSON syntax highlighting and client-side body validation
- Local saved requests and a My requests collection list
- Email/password account registration, sign-in, and sign-out
- Accessible in-app welcome confirmation after successful registration (signup email delivery is not configured)
- Forgotten-password flow with hashed, single-use, 30-minute reset tokens and configurable SMTP delivery
- PostgreSQL data models for users, private sessions, collections, and saved requests
- Per-account saved request persistence and one-time migration of existing browser-saved requests
- Per-account request history (latest 50 entries), including request details, status, and response time
- Browser-local environments with reusable `{{variableName}}` substitutions in URLs, headers, and JSON bodies
- Server-side outbound request validation, SSRF protections, bounded responses, and per-account request limits
- Automated security and rate-limit unit tests (`npm test`)
- Optional Sentry error reporting with sensitive request context removed and friendly render-error recovery screens

## Architecture decisions

- The initial MVP uses one primary workspace route.
- Outbound API calls will use a controlled server-side route so request validation and SSRF protections have one enforcement point.
- Phase 7 initially used browser localStorage; existing saved requests are migrated to PostgreSQL when the user signs in.
- Passwords are stored as salted scrypt hashes; session cookies are HttpOnly, SameSite=Lax, and Secure in production. The database stores only a hash of each random session token.
- Password-reset links use cryptographically random tokens; only token hashes are stored in PostgreSQL. Successful resets invalidate all of that account's sessions and outstanding reset links. SMTP secrets are read from environment variables, never source code.
- The local `npm run dev` and production `npm run start` launchers ask Node.js 22.19+ to include Windows' trusted system certificates. TLS certificate verification remains enabled; this accommodates locally trusted certificate authorities without disabling HTTPS checks.
- Phase 8 stores saved requests in PostgreSQL and creates a starter collection per account.
- Phase 9 stores request history under the signed-in account. Environment values are stored in browser localStorage, scoped by email; they are not encrypted and should not be used as a secure secret vault.
- The request runner requires a signed-in session. It accepts only HTTP/HTTPS URLs, rejects URL credentials, validates method/header/query/body sizes, rejects destinations with any non-public IPv4/IPv6 DNS answer, and pins the outbound connection to the validated DNS result to reduce DNS-rebinding risk. Redirect responses are returned to the user and are not followed automatically.
- Outbound requests have a 15-second timeout and response bodies are capped at 1 MB. Incoming JSON API payloads are capped at 256 KB; outbound request bodies are capped at 100 KB. Mutating JSON routes check same-origin request headers.
- Local rate limits use process memory for development. Production rate limits use Upstash Redis and fail closed when its configuration is absent or unreachable, so multiple Vercel function instances share enforcement.
- Sentry is optional and inactive until configured. It reports unexpected errors; request and user context are stripped before transmission. Error boundaries provide a retry screen, while expected API errors continue to be handled by the relevant forms and routes.
- Next.js and `eslint-config-next` are kept on the same patched version. Prisma remains on 6.19.3; an npm override supplies patched `deepmerge-ts` 8.x to Prisma's config loader without downgrading Prisma. `prisma validate`, Prisma Client generation, the test suite, and the production build must pass after changing this override. Recheck and remove the override when Prisma publishes a compatible upstream fix.
- Saved requests and request history are stored in PostgreSQL and may contain authorization headers, bodies, or other sensitive data. Environment values live in browser localStorage and are not encrypted. Do not use either feature as a secure secret vault; use disposable test credentials and define retention/access policies before inviting users.
- Deployment is not a claim of production safety. Before public use, enable HTTPS, protect and back up PostgreSQL, keep secrets only in the hosting provider's environment configuration, apply migrations with `npm run db:deploy`, configure and test shared rate limiting and SMTP recovery, verify reverse-proxy origin behavior, and arrange a security review. Do not disable URL/IP protections to work around an API endpoint that is blocked.
- Secrets will be provided through environment variables rather than hard-coded in source files.

## Lessons learned

- The project directory name uses a capital letter, which is not accepted as an npm package name. The package name is therefore explicitly set to the lowercase value `manpost`.
- This local environment required npm's `--strict-ssl=false` option during dependency installation because its certificate chain could not verify the npm registry certificate. This was used only for the install command and was not saved as a project configuration.

This project is an independent learning and portfolio project with its own branding and implementation.

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
```

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
- Rate limits currently use process memory. They help during local development or a single app instance but are not shared across server processes and reset on restart. A public multi-instance deployment must use a shared rate limiter (or an appropriately configured edge protection).
- Saved requests and request history are stored in PostgreSQL and may contain authorization headers, bodies, or other sensitive data. Environment values live in browser localStorage and are not encrypted. Do not use either feature as a secure secret vault; use disposable test credentials and define retention/access policies before inviting users.
- Deployment is not a claim of production safety. Before public use, enable HTTPS, protect and back up PostgreSQL, keep secrets only in the hosting provider's environment configuration, apply migrations with `npm run db:deploy`, configure shared rate limiting, verify reverse-proxy origin behavior, and arrange a security review. Do not disable URL/IP protections to work around an API endpoint that is blocked.
- Secrets will be provided through environment variables rather than hard-coded in source files.

## Lessons learned

- The project directory name uses a capital letter, which is not accepted as an npm package name. The package name is therefore explicitly set to the lowercase value `manpost`.
- This local environment required npm's `--strict-ssl=false` option during dependency installation because its certificate chain could not verify the npm registry certificate. This was used only for the install command and was not saved as a project configuration.

This project is an independent learning and portfolio project with its own branding and implementation.

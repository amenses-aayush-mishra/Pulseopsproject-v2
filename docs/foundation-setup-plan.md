# PulseOps Foundation Setup Plan

Version: 2.0
Scope: build the repository from an empty folder to a stable local foundation without changing the stated stack.

## 1. Guiding Principles

- Keep the stack exactly as specified: Next.js + Express.js (JavaScript), MongoDB Atlas + Mongoose, NextAuth.js + RBAC, Joi, Gemini API, Nodemailer, GitHub/Slack/Jira integrations.
- Treat the four design documents as the source of truth and do not drift from them.
- Follow the build order from the setup guide exactly: scaffold → environment → database → auth → orgs/invites → integrations.
- Pin package versions to reduce install conflicts and keep the app stable during the MVP build.

## 2. Recommended Compatibility Baseline

Use the following baseline to keep package versions compatible with Node 18 LTS:

- Node.js: 18.x LTS
- npm: 9.x or 10.x
- Client:
  - next: 14.2.15
  - react: 18.3.1
  - react-dom: 18.3.1
  - next-auth: 4.24.0
  - zustand: 4.5.4
  - @tanstack/react-query: 5.59.1
  - tailwindcss: 3.4.14
- Server:
  - express: 4.19.2
  - mongoose: 8.5.3
  - dotenv: 16.4.0
  - cors: 2.8.0
  - joi: 17.13.0
  - jsonwebtoken: 9.0.2
  - bcryptjs: 2.4.6
  - nodemailer: 6.9.0
  - @google/generative-ai: 0.21.0
  - axios: 1.7.3
  - nodemon: 3.1.0

## 3. Phase 0 — Repository Bootstrapping

Goal: create the empty repo structure and establish a clean base.

Steps:
1. Create the root folder and initialize Git.
2. Create the required top-level folders: client, server, docs.
3. Add a root .gitignore covering .env, .env.local, node_modules, .next, and build artifacts.
4. Create a root README.md with the project purpose, stack, local run instructions, and deployment targets.
5. Create a minimal package policy for the repo: no monorepo tooling, no shared packages, two independent apps in one repository.

Definition of done:
- The folder structure matches the intended repo layout.
- The repo is ready for app scaffolding without dependency conflicts.

## 4. Phase 1 — Application Scaffolding

Goal: generate the client and server foundations with the expected package layout.

Client steps:
1. Create the Next.js app in the client folder using the App Router.
2. Install UI and state dependencies: Zustand, TanStack Query, NextAuth.
3. Add Tailwind configuration and the expected app structure: app, components, lib, store, hooks, public.
4. Create the NextAuth route file under app/api/auth/[...nextauth]/route.js.
5. Add middleware to protect dashboard, settings, and integrations routes.

Server steps:
1. Create the server folder and initialize package.json.
2. Install Express, Mongoose, dotenv, cors, Joi, jsonwebtoken, bcryptjs, nodemailer, axios, and the Gemini SDK.
3. Install nodemon as a dev dependency.
4. Create the src folder with config, models, routes, controllers, middleware, validators, services, and webhooks.
5. Create server.js and app.js entry points.

Definition of done:
- Both apps can start locally without syntax errors.
- The folder structure matches the setup guide exactly.

## 5. Phase 2 — Environment and Secrets Setup

Goal: configure all required secrets and local URLs before any feature work begins.

Steps:
1. Create client/.env.local with Next public API URL, NextAuth URL, NextAuth secret, and GitHub OAuth variables.
2. Create server/.env with port, MongoDB URI, JWT secrets, invite token secret, GitHub/Slack/Jira/Gemini/Nodemailer config, and the token encryption key.
3. Generate a secure NEXTAUTH_SECRET and JWT secrets.
4. Confirm that .env and .env.local are excluded from Git.
5. Document the expected local development URLs: client on localhost:3000 and server on localhost:5000.

Definition of done:
- Every required environment variable has a placeholder and a documented purpose.
- The local environment can be launched without hard-coded secrets.

## 6. Phase 3 — Database Foundation

Goal: establish the persistence layer and make the database schema the first major dependency.

Steps:
1. Create the MongoDB Atlas cluster and database user.
2. Whitelist the local IP and optionally 0.0.0.0/0 for early development.
3. Add the MongoDB connection string to server/.env.
4. Create the database connection helper in server/src/config/db.js.
5. Call the connection helper from server.js before listening.
6. Implement all 10 Mongoose models in the requested files under server/src/models/.
7. Keep every schema aligned with the database design document and add indexes exactly as specified.
8. Apply the multi-tenancy rule in all future controllers and queries: always scope to organizationId from the authenticated user context.

Definition of done:
- The backend can connect to MongoDB successfully.
- All 10 models exist and are wired into the application startup path.

## 7. Phase 4 — Auth and Authorization Core

Goal: build the auth backbone before any business features.

Steps:
1. Create the authentication middleware stack: authenticate, requireRole, and scopeToOrg.
2. Create the Joi validation utility and establish the pattern for write-endpoint validation.
3. Implement POST /api/auth/register.
4. Implement POST /api/auth/login.
5. Wire credentials auth into NextAuth and ensure the role and organizationId come from the OrganizationMember lookup.
6. Implement GitHub OAuth sign-in so the user record is resolved correctly and organization membership context is attached.
7. Implement the organization creation flow and ensure the creator becomes the owner.
8. Add the frontend redirect rule: if the session has no organizationId, redirect to /organizations/create.

Definition of done:
- Register and login work end to end.
- Authenticated requests carry role and organization context correctly.
- Protected routes behave according to the RBAC rules.

## 8. Phase 5 — Organization and Invitation Flow

Goal: support the core tenant lifecycle and onboarding experience.

Steps:
1. Implement POST /api/organizations to create an organization and assign the creator as owner.
2. Implement POST /api/organizations/:id/invite.
3. Create the invite token utility with a separate secret for invite tokens.
4. Implement the invite acceptance flow for /invite/accept?token=....
5. Add Nodemailer-based invitation emails.
6. Ensure invite acceptance activates the OrganizationMember record instead of creating duplicates.

Definition of done:
- An owner can invite a user and the invited user can complete signup and activate membership.
- Invitation logic is isolated from session auth and uses the dedicated token secret.

## 9. Phase 6 — Integrations Foundation

Goal: prepare the external integrations without overbuilding the MVP.

Steps:
1. Create the GitHub OAuth flow and repository connection route.
2. Implement the GitHub webhook endpoint and verify the HMAC signature before any repo lookup.
3. Create the Slack OAuth connect flow and store the integration payload in the integration model.
4. Create the Jira OAuth connect flow and implement the refresh-token path for expired access tokens.
5. Create the Gemini summary service and add the empty-data guard before any API call.
6. Prepare nodemailer for invitation and report emails, ensuring only active members with email notifications enabled receive reports.

Definition of done:
- Each integration can connect and store its auth state safely.
- The webhook and sync paths follow the required upsert and tenant-scoping rules.

## 10. Phase 7 — Local Validation and Hardening

Goal: verify the foundation before moving to deployment.

Steps:
1. Start the backend and confirm MongoDB connectivity.
2. Start the frontend and confirm the login and redirect behavior.
3. Test registration, login, org creation, and invitation acceptance.
4. Test the GitHub OAuth flow and a sample webhook payload.
5. Test the Slack and Jira connect flows and confirm token persistence.
6. Confirm Gemini returns a summary for sample data and returns the fallback message when there is no data.
7. Confirm that invitation and report emails are delivered correctly.

Definition of done:
- The local MVP is stable enough to support the first real product workflow.
- The critical happy paths are documented and reproducible.

## 11. Phase 8 — Deployment Preparation

Goal: make the app production-ready without introducing new stack changes.

Steps:
1. Prepare Vercel deployment settings for the client app.
2. Prepare Render or Railway deployment settings for the server app.
3. Add all production environment variables in the deployment platform settings.
4. Update OAuth callback and webhook URLs to the live backend host.
5. Whitelist the deployment platform IPs in MongoDB Atlas.

Definition of done:
- The deployed client and server can talk to each other using the live environment settings.

## 12. Execution Order for the First Sprint

Follow this order exactly:

1. Repo scaffold and environment files.
2. MongoDB connection and all 10 Mongoose models.
3. Auth middleware and Joi validation pattern.
4. Register and login flow.
5. GitHub OAuth sign-in.
6. Organization creation.
7. Invite flow with token and email delivery.
8. Then move to GitHub repo connect, webhooks, and integration sync flows.

## 13. Risk Controls for a Conflict-Free Foundation

- Do not introduce a monorepo toolchain, shared package workspace, or alternative framework.
- Avoid mixing new package versions with the pinned baseline unless there is a documented compatibility reason.
- Make schema changes only after updating the design documents.
- Keep the server and client separated, with the client calling the server through a single configured API base URL.
- Implement RBAC and organization scoping at the middleware layer before adding business features.

## 14. Expected Outcome

By the end of this plan, the repository will have a stable foundation for the PulseOps MVP:
- a working Next.js client,
- an Express.js API server,
- MongoDB-backed tenant-aware models,
- auth and RBAC with organization context,
- a ready-to-extend integration layer,
- and a deployment path for Vercel and Render or Railway.

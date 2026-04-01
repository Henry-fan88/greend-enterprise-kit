# GreenD Enterprise Kit

This directory is a separate deployment kit. It does not change your existing `GreenD` project.

## What is inside

- `greend-company-server/`
  Runs the full GreenD web app on the company server and stores all JSON data on that server.
- `greend-desktop-app/`
  Runs a desktop Electron shell on employee machines and opens the central GreenD server in a dedicated app window.

## Why this shape

If multiple employees use GreenD, the data layer must live behind one central server process. Running a separate backend on every desktop against the same shared JSON files would create write conflicts.

This kit keeps:

- one central server instance
- one shared company-owned data directory
- many desktop clients

## What "package split" means

You do not ship the same artifact to both sides.

- `greend-company-server/` becomes an npm-installable server package for IT to install on the company server.
- `greend-desktop-app/` becomes a native installer for each employee desktop.

End users do not need the desktop source package. They only receive the built installer output such as `.dmg` or `.exe`.

## How the desktop app knows the right server

The desktop app does not access raw files directly. It only opens the GreenD server URL.

That means all desktop users point to the same company server if they use the same URL, for example:

- `https://greend.company.internal`
- `https://esg.mycompany.com`

Recommended approach:

1. Give the server a stable internal hostname.
2. Put that URL into user instructions or IT onboarding.
3. On first launch, users enter that URL once.
4. The app saves it in the OS app-data directory for future launches.

## Recommended rollout

### On the company server

1. Open `greend-company-server/`
2. Copy `.env.example` to `.env`
3. Set `GREEND_DATA_DIR`, `SESSION_SECRET`, and `DEFAULT_ADMIN_PASSWORD`
4. Run `npm install`
5. Run `npm run build`
6. Run `npm run server`

Or, after publishing the package to your private registry:

1. `npm install @your-company/greend-company-server`
2. `npx greend-server init --data-dir /srv/greend/data --admin-password '<strong-password>'`
3. `npx greend-server start`

### On employee desktops

Distribute the generated native installer for the employee’s operating system:

- macOS: `.dmg`
- Windows: `.exe`

On first launch, the user enters the company server URL once.

See:

- [RELEASE_WORKFLOW.md](/Users/fanleheng/Desktop/GreenD-Enterprise-Kit/docs/RELEASE_WORKFLOW.md)
- [USER_COMMUNICATION.md](/Users/fanleheng/Desktop/GreenD-Enterprise-Kit/docs/USER_COMMUNICATION.md)

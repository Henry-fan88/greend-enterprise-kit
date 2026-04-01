# GreenD Desktop App

This Electron app is a thin desktop shell for the central GreenD server.

It does not persist ESG data locally. All real data stays on the company server.

## How it finds the correct company server

The app resolves the server URL in this order:

1. `GREEND_SERVER_URL` environment variable
2. Saved user config in the OS app-data directory
3. First-launch setup screen

This is the correct production model because packaged installers cannot safely write config into the app bundle itself.

Recommended enterprise approach:

- Give the company server a fixed internal DNS name such as `https://greend.company.internal`
- Tell users to enter that URL on first launch
- Or preconfigure it with:
  `npm run set-server-url -- https://greend.company.internal`

## Setup for development

1. Run `npm install`
2. Save the server URL:
   `npm run set-server-url -- http://<company-server>:3001`
3. Start the desktop app:
   `npm run desktop`

## Optional installer build

Run one of these:

- `npm run dist` for the current platform
- `npm run dist:mac` for macOS DMG
- `npm run dist:win` for Windows NSIS installer
- `npm run pack` for an unpacked app directory

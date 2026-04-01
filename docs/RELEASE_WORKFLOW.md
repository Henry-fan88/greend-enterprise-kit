# Release Workflow

This kit now supports two release tracks:

- `greend-company-server/`
  npm package for the company server
- `greend-desktop-app/`
  native installers for employee desktops

## Recommended repo strategy

You can keep this as one repository and use the included GitHub Actions workflows.

- Desktop workflow:
  [build-desktop-installers.yml](/Users/fanleheng/Desktop/GreenD-Enterprise-Kit/.github/workflows/build-desktop-installers.yml)
- Server workflow:
  [verify-server-package.yml](/Users/fanleheng/Desktop/GreenD-Enterprise-Kit/.github/workflows/verify-server-package.yml)

## Server package release

1. Choose a real package name such as `@your-company/greend-company-server`
2. Update `greend-company-server/package.json`
3. Publish to a private npm registry
4. IT installs with:

```bash
npm install @your-company/greend-company-server
npx greend-server init --data-dir /srv/greend/data --admin-password '<strong-password>'
npx greend-server start
```

## Desktop installer release

1. Run the desktop workflow on GitHub Actions
2. Download the generated installers from workflow artifacts
3. Distribute:
   - macOS: `.dmg`
   - Windows: `.exe`

## Signing

The current workflow builds unsigned installers for testing.

For production rollout you should add:

- Apple Developer signing + notarization for macOS
- Code signing certificate for Windows

Without signing:

- macOS Gatekeeper will warn
- Windows SmartScreen may warn

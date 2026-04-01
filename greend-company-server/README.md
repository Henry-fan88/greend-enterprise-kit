# GreenD Company Server

This project runs the central GreenD server inside the enterprise network.

It serves both:

- the React UI
- the Express API

All persistent files are written to `GREEND_DATA_DIR` on the company server, not to employee desktops.

## Setup

### Local repo setup

1. Copy `.env.example` to `.env`.
2. Set `GREEND_DATA_DIR` to a folder on the company server.
3. Set a real `SESSION_SECRET`.
4. Set a strong `DEFAULT_ADMIN_PASSWORD`.
5. Run `npm install`.
6. Run `npm run build`.
7. Run `npm run server`.

### npm package setup

If you publish this package to npm or a private registry, the intended workflow is:

1. `npm install @your-scope/greend-company-server`
2. `npx greend-server init --data-dir /srv/greend/data --admin-password '<strong-password>'`
3. `npx greend-server start`

Default URL: `http://<server-host>:3001`

## Notes

- The first boot creates the default admin only if no users file exists yet.
- If you later move the data directory, move the full contents of `GREEND_DATA_DIR`.
- Multiple employee desktops should connect to this single server instance.

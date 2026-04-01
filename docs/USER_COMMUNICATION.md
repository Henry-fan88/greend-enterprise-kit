# What To Tell IT And End Users

## What to tell IT

Use language like this:

> GreenD has two deployment pieces. The company server package stores all ESG data and must be installed once on the central server. The desktop app does not store ESG data locally. It only connects to the central GreenD server URL.

> Please assign GreenD a stable internal hostname, for example `https://greend.company.internal`, and provide that URL to employees.

> The filesystem data path is configured only on the server side through `GREEND_DATA_DIR`. End users should never be asked for a data folder path.

## What to tell end users

Use language like this:

> Install GreenD using the company-provided installer for your operating system.

> On first launch, enter the GreenD server URL provided by IT, for example `https://greend.company.internal`.

> After that, GreenD will remember the server address on your computer. You do not need to enter any file path or shared-drive path.

## What not to tell end users

Do not ask users for:

- the company server filesystem path
- the ESG data folder path
- a shared drive path for JSON files

Those are server-side concerns only.

## Support script for helpdesk

If a user asks why their desktop app cannot find the data, the correct answer is:

> The desktop app does not open company data files directly. It connects to the GreenD company server. Please confirm that your server URL is correct and that the server is reachable on the company network.

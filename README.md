# Chery Quotation Calculator

A responsive, installable web app for Chery sales consultants to prepare vehicle quotations, estimate loan repayments, check salary eligibility, and share consultant contact details.

## Features

- Vehicle and model-year selection
- On-the-road price, rebate, insurance, and NCD calculations
- Fixed-rate loan estimates for standard or custom tenures
- Percentage-based or fixed-amount downpayments
- Optional add-ons and Okuan rebate support
- Salary eligibility guide with full-loan and 10% downpayment modes
- Consultant profiles selected through the `consultant` URL parameter
- Responsive desktop and mobile layouts
- Progressive Web App (PWA) manifest and service-worker caching

## Pages

| Page | Purpose |
| --- | --- |
| `index.html` | Quotation and loan calculator |
| `eligibility.html` | Salary-based vehicle eligibility guide |
| `contact.html` | Sales consultant profile and contact links |

## Getting started

This project uses plain HTML, CSS, and JavaScript. It has no build step or package dependencies.

1. Clone the repository:

   ```bash
   git clone https://github.com/azrizMY/chery-admin.git
   cd chery-admin
   ```

2. Start a local web server from the project directory. For example, with Python:

   ```bash
   python -m http.server 8000
   ```

3. Open `http://localhost:8000` in a browser.

Opening the HTML files directly with a `file://` URL is not recommended because service workers require a secure origin such as HTTPS or localhost.

## Data source

Vehicle prices, model details, promotions, add-on prices, images, and consultant profiles are loaded at runtime from:

```text
https://chery-shared-data.data-quotation.workers.dev/chery-car-data.json
```

The main response is expected to contain `cars`, `consultants`, `defaultConsultantId`, and `markups`. If the data request fails, the app displays a live-data error state.

Useful query parameters include:

- `consultant` - selects a consultant profile
- `car` - selects a vehicle by its data ID
- `year` - selects an available model year
- `loanMode` - carries the eligibility loan preset between pages

Example:

```text
http://localhost:8000/?consultant=azri&car=<vehicle-id>&year=2026
```

## Static assets

The pages expect brand assets under `/images`, including:

```text
images/
|-- logo.png
|-- chery-horizontal-logo.png
|-- chery-vertical-logo.png
`-- consultants/
    `-- azri-qr.png
```

Vehicle and consultant images may also be supplied by the live data source. Ensure the static brand assets are available in the deployed environment.

## Project structure

```text
.
|-- index.html
|-- eligibility.html
|-- contact.html
|-- style.css
|-- script.js
|-- manifest.json
|-- sw.js
`-- README.md
```

## Deployment

Deploy the repository to any static web host with HTTPS. The app uses root-relative paths such as `/sw.js` and `/images/...`, so it should be hosted at the root of its domain unless those paths are adjusted.

When changing cached app-shell files, update `CACHE_NAME` in `sw.js` so existing PWA installations receive the new version cleanly.

## Notes

- Quotation and eligibility figures are estimates and may differ from final bank or insurer calculations.
- Consultant preferences are stored locally in the browser under `chery-advisor-settings`.
- An internet connection is required to retrieve the latest live vehicle data and external web fonts.

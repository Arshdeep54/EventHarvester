# CryptoNomad & Luma Event Scraper

This project is a Node.js-based web scraper for collecting event data from [cryptonomads.org](https://cryptonomads.org) and Luma event pages. It uses Puppeteer to automate browser actions and extract structured event information, including Luma event IDs, direct event links, and Cryptonomads event page URLs.

## APIs & Scraping Targets


### Cryptonomads Scraping

- **Top-level event categories:** Scraped from the homepage
- **Event details:** Extracted from the side drawer after clicking an event row
- **Event links:**
  - Luma event link (if present)
  - Other external event links
  - Cryptonomads event page (from "Open in New Tab")


### Luma API

- **Endpoint:** `https://cryptonomads.org/api/luma/get_event`
- **Method:** POST
- **Body:** `{ "lumaEventId": "<id>" }`
- **Returns:** JSON with event details (name, description, host, agenda, datetime, location, registration link, speakers, tags)

### Cryptonomad events 

- **Endpoint:** `https://cryptonomads.org/api/airtable/events`
- **Method:** POST
- **Body:** 
```
payload = {
    "queryType": "findSideEventBySlug",
    "slug": "interopacc-TJf",
    "seriesSlug": "PermissionlessSideEvents2025"
}
```
1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Run the scraper:**
   ```bash
   npx ts-node scrapeTopLevelEvents.ts
   ```

## Usage

- The main entry point is `scrapeTopLevelEvents.ts`.
- The script will:
  1. Fetch all top-level event categories from cryptonomads.org
  2. For each event, open the side drawer and extract:
     - Luma event ID (if available)
     - Direct event link
     - Cryptonomads event page URL
  3. Attempt to fetch detailed event data from the Luma API
  4. If the Luma API fails, fallback to scraping the Cryptonomads event page (stub for now)

## Project Structure

- `src/CryptoScrapper.ts` — Main scraping logic
- `scrapeTopLevelEvents.ts` — Script to run the full scraping workflow
- `package.json` — Project dependencies


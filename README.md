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
  ```json
  {
    "queryType": "findSideEventBySlug",
    "slug": "interopacc-TJf",
    "seriesSlug": "PermissionlessSideEvents2025"
  }
  ```

## Luma API Endpoints

The scraper uses the following Luma API endpoints:

### 1. List Categories

```
GET https://api.lu.ma/discover/category/list-categories?pagination_limit=20
```

Returns a list of all available categories with their details including:

- Category name
- Description
- Event count
- API ID
- Slug

### 2. Get Category Events

```
GET https://api.lu.ma/discover/category/get-page?slug={category_slug}
```

Returns detailed information about a specific category including:

- Category details
- Timeline calendars (major events)
- Event counts
- Subscriber information
- Location details
- Event descriptions

## Setup

1. **Install dependencies:**
   ```

   ```

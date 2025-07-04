# CryptoNomad Scraper

A TypeScript-based scraper for collecting crypto event data from various sources including Cryptonomads and Luma.

## Features

- **Cryptonomads Scraper**: Scrapes events from cryptonomads.org
- **Luma Scraper**: Fetches events from Luma API (categories, major events, sub-events)
- **Data Cleaning**: Aggregates and cleans event data
- **Airtable Integration**: Push cleaned events to Airtable
- **Duplicate Prevention**: Automatically checks for existing events

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set up Environment Variables

Create a `.env` file in the root directory:

```env
AIRTABLE_API_KEY=your_airtable_api_key
AIRTABLE_BASE_ID=your_base_id
AIRTABLE_TABLE_NAME=Events
```

### 3. Run Scrapers

#### Using Command-Line Arguments

```bash
# Run Luma scraper
npm run scrape -- --luma

# Run Cryptonomad scraper
npm run scrape -- --nomad

# Short flags
npm run scrape -- -l    # Luma
npm run scrape -- -n    # Nomad
```

#### Direct Scripts

```bash
# Run Luma scraper directly
npm run scrape:luma

# Run Cryptonomad scraper directly
npm run scrape:nomad

# Clean and aggregate events
npm run clean

# Push events to Airtable
npm run push:airtable
```

### 4. Data Flow

1. **Scrape Events**: Run scrapers to collect raw data

   - Luma events saved as `data/luma_{url}.json`
   - Cryptonomad events saved as `data/nomad_{id}.json`

2. **Clean Data**: Aggregate and normalize events

   ```bash
   npm run clean
   ```

   - Output: `cleaned_events/cleaned_events.json`

3. **Push to Airtable** (Optional)
   ```bash
   npm run push:airtable
   ```

## API Endpoints

### Luma API

The scraper uses the following Luma API endpoints:

#### 1. List Categories

```
GET https://api.lu.ma/discover/category/list-categories?pagination_limit=20
```

Returns a list of all available categories with their details.

#### 2. Get Category Events

```
GET https://api.lu.ma/discover/category/get-page?slug={category_slug}
```

Returns detailed information about a specific category including timeline calendars.

#### 3. Get Calendar Events

```
GET https://api.lu.ma/calendar/get-items?calendar_api_id={api_id}&pagination_limit=20&period=future
```

Returns all events for a specific calendar (major event).

## Project Structure

```
├── src/
│   ├── LumaScraper.ts          # Luma API scraper
│   ├── CryptoScrapper.ts       # Cryptonomads scraper
│   ├── runScraper.ts           # Main scraper runner
│   ├── scrapeLuma.ts           # Luma scraper script
│   └── scrapeTopLevelEvents.ts # Cryptonomads scraper script
├── cleaning/
│   ├── clean_events.ts         # Data cleaning and aggregation
│   └── push_to_airtable.ts     # Airtable integration
├── data/                       # Raw scraped data
├── cleaned_events/             # Cleaned and aggregated data
└── types/
    └── luma.ts                 # TypeScript type definitions
```

## Available Commands

| Command                     | Description                           |
| --------------------------- | ------------------------------------- |
| `npm run scrape -- --luma`  | Run Luma scraper with argument        |
| `npm run scrape -- --nomad` | Run Cryptonomad scraper with argument |
| `npm run scrape:luma`       | Run Luma scraper directly             |
| `npm run scrape:nomad`      | Run Cryptonomad scraper directly      |
| `npm run clean`             | Clean and aggregate events            |
| `npm run push:airtable`     | Push events to Airtable               |
| `npm run scrape -- -l`      | Short flag for Luma                   |
| `npm run scrape -- -n`      | Short flag for Nomad                  |

## Data Output Format

Cleaned events follow this structure:

```json
{
  "name": "Event Name",
  "tags": ["Conference", "Web3"],
  "topics": "DeFi, Blockchain",
  "maplink": "https://maps.google.com/...",
  "location": "Berlin, Germany",
  "seriesName": "Berlin Blockchain Week",
  "eventSeries": "BBW2025",
  "startdate": "2025-06-18T09:00:00.000Z",
  "enddate": "2025-06-18T18:00:00.000Z",
  "id": "unique_event_id",
  "short_description": "Brief event description",
  "description": "Full event description",
  "organiser": "Event Organizer"
}
```

## Airtable Setup

1. Create a base in Airtable
2. Create a table named "Events" with the following fields:

   - `id` (Single line text) - Primary field
   - `name` (Single line text)
   - `tags` (Multiple select)
   - `topics` (Single line text)
   - `maplink` (URL)
   - `location` (Single line text)
   - `seriesName` (Single line text)
   - `eventSeries` (Single line text)
   - `startdate` (Date)
   - `enddate` (Date)
   - `short_description` (Long text)
   - `description` (Long text)
   - `organiser` (Single line text)

3. Add your API key, base ID, and table name to `.env`

## Complete Workflow Example

```bash
# 1. Scrape events from Luma
npm run scrape:luma

# 2. Scrape events from Cryptonomads
npm run scrape:nomad

# 3. Clean and aggregate all events
npm run clean

```

## Running the Test Events API with Docker Compose

The test events API is provided for local development and testing. It uses Postgres for storage and is fully Dockerized.

### 1. Start the Test API and Database

```bash
cd tests/events-api
# Build and start the API and Postgres
docker-compose up --build
```

- The API will be available at [http://localhost:3000/events](http://localhost:3000/events)
- The database is available on port 55432 (host)

### 2. API Endpoints

- `POST /events/batch` — Batch ingest events
- `GET /events` — View all events in an HTML table

---

## Running the Cron Job with Docker Compose

The cron job scrapes, cleans, and pushes events to your API every 12 hours. It is fully Dockerized and can be configured for local or production use.

### 1. .env Setup

Create a `.env` file in your project root:

```env
# For local testing (use your host IP, not localhost)
EVENTS_API_URL=http://172.17.0.1:3000/events/batch

# For production, update this to your real API endpoint
# EVENTS_API_URL=https://your-production-api.com/events/batch
```

- Replace `172.17.0.1` with your actual Docker host IP (see below).
- To find your host IP:
  ```sh
  ip route show default | awk '/default/ {print $3}'
  # or
  hostname -I | awk '{print $1}'
  ```

### 2. Build and Run the Cron Job

```bash
docker-compose up --build
```

- The cron job will run every 12 hours and log output to `src/cron/cron.log`.
- You can check logs with:
  ```sh
  docker logs <container_name>
  tail -f ./src/cron/cron.log
  ```

### 3. Connecting Cron Job to Test API

- Make sure the test API is running and accessible at the IP/port you set in `.env`.
- The cron job will POST to the API endpoint specified in `EVENTS_API_URL`.

### 4. For Production

- Change `EVENTS_API_URL` in your `.env` to your production API endpoint.
- No code changes required—just update the environment variable.

---

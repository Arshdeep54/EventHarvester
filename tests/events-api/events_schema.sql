DROP TABLE IF EXISTS events;
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  tags TEXT[],
  topics TEXT,
  maplink TEXT,
  location TEXT,
  seriesName TEXT,
  eventSeries TEXT,
  startdate TIMESTAMP NOT NULL,
  enddate TIMESTAMP,
  event_id TEXT,
  short_description TEXT,
  description TEXT,
  organiser TEXT,
  status TEXT DEFAULT 'pending',
  raw_json JSONB,
  UNIQUE (name, startdate)
); 
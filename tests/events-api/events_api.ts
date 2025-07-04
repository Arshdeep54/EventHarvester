import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});


app.post('/events/batch', async (req: Request, res: Response): Promise<void> => {
  const events = req.body;
  if (!Array.isArray(events)) {
    res.status(400).json({ error: 'Expected an array of events' });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const event of events) {
      await client.query(
        `INSERT INTO events (
          name, tags, topics, maplink, location, seriesName, eventSeries, startdate, enddate, event_id, short_description, description, organiser, status, raw_json
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
        ON CONFLICT (name, startdate) DO NOTHING`,
        [
          event.name,
          event.tags || [],
          event.topics || '',
          event.maplink || '',
          event.location || '',
          event.seriesName || '',
          event.eventSeries || '',
          event.startdate,
          event.enddate,
          event.id || '',
          event.short_description || '',
          event.description || '',
          event.organiser || '',
          event.status || 'pending',
          JSON.stringify(event),
        ]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await client.query('ROLLBACK');
    res.status(500).json({ error: message });
  } finally {
    client.release();
  }
});

app.get('/events', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM events ORDER BY startdate DESC');
    const rows = result.rows;
    let html = '<html><head><title>Events</title></head><body><h1>Events</h1><table border="1"><tr>' +
      '<th>ID</th><th>Name</th><th>Tags</th><th>Topics</th><th>Maplink</th><th>Location</th><th>Series Name</th><th>Event Series</th><th>Start Date</th><th>End Date</th><th>Event ID</th><th>Short Description</th><th>Description</th><th>Organiser</th><th>Status</th></tr>';
    for (const row of rows) {
      html += `<tr>` +
        `<td>${row.id}</td>` +
        `<td>${row.name}</td>` +
        `<td>${Array.isArray(row.tags) ? row.tags.join(', ') : ''}</td>` +
        `<td>${row.topics || ''}</td>` +
        `<td>${row.maplink || ''}</td>` +
        `<td>${row.location || ''}</td>` +
        `<td>${row.seriesname || ''}</td>` +
        `<td>${row.eventseries || ''}</td>` +
        `<td>${row.startdate || ''}</td>` +
        `<td>${row.enddate || ''}</td>` +
        `<td>${row.event_id || ''}</td>` +
        `<td>${row.short_description || ''}</td>` +
        `<td>${row.description || ''}</td>` +
        `<td>${row.organiser || ''}</td>` +
        `<td>${row.status || ''}</td>` +
        `</tr>`;
    }
    html += '</table></body></html>';
    res.send(html);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    res.status(500).send('Error fetching events: ' + message);
  }
});

app.listen(port, () => {
  console.log(`Events API listening on port ${port}`);
}); 
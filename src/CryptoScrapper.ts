import puppeteer from "puppeteer";
import type { Page } from "puppeteer";
import { getTopLevelEventPath } from "./utils/urlUtils";
// @ts-ignore
import fetch from "node-fetch";
import { EventData } from "./types/cryptonomad";
import * as fs from 'fs';
import * as path from 'path';

export class CryptoScrapper {
  async getTopLevelUrls(): Promise<string[]> {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto("https://cryptonomads.org/", { waitUntil: "networkidle2" });
    await page.waitForSelector('.event-row');
    const baseUrls = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a.event-row'));
      return anchors
        .map(a => a.getAttribute('href'))
        .filter(href => href && href.length > 1)
        .map(href => href!.replace(/\/$/, ''));
    });
    const basePaths = Array.from(new Set(baseUrls.map(getTopLevelEventPath)));
    await browser.close();
    return basePaths;
  }

  async getEventIdsFromTopLevelUrl(topLevelUrl: string): Promise<EventData[]> {
    console.log(`Getting event ids from https://cryptonomads.org${topLevelUrl}`);
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(`https://cryptonomads.org${topLevelUrl}`, { waitUntil: "networkidle2" });
    await page.waitForSelector('a.thin-side-event-row');
    
    const eventLinks = await page.$$eval('a.thin-side-event-row', anchors => anchors.map(a => a.getAttribute('href')));
    console.log(`Found ${eventLinks} events for ${topLevelUrl}`);
    
    const events: EventData[] = [];
    for (const link of eventLinks) {
      if (!link) continue;
      
      // Click on the event row to open the sideDrawer
      await page.click(`a.thin-side-event-row[href="${link}"]`);
      
      // Wait for the sideDrawer to appear
      await page.waitForSelector('#sideDrawer', { timeout: 5000 });
      console.log('sideDrawer opened');
      let lumaId: string | undefined;
      let eventLink: string | undefined;
      let eventPageUrl: string | undefined;

      // 1. Try to get Luma ID
      try {
        await page.waitForSelector('#sideDrawer a[href*="lu.ma"]', { timeout: 2000 });
        const lumaHref = await page.$eval('#sideDrawer a[href*="lu.ma"]', a => a.getAttribute('href'));
        console.log('lumaHref', lumaHref);
        if (lumaHref) {
          const match = lumaHref.match(/lu\.ma\/(\w+)/);
          if (match && match[1]) lumaId = match[1];
        }
      } catch (error) {
        console.log('No Luma ID found, continuing...');
      }

      // 2. Get 'Link to event' (could be Luma or other)
      try {
        // Find the "Link to event" element using XPath
        eventLink = await page.evaluate(() => {
            const xpath = '//a[contains(@class, "cursor-pointer") and contains(@class, "underline") and text()="Link to event"]';
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            const element = result.singleNodeValue as HTMLAnchorElement | null;
            return element?.href;
        });
        
        if (!eventLink) {
            throw new Error('Could not find "Link to event" link');
        }
        console.log('eventLink', eventLink);
      } catch (error) {
        console.log('error', error);
      }

      // 3. Get Cryptonomads event  by clicking 'Open in New Tab' div
      try {
        const newPagePromise = new Promise<string>((resolve) => {
          page.once('popup', async (newPage: Page | null) => {
            if (!newPage) {
              console.log('No new page was opened');
              return;
            }
            await newPage.waitForNavigation({ waitUntil: 'networkidle0' });
            const url = newPage.url();
            await newPage.close();
            resolve(url);
          });
        });

        // Click the "Open in New Tab" div
        await page.evaluate(() => {
          const button = document.evaluate(
            '//div[contains(@class, "flex") and contains(@class, "cursor-pointer")]//span[text()="Open in New Tab"]/..',
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          ).singleNodeValue as HTMLElement | null;
          
          if (button) {
            button.click();
          }
        });

        // Wait for the new page and get its URL
        eventPageUrl = await newPagePromise;
        console.log('Event page URL:', eventPageUrl);
      } catch (error) {
        console.log('Error getting event page URL:', error);
      }

      // Close the sideDrawer by clicking the close button
      await page.click('#sideDrawer svg.cursor-pointer');
      await page.waitForFunction(() => !document.querySelector('#sideDrawer'), { timeout: 5000 });
      console.log('sideDrawer closed');
      events.push({ lumaId, eventLink, eventPageUrl }); 
    }
    
    await browser.close();
    return events;
  }

  async getLumaEventDetails(lumaEventId: string): Promise<any> {
    const url = "https://cryptonomads.org/api/luma/get_event";
    const headers = {
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.9",
      "content-type": "application/json",
      "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Linux"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "referer": "https://cryptonomads.org/",
      "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    };
    const body = JSON.stringify({ lumaEventId });
    console.log(`Getting event details for ${lumaEventId} from ${url} with body ${body}`);
    const res = await fetch(url, { 
      method: "POST", 
      headers, 
      body,
      credentials: "include"
    });
    const json = await res.json();
    return json;
  }

  extractEventDetails(apiResponse: any): any {
    const data = apiResponse?.data?.data;
    const event = data?.event;
    if (!event) return null;
    return {
      name: event.name,
      description: data?.description_mirror,
      host: data?.hosts?.map((h: any) => h.name).join(', '),
      agenda: event.agenda || null,
      datetime: event.start_at || event.date,
      location: event.geo_address_info?.full_address || event.location,
      registration_link: event.url ? `https://lu.ma/${event.url}` : null,
      speakers: event.speakers || null,
      tags: event.categories?.map((c: any) => c.name) || null
    };
  }

  async getCryptoNomadEventDetails(url: string): Promise<any> {
    try {
      // Parse URL to get seriesSlug and slug
      // Example URL: https://cryptonomads.org/BerBW2025/MasTJf
      const urlParts = url.split('/');
      const seriesSlug = urlParts[urlParts.length - 2]; // BerBW2025
      const slug = urlParts[urlParts.length - 1]; // MasTJf

      // Call Cryptonomads API
      const apiUrl = "https://cryptonomads.org/api/airtable/events";
      const payload = {
        queryType: "findSideEventBySlug",
        seriesSlug,
        slug
      };
      const headers = {
        "Content-Type": "application/json",
        "Accept": "*/*"
      };

      console.log(`Fetching event details for ${seriesSlug}/${slug}`);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();

      // Create data directory if it doesn't exist
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
      }

      // Save response to JSON file
      const filePath = path.join(dataDir, `${slug}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.log(`Saved event details to ${filePath}`);

      return data;
    } catch (error) {
      console.error('Error fetching Cryptonomads event details:', error);
      return null;
    }
  }
} 
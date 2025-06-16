import puppeteer from "puppeteer";
import type { Page } from "puppeteer";
import { getTopLevelEventPath } from "./utils/urlUtils";
// @ts-ignore
import fetch from "node-fetch";
import { EventData } from "./types/cryptonomad";

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
      
      let lumaId: string | undefined;
      let eventLink: string | undefined;
      let eventPageUrl: string | undefined;

      // 1. Try to get Luma ID
      try {
        await page.waitForSelector('#sideDrawer a[href*="lu.ma"]', { timeout: 2000 });
        const lumaHref = await page.$eval('#sideDrawer a[href*="lu.ma"]', a => a.getAttribute('href'));
        if (lumaHref) {
          const match = lumaHref.match(/lu\.ma\/(\w+)/);
          if (match && match[1]) lumaId = match[1];
        }
      } catch {}

      // 2. Get 'Link to event' (could be Luma or other)
      try {
        await page.waitForSelector('#sideDrawer a.cursor-pointer.underline', { timeout: 2000 });
        const linkVal = await page.$eval('#sideDrawer a.cursor-pointer.underline', a => a.getAttribute('href'));
        eventLink = linkVal === null ? undefined : linkVal;
      } catch {}

      // 3. Get Cryptonomads event page by clicking 'Open in New Tab' div
      try {
        // Listen for the popup event using browser.once
        const popupPromise = new Promise(resolve => browser.once('targetcreated', target => resolve(target.page())));
        await page.evaluate(() => {
          const divs = Array.from(document.querySelectorAll('#sideDrawer div.flex.cursor-pointer'));
          const openTabDiv = divs.find(div => div.textContent && div.textContent.includes('Open in New Tab'));
          if (openTabDiv) (openTabDiv as HTMLElement).click();
        });
        const newPage = await popupPromise as Page;
        await newPage.waitForNavigation({ waitUntil: 'domcontentloaded' });
        eventPageUrl = newPage.url();
        await newPage.close();
      } catch {}

      // Close the sideDrawer by clicking the close button
      await page.click('#sideDrawer svg.cursor-pointer');
      await page.waitForFunction(() => !document.querySelector('#sideDrawer'), { timeout: 5000 });
      
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
    // TODO: implement this
    return null;
  }
} 
import { CryptoScrapper } from "./CryptoScrapper";
import { EventData } from "./types/cryptonomad";

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(id);
}

async function processTopLevelUrl(scrapper: CryptoScrapper, url: string) {
  const events: EventData[] = await scrapper.getEventIdsFromTopLevelUrl(url);
  console.log(`Found ${events[0].lumaId}, ${events[0].eventLink}, ${events[0].eventPageUrl} events for ${url}`); 
  if (events.length === 0) {
    return;
  }
  for (const event of events) {
    if (event?.lumaId && isValidId(event.lumaId)) {
      try {
        const apiResponse = await scrapper.getLumaEventDetails(event.lumaId);
        const details = scrapper.extractEventDetails(apiResponse);
        if (details) {
          console.log(details);
        }
      } catch (err) {
        console.log(`Luma API failed for ${event.lumaId}, trying eventLink: ${event.eventLink}`);
        if (event.eventLink) {
          const details=await scrapper.getCryptoNomadEventDetails(event.eventLink);
          if (details) {
            console.log(details);
          }
        }
      }

    }else {
      console.log(`Invalid Luma ID: ${event.lumaId}`);
      if (event.eventLink) {
        console.log(`Trying eventLink: ${event.eventLink}`);
        await scrapper.getCryptoNomadEventDetails(event.eventLink);
      }else {
        console.log(`No eventLink found for ${event.lumaId}`);
      }
    }
  }
}

async function main() {
  const scrapper = new CryptoScrapper();
  const urls = await scrapper.getTopLevelUrls();
  console.log(urls);
  for (const url of urls) {
    if(url.includes("/e/")) {
      console.log(`Skipping ${url} because it's a future event`);
      continue;
    }
    await processTopLevelUrl(scrapper, url);
  }
}

main();
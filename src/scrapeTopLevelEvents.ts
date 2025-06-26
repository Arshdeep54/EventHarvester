import { CryptoScrapper } from "./CryptoScrapper";
import { EventData } from "./types/cryptonomad";

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(id);
}

async function processTopLevelUrl(scrapper: CryptoScrapper, url: string) {
  const events: EventData[] = await scrapper.getEventIdsFromTopLevelUrl(url);
  console.log(`Found ${events.length} events for ${url}`); 
  
  if (events.length === 0) {
    console.log(`No events found for ${url}`);
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
        console.log(`Luma API failed for ${event.lumaId}, trying eventPageUrl: ${event.eventPageUrl}`);
        if (event.eventPageUrl) {
          const details=await scrapper.getCryptoNomadEventDetails(event.eventPageUrl);
          if (details) {
            console.log(details);
          }
        }else {
          console.log(`No eventPageUrl found for ${event.lumaId}`);
        }
      }

    }else {
      console.log(`Invalid Luma ID: ${event.lumaId}`);
      if (event.eventPageUrl) {
        console.log(`Trying eventPageUrl: ${event.eventPageUrl}`);
        await scrapper.getCryptoNomadEventDetails(event.eventPageUrl);
      }else {
        console.log(`No eventPageUrl found for ${event.lumaId}`);
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
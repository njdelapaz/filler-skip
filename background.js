// Background service worker for Filler Skip extension
// Handles cross-origin requests to avoid CORS issues

console.log('Filler Skip background service worker loaded');

// Cache for shows list
let showsCache = null;

// Parse episode numbers from strings like "1-5, 10, 15-20"
function parseEpisodeNumbers(episodeString) {
  const episodes = new Set();
  const ranges = episodeString.split(",").map((range) => range.trim());

  ranges.forEach((range) => {
    if (range.includes("-")) {
      const [start, end] = range.split("-").map((num) => parseInt(num, 10));
      for (let i = start; i <= end; i++) {
        episodes.add(i);
      }
    } else {
      episodes.add(parseInt(range, 10));
    }
  });

  return Array.from(episodes).sort((a, b) => a - b);
}

// Fetch shows list from animefillerlist.com
async function fetchShowsList() {
  if (showsCache) {
    console.log('Using cached shows list');
    return showsCache;
  }

  try {
    console.log('Fetching shows list from animefillerlist.com...');
    const response = await fetch('https://www.animefillerlist.com/shows');
    console.log('Response status:', response.status);

    const html = await response.text();
    console.log('HTML length:', html.length);

    const shows = [];

    // Parse HTML using regex since DOMParser is not available in service workers
    const linkRegex = /<a[^>]*href="(\/shows\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const title = match[2].trim();

      if (title && href) {
        const url = href.startsWith('http') ? href : `https://www.animefillerlist.com${href}`;
        shows.push({ title, url });
      }
    }

    showsCache = shows;
    console.log(`Loaded ${shows.length} shows from animefillerlist.com`);
    console.log('First few shows:', shows.slice(0, 5));
    return shows;
  } catch (error) {
    console.error('Error fetching shows list:', error);
    console.error('Error details:', error.message, error.stack);
    return [];
  }
}

// Fetch filler episodes from animefillerlist.com show page
async function fetchFillerEpisodes(url) {
  try {
    console.log('Fetching filler episodes from:', url);
    const response = await fetch(url);
    console.log('Response status:', response.status);

    const html = await response.text();
    console.log('HTML length:', html.length);

    let regularFillerEpisodes = [];

    // Parse HTML using regex since DOMParser is not available in service workers
    // Strategy: Look for sections that contain both "filler" class and Episodes span
    // We'll search for a pattern that includes the filler class indicator followed by Episodes

    // First, try to find all sections with Episodes data
    // Note: Episodes span contains anchor tags with episode numbers/ranges
    // Match specifically class="filler" (using word boundary to avoid "mixed_filler" etc)
    const episodesRegex = /<div[^>]*class="(filler|[^"]*\s+filler|filler\s+[^"]*|[^"]*\s+filler\s+[^"]*)"[^>]*>([\s\S]{0,500}?)<span[^>]*class="[^"]*Episodes[^"]*"[^>]*>([\s\S]+?)<\/span>/gi;
    let match;

    console.log('Searching for filler episodes pattern...');

    while ((match = episodesRegex.exec(html)) !== null) {
      const classAttr = match[1];
      const sectionContent = match[2];
      const episodesHTML = match[3];

      console.log('Found div with class:', classAttr);
      console.log('Section content:', sectionContent.substring(0, 100));
      console.log('Episodes HTML:', episodesHTML.substring(0, 200));

      // Make sure this is class="filler" specifically (not mixed_filler or other variants)
      // Check that "filler" appears as a complete word in the class
      const classWords = classAttr.split(/\s+/);
      if (classWords.includes('filler') && !classAttr.includes('mixed')) {
        // Extract episode numbers from anchor tags within the Episodes span
        const anchorRegex = /<a[^>]*>([^<]+)<\/a>/gi;
        let anchorMatch;
        const episodeTexts = [];

        while ((anchorMatch = anchorRegex.exec(episodesHTML)) !== null) {
          episodeTexts.push(anchorMatch[1].trim());
        }

        const episodesText = episodeTexts.join(', ');
        console.log('Extracted episodes text:', episodesText);

        regularFillerEpisodes = parseEpisodeNumbers(episodesText);
        console.log(`Found ${regularFillerEpisodes.length} regular filler episodes`);
        break;
      } else {
        console.log('Skipping non-filler or mixed filler section');
      }
    }

    // Fallback: If the above didn't work, try looking for the pattern more broadly
    if (regularFillerEpisodes.length === 0) {
      console.log('Trying fallback method...');

      // Look for <div class="filler"> followed by Episodes span
      // More lenient regex that allows more space between div and span
      const fallbackRegex = /<div[^>]*class="(filler|[^"]*\s+filler|filler\s+[^"]*)"[^>]*>([\s\S]{0,1000}?)<span[^>]*class="[^"]*Episodes[^"]*"[^>]*>([\s\S]+?)<\/span>/gi;
      let fallbackMatch;

      while ((fallbackMatch = fallbackRegex.exec(html)) !== null) {
        const classAttr = fallbackMatch[1];
        const episodesHTML = fallbackMatch[3];

        console.log('Fallback: Found div with class:', classAttr);

        // Check that "filler" appears as a complete word (not mixed_filler)
        const classWords = classAttr.split(/\s+/);
        if (classWords.includes('filler') && !classAttr.includes('mixed')) {
          // Extract episode numbers from anchor tags
          const anchorRegex = /<a[^>]*>([^<]+)<\/a>/gi;
          let anchorMatch;
          const episodeTexts = [];

          while ((anchorMatch = anchorRegex.exec(episodesHTML)) !== null) {
            episodeTexts.push(anchorMatch[1].trim());
          }

          const episodesText = episodeTexts.join(', ');
          console.log('Extracted episodes text (fallback):', episodesText);

          regularFillerEpisodes = parseEpisodeNumbers(episodesText);
          console.log(`Found ${regularFillerEpisodes.length} filler episodes (fallback)`);
          break;
        } else {
          console.log('Fallback: Skipping non-filler or mixed section');
        }
      }
    }

    if (regularFillerEpisodes.length === 0) {
      console.log('No filler episodes found in HTML');
    }

    return regularFillerEpisodes;
  } catch (error) {
    console.error('Error fetching filler episodes:', error);
    console.error('Error details:', error.message, error.stack);
    return [];
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchShowsList') {
    fetchShowsList().then(shows => {
      sendResponse({ shows });
    }).catch(error => {
      sendResponse({ error: error.message });
    });
    return true; // Indicates we will send a response asynchronously
  }

  if (request.action === 'fetchFillerEpisodes') {
    fetchFillerEpisodes(request.url).then(episodes => {
      sendResponse({ episodes });
    }).catch(error => {
      sendResponse({ error: error.message });
    });
    return true; // Indicates we will send a response asynchronously
  }
});

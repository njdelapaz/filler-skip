// Content script that runs on Crunchyroll pages
console.log('Filler Skip extension loaded on Crunchyroll!');

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

// Levenshtein distance calculation
function levenshteinDistance(str1, str2) {
  const matrix = [];
  const len1 = str1.length;
  const len2 = str2.length;

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }

  return matrix[len1][len2];
}

// Fuzzy matching function using Levenshtein distance
function fuzzyMatch(searchTitle, targetTitle) {
  const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const search = normalize(searchTitle);
  const target = normalize(targetTitle);

  // Exact match
  if (search === target) return 1.0;

  // Check if search is contained in target or vice versa
  if (target.includes(search) || search.includes(target)) {
    return 0.9;
  }

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(search, target);
  const maxLen = Math.max(search.length, target.length);
  const similarity = 1 - (distance / maxLen);

  return similarity;
}

// Find best matching show
function findBestMatch(title, shows) {
  if (!shows || shows.length === 0) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const show of shows) {
    const score = fuzzyMatch(title, show.title);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = show;
    }
  }

  // Only return match if similarity is above threshold (0.5)
  return bestScore >= 0.5 ? bestMatch : null;
}

// Fetch shows list from animefillerlist.com
async function fetchShowsList() {
  if (showsCache) {
    return showsCache;
  }

  try {
    const response = await fetch('https://www.animefillerlist.com/shows');
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const shows = [];
    const links = doc.querySelectorAll('a[href^="/shows/"]');

    links.forEach(link => {
      const title = link.textContent.trim();
      const href = link.getAttribute('href');
      if (title && href) {
        const url = href.startsWith('http') ? href : `https://www.animefillerlist.com${href}`;
        shows.push({ title, url });
      }
    });

    showsCache = shows;
    console.log(`Loaded ${shows.length} shows from animefillerlist.com`);
    return shows;
  } catch (error) {
    console.error('Error fetching shows list:', error);
    return [];
  }
}

// Fetch filler episodes from animefillerlist.com show page
async function fetchFillerEpisodes(url) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const fillerDiv = doc.querySelector('.filler');
    let regularFillerEpisodes = [];

    if (fillerDiv) {
      const fillerEpisodesElement = fillerDiv.querySelector('.Episodes');
      if (fillerEpisodesElement) {
        const fillerEpisodesText = fillerEpisodesElement.textContent;
        regularFillerEpisodes = parseEpisodeNumbers(fillerEpisodesText);
        console.log(`Found ${regularFillerEpisodes.length} filler episodes`);
      }
    }

    return regularFillerEpisodes;
  } catch (error) {
    console.error('Error fetching filler episodes:', error);
    return [];
  }
}

// Extract episode number from title (e.g., "E3 - Title" -> 3)
function extractEpisodeNumber(titleText) {
  const match = titleText.match(/E(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// Show filler notification
function showFillerNotification() {
  // Check if notification already exists
  if (document.getElementById('filler-notification')) {
    return;
  }

  const notification = document.createElement('div');
  notification.id = 'filler-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff4444;
    color: white;
    padding: 15px 20px;
    border-radius: 5px;
    font-family: Arial, sans-serif;
    font-weight: bold;
    font-size: 16px;
    z-index: 10000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  `;
  notification.textContent = 'This is filler!';
  document.body.appendChild(notification);
  console.log('Filler notification displayed');
}

// Check if current episode is filler
async function checkIfFiller() {
  // Only run on watch pages
  if (!window.location.pathname.includes('/watch/')) {
    console.log('Not on a watch page, skipping filler check');
    return;
  }

  // Wait for page to load
  await new Promise(resolve => {
    if (document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('load', resolve);
    }
  });

  // Give the page a moment to render
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Get anime title
  const titleElement = document.querySelector('[data-t="show-title-link"] h4');
  if (!titleElement) {
    console.log('Could not find anime title element');
    return;
  }
  const animeTitle = titleElement.textContent.trim();
  console.log(`Anime title: ${animeTitle}`);

  // Get episode number
  const episodeTitleElement = document.querySelector('h1.title');
  if (!episodeTitleElement) {
    console.log('Could not find episode title element');
    return;
  }
  const episodeTitle = episodeTitleElement.textContent.trim();
  const episodeNumber = extractEpisodeNumber(episodeTitle);

  if (!episodeNumber) {
    console.log('Could not extract episode number from:', episodeTitle);
    return;
  }
  console.log(`Current episode: ${episodeNumber}`);

  // Check if filler data exists in storage
  const storageKey = `filler_${animeTitle.toLowerCase().replace(/[^\w]/g, '_')}`;
  let result = await chrome.storage.local.get(storageKey);

  // If not in storage, fetch it
  if (!result[storageKey]) {
    console.log(`No filler data found in storage for "${animeTitle}". Fetching...`);

    // Fetch shows list and find match
    const shows = await fetchShowsList();
    const match = findBestMatch(animeTitle, shows);

    if (!match) {
      console.log(`No match found for "${animeTitle}"`);
      return;
    }
    console.log(`Matched "${animeTitle}" to "${match.title}"`);

    // Fetch filler episodes
    const fillerEpisodes = await fetchFillerEpisodes(match.url);

    // Store filler data in chrome.storage
    await chrome.storage.local.set({
      [storageKey]: {
        animeTitle: animeTitle,
        fillerEpisodes: fillerEpisodes,
        matchedTitle: match.title,
        url: match.url,
        timestamp: Date.now()
      },
      'current_anime': storageKey
    });
    console.log(`Stored filler data for "${animeTitle}" in chrome.storage`);

    // Update result with newly fetched data
    result[storageKey] = {
      animeTitle: animeTitle,
      fillerEpisodes: fillerEpisodes,
      matchedTitle: match.title,
      url: match.url,
      timestamp: Date.now()
    };
  } else {
    console.log(`Loaded filler data from storage for "${animeTitle}"`);
  }

  const fillerData = result[storageKey];
  const fillerEpisodes = fillerData.fillerEpisodes;
  console.log(`Found ${fillerEpisodes.length} filler episodes`);

  // Check if current episode is filler
  if (fillerEpisodes.includes(episodeNumber)) {
    console.log(`Episode ${episodeNumber} is FILLER!`);
    showFillerNotification();
  } else {
    console.log(`Episode ${episodeNumber} is not filler`);
  }
}

// Run filler check on page load
checkIfFiller();

// Watch for URL changes (for SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    console.log('URL changed to:', currentUrl);

    // Remove old notification if it exists
    const oldNotification = document.getElementById('filler-notification');
    if (oldNotification) {
      oldNotification.remove();
    }

    // Re-run filler check for new episode
    if (currentUrl.includes('/watch/')) {
      checkIfFiller();
    }
  }
}).observe(document, { subtree: true, childList: true });

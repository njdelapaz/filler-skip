// Popup script for Filler Skip extension

// Cache for shows list
let showsCache = null;

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

document.addEventListener('DOMContentLoaded', function() {
  console.log('Filler Skip popup loaded!');

  // Check if we're on a Crunchyroll tab
  chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
    const currentTab = tabs[0];
    if (currentTab.url && currentTab.url.includes('crunchyroll.com')) {
      console.log('Active on Crunchyroll!');

      // Check if we're on a watch page
      if (currentTab.url.includes('crunchyroll.com/watch')) {
        // Extract the anime title from the page
        chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          func: () => {
            const titleElement = document.querySelector('[data-t="show-title-link"] h4');
            return titleElement ? titleElement.textContent.trim() : null;
          }
        }, async (results) => {
          if (results && results[0] && results[0].result) {
            const title = results[0].result;
            const animeTitleDiv = document.getElementById('animeTitle');
            if (animeTitleDiv) {
              // Fetch shows list and find match
              const shows = await fetchShowsList();
              const match = findBestMatch(title, shows);
              
              if (match) {
                animeTitleDiv.innerHTML = `<strong>Watching:</strong> <a href="${match.url}" target="_blank">${title}</a>`;
                console.log(`Matched "${title}" to "${match.title}" (${match.url})`);
              } else {
                animeTitleDiv.innerHTML = `<strong>Watching:</strong> ${title}`;
                console.log(`No match found for "${title}"`);
              }
              animeTitleDiv.classList.add('show');
            }
          }
        });
      }
    }
  });

  // Add click handler for the button
  const clickButton = document.getElementById('clickButton');
  if (clickButton) {
    clickButton.addEventListener('click', function() {
      alert('clicked');
    });
  }
});


// Popup script for Filler Skip extension

// Helper to render anime title and filler episodes with expandable list
function renderAnimeInfo(animeTitleDiv, title, fillerEpisodes, url) {
  let displayHTML = `<strong>Watching:</strong> <a href="${url}" target="_blank">${title}</a>`;

  if (fillerEpisodes.length > 0) {
    if (fillerEpisodes.length > 10) {
      const firstFew = fillerEpisodes.slice(0, 10).join(', ');
      const remainingCount = fillerEpisodes.length - 10;
      const allEpisodes = fillerEpisodes.join(', ');

      displayHTML += `<br><strong>Filler Episodes:</strong> ` +
        `<span id="episodesShort">${firstFew}</span>` +
        ` <span id="showAllEpisodes" style="cursor:pointer; color:#f47521; font-size:12px;">(+${remainingCount} more)</span>` +
        `<span id="episodesFull" style="display:none;">${allEpisodes}</span>`;
    } else {
      const displayEpisodes = fillerEpisodes.join(', ');
      displayHTML += `<br><strong>Filler Episodes:</strong> ${displayEpisodes}`;
    }
  } else {
    displayHTML += `<br><em>No filler episodes found</em>`;
  }

  animeTitleDiv.innerHTML = displayHTML;

  // Attach click handler to expand the full list, if applicable
  const showAll = document.getElementById('showAllEpisodes');
  const episodesShort = document.getElementById('episodesShort');
  const episodesFull = document.getElementById('episodesFull');

  if (showAll && episodesShort && episodesFull) {
    showAll.addEventListener('click', (e) => {
      e.preventDefault();
      episodesShort.textContent = episodesFull.textContent;
      showAll.style.display = 'none';
    });
  }
}

document.addEventListener('DOMContentLoaded', function() {
  console.log('Filler Skip popup loaded!');

  // Initialize enable/disable auto-skip button
  const toggleSkipButton = document.getElementById('toggleSkipButton');
  if (toggleSkipButton) {
    chrome.storage.local.get('skip_enabled', (result) => {
      const enabled = result.skip_enabled !== false; // default to true
      toggleSkipButton.textContent = enabled ? 'Disable Auto-Skip' : 'Enable Auto-Skip';
    });

    toggleSkipButton.addEventListener('click', () => {
      chrome.storage.local.get('skip_enabled', (result) => {
        const current = result.skip_enabled !== false; // default to true
        const next = !current;
        chrome.storage.local.set({ skip_enabled: next }, () => {
          toggleSkipButton.textContent = next ? 'Disable Auto-Skip' : 'Enable Auto-Skip';
        });
      });
    });
  }

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
              // Read filler data from chrome.storage (populated by content.js)
              const storageKey = `filler_${title.toLowerCase().replace(/[^\w]/g, '_')}`;
              const result = await chrome.storage.local.get(storageKey);

              if (result[storageKey]) {
                const fillerData = result[storageKey];
                const fillerEpisodes = fillerData.fillerEpisodes;
                const url = fillerData.url;

                console.log(`Found ${fillerEpisodes.length} filler episodes:`, fillerEpisodes);
                renderAnimeInfo(animeTitleDiv, title, fillerEpisodes, url);
              } else {
                // No data yet - content script will fetch it
                animeTitleDiv.innerHTML = `<strong>Watching:</strong> ${title}<br><em>Loading filler data...</em>`;
              }

              animeTitleDiv.classList.add('show');
            }
          }
        });
      }
    }
  });

  // Listen for storage changes (when content script fetches new filler data)
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local' && changes.current_anime) {
      console.log('Filler data updated, refreshing popup...');

      // Get current tab info to update display
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      const currentTab = tabs[0];

      if (currentTab.url && currentTab.url.includes('crunchyroll.com/watch')) {
        chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          func: () => {
            const titleElement = document.querySelector('[data-t="show-title-link"] h4');
            return titleElement ? titleElement.textContent.trim() : null;
          }
        }, async (results) => {
          if (results && results[0] && results[0].result) {
            const title = results[0].result;
            const storageKey = `filler_${title.toLowerCase().replace(/[^\w]/g, '_')}`;
            const result = await chrome.storage.local.get(storageKey);

            if (result[storageKey]) {
              const fillerData = result[storageKey];
              const fillerEpisodes = fillerData.fillerEpisodes;
              const url = fillerData.url;

              const animeTitleDiv = document.getElementById('animeTitle');
              if (animeTitleDiv) {
                renderAnimeInfo(animeTitleDiv, title, fillerEpisodes, url);
              }
            }
          }
        });
      }
    }
  });

  // Add click handler for the clear cache button
  const clearCacheButton = document.getElementById('clearCacheButton');
  if (clearCacheButton) {
    clearCacheButton.addEventListener('click', async function() {
      // Clear all storage
      await chrome.storage.local.clear();
      console.log('Cache cleared!');

      // Update the display
      const animeTitleDiv = document.getElementById('animeTitle');
      if (animeTitleDiv) {
        animeTitleDiv.innerHTML = '<em>Cache cleared! Refresh the page to reload filler data.</em>';
        animeTitleDiv.classList.add('show');
      }

      // Show confirmation
      alert('Cache cleared successfully!');
    });
  }
});

// Popup script for Filler Skip extension

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
              // Read filler data from chrome.storage (populated by content.js)
              const storageKey = `filler_${title.toLowerCase().replace(/[^\w]/g, '_')}`;
              const result = await chrome.storage.local.get(storageKey);

              if (result[storageKey]) {
                const fillerData = result[storageKey];
                const fillerEpisodes = fillerData.fillerEpisodes;
                const url = fillerData.url;

                // Display anime title and filler episodes
                let displayHTML = `<strong>Watching:</strong> <a href="${url}" target="_blank">${title}</a>`;

                if (fillerEpisodes.length > 0) {
                  // Show first 10 filler episodes as proof
                  const firstFew = fillerEpisodes.slice(0, 10);
                  const displayEpisodes = firstFew.join(', ');
                  const moreText = fillerEpisodes.length > 10 ? ` (+${fillerEpisodes.length - 10} more)` : '';
                  displayHTML += `<br><strong>Filler Episodes:</strong> ${displayEpisodes}${moreText}`;
                  console.log(`Found ${fillerEpisodes.length} filler episodes:`, fillerEpisodes);
                } else {
                  displayHTML += `<br><em>No filler episodes found</em>`;
                }

                animeTitleDiv.innerHTML = displayHTML;
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
                let displayHTML = `<strong>Watching:</strong> <a href="${url}" target="_blank">${title}</a>`;

                if (fillerEpisodes.length > 0) {
                  const firstFew = fillerEpisodes.slice(0, 10);
                  const displayEpisodes = firstFew.join(', ');
                  const moreText = fillerEpisodes.length > 10 ? ` (+${fillerEpisodes.length - 10} more)` : '';
                  displayHTML += `<br><strong>Filler Episodes:</strong> ${displayEpisodes}${moreText}`;
                } else {
                  displayHTML += `<br><em>No filler episodes found</em>`;
                }

                animeTitleDiv.innerHTML = displayHTML;
              }
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

// Popup script for Filler Skip extension
document.addEventListener('DOMContentLoaded', function() {
  console.log('Filler Skip popup loaded!');

  // Check if we're on a Crunchyroll tab
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    if (currentTab.url && currentTab.url.includes('crunchyroll.com')) {
      console.log('Active on Crunchyroll!');
    }
  });
});

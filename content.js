// Content script that runs on Crunchyroll pages
console.log('Filler Skip extension loaded on Crunchyroll!');

// You can add functionality here to detect and skip filler episodes
// For example, detecting filler episodes and automatically skipping them

// Example: Show a notification when the extension is active
function showNotification() {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #f47521;
    color: white;
    padding: 15px 20px;
    border-radius: 5px;
    font-family: Arial, sans-serif;
    z-index: 10000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  `;
  notification.textContent = 'Hi! Filler Skip is active';
  document.body.appendChild(notification);

  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Show notification when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', showNotification);
} else {
  showNotification();
}

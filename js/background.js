
chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('comm.html', {height: 750, width: 800});
});

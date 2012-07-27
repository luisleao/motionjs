
chrome.experimental.app.onLaunched.addListener(function() {
  chrome.app.window.create('comm.html', {frame: 'custom', height: 550, width: 800});
});

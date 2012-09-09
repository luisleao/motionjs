chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('comm.html', {height: 550, width: 800});
});

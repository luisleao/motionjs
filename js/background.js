
chrome.experimental.app.onLaunched.addListener(function() {
  chrome.windows.create({url: 'comm.html', type: 'shell', height: 550});
});

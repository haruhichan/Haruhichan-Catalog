chrome.browserAction.onClicked.addListener(function(tab) {
	chrome.tabs.create({'url': chrome.extension.getURL('home.html')}, function(tab) {});
});

// Also, since we're a background page we might want to notify on filter here!
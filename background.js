// Background script for NamUs Case Tracker extension

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        trackedCases: [],
        currentCase: null,
        folders: []
    });
});

chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'openSidePanel':
            if (sender.tab) {
                try {
                    chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => {
                        sendResponse({ success: true, message: "Side panel opened" });
                    }).catch((error) => {
                        sendResponse({ success: false, message: "Error opening side panel: " + error.message });
                    });
                } catch (error) {
                    sendResponse({ success: false, message: "Exception: " + error.message });
                }
            } else {
                sendResponse({ success: false, message: "No tab information available" });
            }
            return true;

        case 'refreshSidePanel':
            try {
                chrome.runtime.sendMessage({ action: 'sidepanelRefresh' })
                    .catch(error => {
                        console.log('Side panel not ready:', error);
                    });
                sendResponse({ success: true, message: "Refresh message sent" });
            } catch (error) {
                console.log('Error sending refresh message:', error);
                sendResponse({ success: false, message: "Error sending refresh message" });
            }
            return true;

        case 'trackCase':
            storeCase(message.caseData, () => {
                chrome.storage.local.set({ currentCase: message.caseData }, () => {
                    sendResponse({ success: true });
                });
            });
            return true;

        case 'getTrackedCases':
            chrome.storage.local.get(['trackedCases'], (result) => {
                sendResponse({ cases: result.trackedCases || [] });
            });
            return true;

        case 'getCurrentCase':
            chrome.storage.local.get(['currentCase'], (result) => {
                sendResponse({ case: result.currentCase });
            });
            return true;

        case 'removeCase':
            removeCase(message.caseId, () => {
                sendResponse({ success: true });
            });
            return true;
    }
});

// Store a case in the tracked cases list
function storeCase(caseData, callback = () => { }) {
    chrome.storage.local.get(['trackedCases'], (result) => {
        const trackedCases = result.trackedCases || [];

        const existingCaseIndex = trackedCases.findIndex(c => c.caseId === caseData.caseId);

        if (existingCaseIndex === -1) {
            trackedCases.push(caseData);
        } else {
            trackedCases[existingCaseIndex] = caseData;
        }

        chrome.storage.local.set({ trackedCases }, () => {
            callback();
        });
    });
}

// Remove a case from the tracked cases list
function removeCase(caseId, callback) {
    chrome.storage.local.get(['trackedCases', 'currentCase'], (result) => {
        let trackedCases = result.trackedCases || [];
        const currentCase = result.currentCase;

        trackedCases = trackedCases.filter(c => c.caseId !== caseId);

        chrome.storage.local.set({ trackedCases });

        if (currentCase && currentCase.caseId === caseId) {
            chrome.storage.local.set({ currentCase: null });
        }

        callback();
    });
}

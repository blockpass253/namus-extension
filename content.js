// Content script for NamUs Case Tracker extension

// Function to check if we're on a case page
function isCasePage() {
    // Check if we're on a missing person or unidentified remains page
    return window.location.href.includes('/MissingPersons/Case#') ||
        window.location.href.includes('/UnidentifiedPersons/Case#');
}

// Function to extract case ID from URL
function extractCaseId() {
    const url = window.location.href;
    const hashPart = url.match(/#\/(\d+)/)?.[1];
    if (hashPart) {
        return hashPart;
    }
    return null;
}

// Function to extract case data from the page
function extractCaseData() {
    const caseId = extractCaseId();
    if (!caseId) return null;

    // Determine case type
    const isMissingPerson = window.location.href.includes('/MissingPersons/');
    const caseType = isMissingPerson ? 'Missing Person' : 'Unidentified Person';

    // Get case name/title
    let caseName = '';
    if (isMissingPerson) {
        // For missing persons, get the name
        const nameElement = document.querySelector('.data-item-fullname');
        if (nameElement) {
            caseName = nameElement.textContent.trim();
        }
    } else {
        // For unidentified persons, use the case number as name
        caseName = caseId
    }

    // Get basic case details
    const details = {};

    // Get all content subsections
    const contentSubsections = document.querySelectorAll('.content-subsection');
    contentSubsections.forEach(section => {
        // Get section title
        const sectionTitleElement = section.querySelector('h3');
        if (!sectionTitleElement) return;

        const sectionTitle = sectionTitleElement.textContent.trim();
        details[sectionTitle] = {};

        // Get all data items in this section
        const dataItems = section.querySelectorAll('.data-item');
        dataItems.forEach(item => {
            const labelElement = item.querySelector('.data-label');
            if (!labelElement) return;

            const label = labelElement.textContent.trim();
            // The value is the text content of the data-item excluding the label
            let value = item.textContent.replace(labelElement.textContent, '').trim();

            // If there's a multi-line element, use that specifically
            const multiLineElement = item.querySelector('.multi-line');
            if (multiLineElement) {
                value = multiLineElement.textContent.trim();
            }

            // Skip empty values
            if (value === '--') value = '';

            details[sectionTitle][label] = value;
        });
    });

    // Get case image if available
    let imageUrl = '';
    const imageElement = document.querySelector('.case-summary-image-frame img');
    if (imageElement && imageElement.src) {
        imageUrl = imageElement.src;
    }

    return {
        caseId,
        caseType,
        caseName,
        details,
        imageUrl,
        url: window.location.href,
        dateTracked: new Date().toISOString()
    };
}

// Function to add the Track Case button
function addTrackButton() {
    if (!isCasePage()) {
        return;
    }

    if (document.getElementById('track-case-button')) {
        return;
    }

    let targetDiv = null;

    targetDiv = document.querySelector('.row.top-row');
    if (!targetDiv) {
        return;
    }

    // Create the Track Case button
    const trackButton = document.createElement('button');
    trackButton.id = 'track-case-button';
    trackButton.className = 'track-case-button';
    trackButton.textContent = 'Track Case';
    trackButton.style.cssText = `
    background-color: #4285f4;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    font-weight: bold;
    cursor: pointer;
    margin-left: 10px;
  `;

    trackButton.addEventListener('click', () => {
        const caseData = extractCaseData();
        if (caseData) {
            // First track the case, then open the side panel
            try {
                // First track the case
                chrome.runtime.sendMessage({
                    action: 'trackCase',
                    caseData
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Error in trackCase message:", chrome.runtime.lastError);
                        return;
                    }

                    if (response && response.success) {
                        // Update button state
                        trackButton.textContent = 'Case Tracked';

                        // Then open the side panel after successful tracking
                        chrome.runtime.sendMessage({
                            action: 'openSidePanel'
                        }, () => {
                            // Send a message to refresh the side panel
                            chrome.runtime.sendMessage({
                                action: 'refreshSidePanel'
                            }, (refreshResponse) => {
                            });
                        });
                    }
                });
            } catch (error) {
                console.error("Exception when sending message:", error);
            }
        }
    });

    targetDiv.appendChild(trackButton);
}

// Function to wait for elements to be available in the DOM
function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const checkElement = () => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            if (Date.now() - startTime > timeout) {
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
                return;
            }

            setTimeout(checkElement, 100);
        };

        checkElement();
    });
}

// Run when page loads
// Wait for the page to be fully loaded before trying to add the button
window.addEventListener('load', () => {
    chrome.runtime.sendMessage({
        action: 'testMessage',
        data: 'Hello from content script'
    }, (response) => {
    });

    waitForElement('.case-summary-items')
        .then(() => {
            // Give a small delay to ensure Angular has finished rendering
            setTimeout(addTrackButton, 500);
        })
        .catch(error => {
            // Try anyway with a longer delay as a fallback
            setTimeout(addTrackButton, 1500);
        });
});

// Run when URL changes
let lastUrl = window.location.href;
new MutationObserver(() => {
    if (lastUrl !== window.location.href) {
        lastUrl = window.location.href;
        // Wait for the page to load after URL change
        waitForElement('.case-summary-items')
            .then(() => {
                setTimeout(addTrackButton, 500);
            })
            .catch(error => {
                // Try anyway with a longer delay as a fallback
                setTimeout(addTrackButton, 1500);
            });
    }
}).observe(document, { subtree: true, childList: true }); 
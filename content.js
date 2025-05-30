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

function navigateToAttachmentsTabAndExtract() {
    return new Promise((resolve) => {
        const attachmentsTabLink = Array.from(document.querySelectorAll('.menu-text a')).find(
            link => link.textContent.includes('Images & Documents')
        );

        if (!attachmentsTabLink) {
            resolve([]);
            return;
        }

        const isAlreadyOnAttachmentsTab = attachmentsTabLink.classList.contains('tab-active');
        const currentActiveTab = document.querySelector('.menu-text a.tab-active');
        const currentTabText = currentActiveTab ? currentActiveTab.textContent.trim() : '';

        if (!isAlreadyOnAttachmentsTab) {
            attachmentsTabLink.click();

            waitForAttachmentsContent()
                .then(attachments => {
                    // Return to the original tab
                    if (currentTabText) {
                        const originalTabLink = Array.from(document.querySelectorAll('.menu-text a')).find(
                            link => link.textContent.trim() === currentTabText
                        );

                        if (originalTabLink) {
                            originalTabLink.click();
                        }
                    }

                    resolve(attachments);
                })
                .catch(error => {
                    console.error("Error waiting for attachments content:", error);
                    resolve([]);
                });
        } else {
            // We're already on the attachments tab, just extract the content
            const attachments = extractAttachmentsContent();
            resolve(attachments);
        }
    });
}

// Function to wait for attachments content to be loaded
function waitForAttachmentsContent() {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const timeout = 5000;

        const checkAttachmentsLoaded = () => {
            const attachmentsContainer = document.querySelector('div.content-container[ng-controller="Attachments as subSection"]');
            if (attachmentsContainer) {
                const attachmentCards = attachmentsContainer.querySelectorAll('.attachment-card');
                const hasAttachmentCards = attachmentCards.length > 0;

                const hasNoAttachmentsMessage = attachmentsContainer.querySelector('.no-attachments-message') !== null;
                const hasZeroAttachmentsMessage = attachmentsContainer.querySelector('h3')?.textContent.includes('0 Images or Documents') === true;
                const hasNoImagesMessage = attachmentsContainer.querySelector('h4')?.textContent === 'No Images or Documents';
                const isAttachmentsTabActive = document.querySelector('.menu-text a[ng-click="vm.goToPage(\'attachments\')"].tab-active') !== null;

                // If the tab is active and either has cards or any of the "no attachments" messages, content is loaded
                if (isAttachmentsTabActive && (hasAttachmentCards || hasNoAttachmentsMessage || hasZeroAttachmentsMessage || hasNoImagesMessage)) {
                    const attachments = extractAttachmentsContent();
                    resolve(attachments);
                    return;
                }
            }

            if (Date.now() - startTime > timeout) {
                console.error(`Attachments content not loaded within ${timeout}ms`);
                reject(new Error(`Attachments content not loaded within ${timeout}ms`));
                return;
            }

            // Check again after a short delay
            setTimeout(checkAttachmentsLoaded, 100);
        };

        checkAttachmentsLoaded();
    });
}

function extractAttachmentsContent() {
    let attachments = [];

    const attachmentCards = document.querySelectorAll('.attachment-card');

    attachmentCards.forEach(card => {
        const categoryElement = card.querySelector('.attachment-category');
        const category = categoryElement ? categoryElement.textContent.trim() : '';

        const dateElement = card.querySelector('.attachment-date');
        const uploadDate = dateElement ? dateElement.textContent.replace('Subido:', '').trim() : '';

        const titleElement = card.querySelector('.attachment-title');
        const title = titleElement ? titleElement.textContent.trim() : '';

        const captionElement = card.querySelector('.attachment-caption');
        const caption = captionElement ? captionElement.textContent.trim() : '';

        let thumbnailUrl = '';
        let originalUrl = '';
        let downloadUrl = '';

        const imgElement = card.querySelector('.attachment-image img');
        if (imgElement && imgElement.src) {
            thumbnailUrl = imgElement.src;
        }

        const originalLink = card.querySelector('.attachment-display a');
        if (originalLink && originalLink.href) {
            originalUrl = originalLink.href;
        }

        const downloadLink = card.querySelector('.download-link');
        if (downloadLink && downloadLink.href) {
            downloadUrl = downloadLink.href;
        }

        // Only add attachments that have at least an image
        if (thumbnailUrl || originalUrl) {
            attachments.push({
                category,
                uploadDate,
                title,
                caption: caption === '--' ? '' : caption,
                thumbnailUrl,
                originalUrl,
                downloadUrl
            });
        }
    });

    return attachments;
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

    // Get all attachments - first check visible attachments
    let attachments = [];
    const attachmentCards = document.querySelectorAll('.attachment-card');

    attachmentCards.forEach(card => {
        const categoryElement = card.querySelector('.attachment-category');
        const category = categoryElement ? categoryElement.textContent.trim() : '';

        const dateElement = card.querySelector('.attachment-date');
        const uploadDate = dateElement ? dateElement.textContent.replace('Subido:', '').trim() : '';

        const titleElement = card.querySelector('.attachment-title');
        const title = titleElement ? titleElement.textContent.trim() : '';

        const captionElement = card.querySelector('.attachment-caption');
        const caption = captionElement ? captionElement.textContent.trim() : '';

        let thumbnailUrl = '';
        let originalUrl = '';
        let downloadUrl = '';

        const imgElement = card.querySelector('.attachment-image img');
        if (imgElement && imgElement.src) {
            thumbnailUrl = imgElement.src;
        }

        const originalLink = card.querySelector('.attachment-display a');
        if (originalLink && originalLink.href) {
            originalUrl = originalLink.href;
        }

        const downloadLink = card.querySelector('.download-link');
        if (downloadLink && downloadLink.href) {
            downloadUrl = downloadLink.href;
        }

        // Only add attachments that have at least an image
        if (thumbnailUrl || originalUrl) {
            attachments.push({
                category,
                uploadDate,
                title,
                caption: caption === '--' ? '' : caption,
                thumbnailUrl,
                originalUrl,
                downloadUrl
            });
        }
    });

    // Investigations
    const investigationsContainer = document.querySelector('.container.ng-hide[ng-show="vm.isCurrentPage(\'investigations\')"]');
    if (investigationsContainer) {
        const attachmentCards = investigationsContainer.querySelectorAll('.slide-item-container');

        attachmentCards.forEach(card => {
            let thumbnailUrl = '';
            let originalUrl = '';

            const imgElement = card.querySelector('img');
            if (imgElement && imgElement.src) {
                thumbnailUrl = imgElement.src;
            }

            const linkElement = card.querySelector('a');
            if (linkElement && linkElement.href) {
                originalUrl = linkElement.href;
            }

            // Only add attachments that have at least an image
            if (thumbnailUrl || originalUrl) {
                attachments.push({
                    category: 'Investigation',
                    uploadDate: '',
                    title: 'Investigation Image',
                    caption: '',
                    thumbnailUrl,
                    originalUrl,
                    downloadUrl: ''
                });
            }
        });
    }

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
        attachments,
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

    // Add CSS styles to the document
    if (!document.getElementById('namus-tracker-styles')) {
        const styleEl = document.createElement('style');
        styleEl.id = 'namus-tracker-styles';
        styleEl.textContent = `
            .track-case-button {
                color: white;
                border: none;
                border-radius: 4px;
                padding: 8px 16px;
                font-weight: bold;
                cursor: pointer;
                margin-left: 10px;
            }
            .track-case-button.untracked {
                background-color: #4285f4;
            }
            .track-case-button.tracked {
                background-color: #34A853;
            }
        `;
        document.head.appendChild(styleEl);
    }

    // Create the Track Case button
    const trackButton = document.createElement('button');
    trackButton.id = 'track-case-button';
    trackButton.className = 'track-case-button untracked';
    trackButton.textContent = 'Track Case';

    const currentCaseId = extractCaseId();

    // Function to update button state
    const updateButtonState = () => {
        if (currentCaseId) {
            chrome.runtime.sendMessage({ action: 'getTrackedCases' }, (response) => {
                if (response && response.cases) {
                    const isTracked = response.cases.some(c => c.caseId === currentCaseId);
                    if (isTracked) {
                        trackButton.textContent = 'Case Tracked';
                        trackButton.className = 'track-case-button tracked';
                    } else {
                        trackButton.textContent = 'Track Case';
                        trackButton.className = 'track-case-button untracked';
                    }
                }
            });
        }
    };

    // Initial state check
    updateButtonState();

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.trackedCases) {
            updateButtonState();
        }
    });

    trackButton.addEventListener('click', async () => {
        // Show loading state
        trackButton.textContent = 'Loading...';
        trackButton.disabled = true;

        try {      
            // First get the basic case data
            const caseData = extractCaseData();

            if (caseData) {
                // Navigate to the Images & Documents tab and extract its content
                const attachmentsContent = await navigateToAttachmentsTabAndExtract();

                // Update the case data with the attachments content
                caseData.attachments = attachmentsContent;

                // Send the updated case data to the background script
                chrome.runtime.sendMessage({
                    action: 'trackCase',
                    caseData
                }, (response) => {                    
                    if (chrome.runtime.lastError) {
                        console.error("Error sending message:", chrome.runtime.lastError);
                        trackButton.textContent = 'Track Case';
                        trackButton.disabled = false;
                        return;
                    }

                    if (response && response.success) {
                        trackButton.textContent = 'Case Tracked';
                        trackButton.className = 'track-case-button tracked';
                        trackButton.disabled = false;

                        chrome.runtime.sendMessage({
                            action: 'openSidePanel'
                        }, (openResponse) => {
                            if (openResponse && openResponse.success) {
                                chrome.runtime.sendMessage({
                                    action: 'refreshSidePanel'
                                }, (refreshResponse) => {
                                });
                            }
                        });
                    } else {
                        trackButton.textContent = 'Track Case';
                        trackButton.disabled = false;
                    }
                });
            } else {
                console.error('Failed to extract case data');
                trackButton.textContent = 'Track Case';
                trackButton.disabled = false;
            }
        } catch (error) {
            console.error("Exception when processing case data:", error);
            trackButton.textContent = 'Track Case';
            trackButton.disabled = false;
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
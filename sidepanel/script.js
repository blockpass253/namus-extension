// Side Panel

const currentCaseTab = document.getElementById('current-case-tab');
const trackedCasesTab = document.getElementById('tracked-cases-tab');
const currentCaseContent = document.getElementById('current-case-content');
const trackedCasesContent = document.getElementById('tracked-cases-content');
const currentCaseContainer = document.getElementById('current-case-container');
const trackedCasesList = document.getElementById('tracked-cases-list');
const featureToggle = document.getElementById('feature-toggle');
const settingsIcon = document.getElementById('settings-icon');
const settingsPanel = document.getElementById('settings-panel');
const closeSettings = document.getElementById('close-settings');
const imageModal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');
const closeModal = document.querySelector('.close-modal');

// State
let currentCase = null;
let trackedCases = [];
let featureEnabled = false;

function initSidePanel() {
    currentCaseTab.addEventListener('click', () => switchTab('current'));
    trackedCasesTab.addEventListener('click', () => switchTab('tracked'));

    settingsIcon.addEventListener('click', openSettings);
    closeSettings.addEventListener('click', closeSettingsPanel);

    featureToggle.addEventListener('change', handleFeatureToggle);

    // Modal event listeners
    closeModal.addEventListener('click', closeImageModal);
    window.addEventListener('click', (event) => {
        if (event.target === imageModal) {
            closeImageModal();
        }
    });

    loadSettings();

    loadCurrentCase();
    loadTrackedCases();

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'sidepanelRefresh') {
            loadCurrentCase();
            loadTrackedCases();
        }
    });
}

function switchTab(tabName) {
    if (tabName === 'current') {
        currentCaseTab.classList.add('active');
        trackedCasesTab.classList.remove('active');
        currentCaseContent.classList.add('active');
        trackedCasesContent.classList.remove('active');
    } else {
        currentCaseTab.classList.remove('active');
        trackedCasesTab.classList.add('active');
        currentCaseContent.classList.remove('active');
        trackedCasesContent.classList.add('active');
    }
}

function loadCurrentCase() {
    showLoading(currentCaseContainer);

    chrome.runtime.sendMessage({ action: 'getCurrentCase' }, (response) => {
        hideLoading(currentCaseContainer);

        if (response && response.case) {
            currentCase = response.case;
            renderCurrentCase();
        } else {
            renderEmptyCurrentCase();
        }
    });
}

function loadTrackedCases() {
    showLoading(trackedCasesList);

    chrome.runtime.sendMessage({ action: 'getTrackedCases' }, (response) => {
        hideLoading(trackedCasesList);

        if (response && response.cases && response.cases.length > 0) {
            trackedCases = response.cases;
            renderTrackedCases();
        } else {
            renderEmptyTrackedCases();
        }
    });
}

function renderCurrentCase() {
    if (!currentCase) {
        renderEmptyCurrentCase();
        return;
    }

    const isUnidentified = currentCase.caseType === 'Unidentified Person';
    const shouldBlur = featureEnabled && isUnidentified;

    const caseHtml = `
    <div class="case-card">
      ${currentCase.imageUrl ?
        `<img src="${currentCase.imageUrl}" alt="${currentCase.caseName}" class="case-image${shouldBlur ? ' blurred' : ''}">` :
            `<div class="case-image placeholder">No Image Available</div>`
        }
      <div class="case-header">
        <div class="case-title">${currentCase.caseName}</div>
        <div class="case-subtitle">${currentCase.caseType} | Case ID: ${currentCase.caseId}</div>
      </div>
      <div class="case-details">
        ${renderCaseDetails(currentCase.details)}
      </div>
      ${renderAttachments(currentCase.attachments, shouldBlur)}
      <div class="case-actions">
        <a href="${currentCase.url}" target="_blank" class="btn btn-primary">View on NamUs</a>
        <button id="clear-case-btn" class="btn btn-secondary">Clear Current Case</button>
        <button id="remove-case-btn" class="btn btn-danger">Remove from Tracked</button>
      </div>
    </div>
  `;

    currentCaseContainer.innerHTML = caseHtml;

    document.querySelectorAll('.attachment-thumbnail').forEach(thumbnail => {
        thumbnail.addEventListener('click', (e) => {
            const imageUrl = thumbnail.dataset.imageUrl;
            if (imageUrl) {
                openImageModal(imageUrl);
            }
        });
    });

    const removeButton = document.getElementById('remove-case-btn');
    if (removeButton) {
        removeButton.addEventListener('click', () => {
            removeCase(currentCase.caseId);
        });
    }

    const clearButton = document.getElementById('clear-case-btn');
    if (clearButton) {
        clearButton.addEventListener('click', () => {
            clearCurrentCase();
        });
    }
}

// Render case details
function renderCaseDetails(details) {
    if (!details || Object.keys(details).length === 0) {
        return '<p>No details available</p>';
    }

    let detailsHtml = '';

    for (const section in details) {
        if (!details[section] || Object.keys(details[section]).length === 0) {
            continue;
        }

        let hasContent = false;
        for (const label in details[section]) {
            if (details[section][label] && details[section][label].trim() !== '') {
                hasContent = true;
                break;
            }
        }

        if (!hasContent) {
            continue;
        }

        detailsHtml += `
      <div class="detail-section">
        <div class="section-title">${section}</div>
    `;

        for (const label in details[section]) {
            if (!details[section][label] || details[section][label].trim() === '') {
                continue;
            }

            detailsHtml += `
        <div class="detail-item">
          <div class="detail-label">${label}:</div>
          <div class="detail-value">${details[section][label]}</div>
        </div>
      `;
        }

        detailsHtml += '</div>';
    }

    if (detailsHtml.trim() === '') {
        return '<p>No details available</p>';
    }

    return detailsHtml;
}

function renderAttachments(attachments, shouldBlur) {
    if (!attachments || attachments.length === 0) {
        return '';
    }

    let attachmentsHtml = `
    <div class="detail-section">
      <div class="section-title">Attachments</div>
      <div class="attachments-grid">
    `;

    attachments.forEach(attachment => {
        attachmentsHtml += `
        <div class="attachment-item">
          <div class="attachment-thumbnail" data-image-url="${attachment.originalUrl}">
            ${attachment.thumbnailUrl ?
            `<img src="${attachment.thumbnailUrl}" alt="${attachment.title || 'Case attachment'}"${shouldBlur ? ' class="blurred"' : ''}>` :
                `<div class="placeholder">No Preview</div>`
            }
          </div>
          <div class="attachment-info">
            <a href="${attachment.originalUrl}" target="_blank" class="attachment-link">
              <div class="attachment-category">${attachment.category || 'Attachment'}</div>
              ${attachment.title ? `<div class="attachment-title">${attachment.title}</div>` : ''}
              ${attachment.uploadDate ? `<div class="attachment-date">${attachment.uploadDate}</div>` : ''}
            </a>
          </div>
          ${attachment.downloadUrl ?
                `<a href="${attachment.downloadUrl}" class="download-button" title="Download" target="_blank">
              <span class="download-icon">⬇️</span>
            </a>` : ''
            }
        </div>
      `;
    });

    attachmentsHtml += `
      </div>
    </div>
    `;

    return attachmentsHtml;
}

function renderEmptyCurrentCase() {
    currentCaseContainer.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">📋</div>
      <p>No case currently selected</p>
      <p>Visit a NamUs case page and click "Track Case" to view details here</p>
    </div>
  `;
}

function renderTrackedCases() {
    if (!trackedCases || trackedCases.length === 0) {
        renderEmptyTrackedCases();
        return;
    }

    let casesHtml = '';

    trackedCases.forEach(caseData => {
        const isActive = currentCase && currentCase.caseId === caseData.caseId;
        const hasAttachments = caseData.attachments && caseData.attachments.length > 0;
        const isUnidentified = caseData.caseType === 'Unidentified Person';
        const shouldBlur = featureEnabled && isUnidentified;

        casesHtml += `
      <div class="tracked-case-item ${isActive ? 'active' : ''}" data-case-id="${caseData.caseId}">
        ${caseData.imageUrl ?
            `<img src="${caseData.imageUrl}" alt="${caseData.caseName}" class="case-item-image${shouldBlur ? ' blurred' : ''}">` :
                `<div class="case-item-image placeholder">?</div>`
            }
        <div class="case-item-details">
          <div class="case-item-title">${caseData.caseName}</div>
          <div class="case-item-subtitle">${caseData.caseType} | Tracked: ${formatDate(caseData.dateTracked)}</div>
          ${hasAttachments ? `<div class="attachment-indicator">📎 ${caseData.attachments.length} attachment${caseData.attachments.length !== 1 ? 's' : ''}</div>` : ''}
        </div>
        <div class="case-item-actions">
          <button class="btn btn-danger remove-tracked-case" data-case-id="${caseData.caseId}">✕</button>
        </div>
      </div>
    `;
    });

    trackedCasesList.innerHTML = casesHtml;

    document.querySelectorAll('.tracked-case-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('remove-tracked-case')) {
                const caseId = item.dataset.caseId;
                selectCase(caseId);
            }
        });
    });

    document.querySelectorAll('.remove-tracked-case').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const caseId = button.dataset.caseId;
            removeCase(caseId);
        });
    });
}

function renderEmptyTrackedCases() {
    trackedCasesList.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">🔍</div>
      <p>No cases tracked yet</p>
      <p>Visit NamUs case pages and click "Track Case" to add them here</p>
    </div>
  `;
}

function selectCase(caseId) {
    const selectedCase = trackedCases.find(c => c.caseId === caseId);

    if (selectedCase) {
        currentCase = selectedCase;
        chrome.storage.local.set({ currentCase });
        renderCurrentCase();
        switchTab('current');

        // Update active state in tracked cases list
        document.querySelectorAll('.tracked-case-item').forEach(item => {
            if (item.dataset.caseId === caseId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
}

function removeCase(caseId) {
    chrome.runtime.sendMessage({ action: 'removeCase', caseId }, () => {
        loadCurrentCase();
        loadTrackedCases();
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function showLoading(container) {
    container.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
    </div>
  `;
}

function hideLoading(container) {
    const loadingElement = container.querySelector('.loading');
    if (loadingElement) {
        loadingElement.remove();
    }
}

function clearCurrentCase() {
    currentCase = null;
    chrome.storage.local.set({ currentCase: null }, () => {
        renderEmptyCurrentCase();
    });
}

function openSettings() {
    settingsPanel.classList.add('active');
}

function closeSettingsPanel() {
    settingsPanel.classList.remove('active');
}

function loadSettings() {
    chrome.storage.local.get(['featureEnabled'], (result) => {
        featureEnabled = result.featureEnabled !== undefined ? result.featureEnabled : true;
        featureToggle.checked = featureEnabled;
    });
}

function saveSettings() {
    chrome.storage.local.set({ featureEnabled });
}

function handleFeatureToggle() {
    featureEnabled = featureToggle.checked;
    saveSettings();
    // Re-render cases to apply/unapply blurring
    loadCurrentCase();
    loadTrackedCases();
}

function openImageModal(imageUrl) {
    modalImage.src = imageUrl;
    imageModal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open
}

function closeImageModal() {
    imageModal.style.display = 'none';
    document.body.style.overflow = 'auto'; // Restore scrolling
}

document.addEventListener('DOMContentLoaded', initSidePanel); 
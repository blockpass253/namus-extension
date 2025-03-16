// Side Panel

const currentCaseTab = document.getElementById('current-case-tab');
const trackedCasesTab = document.getElementById('tracked-cases-tab');
const currentCaseContent = document.getElementById('current-case-content');
const trackedCasesContent = document.getElementById('tracked-cases-content');
const currentCaseContainer = document.getElementById('current-case-container');
const trackedCasesList = document.getElementById('tracked-cases-list');

// State
let currentCase = null;
let trackedCases = [];

function initSidePanel() {
    currentCaseTab.addEventListener('click', () => switchTab('current'));
    trackedCasesTab.addEventListener('click', () => switchTab('tracked'));

    loadCurrentCase();
    loadTrackedCases();

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'sidepanelRefresh') {
            console.log("Received refresh message, reloading data");
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

// Load the current case from storage
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

// Load tracked cases from storage
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

    const caseHtml = `
    <div class="case-card">
      ${currentCase.imageUrl ?
            `<img src="${currentCase.imageUrl}" alt="${currentCase.caseName}" class="case-image">` :
            `<div class="case-image placeholder">No Image Available</div>`
        }
      <div class="case-header">
        <div class="case-title">${currentCase.caseName}</div>
        <div class="case-subtitle">${currentCase.caseType} | Case ID: ${currentCase.caseId}</div>
      </div>
      <div class="case-details">
        ${renderCaseDetails(currentCase.details)}
      </div>
      <div class="case-actions">
        <a href="${currentCase.url}" target="_blank" class="btn btn-primary">View on NamUs</a>
        <button id="remove-case-btn" class="btn btn-danger">Remove from Tracked</button>
      </div>
    </div>
  `;

    currentCaseContainer.innerHTML = caseHtml;

    const removeButton = document.getElementById('remove-case-btn');
    if (removeButton) {
        removeButton.addEventListener('click', () => {
            removeCase(currentCase.caseId);
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
        detailsHtml += `
      <div class="detail-section">
        <div class="section-title">${section}</div>
    `;

        for (const label in details[section]) {
            detailsHtml += `
        <div class="detail-item">
          <div class="detail-label">${label}:</div>
          <div class="detail-value">${details[section][label]}</div>
        </div>
      `;
        }

        detailsHtml += '</div>';
    }

    return detailsHtml;
}

// Render empty state for current case
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

        casesHtml += `
      <div class="tracked-case-item ${isActive ? 'active' : ''}" data-case-id="${caseData.caseId}">
        ${caseData.imageUrl ?
                `<img src="${caseData.imageUrl}" alt="${caseData.caseName}" class="case-item-image">` :
                `<div class="case-item-image placeholder">?</div>`
            }
        <div class="case-item-details">
          <div class="case-item-title">${caseData.caseName}</div>
          <div class="case-item-subtitle">${caseData.caseType} | Tracked: ${formatDate(caseData.dateTracked)}</div>
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

// Select a case from the tracked cases list
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
        // Reload data
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

document.addEventListener('DOMContentLoaded', initSidePanel); 
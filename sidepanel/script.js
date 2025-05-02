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
let folders = [];
let featureEnabled = false;

// DOM Elements
const createFolderBtn = document.getElementById('create-folder-btn');
const folderModal = document.getElementById('folder-modal');
const folderModalClose = document.querySelector('.folder-modal-close');
const folderModalCancel = document.querySelector('.folder-modal-cancel');
const folderModalForm = document.querySelector('.folder-modal-form');
const folderNameInput = document.querySelector('.folder-modal-input');

function initSidePanel() {
    currentCaseTab.addEventListener('click', () => switchTab('current'));
    trackedCasesTab.addEventListener('click', () => switchTab('tracked'));

    settingsIcon.addEventListener('click', openSettings);
    closeSettings.addEventListener('click', closeSettingsPanel);

    featureToggle.addEventListener('change', handleFeatureToggle);

    // Folder-related event listeners
    document.addEventListener('click', (e) => {
        if (e.target.closest('#create-folder-btn')) {
            openFolderModal();
        }
    });

    folderModalClose.addEventListener('click', closeFolderModal);
    folderModalCancel.addEventListener('click', closeFolderModal);
    folderModalForm.addEventListener('submit', handleCreateFolder);

    // Modal event listeners
    closeModal.addEventListener('click', closeImageModal);
    window.addEventListener('click', (event) => {
        if (event.target === imageModal) {
            closeImageModal();
        }
        if (event.target === folderModal) {
            closeFolderModal();
        }
    });

    loadSettings();
    loadFolders();
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
    if ((!trackedCases || trackedCases.length === 0) && (!folders || folders.length === 0)) {
        renderEmptyTrackedCases();
        return;
    }

    let casesHtml = '';

    // Render folders
    folders.forEach(folder => {
        casesHtml += `
            <div class="folder-item" data-folder-id="${folder.id}">
                <div class="folder-icon">📁</div>
                <div class="folder-name">${folder.name}</div>
                <div class="folder-actions">
                    <button class="btn btn-danger remove-folder" data-folder-id="${folder.id}">✕</button>
                </div>
            </div>
            <div class="folder-contents" data-folder-id="${folder.id}">
                ${renderCasesInFolder(folder.cases)}
            </div>
        `;
    });

    // Render cases not in folders
    const casesNotInFolders = trackedCases.filter(caseData => 
        !folders.some(folder => folder.cases.includes(caseData.caseId))
    );

    casesNotInFolders.forEach(caseData => {
        casesHtml += renderCaseItem(caseData);
    });

    trackedCasesList.innerHTML = casesHtml;

    // Add event listeners for folders
    document.querySelectorAll('.folder-item').forEach(folder => {
        folder.addEventListener('click', (e) => {
            if (!e.target.classList.contains('remove-folder')) {
                const folderId = folder.dataset.folderId;
                toggleFolder(folderId);
            }
        });
    });

    document.querySelectorAll('.remove-folder').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const folderId = button.dataset.folderId;
            removeFolder(folderId);
        });
    });

    // Add event listeners for cases
    document.querySelectorAll('.tracked-case-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('remove-tracked-case')) {
                const caseId = item.dataset.caseId;
                selectCase(caseId);
            }
        });

        // Add drag and drop functionality
        item.setAttribute('draggable', true);
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
    });

    // Add drop zones for folders
    document.querySelectorAll('.folder-item').forEach(folder => {
        folder.addEventListener('dragover', handleDragOver);
        folder.addEventListener('drop', handleDrop);
    });

    document.querySelectorAll('.remove-tracked-case').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const caseId = button.dataset.caseId;
            removeCase(caseId);
        });
    });
}

function renderCasesInFolder(caseIds) {
    if (!caseIds || caseIds.length === 0) {
        return '<div class="empty-folder">No cases in this folder</div>';
    }

    let casesHtml = '';
    caseIds.forEach(caseId => {
        const caseData = trackedCases.find(c => c.caseId === caseId);
        if (caseData) {
            casesHtml += renderCaseItem(caseData);
        }
    });
    return casesHtml;
}

function renderCaseItem(caseData) {
    const isActive = currentCase && currentCase.caseId === caseData.caseId;
    const hasAttachments = caseData.attachments && caseData.attachments.length > 0;
    const isUnidentified = caseData.caseType === 'Unidentified Person';
    const shouldBlur = featureEnabled && isUnidentified;

    return `
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
}

function toggleFolder(folderId) {
    const folderContents = document.querySelector(`.folder-contents[data-folder-id="${folderId}"]`);
    if (folderContents) {
        folderContents.style.display = folderContents.style.display === 'none' ? 'block' : 'none';
    }
}

function removeFolder(folderId) {
    folders = folders.filter(folder => folder.id !== folderId);
    chrome.storage.local.set({ folders }, () => {
        renderTrackedCases();
    });
}

// Drag and drop handlers
function handleDragStart(e) {
    e.target.classList.add('dragging');
    e.dataTransfer.setData('text/plain', e.target.dataset.caseId);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    const caseId = e.dataTransfer.getData('text/plain');
    const folderId = e.currentTarget.dataset.folderId;
    
    const folder = folders.find(f => f.id === folderId);
    if (folder && !folder.cases.includes(caseId)) {
        folder.cases.push(caseId);
        chrome.storage.local.set({ folders }, () => {
            renderTrackedCases();
        });
    }
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

function loadFolders() {
    chrome.storage.local.get(['folders'], (result) => {
        folders = result.folders || [];
    });
}

function openFolderModal() {
    folderModal.style.display = 'block';
    folderNameInput.value = '';
    folderNameInput.focus();
}

function closeFolderModal() {
    folderModal.style.display = 'none';
}

function handleCreateFolder(e) {
    e.preventDefault();
    const folderName = folderNameInput.value.trim();
    if (!folderName) return;

    const newFolder = {
        id: Date.now().toString(),
        name: folderName,
        cases: []
    };

    folders.push(newFolder);
    chrome.storage.local.set({ folders }, () => {
        closeFolderModal();
        renderTrackedCases();
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

document.addEventListener('DOMContentLoaded', initSidePanel); 
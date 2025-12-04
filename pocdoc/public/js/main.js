// ==========================================================================
// POC Portal - Main Application JavaScript
// ==========================================================================

let useCases = [];
let completedUseCases = {};
let currentConfig = {};
let currentSession = {};
let currentUseCaseId = null;
let selectedRatings = {};

// ==========================================================================
// Initialization
// ==========================================================================

document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        await loadUseCases();
        setupEventListeners();
        updateUIForRole();
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to load use cases. Please try refreshing the page.');
    }
}

async function loadUseCases() {
    const response = await fetch('/api/use-cases');
    if (!response.ok) {
        throw new Error('Failed to load use cases');
    }
    
    const data = await response.json();
    useCases = data.useCases;
    completedUseCases = data.completed || {};
    currentConfig = data.config || {};
    currentSession = data.session || {};
    
    renderSidebar();
    renderUseCases();
    
    document.getElementById('loading-state').style.display = 'none';
    
    if (useCases.length > 0) {
        document.getElementById('use-case-content').style.display = 'block';
        // Scroll to hash if present
        if (window.location.hash) {
            const id = window.location.hash.slice(1);
            scrollToUseCase(id);
        }
    } else {
        document.getElementById('empty-state').style.display = 'block';
    }
}

function updateUIForRole() {
    const configLink = document.querySelector('.config-link');
    if (configLink) {
        // Only show config link for admin users
        if (currentSession.role !== 'admin') {
            configLink.style.display = 'none';
        }
    }
}

// ==========================================================================
// Rendering
// ==========================================================================

function renderSidebar() {
    const menu = document.getElementById('use-case-menu');
    menu.innerHTML = '';
    
    // Group by category
    const categories = {};
    useCases.forEach(uc => {
        const cat = uc.category || 'General';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(uc);
    });
    
    for (const [category, items] of Object.entries(categories)) {
        // Category heading
        const heading = document.createElement('div');
        heading.className = 'sidebar-category';
        heading.textContent = category;
        menu.appendChild(heading);
        
        // Items
        items.forEach(uc => {
            const link = document.createElement('a');
            link.href = `#${uc.id}`;
            link.className = 'sidebar-link';
            link.dataset.id = uc.id;
            
            const isComplete = completedUseCases[uc.id]?.completed;
            if (isComplete) {
                link.classList.add('completed');
            }
            
            link.innerHTML = `
                ${isComplete ? '<span class="material-icons checkmark">check_circle</span>' : ''}
                <span class="link-text">${uc.name || uc.slug}</span>
            `;
            
            link.addEventListener('click', (e) => {
                e.preventDefault();
                scrollToUseCase(uc.id);
                window.history.pushState(null, '', `#${uc.id}`);
            });
            
            menu.appendChild(link);
        });
    }
}

function renderUseCases() {
    const container = document.getElementById('use-case-content');
    container.innerHTML = '';
    
    useCases.forEach(uc => {
        const card = createUseCaseCard(uc);
        container.appendChild(card);
    });
}

function createUseCaseCard(uc) {
    const isComplete = completedUseCases[uc.id]?.completed;
    
    const card = document.createElement('div');
    card.className = 'use-case-card';
    card.id = uc.id;
    
    card.innerHTML = `
        <div class="use-case-content">
            ${uc.html}
        </div>
        
        <div class="use-case-actions">
            <button class="complete-button ${isComplete ? 'completed' : ''}" 
                    data-id="${uc.id}"
                    onclick="toggleComplete('${uc.id}')">
                ${isComplete ? '✓ Completed' : 'Mark as Complete'}
            </button>
        </div>
        
        <div class="feedback-section ${isComplete ? 'visible' : ''}" id="feedback-${uc.id.replace('/', '-')}">
            <div class="feedback-header">
                <span class="feedback-title"></span>
                <span class="feedback-tag">Optional</span>
            </div>
            
            <div class="stars" data-id="${uc.id}">
                ${[1,2,3,4,5].map(i => `
                    <span class="star" data-value="${i}" onclick="selectRating('${uc.id}', ${i})">☆</span>
                `).join('')}
            </div>
            
            <textarea class="feedback-textarea" 
                      id="feedback-text-${uc.id.replace('/', '-')}"
                      placeholder="Share your thoughts..."></textarea>
            
            <button class="feedback-submit" onclick="submitFeedback('${uc.id}')">
                Send Feedback
            </button>
        </div>
    `;
    
    return card;
}

function scrollToUseCase(id) {
    const element = document.getElementById(id);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        updateActiveLink(id);
        currentUseCaseId = id;
        updateInfoPanel(id);
    }
}

function updateActiveLink(id) {
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.id === id) {
            link.classList.add('active');
        }
    });
}

// ==========================================================================
// Completion & Feedback
// ==========================================================================

async function toggleComplete(id) {
    const [productCategory, slug] = id.split('/');
    const isCurrentlyComplete = completedUseCases[id]?.completed;
    const newState = !isCurrentlyComplete;
    
    try {
        const response = await fetch(`/api/use-cases/${productCategory}/${slug}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: newState })
        });
        
        if (!response.ok) throw new Error('Failed to update');
        
        completedUseCases[id] = { completed: newState };
        
        // Update button
        const button = document.querySelector(`.complete-button[data-id="${id}"]`);
        if (button) {
            button.classList.toggle('completed', newState);
            button.textContent = newState ? '✓ Completed' : 'Mark as Complete';
        }
        
        // Update sidebar
        const link = document.querySelector(`.sidebar-link[data-id="${id}"]`);
        if (link) {
            link.classList.toggle('completed', newState);
            if (newState && !link.querySelector('.checkmark')) {
                link.insertAdjacentHTML('afterbegin', '<span class="material-icons checkmark">check_circle</span>');
            } else if (!newState) {
                const checkmark = link.querySelector('.checkmark');
                if (checkmark) checkmark.remove();
            }
        }
        
        // Show/hide feedback
        const feedbackSection = document.getElementById(`feedback-${id.replace('/', '-')}`);
        if (feedbackSection) {
            feedbackSection.classList.toggle('visible', newState);
        }
        
    } catch (error) {
        console.error('Error toggling completion:', error);
        alert('Failed to update. Please try again.');
    }
}

function selectRating(id, rating) {
    const current = selectedRatings[id] || 0;
    const newRating = (current === rating) ? 0 : rating;
    selectedRatings[id] = newRating;
    
    // Update stars UI
    const starsContainer = document.querySelector(`.stars[data-id="${id}"]`);
    if (starsContainer) {
        starsContainer.querySelectorAll('.star').forEach(star => {
            const value = parseInt(star.dataset.value);
            star.classList.toggle('selected', value <= newRating && newRating > 0);
            star.textContent = (value <= newRating && newRating > 0) ? '★' : '☆';
        });
    }
}

async function submitFeedback(id) {
    const [productCategory, slug] = id.split('/');
    const rating = selectedRatings[id] || 0;
    const textareaId = `feedback-text-${id.replace('/', '-')}`;
    const textarea = document.getElementById(textareaId);
    const message = textarea?.value?.trim() || '';
    
    if (!rating && !message) {
        alert('Please select a rating or enter a message.');
        return;
    }
    
    try {
        const response = await fetch(`/api/use-cases/${productCategory}/${slug}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating, message })
        });
        
        if (!response.ok) throw new Error('Failed to submit');
        
        // Replace feedback section with thank you message
        const feedbackSection = document.getElementById(`feedback-${id.replace('/', '-')}`);
        if (feedbackSection) {
            feedbackSection.innerHTML = `
                <div class="thank-you-message">
                    Thank you for your feedback! Your response has been recorded.
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error submitting feedback:', error);
        alert('Failed to submit feedback. Please try again.');
    }
}

// ==========================================================================
// Info Panel
// ==========================================================================

function toggleInfoPanel() {
    const panel = document.getElementById('info-panel');
    const main = document.getElementById('main');
    const button = document.getElementById('menu-button');
    
    panel.classList.toggle('open');
    main.classList.toggle('shrink');
    button.classList.toggle('hidden', panel.classList.contains('open'));
}

function updateInfoPanel(id) {
    const uc = useCases.find(u => u.id === id);
    if (!uc) return;
    
    const content = document.getElementById('info-panel-content');
    
    let html = '';
    
    if (uc.credentials && uc.credentials.length > 0) {
        uc.credentials.forEach((cred, idx) => {
            if (cred.text) {
                const texts = Array.isArray(cred.text) ? cred.text : [cred.text];
                texts.forEach(t => {
                    html += `<p style="margin-bottom: 8px; color: #374151;">${t}</p>`;
                });
            }
            
            if (cred.url) {
                html += `
                    <div class="credential-block">
                        <div class="label">URL</div>
                        <div class="value">
                            <a href="${cred.url}" target="_blank" class="value-text">${cred.url}</a>
                            <button class="copy-button" onclick="copyToClipboard('${cred.url}')">
                                <span class="material-icons">content_copy</span>
                            </button>
                        </div>
                    </div>
                `;
            }
            
            if (cred.username) {
                html += `
                    <div class="credential-block">
                        <div class="label">Username</div>
                        <div class="value">
                            <span class="value-text">${cred.username}</span>
                            <button class="copy-button" onclick="copyToClipboard('${cred.username}')">
                                <span class="material-icons">content_copy</span>
                            </button>
                        </div>
                    </div>
                `;
            }
            
            if (cred.password) {
                html += `
                    <div class="credential-block">
                        <div class="label">Password</div>
                        <div class="value">
                            <span class="value-text">${cred.password}</span>
                            <button class="copy-button" onclick="copyToClipboard('${cred.password}')">
                                <span class="material-icons">content_copy</span>
                            </button>
                        </div>
                    </div>
                `;
            }
        });
    } else {
        html = '<p style="color: #6b7280;">No additional information available for this section.</p>';
    }
    
    content.innerHTML = html;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showCopyToast('Copied!');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showCopyToast('Failed to copy', true);
    });
}

function showCopyToast(message, isError = false) {
    // Remove existing toast if any
    const existing = document.getElementById('copy-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.id = 'copy-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 12px 20px;
        background: ${isError ? '#dc2626' : '#059669'};
        color: white;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 9999;
        animation: toastIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 1500);
}

// ==========================================================================
// Event Listeners
// ==========================================================================

function setupEventListeners() {
    // Close info panel
    document.getElementById('close-info-panel').addEventListener('click', toggleInfoPanel);
    
    // Scroll tracking for active section
    const main = document.getElementById('main');
    let scrollTimeout;
    
    main.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const cards = document.querySelectorAll('.use-case-card');
            for (const card of cards) {
                const rect = card.getBoundingClientRect();
                if (rect.top <= 150 && rect.bottom >= 150) {
                    const id = card.id;
                    if (id !== currentUseCaseId) {
                        currentUseCaseId = id;
                        updateActiveLink(id);
                        updateInfoPanel(id);
                    }
                    break;
                }
            }
        }, 50);
    });
    
    // Handle hash changes
    window.addEventListener('hashchange', () => {
        const id = window.location.hash.slice(1);
        if (id) scrollToUseCase(id);
    });
}

// ==========================================================================
// Error Handling
// ==========================================================================

function showError(message) {
    document.getElementById('loading-state').innerHTML = `
        <div style="color: #dc2626; text-align: center;">
            <span class="material-icons" style="font-size: 48px; margin-bottom: 16px;">error</span>
            <p>${message}</p>
        </div>
    `;
}
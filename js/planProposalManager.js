/**
 * Plan Proposal Manager
 * Manages AI-proposed plan changes requiring user approval
 */

import { apiEndpoints } from './config.js';

/**
 * Checks for pending plan change proposals
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Proposal data if exists
 */
export async function checkPendingProposals(userId) {
    if (!userId) {
        throw new Error('User ID is required');
    }

    try {
        const response = await fetch(`${apiEndpoints.getPendingPlanChanges}?userId=${encodeURIComponent(userId)}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Грешка при проверка за чакащи предложения');
        }

        return data;
    } catch (error) {
        console.error('Error checking pending proposals:', error);
        throw error;
    }
}

/**
 * Approves a plan change proposal
 * @param {string} userId - User ID
 * @param {string} proposalId - Proposal ID
 * @param {string} userComment - Optional user comment
 * @returns {Promise<Object>} Updated plan
 */
export async function approvePlanChange(userId, proposalId, userComment = '') {
    if (!userId) {
        throw new Error('User ID is required');
    }

    try {
        const response = await fetch(apiEndpoints.approvePlanChange, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                proposalId,
                userComment
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Грешка при одобряване на промените');
        }

        return data;
    } catch (error) {
        console.error('Error approving plan change:', error);
        throw error;
    }
}

/**
 * Rejects a plan change proposal
 * @param {string} userId - User ID
 * @param {string} proposalId - Proposal ID
 * @param {string} reason - Optional rejection reason
 * @returns {Promise<Object>} Response
 */
export async function rejectPlanChange(userId, proposalId, reason = '') {
    if (!userId) {
        throw new Error('User ID is required');
    }

    try {
        const response = await fetch(apiEndpoints.rejectPlanChange, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                proposalId,
                reason
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Грешка при отхвърляне на промените');
        }

        return data;
    } catch (error) {
        console.error('Error rejecting plan change:', error);
        throw error;
    }
}

/**
 * Formats proposal changes for display
 * @param {Object} proposedChanges - The proposed changes object
 * @returns {string} HTML string for display
 */
export function formatProposalChanges(proposedChanges) {
    let html = '<div class="proposal-changes">';

    // Show text description if available
    if (proposedChanges.textDescription) {
        html += `<div class="proposal-description">
            <h4>Описание на промените:</h4>
            <p>${escapeHtml(proposedChanges.textDescription)}</p>
        </div>`;
    }

    // Show macro changes
    if (proposedChanges.caloriesMacros) {
        html += '<div class="proposal-macros"><h4>Промени в макронутриентите:</h4><ul>';
        
        if (proposedChanges.caloriesMacros.plan) {
            html += '<li><strong>План:</strong><ul>';
            const plan = proposedChanges.caloriesMacros.plan;
            if (plan.calories) html += `<li>Калории: ${plan.calories} kcal</li>`;
            if (plan.protein_grams) html += `<li>Протеини: ${plan.protein_grams} г</li>`;
            if (plan.carbs_grams) html += `<li>Въглехидрати: ${plan.carbs_grams} г</li>`;
            if (plan.fat_grams) html += `<li>Мазнини: ${plan.fat_grams} г</li>`;
            if (plan.fiber_grams) html += `<li>Фибри: ${plan.fiber_grams} г</li>`;
            html += '</ul></li>';
        }
        
        if (proposedChanges.caloriesMacros.recommendation) {
            html += '<li><strong>Препоръки:</strong><ul>';
            const rec = proposedChanges.caloriesMacros.recommendation;
            if (rec.calories) html += `<li>Калории: ${rec.calories} kcal</li>`;
            if (rec.protein_grams) html += `<li>Протеини: ${rec.protein_grams} г</li>`;
            if (rec.carbs_grams) html += `<li>Въглехидрати: ${rec.carbs_grams} г</li>`;
            if (rec.fat_grams) html += `<li>Мазнини: ${rec.fat_grams} г</li>`;
            if (rec.fiber_grams) html += `<li>Фибри: ${rec.fiber_grams} г</li>`;
            html += '</ul></li>';
        }
        
        html += '</ul></div>';
    }

    // Show week1Menu changes if any
    if (proposedChanges.week1Menu) {
        html += '<div class="proposal-menu"><h4>Промени в менюто за седмица 1:</h4>';
        html += '<p>Предложени са промени в менюто (виж детайлите след одобрение).</p>';
        html += '</div>';
    }

    // Show other changes
    if (proposedChanges.principlesWeek2_4) {
        html += '<div class="proposal-principles"><h4>Промени в принципите за седмици 2-4</h4></div>';
    }

    if (proposedChanges.allowedForbiddenFoods) {
        html += '<div class="proposal-foods"><h4>Промени в позволените/забранени храни</h4></div>';
    }

    html += '</div>';
    return html;
}

/**
 * Shows a proposal modal to the user
 * @param {Object} proposal - The proposal object
 * @param {Function} onApprove - Callback for approval
 * @param {Function} onReject - Callback for rejection
 */
export function showProposalModal(proposal, onApprove, onReject) {
    // Remove existing modal if any
    const existingModal = document.getElementById('plan-proposal-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'plan-proposal-modal';
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="bi bi-lightbulb"></i> AI Асистентът предлага промени в плана
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Затвори"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info">
                        <i class="bi bi-info-circle"></i>
                        AI асистентът предлага промени в Вашия хранителен план на база анализ на текущия прогрес.
                        Моля, прегледайте внимателно предложените промени преди да ги одобрите.
                    </div>
                    
                    <div class="proposal-reasoning mb-3">
                        <h6>Обосновка:</h6>
                        <p class="text-muted">${escapeHtml(proposal.reasoning || 'Няма налична обосновка.')}</p>
                    </div>
                    
                    ${formatProposalChanges(proposal.proposedChanges)}
                    
                    <div class="proposal-metadata mt-3">
                        <small class="text-muted">
                            Създадено на: ${new Date(proposal.createdAt).toLocaleString('bg-BG')}
                            ${proposal.expiresAt ? ` | Изтича на: ${new Date(proposal.expiresAt).toLocaleString('bg-BG')}` : ''}
                        </small>
                    </div>
                    
                    <div class="mt-3">
                        <label for="user-comment" class="form-label">Вашият коментар (по избор):</label>
                        <textarea class="form-control" id="user-comment" rows="2" 
                            placeholder="Може да добавите забележки или коментари..."></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        <i class="bi bi-x-circle"></i> Затвори
                    </button>
                    <button type="button" class="btn btn-danger" id="reject-proposal-btn">
                        <i class="bi bi-x-lg"></i> Отхвърли
                    </button>
                    <button type="button" class="btn btn-success" id="approve-proposal-btn">
                        <i class="bi bi-check-lg"></i> Одобри промените
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Initialize Bootstrap modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    // Event handlers
    const approveBtn = modal.querySelector('#approve-proposal-btn');
    const rejectBtn = modal.querySelector('#reject-proposal-btn');
    const commentField = modal.querySelector('#user-comment');

    approveBtn.addEventListener('click', async () => {
        approveBtn.disabled = true;
        approveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Обработва се...';
        
        try {
            const comment = commentField.value.trim();
            await onApprove(comment);
            bsModal.hide();
        } catch (error) {
            alert('Грешка при одобряване: ' + error.message);
            approveBtn.disabled = false;
            approveBtn.innerHTML = '<i class="bi bi-check-lg"></i> Одобри промените';
        }
    });

    rejectBtn.addEventListener('click', async () => {
        const reason = prompt('Причина за отхвърляне (по избор):');
        if (reason === null) return; // User cancelled
        
        rejectBtn.disabled = true;
        rejectBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Обработва се...';
        
        try {
            await onReject(reason);
            bsModal.hide();
        } catch (error) {
            alert('Грешка при отхвърляне: ' + error.message);
            rejectBtn.disabled = false;
            rejectBtn.innerHTML = '<i class="bi bi-x-lg"></i> Отхвърли';
        }
    });

    // Cleanup on modal hide
    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    });
}

/**
 * Escapes HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Initializes the proposal manager for the current page
 * Checks for pending proposals on page load and shows notification
 * @param {string} userId - User ID
 */
export async function initPlanProposalManager(userId) {
    if (!userId) {
        console.warn('No user ID provided for plan proposal manager');
        return;
    }

    try {
        const result = await checkPendingProposals(userId);
        
        if (result.hasPending && result.proposal) {
            // Show a notification badge or banner
            showPendingProposalNotification(result.proposal);
        }
    } catch (error) {
        console.error('Error initializing plan proposal manager:', error);
    }
}

/**
 * Shows a notification about pending proposal
 * @param {Object} proposal - The pending proposal
 */
function showPendingProposalNotification(proposal) {
    // Create or update notification badge
    let badge = document.getElementById('pending-proposal-badge');
    
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'pending-proposal-badge';
        badge.className = 'alert alert-warning alert-dismissible fade show position-fixed';
        badge.style.cssText = 'top: 80px; right: 20px; z-index: 1050; max-width: 400px;';
        
        badge.innerHTML = `
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Затвори"></button>
            <h6 class="alert-heading">
                <i class="bi bi-bell-fill"></i> Ново предложение за промяна на плана
            </h6>
            <p class="mb-2">AI асистентът предлага промени във Вашия хранителен план.</p>
            <button class="btn btn-sm btn-warning" id="view-proposal-btn">
                <i class="bi bi-eye"></i> Преглед
            </button>
        `;
        
        document.body.appendChild(badge);
        
        // Handle view button click
        const viewBtn = badge.querySelector('#view-proposal-btn');
        viewBtn.addEventListener('click', () => {
            const userId = localStorage.getItem('userId');
            if (userId) {
                showProposalModal(
                    proposal,
                    async (comment) => {
                        await approvePlanChange(userId, proposal.id, comment);
                        badge.remove();
                        location.reload(); // Reload to show updated plan
                    },
                    async (reason) => {
                        await rejectPlanChange(userId, proposal.id, reason);
                        badge.remove();
                    }
                );
            }
        });
    }
}

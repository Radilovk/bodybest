/**
 * Example integration of Plan Proposal Manager in the dashboard
 * 
 * This file demonstrates how to integrate the plan proposal system
 * into the user dashboard (code.html / app.js)
 * 
 * OPTIMIZATION NOTES:
 * - Uses sessionStorage cache with 5-minute TTL
 * - Only makes backend request once per cache window
 * - Cache is automatically cleared after approve/reject
 * - Minimal backend load impact
 */

// 1. Import the module at the top of your app.js or relevant script
import { 
    initPlanProposalManager, 
    checkPendingProposals, 
    checkAfterChatInteraction,
    showProposalModal, 
    approvePlanChange, 
    rejectPlanChange 
} from './planProposalManager.js';

// 2. Initialize on page load (uses cache, minimal backend impact)
document.addEventListener('DOMContentLoaded', async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    // This will check cache first. Only makes API call if cache is empty/expired.
    // Result is cached for 5 minutes to prevent repeated requests.
    await initPlanProposalManager(userId);
});

// 2b. RECOMMENDED: Check after chat interactions instead of on every page load
// This is the most efficient approach - only check when AI might have created a proposal
export function setupChatProposalListener() {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    
    // Listen for chat responses that mention plan modifications
    // This should be integrated into your chat handler
    document.addEventListener('chatResponseReceived', async (event) => {
        const message = event.detail?.message || '';
        
        // Check if AI mentioned creating a proposal
        if (message.includes('Предложението за промяна на плана е създадено')) {
            // Force fresh check (bypasses cache)
            await checkAfterChatInteraction(userId);
        }
    });
}

// 3. Optional: Add a manual check button in your UI
// For example, in the dashboard toolbar or settings menu
export function setupProposalCheckButton() {
    const checkButton = document.createElement('button');
    checkButton.className = 'btn btn-outline-primary';
    checkButton.innerHTML = '<i class="bi bi-bell"></i> Проверка за промени';
    checkButton.title = 'Проверка за предложени промени в плана от AI';
    
    checkButton.addEventListener('click', async () => {
        const userId = localStorage.getItem('userId');
        if (!userId) return;
        
        try {
            checkButton.disabled = true;
            checkButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Проверява се...';
            
            // Force fresh check when user clicks button (bypass cache)
            const result = await checkPendingProposals(userId, true);
            
            if (result.hasPending && result.proposal) {
                showProposalModal(
                    result.proposal,
                    async (comment) => {
                        await approvePlanChange(userId, result.proposal.id, comment);
                        alert('✅ Промените са приложени успешно!');
                        location.reload(); // Reload to show updated plan
                    },
                    async (reason) => {
                        await rejectPlanChange(userId, result.proposal.id, reason);
                        alert('Предложението е отхвърлено.');
                    }
                );
            } else {
                alert('Няма чакащи предложения за промяна на плана.');
            }
        } catch (error) {
            console.error('Error checking proposals:', error);
            alert('Грешка при проверка: ' + error.message);
        } finally {
            checkButton.disabled = false;
            checkButton.innerHTML = '<i class="bi bi-bell"></i> Проверка за промени';
        }
    });
    
    // Add the button to a container (e.g., dashboard toolbar)
    const toolbar = document.querySelector('#dashboard-toolbar');
    if (toolbar) {
        toolbar.appendChild(checkButton);
    }
}

// 4. Example: Handling proposal in chat context
// When the AI mentions a proposal in the chat, you can highlight it
export function highlightProposalInChat(chatMessage) {
    if (chatMessage.includes('Предложението за промяна на плана е създадено')) {
        // Add a visual indicator or action button in the chat
        const actionButton = document.createElement('button');
        actionButton.className = 'btn btn-sm btn-warning mt-2';
        actionButton.innerHTML = '<i class="bi bi-eye"></i> Преглед на предложението';
        
        actionButton.addEventListener('click', async () => {
            const userId = localStorage.getItem('userId');
            if (!userId) return;
            
            // Use cached check if available (efficient)
            const result = await checkPendingProposals(userId);
            if (result.hasPending && result.proposal) {
                showProposalModal(
                    result.proposal,
                    async (comment) => {
                        await approvePlanChange(userId, result.proposal.id, comment);
                        alert('✅ Промените са приложени успешно!');
                        location.reload();
                    },
                    async (reason) => {
                        await rejectPlanChange(userId, result.proposal.id, reason);
                        alert('Предложението е отхвърлено.');
                    }
                );
            }
        });
        
        return actionButton;
    }
    return null;
}

// 5. Example: Custom styling for the notification badge
// Add this CSS to your stylesheets
const customStyles = `
#pending-proposal-badge {
    animation: slideInRight 0.5s ease-out;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

@keyframes slideInRight {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

.proposal-changes {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
}

.proposal-changes h4 {
    color: #495057;
    font-size: 1rem;
    margin-bottom: 0.5rem;
}

.proposal-changes ul {
    margin-bottom: 0.5rem;
}

.proposal-description {
    background: #e3f2fd;
    border-left: 4px solid #2196f3;
    padding: 1rem;
    margin-bottom: 1rem;
}

.proposal-metadata {
    border-top: 1px solid #dee2e6;
    padding-top: 1rem;
}
`;

// Add the styles to the page
export function injectProposalStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = customStyles;
    document.head.appendChild(styleElement);
}

// 6. Complete initialization function
// Call this from your main app initialization
export async function initializePlanProposalSystem() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        console.log('No user logged in, skipping plan proposal system initialization');
        return;
    }

    // Inject custom styles
    injectProposalStyles();
    
    // Initialize the proposal manager
    await initPlanProposalManager(userId);
    
    // Setup manual check button (optional)
    setupProposalCheckButton();
    
    console.log('Plan proposal system initialized successfully');
}

// Usage example in your main app.js:
// 
// import { initializePlanProposalSystem } from './planProposalIntegration.js';
// 
// document.addEventListener('DOMContentLoaded', async () => {
//     // ... other initialization code ...
//     
//     await initializePlanProposalSystem();
// });

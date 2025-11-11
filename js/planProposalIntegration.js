/**
 * Example integration of Plan Proposal Manager in the dashboard
 * 
 * This file demonstrates how to integrate the plan proposal system
 * into the user dashboard (code.html / app.js)
 */

// 1. Import the module at the top of your app.js or relevant script
import { 
    initPlanProposalManager, 
    checkPendingProposals, 
    showProposalModal, 
    approvePlanChange, 
    rejectPlanChange 
} from './planProposalManager.js';

// 2. Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    // Initialize the proposal manager
    // This will automatically check for pending proposals
    // and show a notification if any exist
    await initPlanProposalManager(userId);
});

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
            
            const result = await checkPendingProposals(userId);
            
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

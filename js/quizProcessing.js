// quizProcessing.js - Логика за обработка на въпросника
import { apiEndpoints } from './config.js';
import { safeGet } from './utils.js';
import { selectors } from './uiElements.js';
import { showLoading, showToast, openModal, closeModal } from './uiHandlers.js';
import { currentUserId, currentQuizData, userQuizAnswers, currentQuestionIndex, setCurrentQuizData, setUserQuizAnswers, setCurrentQuestionIndex } from './app.js';
import { loadDashboardData } from './dataLoader.js';
import { renderCurrentQuizQuestion, showQuizValidationMessage, hideQuizValidationMessage, openAdaptiveQuizModal as _openAdaptiveQuizModal } from './adaptiveQuiz.js';

export async function _generateAdaptiveQuizClientSide(userId, context = {}) {
    console.log("generateAdaptiveQuizClientSide called for user:", userId, "with context:", context);
    if (!userId) throw new Error("Липсва потребителско ID за генериране на въпросник.");

    if (userId.includes('test_user') || window.location.hostname.includes('replit')) {
        console.log("Generating test quiz data");
        return {
            quizId: 'test_quiz_' + Date.now(),
            quizTitle: "Тестов Въпросник",
            quizDescription: "Това е тестов въпросник за разработка",
            questions: [
                { id: "q1_app", text: "Как се чувствате днес?", answerType: "скала_1_5", required: true, options: { min: 1, max: 5, minLabel: "Зле", maxLabel: "Отлично" }},
                { id: "q2_app", text: "Колко чаши вода пихте вчера?", answerType: "number", required: true, placeholder: "Въведете брой чаши" },
                { id: "q3_app", text: "Какви са главните ви предизвикателства?", answerType: "еднозначен_избор_от_списък", required: false, options: ["Време", "Мотивация", "Знания", "Активност"] }
            ]
        };
    }

    try {
        let queryString = `userId=${userId}`;
        if (context.trigger) queryString += `&trigger=${encodeURIComponent(context.trigger)}`;
        if (context.specificFocus) queryString += `&focus=${encodeURIComponent(context.specificFocus)}`;
        const response = await fetch(`${apiEndpoints.getAdaptiveQuiz}?${queryString}`);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Сървърна грешка: ${response.status}` }));
            throw new Error(errorData.message || `Грешка от сървъра: ${response.status}`);
        }
        const result = await response.json();
        if (!result.success || !result.showQuiz || !result.quizData) {
            throw new Error(result.message || "Неуспешно зареждане или генериране на въпросник от сървъра.");
        }
        console.log("Quiz data received from worker:", result.quizData);
        return result.quizData;
    } catch (error) {
        console.error("Error in generateAdaptiveQuizClientSide:", error);
        throw error;
    }
}

export async function _analyzeQuizAnswersAndAdaptClientSide(userId, quizId, submittedAnswers) {
    console.log("analyzeQuizAnswersAndAdaptClientSide called for quiz:", quizId, "answers:", submittedAnswers);
    if (!userId || !quizId || !submittedAnswers) {
        throw new Error("Липсват необходими данни за подаване на въпросника.");
    }

    if (userId.includes('test_user') || window.location.hostname.includes('replit')) {
        console.log("Simulating quiz analysis for test user");
        return {
            success: true,
            message: "Тестовият въпросник беше подаден успешно!",
            aiUpdateSummary: { title: "Анализ завършен", introduction:"Благодарим за отговорите!", changes: ["Актуализиран план според вашите нужди"], encouragement: "Продължавайте силната работа!" }
        };
    }

    const payload = { userId: userId, quizId: quizId, answers: submittedAnswers };
    try {
        const response = await fetch(apiEndpoints.submitAdaptiveQuiz, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Сървърна грешка при подаване: ${response.status}` }));
            throw new Error(errorData.message || `Грешка от сървъра при подаване на отговорите: ${response.status}`);
        }
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || "Неуспешна обработка на отговорите от сървъра.");
        }
        console.log("Analysis result from worker:", result);
        return result;
    } catch (error) {
        console.error("Error in analyzeQuizAnswersAndAdaptClientSide:", error);
        throw error;
    }
}

export function _handlePrevQuizQuestion() {
    if (currentQuestionIndex > 0) {
        setCurrentQuestionIndex(currentQuestionIndex - 1);
        renderCurrentQuizQuestion(false);
    }
}

export function _handleNextQuizQuestion() {
    const currentQ = currentQuizData.questions[currentQuestionIndex];
    if (currentQ.required) {
        const answer = userQuizAnswers[currentQ.id];
        let isEmpty = false;
        if (Array.isArray(answer)) { isEmpty = answer.length === 0; }
        else { isEmpty = (answer === null || String(answer).trim() === ''); }
        if (isEmpty) {
            showQuizValidationMessage('Моля, отговорете на този въпрос, преди да продължите.');
            const currentCard = selectors.quizQuestionContainer.querySelector('.aq-question-card-hybrid');
            const inputAreaInCard = currentCard?.querySelector('.question-input-area');
            const firstInputInArea = inputAreaInCard?.querySelector('input:not([type="hidden"]), textarea, .rating-square[tabindex="0"], select');
            if (firstInputInArea) firstInputInArea.focus();
            return;
        }
    }
    hideQuizValidationMessage();
    if (currentQuestionIndex < currentQuizData.questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        renderCurrentQuizQuestion(true);
    }
}

export async function _handleSubmitQuizAnswersClientSide() {
    for (let i = 0; i < currentQuizData.questions.length; i++) {
        const q = currentQuizData.questions[i];
        if (q.required) {
            const answer = userQuizAnswers[q.id];
            let isEmpty = false;
            if (Array.isArray(answer)) { isEmpty = answer.length === 0; }
            else { isEmpty = (answer === null || String(answer).trim() === ''); }
            if (isEmpty) {
                showToast(`Моля, отговорете на всички задължителни въпроси. Въпрос "${q.text.substring(0,30)}..." е пропуснат.`, true, 4000);
                setCurrentQuestionIndex(i);
                renderCurrentQuizQuestion(true);
                return;
            }
        }
    }

    showLoading(true, "Обработка на вашите отговори...");
    try {
        const analysisResult = await _analyzeQuizAnswersAndAdaptClientSide(currentUserId, currentQuizData.quizId, userQuizAnswers);
        showToast("Въпросникът е успешно подаден!", false, 2000);

        setTimeout(() => {
            if (selectors.adaptiveQuizModal) {
                 closeModal('adaptiveQuizWrapper');
            }
        }, 1500);

        const aiSummaryFromWorker = safeGet(analysisResult, 'aiUpdateSummary');
        if (aiSummaryFromWorker && (aiSummaryFromWorker.title || aiSummaryFromWorker.introduction || aiSummaryFromWorker.changes || aiSummaryFromWorker.encouragement)) {
            let summaryHtml = `<h3>${aiSummaryFromWorker.title || 'Резултат от Вашия Чек-ин'}</h3>`;
            if (aiSummaryFromWorker.introduction) summaryHtml += `<p>${aiSummaryFromWorker.introduction.replace(/\n/g, '<br>')}</p>`;
            if (aiSummaryFromWorker.changes && Array.isArray(aiSummaryFromWorker.changes) && aiSummaryFromWorker.changes.length > 0) {
                summaryHtml += `<ul>${aiSummaryFromWorker.changes.map(ch => `<li>${String(ch).replace(/\n/g, '<br>')}</li>`).join('')}</ul>`;
            }
            if (aiSummaryFromWorker.encouragement) summaryHtml += `<p>${aiSummaryFromWorker.encouragement.replace(/\n/g, '<br>')}</p>`;

            if (selectors.infoModalTitle) selectors.infoModalTitle.textContent = aiSummaryFromWorker.title || 'Информация';
            if (selectors.infoModalBody) selectors.infoModalBody.innerHTML = summaryHtml;
            openModal('infoModal');

            fetch(apiEndpoints.acknowledgeAiUpdate, {
                 method: 'POST', headers: {'Content-Type': 'application/json'},
                 body: JSON.stringify({userId: currentUserId})
            }).catch(err => console.warn("Failed to acknowledge AI update to worker:", err));
        } else if (analysisResult && analysisResult.message) {
             showToast(analysisResult.message, false, 4000);
        }

        await loadDashboardData();
        setCurrentQuizData(null);
        setUserQuizAnswers({});
        setCurrentQuestionIndex(0);
    } catch (error) {
        console.error("Error submitting quiz answers and adapting:", error);
        showToast(`Грешка при подаване на въпросника: ${error.message}`, true);
    } finally {
        showLoading(false);
    }
}

export async function _handleTriggerAdaptiveQuizClientSide() {
    if (!currentUserId) { showToast("Моля, влезте първо.", true); return; }
    _openAdaptiveQuizModal();
}

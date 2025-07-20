// adaptiveQuiz.js - Логика за Адаптивен Въпросник
import { selectors } from './uiElements.js';
import { showToast, openModal as genericOpenModal } from './uiHandlers.js';
import { updateStepProgress } from './stepProgress.js';
import { safeGet, safeParseFloat } from './utils.js';
import {
    currentUserId,
    currentQuizData, // state from app.js
    userQuizAnswers, // state from app.js
    currentQuestionIndex, // state from app.js
    fullDashboardData, // state from app.js
    setCurrentQuizData, // setter from app.js
    setUserQuizAnswers, // setter from app.js
    setCurrentQuestionIndex, // setter from app.js
    _generateAdaptiveQuizClientSide // API call from app.js
} from './app.js';

export async function openAdaptiveQuizModal() {
    if (!selectors.adaptiveQuizModal || !selectors.adaptiveQuizContainer) {
        console.error("Основни HTML елементи за адаптивния въпросник (модал/контейнер) липсват.");
        showToast("Компонентът за въпросник не е зареден правилно.", true);
        return;
    }
    if (!selectors.quizLoadingIndicator || !selectors.quizErrorState ||
        !selectors.quizQuestionContainer || !selectors.quizNavigation ||
        !selectors.adaptiveQuizGeneralTitle || !selectors.adaptiveQuizGeneralDescription ||
        !selectors.questionTemplate || !selectors.quizProgressBar) {
        console.error("Един или повече специфични HTML елементи за адаптивния въпросник липсват.");
        showToast("Компонентът за въпросник не е напълно конфигуриран.", true);
        return;
    }

    genericOpenModal('adaptiveQuizWrapper');

    selectors.quizNavigation.classList.add('hidden');
    selectors.quizQuestionContainer.innerHTML = '';
    selectors.quizQuestionContainer.classList.add('hidden');
    selectors.quizErrorState.classList.add('hidden');
    if(selectors.adaptiveQuizGeneralTitle.parentElement) selectors.adaptiveQuizGeneralTitle.parentElement.classList.add('hidden');

    selectors.quizLoadingIndicator.classList.remove('hidden');

    try {
        const quizDataFromWorker = await _generateAdaptiveQuizClientSide(currentUserId, { trigger: "initial_or_user_request" });

        if (!quizDataFromWorker || !quizDataFromWorker.questions || quizDataFromWorker.questions.length === 0) {
            throw new Error(quizDataFromWorker?.message || "Не бяха генерирани валидни въпроси от сървъра.");
        }

        setCurrentQuizData(quizDataFromWorker);
        const newAnswers = {};
        quizDataFromWorker.questions.forEach(q => {
            if (q.answerType === 'многозначен_избор_от_списък' || q.type === 'checkbox') {
                newAnswers[q.id] = [];
            } else {
                newAnswers[q.id] = null;
            }
        });
        setUserQuizAnswers(newAnswers);
        setCurrentQuestionIndex(0);


        if (selectors.adaptiveQuizGeneralTitle) {
            selectors.adaptiveQuizGeneralTitle.textContent = currentQuizData.quizTitle || "Вашият Чек-ин";
        }
        if (selectors.adaptiveQuizGeneralDescription) {
            selectors.adaptiveQuizGeneralDescription.textContent = currentQuizData.quizDescription || "Няколко бързи въпроса, за да сме сигурни, че сте на прав път.";
        }

        if (selectors.quizProgressBar) selectors.quizProgressBar.style.width = '0%';

        selectors.quizLoadingIndicator.classList.add('hidden');
        if(selectors.adaptiveQuizGeneralTitle.parentElement) selectors.adaptiveQuizGeneralTitle.parentElement.classList.remove('hidden');
        selectors.quizQuestionContainer.classList.remove('hidden');

        renderCurrentQuizQuestion(true);

    } catch (error) {
        console.error("Error in openAdaptiveQuizModal (fetching/processing quiz data):", error);
        selectors.quizLoadingIndicator.classList.add('hidden');
        if(selectors.adaptiveQuizGeneralTitle.parentElement) selectors.adaptiveQuizGeneralTitle.parentElement.classList.add('hidden');
        selectors.quizQuestionContainer.classList.add('hidden');
        selectors.quizNavigation.classList.add('hidden');
        selectors.quizErrorState.classList.remove('hidden');
        const errorP = selectors.quizErrorState.querySelector('p');
        if (errorP) errorP.textContent = `Грешка при зареждане на въпросника: ${error.message}`;
    }
}

export function renderCurrentQuizQuestion(isTransitioningNext = true) {
    // Accessing state via imported variables from app.js
    const localCurrentQuizData = currentQuizData;
    const localUserQuizAnswers = userQuizAnswers;
    const localCurrentQuestionIndex = currentQuestionIndex;

    if (!localCurrentQuizData || !localCurrentQuizData.questions || localCurrentQuizData.questions.length === 0) {
        if (selectors.quizQuestionContainer) selectors.quizQuestionContainer.innerHTML = '<p class="placeholder aq-subtitle-hybrid">Няма въпроси за показване.</p>';
        if (selectors.quizNavigation) selectors.quizNavigation.classList.add('hidden');
        return;
    }

    if (!selectors.quizQuestionContainer || !selectors.questionTemplate || !selectors.quizNavigation ||
        !selectors.prevQuestionBtn || !selectors.nextQuestionBtn || !selectors.submitQuizBtn) {
        console.error("Критични HTML елементи за рендиране на въпрос липсват (проверка в renderCurrentQuizQuestion).");
        if (selectors.quizQuestionContainer) selectors.quizQuestionContainer.innerHTML = '<p class="placeholder aq-subtitle-hybrid" style="color:var(--aq-danger-color);">Грешка: Шаблонът за въпроси не е намерен.</p>';
        return;
    }

    hideQuizValidationMessage();

    const oldCard = selectors.quizQuestionContainer.querySelector('.aq-question-card-hybrid');
    const animationDuration = 400;

    const renderNewCard = () => {
        selectors.quizQuestionContainer.innerHTML = '';

        const questionTemplateNode = selectors.questionTemplate.content.cloneNode(true);
        const questionCardElement = questionTemplateNode.querySelector('.aq-question-card-hybrid');

        if (!questionCardElement) {
            console.error("Не може да се намери .aq-question-card-hybrid в шаблона за въпрос.");
            selectors.quizQuestionContainer.innerHTML = '<p class="placeholder aq-subtitle-hybrid" style="color:var(--aq-danger-color);">Грешка при зареждане на шаблона.</p>';
            return;
        }

        const currentQuestionToRender = localCurrentQuizData.questions[localCurrentQuestionIndex];
        const questionId = currentQuestionToRender.id;

        const cardQuestionNumEl = questionCardElement.querySelector('.aq-card-question-number-hybrid .current-q-num');
        const cardTotalNumEl = questionCardElement.querySelector('.aq-card-question-number-hybrid .total-q-num');
        if (cardQuestionNumEl) cardQuestionNumEl.textContent = localCurrentQuestionIndex + 1;
        if (cardTotalNumEl) cardTotalNumEl.textContent = localCurrentQuizData.questions.length;

        const textEl = questionCardElement.querySelector('h4.question-text');
        if (textEl) {
            textEl.id = `currentQuestionText_${questionId}`;
            textEl.innerHTML = '';
            textEl.appendChild(document.createTextNode(currentQuestionToRender.text));

            if (currentQuestionToRender.required) {
                const requiredSpan = document.createElement('span');
                requiredSpan.className = 'aq-required-star';
                requiredSpan.textContent = ' *';
                requiredSpan.title = 'Този въпрос е задължителен';
                textEl.appendChild(requiredSpan);
            }
        }

        const inputArea = questionCardElement.querySelector('.question-input-area');
        if (inputArea) {
            inputArea.innerHTML = '';
            if (textEl && textEl.id) {
                inputArea.setAttribute('aria-labelledby', textEl.id);
            }
            const answerType = currentQuestionToRender.answerType || currentQuestionToRender.type;
            const currentAnswerForThisQuestion = localUserQuizAnswers[questionId];


            switch (answerType) {
                case 'rating-squares':
                case 'rating-stars':
                case 'скала_1_5':
                    const scaleWrapper = document.createElement('div');
                    scaleWrapper.className = 'scale-input-wrapper';

                    const ratingOptions = currentQuestionToRender.options || {};
                    const minRating = safeParseFloat(ratingOptions.min, 1);
                    const maxRating = safeParseFloat(ratingOptions.max, 5);
                    const minLabelText = ratingOptions.minLabel || `Мин. (${minRating})`;
                    const maxLabelText = ratingOptions.maxLabel || `Макс. (${maxRating})`;
                    const scaleLabelsFromAI = currentQuestionToRender.scaleLabels || {};


                    const minLabelEl = document.createElement('span');
                    minLabelEl.className = 'scale-min-label';
                    minLabelEl.textContent = minLabelText;
                    scaleWrapper.appendChild(minLabelEl);

                    const ratingContainer = document.createElement('div');
                    ratingContainer.className = 'rating-squares';
                    ratingContainer.setAttribute('role', 'radiogroup');
                    if (textEl && textEl.id) ratingContainer.setAttribute('aria-labelledby', textEl.id);

                    for (let i = minRating; i <= maxRating; i++) {
                        const square = document.createElement('div');
                        square.className = 'rating-square';
                        square.dataset.value = i;
                        square.setAttribute('role', 'radio');
                        square.setAttribute('aria-checked', (currentAnswerForThisQuestion === i).toString());
                        square.tabIndex = 0;

                        const specificLabelForPoint = scaleLabelsFromAI[i.toString()];
                        if (specificLabelForPoint) {
                            square.textContent = specificLabelForPoint;
                            square.title = `Оценка ${i}: ${specificLabelForPoint}`;
                        } else {
                            square.textContent = i.toString();
                            square.title = `Оценка ${i}`;
                        }

                        if (currentAnswerForThisQuestion === i) square.classList.add('filled');

                        const handleRatingClick = () => {
                            const newAnswers = { ...localUserQuizAnswers, [questionId]: i };
                            setUserQuizAnswers(newAnswers); // Update global state
                            ratingContainer.querySelectorAll('.rating-square').forEach(s => {
                                s.classList.remove('filled');
                                if (parseInt(s.dataset.value) === i) s.classList.add('filled');
                                s.setAttribute('aria-checked', (parseInt(s.dataset.value) === i).toString());
                            });
                        };
                        square.addEventListener('click', handleRatingClick);
                        square.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRatingClick(); }});
                        ratingContainer.appendChild(square);
                    }
                    scaleWrapper.appendChild(ratingContainer);

                    const maxLabelEl = document.createElement('span');
                    maxLabelEl.className = 'scale-max-label';
                    maxLabelEl.textContent = maxLabelText;
                    scaleWrapper.appendChild(maxLabelEl);
                    inputArea.appendChild(scaleWrapper);
                    break;
                case 'textarea':
                case 'свободен_текст':
                    const textarea = document.createElement('textarea');
                    textarea.id = `q_input_${questionId}`;
                    textarea.name = questionId;
                    textarea.placeholder = currentQuestionToRender.placeholder || 'Напишете отговора си тук...';
                    textarea.value = currentAnswerForThisQuestion || '';
                    textarea.addEventListener('input', (e) => {
                        const newAnswers = { ...localUserQuizAnswers, [questionId]: e.target.value };
                        setUserQuizAnswers(newAnswers);
                    });
                    if(currentQuestionToRender.required) textarea.required = true;
                    inputArea.appendChild(textarea);
                    break;
                case 'radio':
                case 'еднозначен_избор_от_списък':
                    const radioGroup = document.createElement('div');
                    radioGroup.className = 'radio-group-vertical';
                    radioGroup.setAttribute('role', 'radiogroup');
                    if (textEl && textEl.id) radioGroup.setAttribute('aria-labelledby', textEl.id);

                    (currentQuestionToRender.options || []).forEach(opt => {
                        const optionValue = (typeof opt === 'string') ? opt : opt.value;
                        const optionLabel = (typeof opt === 'string') ? opt : (opt.label || opt.value);
                        const optionIdSafe = `q_opt_${questionId}_${String(optionValue).replace(/\W/g, '_').substring(0, 50)}`;
                        const label = document.createElement('label');
                        label.htmlFor = optionIdSafe;
                        const input = document.createElement('input');
                        input.type = 'radio';
                        input.id = optionIdSafe;
                        input.name = `q_radio_${questionId}`;
                        input.value = optionValue;
                        input.checked = currentAnswerForThisQuestion === optionValue;
                        input.addEventListener('change', (e) => {
                            const newAnswers = { ...localUserQuizAnswers, [questionId]: e.target.value };
                            setUserQuizAnswers(newAnswers);
                        });
                        if(currentQuestionToRender.required) input.required = true;
                        const spanForText = document.createElement('span');
                        spanForText.textContent = optionLabel;
                        label.appendChild(input);
                        label.appendChild(spanForText);
                        radioGroup.appendChild(label);
                    });
                    inputArea.appendChild(radioGroup);
                    break;
                case 'checkbox':
                case 'многозначен_избор_от_списък':
                    const checkboxGroup = document.createElement('div');
                    checkboxGroup.className = 'checkbox-group-vertical';
                    let currentArrayAnswer = Array.isArray(currentAnswerForThisQuestion) ? [...currentAnswerForThisQuestion] : (currentAnswerForThisQuestion ? [currentAnswerForThisQuestion] : []);

                    (currentQuestionToRender.options || []).forEach(opt => {
                        const optionValue = (typeof opt === 'string') ? opt : opt.value;
                        const optionLabel = (typeof opt === 'string') ? opt : (opt.label || opt.value);
                        const optionIdSafe = `q_opt_${questionId}_${String(optionValue).replace(/\W/g, '_').substring(0, 50)}`;
                        const label = document.createElement('label');
                        label.htmlFor = optionIdSafe;
                        const input = document.createElement('input');
                        input.type = 'checkbox';
                        input.id = optionIdSafe;
                        input.name = `q_checkbox_${questionId}_${String(optionValue).replace(/\W/g, '_').substring(0, 50)}`;
                        input.value = optionValue;
                        input.checked = currentArrayAnswer.includes(optionValue);
                        input.addEventListener('change', (e) => {
                            let updatedArrayAnswer = [...(localUserQuizAnswers[questionId] || [])]; // Get fresh copy of array from state
                            if (e.target.checked) {
                                if (!updatedArrayAnswer.includes(optionValue)) updatedArrayAnswer.push(optionValue);
                            } else {
                                updatedArrayAnswer = updatedArrayAnswer.filter(v => v !== optionValue);
                            }
                            const newAnswers = { ...localUserQuizAnswers, [questionId]: updatedArrayAnswer };
                            setUserQuizAnswers(newAnswers);
                        });
                        const spanForText = document.createElement('span');
                        spanForText.textContent = optionLabel;
                        label.appendChild(input);
                        label.appendChild(spanForText);
                        checkboxGroup.appendChild(label);
                    });
                    inputArea.appendChild(checkboxGroup);
                    break;
                default:
                    const defaultInput = document.createElement('input');
                    defaultInput.type = answerType === 'number' ? 'number' : (answerType === 'date' ? 'date' : 'text');
                    if (answerType === 'number' && currentQuestionToRender.options) {
                        if (currentQuestionToRender.options.min !== undefined) defaultInput.min = currentQuestionToRender.options.min;
                        if (currentQuestionToRender.options.max !== undefined) defaultInput.max = currentQuestionToRender.options.max;
                        if (currentQuestionToRender.options.step !== undefined) defaultInput.step = currentQuestionToRender.options.step;
                    }
                    defaultInput.id = `q_input_${questionId}`;
                    defaultInput.name = questionId;
                    defaultInput.placeholder = currentQuestionToRender.placeholder || 'Въведете отговор';
                    defaultInput.value = currentAnswerForThisQuestion || '';
                    defaultInput.addEventListener('input', (e) => {
                        const newAnswers = { ...localUserQuizAnswers, [questionId]: e.target.value };
                        setUserQuizAnswers(newAnswers);
                    });
                    if(currentQuestionToRender.required) defaultInput.required = true;
                    inputArea.appendChild(defaultInput);
                    break;
            }
        } else { console.warn("Input area (.question-input-area) not found in question card for:", currentQuestionToRender.text); }

        requestAnimationFrame(() => {
            questionCardElement.classList.add(isTransitioningNext ? 'aq-entering-right' : 'aq-entering-left');
        });

        selectors.quizQuestionContainer.appendChild(questionCardElement);

        const progressBar = selectors.quizProgressBar;
        if (progressBar && localCurrentQuizData && localCurrentQuizData.questions.length > 0) {
            updateStepProgress(
                progressBar,
                localCurrentQuestionIndex + 1,
                localCurrentQuizData.questions.length,
                null,
                null
            );
            const progressPercentage = ((localCurrentQuestionIndex + 1) / localCurrentQuizData.questions.length) * 100;
            progressBar.setAttribute('aria-valuenow', progressPercentage);
        }

        const currentNumEl = document.getElementById('currentQuestionNumber');
        const totalNumEl = document.getElementById('totalQuestionsNumber');
        if (currentNumEl) currentNumEl.textContent = localCurrentQuestionIndex + 1;
        if (totalNumEl) totalNumEl.textContent = localCurrentQuizData.questions.length;

        selectors.prevQuestionBtn.classList.toggle('hidden', localCurrentQuestionIndex === 0);
        selectors.nextQuestionBtn.classList.toggle('hidden', localCurrentQuestionIndex === localCurrentQuizData.questions.length - 1);
        selectors.submitQuizBtn.classList.toggle('hidden', localCurrentQuestionIndex !== localCurrentQuizData.questions.length - 1);
        if (selectors.quizNavigation) selectors.quizNavigation.classList.remove('hidden');

        const firstInteractiveElement = inputArea?.querySelector('input:not([type="hidden"]), textarea, .rating-square[tabindex="0"], select');
        if (firstInteractiveElement) {
            setTimeout(() => firstInteractiveElement.focus(), 50);
        }
    };

    if (oldCard) {
        oldCard.classList.add(isTransitioningNext ? 'aq-exiting-left' : 'aq-exiting-right');
        setTimeout(renderNewCard, animationDuration - 50);
    } else {
        renderNewCard();
    }
}


export function showQuizValidationMessage(message) {
    const currentCard = selectors.quizQuestionContainer.querySelector('.aq-question-card-hybrid');
    if (!currentCard) return;

    const validationEl = currentCard.querySelector('.question-validation-message');
    if (validationEl) {
        const textEl = validationEl.querySelector('.validation-text');
        if (textEl) textEl.textContent = message;
        validationEl.classList.remove('hidden');
        validationEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

export function hideQuizValidationMessage() {
    const currentCard = selectors.quizQuestionContainer.querySelector('.aq-question-card-hybrid');
    if (!currentCard) return;

    const validationEl = currentCard.querySelector('.question-validation-message');
    if (validationEl) {
        validationEl.classList.add('hidden');
    }
}

// Functions related to quiz summary and display logic (not directly UI rendering of questions)
export function getSummaryFromLastCompletedQuiz(userData = fullDashboardData) {
    let summary = "Няма данни от последния адаптивен въпросник.";
    const adaptiveQuizzes = safeGet(userData, 'adaptiveQuizzes', []);

    if (adaptiveQuizzes.length > 0) {
        const completedQuizzes = adaptiveQuizzes.filter(q => q.status === "completed" && q.dateCompleted)
                                            .sort((a,b) => new Date(b.dateCompleted).getTime() - new Date(a.dateCompleted).getTime());
        if (completedQuizzes.length > 0) {
            const lastCompletedQuiz = completedQuizzes[0];
            const quizDefinition = safeGet(userData, ['quizDefinitions', lastCompletedQuiz.quizId]);
            if (lastCompletedQuiz && lastCompletedQuiz.answers && quizDefinition && quizDefinition.questions) {
                summary = formatQuizAnswersForClientDisplay(quizDefinition, lastCompletedQuiz.answers, `Резюме от въпросник (ID: ${lastCompletedQuiz.quizId}, попълнен на ${new Date(lastCompletedQuiz.dateCompleted).toLocaleDateString('bg-BG')})`);
            } else if (lastCompletedQuiz && lastCompletedQuiz.answers) {
                summary = `Резюме от въпросник (ID: ${lastCompletedQuiz.quizId}, попълнен на ${new Date(lastCompletedQuiz.dateCompleted).toLocaleDateString('bg-BG')} - дефиниция липсва):\n${JSON.stringify(lastCompletedQuiz.answers, null, 2)}`;
            }
        }
    }
    return summary;
}

export function getSummaryFromPreviousQuizzes(userData = fullDashboardData, count = 2) {
    let summary = "Няма данни от предишни адаптивни въпросници.";
    const adaptiveQuizzes = safeGet(userData, 'adaptiveQuizzes', []);
    if (adaptiveQuizzes.length > 0) {
        const summaryParts = [];
        const recentCompletedQuizzes = adaptiveQuizzes
            .filter(q => q.status === "completed" && q.dateCompleted && q.answers)
            .sort((a, b) => new Date(b.dateCompleted).getTime() - new Date(a.dateCompleted).getTime())
            .slice(0, count);

        if (recentCompletedQuizzes.length > 0) {
            summaryParts.push("Резюме от последните няколко попълнени адаптивни въпросника:");
            recentCompletedQuizzes.forEach((quiz, index) => {
                const quizDefinition = safeGet(userData, ['quizDefinitions', quiz.quizId]);
                 if (quizDefinition && quizDefinition.questions) {
                    summaryParts.push(formatQuizAnswersForClientDisplay(quizDefinition, quiz.answers, `--- Въпросник ${index + 1} (ID: ${quiz.quizId}, попълнен на ${new Date(quiz.dateCompleted).toLocaleDateString('bg-BG')}) ---`));
                } else {
                    summaryParts.push(`--- Въпросник ${index + 1} (ID: ${quiz.quizId}, попълнен на ${new Date(quiz.dateCompleted).toLocaleDateString('bg-BG')} - дефиниция липсва) ---\n${JSON.stringify(quiz.answers, null, 2)}`);
                }
            });
            summary = summaryParts.join("\n\n");
        }
    }
    return summary;
}

export function formatQuizAnswersForClientDisplay(quizDefinition, submittedAnswers, title = "Резюме на отговори") {
    let formattedText = `${title}:\n`;
    if (quizDefinition && quizDefinition.questions && submittedAnswers) {
        const answerDetails = quizDefinition.questions.map(question => {
            const answerValue = submittedAnswers[question.id];
            const answerType = question.answerType || question.type;
            let answerRepresentation = "Не е отговорено";

            if (answerValue !== undefined && answerValue !== null && (Array.isArray(answerValue) ? answerValue.length > 0 : String(answerValue).trim() !== "")) {
                if (answerType === 'скала_1_5' || answerType === 'rating-squares' || answerType === 'rating-stars') {
                    answerRepresentation = `${answerValue} от ${safeGet(question.options, 'max', 5)}`;
                    const minL = safeGet(question.options, 'minLabel');
                    const maxL = safeGet(question.options, 'maxLabel');
                    if (minL && maxL) answerRepresentation += ` (${minL} до ${maxL})`;
                } else if ((answerType === 'еднозначен_избор_от_списък' || answerType === 'radio' || answerType === 'select') && Array.isArray(question.options)) {
                    const selectedOption = question.options.find(opt => (typeof opt === 'string' ? opt : opt.value) === answerValue);
                    answerRepresentation = (typeof selectedOption === 'string') ? selectedOption : (selectedOption ? (selectedOption.label || selectedOption.value) : String(answerValue));
                } else if ((answerType === 'многозначен_избор_от_списък' || answerType === 'checkbox') && Array.isArray(answerValue) && Array.isArray(question.options)) {
                    answerRepresentation = answerValue.map(val => {
                        const opt = question.options.find(o => (typeof o === 'string' ? o : o.value) === val);
                        return (typeof opt === 'string') ? opt : (opt ? (opt.label || opt.value) : val);
                    }).join(', ') || "Нито една опция";
                     if(answerValue.length === 0) answerRepresentation = "Нито една опция не е избрана";
                } else {
                    answerRepresentation = String(answerValue).trim();
                }
            }
            return `- Въпрос (ID: ${question.id}): "${question.text}"\n  - Отговор: ${answerRepresentation}`;
        });
        if (answerDetails.length > 0) {
            formattedText += answerDetails.join("\n");
        } else {
            formattedText += "Няма подадени отговори за този въпросник.";
        }
    } else {
        formattedText = `${title}: Не могат да бъдат форматирани отговорите - липсват данни за въпросника или отговорите.`;
    }
    return formattedText;
}

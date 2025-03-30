// Process content with AI
async function processWithAI(content, type, source) {
    try {
        // Create prompt for summary
        const summaryPrompt = `You are an educational content analyzer. Your task is to create a detailed, well-structured summary of the following ${type} content from ${source}. 
        Focus on key concepts, important points, and main ideas. Format your summary with clear headings, bullet points, and markdown formatting for readability.
        
        Content: ${content.substring(0, 10000)}${content.length > 10000 ? '... (content truncated due to length)' : ''}`;

        // Create prompt for quiz
        const quizPrompt = `You are an educational content analyzer. Based on the following ${type} content from ${source}, generate a 5-question multiple-choice quiz to test comprehension.
        For each question, provide 4 options with exactly one correct answer. Format your response as a JSON array where each element is an object with the structure:
        {
            "question": "Question text",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "answer": 0 // Index of the correct answer (0-3)
        }
        
        Content: ${content.substring(0, 10000)}${content.length > 10000 ? '... (content truncated due to length)' : ''}`;

        // Call OpenAI API for summary
        const summaryResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: [
                    {
                        role: "user",
                        content: summaryPrompt
                    }
                ],
                temperature: 0.5
            })
        });

        const summaryData = await summaryResponse.json();

        if (summaryData.error) {
            throw new Error(`API Error: ${summaryData.error.message}`);
        }

        // Call OpenAI API for quiz
        const quizResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: [
                    {
                        role: "user",
                        content: quizPrompt
                    }
                ],
                temperature: 0.7
            })
        });

        const quizData = await quizResponse.json();

        if (quizData.error) {
            throw new Error(`API Error: ${quizData.error.message}`);
        }

        // Parse results
        const summary = summaryData.choices[0].message.content;

        // Parse the quiz JSON, handling potential formatting issues
        let quiz;
        try {
            const quizText = quizData.choices[0].message.content;
            // Extract JSON if it's wrapped in code blocks
            const jsonMatch = quizText.match(/```json\n([\s\S]*)\n```/) ||
                quizText.match(/```\n([\s\S]*)\n```/) ||
                quizText.match(/\[([\s\S]*)\]/);

            const jsonString = jsonMatch ? jsonMatch[1] : quizText;
            quiz = JSON.parse(jsonString.includes('[') ? jsonString : `[${jsonString}]`);
        } catch (e) {
            console.error("Error parsing quiz JSON:", e);
            throw new Error("Failed to parse quiz data. Try again.");
        }

        return {
            summary: summary,
            quiz: quiz
        };
    } catch (error) {
        console.error("AI Processing Error:", error);
        throw new Error(`Failed to process content: ${error.message}`);
    }
}

// Display results
function displayResults(results) {
    hideLoader();

    // Store data globally
    summaryData = results.summary;
    quizData = results.quiz;

    // Display summary
    const summaryElement = document.getElementById('summary-content');
    summaryElement.innerHTML = marked.parse(summaryData);

    // Generate quiz
    generateQuiz(quizData);

    // Show results container
    document.getElementById('result-container').style.display = 'block';

    // Scroll to results
    document.getElementById('result-container').scrollIntoView({ behavior: 'smooth' });
}

// Generate quiz HTML
function generateQuiz(quizData) {
    const quizContainer = document.getElementById('quiz-container');
    quizContainer.innerHTML = '';
    correctAnswers = [];

    quizData.forEach((question, questionIndex) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'quiz-question';

        const questionText = document.createElement('div');
        questionText.className = 'question-text';
        questionText.textContent = `Question ${questionIndex + 1}: ${question.question}`;

        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'quiz-options';

        // Store correct answer
        correctAnswers.push(question.answer);

        question.options.forEach((option, optionIndex) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'quiz-option';
            optionDiv.dataset.questionIndex = questionIndex;
            optionDiv.dataset.optionIndex = optionIndex;
            optionDiv.textContent = option;

            optionDiv.addEventListener('click', selectOption);

            optionsDiv.appendChild(optionDiv);
        });

        questionDiv.appendChild(questionText);
        questionDiv.appendChild(optionsDiv);
        quizContainer.appendChild(questionDiv);
    });
}

// Handle option selection
function selectOption(event) {
    const questionIndex = event.target.dataset.questionIndex;
    const optionElements = document.querySelectorAll(`.quiz-option[data-question-index="${questionIndex}"]`);

    optionElements.forEach(option => {
        option.classList.remove('selected');
    });

    event.target.classList.add('selected');
}

// Check quiz answers
function checkQuiz() {
    let correctCount = 0;
    let totalQuestions = quizData.length;

    for (let i = 0; i < totalQuestions; i++) {
        const selectedOption = document.querySelector(`.quiz-option[data-question-index="${i}"].selected`);

        if (selectedOption && parseInt(selectedOption.dataset.optionIndex) === correctAnswers[i]) {
            correctCount++;
        }
    }

    const resultElement = document.getElementById('quiz-result');
    resultElement.textContent = `You scored ${correctCount} out of ${totalQuestions} (${Math.round((correctCount / totalQuestions) * 100)}%)`;
    resultElement.style.display = 'block';
}

// Reset quiz
function resetQuiz() {
    const selectedOptions = document.querySelectorAll('.quiz-option.selected');
    selectedOptions.forEach(option => {
        option.classList.remove('selected');
    });

    document.getElementById('quiz-result').style.display = 'none';
}

// Download summary
function downloadSummary() {
    const filename = 'learning_summary.md';
    const text = summaryData;

    downloadFile(filename, text);
}

// Download quiz
function downloadQuiz() {
    const filename = 'learning_quiz.txt';
    let text = '';

    quizData.forEach((question, index) => {
        text += `Question ${index + 1}: ${question.question}\n\n`;

        question.options.forEach((option, optionIndex) => {
            text += `${String.fromCharCode(65 + optionIndex)}) ${option}\n`;
        });

        text += `\nCorrect Answer: ${String.fromCharCode(65 + question.answer)}\n\n`;
    });

    downloadFile(filename, text);
}

// Helper function to download file
function downloadFile(filename, text) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

// Copy to clipboard
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    let text = '';

    if (elementId === 'summary-content') {
        text = summaryData;
    } else {
        text = element.innerText;
    }

    navigator.clipboard.writeText(text).then(() => {
        alert('Content copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy: ', err);
        alert('Failed to copy content to clipboard.');
    });
}

// Show loader
function showLoader() {
    document.getElementById('loader').style.display = 'block';
}

// Hide loader
function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

// Validate YouTube URL
function isValidYouTubeUrl(url) {
    const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=)|youtu\.be\/)([^&#?]+)(?:[\?&]t=(\d+))?/;
    const match = url.match(regExp);
    return match && match[1].length === 11;
}

// Add marked.js library for rendering markdown
document.addEventListener('DOMContentLoaded', function() {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    document.head.appendChild(script);

    script.onload = function() {
        console.log('Marked.js loaded successfully');
    };
});

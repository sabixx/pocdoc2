const infoPanel = document.getElementById('info-panel');
const infoPanelContent = document.getElementById('info-panel-content');
const infoText = document.getElementById('info-text');
const infoUrl = document.getElementById('info-url');
const infoUsername = document.getElementById('info-username');
const infoPassword = document.getElementById('info-password');
const copyUrlButton = document.getElementById('copy-url');
const copyUsernameButton = document.getElementById('copy-username');
const copyPasswordButton = document.getElementById('copy-password');

let infoContent = {};
let currentSection = null;
let completedUseCases = {};
let selectedSmileys = {};

// Fetch the JSON file and store it in the `infoContent` variable
fetch('config/infoContent.json')
    .then(response => response.json())
    .then(data => {
        infoContent = data;
    })
    .catch(error => {
        console.error('Error loading infoContent:', error);
    });


// Load the completed use cases from JSON file on page load
document.addEventListener("DOMContentLoaded", function () {
    fetch('/var/www/html/data/completed.json', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ useCase: 'test' })
    })
        .then(response => response.json())
        .then(data => {
            console.log('Response from saveCompletedUseCases.php:', data);
        })
        .catch(error => {
            console.error('Error saving completed use cases:', error);
        });
});

// Attach the scroll event listener to the #main container
const mainContent = document.getElementById('main');
mainContent.addEventListener('scroll', onScroll);

document.addEventListener("DOMContentLoaded", function () {
    fetch('./config/infoContent.json')
        .then(response => response.json())
        .then(data => {
            infoContent = data;
            currentSection = 'welcome';
            updatePanelContent('welcome');
        })
        .catch(error => {
            console.error('Error loading infoContent:', error);
        });

    // Regular expression to match numbers followed by a dot (e.g., "1.")
    const numberRegex = /^(\d+\.)/;

    // Select all paragraph and anchor elements
    const elements = document.querySelectorAll("p, a");

    elements.forEach(element => {
        // Apply formatting to matching text
        element.innerHTML = element.innerHTML.replace(numberRegex, function (match) {
            return `<strong>${match}</strong>`;
        });
    });
});

document.addEventListener("DOMContentLoaded", function () {
    fetch('config/useCaseConfig.json')
        .then(response => response.json())
        .then(configData => {
            feedbackLabels = configData.feedbackLabels || {};

            const noFeedbackUseCases = configData.noFeedbackUseCases || [];

            // Iterate through each use case section to append feedback
            const useCases = document.querySelectorAll('.use-case');
            useCases.forEach((useCase) => {
                const useCaseId = useCase.getAttribute('id');

                // Skip adding feedback if it's in the no-feedback list
                if (!noFeedbackUseCases.includes(useCaseId)) {
                    const feedbackSection = generateFeedbackSection(useCaseId);
                    console.log('Appending:', feedbackSection);
                    console.log('Type of feedbackSection:', typeof feedbackSection);
                    useCase.appendChild(feedbackSection);
                }
            });
        })
        .catch(error => console.error('Error loading use case configuration:', error));
});


// Attach event listeners to buttons after the DOM has fully loaded
document.addEventListener("DOMContentLoaded", function () {
    // Select all buttons with an ID starting with "button-use-case-"
    const buttons = document.querySelectorAll("button[id^='button-use-case-']");
    buttons.forEach(button => {
        button.addEventListener("click", toggleComplete);
    });
});

// Toggle completion status of a use case
function toggleComplete(event) {
    event.preventDefault(); // Prevent the default action of the button

    const button = event.target;

    // Extract use case ID properly, removing "button-use-case-" prefix
    const useCaseId = button.id.replace('button-use-case-', '');

    // Check if the extracted ID exists in infoContent
    if (!useCaseId || !infoContent[useCaseId]) {
        console.error('Unable to determine the use case:', useCaseId);
        alert('Unable to determine the use case. Please make sure a valid use case is specified.');
        return;
    }

    // Toggle completion status
    completedUseCases[useCaseId] = !completedUseCases[useCaseId];

    console.log('Updated completedUseCases:', completedUseCases);

    // Update button text based on the completion status
    button.textContent = completedUseCases[useCaseId] ? 'Uncheck Completion' : 'Complete This Use Case';

    updateCompletedUseCasesUI();
    // Optionally save the state
    saveCompletedUseCases();
}


//change the UI on completition
function updateCompletedUseCasesUI() {
    console.log('Updating completed use cases UI...');
    console.log('Current completedUseCases:', completedUseCases);

    for (const useCaseId in completedUseCases) {
        const linkElement = document.getElementById('link-' + useCaseId);
        const buttonElement = document.getElementById('button-' + useCaseId);
        const feedbackSection = document.getElementById('feedback-' + useCaseId);

        console.log(`Processing use case: ${useCaseId}`);
        console.log('Link element:', linkElement);
        console.log('Button element:', buttonElement);
        console.log('Feedback section:', feedbackSection);

        if (completedUseCases[useCaseId]) {
            console.log(`Marking use case '${useCaseId}' as completed.`);
            if (linkElement) {
                if (!linkElement.innerHTML.startsWith('✓ ')) {
                    linkElement.innerHTML = '✓ ' + linkElement.innerHTML; // Add a checkmark only once
                }
                linkElement.classList.add('completed');
                linkElement.style.color = 'lightgrey';
            } else {
                console.warn(`Link element for '${useCaseId}' not found.`);
            }

            if (buttonElement) {
                buttonElement.textContent = 'Uncheck Completed';
            } else {
                console.warn(`Button element for '${useCaseId}' not found.`);
            }

            if (feedbackSection) {
                feedbackSection.style.display = 'block';
                console.log(`Feedback section for '${useCaseId}' is now visible.`);
            } else {
                console.warn(`Feedback section for '${useCaseId}' not found.`);
            }
        } else {
            console.log(`Marking use case '${useCaseId}' as not completed.`);
            if (linkElement) {
                linkElement.classList.remove('completed');
                linkElement.innerHTML = linkElement.innerHTML.replace(/^✓ /, ''); // Remove the checkmark
                linkElement.style.color = 'black';
            } else {
                console.warn(`Link element for '${useCaseId}' not found.`);
            }

            if (buttonElement) {
                buttonElement.textContent = 'Complete This Use Case';
            } else {
                console.warn(`Button element for '${useCaseId}' not found.`);
            }

            if (feedbackSection) {
                feedbackSection.style.display = 'none';
                console.log(`Feedback section for '${useCaseId}' is now hidden.`);
            } else {
                console.warn(`Feedback section for '${useCaseId}' not found.`);
            }
        }
    }

    console.log('Completed updating use cases UI.');
}


// Save the completed use cases to a JSON file
function saveCompletedUseCases() {
    console.log('Saving completed use cases...');
    fetch('http://172.17.32.15:8080/saveCompletedUseCases.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(completedUseCases)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Server response:', data);
        if (data.status === 'success') {
            console.log('Completed use cases saved successfully.');
        } else {
            console.error('Failed to save completed use cases:', data.message);
        }
    })
    .catch(error => {
        console.error('Error saving completed use cases:', error);
    });
}





// Send the data to php
function sendFeedback(useCaseId, smiley) {
    // Store the selected smiley
    selectedSmiley = smiley;

    // Highlight the selected smiley
    const smileyElements = document.querySelectorAll(`#feedback-${useCaseId} .smiley`);
    smileyElements.forEach(element => {
        element.classList.remove('selected'); // Remove selection from all smileys
    });

    // Add the 'selected' class to the clicked smiley
    const selectedElement = document.querySelector(`#feedback-${useCaseId} .smiley.${smiley}`);
    if (selectedElement) {
        selectedElement.classList.add('selected');
    }
}

// Fetch hidden use cases and sections
fetch('./config/hiddenUseCases.json')
    .then(response => response.json())
    .then(data => {
        const hiddenUseCases = data.hiddenUseCases || [];
        const hiddenSections = data.hiddenSections || [];
        hideUseCasesAndSections(hiddenUseCases, hiddenSections);
    })
    .catch(error => console.error('Error loading hidden use cases and sections:', error));

function hideUseCasesAndSections(hiddenUseCases, hiddenSections) {
    // Hide use cases by ID
    hiddenUseCases.forEach(useCaseId => {
        hideElementById(useCaseId);
    });

    // Hide sections by their heading and contained use cases
    hiddenSections.forEach(section => {
        hideSection(section);
    });
}

function hideElementById(elementId) {
    // Hide corresponding sidebar link
    const sidebarLink = document.querySelector(`[href="#${elementId}"]`);
    if (sidebarLink) {
        sidebarLink.style.display = 'none';
    }

    // Hide corresponding main content section
    const contentSection = document.getElementById(elementId);
    if (contentSection) {
        contentSection.style.display = 'none';
    }
}

function hideSection(sectionName) {
    // Hide the section heading
    const sectionHeading = Array.from(document.querySelectorAll('h3')).find(heading => heading.textContent === sectionName);
    if (sectionHeading) {
        sectionHeading.style.display = 'none';
    }

    // Hide all links under this section
    let nextSibling = sectionHeading ? sectionHeading.nextElementSibling : null;
    while (nextSibling && nextSibling.tagName === 'A') {
        nextSibling.style.display = 'none';
        nextSibling = nextSibling.nextElementSibling;
    }

    // Hide all main content sections related to the use cases in this section
    if (sectionHeading) {
        let sectionUseCases = [];
        nextSibling = sectionHeading.nextElementSibling;
        while (nextSibling && nextSibling.tagName === 'A') {
            const hrefValue = nextSibling.getAttribute('href');
            if (hrefValue && hrefValue.startsWith('#')) {
                sectionUseCases.push(hrefValue.substring(1));
            }
            nextSibling = nextSibling.nextElementSibling;
        }

        // Hide all use case sections in the main content
        sectionUseCases.forEach(useCaseId => hideElementById(useCaseId));
    }
}

function updatePanelContent(section) {
    // Update the current section
    currentSection = section;

    // Clear previous content
    infoPanelContent.innerHTML = '';

    // Update the current section
    currentSection = section;

    // Get the specific use case data by the provided section key
    const useCase = infoContent[section];

    if (useCase) {
        const useCaseDiv = document.createElement('div');
        useCaseDiv.classList.add('use-case-info');
        useCaseDiv.id = `use-case-${section}`;

        // Add use case text
        const useCaseText = document.createElement('p');
        useCaseText.textContent = useCase.text;
        useCaseDiv.appendChild(useCaseText);

        // Loop through each credential in the credentials array
        if (useCase.credentials && Array.isArray(useCase.credentials)) {
            useCase.credentials.forEach((credential, index) => {
                const credentialDiv = document.createElement('div');
                credentialDiv.classList.add('credential-info');
                credentialDiv.id = `credential-${section}-${index}`;

                //Add text
                if (Array.isArray(credential.text)) {
                    credential.text.forEach((text) => {
                        const textElement = document.createElement('p');
                        textElement.innerHTML = `${text}&#128203;`;
                        credentialDiv.appendChild(textElement);
                    });
                } else if (credential.text) {
                    const textElement = document.createElement('p');
                    textElement.innerHTML = `${credential.text}&#128203;`;
                    credentialDiv.appendChild(textElement);
                }

                // Add URL
                if (credential.url) {
                    const urlElement = document.createElement('p');
            //      urlElement.innerHTML = `URL: <a href="${credential.url}" target="_blank">${credential.url}</a> <span class="copy-icon" onclick="copyToClipboard('url', '${section}', ${index})"&#128203;</span>`;
                    urlElement.innerHTML = `URL: <a href="${credential.url}" target="_blank">${credential.url}</a> <span class="copy-icon" onclick="copyToClipboard('url', '${section}', ${index})">&#128203;</span>`;

                    credentialDiv.appendChild(urlElement);
                }

                // Add Username
                if (credential.username) {
                    const usernameElement = document.createElement('p');
                    usernameElement.innerHTML = `Username: <span class="copy-text">${credential.username}</span> <span class="copy-icon" onclick="copyToClipboard('username', '${section}', ${index})">&#128203;</span>`;
                    credentialDiv.appendChild(usernameElement);
                }

                // Add Password
                if (credential.password) {
                    const passwordElement = document.createElement('p');
                    passwordElement.innerHTML = `Password: <span class="copy-text">${credential.password}</span> <span class="copy-icon" onclick="copyToClipboard('password', '${section}', ${index})">&#128203;</span>`;
                    credentialDiv.appendChild(passwordElement);
                }

                // Append the credential information to the use case div
                useCaseDiv.appendChild(credentialDiv);
            });
        }

        // Append the use case information to the info panel content
        infoPanelContent.appendChild(useCaseDiv);
    } else {
        // If no use case is found, display an error or a default message
        const errorText = document.createElement('p');
        errorText.textContent = "No information available for this section.";
        infoPanelContent.appendChild(errorText);
    }
}

function copyToClipboard(field, key, index) {
    let text = '';
    const credentialDiv = document.getElementById(`credential-${key}-${index}`);
    if (!credentialDiv) {
        console.error("Credential div not found for key:", key, "index:", index);
        alert("Failed to copy. No credential found.");
        return;
    }

    const copyTextElements = credentialDiv.querySelectorAll(".copy-text");
    
    if (field === 'url') {
        const linkElement = credentialDiv.querySelector("a");
        text = linkElement ? linkElement.href : '';
    } else if (field === 'username') {
        text = copyTextElements[0] ? copyTextElements[0].textContent.trim() : '';
    } else if (field === 'password') {
        text = copyTextElements[1] ? copyTextElements[1].textContent.trim() : '';
    }

    if (!text) {
        console.error("No text found to copy for field:", field);
        alert(`Failed to copy ${field}. No content available.`);
        return;
    }

    if (!navigator.clipboard) {
        console.error("Clipboard API not supported.");
        alert("Your browser does not support copying to clipboard. Make sure you're running the app over HTTPS or localhost.");
        return;
    }

    navigator.clipboard.writeText(text)
        .then(() => {
            alert(`${field} copied to clipboard!`);
            console.log(`${field} successfully copied:`, text);
        })
        .catch(err => {
            console.error("Failed to copy text. Possible reasons:", err);
            alert("Failed to copy text. Ensure you're running this over HTTPS or localhost, and try again.");
        });
}



function toggleInfoPanel() {
    const infoPanel = document.getElementById('info-panel');
    const mainContent = document.getElementById('main');
    const menuButton = document.getElementById('menu-button');

    if (infoPanel.classList.contains('open')) {
        // Close the info panel
        infoPanel.classList.remove('open');
        mainContent.classList.remove('shrink');
        menuButton.style.display = 'block'; // Show the button when the panel is closed
    } else {
        // Open the info panel
        infoPanel.classList.add('open');
        mainContent.classList.add('shrink');
        menuButton.style.display = 'none'; // Hide the button when the panel is open
    }
}

function closeInfoPanel() {
    const infoPanel = document.getElementById('info-panel');
    const mainContent = document.getElementById('main');
    const menuButton = document.getElementById('menu-button');

    infoPanel.classList.remove('open');
    mainContent.classList.remove('shrink');
    menuButton.style.display = 'block'; // Show the button when the panel is closed
}

function showCredentials() {
    if (currentSection && infoContent[currentSection]) {
        toggleInfoPanel();
    }
}

function showContent(section) {
    updatePanelContent(section);
}


function getCurrentSectionInView() {
    const sections = document.querySelectorAll('.use-case');
    let currentSectionId = null;

    for (let section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2) {
            currentSectionId = section.id;
            break;  // Exit loop once we find the first section in view
        }
    }

    return currentSectionId;
}

// Toggle Assistance Form
function toggleAssistanceForm() {
    const assistanceForm = document.getElementById('assistance-form');
    if (assistanceForm.style.display === 'none' || assistanceForm.style.display === '') {
        assistanceForm.style.display = 'block';
    } else {
        assistanceForm.style.display = 'none';
    }
}

// Send Assistance Message
function sendAssistanceMessage() {
    const assistanceMessage = document.getElementById('assistance-message').value;

    if (assistanceMessage.trim() === '') {
        alert('Please enter a message before sending.');
        return;
    }

    // Here you would send the message to the server
    alert('Assistance message sent successfully: ' + assistanceMessage);

    // Clear the textarea and hide the form after sending
    document.getElementById('assistance-message').value = '';
    document.getElementById('assistance-form').style.display = 'none';
}

// Function to handle scroll and update the info panel
function onScroll() {
    const sectionInView = getCurrentSectionInView();
    if (sectionInView && sectionInView !== currentSection) {
        currentSection = sectionInView;
        updatePanelContent(sectionInView);
    }
}


// Function to generate the feedback section dynamically
function generateFeedbackSection(useCaseId) {
    if (!useCaseId) {
        console.error('No use case ID provided to generate feedback for.');
        return null; // Explicitly return null to avoid undefined errors
    }

    // Check if feedback section already exists
    if (document.getElementById(`feedback-${useCaseId}`)) {
        console.log(`Feedback section for use case '${useCaseId}' already exists.`);
        return document.getElementById(`feedback-${useCaseId}`); // Return the existing feedback section
    }

    // Create the feedback section
    const feedbackDiv = document.createElement('div');
    feedbackDiv.id = `feedback-${useCaseId}`;
    feedbackDiv.className = 'feedback-section';
    feedbackDiv.style.display = 'none'; // Initially hidden until "Complete" button is clicked

    // Populate the feedback section with HTML content
    feedbackDiv.innerHTML = `
        <p>How did you like this use case?</p>
        <div class="smilies">
            <span class="smiley very-bad" onclick="selectSmiley('${useCaseId}', 'very-bad')"></span>
            <span class="smiley bad" onclick="selectSmiley('${useCaseId}', 'bad')"></span>
            <span class="smiley neutral" onclick="selectSmiley('${useCaseId}', 'neutral')"></span>
            <span class="smiley good" onclick="selectSmiley('${useCaseId}', 'good')"></span>
            <span class="smiley very-good" onclick="selectSmiley('${useCaseId}', 'very-good')"></span>
        </div>
        <textarea id="assistance-message-${useCaseId}" placeholder="Enter your feedback here..." rows="3"
            style="width: 100%; margin-top: 10px;"></textarea>
        <button onclick="sendAssistanceMessage('${useCaseId}')">Send Feedback</button>
    `;

    // Ensure the use case section exists before appending
    const useCaseSection = document.getElementById(useCaseId);
    if (!useCaseSection) {
        console.error(`Use case section with ID '${useCaseId}' not found.`);
        return null; // Return null if the use case section doesn't exist
    }

    // Append the feedback section to the use case section
    useCaseSection.appendChild(feedbackDiv);
    console.log(`Feedback section for '${useCaseId}' successfully appended.`);

    return feedbackDiv; // Return the newly created feedback section
}

// Function to handle smiley selection per use case
function selectSmiley(useCaseId, smiley) {
    selectedSmileys[useCaseId] = smiley;

    // Remove 'selected' class from all smileys in the current feedback section
    const smileyElements = document.querySelectorAll(`#feedback-${useCaseId} .smiley`);
    smileyElements.forEach(element => {
        element.classList.remove('selected');
    });

    // Add 'selected' class to the clicked smiley
    const selectedElement = document.querySelector(`#feedback-${useCaseId} .smiley.${smiley}`);
    if (selectedElement) {
        selectedElement.classList.add('selected');
    }
}

// Modified `sendAssistanceMessage` function to include the feedback label and hide feedback section after submission
function sendAssistanceMessage(useCaseId) {
    const assistanceMessage = document.getElementById(`assistance-message-${useCaseId}`).value.trim();
    const smiley = selectedSmileys[useCaseId] || '';

    if (assistanceMessage === '' && smiley === '') {
        alert('Please enter a message or select a smiley before sending.');
        return;
    }

    // Get the feedback label from the config
    const feedbackLabel = feedbackLabels[smiley] || '';

    // Prepare the message payload, including the selected smiley and label (if any)
    const feedbackPayload = {
        message: assistanceMessage,
        use_case: useCaseId,
        smiley: smiley,
        feedback_label: feedbackLabel
    };

    // Send the feedback message
    fetch('http://172.17.32.15:8080/sendWebhook.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedbackPayload),
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Hide the feedback section after successful submission
                const feedbackDiv = document.getElementById(`feedback-${useCaseId}`);
                if (feedbackDiv) {
                    feedbackDiv.style.display = 'none';
                }

                // Display a thank you message
                const thankYouMessage = document.createElement('p');
                thankYouMessage.className = 'thank-you-message';
                thankYouMessage.textContent = 'Thank you for your feedback! Your response has been recorded, and every feedback is reviewed and provided to the corresponding teams.';

                // Append the thank you message below the use case section
                const useCaseSection = document.getElementById(useCaseId);
                useCaseSection.appendChild(thankYouMessage);
            } else {
                alert('Failed to send assistance message: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error sending assistance message.');
        });

    // Clear the textarea and reset selected smiley after sending
    document.getElementById(`assistance-message-${useCaseId}`).value = '';
    delete selectedSmileys[useCaseId];
    const smileyElements = document.querySelectorAll(`#feedback-${useCaseId} .smiley`);
    smileyElements.forEach(element => {
        element.classList.remove('selected');
    });
}

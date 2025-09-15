document.addEventListener('DOMContentLoaded', () => {
    const imageUpload = document.getElementById('image-upload');
    const uploadButton = document.getElementById('upload-button');
    const convertButton = document.getElementById('convert-button');
    const chatContainer = document.getElementById('chat-container');
    const loader = document.getElementById('loader');
    const fileNameDisplay = document.getElementById('file-name-display');
    
    let uploadedFile = null;

    uploadButton.addEventListener('click', () => imageUpload.click());

    imageUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            uploadedFile = file;
            fileNameDisplay.textContent = file.name;
            fileNameDisplay.classList.remove('text-gray-500', 'dark:text-gray-400');
            fileNameDisplay.classList.add('text-gray-800', 'dark:text-gray-200', 'font-medium');
            convertButton.disabled = false;
        }
    });

    convertButton.addEventListener('click', () => {
        if (!uploadedFile) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            // Add user's uploaded image to chat
            const userMessageHtml = `
                <div class="flex justify-end">
                    <div class="chat-bubble-user bg-blue-500 text-white p-2 rounded-lg rounded-br-none">
                        <p class="text-sm font-medium mb-2">You uploaded:</p>
                        <img src="${e.target.result}" alt="Uploaded Prescription" class="rounded-md max-w-xs h-auto"/>
                    </div>
                </div>
            `;
            chatContainer.innerHTML += userMessageHtml;
            chatContainer.scrollTop = chatContainer.scrollHeight;
            
            // Call API
            const base64Data = e.target.result.split(',')[1];
            callGeminiAPI(base64Data, uploadedFile.type);
        };
        reader.readAsDataURL(uploadedFile);
        setLoading(true);
    });
    
    const callGeminiAPI = async (base64Data, mimeType) => {
        const apiKey = GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        const systemPrompt = `You are a helpful medical prescription assistant. Your task is to analyze an image of a handwritten medical prescription. 
        
        Follow these steps precisely:
        1.  Identify all the medication names mentioned in the image.
        2.  For each identified medication, create a section with the medication's name as a heading (e.g., "### Lisinopril").
        3.  In each medication's section, provide the following information in a bulleted list:
            * **Purpose:** A brief, one-sentence explanation of what the medication is commonly used for (e.g., "Used to treat high blood pressure.").
            * **Common Side Effects:** List 2-3 of the most common side effects.
            * **More Info:** Provide a search link to Drugs.com for that specific medication using this exact format: [Learn more on Drugs.com](https://www.drugs.com/search.php?searchterm=MEDICATION_NAME). Replace MEDICATION_NAME with the drug's name.
        4.  Conclude your entire response with a clear, bolded disclaimer: "**Disclaimer: This is not medical advice. Always consult a professional.**"
        
        Format the entire response in Markdown.`;

        const payload = {
            contents: [{
                parts: [
                    { text: systemPrompt },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data
                        }
                    }
                ]
            }],
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorBody}`);
            }

            const result = await response.json();
            const candidate = result.candidates?.[0];

            if (candidate && candidate.content?.parts?.[0]?.text) {
                const rawText = candidate.content.parts[0].text;
                const formattedHtml = markdownToHtml(rawText);
                addAiMessage(formattedHtml);
            } else {
                throw new Error('No valid response from API.');
            }
        } catch (error) {
            console.error('API Error:', error);
            addAiMessage('<p class="text-red-400">Sorry, I encountered an error while analyzing the prescription. Please check the console for details or try again.</p>');
        } finally {
            setLoading(false);
            resetInput();
        }
    };

    function markdownToHtml(md) {
        // ### Headings
        md = md.replace(/### (.*?)\n/g, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
        // **Bold**
        md = md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // * bullet points
        md = md.replace(/^\* (.*?)$/gm, '<li class="ml-4 list-disc">$1</li>');
        // [text](url)
        md = md.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-300 hover:underline">$1</a>');
        // Newlines
        md = md.replace(/\n/g, '<br>');
        return md;
    }

    function addAiMessage(htmlContent) {
         const aiMessageHtml = `
            <div class="flex justify-start">
                <div class="chat-bubble-ai bg-gray-700 text-white p-4 rounded-lg rounded-bl-none">
                   ${htmlContent}
                </div>
            </div>
        `;
        chatContainer.innerHTML += aiMessageHtml;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    function setLoading(isLoading) {
        if (isLoading) {
            loader.classList.remove('hidden');
            uploadButton.disabled = true;
            convertButton.disabled = true;
        } else {
            loader.classList.add('hidden');
            uploadButton.disabled = false;
            // Convert button remains disabled until a new file is selected
        }
    }
    
    function resetInput() {
        uploadedFile = null;
        imageUpload.value = ''; // Reset file input
        fileNameDisplay.textContent = 'No file selected...';
        fileNameDisplay.classList.add('text-gray-500', 'dark:text-gray-400');
        fileNameDisplay.classList.remove('text-gray-800', 'dark:text-gray-200', 'font-medium');
        convertButton.disabled = true;
    }
});


class AIPribadi {
    constructor() {
        // DOM Elements
        this.chatMessages = document.getElementById('chatMessages');
        this.userInput = document.getElementById('userInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.menuToggle = document.getElementById('menuToggle');
        this.sidebar = document.getElementById('sidebar');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.historyList = document.getElementById('historyList');
        this.apiStatus = document.getElementById('apiStatus');
        this.modelBadge = document.getElementById('modelBadge');

        // Modal Elements
        this.settingsModal = document.getElementById('settingsModal');
        this.modalClose = document.getElementById('modalClose');
        this.modalCancel = document.getElementById('modalCancel');
        this.modalSave = document.getElementById('modalSave');
        this.apiKeyInput = document.getElementById('apiKeyInput');
        this.customPromptInput = document.getElementById('customPromptInput');
        this.modelSelect = document.getElementById('modelSelect');
        this.temperatureInput = document.getElementById('temperatureInput');
        this.temperatureValue = document.getElementById('temperatureValue');
        this.toggleVisibility = document.getElementById('toggleVisibility');

        // State
        this.apiKey = localStorage.getItem('ai-api_key') || '';
        this.customPrompt = localStorage.getItem('ai_custom_prompt') || 'Kamu adalah asisten AI yang ramah, profesional, dan membantu. Berikan jawaban yang jelas dan informatif.';
        this.model = localStorage.getItem('ai_model') || 'gemini-1.5-flash';
        this.temperature = parseFloat(localStorage.getItem('ai_temperature')) || 0.7;
        this.messages = [];
        this.isProcessing = false;
        this.currentChatId = Date.now().toString();
        this.chatHistory = JSON.parse(localStorage.getItem('chat_history')) || {};

        this.init();
    }

    init() {
        this.loadSettings();
        this.loadChatHistory();
        this.bindEvents();
        this.updateAPIStatus();
        this.updateModelBadge();
        this.adjustTextareaHeight();
    }

    bindEvents() {
        // Send message
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.userInput.addEventListener('input', () => this.adjustTextareaHeight());

        // New chat
        this.newChatBtn.addEventListener('click', () => this.newChat());

        // Settings
        this.settingsBtn.addEventListener('click', () => this.openSettings());
        this.modalClose.addEventListener('click', () => this.closeSettings());
        this.modalCancel.addEventListener('click', () => this.closeSettings());
        this.modalSave.addEventListener('click', () => this.saveSettings());

        // Toggle visibility
        this.toggleVisibility.addEventListener('click', () => {
            const input = this.apiKeyInput;
            if (input.type === 'password') {
                input.type = 'text';
                this.toggleVisibility.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                input.type = 'password';
                this.toggleVisibility.innerHTML = '<i class="fas fa-eye"></i>';
            }
        });

        // Temperature slider
        this.temperatureInput.addEventListener('input', () => {
            this.temperatureValue.textContent = this.temperatureInput.value;
        });

        // Menu toggle
        this.menuToggle.addEventListener('click', () => {
            this.sidebar.classList.toggle('open');
        });

        // Close sidebar on outside click (mobile)
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                if (!this.sidebar.contains(e.target) && e.target !== this.menuToggle) {
                    this.sidebar.classList.remove('open');
                }
            }
        });

        // Close modal on overlay click
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.closeSettings();
            }
        });
    }

    async sendMessage() {
        const text = this.userInput.value.trim();
        if (!text || this.isProcessing) return;

        // Check API Key
        if (!this.apiKey) {
            this.showToast('Silakan masukkan API Key di pengaturan terlebih dahulu', 'warning');
            this.openSettings();
            return;
        }

        // Add user message
        this.addMessage('user', text);
        this.userInput.value = '';
        this.adjustTextareaHeight();

        // Show typing indicator
        this.showTyping(true);

        // Disable send button
        this.isProcessing = true;
        this.sendBtn.disabled = true;

        try {
            const response = await this.callGeminiAPI(text);
            this.addMessage('bot', response);
            this.saveChatToHistory(text, response);
        } catch (error) {
            console.error('Error:', error);
            this.addMessage('bot', `❌ Maaf, terjadi kesalahan: ${error.message}`);
        } finally {
            this.showTyping(false);
            this.isProcessing = false;
            this.sendBtn.disabled = false;
            this.userInput.focus();
        }
    }

    async callGeminiAPI(userMessage) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

        // Build messages
        const contents = [
            {
                role: 'user',
                parts: [{ text: userMessage }]
            }
        ];

        // Add previous messages for context (last 10)
        const historyMessages = this.messages.slice(-10);
        for (const msg of historyMessages) {
            if (msg.role === 'user' || msg.role === 'bot') {
                contents.unshift({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                });
            }
        }

        const requestBody = {
            contents: contents,
            generationConfig: {
                temperature: this.temperature,
                maxOutputTokens: 2048,
                topK: 40,
                topP: 0.95,
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        };

        // Add system instruction if custom prompt exists
        if (this.customPrompt) {
            requestBody.system_instruction = {
                parts: [{ text: this.customPrompt }]
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMsg = errorData.error?.message || 'API request failed';
            throw new Error(errorMsg);
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Maaf, saya tidak bisa memberikan jawaban.';

        return this.formatResponse(responseText);
    }

    addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = content;

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(contentDiv);

        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

        // Store in memory
        this.messages.push({ role, content });
    }

    formatResponse(text) {
        // Convert markdown-like syntax
        let formatted = text
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Code blocks
            .replace(/```([\s\S]*?)```/g, (match, code) => {
                return `<pre><code>${code.trim()}</code></pre>`;
            })
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Lists
            .replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>')
            // Numbered lists
            .replace(/^\s*\d+\.\s+(.*)$/gm, '<li>$1</li>')
            // Line breaks
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        // Wrap list items
        formatted = formatted.replace(/(<li>.*?<\/li>)/gs, (match) => {
            return `<ul>${match}</ul>`;
        });

        // Remove duplicate ul tags
        formatted = formatted.replace(/<\/ul><ul>/g, '');

        // Wrap in paragraphs
        if (!formatted.startsWith('<')) {
            formatted = `<p>${formatted}</p>`;
        }

        return formatted;
    }

    showTyping(show) {
        this.typingIndicator.classList.toggle('active', show);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    adjustTextareaHeight() {
        this.userInput.style.height = 'auto';
        this.userInput.style.height = Math.min(this.userInput.scrollHeight, 120) + 'px';
    }

    newChat() {
        if (this.messages.length > 0 && !confirm('Buat chat baru? Chat saat ini akan tersimpan.')) {
            return;
        }
        
        // Save current chat
        this.saveChatToHistory();

        // Clear messages
        this.chatMessages.innerHTML = `
            <div class="message bot-message welcome-message">
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    <p>Halo! Saya adalah AI Pribadi Anda. 👋</p>
                    <p>Saya siap membantu Anda dengan berbagai pertanyaan. Silakan tanyakan apa saja!</p>
                    <p class="hint-text">💡 Tips: Anda bisa mengatur prompt custom di pengaturan.</p>
                </div>
            </div>
        `;
        this.messages = [];
        this.currentChatId = Date.now().toString();
        this.userInput.focus();
        this.renderHistory();
    }

    saveChatToHistory(userMessage, botResponse) {
        if (!userMessage && !botResponse) return;

        // Get existing chat or create new
        let chat = this.chatHistory[this.currentChatId];
        if (!chat) {
            chat = {
                id: this.currentChatId,
                title: userMessage ? userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '') : 'Chat Baru',
                messages: [],
                timestamp: Date.now()
            };
        }

        if (userMessage) {
            chat.messages.push({ role: 'user', content: userMessage });
        }
        if (botResponse) {
            chat.messages.push({ role: 'bot', content: botResponse });
        }

        // Update title if first message
        if (chat.messages.length === 2 && userMessage) {
            chat.title = userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '');
        }

        this.chatHistory[this.currentChatId] = chat;
        localStorage.setItem('chat_history', JSON.stringify(this.chatHistory));
        this.renderHistory();
    }

    loadChatHistory() {
        this.chatHistory = JSON.parse(localStorage.getItem('chat_history')) || {};
        this.renderHistory();

        // Load last chat if exists
        const chatIds = Object.keys(this.chatHistory);
        if (chatIds.length > 0) {
            const lastChat = this.chatHistory[chatIds[chatIds.length - 1]];
            this.loadChat(lastChat.id);
        }
    }

    loadChat(chatId) {
        const chat = this.chatHistory[chatId];
        if (!chat) return;

        this.currentChatId = chatId;
        this.messages = [];

        // Clear messages
        this.chatMessages.innerHTML = '';

        // Load messages
        for (const msg of chat.messages) {
            const content = msg.role === 'bot' ? this.formatResponse(msg.content) : msg.content;
            this.addMessage(msg.role, content);
        }

        // If no messages, show welcome
        if (chat.messages.length === 0) {
            this.chatMessages.innerHTML = `
                <div class="message bot-message welcome-message">
                    <div class="message-avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="message-content">
                        <p>Halo! Saya adalah AI Pribadi Anda. 👋</p>
                        <p>Saya siap membantu Anda dengan berbagai pertanyaan. Silakan tanyakan apa saja!</p>
                    </div>
                </div>
            `;
        }

        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        this.renderHistory();
    }

    deleteChat(chatId, event) {
        event.stopPropagation();
        if (confirm('Hapus chat ini?')) {
            delete this.chatHistory[chatId];
            localStorage.setItem('chat_history', JSON.stringify(this.chatHistory));
            this.renderHistory();

            // If current chat deleted, load another or new
            if (this.currentChatId === chatId) {
                const chatIds = Object.keys(this.chatHistory);
                if (chatIds.length > 0) {
                    this.loadChat(chatIds[chatIds.length - 1]);
                } else {
                    this.newChat();
                }
            }
        }
    }

    renderHistory() {
        const chatIds = Object.keys(this.chatHistory).sort((a, b) => {
            return this.chatHistory[b].timestamp - this.chatHistory[a].timestamp;
        });

        if (chatIds.length === 0) {
            this.historyList.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px 0;">
                    <i class="fas fa-comment" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
                    Belum ada chat
                </div>
            `;
            return;
        }

        this.historyList.innerHTML = chatIds.map(id => {
            const chat = this.chatHistory[id];
            const isActive = id === this.currentChatId;
            return `
                <div class="history-item ${isActive ? 'active' : ''}" 
                     style="${isActive ? 'background: var(--bg-input);' : ''}"
                     data-chat-id="${id}">
                    <i class="fas fa-comment history-icon"></i>
                    <span class="history-text">${chat.title || 'Chat Baru'}</span>
                    <button class="history-delete" data-chat-id="${id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }).join('');

        // Add event listeners
        this.historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = item.dataset.chatId;
                this.loadChat(chatId);
                this.sidebar.classList.remove('open');
            });

            const deleteBtn = item.querySelector('.history-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    const chatId = deleteBtn.dataset.chatId;
                    this.deleteChat(chatId, e);
                });
            }
        });
    }

    openSettings() {
        this.apiKeyInput.value = this.apiKey;
        this.customPromptInput.value = this.customPrompt;
        this.modelSelect.value = this.model;
        this.temperatureInput.value = this.temperature;
        this.temperatureValue.textContent = this.temperature;
        this.settingsModal.classList.add('active');
    }

    closeSettings() {
        this.settingsModal.classList.remove('active');
    }

    saveSettings() {
        const apiKey = this.apiKeyInput.value.trim();
        const customPrompt = this.customPromptInput.value.trim();
        const model = this.modelSelect.value;
        const temperature = parseFloat(this.temperatureInput.value);

        if (apiKey) {
            this.apiKey = apiKey;
            localStorage.setItem('ai_api_key', apiKey);
        }

        this.customPrompt = customPrompt || 'Kamu adalah asisten AI yang ramah, profesional, dan membantu. Berikan jawaban yang jelas dan informatif.';
        localStorage.setItem('ai_custom_prompt', this.customPrompt);

        this.model = model;
        localStorage.setItem('ai_model', model);

        this.temperature = temperature;
        localStorage.setItem('ai_temperature', temperature.toString());

        this.updateAPIStatus();
        this.updateModelBadge();
        this.closeSettings();
        this.showToast('Pengaturan berhasil disimpan!', 'success');
    }

    loadSettings() {
        this.apiKey = localStorage.getItem('ai_api_key') || '';
        this.customPrompt = localStorage.getItem('ai_custom_prompt') || 'Kamu adalah asisten AI yang ramah, profesional, dan membantu. Berikan jawaban yang jelas dan informatif.';
        this.model = localStorage.getItem('ai_model') || 'gemini-1.5-flash';
        this.temperature = parseFloat(localStorage.getItem('ai_temperature')) || 0.7;
    }

    updateAPIStatus() {
        const status = this.apiStatus;
        if (this.apiKey) {
            status.className = 'api-status connected';
            status.innerHTML = '<i class="fas fa-circle"></i> API: Terhubung';
        } else {
            status.className = 'api-status disconnected';
            status.innerHTML = '<i class="fas fa-circle"></i> API: Belum Terhubung';
        }
    }

    updateModelBadge() {
        const modelNames = {
            'gemini-1.5-flash': 'Gemini 1.5 Flash',
            'gemini-1.5-pro': 'Gemini 1.5 Pro',
            'gemini-1.0-pro': 'Gemini 1.0 Pro'
        };
        this.modelBadge.textContent = modelNames[this.model] || this.model;
    }

    showToast(message, type = 'info') {
        // Remove existing toast
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = message;
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            borderRadius: '12px',
            backgroundColor: type === 'success' ? '#10a37f' : '#f59e0b',
            color: 'white',
            zIndex: '9999',
            fontSize: '14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            animation: 'fadeIn 0.3s ease',
            maxWidth: '90%',
            textAlign: 'center'
        });

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    new AIPribadi();
});
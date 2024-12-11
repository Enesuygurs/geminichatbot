const socket = io();
let autoScrollEnabled = true;
let soundEnabled = true;
let notificationsEnabled = false;
let currentLanguage = localStorage.getItem('language') || 'tr';

new EmojiMart.Picker({
    onEmojiSelect: (emoji) => {
        const messageInput = document.getElementById('message-input');
        const cursorPos = messageInput.selectionStart;
        const text = messageInput.value;
        messageInput.value = text.slice(0, cursorPos) + emoji.native + text.slice(cursorPos);
        messageInput.focus();
    },
    parent: document.getElementById('emoji-picker')
});

function toggleEmojiPicker() {
    const picker = document.getElementById('emoji-picker');
    picker.classList.toggle('active');
}

let isRecording = false;
const voiceButton = document.getElementById('voice-input');

if ('webkitSpeechRecognition' in window) {
    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'tr-TR';

    recognition.onresult = (event) => {
        const result = event.results[0][0].transcript;
        document.getElementById('message-input').value = result;
        voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
        isRecording = false;
    };

    recognition.onerror = () => {
        voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
        isRecording = false;
    };

    voiceButton.onclick = () => {
        if (!isRecording) {
            recognition.start();
            voiceButton.innerHTML = '<i class="fas fa-stop"></i>';
            isRecording = true;
        } else {
            recognition.stop();
            voiceButton.innerHTML = '<i class="fas fa-microphone"></i>';
            isRecording = false;
        }
    };
} else {
    voiceButton.style.display = 'none';
}

socket.on('userTyping', () => {
    document.querySelector('.typing-indicator').style.display = 'block';
});

socket.on('userStoppedTyping', () => {
    document.querySelector('.typing-indicator').style.display = 'none';
});

let typingTimer;
const messageInput = document.getElementById('message-input');

messageInput.addEventListener('keydown', () => {
    socket.emit('typing');
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => socket.emit('stopTyping'), 1000);
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function formatTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMessage(message, isUser = false, isWelcome = false) {
    const chatContainer = document.getElementById('chat-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    messageDiv.dataset.original = message;

    const avatar = document.createElement('img');
    avatar.className = 'message-avatar';
    avatar.src = isUser ? 'https://ui-avatars.com/api/?name=User&background=ec6fbb' : 'https://ui-avatars.com/api/?name=Gemini&background=7C3AED';
    avatar.alt = isUser ? 'User Avatar' : 'Gemini Avatar';
    messageDiv.appendChild(avatar);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (isUser) {
        contentDiv.textContent = message;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions left';

        const editBtn = document.createElement('button');
        editBtn.className = 'message-action-btn edit-button';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.onclick = () => editMessage(messageDiv);
        actionsDiv.appendChild(editBtn);

        messageDiv.appendChild(actionsDiv);
    } else if (!isWelcome) {
        contentDiv.innerHTML = message;

        const botMessages = chatContainer.querySelectorAll('.bot-message:not(.welcome-message)');
        const isFirstBotMessage = botMessages.length === 0;

        if (!isFirstBotMessage) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions right';

            const regenerateBtn = document.createElement('button');
            regenerateBtn.className = 'message-action-btn';
            regenerateBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            regenerateBtn.onclick = () => regenerateMessage(messageDiv);
            actionsDiv.appendChild(regenerateBtn);

            messageDiv.appendChild(actionsDiv);
        }
    } else {
        contentDiv.innerHTML = message;
        messageDiv.classList.add('welcome-message');
    }

    messageDiv.appendChild(contentDiv);

    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = formatTime();
    messageDiv.appendChild(timeDiv);

    chatContainer.appendChild(messageDiv);

    if (autoScrollEnabled) {
        messageDiv.scrollIntoView({ behavior: 'smooth' });
    }

    return messageDiv;
}

function editMessage(messageDiv) {
    if (messageDiv.classList.contains('editing')) return;

    messageDiv.classList.add('editing');
    const contentDiv = messageDiv.querySelector('.message-content');
    const originalText = contentDiv.textContent;

    const input = document.createElement('textarea');
    input.className = 'edit-input';
    input.value = originalText;
    input.rows = 1;

    const editActions = document.createElement('div');
    editActions.className = 'edit-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-edit';
    saveBtn.innerHTML = '<i class="fas fa-check"></i> Save';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-edit';
    cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';

    editActions.appendChild(saveBtn);
    editActions.appendChild(cancelBtn);

    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';
    });

    async function saveEdit() {
        const newText = input.value.trim();
        if (newText && newText !== originalText) {
            contentDiv.textContent = newText;
            messageDiv.dataset.original = newText;

            const botMessage = messageDiv.nextElementSibling;
            if (botMessage && botMessage.classList.contains('bot-message')) {
                await regenerateMessage(botMessage, newText);
            }
        } else {
            contentDiv.textContent = originalText;
        }
        messageDiv.classList.remove('editing');
        editActions.remove();
    }

    function cancelEdit() {
        contentDiv.textContent = originalText;
        messageDiv.classList.remove('editing');
        editActions.remove();
    }

    saveBtn.onclick = saveEdit;
    cancelBtn.onclick = cancelEdit;

    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            await saveEdit();
        } else if (e.key === 'Escape') {
            cancelEdit();
        }
    });

    contentDiv.textContent = '';
    contentDiv.appendChild(input);
    contentDiv.appendChild(editActions);
    input.focus();
    input.style.height = input.scrollHeight + 'px';
}

async function regenerateMessage(messageDiv, userMessage = null) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'typing-indicator';
    messageDiv.appendChild(loadingDiv);

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: userMessage || messageDiv.previousElementSibling.dataset.original
            })
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        const contentDiv = messageDiv.querySelector('.message-content');
        contentDiv.innerHTML = data.reply;

        playNotificationSound();
        showNotification(data.reply);
    } catch (error) {
        console.error('Error:', error);
        messageDiv.querySelector('.message-content').textContent = 'Sorry, something went wrong. Please try again.';
    } finally {
        loadingDiv.remove();
    }
}

function clearChatContainer() {
    const chatContainer = document.getElementById('chat-container');
    chatContainer.innerHTML = '';
}

function exportChatHistory() {
    if (!currentConversationId) {
        showToast('No active chat to export');
        return;
    }

    showToast('Exporting Chat History...');
    
    const currentChat = conversations.find(conv => conv.id === currentConversationId);
    let exportText = '';
    
    currentChat.messages.forEach(msg => {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        exportText += `[${time}] ${msg.role === 'user' ? 'You' : 'Gemini'}: ${msg.content}\n`;
    });

    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-history-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setTimeout(() => {
        showToast('Chat History Exported');
    }, 1000);
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const themeIcon = document.querySelector('[title="Toggle Theme"] i');
    themeIcon.classList.toggle('fa-sun');
    themeIcon.classList.toggle('fa-moon');
}

function toggleSettings() {
    const menu = document.getElementById('settingsMenu');
    menu.classList.toggle('active');
}

function toggleAutoScroll() {
    autoScrollEnabled = !autoScrollEnabled;
    const btn = document.getElementById('autoScrollBtn');
    btn.style.opacity = autoScrollEnabled ? '1' : '0.7';
    showToast(autoScrollEnabled ? 'Auto Scroll On' : 'Auto Scroll Off');
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    showToast(soundEnabled ? 'Sound Effects On' : 'Sound Effects Off');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.querySelector('.toast-container').appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }, 100);
}

function showNotification(message) {
    if (!notificationsEnabled) return;
    
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            new Notification(currentLanguage === 'tr' ? 'Yeni Mesaj' : 'New Message', {
                body: message,
                icon: '/favicon.ico'
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    showToast(currentLanguage === 'tr' ? 'Bildirimler açıldı!' : 'Notifications enabled!');
                }
            });
        }
    }
}

function toggleNotifications() {
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            notificationsEnabled = !notificationsEnabled;
            showToast(
                notificationsEnabled 
                    ? (currentLanguage === 'tr' ? 'Bildirimler açıldı' : 'Notifications enabled')
                    : (currentLanguage === 'tr' ? 'Bildirimler kapatıldı' : 'Notifications disabled')
            );
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    notificationsEnabled = true;
                    showToast(currentLanguage === 'tr' ? 'Bildirimler açıldı' : 'Notifications enabled');
                } else {
                    showToast(currentLanguage === 'tr' ? 'Bildirim izni reddedildi' : 'Notification permission denied');
                }
            });
        } else {
            showToast(currentLanguage === 'tr' ? 'Bildirimler tarayıcı tarafından engellendi' : 'Notifications are blocked by browser');
        }
    } else {
        showToast(currentLanguage === 'tr' ? 'Tarayıcınız bildirimleri desteklemiyor' : 'Your browser does not support notifications');
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    showToast(
        soundEnabled 
            ? (currentLanguage === 'tr' ? 'Ses efektleri açıldı' : 'Sound effects enabled')
            : (currentLanguage === 'tr' ? 'Ses efektleri kapatıldı' : 'Sound effects disabled')
    );
}

function clearChat() {
    if (!currentConversationId) {
        showToast(currentLanguage === 'tr' ? 'Temizlenecek aktif sohbet yok' : 'No active chat to clear');
        return;
    }

    clearChatContainer();

    const currentChat = conversations.find(conv => conv.id === currentConversationId);
    if (currentChat) {
        currentChat.messages = [];
        saveConversations();
    }

    const welcomeMessage = currentLanguage === 'tr' 
        ? 'Merhaba! 👋 Ben Gemini, size nasıl yardımcı olabilirim?'
        : 'Hello! 👋 I\'m Gemini, your AI assistant. How can I help you?';
    
    addMessage(welcomeMessage, false, true);
    
    if (currentChat) {
        currentChat.messages.push({
            role: 'welcome',
            content: welcomeMessage,
            timestamp: Date.now()
        });
        saveConversations();
    }

    showToast(currentLanguage === 'tr' ? 'Sohbet temizlendi' : 'Chat cleared');
}

function deleteConversation(id) {
    if (confirm(currentLanguage === 'tr' ? 'Bu sohbeti silmek istediğinizden emin misiniz?' : 'Are you sure you want to delete this conversation?')) {
        conversations = conversations.filter(conv => conv.id !== id);
        saveConversations();
        
        if (id === currentConversationId) {
            currentConversationId = null;
            clearChatContainer();
            startNewChat();
        }
        
        renderConversations();
        showToast(currentLanguage === 'tr' ? 'Sohbet silindi' : 'Conversation deleted');
    }
}

function exportChatHistory() {
    if (conversations.length === 0) {
        showToast(currentLanguage === 'tr' ? 'Dışa aktarılacak sohbet bulunamadı' : 'No conversations to export');
        return;
    }

    const exportData = {
        conversations: conversations,
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gemini-chat-history.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(currentLanguage === 'tr' ? 'Sohbet geçmişi dışa aktarıldı' : 'Chat history exported');
}

let conversations = [];
let currentConversationId = null;

async function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (message.length === 0) return;
    
    if (!currentConversationId) {
        startNewChat();
    }
    
    const currentChat = conversations.find(c => c.id === currentConversationId);
    if (!currentChat) return;
    
    const userMessage = {
        role: 'user',
        content: message,
        timestamp: Date.now()
    };
    currentChat.messages.push(userMessage);
    
    if (currentChat.messages.filter(m => m.role === 'user').length === 1) {
        renderConversations(); 
    }
    
    addMessage(message, true);
    input.value = '';
    input.style.height = 'auto';
    
    try {
        document.querySelector('.typing-indicator').style.display = 'block';
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        
        const botMessage = {
            role: 'assistant',
            content: data.reply,
            timestamp: Date.now()
        };
        currentChat.messages.push(botMessage);
        
        addMessage(data.reply, false);
        playNotificationSound();
        showNotification(data.reply);
        
        saveConversations();
        
        return { 
            response: data.reply 
        };
        
    } catch (error) {
        console.error('Error:', error);
        addMessage('Sorry, something went wrong. Please try again.', false);
        return null;
    } finally {
        document.querySelector('.typing-indicator').style.display = 'none';
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarClose = document.querySelector('.sidebar-close');
    const sidebarOpen = document.querySelector('.sidebar-open');
    
    sidebar.classList.toggle('hidden');
    
    if (!sidebar.classList.contains('hidden')) {
        if (sidebarOpen) {
            sidebarOpen.style.opacity = '0';
        }
        if (sidebarClose) {
            sidebarClose.style.opacity = '1';
        }
    }
    
    if (window.innerWidth <= 768) {
        setTimeout(() => {
            window.scrollTo(0, 0);
        }, 100);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    applyLanguageSettings();
    const sidebarClose = document.querySelector('.sidebar-close');
    const sidebarOpen = document.querySelector('.sidebar-open');
    const chatTitle = document.querySelector('.chat-header h1');
    const sidebar = document.getElementById('sidebar');

    sidebar.classList.add('hidden');
    if (sidebarOpen) {
        sidebarOpen.style.display = 'block';
        sidebarOpen.style.visibility = 'visible';
        sidebarOpen.style.opacity = '1';
    }

    chatTitle.style.cursor = 'pointer';
    chatTitle.addEventListener('click', () => {
        if (sidebar.classList.contains('hidden')) {
            toggleSidebar();
        }
    });

    if (sidebarClose) {
        sidebarClose.style.opacity = '1';
    }
    if (sidebarOpen) {
        sidebarOpen.style.opacity = '0';
    }

    document.addEventListener('click', (event) => {
        if (!sidebar.classList.contains('hidden') && 
            !sidebar.contains(event.target) && 
            !event.target.closest('.sidebar-open') && 
            !event.target.closest('.sidebar-close')) {
            toggleSidebar();
        }
    });
    
    loadConversations();
    if (conversations.length === 0) {
        startNewChat();
    }
    
    // Add welcome message if this is a new chat
    if (!currentConversationId || !conversations.find(c => c.id === currentConversationId)?.messages?.length) {
        const welcomeMessage = currentLanguage === 'tr' 
            ? 'Merhaba! 👋 Ben Gemini, size nasıl yardımcı olabilirim?'
            : 'Hello! 👋 I\'m Gemini, your AI assistant. How can I help you?';
    addMessage(welcomeMessage, false, true);
    
    if (currentConversationId) {
        const currentChat = conversations.find(c => c.id === currentConversationId);
        if (currentChat) {
            currentChat.messages.push({
                role: 'welcome',
                content: welcomeMessage,
                timestamp: Date.now()
            });
            saveConversations();
            }
        }
    }

    const sidebarToggle = document.querySelector('.sidebar-toggle');
    
    if (sidebarToggle) {
        sidebarToggle.style.display = 'block';
    }
});

function renderConversations() {
    const list = document.getElementById('conversationsList');
    list.innerHTML = '';
    
    conversations.forEach(conv => {
        const firstUserMessage = conv.messages.find(msg => msg.role === 'user');
        let title = firstUserMessage ? firstUserMessage.content : 'New Chat';
        
        title = title.substring(0, 30) + (title.length > 30 ? '...' : '');
        
        const item = document.createElement('div');
        item.className = 'conversation-item' + (conv.id == currentConversationId ? ' active' : '');
        
        const titleSpan = document.createElement('span');
        titleSpan.textContent = title;
        titleSpan.className = 'conversation-title';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-conversation';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.onclick = (e) => {
            e.stopPropagation(); 
            deleteConversation(conv.id);
        };
        
        item.appendChild(titleSpan);
        item.appendChild(deleteBtn);
        
        item.onclick = () => loadConversation(conv.id);
        
        list.appendChild(item);
    });
}

function loadConversation(id) {
    const conversation = conversations.find(conv => conv.id == id);
    if (!conversation) return;
    
    clearChatContainer();
    
    currentConversationId = id;
    
    conversation.messages.forEach(msg => {
        addMessage(msg.content, msg.role === 'user');
    });
    
    renderConversations();
}

function deleteConversation(id) {
    conversations = conversations.filter(conv => conv.id != id);
    
    if (currentConversationId == id) {
        clearChatContainer();
        currentConversationId = null;
    }
    
    saveConversations();
    
    renderConversations();
}

function startNewChat() {
    clearChatContainer();
    
    const newChatId = Date.now().toString();
    
    currentConversationId = newChatId;
    
    renderConversations();
    const welcomeMessage = currentLanguage === 'tr' 
        ? 'Merhaba! 👋 Ben Gemini, size nasıl yardımcı olabilirim?'
        : 'Hello! 👋 I\'m Gemini, your AI assistant. How can I help you?';
    
    const botInitialMessage = {
        role: 'assistant',
        content: welcomeMessage,
        timestamp: Date.now()
    };
    
    addMessage(botInitialMessage.content, false);
    
    conversations.push({
        id: newChatId,
        messages: [botInitialMessage]
    });
    saveConversations();
}

function saveConversations() {
    localStorage.setItem('conversations', JSON.stringify(conversations));
}

function loadConversations() {
    const saved = localStorage.getItem('conversations');
    if (saved) {
        conversations = JSON.parse(saved);
        renderConversations();
        
        if (currentConversationId) {
            const currentChat = conversations.find(c => c.id === currentConversationId);
            if (currentChat) {
                loadChatMessages(currentChat);
            }
        }
    }
}

function loadChatMessages(conversation) {
    if (conversation && conversation.messages) {
        conversation.messages.forEach(msg => {
            addMessage(msg.content, msg.role === 'user');
        });
    }
}

function switchConversation(id) {
    currentConversationId = id;
    const conversation = conversations.find(c => c.id === id);
    if (conversation) {
        clearChatContainer();
        loadChatMessages(conversation);
        renderConversations();
        saveConversations();
    }
}

function playNotificationSound() {
    if (soundEnabled) {
        const audio = new Audio('sounds/notification.wav');
        audio.play().catch(error => {
            console.error('Error playing sound:', error);
        });
    }
}

function showNotification(message) {
    if (notificationsEnabled && document.hidden) {
        try {
            const notification = new Notification('New Message from Gemini', {
                body: message.length > 100 ? message.substring(0, 100) + '...' : message,
                icon: '/favicon.ico'
            });

            notification.onclick = function () {
                window.focus();
                this.close();
            };

            setTimeout(() => notification.close(), 5000);
        } catch (error) {
            console.error('Error showing notification:', error);
        }
    }
}

async function translateLastMessage() {
    const lastBotMessage = Array.from(document.querySelectorAll('.bot-message'))
        .reverse()
        .find(msg => !msg.classList.contains('welcome-message'));

    if (!lastBotMessage) {
        showToast('Çevrilecek mesaj bulunamadı');
        return;
    }

    showToast('Mesaj Çevriliyor...');
    const text = lastBotMessage.querySelector('.message-content').textContent;

    try {
        document.querySelector('.typing-indicator').style.display = 'block';
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Translate the following text to Turkish: "${text}"`
            })
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();
        addMessage(data.reply, false);
        playNotificationSound();
    } catch (error) {
        console.error('Error:', error);
        showToast('Çeviri başarısız oldu');
    } finally {
        document.querySelector('.typing-indicator').style.display = 'none';
    }
}

function readLastMessage() {
    const lastBotMessage = Array.from(document.querySelectorAll('.bot-message'))
        .reverse()
        .find(msg => !msg.classList.contains('welcome-message'));

    if (!lastBotMessage) {
        showToast('Okunacak mesaj bulunamadı');
        return;
    }

    if ('speechSynthesis' in window) {
        showToast('Mesaj Sesli Okunuyor...');
        const text = lastBotMessage.querySelector('.message-content').textContent;

        // Cancel any ongoing speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'tr-TR';
        utterance.onend = () => {
            showToast('Okuma tamamlandı');
        };
        utterance.onerror = () => {
            showToast('Okuma başarısız oldu');
        };

        speechSynthesis.speak(utterance);
    } else {
        showToast('Tarayıcınız sesli okuma özelliğini desteklemiyor');
    }
}

function clearChat() {
    if (!currentConversationId) {
        showToast(currentLanguage === 'tr' ? 'Temizlenecek aktif sohbet yok' : 'No active chat to clear');
        return;
    }

    clearChatContainer();

    const currentChat = conversations.find(conv => conv.id === currentConversationId);
    if (currentChat) {
        currentChat.messages = [];
        saveConversations();
    }

    const welcomeMessage = currentLanguage === 'tr' 
        ? 'Merhaba! 👋 Ben Gemini, size nasıl yardımcı olabilirim?'
        : 'Hello! 👋 I\'m Gemini, your AI assistant. How can I help you?';
    
    addMessage(welcomeMessage, false, true);
    
    if (currentChat) {
        currentChat.messages.push({
            role: 'welcome',
            content: welcomeMessage,
            timestamp: Date.now()
        });
        saveConversations();
    }

    showToast(currentLanguage === 'tr' ? 'Sohbet temizlendi' : 'Chat cleared');
}

function deleteConversation(id) {
    if (confirm(currentLanguage === 'tr' ? 'Bu sohbeti silmek istediğinizden emin misiniz?' : 'Are you sure you want to delete this conversation?')) {
        conversations = conversations.filter(conv => conv.id !== id);
        saveConversations();
        
        if (id === currentConversationId) {
            currentConversationId = null;
            clearChatContainer();
            startNewChat();
        }
        
        renderConversations();
        showToast(currentLanguage === 'tr' ? 'Sohbet silindi' : 'Conversation deleted');
    }
}

function exportChatHistory() {
    if (conversations.length === 0) {
        showToast(currentLanguage === 'tr' ? 'Dışa aktarılacak sohbet bulunamadı' : 'No conversations to export');
        return;
    }

    const exportData = {
        conversations: conversations,
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gemini-chat-history.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(currentLanguage === 'tr' ? 'Sohbet geçmişi dışa aktarıldı' : 'Chat history exported');
}

function applyLanguageSettings() {
    const newChatButton = document.querySelector('.new-chat-button');
    const sidebarTitle = document.querySelector('.sidebar-header h2');
    const messageInput = document.getElementById('message-input');
    const typingIndicator = document.querySelector('.typing-animation');
    
    if (currentLanguage === 'tr') {
        newChatButton.innerHTML = '<i class="fas fa-plus"></i> Yeni Sohbet';
        sidebarTitle.childNodes[0].textContent = 'Sohbetler';
        messageInput.placeholder = 'Mesajınızı yazın...';
        typingIndicator.childNodes[0].textContent = 'Gemini yazıyor';
        
        document.querySelector('.settings-menu').innerHTML = `
            <div class="settings-item" onclick="toggleNotifications()">
                <i class="fas fa-bell"></i>
                <span>Bildirimler</span>
            </div>
            <div class="settings-item" onclick="changeLanguage()">
                <i class="fas fa-globe"></i>
                <span>Dil</span>
            </div>
            <div class="settings-item" onclick="toggleSound()">
                <i class="fas fa-volume-up"></i>
                <span>Ses Efektleri</span>
            </div>
            <div class="settings-item" onclick="exportChatHistory()">
                <i class="fas fa-file-export"></i>
                <span>Geçmişi Dışa Aktar</span>
            </div>
        `;
    } else {
        newChatButton.innerHTML = '<i class="fas fa-plus"></i> New Chat';
        sidebarTitle.childNodes[0].textContent = 'Chats';
        messageInput.placeholder = 'Type a message...';
        typingIndicator.childNodes[0].textContent = 'Gemini is typing';
        
        document.querySelector('.settings-menu').innerHTML = `
            <div class="settings-item" onclick="toggleNotifications()">
                <i class="fas fa-bell"></i>
                <span>Notifications</span>
            </div>
            <div class="settings-item" onclick="changeLanguage()">
                <i class="fas fa-globe"></i>
                <span>Language</span>
            </div>
            <div class="settings-item" onclick="toggleSound()">
                <i class="fas fa-volume-up"></i>
                <span>Sound Effects</span>
            </div>
            <div class="settings-item" onclick="exportChatHistory()">
                <i class="fas fa-file-export"></i>
                <span>Export History</span>
            </div>
        `;
    }
}

function changeLanguage() {
    currentLanguage = currentLanguage === 'en' ? 'tr' : 'en';
    localStorage.setItem('language', currentLanguage);
    
    applyLanguageSettings();
    
    showToast(currentLanguage === 'tr' ? 'Dil Türkçe olarak değiştirildi' : 'Language changed to English');
    
    document.getElementById('settingsMenu').classList.remove('active');
    
    // Refresh welcome message if it's a new chat
    if (!currentConversationId || conversations.find(c => c.id === currentConversationId)?.messages.length <= 1) {
        clearChatContainer();
        const welcomeMessage = currentLanguage === 'tr' 
            ? 'Merhaba! 👋 Ben Gemini, size nasıl yardımcı olabilirim?'
            : 'Hello! 👋 I\'m Gemini, your AI assistant. How can I help you?';
        addMessage(welcomeMessage, false, true);
    }
}
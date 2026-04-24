// =====================================================================
// Lumina AI - app.js
// Powered by Google Gemini API — Smart Model Waterfall
// =====================================================================

// =====================================================================
// CONFIG & STATE
// =====================================================================
const STORAGE_KEY = 'lumina_gemini_api_key';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

// Model waterfall: tries highest/newest first, falls back automatically.
// Preview models have separate free quotas during their preview period.
const MODEL_WATERFALL = [
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
];

const TOOLS = {
  medical: {
    label: 'Medical',
    inputPlaceholder: 'Paste your medical report, lab results, prescription, or any medical text here...',
    systemPrompt: `You are an expert medical communicator helping patients understand their health.
Your job is to translate a medical text into plain, simple language that a non-expert can understand.

Follow this structure in your response using markdown:
1. **Summary**: A 2-3 sentence plain-English summary of what this document says overall.
2. **Key Terms Explained**: For every medical term or acronym found, list it and explain it simply.
3. **What This Means For You**: Practical takeaways the patient should know.
4. **Questions to Ask Your Doctor**: Suggest 3-5 informed questions based on this text.

> ⚠️ **Disclaimer**: This is an AI-generated explanation for educational purposes only. Always consult a qualified medical professional for medical advice.`
  },
  legal: {
    label: 'Legal',
    inputPlaceholder: 'Paste your contract, terms of service, privacy policy, or any legal document here...',
    systemPrompt: `You are a legal literacy expert helping everyday people understand legal documents.
Your job is to break down complex legal text into plain, simple language anyone can grasp.

Follow this structure in your response using markdown:
1. **Plain-English Summary**: What does this document actually say in 3-5 simple sentences?
2. **Key Clauses Explained**: Identify the most important clauses and what they mean for you.
3. **Red Flags & Watch Out**: List any potentially harmful, unfair, or unusual terms found.
4. **Your Rights & Obligations**: Summarize exactly what you are agreeing to do and what you are entitled to.
5. **Key Takeaway**: One final sentence on whether this seems standard or if professional legal review is recommended.

> ⚠️ **Disclaimer**: This is an AI-generated explanation for informational purposes only and does not constitute legal advice. Consult a licensed attorney for legal counsel.`
  },
  tech: {
    label: 'Technical',
    inputPlaceholder: 'Paste code snippets, architecture docs, API documentation, error messages, or technical specs here...',
    systemPrompt: `You are a brilliant tech educator who can explain any technical concept to a complete beginner.
Your job is to demystify complex technical text, code, or documentation.

Follow this structure in your response using markdown:
1. **What Is This?**: A one-paragraph explanation of what this technology/code/spec does at a high level.
2. **Concepts Explained**: Break down each technical term, function, or component in plain language.
3. **How It Works**: A simplified step-by-step walkthrough of the logic or process described.
4. **Real-World Analogy**: Use a relatable, everyday analogy to make the concept click.
5. **Practical Implications**: What can someone build with this, or why does this matter?`
  }
};

// App state
const state = {
  currentTool: 'medical',
  isLoading: false,
  apiKey: null,
  activeModel: null,
};

// =====================================================================
// DOM REFERENCES
// =====================================================================
const configBtn = document.getElementById('configBtn');
const configBtnText = document.getElementById('configBtnText');
const apiModal = document.getElementById('apiModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const apiKeyInput = document.getElementById('apiKeyInput');
const toggleVisibleBtn = document.getElementById('toggleVisibleBtn');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const removeKeyBtn = document.getElementById('removeKeyBtn');
const toolCards = document.querySelectorAll('.tool-card');
const inputLabel = document.getElementById('inputLabel');
const sourceText = document.getElementById('sourceText');
const simplifyBtn = document.getElementById('simplifyBtn');
const loader = document.getElementById('loader');
const resultContainer = document.getElementById('resultContainer');
const resultContent = document.getElementById('resultContent');
const copyBtn = document.getElementById('copyBtn');
const statusText = document.getElementById('statusText');
const toast = document.getElementById('toast');
const dot = document.querySelector('.dot');

// =====================================================================
// INIT
// =====================================================================
const DEFAULT_API_KEY = '';

function init() {
  // Use saved key, or fall back to the built-in default key
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, DEFAULT_API_KEY);
  }
  state.apiKey = localStorage.getItem(STORAGE_KEY);
  updateNavStatus();
  setActiveTool('medical');

  configBtn.addEventListener('click', openModal);
  closeModalBtn.addEventListener('click', closeModal);
  apiModal.addEventListener('click', (e) => { if (e.target === apiModal) closeModal(); });
  saveKeyBtn.addEventListener('click', handleSaveKey);
  removeKeyBtn.addEventListener('click', handleRemoveKey);
  toggleVisibleBtn.addEventListener('click', toggleKeyVisibility);
  simplifyBtn.addEventListener('click', handleSimplify);
  copyBtn.addEventListener('click', handleCopy);

  toolCards.forEach(card => {
    card.addEventListener('click', () => setActiveTool(card.dataset.tool));
  });
}

// =====================================================================
// TOOL MANAGEMENT
// =====================================================================
function setActiveTool(toolId) {
  state.currentTool = toolId;
  const tool = TOOLS[toolId];

  toolCards.forEach(card => {
    card.classList.toggle('active', card.dataset.tool === toolId);
  });

  inputLabel.textContent = `Paste your ${tool.label} Text`;
  sourceText.placeholder = tool.inputPlaceholder;

  // Reset results on tool switch
  hideResults();
  sourceText.value = '';
}

// =====================================================================
// API KEY MANAGEMENT
// =====================================================================
function openModal() {
  apiModal.classList.remove('hidden');
  if (state.apiKey) {
    apiKeyInput.value = state.apiKey;
    removeKeyBtn.classList.remove('hidden');
  } else {
    apiKeyInput.value = '';
    removeKeyBtn.classList.add('hidden');
  }
}

function closeModal() {
  apiModal.classList.add('hidden');
}

function handleSaveKey() {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showToast('⚠️ Please enter a valid API key.', 'warn');
    return;
  }
  if (!key.startsWith('AIza')) {
    showToast('⚠️ Key should start with "AIza...". Please check your key.', 'warn');
    return;
  }
  state.apiKey = key;
  localStorage.setItem(STORAGE_KEY, key);
  updateNavStatus();
  closeModal();
  showToast('✅ API Key saved successfully!', 'success');
}

function handleRemoveKey() {
  state.apiKey = null;
  localStorage.removeItem(STORAGE_KEY);
  apiKeyInput.value = '';
  removeKeyBtn.classList.add('hidden');
  updateNavStatus();
  closeModal();
  showToast('🗑️ API Key removed.', 'info');
}

function toggleKeyVisibility() {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  const icon = toggleVisibleBtn.querySelector('i');
  icon.className = isPassword ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
}

function updateNavStatus() {
  if (state.apiKey) {
    configBtnText.textContent = 'API Connected';
    configBtn.style.borderColor = 'rgba(34, 197, 94, 0.5)';
    configBtn.style.color = '#86efac';
    dot.classList.remove('offline');
    statusText.textContent = 'Gemini Ready';
  } else {
    configBtnText.textContent = 'Setup API Key';
    configBtn.style.borderColor = '';
    configBtn.style.color = '';
    dot.classList.add('offline');
    statusText.textContent = 'No API Key';
  }
}

// =====================================================================
// GEMINI API CALL — Smart Waterfall
// =====================================================================
async function tryModel(modelId, prompt) {
  const url = `${GEMINI_BASE}${modelId}:generateContent?key=${state.apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errMsg = errorData?.error?.message || '';
    const status = response.status;
    const isQuota = status === 429 || errMsg.toLowerCase().includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
    const isNotFound = status === 404 || errMsg.includes('not found') || errMsg.includes('not supported');
    const isBadKey = status === 400 && errMsg.toLowerCase().includes('api key');
    const isForbidden = status === 403;

    if (isBadKey) throw new Error('__FATAL__🔑 Invalid API key. Get a fresh free key from: https://aistudio.google.com/app/apikey');
    if (isForbidden) throw new Error('__FATAL__🚫 API access denied. Make sure you created your key at https://aistudio.google.com/app/apikey');
    if (isQuota || isNotFound) throw new Error('__RETRY__' + errMsg); // signal caller to try next model
    throw new Error(errMsg || `API Error ${status}`);
  }

  const data = await response.json();
  const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!resultText) {
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) throw new Error(`__FATAL__Content blocked by safety filters: ${blockReason}`);
    throw new Error('__RETRY__Empty response');
  }
  return resultText;
}

async function callGemini(text) {
  const tool = TOOLS[state.currentTool];
  const fullPrompt = `${tool.systemPrompt}\n\n---\n\nHere is the text to analyze:\n\n${text}`;

  let lastError = 'All models exhausted.';
  for (const model of MODEL_WATERFALL) {
    setModelLabel(model.label);
    try {
      const result = await tryModel(model.id, fullPrompt);
      state.activeModel = model.label;
      return result;
    } catch (err) {
      if (err.message.startsWith('__FATAL__')) {
        throw new Error(err.message.replace('__FATAL__', ''));
      }
      if (err.message.startsWith('__RETRY__')) {
        lastError = err.message.replace('__RETRY__', '');
        console.warn(`Model ${model.id} failed, trying next...`, lastError);
        continue; // try next model
      }
      throw err; // unexpected error
    }
  }
  // All models failed
  throw new Error(
    `❌ All models hit their quota limit.\n\nFix: Create a FRESH free API key directly at https://aistudio.google.com/app/apikey — keys from AI Studio include a built-in free tier.`
  );
}

// =====================================================================
// SIMPLIFY ACTION
// =====================================================================
async function handleSimplify() {
  if (state.isLoading) return;

  if (!state.apiKey) {
    openModal();
    showToast('🔑 First, set up your Google Gemini API Key.', 'info');
    return;
  }

  const text = sourceText.value.trim();
  if (!text) {
    showToast('📋 Please paste some text to simplify first.', 'warn');
    sourceText.focus();
    return;
  }
  if (text.length < 20) {
    showToast('✍️ Text is too short. Please paste a complete document or paragraph.', 'warn');
    return;
  }

  setLoadingState(true);
  hideResults();

  try {
    const result = await callGemini(text);
    displayResult(result);
    showToast('✨ Simplification complete!', 'success');
  } catch (err) {
    console.error('Gemini API Error:', err);
    showToast(`❌ Error: ${err.message}`, 'error');
    setStatus('Error — please try again', true);
  } finally {
    setLoadingState(false);
  }
}

// =====================================================================
// UI HELPERS
// =====================================================================
function setModelLabel(label) {
  const p = document.querySelector('.pulsing-text');
  if (p) p.textContent = `Trying ${label}...`;
}

function setLoadingState(isLoading) {
  state.isLoading = isLoading;
  loader.classList.toggle('hidden', !isLoading);
  simplifyBtn.disabled = isLoading;
  simplifyBtn.style.opacity = isLoading ? '0.6' : '1';
  simplifyBtn.style.cursor = isLoading ? 'not-allowed' : 'pointer';

  if (isLoading) {
    const labels = ['Analyzing text...', 'Consulting Gemini...', 'Generating explanation...', 'Almost there...'];
    let i = 0;
    document.querySelector('.pulsing-text').textContent = labels[i];
    state.loaderInterval = setInterval(() => {
      i = (i + 1) % labels.length;
      const p = document.querySelector('.pulsing-text');
      if (p) p.textContent = labels[i];
    }, 1800);
    setStatus('Processing...', false);
  } else {
    clearInterval(state.loaderInterval);
    setStatus(state.apiKey ? 'Gemini Ready' : 'No API Key', false);
  }
}

function hideResults() {
  resultContainer.classList.add('hidden');
  resultContent.innerHTML = '';
  loader.classList.add('hidden');
}

function displayResult(markdownText) {
  resultContent.innerHTML = marked.parse(markdownText);
  resultContainer.classList.remove('hidden');
  resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setStatus(text, isError) {
  statusText.textContent = text;
  dot.classList.toggle('offline', isError);
}

async function handleCopy() {
  const rawText = resultContent.innerText;
  try {
    await navigator.clipboard.writeText(rawText);
    const icon = copyBtn.querySelector('i');
    icon.className = 'fa-solid fa-check';
    copyBtn.style.color = '#22c55e';
    setTimeout(() => {
      icon.className = 'fa-regular fa-copy';
      copyBtn.style.color = '';
    }, 2000);
  } catch {
    showToast('❌ Could not copy to clipboard.', 'error');
  }
}

let toastTimeout;
function showToast(message, type = 'info') {
  const colors = { success: '#22c55e', warn: '#f59e0b', error: '#ef4444', info: '#06b6d4' };
  toast.textContent = message;
  toast.style.borderColor = colors[type] || colors.info;
  toast.style.color = colors[type] || colors.info;
  toast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), 4000);
}

// =====================================================================
// BOOT
// =====================================================================
init();

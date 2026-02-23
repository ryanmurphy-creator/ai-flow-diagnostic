/* ===========================
   AI Flow Diagnostic — App JS
   =========================== */

// --- Zone Content Data ---
const ZONE_DATA = {
  'AI Flow': {
    oneliner: 'absorbed, creative partnership',
    desc: "The task is genuinely complex and the AI is genuinely capable of helping. You're not delegating, you're collaborating. You make the judgment calls, the AI handles execution, and together you build something neither of you could have made alone. Time disappears.",
    example: '<strong>Examples:</strong> Building a custom internal tool that connects multiple APIs. Analyzing a messy dataset to find patterns before a board presentation. Prototyping an MVP web app to test a product idea.'
  },
  'Jagged Frontier': {
    oneliner: 'excited, will this actually work?',
    desc: "You're pushing into territory where the AI is almost capable but not quite reliable. It surprises you, sometimes brilliantly, sometimes badly. This is the edge Ethan Mollick describes: AI capability isn't a clean line, it's jagged. A lot of vibe coding lives here.",
    example: '<strong>Examples:</strong> Writing and iterating on a full grant proposal. Building a complex interactive data dashboard. Creating a full-stack app with real-time features.'
  },
  'Surprisingly Poor': {
    oneliner: "annoyed, should've just done it myself",
    desc: "You expected the AI to handle this. It seemed like it should be good at it. But the output keeps missing, and you've now spent more time prompting and fixing than it would have taken to just do it yourself.",
    example: '<strong>Examples:</strong> Designing an investor pitch deck. Writing a keynote speech in your voice for a major conference. Creating a brand identity system for a new product.'
  },
  'Stuck Spinning': {
    oneliner: "confused, this should be working by now",
    desc: 'The AI is close. Every output is almost right. So you keep going, reprompting, tweaking, trying different angles. But the gap between "almost" and "actually useful" turns out to be enormous. You\'ve invested enough time that quitting feels wasteful, but continuing isn\'t helping.',
    example: '<strong>Examples:</strong> Maintaining a consistent editorial voice across a content series. Building a financial model with interdependent assumptions. Getting AI to design your app\'s UI/UX flow.'
  },
  'Waste of Time': {
    oneliner: "defeated, it can't even do this?",
    desc: "The task is simple. The AI should handle it. And it just can't. These are tasks that require access to live systems, real permissions, or other people's data. AI can talk about doing them but can't actually do them.",
    example: '<strong>Examples:</strong> Checking whether a specific product is in stock with your supplier. Scheduling a meeting across five people with different calendar constraints. Filing an expense report in your company\'s system.'
  },
  'Comfort Zone': {
    oneliner: "productive, but am I even thinking anymore?",
    desc: "The AI handles this perfectly. Every time. You barely review the output before hitting accept. It's efficient, but you're not engaged. Over time, the skills you used to exercise are getting softer.",
    example: '<strong>Examples:</strong> Having AI draft all your Slack messages and email replies. Auto-summarizing every document before you read it. Generating social media content on a weekly schedule.'
  },
  'Easy Wins': {
    oneliner: "convenient, saved me ten minutes",
    desc: "Simple task, capable AI, no drama. You asked it to do something straightforward and it did it. Genuinely useful. And you'll forget about it by tomorrow.",
    example: '<strong>Examples:</strong> Reformatting a CSV and cleaning column names. Translating a client email for a quick internal share. Generating boilerplate compliance language a lawyer will review anyway.'
  },
  'Cruise Mode': {
    oneliner: "comfortable, running on autopilot",
    desc: "You know the prompt patterns, you know what the AI will produce, and you get a solid result every time. The risk: you stay here because it feels good. You're not failing, but you're not growing either. The flow zone is one level up.",
    example: '<strong>Examples:</strong> Running the same weekly competitive intelligence report through your established prompts. Generating every blog post draft with the same structure. Automated code review on routine pull requests.'
  }
};

// SVG center (350,300), chart radius 420px
// Labels sit at ~280px from center. Dots at 92% of radius (386px) to clear all label text.
// Lines at 22.5°/67.5°/112.5°/157.5° → wedge midpoints at 0°,45°,90°,135°,180°,225°,270°,315°
const CX = 350, CY = 300, R = 420, DOT_FRAC = 0.92;
function sp(deg) {
  const rad = deg * Math.PI / 180;
  return {
    x: Math.round(CX + DOT_FRAC * R * Math.cos(rad)),
    y: Math.round(CY - DOT_FRAC * R * Math.sin(rad))
  };
}
const ZONE_DOT_POSITIONS = {
  'Cruise Mode':        sp(0),
  'AI Flow':            sp(45),
  'Jagged Frontier':    sp(90),
  'Surprisingly Poor':  sp(135),
  'Stuck Spinning':     sp(180),
  'Waste of Time':      sp(225),
  'Comfort Zone':       sp(270),
  'Easy Wins':          sp(315),
};

// --- State ---
let dots = [];
let activeDotGroup = null;
let sessionSubmitCount = 0;
const MAX_SUBMISSIONS = 10;
let isMinimized = false;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let isDesktop = () => window.innerWidth > 900;
let isMobile = () => window.innerWidth <= 900;

// --- DOM Refs ---
const inputWindow = document.getElementById('inputWindow');
const windowTitlebar = document.getElementById('windowTitlebar');
const windowBody = document.getElementById('windowBody');
const minimizeBtn = document.getElementById('minimizeBtn');
const taskInput = document.getElementById('taskInput');
const submitBtn = document.getElementById('submitBtn');
const resultCard = document.getElementById('resultCard');
const resultCardTitlebar = document.getElementById('resultCardTitlebar');
const resultCloseBtn = document.getElementById('resultCloseBtn');
const resultZoneName = document.getElementById('resultZoneName');
const resultExplanation = document.getElementById('resultExplanation');
const resultAdvice = document.getElementById('resultAdvice');
const tryAnotherBtn = document.getElementById('tryAnotherBtn');
const infoBtn = document.getElementById('infoBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const zoneCard = document.getElementById('zoneCard');
const zoneCardName = document.getElementById('zoneCardName');
const zoneCardOneliner = document.getElementById('zoneCardOneliner');
const zoneCardDesc = document.getElementById('zoneCardDesc');
const zoneCardExample = document.getElementById('zoneCardExample');
const dotTooltip = document.getElementById('dotTooltip');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const dotsContainer = document.getElementById('dotsContainer');
const flowChart = document.getElementById('flowChart');

// --- Zone Hover ---
const zoneAreas = document.querySelectorAll('.zone-area');
let hoverTimeout = null;

zoneAreas.forEach(area => {
  area.addEventListener('mouseenter', (e) => {
    clearTimeout(hoverTimeout);
    const zoneName = area.dataset.zone;
    const data = ZONE_DATA[zoneName];
    if (!data) return;

    zoneCardName.textContent = zoneName;
    zoneCardOneliner.textContent = data.oneliner;
    zoneCardDesc.textContent = data.desc;
    zoneCardExample.innerHTML = data.example;

    positionZoneCard(e.clientX, e.clientY);
    zoneCard.style.display = 'block';
  });

  area.addEventListener('mousemove', (e) => {
    positionZoneCard(e.clientX, e.clientY);
  });

  area.addEventListener('mouseleave', () => {
    hoverTimeout = setTimeout(() => {
      zoneCard.style.display = 'none';
    }, 100);
  });

  // Mobile tap — show as centered modal with backdrop
  area.addEventListener('click', (e) => {
    if (isDesktop()) return;
    e.stopPropagation();
    const zoneName = area.dataset.zone;
    const data = ZONE_DATA[zoneName];
    if (!data) return;

    zoneCardName.textContent = zoneName;
    zoneCardOneliner.textContent = data.oneliner;
    zoneCardDesc.textContent = data.desc;
    zoneCardExample.innerHTML = data.example;

    showMobileZoneCard();
  });
});

function positionZoneCard(mouseX, mouseY) {
  const card = zoneCard;
  const margin = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Use actual rendered size if available, else fall back to estimates
  const cardW = card.offsetWidth || 320;
  const cardH = card.offsetHeight || 300;

  let left = mouseX + 18;
  let top = mouseY - 60;

  // Flip left if overflows right edge
  if (left + cardW > vw - margin) left = mouseX - cardW - 18;
  // Clamp to left edge
  if (left < margin) left = margin;
  // Shift up if overflows bottom edge
  if (top + cardH > vh - margin) top = vh - cardH - margin;
  // Clamp to top edge
  if (top < margin) top = margin;

  card.style.left = left + 'px';
  card.style.top = top + 'px';
}

// --- Mobile Zone Card Modal ---
let zoneCardBackdrop = null;

function showMobileZoneCard() {
  // Create backdrop if it doesn't exist
  if (!zoneCardBackdrop) {
    zoneCardBackdrop = document.createElement('div');
    zoneCardBackdrop.className = 'zone-card-backdrop';
    document.body.appendChild(zoneCardBackdrop);
    zoneCardBackdrop.addEventListener('click', hideMobileZoneCard);
  }
  zoneCardBackdrop.style.display = 'block';
  zoneCard.style.display = 'block';
  clearTimeout(hoverTimeout);
}

function hideMobileZoneCard() {
  zoneCard.style.display = 'none';
  if (zoneCardBackdrop) zoneCardBackdrop.style.display = 'none';
  clearTimeout(hoverTimeout);
}

// --- Draggable Window ---
windowTitlebar.addEventListener('mousedown', (e) => {
  if (!isDesktop()) return;
  if (e.target === minimizeBtn) return;
  isDragging = true;
  const rect = inputWindow.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;
  inputWindow.style.position = 'fixed';
  inputWindow.style.zIndex = '150';
  inputWindow.style.left = rect.left + 'px';
  inputWindow.style.top = rect.top + 'px';
  inputWindow.style.width = rect.width + 'px';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  let newLeft = e.clientX - dragOffsetX;
  let newTop = e.clientY - dragOffsetY;
  // Clamp to viewport
  newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - inputWindow.offsetWidth));
  newTop = Math.max(0, Math.min(newTop, window.innerHeight - inputWindow.offsetHeight));
  inputWindow.style.left = newLeft + 'px';
  inputWindow.style.top = newTop + 'px';
});

document.addEventListener('mouseup', () => {
  isDragging = false;
});

// --- Minimize Window ---
minimizeBtn.addEventListener('click', () => {
  isMinimized = !isMinimized;
  windowBody.classList.toggle('minimized', isMinimized);
  minimizeBtn.textContent = isMinimized ? '+' : '—';
});

// --- Submit ---
submitBtn.addEventListener('click', handleSubmit);
taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSubmit();
  }
});

async function handleSubmit() {
  const task = taskInput.value.trim();
  if (!task) {
    taskInput.focus();
    taskInput.style.borderColor = '#CC4400';
    setTimeout(() => taskInput.style.borderColor = '', 1000);
    return;
  }

  if (sessionSubmitCount >= MAX_SUBMISSIONS) {
    showError("You've reached the session limit (10 evaluations). Refresh to start over.");
    return;
  }

  sessionSubmitCount++;
  submitBtn.disabled = true;
  resultCard.style.display = 'none';
  showLoading(true);

  try {
    const result = await evaluateTask(task);
    showLoading(false);
    placeDot(result, task);
    showResult(result);
  } catch (err) {
    showLoading(false);
    showError(err.message || 'Something went wrong. Please try again.');
  } finally {
    submitBtn.disabled = false;
  }
}

async function evaluateTask(task) {
  const res = await fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task }),
    signal: AbortSignal.timeout(25000)
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return res.json();
}

// --- Loading State ---
const loadingMessages = [
  'Evaluating...',
  'Consulting the framework...',
  'Mapping to zones...',
  'Checking capability scores...',
  'Almost there...'
];
let loadingMsgInterval = null;

function showLoading(show) {
  if (show) {
    loadingOverlay.style.display = 'flex';
    let i = 0;
    loadingText.textContent = loadingMessages[0];
    loadingMsgInterval = setInterval(() => {
      i = (i + 1) % loadingMessages.length;
      loadingText.textContent = loadingMessages[i];
    }, 1800);
  } else {
    loadingOverlay.style.display = 'none';
    clearInterval(loadingMsgInterval);
  }
}

// --- Active dot management ---
function setActiveDot(g) {
  // Deactivate all dots first
  dotsContainer.querySelectorAll('.dot-group').forEach(dg => {
    dg.style.opacity = '0.45';
    const d = dg.querySelector('.result-dot');
    if (d) d.classList.remove('result-dot--active');
  });
  // Activate selected
  g.style.opacity = '1';
  const d = g.querySelector('.result-dot');
  if (d) d.classList.add('result-dot--active');
  activeDotGroup = g;
}

function deactivateAllDots() {
  dotsContainer.querySelectorAll('.dot-group').forEach(g => {
    const d = g.querySelector('.result-dot');
    if (d) d.classList.remove('result-dot--active');
    // Keep current opacity (active dot stays full opacity, others stay faded)
  });
  activeDotGroup = null;
}

// --- Compute stacked dot position ---
// If dots already exist in the same zone, nudge new ones along the arc
function getStackedDotPosition(zoneName) {
  const basePos = ZONE_DOT_POSITIONS[zoneName] || { x: CX, y: CY };
  const existing = dots.filter(d => d.zone === zoneName);
  if (existing.length === 0) return basePos;

  // Nudge angle: ±18° steps along the arc, alternating left/right
  const midAngleDeg = {
    'Cruise Mode': 0, 'AI Flow': 45, 'Jagged Frontier': 90,
    'Surprisingly Poor': 135, 'Stuck Spinning': 180, 'Waste of Time': 225,
    'Comfort Zone': 270, 'Easy Wins': 315
  }[zoneName] ?? 0;

  const step = 18; // degrees offset per extra dot
  const n = existing.length;
  // Alternate: 1st extra → +18°, 2nd → -18°, 3rd → +36°, 4th → -36°…
  const sign = n % 2 === 1 ? 1 : -1;
  const magnitude = Math.ceil(n / 2);
  const offsetDeg = sign * magnitude * step;
  const angleDeg = midAngleDeg + offsetDeg;
  const rad = angleDeg * Math.PI / 180;
  return {
    x: Math.round(CX + DOT_FRAC * R * Math.cos(rad)),
    y: Math.round(CY - DOT_FRAC * R * Math.sin(rad))
  };
}

// --- Place Dot on Chart ---
function placeDot(result, taskText) {
  const zoneName = result.zone;
  const pos = getStackedDotPosition(zoneName);

  // Fade all existing dots to inactive
  dotsContainer.querySelectorAll('.dot-group').forEach(g => {
    g.style.opacity = '0.45';
    const d = g.querySelector('.result-dot');
    if (d) d.classList.remove('result-dot--active');
  });

  // Create dot group
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.classList.add('dot-group');
  g.setAttribute('data-zone', zoneName);
  g.setAttribute('data-task', taskText);
  g.setAttribute('data-explanation', result.explanation || '');
  g.setAttribute('data-advice', result.advice || '');
  g.style.cursor = 'pointer';
  g.style.opacity = '1';

  // Entrance pulse ring (one-shot)
  const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  pulse.setAttribute('cx', pos.x);
  pulse.setAttribute('cy', pos.y);
  pulse.setAttribute('r', '12');
  pulse.setAttribute('fill', 'none');
  pulse.setAttribute('stroke', '#EE4413');
  pulse.setAttribute('stroke-width', '2');
  pulse.classList.add('result-dot-pulse');

  // Main dot
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('cx', pos.x);
  dot.setAttribute('cy', pos.y);
  dot.setAttribute('r', '12');
  dot.setAttribute('fill', '#EE4413');
  dot.setAttribute('stroke', 'white');
  dot.setAttribute('stroke-width', '2.5');
  dot.classList.add('result-dot', 'result-dot--active');

  g.appendChild(pulse);
  g.appendChild(dot);
  dotsContainer.appendChild(g);
  activeDotGroup = g;

  // Click: reactivate this dot and show its result
  g.addEventListener('click', (e) => {
    e.stopPropagation();
    const zone = g.getAttribute('data-zone');
    const task = g.getAttribute('data-task');
    const explanation = g.getAttribute('data-explanation');
    const advice = g.getAttribute('data-advice');
    setActiveDot(g);
    resultZoneName.textContent = zone;
    resultExplanation.textContent = explanation;
    resultAdvice.textContent = advice;
    inputWindow.style.display = 'none';
    resultCard.style.display = 'block';
    resultCard.style.position = '';
    resultCard.style.left = '';
    resultCard.style.top = '';
    resultCard.style.width = '';
    resultCard.style.zIndex = '';
  });

  // Hover tooltip
  g.addEventListener('mouseenter', (e) => {
    dotTooltip.innerHTML = `<strong>${zoneName}</strong><br>${taskText.slice(0, 80)}${taskText.length > 80 ? '…' : ''}`;
    dotTooltip.style.display = 'block';
    positionTooltip(e.clientX, e.clientY);
  });
  g.addEventListener('mousemove', (e) => positionTooltip(e.clientX, e.clientY));
  g.addEventListener('mouseleave', () => { dotTooltip.style.display = 'none'; });

  dots.push({ zone: zoneName, task: taskText, pos });
}

function getDotPosition(capability, complexity) {
  const cx = CX, cy = CY;
  const maxR = R;

  // capability: 0-10 = x-axis (right = high)
  // complexity: 0-10 = y-axis (up = high)
  const capNorm = Math.max(0.1, Math.min(10, capability)) / 10;
  const compNorm = Math.max(0.1, Math.min(10, complexity)) / 10;

  // Map to zone angle based on the 8 zone positions
  // Use capability for x, complexity for y directly
  const x = cx + capNorm * maxR * (capability >= 5 ? 1 : -1) * Math.abs(capNorm - 0.5) * 2;
  const y = cy - compNorm * maxR * (complexity >= 5 ? 1 : -1) * Math.abs(compNorm - 0.5) * 2;

  // Fallback: use zone center if we can't compute
  const zoneName = capabilityComplexityToZone(capability, complexity);
  const zonePos = ZONE_DOT_POSITIONS[zoneName];
  if (!zonePos) return { x: cx, y: cy };

  // Interpolate between center and zone position based on scores
  const intensity = (Math.abs(capability - 5) + Math.abs(complexity - 5)) / 10;
  const minDist = 0.4, maxDist = 0.85;
  const dist = minDist + intensity * (maxDist - minDist);

  return {
    x: cx + (zonePos.x - cx) * dist,
    y: cy + (zonePos.y - cy) * dist
  };
}

function capabilityComplexityToZone(capability, complexity) {
  // Map scores to zone name (fallback, API should provide zone)
  if (capability >= 7 && complexity >= 7) return 'AI Flow';
  if (capability >= 5 && complexity >= 7) return 'Jagged Frontier';
  if (capability < 5 && complexity >= 7) return 'Surprisingly Poor';
  if (capability < 5 && complexity >= 4) return 'Stuck Spinning';
  if (capability < 5 && complexity < 4) return 'Waste of Time';
  if (capability >= 4 && capability < 7 && complexity < 4) return 'Comfort Zone';
  if (capability >= 7 && complexity < 4) return 'Easy Wins';
  if (capability >= 7 && complexity >= 4 && complexity < 7) return 'Cruise Mode';
  return 'Cruise Mode';
}

function positionTooltip(mouseX, mouseY) {
  const margin = 12;
  const vw = window.innerWidth;
  let left = mouseX + 14;
  let top = mouseY - 50;
  if (left + 230 > vw - margin) left = mouseX - 230 - 14;
  dotTooltip.style.left = left + 'px';
  dotTooltip.style.top = top + 'px';
}

// --- Show Result Card ---
function showResult(result) {
  resultZoneName.textContent = result.zone;
  resultExplanation.textContent = result.explanation;
  resultAdvice.textContent = result.advice;
  // Swap: hide input window, show result card
  inputWindow.style.display = 'none';
  resultCard.style.display = 'block';
  // Reset any drag positioning on result card
  resultCard.style.position = '';
  resultCard.style.left = '';
  resultCard.style.top = '';
  resultCard.style.width = '';
  resultCard.style.zIndex = '';

  if (!isDesktop()) {
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function showError(msg) {
  resultZoneName.textContent = 'Error';
  resultExplanation.textContent = msg;
  resultAdvice.textContent = '';
  inputWindow.style.display = 'none';
  resultCard.style.display = 'block';
}

// --- Result Card Controls ---
function dismissResultCard(clearInput) {
  // Stop pulsing the active dot — remove active class, keep it full opacity
  if (activeDotGroup) {
    const d = activeDotGroup.querySelector('.result-dot');
    if (d) d.classList.remove('result-dot--active');
    activeDotGroup.style.opacity = '1';
    activeDotGroup = null;
  }
  resultCard.style.display = 'none';
  resultCard.style.position = '';
  resultCard.style.left = '';
  resultCard.style.top = '';
  resultCard.style.width = '';
  resultCard.style.zIndex = '';
  inputWindow.style.display = 'block';
  inputWindow.style.position = '';
  inputWindow.style.left = '';
  inputWindow.style.top = '';
  inputWindow.style.width = '';
  inputWindow.style.zIndex = '';
  submitBtn.disabled = false;
  if (clearInput) {
    taskInput.value = '';
  }
  taskInput.focus();
}

tryAnotherBtn.addEventListener('click', () => dismissResultCard(true));
resultCloseBtn.addEventListener('click', () => dismissResultCard(false));

// --- Draggable Result Card ---
let isResultDragging = false;
let resultDragOffsetX = 0;
let resultDragOffsetY = 0;

resultCardTitlebar.addEventListener('mousedown', (e) => {
  if (!isDesktop()) return;
  isResultDragging = true;
  const rect = resultCard.getBoundingClientRect();
  resultDragOffsetX = e.clientX - rect.left;
  resultDragOffsetY = e.clientY - rect.top;
  resultCard.style.position = 'fixed';
  resultCard.style.zIndex = '150';
  resultCard.style.left = rect.left + 'px';
  resultCard.style.top = rect.top + 'px';
  resultCard.style.width = rect.width + 'px';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isResultDragging) return;
  let newLeft = e.clientX - resultDragOffsetX;
  let newTop = e.clientY - resultDragOffsetY;
  newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - resultCard.offsetWidth));
  newTop = Math.max(0, Math.min(newTop, window.innerHeight - resultCard.offsetHeight));
  resultCard.style.left = newLeft + 'px';
  resultCard.style.top = newTop + 'px';
});

document.addEventListener('mouseup', () => {
  isResultDragging = false;
});

// --- Info Modal ---
infoBtn.addEventListener('click', () => {
  modalOverlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
});

function closeModal() {
  modalOverlay.style.display = 'none';
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    zoneCard.style.display = 'none';
  }
});

// --- Dismiss zone card on outside click (mobile) ---
document.addEventListener('click', (e) => {
  if (!e.target.closest('.zone-area') && !e.target.closest('.zone-card')) {
    zoneCard.style.display = 'none';
  }
});

// --- Keyboard shortcut hint in textarea ---
taskInput.addEventListener('focus', () => {
  if (!taskInput.title) {
    taskInput.title = 'Cmd+Enter or Ctrl+Enter to submit';
  }
});

// --- On resize: reset window position if dragged off-screen ---
window.addEventListener('resize', () => {
  if (inputWindow.style.position === 'fixed') {
    const rect = inputWindow.getBoundingClientRect();
    if (rect.left > window.innerWidth - 50 || rect.top > window.innerHeight - 50) {
      inputWindow.style.position = '';
      inputWindow.style.left = '';
      inputWindow.style.top = '';
      inputWindow.style.width = '';
    }
  }
});

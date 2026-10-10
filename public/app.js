'use strict';

const App = (() => {
  // ── State ──────────────────────────────────────────────────────────────────
  let components = [];
  let lastRecommendations = [];
  let workspace = JSON.parse(localStorage.getItem('cv_workspace') || 'null');

  // ── Initialise ─────────────────────────────────────────────────────────────
  async function init() {
    document.getElementById('year').textContent = new Date().getFullYear();
    await checkHealth();
    setupDropZone();
    setupManualInput();
    renderWorkspace();
    loadAllProjects();
    loadBuildForGood();
    // Re-activate nav from hash
    const hash = location.hash.replace('#', '') || 'home';
    nav(hash, false);
  }

  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      const isLive = data.capabilities && data.capabilities.vision;

      // Header chip
      const chip = document.getElementById('modeChip');
      chip.textContent = isLive ? '🟢 Live AI' : '🟡 Demo Mode';
      chip.className = 'mode-chip ' + (isLive ? 'live' : 'demo');

      // Scanner banners
      const demoNotice = document.getElementById('demoNotice');
      const liveNotice = document.getElementById('liveNotice');
      if (demoNotice) demoNotice.style.display = isLive ? 'none' : 'block';
      if (liveNotice) liveNotice.style.display = isLive ? 'block' : 'none';

      // AI mode box
      const icon = document.getElementById('aiModeIcon');
      const label = document.getElementById('aiModeLabel');
      const desc = document.getElementById('aiModeDesc');
      const badge = document.getElementById('aiProviderLabel');
      const hint = document.getElementById('aiModeHint');

      if (isLive) {
        if (icon) icon.textContent = '🟢';
        if (label) label.textContent = 'Live AI Mode';
        if (desc) desc.textContent = 'GPT-4o Vision active';
        if (badge) { badge.textContent = 'OpenAI GPT-4o Vision'; badge.className = 'ai-provider-badge live'; }
        if (hint) hint.textContent = 'Upload a real photo of your components for automatic AI detection.';
      } else {
        if (icon) icon.textContent = '🟡';
        if (label) label.textContent = 'Demo Mode';
        if (desc) desc.textContent = 'Example components only';
        if (badge) { badge.textContent = 'No API key configured'; badge.className = 'ai-provider-badge demo'; }
        if (hint) hint.innerHTML = 'To enable live detection, add <code>OPENAI_API_KEY=sk-...</code> to your <code>.env</code> file and restart the server.';
      }
    } catch { /* server not yet ready */ }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  function nav(page, pushState = true) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    const target = document.getElementById('page-' + page);
    if (!target) return;
    target.classList.add('active');

    const link = document.querySelector(`[data-page="${page}"]`);
    if (link) link.classList.add('active');

    if (pushState) location.hash = page;
    window.scrollTo(0, 0);
  }

  // ── Drop Zone ──────────────────────────────────────────────────────────────
  function setupDropZone() {
    const zone   = document.getElementById('dropZone');
    const fileIn = document.getElementById('fileInput');
    const camIn  = document.getElementById('cameraInput');

    // "Choose File" button — stop propagation so the zone click doesn't fire too
    document.getElementById('chooseFileBtn').addEventListener('click', e => {
      e.stopPropagation();
      fileIn.value = '';          // reset so same file can be re-selected
      fileIn.click();
    });

    // "Use Camera" button
    document.getElementById('cameraBtn').addEventListener('click', e => {
      e.stopPropagation();
      camIn.value = '';
      camIn.click();
    });

    // Clicking blank area of zone opens file picker
    zone.addEventListener('click', e => {
      if (e.target === zone || e.target.closest('.upload-inner')) {
        if (!e.target.closest('button')) {
          e.stopPropagation();
          fileIn.value = '';
          fileIn.click();
        }
      }
    });

    // Drag and drop
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });

    // File input change handlers
    fileIn.addEventListener('change', () => { if (fileIn.files[0]) handleFile(fileIn.files[0]); });
    camIn.addEventListener('change', () => { if (camIn.files[0]) handleFile(camIn.files[0]); });
  }

  function handleFile(file) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      return showError('Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.');
    }
    if (file.size > 5 * 1024 * 1024) {
      return showError('Image too large. Maximum size is 5 MB.');
    }

    const reader = new FileReader();
    reader.onload = evt => {
      document.getElementById('previewImg').src = evt.target.result;
      document.getElementById('uploadInner').style.display = 'none';
      document.getElementById('imagePreview').style.display = 'block';
      document.getElementById('dropZone').classList.add('has-image');
      // Store for upload
      document.getElementById('fileInput')._selectedFile = file;
      // Clear previous analyse status
      setAnalyzeStatus('', '');
    };
    reader.readAsDataURL(file);
  }

  function clearImage() {
    document.getElementById('previewImg').src = '';
    document.getElementById('uploadInner').style.display = 'block';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('dropZone').classList.remove('has-image');
    document.getElementById('fileInput').value = '';
    document.getElementById('fileInput')._selectedFile = null;
    setAnalyzeStatus('', '');
  }

  function setAnalyzeStatus(type, msg) {
    const el = document.getElementById('analyzeStatus');
    if (!el) return;
    if (!type || !msg) { el.style.display = 'none'; el.className = 'analyze-status'; el.textContent = ''; return; }
    el.className = 'analyze-status ' + type;
    el.textContent = msg;
    el.style.display = 'flex';
  }

  // ── Analyse Image ──────────────────────────────────────────────────────────
  async function analyzeImage() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput._selectedFile;
    if (!file) { showError('Please select an image first.'); return; }

    showScannerLoading(true, 'Analysing image…', 'Sending to AI vision model…');
    setAnalyzeStatus('', '');

    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');

      let addedCount = 0;
      for (const c of data.components) {
        const before = components.length;
        addComponent(c.name, c.source === 'demo' ? 'demo' : 'ai');
        if (components.length > before) addedCount++;
      }

      if (data.mode === 'demo') {
        setAnalyzeStatus('demo-info',
          `🟡 Demo Mode: ${addedCount} example components loaded. This is not real AI analysis — add OPENAI_API_KEY to .env for live detection.`);
      } else {
        setAnalyzeStatus('success',
          `🟢 AI detected ${addedCount} component${addedCount !== 1 ? 's' : ''}. Review and adjust below.`);
      }
    } catch (err) {
      setAnalyzeStatus('error', '❌ Analysis failed: ' + err.message);
    } finally {
      showScannerLoading(false);
    }
  }

  // ── Component Management ───────────────────────────────────────────────────
  function setupManualInput() {
    document.getElementById('manualInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') addManualComponent();
    });
  }

  function addManualComponent() {
    const input = document.getElementById('manualInput');
    const val = input.value.trim();
    if (!val) return;
    addComponent(val, 'manual');
    input.value = '';
  }

  function quickAdd(name) {
    addComponent(name, 'manual');
  }

  function addComponent(name, source = 'manual') {
    const norm = name.trim();
    if (!norm) return;
    if (components.some(c => c.name.toLowerCase() === norm.toLowerCase())) return; // dedupe
    components.push({ name: norm, source });
    renderChips();
    updateFindBtn();
  }

  function removeComponent(index) {
    components.splice(index, 1);
    renderChips();
    updateFindBtn();
  }

  function clearAllComponents() {
    components = [];
    renderChips();
    updateFindBtn();
    setAnalyzeStatus('', '');
  }

  function renderChips() {
    const container = document.getElementById('componentChips');
    const clearBtn  = document.getElementById('clearAllBtn');
    if (components.length === 0) {
      container.innerHTML = '<p class="empty-state" id="chipsEmpty">Upload an image or use Quick Add below.</p>';
      if (clearBtn) clearBtn.style.display = 'none';
      return;
    }
    if (clearBtn) clearBtn.style.display = 'inline-flex';

    const aiChips   = components.filter(c => c.source === 'ai');
    const demoChips = components.filter(c => c.source === 'demo');
    const manChips  = components.filter(c => c.source === 'manual');

    let label = '';
    if (aiChips.length)   label += '<span style="font-size:.75rem;color:var(--green);font-weight:600;display:block;margin-bottom:.35rem">🟢 AI detected (' + aiChips.length + ')</span>';
    if (demoChips.length) label += '<span style="font-size:.75rem;color:#92400e;font-weight:600;display:block;margin-bottom:.35rem">🟡 Demo examples (' + demoChips.length + ')</span>';
    if (manChips.length)  label += '<span style="font-size:.75rem;color:var(--muted);font-weight:600;display:block;margin-bottom:.35rem">✏️ Added manually (' + manChips.length + ')</span>';

    container.innerHTML = label + components.map((c, i) => {
      const cls = c.source === 'demo' ? 'demo-chip' : c.source === 'ai' ? 'ai-chip' : '';
      const tip = c.source === 'demo' ? 'Demo example' : c.source === 'ai' ? 'AI detected' : 'Manually added';
      return '<span class="chip ' + cls + '" title="' + tip + '">' + escHtml(c.name) + '<span class="remove-chip" onclick="App.removeComponent(' + i + ')" title="Remove">✕</span></span>';
    }).join('');
  }

  function updateFindBtn() {
    document.getElementById('findProjectsBtn').disabled = components.length === 0;
  }

  // ── Find Projects ──────────────────────────────────────────────────────────
  async function findProjects() {
    if (components.length === 0) return;
    nav('projects');
    const grid = document.getElementById('projectsGrid');
    grid.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><p>Finding matching projects…</p></div>';

    try {
      const res = await fetch('/api/projects/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ components: components.map(c => c.name) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      lastRecommendations = data.projects;
      renderProjectCards(data.projects);
    } catch (err) {
      grid.innerHTML = `<div class="alert alert-error">Failed to load recommendations: ${escHtml(err.message)}</div>`;
    }
  }

  // ── Load All Projects ──────────────────────────────────────────────────────
  async function loadAllProjects() {
    const difficulty = document.getElementById('filterDifficulty')?.value || '';
    const category = document.getElementById('filterCategory')?.value || '';
    const params = new URLSearchParams();
    if (difficulty) params.set('difficulty', difficulty);
    if (category) params.set('category', category);

    const grid = document.getElementById('projectsGrid');
    if (!grid) return;

    try {
      const res = await fetch('/api/projects?' + params.toString());
      const data = await res.json();
      renderProjectCards(data.projects);
    } catch (err) {
      grid.innerHTML = `<div class="alert alert-error">Could not load projects.</div>`;
    }
  }

  function filterProjects() {
    loadAllProjects();
  }

  function renderProjectCards(projects) {
    const grid = document.getElementById('projectsGrid');
    if (!projects || projects.length === 0) {
      grid.innerHTML = '<p class="empty-state">No projects found for the selected filters.</p>';
      return;
    }
    grid.innerHTML = projects.map(p => {
      const badgeClass = p.difficulty === 'Beginner' ? 'badge-beginner' : p.difficulty === 'Intermediate' ? 'badge-intermediate' : 'badge-advanced';
      const available = p.availableComponents || [];
      const missing = p.missingComponents || [];
      const matchScore = p.matchScore !== undefined ? `<div class="card-match">✅ ${escHtml(p.matchReason || '')}</div>` : '';
      const compChips = (available.length > 0 || missing.length > 0) ? `
        <div class="card-components">
          ${available.map(c => `<span class="comp-have" title="You have this">✓ ${escHtml(c)}</span>`).join('')}
          ${missing.map(c => `<span class="comp-need" title="Still needed">+ ${escHtml(c)}</span>`).join('')}
        </div>` : '';
      return `
        <div class="project-card" onclick="App.openProject('${escHtml(p.id)}')">
          <div class="card-top">
            <div class="card-title">${escHtml(p.title)}</div>
            <span class="badge ${badgeClass}">${escHtml(p.difficulty)}</span>
          </div>
          <div class="card-tagline">${escHtml(p.tagline)}</div>
          ${matchScore}
          <div class="card-meta">
            <span class="meta-item">⏱ ${escHtml(p.estimatedTime)}</span>
            <span class="meta-item">💰 ₹${p.additionalCostINR} extra</span>
            <span class="meta-item">📂 ${escHtml(p.category)}</span>
          </div>
          ${compChips}
        </div>`;
    }).join('');
  }

  // ── Open Project Detail ────────────────────────────────────────────────────
  async function openProject(id) {
    nav('detail');
    const container = document.getElementById('projectDetail');
    container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><p>Loading project…</p></div>';
    try {
      const res = await fetch('/api/projects/' + encodeURIComponent(id));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      renderProjectDetail(data.project);
    } catch (err) {
      container.innerHTML = `<div class="alert alert-error">Could not load project: ${escHtml(err.message)}</div>`;
    }
  }

  // Store current detail project so buttons can reference it without inline JSON
  let _currentProject = null;

  function renderProjectDetail(p) {
    _currentProject = p;  // safe reference — no inline JSON on buttons

    const badgeClass = p.difficulty === 'Beginner' ? 'badge-beginner' : p.difficulty === 'Intermediate' ? 'badge-intermediate' : 'badge-advanced';

    const bomRows = (p.bom || []).map(b =>
      '<tr><td>' + escHtml(b.item) + '</td><td>' + b.qty + '</td><td>₹' + b.approxCostINR + '</td><td>' + escHtml(b.notes || '') + '</td></tr>'
    ).join('');

    const wiringRows = (p.wiringTable || []).map(w =>
      '<tr><td>' + escHtml(w.component) + '</td><td><code>' + escHtml(w.arduinoPin) + '</code></td></tr>'
    ).join('');

    const steps = (p.assemblySteps || []).map(s => '<li>' + escHtml(s) + '</li>').join('');

    const troubleRows = (p.troubleshooting || []).map(t =>
      '<tr><td>' + escHtml(t.problem) + '</td><td>' + escHtml(t.fix) + '</td></tr>'
    ).join('');

    const libs = (p.libraries || []).length > 0
      ? '<p class="mb-1"><strong>Required Libraries:</strong></p><ul>' + p.libraries.map(l => '<li>' + escHtml(l) + '</li>').join('') + '</ul>'
      : '<p class="text-muted">No external libraries required.</p>';

    // Unescape \n sequences stored as literal strings in JSON
    const codeDisplay = escHtml((p.code || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t'));

    const html =
      '<div class="detail-header">' +
        '<h2>' + escHtml(p.title) + '</h2>' +
        '<p>' + escHtml(p.tagline) + '</p>' +
        '<div class="detail-badges">' +
          '<span class="badge ' + badgeClass + '">' + escHtml(p.difficulty) + '</span>' +
          '<span class="badge" style="background:var(--surface);color:var(--text);border:1px solid var(--border)">⏱ ' + escHtml(p.estimatedTime) + '</span>' +
          '<span class="badge" style="background:var(--surface);color:var(--text);border:1px solid var(--border)">💰 ₹' + p.additionalCostINR + ' extra</span>' +
          '<span class="badge" style="background:var(--surface);color:var(--text);border:1px solid var(--border)">📂 ' + escHtml(p.category) + '</span>' +
          (p.socialImpact ? '<span class="badge badge-beginner">🌱 Social Impact</span>' : '') +
        '</div>' +
      '</div>' +

      '<div class="detail-grid">' +

        '<div class="detail-section">' +
          '<h3>📋 Overview</h3>' +
          '<p>' + escHtml(p.overview) + '</p>' +
          '<br/><p><strong>Real-world problem:</strong> ' + escHtml(p.realWorldProblem) + '</p>' +
        '</div>' +

        '<div class="detail-section">' +
          '<h3>🛒 Bill of Materials</h3>' +
          '<table class="bom-table"><thead><tr><th>Component</th><th>Qty</th><th>Cost</th><th>Notes</th></tr></thead>' +
          '<tbody>' + bomRows + '</tbody></table>' +
        '</div>' +

        '<div class="detail-section full">' +
          '<h3>🔌 Wiring Guide</h3>' +
          '<table class="wiring-table"><thead><tr><th>Component Pin</th><th>Arduino Pin</th></tr></thead>' +
          '<tbody>' + wiringRows + '</tbody></table>' +
        '</div>' +

        '<div class="detail-section full">' +
          '<h3>💻 Arduino Sketch</h3>' +
          libs + '<br/>' +
          '<div class="code-panel">' +
            '<div class="code-toolbar">' +
              '<span class="code-lang">Arduino C++</span>' +
              '<div class="code-actions">' +
                '<button class="btn btn-sm btn-outline" style="color:#fff;border-color:#4a5568" onclick="App.copyCode()">📋 Copy</button>' +
                '<button class="btn btn-sm btn-outline" style="color:#fff;border-color:#4a5568" onclick="App.downloadCode()">⬇ Download .ino</button>' +
              '</div>' +
            '</div>' +
            '<div class="code-body"><pre id="codeBlock">' + codeDisplay + '</pre></div>' +
          '</div><br/>' +
          '<p><strong>Upload Instructions:</strong> ' + escHtml(p.uploadInstructions || '') + '</p>' +
        '</div>' +

        '<div class="detail-section">' +
          '<h3>🔨 Assembly Steps</h3>' +
          '<ol class="steps-list">' + steps + '</ol>' +
        '</div>' +

        '<div class="detail-section">' +
          '<h3>✅ Expected Behaviour</h3>' +
          '<p>' + escHtml(p.expectedBehavior || '') + '</p>' +
          '<br/><h3>⚠️ Safety Notes</h3>' +
          '<p class="text-muted" style="font-size:.875rem">' + escHtml(p.safetyNotes || '') + '</p>' +
        '</div>' +

        '<div class="detail-section full">' +
          '<h3>🛠️ Project Troubleshooting</h3>' +
          '<table class="trouble-table"><thead><tr><th>Problem</th><th>Fix</th></tr></thead>' +
          '<tbody>' + troubleRows + '</tbody></table>' +
        '</div>' +

        '<div class="detail-section full">' +
          '<div style="display:flex;gap:.75rem;flex-wrap:wrap">' +
            '<button class="btn btn-primary" onclick="App.addToWorkspace()">📋 Add to Workspace</button>' +
            '<button class="btn btn-outline" onclick="App.downloadGuide()">⬇ Download Guide</button>' +
            '<button class="btn btn-outline" onclick="App.nav(\'troubleshoot\')">🛠️ Get Help</button>' +
          '</div>' +
        '</div>' +

      '</div>';

    document.getElementById('projectDetail').innerHTML = html;
  }

  // ── Code Copy / Download ───────────────────────────────────────────────────
  function copyCode() {
    if (!_currentProject) return;
    const pre = document.getElementById('codeBlock');
    const text = pre ? pre.textContent : (_currentProject.code || '').replace(/\\n/g, '\n');
    // clipboard API needs HTTPS or localhost; fallback to textarea trick
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showBanner('Code copied to clipboard!', 'success');
      }).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showBanner('Code copied to clipboard!', 'success');
    } catch { showError('Copy failed — please select the code manually.'); }
    document.body.removeChild(ta);
  }

  function downloadCode() {
    if (!_currentProject) return;
    const code = (_currentProject.code || '').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    const blob = new Blob([code], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = _currentProject.title.replace(/\s+/g, '_') + '.ino';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ── Download Guide ─────────────────────────────────────────────────────────
  function downloadGuide() {
    const p = _currentProject;
    if (!p) return;
    const lines = [
      `CircuitVision AI — Project Guide`,
      `=================================`,
      `Project: ${p.title}`,
      `Difficulty: ${p.difficulty} | Time: ${p.estimatedTime} | Extra Cost: ₹${p.additionalCostINR}`,
      ``,
      `OVERVIEW`,
      `--------`,
      p.overview,
      ``,
      `REAL-WORLD PROBLEM`,
      `------------------`,
      p.realWorldProblem,
      ``,
      `BILL OF MATERIALS`,
      `-----------------`,
      ...(p.bom || []).map(b => `• ${b.qty}x ${b.item} — ₹${b.approxCostINR} (${b.notes})`),
      ``,
      `WIRING GUIDE`,
      `------------`,
      ...(p.wiringTable || []).map(w => `${w.component.padEnd(40)} → ${w.arduinoPin}`),
      ``,
      `ASSEMBLY STEPS`,
      `--------------`,
      ...(p.assemblySteps || []).map((s, i) => `${i + 1}. ${s}`),
      ``,
      `ARDUINO SKETCH`,
      `--------------`,
      p.code || '',
      ``,
      `UPLOAD INSTRUCTIONS`,
      `-------------------`,
      p.uploadInstructions || '',
      ``,
      `EXPECTED BEHAVIOUR`,
      `------------------`,
      p.expectedBehavior || '',
      ``,
      `SAFETY NOTES`,
      `------------`,
      p.safetyNotes || '',
      ``,
      `--- Generated by CircuitVision AI ---`
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = p.title.replace(/\s+/g, '_') + '_guide.txt';
    a.click();
  }

  // ── Workspace ──────────────────────────────────────────────────────────────
  function addToWorkspace() {
    const p = _currentProject;
    if (!p) return;
    workspace = {
      projectId: p.id,
      title: p.title,
      steps: (p.assemblySteps || []).map((s, i) => ({ text: s, done: false, index: i })),
      components: (p.bom || []).map((b, i) => ({ text: `${b.qty}x ${b.item}`, done: false, index: i }))
    };
    localStorage.setItem('cv_workspace', JSON.stringify(workspace));
    renderWorkspace();
    showBanner(`"${p.title}" added to your Workspace!`, 'success');
  }

  function renderWorkspace() {
    const container = document.getElementById('workspaceContent');
    if (!container) return;
    if (!workspace) {
      container.innerHTML = '<p class="empty-state">Open a project and click "Add to Workspace" to start tracking your build.</p>';
      return;
    }
    container.innerHTML = `
      <div class="workspace-card">
        <div class="workspace-title">🔧 ${escHtml(workspace.title)}</div>
        <p class="label-sm" style="margin-bottom:.5rem">Component Checklist</p>
        <ul class="checklist" id="compChecklist">
          ${(workspace.components || []).map((c, i) => `
            <li class="${c.done ? 'done' : ''}" id="comp-${i}">
              <input type="checkbox" ${c.done ? 'checked' : ''} onchange="App.toggleWorkspaceItem('comp', ${i})">
              ${escHtml(c.text)}
            </li>`).join('')}
        </ul>
        <p class="label-sm" style="margin-top:1rem;margin-bottom:.5rem">Assembly Steps</p>
        <ul class="checklist" id="stepChecklist">
          ${(workspace.steps || []).map((s, i) => `
            <li class="${s.done ? 'done' : ''}" id="step-${i}">
              <input type="checkbox" ${s.done ? 'checked' : ''} onchange="App.toggleWorkspaceItem('step', ${i})">
              ${escHtml(s.text)}
            </li>`).join('')}
        </ul>
        <div class="workspace-actions">
          <button class="btn btn-outline btn-sm" onclick="App.openProject('${escHtml(workspace.projectId)}')">Open Project</button>
          <button class="btn btn-danger btn-sm" onclick="App.clearWorkspace()">🗑 Clear Workspace</button>
        </div>
      </div>`;
  }

  function toggleWorkspaceItem(type, index) {
    if (!workspace) return;
    const arr = type === 'comp' ? workspace.components : workspace.steps;
    arr[index].done = !arr[index].done;
    localStorage.setItem('cv_workspace', JSON.stringify(workspace));
    const li = document.getElementById(`${type}-${index}`);
    if (li) li.className = arr[index].done ? 'done' : '';
  }

  function clearWorkspace() {
    workspace = null;
    localStorage.removeItem('cv_workspace');
    renderWorkspace();
  }

  // ── Build for Good ─────────────────────────────────────────────────────────
  async function loadBuildForGood() {
    const grid = document.getElementById('bfgGrid');
    if (!grid) return;
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      const socialProjects = (data.projects || []).filter(p => p.socialImpact);
      if (socialProjects.length === 0) {
        grid.innerHTML = '<p class="empty-state">No social impact projects found.</p>';
        return;
      }
      grid.innerHTML = socialProjects.map(p => {
        const badgeClass = p.difficulty === 'Beginner' ? 'badge-beginner' : 'badge-intermediate';
        return `
          <div class="project-card" onclick="App.openProject('${escHtml(p.id)}')">
            <div class="card-top">
              <div class="card-title">${escHtml(p.title)}</div>
              <span class="badge ${badgeClass}">${escHtml(p.difficulty)}</span>
            </div>
            <div class="card-tagline">${escHtml(p.tagline)}</div>
            <div class="card-meta">
              <span class="meta-item">🌱 ${escHtml(p.socialImpactCategory || p.category)}</span>
              <span class="meta-item">⏱ ${escHtml(p.estimatedTime)}</span>
              <span class="meta-item">💰 ₹${p.additionalCostINR}</span>
            </div>
          </div>`;
      }).join('');
    } catch { grid.innerHTML = '<p class="empty-state">Could not load projects.</p>'; }
  }

  // ── Troubleshoot ───────────────────────────────────────────────────────────
  async function troubleshoot() {
    const problem = document.getElementById('problemInput').value.trim();
    if (!problem) return showError('Please describe your problem first.');
    if (problem.length > 2000) return showError('Description too long. Max 2000 characters.');

    document.getElementById('troubleshootLoading').style.display = 'flex';
    document.getElementById('troubleshootResult').style.display = 'none';

    try {
      const res = await fetch('/api/troubleshoot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const causesHtml = (data.causes || []).map(c => `<li>${escHtml(c)}</li>`).join('');
      const stepsHtml = (data.steps || []).map(s => `<li>${escHtml(s)}</li>`).join('');

      const result = document.getElementById('troubleshootResult');
      result.innerHTML = `
        <div class="disclaimer-box">⚠️ ${escHtml(data.disclaimer || '')}</div>
        <div class="trouble-causes">
          <h3>🔎 Likely Causes</h3>
          <ul>${causesHtml}</ul>
        </div>
        <div class="trouble-steps">
          <h3>🔧 Step-by-Step Checks</h3>
          <ol>${stepsHtml}</ol>
        </div>`;
      result.style.display = 'block';
    } catch (err) {
      showError('Troubleshooting error: ' + err.message);
    } finally {
      document.getElementById('troubleshootLoading').style.display = 'none';
    }
  }

  // ── Utilities ──────────────────────────────────────────────────────────────
  function escHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function showBanner(msg, type = 'info') {
    const existing = document.getElementById('flashBanner');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.id = 'flashBanner';
    div.className = `alert alert-${type}`;
    div.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:999;max-width:500px;width:90%;box-shadow:0 4px 20px rgba(0,0,0,.15)';
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 4000);
  }

  function showError(msg) { showBanner(msg, 'error'); }

  function showScannerLoading(show, title, msg) {
    const el = document.getElementById('scannerLoading');
    if (!el) return;
    el.style.display = show ? 'flex' : 'none';
    if (show) {
      const t = document.getElementById('scannerLoadingTitle');
      const m = document.getElementById('scannerLoadingMsg');
      if (t && title) t.textContent = title;
      if (m && msg)   m.textContent = msg;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    nav, analyzeImage, clearImage, clearAllComponents,
    addManualComponent, quickAdd, removeComponent,
    findProjects, loadAllProjects, filterProjects,
    openProject, copyCode, fallbackCopy, downloadCode, downloadGuide,
    addToWorkspace, toggleWorkspaceItem, clearWorkspace,
    troubleshoot
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());

// Handle browser back/forward
window.addEventListener('hashchange', () => {
  const page = location.hash.replace('#', '') || 'home';
  App.nav(page, false);
});

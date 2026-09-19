/* ============================================================
   OpRail — SPA Frontend Logic
   SIH 2026 | PS-26027 | Ministry of Railways
   ============================================================ */

"use strict";

/* ══════════════════════════════════════════════════════════════
   1. ROUTER
   ══════════════════════════════════════════════════════════════ */
const PAGES = {
  dashboard: { title: 'Block Planning Dashboard', crumb: 'Dashboard', load: loadDashboard },
  planner:   { title: 'Block Planner',            crumb: 'Block Planner', load: loadPlannerPage },
  tasks:     { title: 'Maintenance Tasks',         crumb: 'Tasks', load: loadTasks },
  tms:       { title: 'TMS — Engineering',         crumb: 'TMS', load: loadTmsPage },
  smms:      { title: 'SMMS — S&T',               crumb: 'SMMS', load: loadSmmsPage },
  tdms:      { title: 'TDMS — OHE',               crumb: 'TDMS', load: loadTdmsPage },
  coa:       { title: 'COA — Train Schedule',      crumb: 'COA', load: () => {} },
};

let currentPage = 'dashboard';

function navigate(page) {
  if (!PAGES[page]) return;

  // Hide current page
  document.querySelectorAll('.page-view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  // Show new page
  document.getElementById(`page-${page}`).classList.add('active');
  document.getElementById(`nav-${page}`).classList.add('active');

  // Update topbar
  document.getElementById('topbar-title').textContent = PAGES[page].title;
  document.getElementById('topbar-crumb').textContent = PAGES[page].crumb;

  currentPage = page;

  // Load page data
  lucide.createIcons();
  PAGES[page].load();
}

function refreshCurrentPage() {
  PAGES[currentPage]?.load();
  showToast('info', 'Refreshed', `${PAGES[currentPage].crumb} data reloaded.`);
}


/* ══════════════════════════════════════════════════════════════
   2. API CLIENT
   ══════════════════════════════════════════════════════════════ */
const API_BASE = '';

async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(API_BASE + path, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (e) {
    console.error('API error:', path, e);
    throw e;
  }
}

async function checkBackendHealth() {
  try {
    await apiFetch('/health');
    document.getElementById('api-status-dot').className = 'status-dot';
    document.getElementById('api-status-text').textContent = 'Backend Online';
  } catch {
    document.getElementById('api-status-dot').className = 'status-dot offline';
    document.getElementById('api-status-text').textContent = 'Backend Offline';
  }
}


/* ══════════════════════════════════════════════════════════════
   3. DASHBOARD PAGE
   ══════════════════════════════════════════════════════════════ */
let chartAvailability = null;
let chartDept = null;

async function loadDashboard() {
  try {
    const data = await apiFetch('/api/dashboard/');
    renderDashboardKPIs(data);
    renderAvailabilityChart(data.availability_trend);
    renderDeptChart(data.dept_stats);
    renderSectionsTable(data.section_statuses);

    // Update critical badge in sidebar
    if (data.critical_tasks > 0) {
      const badge = document.getElementById('nav-badge-critical');
      badge.textContent = data.critical_tasks;
      badge.style.display = 'inline-flex';
    }
  } catch (e) {
    showToast('danger', 'Dashboard Error', e.message);
  }
}

function renderDashboardKPIs(data) {
  setText('kpi-availability', data.asset_availability_pct + '%');
  setText('kpi-total',        data.total_tasks);
  setText('kpi-critical',     data.critical_tasks);
  setText('kpi-overdue',      data.overdue_tasks);
  setText('kpi-scheduled',    data.scheduled_tasks);
  setText('kpi-joint',        data.joint_blocks_today);
  setText('kpi-blocks',       data.todays_blocks);
  setText('kpi-efficiency',   data.avg_block_efficiency + '%');

  // Honest sub-labels for the block cells — say 'latest plan' only if there is one
  const runSub = data.latest_run_date
    ? `Latest plan · ${data.latest_run_date}`
    : 'No plans generated';
  setText('kpi-joint-sub',  runSub);
  setText('kpi-blocks-sub', runSub);

  // Stop the signal-dot pulsing when critical count is 0 (no false alarm)
  const critDot = document.getElementById('kpi-critical-dot');
  if (critDot) {
    if (data.critical_tasks === 0) {
      critDot.classList.remove('pulse');
    } else {
      critDot.classList.add('pulse');
    }
  }
}

function renderAvailabilityChart(trend) {
  const ctx = document.getElementById('chart-availability');
  if (!ctx) return;
  if (chartAvailability) chartAvailability.destroy();

  const labels = trend.map(t => t.date);
  const values = trend.map(t => t.availability);

  chartAvailability = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Availability %',
        data: values,
        borderColor: '#3F9B6F',
        backgroundColor: 'rgba(63,155,111,0.07)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        pointBackgroundColor: '#3F9B6F',
        borderWidth: 1.5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#4A5568', font: { size: 10, family: "'IBM Plex Mono'" } } },
        y: {
          grid: { color: 'rgba(255,255,255,0.03)' },
          ticks: { color: '#4A5568', font: { size: 10, family: "'IBM Plex Mono'" }, callback: v => v + '%' },
          min: 80, max: 100,
        }
      }
    }
  });
}

function renderDeptChart(depts) {
  const ctx = document.getElementById('chart-dept');
  if (!ctx) return;
  if (chartDept) chartDept.destroy();

  // Signal semantics: ENG=green(clear), ST=amber(caution), OHE=steel(neutral)
  const DEPT_COLORS = { ENG: '#3F9B6F', ST: '#E0A02E', OHE: '#5B7A9C' };

  chartDept = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: depts.map(d => d.name),
      datasets: [
        {
          label: 'Total',
          data: depts.map(d => d.total_tasks),
          backgroundColor: depts.map(d => (DEPT_COLORS[d.code] || '#5B7A9C') + 'BB'),
          borderRadius: 3,
          borderSkipped: false,
        },
        {
          label: 'Critical',
          data: depts.map(d => d.critical_tasks),
          backgroundColor: 'rgba(214,69,69,0.55)',
          borderRadius: 3,
          borderSkipped: false,
        },
        {
          label: 'Overdue',
          data: depts.map(d => d.overdue_tasks),
          backgroundColor: 'rgba(224,160,46,0.55)',
          borderRadius: 3,
          borderSkipped: false,
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#7A8899', font: { size: 10 }, boxWidth: 10 } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#4A5568', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#4A5568', font: { size: 10, family: "'IBM Plex Mono'" } } }
      }
    }
  });
}

function renderSectionsTable(sections) {
  const tbody = document.getElementById('sections-tbody');
  if (!sections || sections.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:2rem">No section data</td></tr>';
    return;
  }
  tbody.innerHTML = sections.map(s => {
    const level = s.criticality_level || 0;
    const pips = [1,2,3,4,5].map(i =>
      `<div class="criticality-pip ${i <= level ? 'filled' : ''}" style="--c-color:${critColor(level)}"></div>`
    ).join('');
    return `
      <tr>
        <td><span class="mono text-rail">${esc(s.section_code)}</span></td>
        <td>${esc(s.section_name)}</td>
        <td>
          <div class="criticality-bar" title="Level ${level}/5">${pips}</div>
        </td>
        <td><span class="badge ${s.pending_tasks > 0 ? 'badge-blue' : 'badge-ghost'}">${s.pending_tasks}</span></td>
        <td><span class="badge ${s.overdue_tasks > 0 ? 'badge-red' : 'badge-ghost'}">${s.overdue_tasks}</span></td>
      </tr>
    `;
  }).join('');
}

function critColor(level) {
  if (level >= 5) return '#EF4444';
  if (level >= 4) return '#F97316';
  if (level >= 3) return '#F59E0B';
  if (level >= 2) return '#3B82F6';
  return '#10B981';
}


/* ══════════════════════════════════════════════════════════════
   4. BLOCK PLANNER PAGE
   ══════════════════════════════════════════════════════════════ */
let chartGantt = null;

function loadPlannerPage() {
  loadPlanHistory();
  // Set default dates
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const startEl = document.getElementById('plan-start');
  const endEl   = document.getElementById('plan-end');
  const valDate = document.getElementById('val-date');
  if (!startEl.value) startEl.value = toISODate(today);
  if (!endEl.value)   endEl.value   = toISODate(nextWeek);
  if (!valDate.value) valDate.value = toISODate(today);

  // Density slider label
  document.getElementById('plan-density').addEventListener('input', e => {
    document.getElementById('density-label').textContent = parseFloat(e.target.value).toFixed(1) + '×';
  });
}

async function generatePlan() {
  const startDate = document.getElementById('plan-start').value;
  const endDate   = document.getElementById('plan-end').value;
  const horizon   = document.getElementById('plan-horizon').value;
  const density   = parseFloat(document.getElementById('plan-density').value);
  const engOn  = document.getElementById('dept-eng').checked;
  const stOn   = document.getElementById('dept-st').checked;
  const oheOn  = document.getElementById('dept-ohe').checked;

  if (!startDate || !endDate) { showToast('danger', 'Validation Error', 'Please select both start and end dates.'); return; }
  if (startDate > endDate)    { showToast('danger', 'Validation Error', 'Start date must be before end date.'); return; }

  const deptCodes = [];
  if (engOn) deptCodes.push('ENG');
  if (stOn)  deptCodes.push('ST');
  if (oheOn) deptCodes.push('OHE');

  setButtonLoading('btn-generate', true);
  show('planner-empty', false);
  show('planner-results', false);

  try {
    const body = {
      start_date: startDate,
      end_date:   endDate,
      horizon,
      train_density_multiplier: density,
      dept_codes: deptCodes.length > 0 ? deptCodes : null,
    };
    const data = await apiFetch('/api/plan/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    renderPlanResults(data);
    showToast('success', 'Plan Generated', `Run ${data.run_id}: ${data.total_blocks} blocks scheduled across ${data.total_tasks_scheduled} tasks.`);
    loadPlanHistory();
  } catch (e) {
    showToast('danger', 'Optimizer Error', e.message);
    show('planner-empty', true);
  } finally {
    setButtonLoading('btn-generate', false);
  }
}

function renderPlanResults(data) {
  // Stats
  show('plan-stats-row', true);
  show('plan-run-badge', true);
  setText('stat-blocks',    data.total_blocks);
  setText('stat-joint',     data.joint_blocks);
  setText('stat-scheduled', data.total_tasks_scheduled);
  setText('stat-dropped',   data.tasks_dropped);
  setText('stat-eff',       data.avg_efficiency + '%');
  setText('stat-avail',     data.asset_availability_pct + '%');

  // Show results container
  const resEl = document.getElementById('planner-results');
  resEl.style.display = 'flex';
  resEl.classList.remove('hidden');
  show('planner-empty', false);

  // Gantt
  renderGanttChart(data.blocks);

  // Explanations
  renderExplanations(data.blocks);

  lucide.createIcons();
}

function renderGanttChart(blocks) {
  const ctx = document.getElementById('chart-gantt');
  if (!ctx) return;
  if (chartGantt) chartGantt.destroy();

  // Group by section
  const sections = [...new Set(blocks.map(b => b.section_code))];
  const colors = ['#2563EB','#10B981','#F59E0B','#EF4444','#7C3AED','#0D9488','#F97316','#8B5CF6'];

  const datasets = blocks.map((b, i) => {
    const yIdx = sections.indexOf(b.section_code);
    const [sh, sm] = b.start_time.split(':').map(Number);
    const [eh, em] = b.end_time.split(':').map(Number);
    const color = b.is_joint_block ? '#7C3AED' : colors[i % colors.length];
    return {
      label: `${b.section_code}${b.is_joint_block ? ' ⚡JOINT' : ''}`,
      data: [{ x: [sh * 60 + sm, eh * 60 + em], y: b.section_code }],
      backgroundColor: color + 'CC',
      borderColor: color,
      borderWidth: 1,
      borderRadius: 4,
      borderSkipped: false,
    };
  });

  chartGantt = new Chart(ctx, {
    type: 'bar',
    data: { datasets },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => {
              const b = blocks[items[0].datasetIndex];
              return `${b.section_code}${b.is_joint_block ? ' [JOINT]' : ''}`;
            },
            label: items => {
              const b = blocks[items[0].datasetIndex];
              return [
                `Time: ${b.start_time} – ${b.end_time}`,
                `Duration: ${b.duration_minutes} min`,
                `Depts: ${b.departments_involved.join(', ')}`,
                `Efficiency: ${b.efficiency_score}%`,
              ];
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          min: 0, max: 1440,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#4B5A72',
            font: { size: 10 },
            stepSize: 120,
            callback: v => {
              const h = Math.floor(v / 60);
              return `${String(h).padStart(2,'0')}:00`;
            }
          }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#8B9AB3', font: { size: 10, family: "'JetBrains Mono'" } }
        }
      }
    }
  });
}

function renderExplanations(blocks) {
  const container = document.getElementById('explanations-list');
  if (!blocks || blocks.length === 0) { container.innerHTML = ''; return; }

  container.innerHTML = blocks.slice(0, 8).map(b => `
    <div class="explanation-card ${b.is_joint_block ? 'joint' : ''}">
      <div class="explanation-card-icon">
        <i data-lucide="${b.is_joint_block ? 'git-merge' : 'brain-circuit'}"></i>
      </div>
      <div class="explanation-card-body">
        <div class="explanation-card-section">
          <span class="mono">${esc(b.section_code)}</span>
          ${b.is_joint_block ? '<span class="badge badge-violet">Joint Block</span>' : ''}
          <span class="badge badge-ghost">${esc(b.start_time)} – ${esc(b.end_time)}</span>
        </div>
        <div>${esc(b.why_explanation || 'Optimizer selected this slot for maximum priority coverage.')}</div>
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

async function loadPlanHistory() {
  try {
    const data = await apiFetch('/api/plan/history?limit=20');
    const container = document.getElementById('history-list');
    if (!data.blocks || data.blocks.length === 0) {
      container.innerHTML = '<div class="text-center text-muted" style="padding:2rem;font-size:0.8rem">No plan history found. Generate your first plan above.</div>';
      return;
    }
    container.innerHTML = data.blocks.map(b => `
      <div class="history-item">
        <div class="history-run-id">${esc(b.run_id || '—')}</div>
        <div class="history-meta">
          <div class="history-date">${esc(b.schedule_date)} · Section <span class="mono">${b.section_id}</span></div>
          <div class="history-detail">${esc(b.start_time)} – ${esc(b.end_time)} · ${b.duration_minutes} min · Eff: ${b.efficiency_score}%</div>
        </div>
        <span class="badge ${b.is_joint_block ? 'badge-violet' : 'badge-blue'}">${b.is_joint_block ? 'Joint' : 'Single'}</span>
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('history-list').innerHTML = `<div class="text-center text-muted" style="padding:2rem;font-size:0.8rem">Could not load history: ${esc(e.message)}</div>`;
  }
}

async function validateBlock() {
  const startTime = document.getElementById('val-start').value;
  const endTime   = document.getElementById('val-end').value;
  const sectionId = parseInt(document.getElementById('val-section').value);
  const date      = document.getElementById('val-date').value;

  if (!startTime || !endTime || !sectionId || !date) {
    showToast('danger', 'Validation', 'Please fill all fields for validation.'); return;
  }

  try {
    const data = await apiFetch('/api/plan/validate', {
      method: 'POST',
      body: JSON.stringify({ start_time: startTime, end_time: endTime, section_id: sectionId, date }),
    });

    const el = document.getElementById('validate-result');
    el.className = `validate-result ${data.valid ? 'valid' : 'invalid'}`;
    el.classList.remove('hidden');

    if (data.valid) {
      el.innerHTML = `<i data-lucide="check-circle-2"></i><div><strong>Clear for Manual Block</strong><br><span class="text-xs">${esc(data.message)}</span></div>`;
    } else {
      el.innerHTML = `<i data-lucide="alert-triangle"></i><div><strong>Conflict Detected</strong><br><span class="text-xs">${esc(data.message)}</span></div>`;
    }
    lucide.createIcons();
  } catch (e) {
    showToast('danger', 'Validate Error', e.message);
  }
}


/* ══════════════════════════════════════════════════════════════
   5. MAINTENANCE TASKS PAGE
   ══════════════════════════════════════════════════════════════ */
let tasksCurrentPage = 0;
const TASKS_LIMIT = 50;

async function loadTasks() {
  const dept   = document.getElementById('tasks-dept').value;
  const status = document.getElementById('tasks-status').value;
  const sev    = document.getElementById('tasks-severity').value;
  const crit   = document.getElementById('tasks-critical').checked;

  let url = `/api/tasks/?min_severity=${sev}&limit=${TASKS_LIMIT}&skip=${tasksCurrentPage * TASKS_LIMIT}`;
  if (dept)   url += `&dept_code=${dept}`;
  if (status) url += `&status=${status}`;
  if (crit)   url += `&critical_only=true`;

  const tbody = document.getElementById('tasks-tbody');
  tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted" style="padding:1.5rem">Loading…</td></tr>';

  try {
    const data = await apiFetch(url);
    renderTasksTable(data.tasks);
    setText('tasks-count', `${data.total} tasks total · showing ${tasksCurrentPage * TASKS_LIMIT + 1}–${Math.min((tasksCurrentPage + 1) * TASKS_LIMIT, data.total)}`);
    setText('tasks-page-label', `Page ${tasksCurrentPage + 1}`);
    document.getElementById('tasks-prev').disabled = tasksCurrentPage === 0;
    document.getElementById('tasks-next').disabled = (tasksCurrentPage + 1) * TASKS_LIMIT >= data.total;
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger" style="padding:1.5rem">${esc(e.message)}</td></tr>`;
  }
}

function tasksPage(dir) {
  tasksCurrentPage = Math.max(0, tasksCurrentPage + dir);
  loadTasks();
}

function renderTasksTable(tasks) {
  const tbody = document.getElementById('tasks-tbody');
  if (!tasks || tasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted" style="padding:2rem">No tasks found for the selected filters.</td></tr>';
    return;
  }

  tbody.innerHTML = tasks.map(t => {
    const score = t.priority_score || 0;
    const scoreColor = score >= 75 ? '#EF4444' : score >= 50 ? '#F59E0B' : '#10B981';
    const deptCode = t.department?.code || '—';
    const statusBadge = statusToBadge(t.status);
    return `
      <tr onclick="openTaskModal(${t.id})">
        <td><span class="mono text-rail">${esc(t.task_code)}</span></td>
        <td class="text-xs text-secondary">${esc(formatTaskType(t.task_type))}</td>
        <td><span class="badge ${deptTagClass(deptCode)}">${esc(deptCode)}</span></td>
        <td class="text-xs">${esc(t.section?.name || '—')}</td>
        <td>${severityPips(t.severity)}</td>
        <td>
          <div class="score-bar-wrap">
            <div class="score-bar"><div class="score-bar-fill" style="width:${score}%;background:${scoreColor}"></div></div>
            <span class="score-label">${score.toFixed(1)}</span>
          </div>
        </td>
        <td>${statusBadge}</td>
        <td class="text-xs mono text-muted">${esc(t.due_date || '—')}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openTaskModal(${t.id})" title="SHAP Explanation">
            <i data-lucide="info"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
  lucide.createIcons();
}

async function openTaskModal(taskId) {
  try {
    const [task, explain] = await Promise.all([
      apiFetch(`/api/tasks/${taskId}`),
      apiFetch(`/api/tasks/explain/${taskId}`),
    ]);

    document.getElementById('modal-title').textContent = task.task_code;
    document.getElementById('modal-subtitle').textContent = `${task.department?.name || ''} · ${task.section?.name || ''}`;

    const shap = explain.shap_explanation || {};
    const shapItems = Object.entries(shap).map(([k, v]) => {
      const abs = Math.abs(v);
      const maxV = Math.max(...Object.values(shap).map(Math.abs), 1);
      const pct = (abs / maxV * 100).toFixed(1);
      const neg = v < 0;
      return `
        <div class="shap-row">
          <span class="shap-feature">${esc(formatFeatureName(k))}</span>
          <div class="shap-bar-track">
            <div class="shap-bar-fill ${neg ? 'neg' : ''}" style="width:${pct}%"></div>
          </div>
          <span class="shap-value">${v > 0 ? '+' : ''}${Number(v).toFixed(3)}</span>
        </div>
      `;
    }).join('');

    document.getElementById('modal-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:1.25rem;">
        ${modalField('Task Type', formatTaskType(task.task_type))}
        ${modalField('Severity', severityPips(task.severity))}
        ${modalField('Status', statusToBadge(task.status))}
        ${modalField('Priority Score', `<span class="font-space fw-700" style="font-size:1.3rem;color:${task.priority_score >= 75 ? '#EF4444' : task.priority_score >= 50 ? '#F59E0B' : '#10B981'}">${(task.priority_score || 0).toFixed(2)}</span>`)}
        ${modalField('Due Date', task.due_date || '—')}
        ${modalField('Days Overdue', task.days_overdue || 0)}
        ${modalField('Duration', `${task.duration_minutes} min`)}
        ${modalField('OHE Disconnection', task.requires_ohe_disconnection ? '<span class="badge badge-red">Required</span>' : '<span class="badge badge-ghost">No</span>')}
        ${modalField('Safety Critical', task.safety_critical ? '<span class="badge badge-critical">YES</span>' : '<span class="badge badge-ghost">No</span>')}
        ${modalField('Line Block', task.requires_line_block ? '<span class="badge badge-amber">Required</span>' : '<span class="badge badge-ghost">No</span>')}
      </div>
      ${task.description ? `<div class="divider"></div><p class="text-xs text-secondary" style="margin-bottom:1rem">${esc(task.description)}</p>` : ''}
      <div class="divider"></div>
      <div style="margin-bottom:0.5rem;display:flex;align-items:center;gap:0.5rem;">
        <i data-lucide="brain-circuit" style="width:14px;height:14px;color:var(--accent-violet)"></i>
        <span class="text-sm fw-700">SHAP Priority Breakdown</span>
        <span class="badge badge-violet">XGBoost V2</span>
      </div>
      <div class="shap-list">${shapItems || '<p class="text-xs text-muted">No SHAP data available.</p>'}</div>
    `;

    document.getElementById('modal-overlay').classList.add('open');
    lucide.createIcons();
  } catch (e) {
    showToast('danger', 'Task Detail Error', e.message);
  }
}

function modalField(label, value) {
  return `
    <div style="display:flex;flex-direction:column;gap:3px;">
      <span style="font-size:0.65rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted)">${esc(label)}</span>
      <span style="font-size:0.8125rem;color:var(--text-primary)">${value}</span>
    </div>
  `;
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.remove('open');
}

async function scoreAllTasks() {
  try {
    const data = await apiFetch('/api/tasks/score-all', { method: 'POST' });
    showToast('success', 'Re-scored', `${data.updated} tasks re-scored using XGBoost V2 engine.`);
    loadTasks();
  } catch (e) {
    showToast('danger', 'Score Error', e.message);
  }
}


/* ══════════════════════════════════════════════════════════════
   6. TMS PAGE
   ══════════════════════════════════════════════════════════════ */
async function loadTmsPage() {
  const sev  = document.getElementById('tms-severity').value;
  const crit = document.getElementById('tms-critical').checked;
  let url = `/api/tms/tasks?min_severity=${sev}&limit=100`;
  if (crit) url += '&critical_only=true';
  await loadSourceTable('tms-tbody', url, 'tms', 7);
}


/* ══════════════════════════════════════════════════════════════
   7. SMMS PAGE
   ══════════════════════════════════════════════════════════════ */
async function loadSmmsPage() {
  const sev  = document.getElementById('smms-severity').value;
  const crit = document.getElementById('smms-critical').checked;
  let url = `/api/smms/tasks?min_severity=${sev}&limit=100`;
  if (crit) url += '&critical_only=true';
  await loadSourceTable('smms-tbody', url, 'smms', 7);
}


/* ══════════════════════════════════════════════════════════════
   8. TDMS PAGE
   ══════════════════════════════════════════════════════════════ */
async function loadTdmsPage() {
  const sev = document.getElementById('tdms-severity').value;
  const ohe = document.getElementById('tdms-ohe').checked;
  let url = `/api/tdms/tasks?min_severity=${sev}&limit=100`;
  if (ohe) url += '&ohe_disconnection_only=true';
  await loadSourceTable('tdms-tbody', url, 'tdms', 7);
}

async function simulateFault() {
  const btn = document.getElementById('btn-fault');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-spinner" style="display:inline-block;border-top-color:var(--accent-danger)"></span> Simulating…';

  try {
    const data = await apiFetch('/api/tdms/simulate-fault', { method: 'POST' });

    // Show dramatic fault toast
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast toast-fault';
    toast.innerHTML = `
      <div class="toast-icon" style="background:rgba(239,68,68,0.2);width:40px;height:40px">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <div class="toast-body">
        <div class="toast-title" style="color:#EF4444;font-size:0.875rem">🔴 LIVE OHE FAULT DETECTED</div>
        <div class="toast-msg">
          <strong>${esc(data.task_code)}</strong> · ${esc(data.section)}<br>
          AI Priority Score: <strong style="color:#EF4444">${Number(data.ai_priority_score || 0).toFixed(2)}</strong> · Cantilever failure — urgent repair
        </div>
      </div>
      <button class="toast-close" onclick="this.closest('.toast').remove()">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 10000);

    // Reload table
    loadTdmsPage();
  } catch (e) {
    showToast('danger', 'Fault Simulation Error', e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="alert-octagon"></i> Simulate Live OHE Fault';
    lucide.createIcons();
  }
}


/* ══════════════════════════════════════════════════════════════
   9. COA PAGE
   ══════════════════════════════════════════════════════════════ */
let chartTimespace = null;

async function loadCoaTrains() {
  const sectionId = document.getElementById('coa-section').value;
  const date      = document.getElementById('coa-date').value;
  let url = '/api/coa/trains?limit=200';
  if (sectionId) url += `&section_id=${sectionId}`;
  if (date)      url += `&schedule_date=${date}`;

  const tbody = document.getElementById('coa-trains-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Loading…</td></tr>';

  try {
    const trains = await apiFetch(url);
    if (!trains || trains.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding:1.5rem">No trains found for the given filter.</td></tr>';
      return;
    }
    tbody.innerHTML = trains.map(t => `
      <tr>
        <td class="mono text-rail">${esc(t.train_no)}</td>
        <td class="text-xs">${esc(t.train_name || '—')}</td>
        <td class="mono">${esc(t.entry_time)}</td>
        <td class="mono">${esc(t.exit_time)}</td>
        <td class="text-xs text-secondary">${t.section_id}</td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger" style="padding:1.5rem">${esc(e.message)}</td></tr>`;
  }
}

async function loadCoaWindows() {
  const sectionId = document.getElementById('coa-win-section').value;
  let url = '/api/coa/windows?available_only=true&limit=50';
  if (sectionId) url += `&section_id=${sectionId}`;

  const list = document.getElementById('windows-list');
  list.innerHTML = '<div class="text-center text-muted" style="padding:1rem;font-size:0.8rem">Loading…</div>';

  try {
    const windows = await apiFetch(url);
    if (!windows || windows.length === 0) {
      list.innerHTML = '<div class="empty-state" style="padding:2rem"><i data-lucide="clock"></i><p>No available windows found.</p></div>';
      lucide.createIcons();
      return;
    }
    list.innerHTML = windows.map(w => `
      <div class="window-item">
        <div class="window-time">${esc(w.start_time)} – ${esc(w.end_time)}</div>
        <div class="window-duration">${w.duration_minutes} min available</div>
        <span class="badge badge-green">Available</span>
        <span class="mono text-xs text-muted">${esc(w.schedule_date)}</span>
      </div>
    `).join('');
    lucide.createIcons();
  } catch (e) {
    list.innerHTML = `<div class="text-center text-danger" style="padding:1rem;font-size:0.8rem">${esc(e.message)}</div>`;
  }
}

async function loadTimespace() {
  const section = document.getElementById('tsd-section').value.trim();
  if (!section) { showToast('danger', 'Input Required', 'Please enter a section code.'); return; }

  const emptyEl = document.getElementById('tsd-empty');
  emptyEl.classList.add('hidden');

  try {
    const data = await apiFetch(`/api/visualization/time-space?section=${encodeURIComponent(section)}`);
    renderTimespaceChart(data, section);
  } catch (e) {
    showToast('danger', 'Time-Space Error', e.message);
    emptyEl.classList.remove('hidden');
  }
}

function renderTimespaceChart(data, section) {
  const ctx = document.getElementById('chart-timespace');
  if (!ctx) return;
  if (chartTimespace) chartTimespace.destroy();

  const trainDatasets = (data.trains || []).slice(0, 20).map((train, i) => {
    const hue = (i * 37) % 360;
    return {
      label: `Train ${train.train_number}`,
      data: (train.points || []).map((p, idx) => ({ x: p.minute, y: idx })),
      borderColor: `hsl(${hue},70%,55%)`,
      backgroundColor: 'transparent',
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 1.5,
      showLine: true,
      tension: 0.1,
    };
  });

  // Add maintenance blocks as shaded datasets
  const blockDatasets = (data.blocks || []).map(b => ({
    label: `Maintenance Block`,
    data: [
      { x: b.start_minute, y: -0.5 },
      { x: b.end_minute, y: -0.5 },
    ],
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 2,
    showLine: true,
    fill: false,
    pointRadius: 0,
  }));

  chartTimespace = new Chart(ctx, {
    type: 'scatter',
    data: { datasets: [...trainDatasets, ...blockDatasets] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#8B9AB3', font: { size: 9 }, boxWidth: 10 } },
        title: {
          display: true,
          text: `Time-Space Diagram — Section: ${section}`,
          color: '#8B9AB3',
          font: { size: 11 },
        }
      },
      scales: {
        x: {
          type: 'linear',
          min: 0, max: 1440,
          title: { display: true, text: 'Time (minutes from midnight)', color: '#4B5A72', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#4B5A72',
            font: { size: 9 },
            stepSize: 120,
            callback: v => `${String(Math.floor(v / 60)).padStart(2,'0')}:00`,
          }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#4B5A72', font: { size: 9 } },
          title: { display: true, text: 'Station sequence', color: '#4B5A72', font: { size: 10 } },
        }
      }
    }
  });
}


/* ══════════════════════════════════════════════════════════════
   10. SHARED SOURCE TABLE RENDERER
   ══════════════════════════════════════════════════════════════ */
async function loadSourceTable(tbodyId, url, dept, cols) {
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = `<tr><td colspan="${cols}" class="text-center text-muted" style="padding:1.5rem">Loading…</td></tr>`;
  try {
    const data = await apiFetch(url);
    if (!data.tasks || data.tasks.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${cols}" class="text-center text-muted" style="padding:2rem">No tasks found.</td></tr>`;
      return;
    }
    if (dept === 'tdms') {
      tbody.innerHTML = data.tasks.map(t => {
        const score = t.priority_score || 0;
        const scoreColor = score >= 75 ? '#EF4444' : score >= 50 ? '#F59E0B' : '#10B981';
        return `
          <tr>
            <td class="mono text-teal">${esc(t.task_code)}</td>
            <td class="text-xs text-secondary">${esc(formatTaskType(t.task_type))}</td>
            <td class="text-xs">${esc(t.section?.name || '—')}</td>
            <td>${severityPips(t.severity)}</td>
            <td>
              <div class="score-bar-wrap">
                <div class="score-bar"><div class="score-bar-fill" style="width:${score}%;background:${scoreColor}"></div></div>
                <span class="score-label">${score.toFixed(1)}</span>
              </div>
            </td>
            <td>${statusToBadge(t.status)}</td>
            <td>${t.requires_ohe_disconnection ? '<span class="badge badge-red">Yes</span>' : '<span class="badge badge-ghost">No</span>'}</td>
          </tr>
        `;
      }).join('');
    } else {
      const textColor = dept === 'tms' ? 'text-safe' : 'text-warn';
      tbody.innerHTML = data.tasks.map(t => {
        const score = t.priority_score || 0;
        const scoreColor = score >= 75 ? '#EF4444' : score >= 50 ? '#F59E0B' : '#10B981';
        return `
          <tr>
            <td class="mono ${textColor}">${esc(t.task_code)}</td>
            <td class="text-xs text-secondary">${esc(formatTaskType(t.task_type))}</td>
            <td class="text-xs">${esc(t.section?.name || '—')}</td>
            <td>${severityPips(t.severity)}</td>
            <td>
              <div class="score-bar-wrap">
                <div class="score-bar"><div class="score-bar-fill" style="width:${score}%;background:${scoreColor}"></div></div>
                <span class="score-label">${score.toFixed(1)}</span>
              </div>
            </td>
            <td>${statusToBadge(t.status)}</td>
            <td class="mono text-xs text-muted">${t.days_overdue > 0 ? `<span class="text-warn">${t.days_overdue}d</span>` : '—'}</td>
          </tr>
        `;
      }).join('');
    }
    lucide.createIcons();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="${cols}" class="text-center text-danger" style="padding:1.5rem">${esc(e.message)}</td></tr>`;
  }
}


/* ══════════════════════════════════════════════════════════════
   11. TOAST SYSTEM
   ══════════════════════════════════════════════════════════════ */
function showToast(type, title, message, duration = 5000) {
  const icons = {
    success: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
    danger:  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info:    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  };

  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-body">
      <div class="toast-title">${esc(title)}</div>
      <div class="toast-msg">${esc(message)}</div>
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  container.appendChild(toast);
  if (duration > 0) setTimeout(() => toast.remove(), duration);
}


/* ══════════════════════════════════════════════════════════════
   12. HELPERS / FORMATTERS
   ══════════════════════════════════════════════════════════════ */
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function show(id, visible) {
  const el = document.getElementById(id);
  if (!el) return;
  if (visible) el.classList.remove('hidden');
  else el.classList.add('hidden');
}

function toISODate(d) {
  return d.toISOString().split('T')[0];
}

function setButtonLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const spinner = btn.querySelector('.btn-spinner');
  const icon    = btn.querySelector('[data-lucide]');
  btn.disabled  = loading;
  if (spinner) spinner.style.display = loading ? 'inline-block' : 'none';
  if (icon)    icon.style.display    = loading ? 'none' : '';
  const textEl = document.getElementById('gen-text');
  if (textEl) textEl.textContent = loading ? 'Optimizing…' : 'Run OR-Tools Optimizer';
}

function statusToBadge(status) {
  const map = {
    PENDING:   '<span class="badge badge-steel">Pending</span>',
    OVERDUE:   '<span class="badge badge-red">Overdue</span>',
    SCHEDULED: '<span class="badge badge-green">Scheduled</span>',
    COMPLETED: '<span class="badge badge-ghost">Completed</span>',
  };
  return map[status] || `<span class="badge badge-ghost">${esc(status)}</span>`;
}

function severityPips(level) {
  level = parseInt(level) || 0;
  // Signal palette: 1=green, 2=steel, 3=amber, 4=amber, 5=red
  const colors = ['', '#3F9B6F', '#5B7A9C', '#E0A02E', '#E0A02E', '#D64545'];
  return [1,2,3,4,5].map(i =>
    `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${i<=level ? colors[Math.min(level,5)] : 'var(--bg-elevated)'};margin-right:2px;"></span>`
  ).join('') + `<span style="font-family:'IBM Plex Mono',monospace;font-size:0.7rem;color:var(--text-muted);margin-left:4px">${level}/5</span>`;
}

function formatTaskType(type) {
  if (!type) return '—';
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function formatFeatureName(key) {
  const map = {
    severity:                'Fault Severity',
    days_overdue:            'Days Overdue',
    train_density:           'Train Density',
    asset_criticality:       'Asset Criticality',
    is_safety_critical:      'Safety Critical',
    requires_ohe_disconnection: 'OHE Disconnection',
    duration_minutes:        'Task Duration',
  };
  return map[key] || key.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
}

function deptTagClass(code) {
  // Use signal semantics: ENG=green(clear), ST=amber(caution), OHE=steel(neutral)
  const map = { ENG: 'badge badge-green', ST: 'badge badge-amber', OHE: 'badge badge-steel' };
  return map[code] || 'badge badge-ghost';
}

/* Chart.js global defaults — railway signal palette */
Chart.defaults.color = '#7A8899';
Chart.defaults.font.family = "'IBM Plex Sans', sans-serif";
Chart.defaults.font.size = 11;


/* ══════════════════════════════════════════════════════════════
   13. INIT
   ══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Init Lucide icons
  lucide.createIcons();

  // Check backend
  checkBackendHealth();
  setInterval(checkBackendHealth, 30000);

  // Load initial dashboard
  loadDashboard();

  // Close modal on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('modal-overlay').classList.remove('open');
  });
});

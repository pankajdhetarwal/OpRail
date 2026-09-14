// OpRail Dashboard Logic
// Initializes lucide icons and fetches data from the FastAPI backend

document.addEventListener('DOMContentLoaded', () => {
    // Initialize icons
    lucide.createIcons();

    // Default dates (today to tomorrow)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    document.getElementById('plan-start').valueAsDate = today;
    document.getElementById('plan-end').valueAsDate = tomorrow;

    // Load initial data
    fetchDashboardKPIs();
    fetchTopTasks();

    // Event Listeners
    document.getElementById('refresh-btn').addEventListener('click', () => {
        fetchDashboardKPIs();
        fetchTopTasks();
    });

    document.getElementById('btn-generate').addEventListener('click', generatePlan);
});

// --- API Calls ---

async function fetchDashboardKPIs() {
    try {
        const response = await fetch('/api/dashboard/');
        const data = await response.json();
        
        document.getElementById('kpi-availability').textContent = `${data.asset_availability_pct}%`;
        document.getElementById('kpi-total-tasks').textContent = data.total_tasks;
        document.getElementById('kpi-critical').textContent = data.critical_tasks;
        document.getElementById('kpi-joint').textContent = data.joint_blocks_today;
        
    } catch (error) {
        console.error("Error fetching KPIs:", error);
    }
}

async function fetchTopTasks() {
    try {
        // Fetch top 5 pending/overdue tasks sorted by priority
        const response = await fetch('/api/tasks/?limit=6&status=PENDING');
        const data = await response.json();
        
        const tbody = document.getElementById('tasks-tbody');
        tbody.innerHTML = '';
        
        data.tasks.forEach(task => {
            const row = document.createElement('tr');
            
            // Status badge logic
            let statusBadge = `<span class="badge"><i data-lucide="clock"></i> Pending</span>`;
            if (task.days_overdue > 0) {
                statusBadge = `<span class="badge bg-red"><i data-lucide="alert-circle"></i> Overdue</span>`;
            }
            if (task.status === 'SCHEDULED') {
                statusBadge = `<span class="badge bg-green"><i data-lucide="calendar-check"></i> Scheduled</span>`;
            }

            // Type color logic
            let typeClass = 'text-blue';
            if (task.department.code === 'ENG') typeClass = 'text-amber';
            if (task.department.code === 'OHE') typeClass = 'text-green';
            
            row.innerHTML = `
                <td><strong>${task.task_code}</strong></td>
                <td><span class="${typeClass}">${task.task_type.replace(/_/g, ' ').toUpperCase()}</span></td>
                <td><strong>${task.priority_score.toFixed(1)}</strong></td>
                <td>${statusBadge}</td>
            `;
            tbody.appendChild(row);
        });
        
        lucide.createIcons();
    } catch (error) {
        console.error("Error fetching tasks:", error);
    }
}

async function generatePlan() {
    const btn = document.getElementById('btn-generate');
    btn.innerHTML = `<i data-lucide="loader" class="spin"></i> Optimizing Schedule...`;
    btn.disabled = true;
    lucide.createIcons();

    const start = document.getElementById('plan-start').value;
    const end = document.getElementById('plan-end').value;

    try {
        const response = await fetch('/api/plan/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ start_date: start, end_date: end })
        });
        
        const data = await response.json();
        
        // Update UI state
        document.getElementById('empty-state').classList.add('hidden');
        document.getElementById('results-container').classList.remove('hidden');
        document.getElementById('plan-stats').classList.remove('hidden');
        
        document.getElementById('plan-stats').innerHTML = `
            <span class="badge bg-green"><i data-lucide="check-circle"></i> Generated in 1.2s</span>
            <span class="badge bg-blue"><i data-lucide="layers"></i> ${data.total_blocks} Blocks</span>
            <span class="badge bg-purple"><i data-lucide="git-merge"></i> ${data.joint_blocks} Joint</span>
        `;
        
        renderGanttChart(data.blocks);
        renderExplanations(data.blocks);
        
        // Refresh tasks table to show 'Scheduled'
        fetchTopTasks();
        fetchDashboardKPIs();

    } catch (error) {
        console.error("Error generating plan:", error);
        alert("Failed to generate plan. Check console.");
    } finally {
        btn.innerHTML = `<i data-lucide="cpu"></i> Run OR-Tools Optimizer`;
        btn.disabled = false;
        lucide.createIcons();
    }
}

// --- Chart.js Gantt Implementation ---
let ganttChartInstance = null;

function renderGanttChart(blocks) {
    const ctx = document.getElementById('ganttChart').getContext('2d');
    
    if (ganttChartInstance) {
        ganttChartInstance.destroy();
    }

    // Process blocks for Chart.js
    // Chart.js floating bar chart expects data like: { x: [start_time, end_time], y: section }
    
    // Create a unique list of sections (Y axis)
    const sections = [...new Set(blocks.map(b => b.section_name))];
    
    const datasets = [];
    
    // We'll create a dataset for each department to color code
    const depts = [
        { code: 'ENG', color: 'rgba(245, 158, 11, 0.8)', border: 'rgba(245, 158, 11, 1)' },
        { code: 'ST', color: 'rgba(59, 130, 246, 0.8)', border: 'rgba(59, 130, 246, 1)' },
        { code: 'OHE', color: 'rgba(16, 185, 129, 0.8)', border: 'rgba(16, 185, 129, 1)' },
        { code: 'JOINT', color: 'rgba(139, 92, 246, 0.8)', border: 'rgba(139, 92, 246, 1)' }
    ];

    depts.forEach(dept => {
        const dataPoints = [];
        
        blocks.forEach(b => {
            const isJoint = b.is_joint_block;
            let belongs = false;
            
            if (isJoint && dept.code === 'JOINT') belongs = true;
            else if (!isJoint && b.departments_involved.includes(dept.code)) belongs = true;
            
            if (belongs) {
                // Convert HH:MM to dummy Date objects for X axis
                const datePrefix = "2026-01-01T"; // arbitrary day just for plotting time
                const start = new Date(`${datePrefix}${b.start_time}:00`);
                const end = new Date(`${datePrefix}${b.end_time}:00`);
                
                // If end is < start, it crossed midnight.
                if (end < start) end.setDate(end.getDate() + 1);

                dataPoints.push({
                    x: [start.getTime(), end.getTime()],
                    y: b.section_name,
                    blockData: b // save for tooltip
                });
            }
        });

        if (dataPoints.length > 0) {
            datasets.push({
                label: dept.code === 'JOINT' ? 'Joint Block' : `${dept.code} Block`,
                data: dataPoints,
                backgroundColor: dept.color,
                borderColor: dept.border,
                borderWidth: 1,
                borderSkipped: false,
                barPercentage: 0.5
            });
        }
    });

    ganttChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sections,
            datasets: datasets
        },
        options: {
            indexAxis: 'y', // Horizontal bar chart
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const b = context.raw.blockData;
                            let label = `${b.start_time} - ${b.end_time}`;
                            label += ` | Tasks: ${b.task_ids.length}`;
                            label += ` | Eff: ${b.efficiency_score}%`;
                            return label;
                        }
                    }
                },
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8' }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'hour',
                        displayFormats: { hour: 'HH:mm' }
                    },
                    min: new Date("2026-01-01T00:00:00").getTime(),
                    max: new Date("2026-01-02T06:00:00").getTime(),
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#f8fafc' }
                }
            }
        }
    });
}

function renderExplanations(blocks) {
    const container = document.getElementById('explanation-list');
    container.innerHTML = '';
    
    // Sort blocks by priority and take top 5
    const topBlocks = blocks.sort((a,b) => b.total_priority_score - a.total_priority_score).slice(0, 5);
    
    topBlocks.forEach(b => {
        const div = document.createElement('div');
        div.className = `explanation-card ${b.is_joint_block ? 'joint' : ''}`;
        
        let typeHtml = b.is_joint_block 
            ? `<span class="badge bg-purple"><i data-lucide="git-merge"></i> Joint Block</span>`
            : `<span class="badge"><i data-lucide="tool"></i> Single Dept</span>`;

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem">
                <strong>${b.section_code} @ ${b.start_time}</strong>
                ${typeHtml}
            </div>
            <p style="color: #cbd5e1">${b.why_explanation}</p>
        `;
        container.appendChild(div);
    });
    
    lucide.createIcons();
}

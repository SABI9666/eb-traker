/**
 * Show Continue Allocation Modal for partially allocated projects
 * Allows COO to allocate remaining hours to additional designers
 */
async function showContinueAllocationModal(projectId, proposalId) {
    try {
        showLoading();
        
        // Fetch project details
        const projectResponse = await apiCall(`projects?id=${projectId}`);
        if (!projectResponse.success) {
            throw new Error('Failed to load project details');
        }
        
        const project = projectResponse.data;
        
        // Calculate allocation status
        const maxHours = parseFloat(project.maxAllocatedHours) || 0;
        const totalAllocated = parseFloat(project.totalAllocatedHours) || 0;
        const remainingToAllocate = maxHours - totalAllocated;
        const existingAllocations = project.designerAllocations || [];
        
        // Fetch available designers
        const usersResponse = await apiCall('users?role=designer,design_lead');
        if (!usersResponse.success) {
            throw new Error('Failed to load designers');
        }
        
        const designers = usersResponse.data || [];
        
        // Get already assigned designer UIDs
        const assignedUids = (project.assignedDesignerUids || []);
        
        // Create designer options (exclude already fully assigned designers)
        const designerOptions = designers.map(d => `
            <option value="${d.uid}" 
                    data-name="${d.name}" 
                    data-email="${d.email}"
                    data-role="${d.role}"
                    ${assignedUids.includes(d.uid) ? 'data-assigned="true"' : ''}>
                ${d.name} (${d.role.replace('_', ' ')}) ${assignedUids.includes(d.uid) ? '- Already Assigned' : ''}
            </option>
        `).join('');
        
        // Create existing allocations display
        const existingAllocationsHtml = existingAllocations.length > 0 ? `
            <div style="margin-bottom: 1.5rem; padding: 1rem; background: #e8f5e9; border-radius: 8px;">
                <h4 style="margin: 0 0 0.5rem 0; color: #2e7d32;">✅ Existing Allocations</h4>
                <table style="width: 100%; font-size: 0.9rem;">
                    <tr style="border-bottom: 1px solid #c8e6c9;">
                        <th style="text-align: left; padding: 0.5rem;">Designer</th>
                        <th style="text-align: center; padding: 0.5rem;">Hours</th>
                    </tr>
                    ${existingAllocations.map(a => `
                        <tr>
                            <td style="padding: 0.5rem;">${a.designerName}</td>
                            <td style="text-align: center; padding: 0.5rem;"><strong>${a.allocatedHours}h</strong></td>
                        </tr>
                    `).join('')}
                    <tr style="background: #c8e6c9; font-weight: bold;">
                        <td style="padding: 0.5rem;">Total Allocated</td>
                        <td style="text-align: center; padding: 0.5rem;">${totalAllocated}h</td>
                    </tr>
                </table>
            </div>
        ` : '';
        
        const modalHtml = `
            <div class="modal-overlay" id="continueAllocationModal" onclick="if(event.target === this) closeContinueAllocationModal()">
                <div class="modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
                    <div class="modal-header" style="background: linear-gradient(135deg, #ff9800, #f57c00); color: white;">
                        <h2>🎯 Continue Allocation - ${project.projectName}</h2>
                        <span class="close-modal" onclick="closeContinueAllocationModal()">&times;</span>
                    </div>
                    
                    <div class="modal-body" style="padding: 1.5rem;">
                        <!-- Project Info -->
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                            <div style="text-align: center; padding: 1rem; background: #e3f2fd; border-radius: 8px;">
                                <div style="font-size: 1.5rem; font-weight: bold; color: #1976d2;">${maxHours}h</div>
                                <small>Total Budget</small>
                            </div>
                            <div style="text-align: center; padding: 1rem; background: #e8f5e9; border-radius: 8px;">
                                <div style="font-size: 1.5rem; font-weight: bold; color: #388e3c;">${totalAllocated}h</div>
                                <small>Already Allocated</small>
                            </div>
                            <div style="text-align: center; padding: 1rem; background: #fff3e0; border-radius: 8px;">
                                <div style="font-size: 1.5rem; font-weight: bold; color: #f57c00;">${remainingToAllocate.toFixed(1)}h</div>
                                <small>Remaining to Allocate</small>
                            </div>
                        </div>
                        
                        ${existingAllocationsHtml}
                        
                        <!-- New Allocation Form -->
                        <div style="padding: 1rem; background: #fff8e1; border-radius: 8px; border-left: 4px solid #ff9800;">
                            <h4 style="margin: 0 0 1rem 0;">➕ Add New Allocation</h4>
                            
                            <input type="hidden" id="continueAllocProjectId" value="${projectId}">
                            <input type="hidden" id="continueAllocMaxHours" value="${maxHours}">
                            <input type="hidden" id="continueAllocCurrentTotal" value="${totalAllocated}">
                            
                            <div id="newAllocationsContainer">
                                <!-- Dynamic allocation rows will be added here -->
                            </div>
                            
                            <button type="button" onclick="addContinueAllocationRow('${designerOptions.replace(/'/g, "\\'").replace(/\n/g, '')}')" 
                                    class="btn btn-outline" style="margin-top: 1rem;">
                                ➕ Add Designer
                            </button>
                        </div>
                        
                        <!-- Allocation Summary -->
                        <div style="margin-top: 1.5rem; padding: 1rem; background: #f5f5f5; border-radius: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span><strong>New Allocation Total:</strong></span>
                                <span id="newAllocationTotal" style="font-size: 1.2rem; font-weight: bold; color: var(--primary-blue);">0h</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                <span><strong>Remaining After:</strong></span>
                                <span id="remainingAfterAllocation" style="font-size: 1.2rem; font-weight: bold; color: var(--warning);">${remainingToAllocate.toFixed(1)}h</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button type="button" onclick="closeContinueAllocationModal()" class="btn btn-outline">Cancel</button>
                        <button type="button" onclick="submitContinueAllocation()" class="btn btn-warning">
                            🎯 Allocate Remaining Hours
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Add first allocation row automatically
        addContinueAllocationRow(designerOptions.replace(/'/g, "\\'").replace(/\n/g, ''));
        
    } catch (error) {
        console.error('Error showing continue allocation modal:', error);
        alert('Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

let continueAllocationCounter = 0;

function addContinueAllocationRow(designerOptionsStr) {
    const container = document.getElementById('newAllocationsContainer');
    const rowNum = ++continueAllocationCounter;
    
    const rowHtml = `
        <div class="designer-allocation-row" id="continueAllocRow${rowNum}" style="display: grid; grid-template-columns: 2fr 1fr auto; gap: 1rem; margin-bottom: 1rem; padding: 1rem; background: white; border-radius: 8px; border: 1px solid #ddd;">
            <div>
                <label style="font-weight: 600; margin-bottom: 0.25rem; display: block;">Designer</label>
                <select id="continueDesigner${rowNum}" class="form-control continue-designer-select" onchange="updateContinueAllocationTotals()">
                    <option value="">Select Designer...</option>
                    ${designerOptionsStr}
                </select>
            </div>
            <div>
                <label style="font-weight: 600; margin-bottom: 0.25rem; display: block;">Hours</label>
                <input type="number" id="continueHours${rowNum}" class="form-control continue-hours-input" 
                       min="0.5" step="0.5" placeholder="Hours" onchange="updateContinueAllocationTotals()" oninput="updateContinueAllocationTotals()">
            </div>
            <div style="display: flex; align-items: flex-end;">
                <button type="button" onclick="removeContinueAllocationRow(${rowNum})" class="btn btn-danger btn-sm" style="padding: 0.5rem;">✕</button>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', rowHtml);
}

function removeContinueAllocationRow(rowNum) {
    const row = document.getElementById(`continueAllocRow${rowNum}`);
    if (row) {
        row.remove();
        updateContinueAllocationTotals();
    }
}

function updateContinueAllocationTotals() {
    const hoursInputs = document.querySelectorAll('.continue-hours-input');
    let newTotal = 0;
    
    hoursInputs.forEach(input => {
        newTotal += parseFloat(input.value) || 0;
    });
    
    const currentTotal = parseFloat(document.getElementById('continueAllocCurrentTotal').value) || 0;
    const maxHours = parseFloat(document.getElementById('continueAllocMaxHours').value) || 0;
    const remainingAfter = maxHours - currentTotal - newTotal;
    
    document.getElementById('newAllocationTotal').textContent = `${newTotal.toFixed(1)}h`;
    
    const remainingEl = document.getElementById('remainingAfterAllocation');
    remainingEl.textContent = `${remainingAfter.toFixed(1)}h`;
    
    if (remainingAfter < 0) {
        remainingEl.style.color = 'var(--danger)';
    } else if (remainingAfter === 0) {
        remainingEl.style.color = 'var(--success)';
    } else {
        remainingEl.style.color = 'var(--warning)';
    }
}

async function submitContinueAllocation() {
    const projectId = document.getElementById('continueAllocProjectId').value;
    const maxHours = parseFloat(document.getElementById('continueAllocMaxHours').value);
    const currentTotal = parseFloat(document.getElementById('continueAllocCurrentTotal').value);
    
    // Collect new allocations
    const newAllocations = [];
    const selects = document.querySelectorAll('.continue-designer-select');
    
    for (const select of selects) {
        if (!select.value) continue;
        
        const rowNum = select.id.replace('continueDesigner', '');
        const hoursInput = document.getElementById(`continueHours${rowNum}`);
        const hours = parseFloat(hoursInput.value);
        
        if (!hours || hours <= 0) {
            alert('Please enter valid hours for all selected designers');
            return;
        }
        
        const selectedOption = select.options[select.selectedIndex];
        
        newAllocations.push({
            designerUid: select.value,
            designerName: selectedOption.dataset.name,
            designerEmail: selectedOption.dataset.email,
            designerRole: selectedOption.dataset.role,
            allocatedHours: hours
        });
    }
    
    if (newAllocations.length === 0) {
        alert('Please add at least one designer allocation');
        return;
    }
    
    // Calculate new total
    const newAllocationTotal = newAllocations.reduce((sum, a) => sum + a.allocatedHours, 0);
    const grandTotal = currentTotal + newAllocationTotal;
    
    if (grandTotal > maxHours) {
        if (!confirm(`Total allocation (${grandTotal}h) exceeds budget (${maxHours}h). Continue anyway?`)) {
            return;
        }
    }
    
    try {
        showLoading();
        
        const response = await apiCall(`projects?id=${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'continue_allocation',
                data: {
                    newAllocations: newAllocations,
                    additionalHours: newAllocationTotal
                }
            })
        });
        
        if (response.success) {
            closeContinueAllocationModal();
            alert(`✅ Successfully allocated ${newAllocationTotal}h to ${newAllocations.length} designer(s)!`);
            
            // Refresh views
            if (typeof showAllProjects === 'function') {
                await showAllProjects();
            } else if (typeof showProjects === 'function') {
                await showProjects();
            }
        } else {
            throw new Error(response.error || 'Allocation failed');
        }
        
    } catch (error) {
        console.error('Error continuing allocation:', error);
        alert('Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

function closeContinueAllocationModal() {
    const modal = document.getElementById('continueAllocationModal');
    if (modal) {
        modal.remove();
    }
    continueAllocationCounter = 0;
}

// ============================================
// DESIGN LEAD PORTAL
// ============================================

async function showDesignLeadPortal() {
    setActiveNav('nav-design-lead-portal');
    const main = document.getElementById('mainContent');
    main.innerHTML = '';
    showLoading();

    try {
        const response = await apiCall('projects');
        if (!response.success) throw new Error('Failed to fetch projects');

        const allProjects = response.data;
        // Filter projects where the current user is the design lead (by designLeadUid or assignedDesignerUids)
        const myProjects = allProjects.filter(p => p.designLeadUid === currentUser.uid ||
            (p.assignedDesignerUids && p.assignedDesignerUids.includes(currentUser.uid)));

        // Stats
        const totalProjects = myProjects.length;
        const activeProjects = myProjects.filter(p => ['assigned', 'in_progress', 'active'].includes(p.status)).length;
        const needsDesignerAssignment = myProjects.filter(p => !p.assignedDesigners || p.assignedDesigners.length === 0).length;
        const completedProjects = myProjects.filter(p => p.status === 'completed').length;
        const totalBudgetHours = myProjects.reduce((sum, p) => sum + (parseFloat(p.maxAllocatedHours) || 0), 0);
        const totalAllocatedHrs = myProjects.reduce((sum, p) => sum + (parseFloat(p.totalAllocatedHours) || 0), 0);
        const totalLoggedHrs = myProjects.reduce((sum, p) => sum + (parseFloat(p.hoursLogged) || 0), 0);

        // Build project cards
        let projectCardsHtml = '';
        if (myProjects.length === 0) {
            projectCardsHtml = `
                <div style="text-align: center; padding: 3rem; color: var(--text-light);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📋</div>
                    <h3>No Projects Assigned Yet</h3>
                    <p>Projects allocated to you by COO/Director will appear here.</p>
                </div>
            `;
        } else {
            projectCardsHtml = myProjects.map(project => {
                const maxHours = parseFloat(project.maxAllocatedHours) || 0;
                const additionalHours = parseFloat(project.additionalHours) || 0;
                const totalAvailable = maxHours + additionalHours;
                const totalAllocated = parseFloat(project.totalAllocatedHours) || 0;
                const hoursLogged = parseFloat(project.hoursLogged) || 0;
                const remainingBudget = totalAvailable - hoursLogged;

                // For Design Lead portal: check actual designer assignments, not COO-level allocation
                // assignedDesigners = designers assigned BY design lead
                // assignedDesignerHours = hours per designer assigned by design lead
                const designers = project.assignedDesigners || [];
                const designerHoursMap = project.assignedDesignerHours || {};
                const designerAllocatedTotal = designers.reduce((sum, uid) => sum + (parseFloat(designerHoursMap[uid]) || 0), 0);
                const remainingToAllocate = totalAvailable - designerAllocatedTotal;

                const hasDesigners = designers.length > 0;
                const isDesignerFullyAllocated = totalAvailable > 0 && designerAllocatedTotal >= totalAvailable;
                const isDesignerPartiallyAllocated = totalAvailable > 0 && designerAllocatedTotal > 0 && designerAllocatedTotal < totalAvailable;

                // Status color
                let statusColor = '#6b7280';
                if (project.status === 'in_progress' || project.status === 'active') statusColor = '#3b82f6';
                else if (project.status === 'assigned') statusColor = '#f59e0b';
                else if (project.status === 'completed') statusColor = '#10b981';

                // Allocation badge - based on designer-level assignments
                let allocationBadge = '';
                if (isDesignerFullyAllocated) {
                    allocationBadge = `<span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">Designers Fully Allocated</span>`;
                } else if (isDesignerPartiallyAllocated) {
                    allocationBadge = `<span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">Designers: ${designerAllocatedTotal}/${totalAvailable}h</span>`;
                } else if (!hasDesigners) {
                    allocationBadge = `<span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">Needs Designers</span>`;
                }

                // Designer names - show actual designers assigned by design lead
                const designerNamesList = project.assignedDesignerNames || [];
                const designerNames = designerNamesList.length > 0 ? designerNamesList.join(', ') : 'None assigned';

                // Assign button - based on designer-level assignments, not COO allocation
                let assignBtn = '';
                if (isDesignerFullyAllocated) {
                    assignBtn = `<button onclick="assignDesigners('${project.id}')" style="background: #10b981; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">✅ Manage Designers</button>`;
                } else if (isDesignerPartiallyAllocated) {
                    assignBtn = `<button onclick="assignDesigners('${project.id}')" style="background: #f59e0b; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.85rem;">⏳ Allocate Remaining ${remainingToAllocate.toFixed(1)}h</button>`;
                } else {
                    assignBtn = `<button onclick="assignDesigners('${project.id}')" style="background: var(--primary-blue); color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.85rem;">➕ Assign Designers</button>`;
                }

                return `
                    <div style="background: white; border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                                    ${project.projectNumber ? `<span style="background: var(--primary-blue); color: white; padding: 2px 10px; border-radius: 6px; font-size: 0.85rem; font-weight: 700;">No. ${project.projectNumber}</span>` : ''}
                                    <h3 style="margin: 0; font-size: 1.1rem;">${project.projectName}</h3>
                                </div>
                                <div style="font-size: 0.85rem; color: var(--text-light);">
                                    <strong>Code:</strong> ${project.projectCode || 'N/A'} &nbsp;|&nbsp;
                                    <strong>Client:</strong> ${project.clientCompany || 'N/A'}
                                    ${project.projectSection ? `&nbsp;|&nbsp; <strong>Section:</strong> <span style="background: #6366f1; color: white; padding: 1px 8px; border-radius: 10px; font-size: 0.8rem;">${project.projectSection}</span>` : ''}
                                </div>
                            </div>
                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                ${allocationBadge}
                                <span style="background: ${statusColor}; color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; text-transform: capitalize;">${(project.status || '').replace(/_/g, ' ')}</span>
                            </div>
                        </div>

                        <!-- Project Details Grid -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1rem; padding: 1rem; background: #f8fafc; border-radius: 8px;">
                            <div>
                                <div style="font-size: 0.75rem; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.5px;">Budget Hours</div>
                                <div style="font-size: 1.3rem; font-weight: 700; color: var(--primary-blue);">${maxHours}h</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.5px;">Additional</div>
                                <div style="font-size: 1.3rem; font-weight: 700; color: #f59e0b;">${additionalHours}h</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.5px;">Total Available</div>
                                <div style="font-size: 1.3rem; font-weight: 700; color: var(--success);">${totalAvailable}h</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.5px;">Designer Allocated</div>
                                <div style="font-size: 1.3rem; font-weight: 700; color: ${designerAllocatedTotal > 0 ? '#f59e0b' : '#6b7280'};">${designerAllocatedTotal}h</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.5px;">Hours Logged</div>
                                <div style="font-size: 1.3rem; font-weight: 700; color: ${hoursLogged > 0 ? '#8b5cf6' : '#6b7280'};">${hoursLogged.toFixed(1)}h</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: var(--text-light); text-transform: uppercase; letter-spacing: 0.5px;">Remaining</div>
                                <div style="font-size: 1.3rem; font-weight: 700; color: ${remainingBudget > 0 ? 'var(--success)' : 'var(--danger)'};">${remainingBudget.toFixed(1)}h</div>
                            </div>
                        </div>

                        <!-- Designer Info -->
                        <div style="margin-bottom: 1rem; padding: 0.75rem; background: ${!hasDesigners ? '#fef2f2' : '#f0fdf4'}; border-radius: 8px; border-left: 4px solid ${!hasDesigners ? '#ef4444' : '#10b981'};">
                            <strong style="font-size: 0.85rem;">Designers:</strong>
                            <span style="font-size: 0.85rem;">${designerNames}</span>
                        </div>

                        <!-- Action Buttons -->
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            ${assignBtn}
                            <button onclick="showTimesheetModal('${project.id}')" style="background: #0ea5e9; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">⏱️ Log Hours</button>
                            <button onclick="viewProject('${project.id}')" style="background: #6b7280; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">View Details</button>
                            <button onclick="viewBDMFiles('${project.id}', '${project.proposalId}')" style="background: #8b5cf6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">View BDM Files</button>
                            <button onclick="openDLDesignUploadModal('${project.id}', ${JSON.stringify(project.projectName || '').replace(/"/g, '&quot;')})" style="background: #0d9488; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">📐 Upload Design (IFA/IFC/Rev)</button>
                            <button onclick="openDCActivityHistory('${project.id}', ${JSON.stringify(project.projectName || '').replace(/"/g, '&quot;')})" style="background: #f59e0b; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">💬 Client Comments</button>
                            ${project.status !== 'completed' ? `
                                <button onclick="showAddVariationModal('${project.id}', '${project.projectCode}', '${project.projectName}')" style="background: var(--warning); color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">➕ Add Variation</button>
                                <button onclick="markProjectComplete('${project.id}')" style="background: var(--success); color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">✅ Mark Complete</button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }

        main.innerHTML = `
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <h2>Design Lead Portal</h2>
                    <div class="subtitle">Manage your assigned projects and design team allocations</div>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button onclick="showTimesheetModal()" style="background: #0ea5e9; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem;">⏱️ Log Hours</button>
                    <button onclick="showDesignLeadTimesheet()" style="background: #8b5cf6; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem;">📋 My Timesheet</button>
                    <button onclick="showDLHourRequestModal()" style="background: #f59e0b; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem;">➕ Request Additional Hours</button>
                    <button onclick="showDLMyHourRequests()" style="background: #10b981; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem;">📄 My Hour Requests</button>
                </div>
            </div>

            <!-- Stats Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                <div style="background: white; border-radius: 12px; padding: 1.25rem; text-align: center; border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                    <div style="font-size: 2rem; font-weight: 700; color: var(--primary-blue);">${totalProjects}</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">Total Projects</div>
                </div>
                <div style="background: white; border-radius: 12px; padding: 1.25rem; text-align: center; border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                    <div style="font-size: 2rem; font-weight: 700; color: #3b82f6;">${activeProjects}</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">Active</div>
                </div>
                <div style="background: white; border-radius: 12px; padding: 1.25rem; text-align: center; border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                    <div style="font-size: 2rem; font-weight: 700; color: #ef4444;">${needsDesignerAssignment}</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">Needs Designers</div>
                </div>
                <div style="background: white; border-radius: 12px; padding: 1.25rem; text-align: center; border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                    <div style="font-size: 2rem; font-weight: 700; color: #10b981;">${completedProjects}</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">Completed</div>
                </div>
                <div style="background: white; border-radius: 12px; padding: 1.25rem; text-align: center; border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                    <div style="font-size: 2rem; font-weight: 700; color: var(--primary-blue);">${totalBudgetHours}h</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">Total Budget</div>
                </div>
                <div style="background: white; border-radius: 12px; padding: 1.25rem; text-align: center; border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                    <div style="font-size: 2rem; font-weight: 700; color: #8b5cf6;">${totalLoggedHrs.toFixed(1)}h</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">Hours Logged</div>
                </div>
            </div>

            <!-- Filter Buttons -->
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                <button onclick="filterDesignLeadProjects('all')" class="btn btn-sm" id="dlFilterAll" style="background: var(--primary-blue); color: white; border: none; padding: 0.4rem 1rem; border-radius: 20px; cursor: pointer; font-weight: 600;">All (${totalProjects})</button>
                <button onclick="filterDesignLeadProjects('needs_designers')" class="btn btn-sm" id="dlFilterNeeds" style="background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; padding: 0.4rem 1rem; border-radius: 20px; cursor: pointer;">Needs Designers (${needsDesignerAssignment})</button>
                <button onclick="filterDesignLeadProjects('active')" class="btn btn-sm" id="dlFilterActive" style="background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; padding: 0.4rem 1rem; border-radius: 20px; cursor: pointer;">Active (${activeProjects})</button>
                <button onclick="filterDesignLeadProjects('completed')" class="btn btn-sm" id="dlFilterCompleted" style="background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; padding: 0.4rem 1rem; border-radius: 20px; cursor: pointer;">Completed (${completedProjects})</button>
            </div>

            <!-- Recent Client Comments from DC -->
            <div id="dlClientCommentsPanel" style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:1.25rem;margin-bottom:1.5rem;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                    <h3 style="margin:0;font-size:1rem;color:#1e293b;">💬 Recent Client Comments / Feedback (from DC)</h3>
                    <button onclick="loadDLClientComments()" style="background:#f1f5f9;border:1px solid #e2e8f0;color:#475569;padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;">🔄 Refresh</button>
                </div>
                <div id="dlClientCommentsList" style="font-size:13px;color:#64748b;">Loading...</div>
            </div>

            <!-- Project Cards -->
            <div id="designLeadProjectsList">
                ${projectCardsHtml}
            </div>
        `;

        // Store projects data for filtering
        window._designLeadProjects = myProjects;
        // Load DC client comments for this design lead's files
        if (typeof loadDLClientComments === 'function') loadDLClientComments();

    } catch (error) {
        console.error('Error loading Design Lead Portal:', error);
        main.innerHTML = `<div class="error-message"><h3>Error Loading Portal</h3><p>${error.message}</p></div>`;
    } finally {
        hideLoading();
    }
}

// Filter function for Design Lead Portal
function filterDesignLeadProjects(filter) {
    const projects = window._designLeadProjects || [];
    const container = document.getElementById('designLeadProjectsList');
    if (!container) return;

    // Update filter button styles
    ['dlFilterAll', 'dlFilterNeeds', 'dlFilterActive', 'dlFilterCompleted'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.style.background = '#f3f4f6';
            btn.style.color = '#374151';
            btn.style.border = '1px solid #d1d5db';
        }
    });

    let activeBtn;
    if (filter === 'all') activeBtn = document.getElementById('dlFilterAll');
    else if (filter === 'needs_designers') activeBtn = document.getElementById('dlFilterNeeds');
    else if (filter === 'active') activeBtn = document.getElementById('dlFilterActive');
    else if (filter === 'completed') activeBtn = document.getElementById('dlFilterCompleted');

    if (activeBtn) {
        activeBtn.style.background = 'var(--primary-blue)';
        activeBtn.style.color = 'white';
        activeBtn.style.border = 'none';
    }

    // Filter projects
    let filtered = projects;
    if (filter === 'needs_designers') {
        filtered = projects.filter(p => !p.assignedDesigners || p.assignedDesigners.length === 0);
    } else if (filter === 'active') {
        filtered = projects.filter(p => ['assigned', 'in_progress', 'active'].includes(p.status));
    } else if (filter === 'completed') {
        filtered = projects.filter(p => p.status === 'completed');
    }

    // Hide/show project cards
    const cards = container.children;
    let visibleIndex = 0;
    for (let i = 0; i < projects.length; i++) {
        if (cards[i]) {
            const isVisible = filtered.includes(projects[i]);
            cards[i].style.display = isVisible ? 'block' : 'none';
        }
    }
}

// Design Lead Timesheet View
async function showDesignLeadTimesheet() {
    const main = document.getElementById('main-content');
    if (!main) return;
    showLoading();

    try {
        const [timesheetRes, projectsRes] = await Promise.all([
            apiCall('timesheets'),
            apiCall('projects')
        ]);

        const entries = (timesheetRes.success ? timesheetRes.data : [])
            .sort((a, b) => {
                const da = a.date?.seconds ? a.date.seconds * 1000 : new Date(a.date).getTime();
                const db2 = b.date?.seconds ? b.date.seconds * 1000 : new Date(b.date).getTime();
                return db2 - da;
            });

        const myProjects = (projectsRes.success ? projectsRes.data : []).filter(p =>
            p.designLeadUid === currentUser.uid ||
            (p.assignedDesignerUids && p.assignedDesignerUids.includes(currentUser.uid))
        );

        // Calculate stats
        const now = new Date();
        const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1); weekStart.setHours(0,0,0,0);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        let thisWeekHours = 0, thisMonthHours = 0, totalHours = 0;
        entries.forEach(e => {
            const h = parseFloat(e.hours) || 0;
            totalHours += h;
            const d = e.date?.seconds ? new Date(e.date.seconds * 1000) : new Date(e.date);
            if (d >= weekStart) thisWeekHours += h;
            if (d >= monthStart) thisMonthHours += h;
        });

        const recentEntries = entries.slice(0, 30);

        const entriesHtml = recentEntries.length === 0
            ? `<p style="text-align: center; color: var(--text-light); padding: 2rem;">No timesheet entries yet. Click "Log Hours" to get started.</p>`
            : `<table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8fafc; border-bottom: 2px solid var(--border);">
                        <th style="padding: 0.75rem; text-align: left; font-size: 0.85rem;">Date</th>
                        <th style="padding: 0.75rem; text-align: left; font-size: 0.85rem;">Project</th>
                        <th style="padding: 0.75rem; text-align: center; font-size: 0.85rem;">Hours</th>
                        <th style="padding: 0.75rem; text-align: left; font-size: 0.85rem;">Description</th>
                        <th style="padding: 0.75rem; text-align: center; font-size: 0.85rem;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentEntries.map(e => {
                        const d = e.date?.seconds ? new Date(e.date.seconds * 1000) : new Date(e.date);
                        const dateStr = d instanceof Date && !isNaN(d) ? d.toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'}) : 'N/A';
                        const statusColor = e.status === 'approved' ? '#10b981' : '#f59e0b';
                        const statusLabel = e.status === 'approved' ? 'Approved' : 'Pending';
                        return `<tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 0.75rem; font-size: 0.85rem;">${dateStr}</td>
                            <td style="padding: 0.75rem; font-size: 0.85rem;">${e.projectName || 'N/A'}</td>
                            <td style="padding: 0.75rem; text-align: center; font-weight: 600;">${parseFloat(e.hours).toFixed(1)}h</td>
                            <td style="padding: 0.75rem; font-size: 0.85rem; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${e.description || ''}</td>
                            <td style="padding: 0.75rem; text-align: center;">
                                <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${statusLabel}</span>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;

        main.innerHTML = `
            <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
                <div>
                    <h2>My Timesheet</h2>
                    <div class="subtitle">Track your logged hours across projects</div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button onclick="showTimesheetModal()" style="background: #0ea5e9; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem;">⏱️ Log Hours</button>
                    <button onclick="showDesignLeadPortal()" style="background: var(--primary-blue); color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem;">Back to Portal</button>
                </div>
            </div>

            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                <div style="background: white; border-radius: 12px; padding: 1.25rem; text-align: center; border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                    <div style="font-size: 2rem; font-weight: 700; color: #0ea5e9;">${thisWeekHours.toFixed(1)}h</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">This Week</div>
                </div>
                <div style="background: white; border-radius: 12px; padding: 1.25rem; text-align: center; border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                    <div style="font-size: 2rem; font-weight: 700; color: #8b5cf6;">${thisMonthHours.toFixed(1)}h</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">This Month</div>
                </div>
                <div style="background: white; border-radius: 12px; padding: 1.25rem; text-align: center; border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                    <div style="font-size: 2rem; font-weight: 700; color: #10b981;">${totalHours.toFixed(1)}h</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">Total Hours</div>
                </div>
                <div style="background: white; border-radius: 12px; padding: 1.25rem; text-align: center; border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                    <div style="font-size: 2rem; font-weight: 700; color: var(--primary-blue);">${myProjects.length}</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">Active Projects</div>
                </div>
            </div>

            <!-- Recent Entries -->
            <div style="background: white; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow: hidden;">
                <div style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); font-weight: 600; font-size: 1rem;">
                    Recent Entries (Last 30)
                </div>
                <div style="overflow-x: auto;">
                    ${entriesHtml}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading timesheet:', error);
        main.innerHTML = `<div class="error-message"><h3>Error Loading Timesheet</h3><p>${error.message}</p></div>`;
    } finally {
        hideLoading();
    }
}

// ============================================================================
// DESIGN LEAD - DIRECT DESIGN FILE UPLOAD (IFA / IFC / Rev) -> DC (skips COO)
// ============================================================================
let _dlDesignFile = null;
let _dlUploadType = 'file';

function openDLDesignUploadModal(projectId, projectName) {
    let modal = document.getElementById('dlDesignUploadModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'dlDesignUploadModal';
        modal.className = 'modal';
        modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;align-items:center;justify-content:center;';
        modal.innerHTML = `
          <div style="background:#fff;border-radius:12px;max-width:560px;width:92%;padding:1.5rem;max-height:90vh;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
              <h3 style="margin:0;">Upload Design Files → Document Controller</h3>
              <span style="cursor:pointer;font-size:1.5rem;" onclick="closeDLDesignUploadModal()">&times;</span>
            </div>
            <p style="color:#64748b;font-size:0.85rem;margin:0 0 1rem;">Upload IFA / IFC / Revision files as a single <strong>.zip</strong> archive, or share an external link. This will go directly to the Document Controller (no COO approval needed).</p>
            <div style="background:#f0fdfa;border:1px solid #99f6e4;padding:0.6rem 0.85rem;border-radius:8px;margin-bottom:1rem;font-size:0.85rem;"><strong>Project:</strong> <span id="dlDuProjectName"></span></div>
            <input type="hidden" id="dlDuProjectId">

            <div style="display:flex;gap:0.5rem;margin-bottom:1rem;">
              <button type="button" id="dlDuTypeFile" class="btn btn-primary" onclick="setDLUploadType('file')" style="flex:1;">📦 ZIP File</button>
              <button type="button" id="dlDuTypeLink" class="btn btn-secondary" onclick="setDLUploadType('link')" style="flex:1;">🔗 External Link</button>
            </div>

            <div style="margin-bottom:1rem;">
              <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:0.4rem;">File Category</label>
              <select id="dlDuCategory" style="width:100%;padding:0.55rem;border:1px solid #d1d5db;border-radius:6px;">
                <option value="MIXED">Mixed (IFA + IFC + Rev)</option>
                <option value="IFA">IFA</option>
                <option value="IFC">IFC</option>
                <option value="REV">Revision</option>
              </select>
            </div>

            <div id="dlDuFileSection">
              <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:0.4rem;">ZIP File (max 200MB)</label>
              <input type="file" id="dlDuFileInput" accept=".zip,application/zip,application/x-zip-compressed" onchange="handleDLDesignFileSelect(this)" style="width:100%;padding:0.5rem;border:1px dashed #cbd5e1;border-radius:8px;">
              <div id="dlDuFileInfo" style="margin-top:0.5rem;font-size:0.8rem;color:#0d9488;"></div>
            </div>

            <div id="dlDuLinkSection" style="display:none;">
              <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:0.4rem;">Link Title</label>
              <input type="text" id="dlDuLinkTitle" placeholder="e.g. Project XYZ – IFC Drawings" style="width:100%;padding:0.55rem;border:1px solid #d1d5db;border-radius:6px;margin-bottom:0.75rem;">
              <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:0.4rem;">External URL</label>
              <input type="url" id="dlDuLinkUrl" placeholder="https://..." style="width:100%;padding:0.55rem;border:1px solid #d1d5db;border-radius:6px;">
            </div>

            <div style="margin-top:1rem;">
              <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:0.4rem;">Notes (optional)</label>
              <textarea id="dlDuNotes" rows="3" style="width:100%;padding:0.55rem;border:1px solid #d1d5db;border-radius:6px;" placeholder="Any notes for the Document Controller..."></textarea>
            </div>

            <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:1.25rem;">
              <button class="btn btn-secondary" onclick="closeDLDesignUploadModal()">Cancel</button>
              <button class="btn btn-primary" onclick="submitDLDesignUpload()" style="background:#0d9488;">📤 Upload to DC</button>
            </div>
          </div>`;
        document.body.appendChild(modal);
    }
    document.getElementById('dlDuProjectId').value = projectId;
    document.getElementById('dlDuProjectName').textContent = projectName;
    document.getElementById('dlDuFileInput').value = '';
    document.getElementById('dlDuFileInfo').textContent = '';
    document.getElementById('dlDuLinkUrl').value = '';
    document.getElementById('dlDuLinkTitle').value = '';
    document.getElementById('dlDuNotes').value = '';
    document.getElementById('dlDuCategory').value = 'MIXED';
    _dlDesignFile = null;
    setDLUploadType('file');
    modal.style.display = 'flex';
}

function closeDLDesignUploadModal() {
    const m = document.getElementById('dlDesignUploadModal');
    if (m) m.style.display = 'none';
    _dlDesignFile = null;
}

function setDLUploadType(t) {
    _dlUploadType = t;
    document.getElementById('dlDuFileSection').style.display = (t === 'file') ? 'block' : 'none';
    document.getElementById('dlDuLinkSection').style.display = (t === 'link') ? 'block' : 'none';
    document.getElementById('dlDuTypeFile').className = (t === 'file') ? 'btn btn-primary' : 'btn btn-secondary';
    document.getElementById('dlDuTypeLink').className = (t === 'link') ? 'btn btn-primary' : 'btn btn-secondary';
}

function handleDLDesignFileSelect(input) {
    const file = input.files[0];
    if (!file) { _dlDesignFile = null; return; }
    const name = file.name.toLowerCase();
    if (!name.endsWith('.zip')) {
        showNotification ? showNotification('Please select a .zip archive', 'error') : alert('Please select a .zip archive');
        input.value = '';
        return;
    }
    if (file.size > 200 * 1024 * 1024) {
        showNotification ? showNotification('File must be under 200MB', 'error') : alert('File must be under 200MB');
        input.value = '';
        return;
    }
    _dlDesignFile = file;
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    document.getElementById('dlDuFileInfo').textContent = `Selected: ${file.name} (${sizeMB} MB)`;
}

async function submitDLDesignUpload() {
    const projectId = document.getElementById('dlDuProjectId').value;
    const category = document.getElementById('dlDuCategory').value;
    const notes = document.getElementById('dlDuNotes').value.trim();

    let fileName, fileUrl, fileSize;
    try {
        showLoading();
        if (_dlUploadType === 'file') {
            if (!_dlDesignFile) { showNotification('Please select a ZIP file', 'error'); hideLoading(); return; }
            const storageInstance = window.storage || firebase.storage();
            const ts = Date.now();
            const path = `design_files/${projectId}/dl_${ts}_${_dlDesignFile.name}`;
            const ref = storageInstance.ref().child(path);
            const task = await ref.put(_dlDesignFile);
            fileUrl = await task.ref.getDownloadURL();
            fileName = _dlDesignFile.name;
            fileSize = _dlDesignFile.size;
        } else {
            const url = document.getElementById('dlDuLinkUrl').value.trim();
            const title = document.getElementById('dlDuLinkTitle').value.trim();
            if (!title) { showNotification('Please enter a link title', 'error'); hideLoading(); return; }
            if (!url || !/^https?:\/\//i.test(url)) { showNotification('Please enter a valid URL', 'error'); hideLoading(); return; }
            fileUrl = url;
            fileName = title;
            fileSize = 0;
        }

        const response = await apiCall(`projects?id=${projectId}`, {
            method: 'PUT',
            body: JSON.stringify({
                action: 'upload_design_file',
                data: {
                    fileName,
                    fileUrl,
                    fileSize,
                    notes,
                    uploadType: _dlUploadType,
                    isExternalLink: _dlUploadType === 'link',
                    fileCategory: category,
                    directToDC: true
                }
            })
        });

        if (!response.success) throw new Error(response.error || 'Upload failed');
        showNotification('✅ Sent directly to Document Controller', 'success');
        closeDLDesignUploadModal();
        if (typeof showDesignLeadPortal === 'function') showDesignLeadPortal();
    } catch (e) {
        console.error('DL design upload error:', e);
        showNotification('Failed: ' + e.message, 'error');
    } finally {
        hideLoading();
    }
}

async function loadDLClientComments() {
    const list = document.getElementById('dlClientCommentsList');
    if (!list) return;
    list.innerHTML = 'Loading...';
    try {
        const resp = await apiCall('projects?action=get_dc_comments&myDesignFiles=true');
        const payload = (resp && resp.data && (resp.data.comments || resp.data.activities)) ? resp.data : resp;
        const comments = (payload && payload.comments) || [];
        if (!comments.length) {
            list.innerHTML = '<div style="color:#94a3b8;padding:8px 0;">No client comments yet on your design files.</div>';
            return;
        }
        const typeMeta = {
            'general': { icon: '💬', color: '#3b82f6', bg: '#eff6ff', label: 'Comment' },
            'client_feedback': { icon: '📩', color: '#f59e0b', bg: '#fffbeb', label: 'Client Feedback' },
            'rectification': { icon: '🔧', color: '#ef4444', bg: '#fef2f2', label: 'Rectification' },
            'revision_request': { icon: '📝', color: '#f97316', bg: '#fff7ed', label: 'Revision Request' },
            'resolved': { icon: '✅', color: '#10b981', bg: '#ecfdf5', label: 'Resolved' }
        };
        list.innerHTML = comments.slice(0, 10).map(c => {
            const t = typeMeta[c.commentType] || typeMeta.general;
            const ts = c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000) : null;
            const tsStr = ts ? ts.toLocaleString('en-AU', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : '';
            return `
                <div style="border-left:3px solid ${t.color};background:${t.bg};border-radius:0 8px 8px 0;padding:10px 12px;margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <span style="font-weight:600;font-size:12px;color:${t.color};">${t.icon} ${t.label} – ${c.projectName || ''}</span>
                        <span style="font-size:11px;color:#94a3b8;">${tsStr}</span>
                    </div>
                    ${c.clientResponse ? `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;margin-bottom:6px;font-size:12px;color:#1e293b;"><strong style="color:#64748b;font-size:11px;">CLIENT:</strong> ${c.clientResponse}</div>` : ''}
                    <div style="font-size:13px;color:#1e293b;">${c.comment}</div>
                    <div style="margin-top:4px;font-size:11px;color:#94a3b8;">By ${c.createdByName || 'DC'} · File: ${c.fileName || ''}</div>
                </div>`;
        }).join('');
    } catch (e) {
        console.error('Error loading DL client comments:', e);
        list.innerHTML = `<div style="color:#ef4444;">Error loading comments: ${e.message}</div>`;
    }
}
window.loadDLClientComments = loadDLClientComments;

window.openDLDesignUploadModal = openDLDesignUploadModal;
window.closeDLDesignUploadModal = closeDLDesignUploadModal;
window.setDLUploadType = setDLUploadType;
window.handleDLDesignFileSelect = handleDLDesignFileSelect;
window.submitDLDesignUpload = submitDLDesignUpload;

// Register globally
window.showDesignLeadPortal = showDesignLeadPortal;
window.filterDesignLeadProjects = filterDesignLeadProjects;
window.showDesignLeadTimesheet = showDesignLeadTimesheet;

// ============================================
// DESIGN LEAD ADDITIONAL HOUR REQUEST
// ============================================

/**
 * Show modal for Design Lead to request additional hours for one of their projects
 */
async function showDLHourRequestModal() {
    const projects = window._designLeadProjects || [];

    const projectOptions = projects.length === 0
        ? '<option value="">No projects available</option>'
        : '<option value="">Select a project...</option>' +
          projects.map(p => `<option value="${p.id}" data-name="${(p.projectName || '').replace(/"/g,'&quot;')}">${p.projectName} (${p.projectCode || 'N/A'})</option>`).join('');

    const modalHtml = `
        <div class="modal-overlay" id="dlHourRequestOverlay"
             style="display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;align-items:center;justify-content:center;"
             onclick="if(event.target.id==='dlHourRequestOverlay'){closeDLHourRequestModal();}">
            <div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3);width:100%;max-width:520px;max-height:90vh;overflow-y:auto;">
                <div style="padding:1.5rem;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:white;">
                    <h2 style="margin:0;font-size:1.25rem;">➕ Request Additional Hours</h2>
                    <p style="margin:0.25rem 0 0;font-size:0.875rem;opacity:0.9;">Submit a request to COO for additional project hours</p>
                </div>
                <form onsubmit="submitDLHourRequest(event)" style="padding:1.5rem;">
                    <div style="margin-bottom:1.25rem;">
                        <label style="display:block;margin-bottom:0.5rem;font-weight:600;color:#374151;">Project <span style="color:red;">*</span></label>
                        <select id="dlHRProjectId" required
                                style="width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:8px;font-size:1rem;box-sizing:border-box;"
                                onchange="dlHRUpdateProjectInfo()">
                            ${projectOptions}
                        </select>
                    </div>
                    <div id="dlHRProjectInfo" style="display:none;margin-bottom:1.25rem;padding:0.75rem;background:#fef3c7;border-radius:8px;border:1px solid #fcd34d;font-size:0.875rem;color:#92400e;"></div>
                    <div style="margin-bottom:1.25rem;">
                        <label style="display:block;margin-bottom:0.5rem;font-weight:600;color:#374151;">Additional Hours Needed <span style="color:red;">*</span></label>
                        <input type="number" id="dlHRHours" required min="0.5" step="0.5" placeholder="e.g. 8"
                               style="width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:8px;font-size:1rem;box-sizing:border-box;">
                    </div>
                    <div style="margin-bottom:1.5rem;">
                        <label style="display:block;margin-bottom:0.5rem;font-weight:600;color:#374151;">Reason <span style="color:red;">*</span></label>
                        <textarea id="dlHRReason" required rows="3" placeholder="Explain why additional hours are needed..."
                                  style="width:100%;padding:0.75rem;border:1px solid #d1d5db;border-radius:8px;font-size:1rem;box-sizing:border-box;resize:vertical;"></textarea>
                    </div>
                    <div style="display:flex;justify-content:flex-end;gap:0.75rem;padding-top:1rem;border-top:1px solid #e5e7eb;">
                        <button type="button" onclick="closeDLHourRequestModal()"
                                style="padding:0.75rem 1.5rem;border-radius:8px;border:1px solid #d1d5db;background:white;cursor:pointer;font-weight:600;">
                            Cancel
                        </button>
                        <button type="submit"
                                style="padding:0.75rem 1.5rem;border-radius:8px;border:none;background:#f59e0b;color:white;cursor:pointer;font-weight:600;">
                            📤 Submit Request to COO
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeDLHourRequestModal() {
    const el = document.getElementById('dlHourRequestOverlay');
    if (el) el.remove();
}

function dlHRUpdateProjectInfo() {
    const select = document.getElementById('dlHRProjectId');
    const infoDiv = document.getElementById('dlHRProjectInfo');
    if (!select || !infoDiv) return;
    const projectId = select.value;
    if (!projectId) { infoDiv.style.display = 'none'; return; }
    const projects = window._designLeadProjects || [];
    const p = projects.find(x => x.id === projectId);
    if (!p) { infoDiv.style.display = 'none'; return; }
    const maxH = parseFloat(p.maxAllocatedHours) || 0;
    const addH = parseFloat(p.additionalHours) || 0;
    const loggedH = parseFloat(p.hoursLogged) || 0;
    const remaining = (maxH + addH) - loggedH;
    infoDiv.style.display = 'block';
    infoDiv.innerHTML = `
        <strong>${p.projectName}</strong> &nbsp;|&nbsp; ${p.clientCompany || 'N/A'}<br>
        Budget: <strong>${maxH}h</strong> &nbsp;+&nbsp; Additional: <strong>${addH}h</strong> &nbsp;|&nbsp; Logged: <strong>${loggedH.toFixed(1)}h</strong> &nbsp;|&nbsp; Remaining: <strong style="color:${remaining > 0 ? '#065f46' : '#b91c1c'}">${remaining.toFixed(1)}h</strong>
    `;
}

async function submitDLHourRequest(event) {
    event.preventDefault();
    const projectId = document.getElementById('dlHRProjectId').value;
    const requestedHours = parseFloat(document.getElementById('dlHRHours').value);
    const reason = document.getElementById('dlHRReason').value.trim();

    if (!projectId || !requestedHours || !reason) {
        alert('Please fill in all required fields.');
        return;
    }

    try {
        showLoading();
        const response = await apiCall('time-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, requestedHours, reason })
        });

        if (response.success) {
            closeDLHourRequestModal();
            alert(`✅ Request Submitted!\n\nYour request for ${requestedHours} additional hours has been sent to the COO for approval.`);
            showDesignLeadPortal();
        } else {
            throw new Error(response.error || 'Failed to submit request');
        }
    } catch (error) {
        console.error('Error submitting hour request:', error);
        alert('Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Show Design Lead's own submitted hour requests and their statuses
 */
async function showDLMyHourRequests() {
    const main = document.getElementById('mainContent');
    main.innerHTML = '';
    showLoading();
    try {
        const response = await apiCall('time-requests?myRequests=true');
        const requests = response.success ? (response.data || []) : [];

        const statusBadge = (status) => {
            const map = {
                pending: { bg: '#f59e0b', label: '⏳ Pending' },
                approved: { bg: '#10b981', label: '✅ Approved' },
                rejected: { bg: '#ef4444', label: '❌ Rejected' },
                info_requested: { bg: '#3b82f6', label: '💬 Info Needed' }
            };
            const s = map[status] || { bg: '#6b7280', label: status };
            return `<span style="background:${s.bg};color:white;padding:2px 10px;border-radius:12px;font-size:0.8rem;font-weight:600;">${s.label}</span>`;
        };

        const rowsHtml = requests.length === 0
            ? `<tr><td colspan="6" style="text-align:center;padding:2rem;color:#6b7280;">No hour requests submitted yet.</td></tr>`
            : requests.map(r => `
                <tr style="border-bottom:1px solid #f0f0f0;">
                    <td style="padding:0.75rem;"><strong>${r.projectName || 'N/A'}</strong><br><small style="color:#6b7280;">${r.projectCode || ''} · ${r.clientCompany || ''}</small></td>
                    <td style="padding:0.75rem;text-align:center;font-weight:700;color:#f59e0b;font-size:1.1rem;">+${r.requestedHours}h</td>
                    <td style="padding:0.75rem;text-align:center;font-weight:700;color:#10b981;">${r.approvedHours ? r.approvedHours + 'h' : '—'}</td>
                    <td style="padding:0.75rem;max-width:200px;font-size:0.875rem;">${r.reason || ''}</td>
                    <td style="padding:0.75rem;text-align:center;">${statusBadge(r.status)}</td>
                    <td style="padding:0.75rem;font-size:0.8rem;color:#6b7280;">${r.createdAt ? new Date(r.createdAt.seconds ? r.createdAt.seconds * 1000 : r.createdAt).toLocaleDateString() : 'N/A'}</td>
                </tr>
            `).join('');

        main.innerHTML = `
            <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:1.5rem;">
                <div>
                    <h2>📄 My Hour Requests</h2>
                    <div class="subtitle">Track your additional hour requests sent to COO</div>
                </div>
                <div style="display:flex;gap:0.5rem;">
                    <button onclick="showDLHourRequestModal()" style="background:#f59e0b;color:white;border:none;padding:0.6rem 1.2rem;border-radius:8px;cursor:pointer;font-weight:600;">➕ New Request</button>
                    <button onclick="showDesignLeadPortal()" style="background:var(--primary-blue);color:white;border:none;padding:0.6rem 1.2rem;border-radius:8px;cursor:pointer;font-weight:600;">← Back to Portal</button>
                </div>
            </div>
            <div style="background:white;border-radius:12px;border:1px solid var(--border);overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr style="background:#f8fafc;border-bottom:2px solid #e5e7eb;">
                            <th style="padding:0.75rem;text-align:left;font-size:0.85rem;color:#374151;">Project</th>
                            <th style="padding:0.75rem;text-align:center;font-size:0.85rem;color:#374151;">Requested</th>
                            <th style="padding:0.75rem;text-align:center;font-size:0.85rem;color:#374151;">Approved</th>
                            <th style="padding:0.75rem;text-align:left;font-size:0.85rem;color:#374151;">Reason</th>
                            <th style="padding:0.75rem;text-align:center;font-size:0.85rem;color:#374151;">Status</th>
                            <th style="padding:0.75rem;text-align:left;font-size:0.85rem;color:#374151;">Date</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        `;
    } catch (error) {
        main.innerHTML = `<div style="color:#ef4444;padding:2rem;"><h3>Error loading requests</h3><p>${error.message}</p></div>`;
    } finally {
        hideLoading();
    }
}

window.showDLHourRequestModal = showDLHourRequestModal;
window.closeDLHourRequestModal = closeDLHourRequestModal;
window.dlHRUpdateProjectInfo = dlHRUpdateProjectInfo;
window.submitDLHourRequest = submitDLHourRequest;
window.showDLMyHourRequests = showDLMyHourRequests;

// ============================================================================
// REPLACE THE EXISTING showAllocateProjectModal FUNCTION WITH THIS:
// Find the function around line 9137 and replace it with this version
// ============================================================================

// Comment out or remove the old showAllocateProjectModal function 
// and use this new one instead:

/*
async function showAllocateProjectModal(projectId) {
    // Use the new multi-designer modal
    await showCooMultiDesignerAllocationModal(projectId);
}

      

        // ============================================
        // DESIGN LEAD VIEW UPDATES (REPLACED)
        // ============================================

        // REPLACED old showDesignLeadDashboard with this new logic
        async function showDesignLeadDashboard() {
            setActiveNav('nav-dashboard');
            const main = document.getElementById('mainContent');
            main.innerHTML = ''; // Clear content
            showLoading();

            try {
                const response = await apiCall('projects');
                if (!response.success) throw new Error('Failed to fetch projects');

                const allProjects = response.data;
                // Filter projects where the current user is the design lead (by designLeadUid or assignedDesignerUids)
                const myProjects = allProjects.filter(p => p.designLeadUid === currentUser.uid ||
                    (p.assignedDesignerUids && p.assignedDesignerUids.includes(currentUser.uid)));

                // Fetch deliverables needing review (assuming an endpoint exists)
                const reviewResponse = await apiCall('deliverables?status=pending'); // Example endpoint
                const pendingReview = reviewResponse.success ? reviewResponse.data.filter(d => myProjects.some(p => p.id === d.projectId)) : []; // Filter reviews for my projects

                const stats = {
                    myProjects: myProjects.length,
                    inProgress: myProjects.filter(p => p.status === 'active').length, // Assuming 'active' means in progress
                    pendingReview: pendingReview.length
                };


                let projectsHtml = '';
                if (myProjects.length === 0) {
                    projectsHtml = '<p>No projects allocated to you yet.</p>';
                } else {
                    projectsHtml = myProjects.map(project => createProjectCard(project)).join('');
                }

                 let reviewHtml = '';
                 if (pendingReview.length > 0) {
                     reviewHtml = `
                        <div class="action-section" style="background: #FFF3CD;">
                            <h3>⚠️ Deliverables Pending Review</h3>
                            ${pendingReview.map(d => `
                                <div class="action-item" style="background: white;">
                                    <div class="action-content">
                                        <strong>${d.originalName}</strong>
                                        <div class="action-meta">
                                            Project: ${d.projectName} | Designer: ${d.designerName} | V: ${d.versionNumber}
                                        </div>
                                    </div>
                                    <div class="action-buttons">
                                        <button onclick="window.open('${d.url}', '_blank')" class="btn btn-outline btn-sm">View</button>
                                        <button onclick="showReviewDeliverableModal('${d.id}')" class="btn btn-primary btn-sm">Review</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                     `;
                 }


                main.innerHTML = `
                    <div class="page-header">
                        <h2>Design Lead Dashboard</h2>
                        <div class="subtitle">Manage your assigned projects and team</div>
                    </div>
                    <div class="dashboard-stats">
                        <div class="stat-card"><div class="stat-number">${stats.myProjects}</div><div class="stat-label">My Projects</div></div>
                        <div class="stat-card"><div class="stat-number">${stats.inProgress}</div><div class="stat-label">In Progress</div></div>
                        <div class="stat-card"><div class="stat-number">${stats.pendingReview}</div><div class="stat-label">Pending Review</div></div>
                    </div>
                    ${reviewHtml}
                    <div class="action-section">
                         <h3>My Projects</h3>
                         ${projectsHtml}
                    </div>
                `;

            } catch (error) {
                console.error('Error loading Design Lead dashboard:', error);
                main.innerHTML = `<div class="error-message">Failed to load dashboard: ${error.message}</div>`;
            } finally {
                hideLoading();
            }
        }

  


        // Function for Design Lead to assign designers
        async function assignDesigners(projectId) {
            const modal = document.getElementById('designerAssignmentModal');

            try {
                showLoading();

                // Fetch designers and project in parallel
                const [response, projectResponse, timesheetResponse] = await Promise.all([
                    apiCall('users?role=designer'),
                    apiCall(`projects?id=${projectId}`),
                    apiCall(`timesheets?projectId=${projectId}`)
                ]);
                if (!response.success) throw new Error('Failed to fetch designers');
                const designers = response.data;

                const currentProject = projectResponse.success ? projectResponse.data : {};

                // Build per-designer hours logged from timesheets
                const timesheets = (timesheetResponse.success ? timesheetResponse.data : []);
                const hoursLoggedPerDesigner = {};
                timesheets.forEach(t => {
                    if (t.designerUid) {
                        hoursLoggedPerDesigner[t.designerUid] = (hoursLoggedPerDesigner[t.designerUid] || 0) + (parseFloat(t.hours) || 0);
                    }
                });

                // Get max hours from project (set by COO/Director)
                const maxHours = parseFloat(currentProject.maxAllocatedHours || 0);
                const additionalHours = parseFloat(currentProject.additionalHours || 0);
                const totalAvailable = maxHours + additionalHours;

                // Designer-level allocation (assigned by design lead)
                const existingDesignersList = currentProject.assignedDesigners || [];
                const existingDesignerHoursMap = currentProject.assignedDesignerHours || {};
                const existingDesignerNamesList = currentProject.assignedDesignerNames || [];
                const existingDesignerEmailsList = currentProject.assignedDesignerEmails || [];
                const alreadyAllocated = existingDesignersList.reduce((sum, uid) => sum + (parseFloat(existingDesignerHoursMap[uid]) || 0), 0);
                const remainingToAllocate = totalAvailable - alreadyAllocated;
                const hoursLogged = parseFloat(currentProject.hoursLogged || 0);

                // Show hours summary
                const summaryDiv = document.getElementById('projectHoursSummary');
                if (maxHours > 0) {
                    summaryDiv.style.display = 'block';
                    summaryDiv.innerHTML = `
                        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; text-align: center;">
                            <div>
                                <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 0.3rem;">Project Budget</div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-blue);">${maxHours.toFixed(1)}h</div>
                            </div>
                            <div>
                                <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 0.3rem;">Additional Buffer</div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning);">${additionalHours.toFixed(1)}h</div>
                            </div>
                            <div>
                                <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 0.3rem;">Total Available</div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: var(--success);">${totalAvailable.toFixed(1)}h</div>
                            </div>
                            <div>
                                <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 0.3rem;">Designer Allocated</div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: ${alreadyAllocated > 0 ? '#f59e0b' : 'var(--text-light)'};">${alreadyAllocated.toFixed(1)}h</div>
                            </div>
                            <div>
                                <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 0.3rem;">Remaining</div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: ${remainingToAllocate > 0 ? 'var(--success)' : 'var(--danger)'};" id="displayRemainingHours">${remainingToAllocate.toFixed(1)}h</div>
                            </div>
                        </div>
                        ${alreadyAllocated > 0 ? `
                        <div style="margin-top: 1rem; padding: 0.75rem; background: #fef3c7; border-radius: 6px; border-left: 4px solid #f59e0b;">
                            <strong>⏳ Partial Allocation:</strong> ${alreadyAllocated.toFixed(1)}h already allocated to ${existingDesignersList.length} designer(s). You can edit hours or add more designers with the remaining ${remainingToAllocate.toFixed(1)}h.
                        </div>
                        ` : ''}
                    `;
                } else {
                    summaryDiv.style.display = 'none';
                }

                // Populate designers list
                const designersList = document.getElementById('designersList');
                designersList.innerHTML = '';

                // Sort: already assigned first, then by name
                const sortedDesigners = [...designers].sort((a, b) => {
                    const aAssigned = existingDesignersList.includes(a.uid) ? 0 : 1;
                    const bAssigned = existingDesignersList.includes(b.uid) ? 0 : 1;
                    if (aAssigned !== bAssigned) return aAssigned - bAssigned;
                    return (a.name || '').localeCompare(b.name || '');
                });

                sortedDesigners.forEach(designer => {
                    const isAssigned = existingDesignersList.includes(designer.uid);
                    const currentHours = parseFloat(existingDesignerHoursMap[designer.uid]) || 0;
                    const logged = parseFloat(hoursLoggedPerDesigner[designer.uid]) || 0;
                    const hasLoggedHours = logged > 0;

                    const designerRow = document.createElement('div');
                    designerRow.className = 'designer-row';
                    designerRow.style.cssText = 'display: grid; grid-template-columns: auto 1fr auto; gap: 1rem; align-items: center; padding: 1rem; border: 2px solid var(--border); border-radius: 8px; margin-bottom: 0.8rem; background: white;';

                    if (isAssigned && currentHours > 0) {
                        designerRow.style.borderColor = '#10b981';
                        designerRow.style.background = '#f0fdf4';
                    }

                    designerRow.innerHTML = `
                        <div style="display: flex; align-items: center;">
                            <input type="checkbox"
                                    id="designer-${designer.uid}"
                                    value="${designer.uid}"
                                    data-name="${designer.name}"
                                    data-email="${designer.email}"
                                    data-current-hours="${currentHours}"
                                    data-hours-logged="${logged}"
                                    ${isAssigned ? 'checked' : ''}
                                    ${hasLoggedHours ? 'disabled title="Cannot unassign - designer has logged hours"' : ''}
                                    onchange="toggleDesignerHoursInput(this)"
                                    style="width: 20px; height: 20px; cursor: ${hasLoggedHours ? 'not-allowed' : 'pointer'};">
                        </div>
                        <div>
                            <label for="designer-${designer.uid}" style="font-weight: 600; margin: 0; cursor: pointer;">
                                ${designer.name}
                                ${isAssigned && currentHours > 0 ? `<span style="color: #10b981; font-size: 0.85rem;">(Allocated: ${currentHours}h)</span>` : ''}
                            </label>
                            <div style="font-size: 0.85rem; color: var(--text-light);">
                                ${designer.email} ${designer.assignedProjects ? `• ${designer.assignedProjects} active projects` : ''}
                            </div>
                            ${hasLoggedHours ? `
                                <div style="font-size: 0.8rem; color: #8b5cf6; margin-top: 2px;">
                                    ⏱️ ${logged.toFixed(1)}h logged (min allocation: ${logged.toFixed(1)}h)
                                </div>
                            ` : ''}
                        </div>
                        <div style="min-width: 150px;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <input type="number"
                                        id="hours-${designer.uid}"
                                        class="form-control hours-input"
                                        step="0.5"
                                        min="${hasLoggedHours ? logged : 0}"
                                        value="${currentHours}"
                                        placeholder="Optional"
                                        ${!isAssigned ? 'disabled' : ''}
                                        data-min-hours="${hasLoggedHours ? logged : 0}"
                                        oninput="updateTotalAllocated()"
                                        onchange="updateTotalAllocated()"
                                        style="width: 80px; padding: 0.5rem; text-align: center;">
                                <span style="font-size: 0.9rem; color: var(--text-light);">hrs</span>
                            </div>
                        </div>
                    `;

                    designersList.appendChild(designerRow);
                });

                // Store project info for validation
                document.getElementById('assignProjectId').value = projectId;
                modal.dataset.maxHours = totalAvailable;
                modal.dataset.alreadyAllocated = alreadyAllocated;

                // Calculate and display initial totals
                updateTotalAllocated();

                // Show modal
                modal.style.display = 'flex';

            } catch (error) {
                console.error('Error loading designers:', error);
                alert('Failed to load designers: ' + error.message);
            } finally {
                hideLoading();
            }
        }
        
        // Register implementation with wrapper
        window._assignDesignersImpl = assignDesigners;
        console.log('✅ assignDesigners implementation registered');
        
        // Toggle hours input when checkbox is changed
        function toggleDesignerHoursInput(checkbox) {
            const designerId = checkbox.value;
            const hoursInput = document.getElementById(`hours-${designerId}`);
            const currentHours = parseFloat(checkbox.dataset.currentHours || 0);
            
            if (checkbox.checked) {
                hoursInput.disabled = false;
                // If no hours set, default to 1 hour when checked
                // If they had previous hours, keep them
                if (!hoursInput.value || hoursInput.value === '0') {
                    hoursInput.value = currentHours > 0 ? currentHours : '1';
                }
            } else {
                hoursInput.disabled = true;
                hoursInput.value = '0';
            }
            
            updateTotalAllocated();
        }
        
        // Update total allocated hours display
        function updateTotalAllocated() {
            let total = 0;
            const hoursInputs = document.querySelectorAll('.hours-input:not([disabled])');
            hoursInputs.forEach(input => {
                const value = parseFloat(input.value) || 0;
                total += value;
            });
            
            const totalDisplay = document.getElementById('totalAllocatedHours');
            if (totalDisplay) {
                totalDisplay.textContent = total.toFixed(1);
            }
            
            // Update remaining hours if max hours are set
            const modal = document.getElementById('designerAssignmentModal');
            const maxHours = parseFloat(modal.dataset.maxHours || 0);
            
            if (maxHours > 0) {
                // Calculate remaining based on new total allocation
                const remaining = maxHours - total;
                const remainingDisplay = document.getElementById('displayRemainingHours');
                if (remainingDisplay) {
                    remainingDisplay.textContent = remaining.toFixed(1) + 'h';
                    // Change color based on remaining hours
                    if (remaining < 0) {
                        remainingDisplay.style.color = 'var(--danger)';
                        remainingDisplay.textContent = `${remaining.toFixed(1)}h (OVER!)`;
                    } else if (remaining === 0) {
                        remainingDisplay.style.color = 'var(--success)';
                        remainingDisplay.textContent = '0h (Fully Allocated)';
                    } else if (remaining < maxHours * 0.2) {
                        remainingDisplay.style.color = '#f59e0b';
                    } else {
                        remainingDisplay.style.color = 'var(--success)';
                    }
                }
                
                // Also update total display color
                if (totalDisplay) {
                    if (total > maxHours) {
                        totalDisplay.style.color = 'var(--danger)';
                    } else if (total === maxHours) {
                        totalDisplay.style.color = 'var(--success)';
                    } else {
                        totalDisplay.style.color = 'var(--primary-blue)';
                    }
                }
            }
        }

        // Function to submit designer assignment
        async function submitDesignerAssignment() {
            const projectId = document.getElementById('assignProjectId').value;
            const checkboxes = document.querySelectorAll('#designersList input[type="checkbox"]:checked');
            const modal = document.getElementById('designerAssignmentModal');
            const maxHours = parseFloat(modal.dataset.maxHours || 0);

            const designerUids = [];
            const designerNames = [];
            const designerEmails = [];
            const designerHours = {};
            let totalAllocated = 0;

            // Collect ALL checked designers (existing + new)
            let hasError = false;
            checkboxes.forEach(checkbox => {
                if (hasError) return;

                const uid = checkbox.value;
                const hoursInput = document.getElementById(`hours-${uid}`);
                const hours = parseFloat(hoursInput.value) || 0;
                const minHours = parseFloat(hoursInput.dataset.minHours || 0);

                // Cannot reduce below hours already logged (only if hours were explicitly set)
                if (hours > 0 && minHours > 0 && hours < minHours) {
                    alert(`Cannot allocate less than ${minHours.toFixed(1)}h for ${checkbox.dataset.name} — they have already logged ${minHours.toFixed(1)}h.`);
                    hasError = true;
                    return;
                }

                designerUids.push(uid);
                designerNames.push(checkbox.dataset.name);
                designerEmails.push(checkbox.dataset.email);
                designerHours[uid] = hours;
                totalAllocated += hours;
            });

            if (hasError) return;

            if (designerUids.length === 0) {
                alert('Please select at least one designer.');
                return;
            }

            // Validate total hours against max hours
            if (maxHours > 0 && totalAllocated > maxHours + 0.1) {
                alert(`⚠️ Total allocated hours (${totalAllocated.toFixed(1)}) exceeds available hours (${maxHours.toFixed(1)}). Please adjust the allocation.`);
                return;
            }

            // Confirmation
            const confirmText = `Assignment Summary:\n\n` +
                designerUids.map((uid, i) => `${designerNames[i]}${designerHours[uid] > 0 ? `: ${designerHours[uid]}h` : ' (no hours set)'}`).join('\n') +
                `\n\nTotal Hours: ${totalAllocated > 0 ? totalAllocated.toFixed(1) + 'h' : 'none (designers share project budget)'} / ${maxHours.toFixed(1)}h budget\n\nProceed?`;
            if (!confirm(confirmText)) return;

            // Prepare assignment data
            const assignmentData = {
                action: 'assign_designers',
                data: {
                    designerUids,
                    designerNames,
                    designerEmails,
                    designerHours,
                    totalAllocatedHours: totalAllocated
                }
            };

            try {
                showLoading();
                const result = await apiCall(`projects?id=${projectId}`, {
                    method: 'PUT',
                    body: JSON.stringify(assignmentData)
                });

                if (result.success) {
                    const summary = `${designerUids.length} designer(s) assigned${totalAllocated > 0 ? ` with total ${totalAllocated.toFixed(1)} hours allocated` : ''}.`;
                    showSuccessModal('Designers Updated Successfully!', summary);
                    closeDesignerAssignmentModal();

                    // Reload appropriate view based on user role
                    if (currentUserRole === 'design_lead' && typeof showDesignLeadPortal === 'function') {
                        showDesignLeadPortal();
                    } else if (typeof showProjects === 'function') {
                        showProjects();
                    }
                } else {
                    throw new Error(result.error || 'Assignment failed');
                }

            } catch (error) {
                console.error('Error assigning designers:', error);
                alert('Failed to assign designers: ' + error.message);
            } finally {
                hideLoading();
            }
        }

        // Function to view BDM uploaded files
            async function viewBDMFiles(projectId, proposalId) { // <-- Added proposalId
            try {
                showLoading();
                // Use apiCall to get files related to the original proposal
                const filesResponse = await apiCall(`files?proposalId=${proposalId}`); // <-- Use passed-in proposalId
                const allFiles = filesResponse.success ? filesResponse.data : [];
                // Filter for original project/BDM files (type 'project' or null/undefined)
                const bdmFiles = allFiles.filter(f => f.fileType === 'project' || !f.fileType);

                if (bdmFiles && bdmFiles.length > 0) {
                    displayBDMFiles(bdmFiles);
                } else {
                        showSuccessModal('No files uploaded by BDM for this project.', ''); // Use success modal for info
                }

            } catch (error) {
                console.error('Error loading BDM files:', error);
                alert('Failed to load BDM files: ' + error.message);
            } finally {
                hideLoading();
            }
        }
        
        // Register implementation with wrapper
        window._viewBDMFilesImpl = viewBDMFiles;
        console.log('✅ viewBDMFiles implementation registered');

        // Explicitly ensure functions are in global scope
        window.assignDesigners = assignDesigners;
        window._assignDesignersImpl = assignDesigners;
        window.toggleDesignerHoursInput = toggleDesignerHoursInput;
        window.updateTotalAllocated = updateTotalAllocated;
        window.submitDesignerAssignment = submitDesignerAssignment;
        window._submitDesignerAssignmentImpl = submitDesignerAssignment;
        window.viewBDMFiles = viewBDMFiles;
        
        // Create alias for viewProject (it's actually called viewProjectDetails in some places)
        window.viewProject = function(projectId) {
            // Check which function exists and call it
            if (typeof viewProjectDetails === 'function') {
                viewProjectDetails(projectId);
            } else if (typeof showProjectDetails === 'function') {
                showProjectDetails(projectId);
            } else {
                console.error('No project view function found');
                alert('Unable to view project details. Please refresh the page.');
            }
        };

        // Function to display BDM files
        function displayBDMFiles(files) {
            const modal = document.getElementById('bdmFilesModal');
            const filesList = document.getElementById('bdmFilesList');

            filesList.innerHTML = '';

            files.forEach(file => {
                const fileUrl = file.url || file.fileUrl || file.downloadUrl || '#';
                const fileName = file.originalName || file.fileName || 'Unknown File';
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <div class="file-info">
                        <span class="file-name">${fileName}</span>
                        <span class="file-size">${formatFileSize(file.fileSize)}</span>
                        <span class="file-date">${formatDate(file.uploadedAt)}</span>
                    </div>
                    <div class="file-actions">
                        <a href="${fileUrl}" target="_blank" class="btn-download">Download</a>
                    </div>
                `;
                filesList.appendChild(fileItem);
            });

            modal.style.display = 'flex';
        }
    
    

        // ============================================
        // MODAL HELPER FUNCTIONS (From new script)
        // ============================================

        function closeDesignerAssignmentModal() {
            const modal = document.getElementById('designerAssignmentModal');
            modal.style.display = 'none';
            document.getElementById('designersList').innerHTML = '';
        }
        function closeBDMFilesModal() {
            const modal = document.getElementById('bdmFilesModal');
            modal.style.display = 'none';
        }
        // ============================================
        // NEW: NOTIFICATION FUNCTIONS
        // ============================================

        let notifications = []; // Cache for notifications

        /**
         * Toggles the notification panel visibility.
         */
        function toggleNotificationPanel() {
            const panel = document.getElementById('notificationPanel');
            if (panel.style.display === 'flex') {
                panel.style.display = 'none';
            } else {
                panel.style.display = 'flex';
                loadNotifications(); // Refresh when opening
            }
        }

        /**
         * Fetches unread and recent notifications for the current user.
         */
        async function loadNotifications() {
            try {
                // This assumes your /api/notifications endpoint fetches notifications for the logged-in user
                const response = await apiCall('notifications');
                if (!response.success) {
                    throw new Error(response.error || 'Failed to load notifications');
                }

                notifications = response.data || [];
                renderNotifications(notifications);

            } catch (error) {
                console.error('Error loading notifications:', error);
                document.getElementById('notificationList').innerHTML = 
                    `<div class="notification-item">${error.message}</div>`;
            }
        }

        /**
         * Renders the fetched notifications into the panel.
         */
        function renderNotifications(data) {
    const list = document.getElementById('notificationList');
    const countBadge = document.getElementById('notificationCount');
    
    // Safely handle data if it's null/undefined
    const safeData = Array.isArray(data) ? data : [];
    const unreadCount = safeData.filter(n => !n.isRead).length;

    if (countBadge) {
        countBadge.textContent = unreadCount;
        countBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }

    if (safeData.length === 0) {
        list.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: var(--text-light);">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔕</div>
                No notifications yet.
            </div>`;
        return;
    }

    list.innerHTML = safeData.map(n => {
        // Determine icon based on type
        let icon = '🔔';
        if (n.type === 'variation_approved' || n.type?.includes('approved')) icon = '✅';
        else if (n.type === 'variation_rejected' || n.type?.includes('rejected')) icon = '❌';
        else if (n.type === 'project_allocated') icon = '🎯';
        else if (n.type === 'project_assigned') icon = '👤';
        else if (n.type === 'invoice.created') icon = '💰';
        else if (n.type?.includes('submitted')) icon = '📤';
        else if (n.type === 'leave_request') icon = '🏖️';
        else if (n.type?.includes('leave')) icon = '🏖️';

        // Ensure message exists, fallback if missing
        const message = n.message || 'New activity on your project.';

        return `
            <div class="notification-item ${!n.isRead ? 'unread' : ''}" 
                 onclick="handleNotificationClick('${n.id}', '${n.projectId || ''}', '${n.variationId || ''}', ${n.isRead})">
                <div class="notification-icon">${icon}</div>
                <div class="notification-content">
                    <div class="notification-message">${message}</div>
                    ${n.notes ? `<div style="font-size: 0.85rem; background: rgba(0,0,0,0.05); padding: 0.5rem; margin: 0.5rem 0; border-radius: 4px;">${n.notes}</div>` : ''}
                    <span class="notification-meta">${formatDate(n.createdAt)}</span>
                </div>
            </div>
        `;
    }).join('');
}

        /**
         * Handles clicking on a notification.
         */
        async function handleNotificationClick(notificationId, projectId, variationId, isRead) {
            try {
                // Mark as read only if it's unread
                if (!isRead) {
                    await apiCall(`notifications?id=${notificationId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ isRead: true })
                    });
                    
                    // Update UI immediately
                    const notif = notifications.find(n => n.id === notificationId);
                    if (notif) notif.isRead = true;
                    renderNotifications(notifications);
                }

                // Close the panel
                toggleNotificationPanel();

                // --- Navigate to the relevant item ---
                // This is where you would add navigation
                if (variationId && (currentUserRole === 'design_lead')) {
                    // If you have a modal to view variation details, open it
                    // For now, just navigate to the project
                    alert('Variation status updated. Navigating to project...');
                    viewProject(projectId); // Assuming viewProject exists
                }
                else if (projectId) {
                    // Navigate to the project
                    if (typeof viewProject === 'function') {
                        viewProject(projectId);
                    } else if (typeof viewProposal === 'function') {
                        viewProposal(projectId); // Fallback
                    }
                }

            } catch (error) {
                console.error('Error marking notification as read:', error);
            }
        }

        // Close modal when clicking outside
        window.addEventListener('click', function(event) {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                // Check if the click is directly on the modal overlay itself
                if (event.target === modal) {
                    // Check if it's one of the NEW modals before hiding
                    if (modal.id === 'allocationModal' || modal.id === 'designerAssignmentModal' || modal.id === 'bdmFilesModal' || modal.id === 'successModal') {
                       modal.style.display = 'none';
                    }
                    // For original modals, use the existing closeModal logic if needed
                    else if (event.target.classList.contains('modal-overlay')){
                       closeModal(); // Call your original close function if it exists
                    }
                }
            });
        });

    

// ==================== DIRECTOR APPROVAL & ALLOCATION FUNCTIONS ====================

function generateProposalActionButtons(proposal) {
    const actions = [];
    
    // ===== DIRECTOR APPROVE/REJECT BUTTONS =====
    if (currentUserRole === 'director') {
        const needsApprovalStatuses = ['pricing_complete', 'pending_approval', 'estimation_complete'];
        if (needsApprovalStatuses.includes(proposal.status) && 
            proposal.status !== 'approved' && proposal.status !== 'rejected') {
            actions.push(`
                <button onclick="showDirectorApprovalModal('${proposal.id}', 'approve')" class="btn btn-success btn-sm">
                    ✅ Approve
                </button>
            `);
            actions.push(`
                <button onclick="showDirectorApprovalModal('${proposal.id}', 'reject')" class="btn btn-danger btn-sm">
                    ❌ Reject
                </button>
            `);
        }
    }
    
    // ===== COO & DIRECTOR ALLOCATION BUTTON =====
    if (['coo', 'director'].includes(currentUserRole)) {
        if (proposal.status === 'won' && 
            proposal.pricing?.projectNumber && 
            !proposal.projectCreated && 
            proposal.allocationStatus !== 'allocated') {
            actions.push(`
                <button onclick="showAllocationModal('${proposal.id}')" class="btn btn-primary btn-sm">
                    🎯 Allocate to Design Manager
                </button>
            `);
        }
        
        if (proposal.allocationStatus === 'allocated' && proposal.designLeadName) {
            actions.push(`
                <span class="allocation-status" style="color: var(--success); font-weight: 600;">
                    ✅ Allocated to: ${proposal.designLeadName}
                </span>
            `);
        }
    }
    
    actions.push(`
        <button onclick="viewProposal('${proposal.id}')" class="btn btn-outline btn-sm">
            👁️ View Details
        </button>
    `);
    
    return `<div class="action-buttons">${actions.join('')}</div>`;
}

function showDirectorApprovalModal(proposalId, actionType) {
    const isApprove = actionType === 'approve';
    const title = isApprove ? 'Approve Proposal' : 'Reject Proposal';
    const buttonClass = isApprove ? 'btn-success' : 'btn-danger';
    const buttonText = isApprove ? '✅ Approve' : '❌ Reject';
    
    const modalHtml = `
        <div class="modal-overlay" onclick="if(event.target === this) closeModal()">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <span class="close-modal" onclick="closeModal()">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="form-section" style="background: ${isApprove ? 'var(--light-blue)' : '#fff3cd'}; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem;">
                        <h4 style="color: ${isApprove ? 'var(--primary-blue)' : 'var(--warning)'};">
                            ${isApprove ? '✅ Approve this proposal?' : '⚠️ Reject this proposal?'}
                        </h4>
                        <p style="margin-top: 0.5rem;">
                            ${isApprove 
                                ? 'Approving will allow the BDM to submit this proposal to the client.' 
                                : 'Rejecting will send this proposal back with your feedback.'}
                        </p>
                    </div>
                    <form id="directorApprovalForm">
                        <input type="hidden" id="approvalProposalId" value="${proposalId}">
                        <input type="hidden" id="approvalAction" value="${actionType}">
                        ${!isApprove ? `
                            <div class="form-group">
                                <label for="rejectionReason">Rejection Reason <span class="required">*</span></label>
                                <textarea id="rejectionReason" class="form-control" rows="3" 
                                    placeholder="Please provide a clear reason for rejection..." required></textarea>
                                <small class="form-text">This will be sent to the BDM and COO</small>
                            </div>
                        ` : ''}
                        <div class="form-group">
                            <label for="approvalComments">Additional Comments ${!isApprove ? '(Optional)' : ''}</label>
                            <textarea id="approvalComments" class="form-control" rows="3" 
                                placeholder="Add any additional notes or instructions..."></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" onclick="closeModal()" class="btn btn-outline">Cancel</button>
                    <button type="button" onclick="submitDirectorApproval()" class="btn ${buttonClass}">
                        ${buttonText}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

async function submitDirectorApproval() {
    const proposalId = document.getElementById('approvalProposalId').value;
    const actionType = document.getElementById('approvalAction').value;
    const comments = document.getElementById('approvalComments').value;
    const isApprove = actionType === 'approve';
    
    if (!isApprove) {
        const reason = document.getElementById('rejectionReason').value.trim();
        if (!reason) {
            alert('Please provide a reason for rejection');
            return;
        }
    }
    
    try {
        showLoading();
        const requestData = {
            action: isApprove ? 'approve_proposal' : 'reject_proposal',
            data: { comments: comments }
        };
        
        if (!isApprove) {
            requestData.data.reason = document.getElementById('rejectionReason').value.trim();
        }
        
        const response = await apiCall(`proposals?id=${proposalId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
        
        if (response.success) {
            closeModal();
            showSuccessModal(
                isApprove ? 'Proposal Approved!' : 'Proposal Rejected',
                isApprove 
                    ? 'The proposal has been approved and BDM has been notified.' 
                    : 'The proposal has been rejected and BDM has been notified with your feedback.'
            );
            setTimeout(() => { showProposals(); }, 1500);
        } else {
            throw new Error(response.error || 'Failed to process approval/rejection');
        }
    } catch (error) {
        console.error('Error processing approval/rejection:', error);
        alert('Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function showAllocationModal(proposalId) {
    try {
        showLoading();
        const proposalResponse = await apiCall(`proposals?id=${proposalId}`);
        if (!proposalResponse.success || !proposalResponse.data) {
            throw new Error('Failed to load proposal');
        }
        const proposal = proposalResponse.data;
        
        if (proposal.status !== 'won') {
            alert('Only WON proposals can be allocated to Design Managers');
            hideLoading();
            return;
        }
        
        if (!proposal.pricing?.projectNumber) {
            alert('This proposal does not have a project number yet. Please assign a project number first.');
            hideLoading();
            return;
        }
        
        const usersResponse = await apiCall('users?role=design_lead');
        let designManagers = [];
        if (usersResponse.success && usersResponse.data) {
            designManagers = usersResponse.data;
        }
        
        if (designManagers.length === 0) {
            alert('No Design Managers found in the system. Please create Design Manager users first.');
            hideLoading();
            return;
        }
        
        const modalHtml = `
           <div class="modal-overlay" onclick="if(event.target === this) closeModal()">
                <div class="modal-content allocation-modal-large" style="max-width: 800px;">
                    <div class="modal-header">
                        <div>
                            <h2>🎯 Allocate Project to Design Manager</h2>
                            <div class="subtitle">${proposal.projectName} - ${proposal.clientCompany}</div>
                        </div>
                        <span class="close-modal" onclick="closeModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="allocation-details-section">
                            <h3>📋 Project Information</h3>
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem;">
                                <div style="grid-column: 1 / -1; background: white; padding: 1rem; border-radius: 8px; border-left: 4px solid var(--success);">
                                    <label style="font-weight: 600; color: var(--text-light); font-size: 0.85rem; margin-bottom: 0.3rem; display: block;">
                                        🔢 Project Number:
                                    </label>
                                    <span class="project-number-badge" style="font-size: 1.3rem; padding: 0.7rem 1.2rem;">
                                        ${proposal.pricing.projectNumber}
                                    </span>
                                </div>
                                <div>
                                    <label style="font-weight: 600; color: var(--text-light); font-size: 0.85rem; display: block;">Quote Value:</label>
                                    <span style="font-weight: 600; color: var(--text-dark); font-size: 1.1rem;">
                                        ${proposal.pricing.currency} ${proposal.pricing.quoteValue?.toLocaleString()}
                                    </span>
                                </div>
                                <div>
                                    <label style="font-weight: 600; color: var(--text-light); font-size: 0.85rem; display: block;">Status:</label>
                                    <span class="proposal-status status-won">WON</span>
                                </div>
                                <div>
                                    <label style="font-weight: 600; color: var(--text-light); font-size: 0.85rem; display: block;">BDM:</label>
                                    <span style="font-weight: 600; color: var(--text-dark); font-size: 1.1rem;">
                                        ${proposal.createdByName || 'N/A'}
                                    </span>
                                </div>
                                <div>
                                    <label style="font-weight: 600; color: var(--text-light); font-size: 0.85rem; display: block;">Client:</label>
                                    <span style="font-weight: 600; color: var(--text-dark); font-size: 1.1rem;">
                                        ${proposal.clientCompany}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div style="margin-top: 2rem;">
                            <h3 style="color: var(--text-dark); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--border);">
                                👤 Allocation Details
                            </h3>
                            <form id="allocationForm">
                                <input type="hidden" id="allocationProposalId" value="${proposalId}">
                                <input type="hidden" id="allocationProjectName" value="${projectName}">
                                <div class="form-group">
                                    <label for="designManagerSelect">Select Design Manager <span class="required">*</span></label>
                                    <select id="designManagerSelect" class="form-control" required>
                                        <option value="">Choose a Design Manager...</option>
                                        ${designManagers.map(dm => `
                                            <option value="${dm.uid}" data-name="${dm.name}" data-email="${dm.email}">
                                                ${dm.name} (${dm.email})
                                            </option>
                                        `).join('')}
                                    </select>
                                    <small class="form-text">Select the Design Manager who will oversee this project</small>
                                </div>
                                <div class="form-group">
                                    <label for="maxAllocatedHours">Max Allocated Hours <span class="required">*</span></label>
                                    <input type="number" id="maxAllocatedHours" class="form-control" 
                                           step="0.5" min="1" placeholder="Enter maximum hours allocated for this project" required>
                                    <small class="form-text">Total hours budget allocated by COO/Director for this project</small>
                                </div>
                                <div class="form-group">
                                    <label for="additionalHours">Additional Hours Provision</label>
                                    <input type="number" id="additionalHours" class="form-control" 
                                           step="0.5" min="0" value="0" placeholder="Enter buffer hours (optional)">
                                    <small class="form-text">Extra hours that can be allocated if needed (buffer)</small>
                                </div>
                                <div class="form-group">
                                    <label for="targetCompletionDate">Target Completion Date</label>
                                    <input type="date" id="targetCompletionDate" class="form-control"
                                         min="${new Date().toISOString().split('T')[0]}">
                                    <small class="form-text">Expected project completion date</small>
                                </div>
                                <div class="form-group">
                                    <label for="projectPriority">Project Priority</label>
                                    <select id="projectPriority" class="form-control">
                                        <option value="Normal">Normal</option>
                                        <option value="High">High</option>
                                        <option value="Urgent">Urgent</option>
                                        <option value="Low">Low</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="allocationComments2">Allocation Comments <span class="required">*</span></label>
                                    <textarea id="allocationComments2" class="form-control" rows="4"
                                         placeholder="Add instructions, notes, or special requirements for the Design Manager..." required></textarea>
                                    <small class="form-text">Provide clear guidance and expectations for this project</small>
                                </div>
                                <div class="form-group">
                                    <label for="specialInstructions2">Special Instructions</label>
                                    <textarea id="specialInstructions2" class="form-control" rows="3"
                                         placeholder="Add any special client requirements, constraints, or important notes..."></textarea>
                                </div>
                            </form>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" onclick="closeModal()" class="btn btn-outline">Cancel</button>
                        <button type="button" onclick="submitProjectAllocation()" class="btn btn-success btn-large">
                            <span class="btn-icon">✓</span> Allocate Project
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        hideLoading();
    } catch (error) {
        console.error('Error showing allocation modal:', error);
        alert('Error loading allocation form: ' + error.message);
        hideLoading();
    }
}

// Submit Allocation - FIXED VERSION
async function submitProposalAllocation() {
    const proposalId = document.getElementById('allocationProposalId').value;
    const designManagerSelect = document.getElementById('designManagerSelect');
    const designManagerUid = designManagerSelect.value;
    const targetCompletionDate = document.getElementById('targetCompletionDate').value;
    const projectPriority = document.getElementById('projectPriority').value;
    const allocationComments = document.getElementById('allocationComments2').value.trim();
    const specialInstructions = document.getElementById('specialInstructions2').value.trim();
    const maxAllocatedHours = document.getElementById('maxAllocatedHours').value;
    const additionalHours = document.getElementById('additionalHours').value || 0;
    
    // FIXED: Proper validation
    if (!designManagerUid) {
        alert('⚠️ Please select a Design Manager');
        document.getElementById('designManagerSelect').focus();
        return;
    }
    
    // Validate max hours
    if (!maxAllocatedHours || parseFloat(maxAllocatedHours) < 1) {
        alert('⚠️ Please enter max allocated hours (minimum 1 hour)');
        document.getElementById('maxAllocatedHours').focus();
        return;
    }
    
    // FIXED: Better validation message with minimum character requirement
    if (!allocationComments || allocationComments.length < 10) {
        alert('⚠️ Please add allocation comments (at least 10 characters)');
        document.getElementById('allocationComments2').focus();
        return;
    }
    
    try {
        showLoading();
        const selectedOption = designManagerSelect.options[designManagerSelect.selectedIndex];
        const designManagerName = selectedOption.getAttribute('data-name');
        const designManagerEmail = selectedOption.getAttribute('data-email');
        
        // Create project from proposal
        const createProjectResponse = await apiCall('projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'create_from_proposal',
                proposalId: proposalId
            })
        });
        
        if (!createProjectResponse.success) {
            const proposalResponse = await apiCall(`proposals?id=${proposalId}`);
            if (!proposalResponse.data.projectId) {
                throw new Error('Failed to create project: ' + (createProjectResponse.error || 'Unknown error'));
            }
        }
        
        // Get the project ID
        const proposalResponse = await apiCall(`proposals?id=${proposalId}`);
        const projectId = proposalResponse.data.projectId;
        
        if (!projectId) {
            throw new Error('Project ID not found');
        }
        
        // Allocate to design lead
        const allocationData = {
            designLeadUid: designManagerUid,
            targetCompletionDate: targetCompletionDate || null,
            priority: projectPriority,
            allocationNotes: allocationComments,
            specialInstructions: specialInstructions,
            maxAllocatedHours: parseFloat(maxAllocatedHours),
            additionalHours: parseFloat(additionalHours)
        };
        
        const response = await apiCall(`projects?id=${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'allocate_to_design_lead',
                data: allocationData
            })
        });
        
        if (response.success) {
            // Update proposal allocation status
            await apiCall(`proposals?id=${proposalId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_allocation_status',
                    data: {
                        allocationStatus: 'allocated',
                        designLeadName: designManagerName,
                        designLeadUid: designManagerUid,
                        allocatedAt: new Date().toISOString()
                    }
                })
            });
            
            closeModal();
            alert(`✅ Project Allocated Successfully!\n\nProject has been allocated to ${designManagerName} with ${maxAllocatedHours} hours (+${additionalHours} buffer). They will be notified immediately.`);
            const projectName = document.getElementById('allocationProjectName')?.value || 'Unknown Project'; // <-- ADD THIS
                triggerEmailNotification('project.allotment_', { projectName: projectName, designerEmail: designManagerEmail }); // <-- ADD THIS
            
            setTimeout(() => {
                showProposals();
            }, 1000);
        } else {
            throw new Error(response.error || 'Failed to allocate project');
        }
    } catch (error) {
        console.error('Error allocating project:', error);
        alert('❌ Error allocating project: ' + error.message);
    } finally {
        hideLoading();
    }
}


    
        function switchDesignerTab(tabName) {
            // Update tab buttons
            document.querySelectorAll('.doc-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            event.target.classList.add('active');
            
            // Update content visibility
            document.getElementById('designer-drawings-content').style.display = 'none';
            document.getElementById('designer-specs-content').style.display = 'none';
            
            if (tabName === 'drawings') {
                document.getElementById('designer-drawings-content').style.display = 'block';
            } else {
                document.getElementById('designer-specs-content').style.display = 'block';
            }
        }


        // ============================================
        // GLOBAL FUNCTION ASSIGNMENTS FOR ONCLICK HANDLERS
        // ============================================
        // Ensure all functions called via onclick are in global scope
        
        // Modal functions
        window.closeModal = closeModal;
        if (typeof closeProjectDetailsModal !== 'undefined') window.closeProjectDetailsModal = closeProjectDetailsModal;
        if (typeof closeDesignerAssignmentModal !== 'undefined') window.closeDesignerAssignmentModal = closeDesignerAssignmentModal;
        if (typeof closeBDMFilesModal !== 'undefined') window.closeBDMFilesModal = closeBDMFilesModal;
        if (typeof closeCooMultiDesignerModal !== 'undefined') window.closeCooMultiDesignerModal = closeCooMultiDesignerModal;
        
        // Proposal functions
        if (typeof viewProposal !== 'undefined') window.viewProposal = viewProposal;
        if (typeof showEstimationModal !== 'undefined') window.showEstimationModal = showEstimationModal;
        if (typeof submitEstimation !== 'undefined') window.submitEstimation = submitEstimation;
        if (typeof showCOOPricingForm !== 'undefined') window.showCOOPricingForm = showCOOPricingForm;
        if (typeof submitCOOPricing !== 'undefined') window.submitCOOPricing = submitCOOPricing;
        if (typeof markProposalWon !== 'undefined') window.markProposalWon = markProposalWon;
        if (typeof markProposalLost !== 'undefined') window.markProposalLost = markProposalLost;
        if (typeof filterProposals !== 'undefined') window.filterProposals = filterProposals;
        
        // Project functions
        if (typeof showProjectAllocationModal !== 'undefined') window.showProjectAllocationModal = showProjectAllocationModal;
        if (typeof showProposals !== 'undefined') window.showProposals = showProposals;
        if (typeof showProjects !== 'undefined') window.showProjects = showProjects;
        if (typeof filterProjects !== 'undefined') window.filterProjects = filterProjects;
        if (typeof showDesignLeadPortal !== 'undefined') window.showDesignLeadPortal = showDesignLeadPortal;
        if (typeof filterDesignLeadProjects !== 'undefined') window.filterDesignLeadProjects = filterDesignLeadProjects;
        if (typeof showDesignLeadTimesheet !== 'undefined') window.showDesignLeadTimesheet = showDesignLeadTimesheet;
        
        // File functions
        if (typeof downloadFile !== 'undefined') window.downloadFile = downloadFile;
        if (typeof deleteFile !== 'undefined') window.deleteFile = deleteFile;
        
        // Tab/Navigation functions
        if (typeof showTab !== 'undefined') window.showTab = showTab;
        if (typeof setActiveNav !== 'undefined') window.setActiveNav = setActiveNav;
        if (typeof switchTab !== 'undefined') window.switchTab = switchTab;
        if (typeof switchDesignerTab !== 'undefined') window.switchDesignerTab = switchDesignerTab;
        
        // Dashboard functions
        if (typeof showExecutiveDashboard !== 'undefined') window.showExecutiveDashboard = showExecutiveDashboard;
        if (typeof showProjectDashboard !== 'undefined') window.showProjectDashboard = showProjectDashboard;
        if (typeof filterProjectDashboardTable !== 'undefined') window.filterProjectDashboardTable = filterProjectDashboardTable;
        if (typeof showExecutiveSection !== 'undefined') window.showExecutiveSection = showExecutiveSection;
        if (typeof switchExecutiveTab !== 'undefined') window.switchExecutiveTab = switchExecutiveTab;
        
        // Time request functions
        if (typeof reviewTimeRequest !== 'undefined') window.reviewTimeRequest = reviewTimeRequest;
        if (typeof closeRequestTimeModal !== 'undefined') window.closeRequestTimeModal = closeRequestTimeModal;
        
        // Payment functions
        if (typeof viewPayment !== 'undefined') window.viewPayment = viewPayment;
        
        // ============================================
        // ✅ MODAL HELPER FUNCTIONS - Must be defined before designer functions
        // ============================================
        
        window.closeAllModals = function() {
            const modals = document.querySelectorAll('.modal-overlay');
            modals.forEach(modal => modal.remove());
            document.body.classList.remove('modal-open');
        };
        
        window.handleModalOverlayClick = function(event, modalId) {
            if (event.target.id === modalId) {
                document.getElementById(modalId).remove();
                document.body.classList.remove('modal-open');
            }
        };
        
        window.closeTimesheetModal = function() {
            const modal = document.getElementById('timesheetModalOverlay');
            if (modal) modal.remove();
            document.body.classList.remove('modal-open');
        };
        
        window.closeProjectFilesModal = function() {
            const modal = document.getElementById('projectFilesModal');
            if (modal) modal.remove();
            document.body.classList.remove('modal-open');
        };
        
        window.closeProjectDetailsModal = function() {
            const modal = document.getElementById('projectDetailsModal');
            if (modal) modal.remove();
            document.body.classList.remove('modal-open');
        };
        
        window.closeDesignerUploadModal = function() {
            const modal = document.getElementById('designerUploadModal');
            if (modal) modal.remove();
            document.body.classList.remove('modal-open');
        };
        
        console.log('✅ Modal helper functions registered');
        
        // ============================================
        // ✅ WORK TYPE CHANGE HANDLER (Training/Sample Designing)
        // ============================================
        window.handleWorkTypeChange = function() {
            const workType = document.getElementById('timesheetWorkType')?.value;
            const projectGroup = document.getElementById('projectSelectionGroup');
            const projectSelect = document.getElementById('timesheetProjectId');
            const nonProjectBanner = document.getElementById('nonProjectInfoBanner');
            const nonProjectIcon = document.getElementById('nonProjectIcon');
            const nonProjectTitle = document.getElementById('nonProjectTitle');
            const allocationInfo = document.getElementById('timesheetAllocationInfo');
            
            if (workType === 'project') {
                // Show project selection
                if (projectGroup) projectGroup.style.display = 'block';
                if (projectSelect) projectSelect.required = true;
                if (nonProjectBanner) nonProjectBanner.style.display = 'none';
                if (allocationInfo) allocationInfo.style.display = 'block';
            } else {
                // Hide project selection for Training/Sample Designing
                if (projectGroup) projectGroup.style.display = 'none';
                if (projectSelect) {
                    projectSelect.required = false;
                    projectSelect.value = '';
                }
                if (allocationInfo) allocationInfo.style.display = 'none';
                
                // Show appropriate banner
                if (nonProjectBanner) {
                    nonProjectBanner.style.display = 'block';
                    if (workType === 'training') {
                        nonProjectBanner.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                        if (nonProjectIcon) nonProjectIcon.textContent = '📚';
                        if (nonProjectTitle) nonProjectTitle.textContent = 'Training Hours';
                    } else if (workType === 'sample_designing') {
                        nonProjectBanner.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
                        if (nonProjectIcon) nonProjectIcon.textContent = '🎨';
                        if (nonProjectTitle) nonProjectTitle.textContent = 'Sample Designing Hours';
                    }
                }
            }
        };
        
        // ============================================
        // ✅ SUBMIT TIMESHEET FUNCTION - MUST BE DEFINED EARLY
        // ============================================
        window.submitTimesheet = async function() {
            console.log('📝 submitTimesheet called');
            
            const workType = document.getElementById('timesheetWorkType')?.value || 'project';
            const projectId = document.getElementById('timesheetProjectId')?.value;
            const date = document.getElementById('timesheetDate')?.value;
            const hours = parseFloat(document.getElementById('timesheetHours')?.value);
            const description = document.getElementById('timesheetDescription')?.value?.trim();
            
            console.log('📝 Form data:', { workType, projectId, date, hours, description });
            
            // Validation
            if (!date || !hours || !description) {
                alert('Please fill all required fields');
                return;
            }
            
            // Project is required only for project work
            if (workType === 'project' && !projectId) {
                alert('Please select a project');
                return;
            }
            
            if (hours <= 0 || hours > 24) {
                alert('Hours must be between 0.25 and 24');
                return;
            }

            // For project work, do allocation check
            if (workType === 'project') {
                const projectSelect = document.getElementById('timesheetProjectId');
                if (projectSelect) {
                    const selectedOption = projectSelect.options[projectSelect.selectedIndex];
                    const allocated = parseFloat(selectedOption?.dataset?.allocated) || 0;
                    const logged = parseFloat(selectedOption?.dataset?.logged) || 0;
                    const remaining = allocated - logged;
                    const newTotal = logged + hours;

                    // HARD BLOCK: all allocated hours are exhausted — design lead must request more
                    if (allocated > 0 && remaining <= 0) {
                        alert('⛔ Hours Exhausted\n\nAll allocated hours for this project have been used up.\n\nThe Design Lead must request additional hours from the COO and get them approved before you can log more hours on this project.');
                        return;
                    }

                    if (newTotal > allocated && allocated > 0) {
                        console.warn(`Allocation exceeded: ${newTotal} > ${allocated}`);

                        const allocationData = {
                            totalHours: logged,
                            allocatedHours: allocated,
                            exceededBy: newTotal - allocated
                        };
                        const timesheetData = { projectId, date, hours, description };

                        closeTimesheetModal();
                        if (typeof showRequestAdditionalTimeModal === 'function') {
                            showRequestAdditionalTimeModal(allocationData, timesheetData);
                        } else {
                            alert('You have exceeded your allocated hours (' + allocated + 'h). Please contact COO for additional time.');
                        }
                        return;
                    }
                }
            }
            
            try {
                showLoading();
                console.log('📤 Submitting timesheet to API...');
                
                // Build request body based on work type
                const requestBody = {
                    date,
                    hours,
                    description,
                    workType
                };
                
                if (workType === 'project') {
                    requestBody.projectId = projectId;
                } else {
                    // For training/sample designing, use special project IDs
                    requestBody.projectId = workType === 'training' ? 'TRAINING' : 'SAMPLE_DESIGNING';
                    requestBody.isNonProjectWork = true;
                }
                
                const response = await apiCall('timesheets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });
                
                console.log('📥 API Response:', response);
                
                if (response.success) {
                    closeTimesheetModal();
                    const workTypeLabel = workType === 'training' ? 'Training' :
                                          workType === 'sample_designing' ? 'Sample Designing' : 'Project';
                    alert(`✅ ${hours} hours logged successfully for ${workTypeLabel} on ${date}!`);

                    // Refresh the appropriate view based on role
                    if (currentUserRole === 'design_lead' && typeof showDesignLeadPortal === 'function') {
                        showDesignLeadPortal();
                    } else if (typeof showDesignerAllocations === 'function') {
                        showDesignerAllocations();
                    }

                } else if (response.hoursExhausted) {
                    hideLoading();
                    closeTimesheetModal();
                    alert('⛔ Hours Exhausted\n\nAll allocated hours for this project have been used up.\n\nThe Design Lead must request additional hours from the COO and get them approved before you can log more hours on this project.');

                } else if (response.exceedsAllocation) {
                    hideLoading();
                    closeTimesheetModal();
                    if (typeof showRequestAdditionalTimeModal === 'function') {
                        showRequestAdditionalTimeModal(response, { projectId, date, hours, description });
                    } else {
                        alert('You have exceeded your allocated hours. Please contact COO for additional time.');
                    }

                } else {
                    throw new Error(response.error || 'Failed to log hours');
                }
                
            } catch (error) {
                console.error('❌ Error submitting timesheet:', error);
                alert('Error logging hours: ' + error.message);
            } finally {
                hideLoading();
            }
        };
        
        console.log('✅ submitTimesheet function registered');
        
        // ============================================
        // ✅ FILE DOWNLOAD FUNCTION
        // ============================================
        window.downloadFile = async function(fileUrl, fileName) {
            console.log('⬇️ Downloading file:', fileName, 'from:', fileUrl);
            try {
                // Show loading indicator
                const btn = event.target;
                const originalText = btn.innerHTML;
                btn.innerHTML = '⏳ Downloading...';
                btn.disabled = true;
                
                // Fetch the file
                const response = await fetch(fileUrl);
                if (!response.ok) {
                    throw new Error('Failed to fetch file');
                }
                
                // Get the blob
                const blob = await response.blob();
                
                // Create download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = fileName || 'download';
                document.body.appendChild(a);
                a.click();
                
                // Cleanup
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                // Restore button
                btn.innerHTML = originalText;
                btn.disabled = false;
                
                console.log('✅ Download completed:', fileName);
            } catch (error) {
                console.error('❌ Download failed:', error);
                // Fallback: Open in new tab
                window.open(fileUrl, '_blank');
                
                // Restore button if available
                if (event && event.target) {
                    event.target.innerHTML = '⬇️ Download';
                    event.target.disabled = false;
                }
            }
        };
        
        console.log('✅ Download function registered');
        
        // ✅ FIX: Forward declarations for designer functions defined in second script block
        // These functions are fully implemented later in the file but need to be accessible from HTML
        // FIXED: Implementing functions directly here instead of waiting for later definitions
        
        window.showTasks = async function() {
            console.log('🔄 showTasks called');
            setActiveNav('nav-tasks');
            const main = document.getElementById('mainContent');
            main.style.display = 'block';
            showLoading();
            
            try {
                // Fetch projects assigned to this designer
                const response = await apiCall('projects?assignedToMe=true');
                
                if (!response.success) {
                    throw new Error('Failed to load projects');
                }
                
                let rawProjects = response.data || [];
                
                // Ensure specific client-side filtering just in case backend returns all
                const projects = rawProjects.filter(p => 
                    (p.assignedDesigners && p.assignedDesigners.includes(currentUser.uid)) ||
                    (p.assignedDesignerUids && p.assignedDesignerUids.includes(currentUser.uid))
                );
                
                const projectsHtml = projects.length > 0 ? projects.map(project => `
                    <div class="project-card" style="background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid var(--border);">
                        <div class="project-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0; color: var(--text-dark);">${project.projectName || 'Untitled Project'}</h3>
                            <span class="project-status" style="padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem; background: var(--light-blue); color: var(--primary-blue);">${project.status || 'N/A'}</span>
                        </div>
                        <div class="project-details" style="margin-bottom: 1rem; color: var(--text-light);">
                            <p style="margin: 0.5rem 0;"><strong>Client:</strong> ${project.clientCompany || 'N/A'}</p>
                            <p style="margin: 0.5rem 0;"><strong>Project Code:</strong> ${project.projectCode || 'N/A'}</p>
                            <p style="margin: 0.5rem 0;"><strong>Target Date:</strong> ${project.targetCompletionDate ? formatDate(project.targetCompletionDate) : 'Not set'}</p>
                            <p style="margin: 0.5rem 0;"><strong>Status:</strong> ${project.designStatus || 'N/A'}</p>
                            <p style="margin: 0.5rem 0;"><strong>Design Manager:</strong> ${project.designLeadName || 'N/A'}</p>
                        </div>
                        <div class="project-actions" style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-primary" onclick="showDesignerUploadModal('${project.id}')">
                                📤 Upload Files
                            </button>
                            <button class="btn btn-outline" onclick="viewProjectDetails('${project.id}')">
                                👁️ View Details
                            </button>
                        </div>
                    </div>
                `).join('') : '<p style="text-align: center; padding: 2rem; color: var(--text-light);">No projects assigned yet.</p>';
                
                main.innerHTML = `
                    <div class="page-header">
                        <h2>📋 My Tasks</h2>
                        <p class="subtitle">Projects assigned to you</p>
                    </div>
                    
                    <div class="dashboard-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                        <div class="stat-card" style="background: white; padding: 1.5rem; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <div class="stat-number" style="font-size: 2.5rem; font-weight: 700; color: var(--primary-blue);">${projects.length}</div>
                            <div class="stat-label" style="color: var(--text-light);">Total Projects</div>
                        </div>
                        <div class="stat-card" style="background: white; padding: 1.5rem; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <div class="stat-number" style="font-size: 2.5rem; font-weight: 700; color: var(--success);">${projects.filter(p => p.status === 'active' || p.status === 'in_progress').length}</div>
                            <div class="stat-label" style="color: var(--text-light);">Active Projects</div>
                        </div>
                        <div class="stat-card" style="background: white; padding: 1.5rem; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            <div class="stat-number" style="font-size: 2.5rem; font-weight: 700; color: var(--accent-blue);">${projects.filter(p => p.status === 'completed').length}</div>
                            <div class="stat-label" style="color: var(--text-light);">Completed</div>
                        </div>
                    </div>
                    
                    <div class="action-section" style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <h3 style="margin-bottom: 1.5rem;">Your Projects</h3>
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.5rem;">
                            ${projectsHtml}
                        </div>
                    </div>
                `;
                
            } catch (error) {
                console.error('Error loading tasks:', error);
                main.innerHTML = `<div class="error-message" style="background: #fee; padding: 2rem; border-radius: 12px; text-align: center;"><h3>⚠️ Error Loading Projects</h3><p>${error.message}</p><button onclick="showTasks()" class="btn btn-primary" style="margin-top: 1rem;">Retry</button></div>`;
            } finally {
                hideLoading();
            }
        };
        
        window.showTimesheet = async function() {
            console.log('🔄 showTimesheet called');
            setActiveNav('nav-timesheet');
            const main = document.getElementById('mainContent');
            main.style.display = 'block';
            showLoading();
            
            try {
                console.log('⏱️ Loading Timesheet...');
                
                // Load designer's projects and timesheet entries
                const projectsResponse = await apiCall('projects?assignedToMe=true');
                const timesheetResponse = await apiCall('timesheets');
                
                let projects = [];
                let entries = [];
                
                if (projectsResponse.success) {
                    const rawProjects = projectsResponse.data || [];
                    projects = rawProjects.filter(p =>
                        (p.assignedDesigners && p.assignedDesigners.includes(currentUser.uid)) ||
                        (p.assignedDesignerUids && p.assignedDesignerUids.includes(currentUser.uid)) ||
                        p.designLeadUid === currentUser.uid
                    );
                }
                
                if (timesheetResponse.success) {
                    entries = timesheetResponse.data || [];
                }
                
                // Calculate summary - helper function to parse date from various formats
                const parseEntryDate = (dateValue) => {
                    if (!dateValue) return null;
                    // Handle Firebase Timestamp object
                    if (dateValue && (dateValue.seconds || dateValue._seconds)) {
                        const seconds = dateValue.seconds || dateValue._seconds;
                        return new Date(seconds * 1000);
                    }
                    // Handle toDate method (Firestore Timestamp)
                    if (dateValue && typeof dateValue.toDate === 'function') {
                        return dateValue.toDate();
                    }
                    // Handle numeric timestamp
                    if (typeof dateValue === 'number') {
                        return new Date(dateValue);
                    }
                    // Handle string date
                    if (typeof dateValue === 'string') {
                        return new Date(dateValue);
                    }
                    // Handle Date object
                    if (dateValue instanceof Date) {
                        return dateValue;
                    }
                    return null;
                };
                
                const isThisWeek = (dateValue) => {
                    const date = parseEntryDate(dateValue);
                    if (!date || isNaN(date.getTime())) return false;
                    const now = new Date();
                    const weekStart = new Date(now);
                    weekStart.setDate(now.getDate() - now.getDay());
                    weekStart.setHours(0, 0, 0, 0);
                    return date >= weekStart;
                };
                
                const isThisMonth = (dateValue) => {
                    const date = parseEntryDate(dateValue);
                    if (!date || isNaN(date.getTime())) return false;
                    const now = new Date();
                    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                };
                
                const thisWeekHours = entries
                    .filter(e => isThisWeek(e.date))
                    .reduce((sum, e) => sum + parseFloat(e.hours || 0), 0);
                
                const thisMonthHours = entries
                    .filter(e => isThisMonth(e.date))
                    .reduce((sum, e) => sum + parseFloat(e.hours || 0), 0);
                
                // Build project lookup map for project number display
                const projectLookup = {};
                projects.forEach(p => { if (p.id) projectLookup[p.id] = p; });

                // Build entries table with proper date formatting and project number
                const entriesHtml = entries.length > 0 ? entries.slice(0, 20).map(entry => {
                    const entryDate = parseEntryDate(entry.date);
                    const formattedDate = entryDate && !isNaN(entryDate.getTime())
                        ? entryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                        : 'N/A';
                    const proj = projectLookup[entry.projectId];
                    const projNum = entry.projectNumber || proj?.projectNumber || null;
                    const projectDisplay = projNum
                        ? `<span style="font-weight:700;color:var(--primary-blue);">${projNum}</span> <small style="color:#6b7280;">${entry.projectName || ''}</small>`
                        : (entry.projectName || entry.projectCode || 'Unknown Project');
                    const entryDateForEdit = entryDate && !isNaN(entryDate.getTime()) 
                        ? entryDate.toISOString().split('T')[0] 
                        : '';
                    const escapedDescription = (entry.description || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    const escapedProjectName = (entry.projectName || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    return `
                    <tr>
                        <td>${formattedDate}</td>
                        <td>${projectDisplay}</td>
                        <td><strong>${parseFloat(entry.hours || 0).toFixed(2)}h</strong></td>
                        <td>${entry.description || 'No description'}</td>
                        <td><span style="padding: 0.25rem 0.5rem; border-radius: 4px; background: ${entry.status === 'approved' ? '#d4edda' : '#fff3cd'}; color: ${entry.status === 'approved' ? '#155724' : '#856404'};">${entry.status || 'Pending'}</span></td>
                        <td style="white-space: nowrap;">
                            <button onclick="editTimesheetEntry('${entry.id}', '${entry.projectId || ''}', '${entryDateForEdit}', ${parseFloat(entry.hours || 0)}, '${escapedDescription}', '${escapedProjectName}')" 
                                class="btn btn-sm" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; background: var(--accent-blue); color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 0.25rem;">
                                ✏️ Edit
                            </button>
                            <button onclick="deleteTimesheetEntry('${entry.id}')" 
                                class="btn btn-sm btn-danger" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; background: var(--danger); color: white; border: none; border-radius: 6px; cursor: pointer;">
                                🗑️ Delete
                            </button>
                        </td>
                    </tr>
                `}).join('') : `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-light);">No timesheet entries yet. Click "Log Hours" to add your first entry.</td></tr>`;
                
                main.innerHTML = `
                    <div class="page-header">
                        <h2>⏱️ My Timesheet</h2>
                        <p class="subtitle">Track your hours on assigned projects</p>
                    </div>
                    
                    <div class="card" style="background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                            <h3 style="margin: 0;">Log Hours</h3>
                            <button onclick="showTimesheetModal()" class="btn btn-primary">
                                <span>+</span> Log Hours
                            </button>
                        </div>
                        
                        <!-- Timesheet Summary -->
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; padding: 1rem;">
                            <div class="stat-card" style="background: white; border: 2px solid var(--border); border-radius: 10px; padding: 1rem; text-align: center;">
                                <div style="font-size: 0.9rem; color: var(--text-light); margin-bottom: 0.5rem;">This Week</div>
                                <div style="font-size: 2.5rem; font-weight: 700; color: var(--primary-blue);">${thisWeekHours.toFixed(1)}h</div>
                            </div>
                            <div class="stat-card" style="background: white; border: 2px solid var(--border); border-radius: 10px; padding: 1rem; text-align: center;">
                                <div style="font-size: 0.9rem; color: var(--text-light); margin-bottom: 0.5rem;">This Month</div>
                                <div style="font-size: 2.5rem; font-weight: 700; color: var(--primary-blue);">${thisMonthHours.toFixed(1)}h</div>
                            </div>
                            <div class="stat-card" style="background: white; border: 2px solid var(--border); border-radius: 10px; padding: 1rem; text-align: center;">
                                <div style="font-size: 0.9rem; color: var(--text-light); margin-bottom: 0.5rem;">Active Projects</div>
                                <div style="font-size: 2.5rem; font-weight: 700; color: var(--primary-blue);">${projects.length}</div>
                            </div>
                        </div>
                        
                        <!-- Timesheet Entries Table -->
                        <table class="data-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: var(--light-blue);">
                                    <th style="padding: 1rem; text-align: left;">Date</th>
                                    <th style="padding: 1rem; text-align: left;">Project</th>
                                    <th style="padding: 1rem; text-align: left;">Hours</th>
                                    <th style="padding: 1rem; text-align: left;">Description</th>
                                    <th style="padding: 1rem; text-align: left;">Status</th>
                                    <th style="padding: 1rem; text-align: left;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${entriesHtml}
                            </tbody>
                        </table>
                    </div>
                `;
                
            } catch (error) {
                console.error('❌ Timesheet error:', error);
                main.innerHTML = `<div class="error-message" style="background: #fee; padding: 2rem; border-radius: 12px; text-align: center;"><h3>⚠️ Error Loading Timesheet</h3><p>${error.message}</p><button onclick="showTimesheet()" class="btn btn-primary" style="margin-top: 1rem;">Retry</button></div>`;
            } finally {
                hideLoading();
            }
        };
        
        window.showTimesheetModal = async function(projectId = null) {
            console.log('🔄 showTimesheetModal called for project:', projectId);
            try {
                showLoading();

                // Fetch projects and designer's own timesheets in parallel
                const [response, timesheetRes] = await Promise.all([
                    apiCall('projects'),
                    apiCall('timesheets')
                ]);
                if (!response.success) {
                    throw new Error('Failed to load projects');
                }

                const projects = response.data || [];
                // Build per-project hours logged by current user
                const myTimesheets = timesheetRes.success ? (timesheetRes.data || []) : [];
                const myHoursPerProject = {};
                myTimesheets.forEach(t => {
                    if (t.projectId && !t.isNonProjectWork) {
                        myHoursPerProject[t.projectId] = (myHoursPerProject[t.projectId] || 0) + (parseFloat(t.hours) || 0);
                    }
                });

                // Filter for projects assigned to the current user (designer or design lead)
                const assignedProjects = projects.filter(p => {
                    const inDesigners = p.assignedDesigners && p.assignedDesigners.includes(currentUser.uid);
                    const inUids = p.assignedDesignerUids && p.assignedDesignerUids.includes(currentUser.uid);
                    const isDesignLead = p.designLeadUid === currentUser.uid;
                    return inDesigners || inUids || isDesignLead;
                });

                if (assignedProjects.length === 0) {
                    alert('You are not assigned to any projects yet.');
                    hideLoading();
                    return;
                }
                
                // Close any existing modals first
                closeAllModals();
                
                const modalHtml = `
                    <div class="modal-overlay" id="timesheetModalOverlay" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;" onclick="handleModalOverlayClick(event, 'timesheetModalOverlay')">
                        <div class="modal-content" style="max-width: 600px; background: white; border-radius: 12px; max-height: 90vh; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                            <div class="modal-header" style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                                <h2 style="margin: 0;">📋 Log Hours</h2>
                                <span class="close-modal" onclick="closeTimesheetModal()" style="cursor: pointer; font-size: 2rem; color: #666;">&times;</span>
                            </div>
                            
                            <div class="modal-body" style="padding: 1.5rem; max-height: 60vh; overflow-y: auto;">
                                <form id="timesheetForm" onsubmit="event.preventDefault(); submitTimesheet();">
                                    
                                    <!-- Work Type Selection -->
                                    <div class="form-group" style="margin-bottom: 1rem;">
                                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Work Type <span style="color: red;">*</span></label>
                                        <select id="timesheetWorkType" class="form-control" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;" onchange="handleWorkTypeChange()" required>
                                            <option value="project">📁 Project Work</option>
                                            <option value="training">📚 Training</option>
                                            <option value="sample_designing">🎨 Sample Designing</option>
                                        </select>
                                    </div>
                                    
                                    <!-- Project Selection (shown only for Project Work) -->
                                    <div class="form-group" id="projectSelectionGroup" style="margin-bottom: 1rem;">
                                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Project <span style="color: red;">*</span></label>
                                        <select id="timesheetProjectId" class="form-control" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;" required>
                                            <option value="">Select a project...</option>
                                            ${assignedProjects.map(project => {
                                                // Personal allocation: only use if explicitly > 0
                                                const personalAlloc = (project.assignedDesignerHours && parseFloat(project.assignedDesignerHours[currentUser.uid]) > 0)
                                                    ? parseFloat(project.assignedDesignerHours[currentUser.uid])
                                                    : (project.designerHours && parseFloat(project.designerHours[currentUser.uid]) > 0)
                                                        ? parseFloat(project.designerHours[currentUser.uid])
                                                        : 0;
                                                // If no personal allocation, use total project budget
                                                const myAlloc = personalAlloc > 0
                                                    ? personalAlloc
                                                    : (parseFloat(project.maxAllocatedHours || 0) + parseFloat(project.additionalHours || 0));
                                                // If personal allocation, compare against designer's own hours; else use project total
                                                const myLogged = personalAlloc > 0
                                                    ? (myHoursPerProject[project.id] || 0)
                                                    : (parseFloat(project.hoursLogged) || 0);
                                                const myRemaining = myAlloc - myLogged;
                                                const isExhausted = myAlloc > 0 && myRemaining <= 0;
                                                return `<option value="${project.id}"
                                                        data-allocated="${myAlloc}"
                                                        data-logged="${myLogged}"
                                                        data-exhausted="${isExhausted}">
                                                    ${isExhausted ? '🚫 ' : ''}${project.projectName} - ${project.clientCompany}${isExhausted ? ' (Hours Exhausted)' : ''}
                                                </option>`;
                                            }).join('')}
                                        </select>
                                    </div>

                                    <!-- Training/Sample Info Banner -->
                                    <div id="nonProjectInfoBanner" style="display: none; padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; margin-bottom: 1rem;">
                                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                                            <span id="nonProjectIcon" style="font-size: 1.5rem;">📚</span>
                                            <div>
                                                <strong id="nonProjectTitle">Training Hours</strong>
                                                <p style="margin: 0; font-size: 0.85rem; opacity: 0.9;">These hours will be tracked separately from project work</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="form-group" style="margin-bottom: 1rem;">
                                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Date <span style="color: red;">*</span></label>
                                        <input type="date" id="timesheetDate" class="form-control" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;"
                                               max="${new Date().toISOString().split('T')[0]}" required>
                                    </div>

                                    <div class="form-group" style="margin-bottom: 1rem;">
                                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Hours <span style="color: red;">*</span></label>
                                        <input type="number" id="timesheetHours" class="form-control" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;"
                                               min="0.25" max="24" step="0.25" required 
                                               placeholder="e.g., 8 or 2.5">
                                    </div>

                                    <div class="form-group" style="margin-bottom: 1rem;">
                                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Description <span style="color: red;">*</span></label>
                                        <textarea id="timesheetDescription" class="form-control" rows="4" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; resize: vertical;"
                                                  placeholder="Describe what you worked on..." required></textarea>
                                    </div>

                                    <div id="timesheetAllocationInfo" 
                                         style="display: none; padding: 1rem; background: #e3f2fd; 
                                                border-radius: 8px; margin-top: 1rem; border-left: 4px solid #2196F3;">
                                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                            <span>Hours Logged:</span>
                                            <strong id="timesheetCurrentHours">0h</strong>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                            <span>Hours Allocated:</span>
                                            <strong id="timesheetAllocatedHours">0h</strong>
                                        </div>
                                        <div style="display: flex; justify-content: space-between;">
                                            <span>Hours Remaining:</span>
                                            <strong id="timesheetRemainingHours" style="color: #4CAF50;">0h</strong>
                                        </div>
                                    </div>
                                    
                                    <div id="timesheetWarning" style="display: none; padding: 1rem; background: #fff3cd; 
                                         border-radius: 8px; margin-top: 1rem; border-left: 4px solid #ff9800; color: #856404;">
                                        <strong>⚠️ Warning:</strong> <span id="timesheetWarningText"></span>
                                    </div>
                                </form>
                            </div>
                            
                            <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 0.5rem;">
                                <button type="button" onclick="closeTimesheetModal()" class="btn btn-outline" style="padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer;">Cancel</button>
                                <button type="button" onclick="console.log('Log Hours clicked'); submitTimesheet();" class="btn btn-success" style="padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; background: #10b981; color: white; border: none; font-weight: 600;">
                                    Log Hours
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                document.body.classList.add('modal-open');
                document.getElementById('timesheetDate').value = new Date().toISOString().split('T')[0];
                
                // Add change listener for project selection
                document.getElementById('timesheetProjectId').addEventListener('change', updateTimesheetAllocationInfo);
                document.getElementById('timesheetHours').addEventListener('input', updateTimesheetAllocationInfo);
                
                if (projectId) {
                    document.getElementById('timesheetProjectId').value = projectId;
                    updateTimesheetAllocationInfo();
                }
                
                hideLoading();
                
            } catch (error) {
                console.error('Error showing timesheet modal:', error);
                alert('Error loading timesheet form: ' + error.message);
                hideLoading();
            }
        };
        
        window.showRequestTimeModalDirect = function(projectId, projectName, allocatedHours, usedHours) {
            console.log('🔄 showRequestTimeModalDirect called', { projectId, projectName, allocatedHours, usedHours });
            
            closeAllModals();
            
            const remaining = allocatedHours - usedHours;
            const suggestedHours = Math.max(10, Math.ceil((allocatedHours * 0.25))); // Suggest 25% more or at least 10h
            
            const modalHtml = `
                <div class="modal-overlay" id="requestTimeDirectModalOverlay" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;" onclick="handleModalOverlayClick(event, 'requestTimeDirectModalOverlay')">
                    <div class="modal-content" style="max-width: 600px; background: white; border-radius: 12px; max-height: 90vh; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                        <div class="modal-header" style="padding: 1.5rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px 12px 0 0;">
                            <h2 style="margin: 0;">⏰ Request Additional Time</h2>
                            <span class="close-modal" onclick="closeRequestTimeDirectModal()" style="cursor: pointer; font-size: 2rem;">&times;</span>
                        </div>
                        
                        <div class="modal-body" style="padding: 1.5rem; max-height: 60vh; overflow-y: auto;">
                            <div style="padding: 1rem; background: #e3f2fd; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #2196f3;">
                                <h4 style="margin: 0 0 0.5rem 0; color: #1565c0;">📊 Project: ${projectName}</h4>
                                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1rem;">
                                    <div style="text-align: center;">
                                        <div style="font-size: 1.5rem; font-weight: bold; color: #1976d2;">${allocatedHours.toFixed(1)}h</div>
                                        <small style="color: #666;">Allocated</small>
                                    </div>
                                    <div style="text-align: center;">
                                        <div style="font-size: 1.5rem; font-weight: bold; color: #ff9800;">${usedHours.toFixed(1)}h</div>
                                        <small style="color: #666;">Used</small>
                                    </div>
                                    <div style="text-align: center;">
                                        <div style="font-size: 1.5rem; font-weight: bold; color: ${remaining < 0 ? '#f44336' : remaining < 5 ? '#ff9800' : '#4caf50'};">${remaining.toFixed(1)}h</div>
                                        <small style="color: #666;">Remaining</small>
                                    </div>
                                </div>
                            </div>
                            
                            ${remaining <= 0 ? `
                                <div style="padding: 1rem; background: #ffebee; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #f44336;">
                                    <p style="margin: 0; color: #c62828;">
                                        ⚠️ <strong>Budget Exceeded!</strong> You've used all your allocated hours. 
                                        Submit a request for additional time to continue working on this project.
                                    </p>
                                </div>
                            ` : remaining < 5 ? `
                                <div style="padding: 1rem; background: #fff3e0; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #ff9800;">
                                    <p style="margin: 0; color: #e65100;">
                                        ⚠️ <strong>Low Budget Warning!</strong> You have only ${remaining.toFixed(1)} hours remaining.
                                        Consider requesting additional time before running out.
                                    </p>
                                </div>
                            ` : ''}
                            
                            <form id="requestTimeDirectForm" onsubmit="event.preventDefault(); submitDirectTimeRequest();">
                                <input type="hidden" id="directReqProjectId" value="${projectId}">
                                <input type="hidden" id="directReqProjectName" value="${projectName}">
                                <input type="hidden" id="directReqAllocatedHours" value="${allocatedHours}">
                                <input type="hidden" id="directReqUsedHours" value="${usedHours}">
                                
                                <div class="form-group" style="margin-bottom: 1rem;">
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Additional Hours Needed <span style="color: red;">*</span></label>
                                    <input type="number" id="directRequestedHours" class="form-control" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;"
                                           min="1" step="0.5" 
                                           value="${suggestedHours}" required>
                                    <small style="color: #666;">Suggested: ${suggestedHours}h (25% additional buffer)</small>
                                </div>
                                
                                <div class="form-group" style="margin-bottom: 1rem;">
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Reason for Additional Time <span style="color: red;">*</span></label>
                                    <textarea id="directRequestReason" class="form-control" rows="5" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; resize: vertical;"
                                              placeholder="Please explain why additional time is needed...

Examples:
- Design complexity increased
- Client requested revisions
- Scope changes not in original estimate
- Unforeseen technical challenges" required></textarea>
                                    <small style="color: #666;">Be specific: scope changes, unforeseen complexity, design revisions, etc. (min 20 characters)</small>
                                </div>
                            </form>
                        </div>
                        
                        <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 0.5rem;">
                            <button type="button" onclick="closeRequestTimeDirectModal()" class="btn btn-outline" style="padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; border: 1px solid #ddd; background: white;">Cancel</button>
                            <button type="button" onclick="submitDirectTimeRequest()" class="btn btn-primary" style="padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; background: #1e40af; color: white; border: none; font-weight: 600;">
                                📤 Submit Request to COO
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            document.body.classList.add('modal-open');
        };
        
        window.closeRequestTimeDirectModal = function() {
            const modal = document.getElementById('requestTimeDirectModalOverlay');
            if (modal) modal.remove();
            document.body.classList.remove('modal-open');
        };
        
        window.submitDirectTimeRequest = async function() {
            console.log('📤 submitDirectTimeRequest called');
            
            const projectId = document.getElementById('directReqProjectId')?.value;
            const projectName = document.getElementById('directReqProjectName')?.value;
            const allocatedHours = parseFloat(document.getElementById('directReqAllocatedHours')?.value);
            const usedHours = parseFloat(document.getElementById('directReqUsedHours')?.value);
            const requestedHours = parseFloat(document.getElementById('directRequestedHours')?.value);
            const reason = document.getElementById('directRequestReason')?.value?.trim();
            
            console.log('📝 Request data:', { projectId, projectName, requestedHours, reason });
            
            if (!requestedHours || requestedHours <= 0) {
                alert('Please enter valid hours');
                return;
            }
            
            if (!reason || reason.length < 20) {
                alert('Please provide a detailed reason (at least 20 characters)');
                document.getElementById('directRequestReason')?.focus();
                return;
            }
            
            try {
                showLoading();
                
                const response = await apiCall('time-requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId,
                        requestedHours,
                        reason,
                        currentAllocatedHours: allocatedHours,
                        currentHoursLogged: usedHours,
                        requestType: 'proactive'
                    })
                });
                
                console.log('📥 API Response:', response);
                
                if (response.success) {
                    closeRequestTimeDirectModal();
                    alert(`✅ Request Submitted!\n\nYour request for ${requestedHours} additional hours on "${projectName}" has been submitted to the COO for review.`);
                    
                    // Refresh the allocations view
                    if (typeof showDesignerAllocations === 'function') {
                        showDesignerAllocations();
                    }
                } else {
                    throw new Error(response.error || 'Failed to submit request');
                }
                
            } catch (error) {
                console.error('❌ Error submitting time request:', error);
                alert('Error: ' + error.message);
            } finally {
                hideLoading();
            }
        };
        
        console.log('✅ Request Time Modal functions registered');
        
        // ============================================
        // ✅ SHOW REQUEST ADDITIONAL TIME MODAL (for timesheet overflow)
        // ============================================
        window.showRequestAdditionalTimeModal = function(allocationData, timesheetData) {
            console.log('🔄 showRequestAdditionalTimeModal called', { allocationData, timesheetData });
            
            closeAllModals();
            
            const totalHours = allocationData.totalHours || 0;
            const allocatedHours = allocationData.allocatedHours || 0;
            const exceededBy = allocationData.exceededBy || 0;
            const projectId = timesheetData.projectId;
            const date = timesheetData.date;
            const hours = timesheetData.hours;
            const description = timesheetData.description;
            
            const modalHtml = `
                <div class="modal-overlay" id="requestTimeModalOverlay" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;" onclick="handleModalOverlayClick(event, 'requestTimeModalOverlay')">
                    <div class="modal-content" style="max-width: 600px; background: white; border-radius: 12px; max-height: 90vh; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                        <div class="modal-header" style="padding: 1.5rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; border-radius: 12px 12px 0 0;">
                            <h2 style="margin: 0;">⏱️ Request Additional Time</h2>
                            <span class="close-modal" onclick="closeRequestTimeModal()" style="cursor: pointer; font-size: 2rem;">&times;</span>
                        </div>
                        
                        <div class="modal-body" style="padding: 1.5rem; max-height: 60vh; overflow-y: auto;">
                            <div style="padding: 1rem; background: #fff3cd; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #ff9800;">
                                <h4 style="margin: 0 0 0.5rem 0; color: #856404;">⚠️ Hours Exceed Allocation</h4>
                                <p style="margin: 0; color: #856404;">
                                    <strong>Allocated:</strong> ${allocatedHours}h<br>
                                    <strong>Already Logged:</strong> ${totalHours}h<br>
                                    <strong>Trying to Add:</strong> ${hours}h<br>
                                    <strong>Exceeds by:</strong> ${exceededBy.toFixed(2)}h
                                </p>
                            </div>
                            
                            <form id="requestTimeForm" onsubmit="event.preventDefault(); submitAdditionalTimeRequest();">
                                <input type="hidden" id="reqProjectId" value="${projectId}">
                                <input type="hidden" id="reqDate" value="${date}">
                                <input type="hidden" id="reqHours" value="${hours}">
                                <input type="hidden" id="reqDescription" value="${description}">
                                
                                <div class="form-group" style="margin-bottom: 1rem;">
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Additional Hours Requested <span style="color: red;">*</span></label>
                                    <input type="number" id="requestedHours" class="form-control" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;"
                                           min="${exceededBy.toFixed(2)}" step="0.5" 
                                           value="${Math.ceil(exceededBy)}" required>
                                    <small style="color: #666;">Minimum: ${exceededBy.toFixed(2)}h (amount exceeded)</small>
                                </div>
                                
                                <div class="form-group" style="margin-bottom: 1rem;">
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Reason for Additional Time <span style="color: red;">*</span></label>
                                    <textarea id="requestReason" class="form-control" rows="5" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; resize: vertical;"
                                              placeholder="Explain why additional time is needed..." required></textarea>
                                    <small style="color: #666;">Be specific: scope changes, unforeseen complexity, design revisions, etc.</small>
                                </div>
                                
                                <div class="form-group" style="margin-bottom: 1rem;">
                                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                        <input type="checkbox" id="requestSaveTimesheet" checked> 
                                        Save my timesheet entry for after approval
                                    </label>
                                    <small style="display: block; margin-top: 0.5rem; color: #666;">
                                        If checked, your ${hours}h entry will be saved once COO approves the additional time.
                                    </small>
                                </div>
                            </form>
                        </div>
                        
                        <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 0.5rem;">
                            <button type="button" onclick="closeRequestTimeModal()" class="btn btn-outline" style="padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; border: 1px solid #ddd; background: white;">Cancel</button>
                            <button type="button" onclick="submitAdditionalTimeRequest()" class="btn btn-primary" style="padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; background: #1e40af; color: white; border: none; font-weight: 600;">
                                Submit Request to COO
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            document.body.classList.add('modal-open');
        };
        
        window.closeRequestTimeModal = function() {
            const modal = document.getElementById('requestTimeModalOverlay');
            if (modal) modal.remove();
            document.body.classList.remove('modal-open');
        };
        
        window.submitAdditionalTimeRequest = async function() {
            console.log('📤 submitAdditionalTimeRequest called');
            
            const projectId = document.getElementById('reqProjectId')?.value;
            const requestedHours = parseFloat(document.getElementById('requestedHours')?.value);
            const reason = document.getElementById('requestReason')?.value?.trim();
            const saveTimesheet = document.getElementById('requestSaveTimesheet')?.checked;
            const pendingDate = document.getElementById('reqDate')?.value;
            const pendingHours = parseFloat(document.getElementById('reqHours')?.value);
            const pendingDescription = document.getElementById('reqDescription')?.value;
            
            console.log('📝 Request data:', { projectId, requestedHours, reason, saveTimesheet });
            
            if (!requestedHours || requestedHours <= 0) {
                alert('Please enter valid hours');
                return;
            }
            
            if (!reason || reason.length < 20) {
                alert('Please provide a detailed reason (at least 20 characters)');
                return;
            }
            
            try {
                showLoading();
                
                const response = await apiCall('time-requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId,
                        requestedHours,
                        reason,
                        saveTimesheet,
                        pendingTimesheet: saveTimesheet ? {
                            date: pendingDate,
                            hours: pendingHours,
                            description: pendingDescription
                        } : null
                    })
                });
                
                console.log('📥 API Response:', response);
                
                if (response.success) {
                    closeRequestTimeModal();
                    alert(`✅ Request Submitted!\n\nYour request for ${requestedHours} additional hours has been submitted to the COO for review.${saveTimesheet ? '\n\nYour timesheet entry will be saved once approved.' : ''}`);
                    
                    // Refresh the allocations view
                    if (typeof showDesignerAllocations === 'function') {
                        showDesignerAllocations();
                    }
                } else {
                    throw new Error(response.error || 'Failed to submit request');
                }
                
            } catch (error) {
                console.error('❌ Error submitting time request:', error);
                alert('Error: ' + error.message);
            } finally {
                hideLoading();
            }
        };
        
        console.log('✅ Additional Time Request functions registered');
        
        // Also make showProjectFilesModal globally available
        window.showProjectFilesModal = window.showProjectFilesModal || async function(projectId, projectName) {
            console.log('🔄 showProjectFilesModal called for:', projectId, projectName);
            // This function is defined earlier in the file, so it should be available
            if (typeof showProjectFilesModal === 'function') {
                showProjectFilesModal(projectId, projectName);
            }
        };
        
        // Helper function for timesheet allocation info
        window.updateTimesheetAllocationInfo = function() {
            const projectSelect = document.getElementById('timesheetProjectId');
            const hoursInput = document.getElementById('timesheetHours');
            const infoDiv = document.getElementById('timesheetAllocationInfo');
            const warningDiv = document.getElementById('timesheetWarning');
            const warningText = document.getElementById('timesheetWarningText');
            const submitBtn = document.querySelector('#timesheetModalOverlay .btn-success');

            if (!projectSelect || !projectSelect.value) {
                if (infoDiv) infoDiv.style.display = 'none';
                if (warningDiv) warningDiv.style.display = 'none';
                if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; }
                return;
            }

            const selectedOption = projectSelect.options[projectSelect.selectedIndex];
            const allocated = parseFloat(selectedOption.dataset.allocated) || 0;
            const logged = parseFloat(selectedOption.dataset.logged) || 0;
            const remaining = allocated - logged;
            const isExhausted = allocated > 0 && remaining <= 0;
            const hoursToAdd = parseFloat(hoursInput.value) || 0;
            const newTotal = logged + hoursToAdd;

            document.getElementById('timesheetCurrentHours').textContent = logged.toFixed(2) + 'h';
            document.getElementById('timesheetAllocatedHours').textContent = allocated.toFixed(2) + 'h';
            document.getElementById('timesheetRemainingHours').textContent = remaining.toFixed(2) + 'h';
            document.getElementById('timesheetRemainingHours').style.color =
                remaining <= 0 ? '#f44336' : (remaining < 5 ? '#ff9800' : '#4CAF50');

            infoDiv.style.display = 'block';

            if (isExhausted) {
                // HARD BLOCK: all hours used up — design lead must request more
                warningDiv.style.background = '#fef2f2';
                warningDiv.style.borderLeftColor = '#ef4444';
                warningText.innerHTML = `<strong style="color:#b91c1c;">⛔ Hours Exhausted</strong><br>
                    All allocated hours for this project have been used up.<br>
                    <span style="color:#6b7280;font-size:0.875rem;">The Design Lead must request additional hours from COO and get them approved before you can log more hours on this project.</span>`;
                warningDiv.style.display = 'block';
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.style.opacity = '0.4';
                    submitBtn.style.cursor = 'not-allowed';
                    submitBtn.title = 'Hours exhausted — Design Lead must request additional hours from COO';
                }
            } else {
                // Restore button
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                    submitBtn.title = '';
                }
                // Show warning if will exceed allocation
                if (hoursToAdd > 0 && newTotal > allocated && allocated > 0) {
                    const exceeded = newTotal - allocated;
                    warningDiv.style.background = '#fff3cd';
                    warningDiv.style.borderLeftColor = '#ff9800';
                    warningText.innerHTML = `Adding ${hoursToAdd}h will exceed allocation by ${exceeded.toFixed(2)}h. You'll need to request additional time from COO.`;
                    warningDiv.style.display = 'block';
                } else {
                    warningDiv.style.display = 'none';
                }
            }
        };
        
        console.log('✅ All designer functions implemented directly');
        
        // ============================================
        // ✅ COO TIME REQUEST FUNCTIONS - UPDATED WITH DIRECTOR APPROVED ALLOCATION
        // ============================================
        
        window.showCOOTimeRequests = async function() {
            console.log('🔄 showCOOTimeRequests called');
            
            const userRole = (typeof currentUserRole !== 'undefined' && currentUserRole) ? currentUserRole.trim().toLowerCase() : '';
            console.log('User role:', userRole);
            
            if (!['coo', 'director'].includes(userRole)) {
                alert('Access denied. COO/Director only. Your role: ' + userRole);
                return;
            }
            
            try {
                showLoading();
                setActiveNav('nav-time-requests');
                
                // Fetch BOTH pending requests AND approved requests pending allocation
                const [pendingResponse, approvedResponse] = await Promise.all([
                    apiCall('time-requests?status=pending'),
                    apiCall('time-requests?status=approved')
                ]);
                
                console.log('📥 Pending time requests:', pendingResponse);
                console.log('📥 Approved requests:', approvedResponse);
                
                const pendingRequests = pendingResponse.success ? (pendingResponse.data || []) : [];
                // Filter approved requests that haven't been allocated to designer yet
                const allApproved = approvedResponse.success ? (approvedResponse.data || []) : [];
                const approvedRequests = allApproved.filter(req => 
                    req.allocatedToDesigner !== true
                );
                
                // Build Pending Requests HTML
                let pendingHtml = '';
                if (pendingRequests.length === 0) {
                    pendingHtml = `
                        <div style="text-align: center; padding: 2rem; color: #666; background: #f9fafb; border-radius: 12px;">
                            <div style="font-size: 2rem; margin-bottom: 0.5rem;">✅</div>
                            <p>No pending requests to review.</p>
                        </div>
                    `;
                } else {
                    pendingHtml = pendingRequests.map(req => {
                        const isDesignLeadReq = req.requestorType === 'design_lead';
                        return `
                        <div class="card" style="margin-bottom: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 5px solid ${isDesignLeadReq ? '#f59e0b' : '#3b82f6'};">
                            <div style="padding: 1.5rem;">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
                                    <div>
                                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; flex-wrap: wrap;">
                                            <h3 style="margin: 0;">${req.projectName || 'Unknown Project'}</h3>
                                            ${isDesignLeadReq ? `<span style="background: #f59e0b; color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.78rem; font-weight: 700;">🎯 Design Lead Request</span>` : `<span style="background: #3b82f6; color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.78rem; font-weight: 700;">🖌️ Designer Request</span>`}
                                        </div>
                                        <small style="color: #666;">${req.projectCode || 'N/A'} - ${req.clientCompany || 'N/A'}</small>
                                    </div>
                                    <span style="background: #ff9800; color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem; white-space: nowrap;">⏳ Pending Review</span>
                                </div>

                                <div style="margin: 1rem 0; padding: 1rem; background: #f5f5f5; border-radius: 8px;">
                                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                                        <div>
                                            <small style="color: #666;">Requested By</small>
                                            <div style="font-weight: 600;">${req.designerName || 'Unknown'}</div>
                                            ${isDesignLeadReq ? `<small style="color: #f59e0b; font-weight: 600;">Design Lead</small>` : `<small style="color: #6b7280;">Designer</small>`}
                                        </div>
                                        <div>
                                            <small style="color: #666;">Additional Hours</small>
                                            <div style="font-weight: 600; color: #2196F3; font-size: 1.2rem;">${req.requestedHours || 0}h</div>
                                        </div>
                                        <div>
                                            <small style="color: #666;">Current Usage</small>
                                            <div style="font-weight: 600;">${req.currentHoursLogged || 0}h / ${req.currentAllocatedHours || 0}h</div>
                                        </div>
                                    </div>
                                </div>

                                <div style="margin: 1rem 0;">
                                    <strong>Reason for Additional ${isDesignLeadReq ? 'Project' : 'Designer'} Hours:</strong>
                                    <p style="margin: 0.5rem 0; padding: 1rem; background: #fff; border-left: 3px solid ${isDesignLeadReq ? '#f59e0b' : '#2196F3'}; color: #555;">
                                        ${req.reason || 'No reason provided'}
                                    </p>
                                </div>

                                <div style="margin: 1rem 0;">
                                    <small style="color: #666;">
                                        Submitted: ${req.createdAt ? new Date(req.createdAt.seconds ? req.createdAt.seconds * 1000 : req.createdAt).toLocaleString() : 'N/A'}
                                    </small>
                                </div>

                                <div style="display: flex; gap: 1rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #ddd; flex-wrap: wrap;">
                                    <button onclick="approveTimeRequest('${req.id}', ${req.requestedHours || 0})"
                                            style="flex: 1; min-width: 120px; padding: 0.75rem 1rem; border-radius: 8px; border: none; background: #10b981; color: white; cursor: pointer; font-weight: 600;">
                                        ✅ Approve ${req.requestedHours || 0}h
                                    </button>
                                    <button onclick="showRejectTimeRequestModal('${req.id}')"
                                            style="flex: 1; min-width: 120px; padding: 0.75rem 1rem; border-radius: 8px; border: none; background: #ef4444; color: white; cursor: pointer; font-weight: 600;">
                                        ❌ Reject
                                    </button>
                                    <button onclick="showRequestInfoModal('${req.id}')"
                                            style="padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #ddd; background: white; cursor: pointer;">
                                        💬 Request Info
                                    </button>
                                </div>
                            </div>
                        </div>
                    `}).join('');
                }
                
                // Build Approved Requests Pending Allocation HTML (COO only)
                let approvedHtml = '';
                if (userRole === 'coo') {
                    if (approvedRequests.length === 0) {
                        approvedHtml = `
                            <div style="text-align: center; padding: 2rem; color: #666; background: #f0fdf4; border-radius: 12px;">
                                <div style="font-size: 2rem; margin-bottom: 0.5rem;">📋</div>
                                <p>No approved requests waiting for allocation.</p>
                            </div>
                        `;
                    } else {
                        approvedHtml = approvedRequests.map(req => `
                            <div class="card" style="margin-bottom: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 5px solid #10b981;">
                                <div style="padding: 1.5rem;">
                                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                                        <div>
                                            <h3 style="margin: 0 0 0.25rem 0;">${req.projectName || 'Unknown Project'}</h3>
                                            <small style="color: #666;">${req.projectCode || 'N/A'} - ${req.clientCompany || 'N/A'}</small>
                                        </div>
                                        <span style="background: #10b981; color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem;">✅ Director Approved</span>
                                    </div>
                                    
                                    <div style="margin: 1rem 0; padding: 1rem; background: #f0fdf4; border-radius: 8px;">
                                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
                                            <div>
                                                <small style="color: #666;">Requested By</small>
                                                <div style="font-weight: 600;">${req.designerName || 'Unknown'}</div>
                                            </div>
                                            <div>
                                                <small style="color: #666;">Approved Hours</small>
                                                <div style="font-weight: 700; color: #10b981; font-size: 1.2rem;">${req.approvedHours || req.requestedHours || 0}h</div>
                                            </div>
                                            <div>
                                                <small style="color: #666;">Approved By</small>
                                                <div style="font-weight: 600;">${req.reviewedBy || 'Director'}</div>
                                            </div>
                                            <div>
                                                <small style="color: #666;">Approved Date</small>
                                                <div style="font-weight: 600;">${req.reviewedAt ? new Date(req.reviewedAt.seconds ? req.reviewedAt.seconds * 1000 : req.reviewedAt).toLocaleDateString() : 'N/A'}</div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    ${req.reviewComment ? `
                                    <div style="margin: 1rem 0;">
                                        <strong>Director's Comment:</strong>
                                        <p style="margin: 0.5rem 0; padding: 1rem; background: #f0fdf4; border-left: 3px solid #10b981; color: #555;">
                                            ${req.reviewComment}
                                        </p>
                                    </div>
                                    ` : ''}
                                    
                                    <div style="display: flex; gap: 1rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #ddd;">
                                        <button onclick="showAllocateToDesignerModal('${req.id}', '${req.projectId}', ${req.approvedHours || req.requestedHours || 0}, '${(req.projectName || '').replace(/'/g, "\\'")}')" 
                                                style="flex: 1; padding: 0.75rem 1rem; border-radius: 8px; border: none; background: #1e40af; color: white; cursor: pointer; font-weight: 600; font-size: 1rem;">
                                            🎯 Allocate to Designer
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('');
                    }
                }
                
                const mainContent = document.getElementById('mainContent');
                mainContent.style.display = 'block';
                mainContent.innerHTML = `
                    <div class="page-header">
                        <h2>⏱️ Additional Time Requests</h2>
                        <p class="subtitle">Review and approve/reject additional hour requests from designers and design leads</p>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                        <div style="background: white; padding: 1.5rem; border-radius: 12px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-top: 4px solid #ff9800;">
                            <div style="font-size: 2rem; font-weight: 700; color: #ff9800;">${pendingRequests.length}</div>
                            <div style="color: #666;">Pending Review</div>
                        </div>
                        <div style="background: white; padding: 1.5rem; border-radius: 12px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-top: 4px solid #f59e0b;">
                            <div style="font-size: 2rem; font-weight: 700; color: #f59e0b;">${pendingRequests.filter(r => r.requestorType === 'design_lead').length}</div>
                            <div style="color: #666;">From Design Leads</div>
                        </div>
                        ${userRole === 'coo' ? `
                        <div style="background: white; padding: 1.5rem; border-radius: 12px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-top: 4px solid #10b981;">
                            <div style="font-size: 2rem; font-weight: 700; color: #10b981;">${approvedRequests.length}</div>
                            <div style="color: #666;">Ready to Allocate</div>
                        </div>
                        ` : ''}
                    </div>

                    ${userRole === 'coo' && approvedRequests.length > 0 ? `
                    <div style="margin-bottom: 2rem;">
                        <h3 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span style="background: #10b981; color: white; padding: 0.35rem 1rem; border-radius: 20px; font-size: 0.9rem; animation: pulse 2s infinite;">⚡ ACTION NEEDED</span>
                            Approved - Ready to Allocate
                        </h3>
                        <div class="approved-requests-list">
                            ${approvedHtml}
                        </div>
                    </div>
                    ` : ''}

                    <div>
                        <h3 style="margin-bottom: 1rem;">📋 Pending Requests</h3>
                        <div class="requests-list">
                            ${pendingHtml}
                        </div>
                    </div>
                    
                    <style>
                        @keyframes pulse {
                            0%, 100% { opacity: 1; }
                            50% { opacity: 0.7; }
                        }
                    </style>
                `;
                
            } catch (error) {
                console.error('❌ Error loading time requests:', error);
                const mainContent = document.getElementById('mainContent');
                mainContent.innerHTML = `
                    <div style="text-align: center; padding: 3rem; color: #ef4444;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                        <h3>Error Loading Time Requests</h3>
                        <p>${error.message}</p>
                        <button onclick="showCOOTimeRequests()" style="margin-top: 1rem; padding: 0.75rem 1.5rem; border-radius: 8px; border: none; background: #1e40af; color: white; cursor: pointer;">
                            🔄 Retry
                        </button>
                    </div>
                `;
            } finally {
                hideLoading();
            }
        };
        
        // ============================================
        // NEW: Allocate Approved Hours to Designer Modal
        // ============================================
        window.showAllocateToDesignerModal = async function(requestId, projectId, approvedHours, projectName) {
            console.log('🎯 showAllocateToDesignerModal called', { requestId, projectId, approvedHours, projectName });
            closeAllModals();
            
            try {
                showLoading();
                
                // Fetch project to get assigned designers
                const projectResponse = await apiCall(`projects?id=${projectId}`);
                console.log('📥 Project response:', projectResponse);
                
                hideLoading();
                
                if (!projectResponse.success || !projectResponse.data) {
                    throw new Error('Failed to load project details');
                }
                
                const project = projectResponse.data;
                const assignedDesigners = project.assignedDesigners || [];
                const designerNames = project.designerNames || {};
                
                // Build designer options
                let designerOptions = '';
                if (assignedDesigners.length === 0) {
                    designerOptions = '<option value="">No designers assigned to this project</option>';
                } else {
                    designerOptions = '<option value="">Select a designer...</option>';
                    assignedDesigners.forEach(designerUid => {
                        const name = designerNames[designerUid] || designerUid;
                        designerOptions += `<option value="${designerUid}" data-name="${name}">${name}</option>`;
                    });
                }
                
                // Create modal
                const modalHtml = `
                    <div class="modal-overlay" id="allocateDesignerModalOverlay" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;" onclick="if(event.target.id === 'allocateDesignerModalOverlay') { this.remove(); document.body.classList.remove('modal-open'); }">
                        <div class="modal-content" style="max-width: 500px; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                            <div class="modal-header" style="padding: 1.5rem; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white;">
                                <h2 style="margin: 0;">🎯 Allocate Approved Hours</h2>
                            </div>
                            
                            <div class="modal-body" style="padding: 1.5rem;">
                                <div style="background: #f0fdf4; padding: 1rem; border-radius: 10px; margin-bottom: 1.5rem; border: 1px solid #86efac;">
                                    <div style="font-weight: 600; color: #065f46; font-size: 1.1rem;">${projectName}</div>
                                    <div style="color: #047857; font-size: 1.5rem; font-weight: 700; margin-top: 0.5rem;">
                                        ${approvedHours}h <span style="font-size: 0.9rem; font-weight: 400;">approved by Director</span>
                                    </div>
                                </div>
                                
                                <input type="hidden" id="allocateRequestId" value="${requestId}">
                                <input type="hidden" id="allocateProjectId" value="${projectId}">
                                <input type="hidden" id="allocateApprovedHours" value="${approvedHours}">
                                
                                <div style="margin-bottom: 1.25rem;">
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">Select Designer <span style="color: red;">*</span></label>
                                    <select id="allocateDesignerSelect" required
                                            style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 1rem; box-sizing: border-box;"
                                            onchange="updateAllocateDesignerName()">
                                        ${designerOptions}
                                    </select>
                                    <input type="hidden" id="allocateDesignerName" value="">
                                </div>
                                
                                <div style="margin-bottom: 1.25rem;">
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">Hours to Allocate <span style="color: red;">*</span></label>
                                    <input type="number" id="allocateHoursInput" 
                                           value="${approvedHours}" min="0.5" max="${approvedHours}" step="0.5" required
                                           style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 1rem; box-sizing: border-box;">
                                    <small style="color: #6b7280;">Maximum: ${approvedHours}h (as approved by Director)</small>
                                </div>
                            </div>
                            
                            <div style="padding: 1rem 1.5rem; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 0.75rem;">
                                <button type="button" onclick="document.getElementById('allocateDesignerModalOverlay').remove(); document.body.classList.remove('modal-open');"
                                        style="padding: 0.75rem 1.5rem; border-radius: 8px; border: 1px solid #d1d5db; background: white; cursor: pointer; font-weight: 600;">
                                    Cancel
                                </button>
                                <button type="button" onclick="submitAllocateToDesigner()"
                                        style="padding: 0.75rem 1.5rem; border-radius: 8px; border: none; background: #1e40af; color: white; cursor: pointer; font-weight: 600;">
                                    ✅ Allocate Hours
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                document.body.classList.add('modal-open');
                
            } catch (error) {
                hideLoading();
                console.error('❌ Error showing allocate modal:', error);
                alert('Error loading project designers: ' + error.message);
            }
        };
        
        // Update designer name hidden field when selection changes
        window.updateAllocateDesignerName = function() {
            const select = document.getElementById('allocateDesignerSelect');
            const selectedOption = select.options[select.selectedIndex];
            const nameInput = document.getElementById('allocateDesignerName');
            nameInput.value = selectedOption.dataset.name || '';
        };
        
        // Submit allocation to designer
        window.submitAllocateToDesigner = async function() {
            console.log('📤 submitAllocateToDesigner called');
            
            const requestId = document.getElementById('allocateRequestId').value;
            const projectId = document.getElementById('allocateProjectId').value;
            const designerUid = document.getElementById('allocateDesignerSelect').value;
            const designerName = document.getElementById('allocateDesignerName').value;
            const hours = parseFloat(document.getElementById('allocateHoursInput').value);
            
            if (!designerUid) {
                alert('Please select a designer');
                return;
            }
            
            if (!hours || hours <= 0) {
                alert('Please enter valid hours to allocate');
                return;
            }
            
            try {
                showLoading();
                
                const response = await apiCall(`time-requests?id=${requestId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'allocate',
                        targetDesignerUid: designerUid,
                        targetDesignerName: designerName,
                        allocatedHours: hours
                    })
                });
                
                console.log('📥 Allocate response:', response);
                
                if (response.success) {
                    document.getElementById('allocateDesignerModalOverlay')?.remove();
                    document.body.classList.remove('modal-open');
                    alert(`✅ Successfully allocated ${hours}h to ${designerName}!`);
                    showCOOTimeRequests(); // Refresh the list
                } else {
                    throw new Error(response.error || 'Failed to allocate hours');
                }
                
            } catch (error) {
                console.error('❌ Error allocating hours:', error);
                alert('Error: ' + error.message);
            } finally {
                hideLoading();
            }
        };
        
        window.approveTimeRequest = async function(requestId, hours) {
            console.log('✅ approveTimeRequest called', { requestId, hours });
            
            const comment = prompt(`Approve ${hours}h additional time?\n\nOptional comment for designer:`);
            
            if (comment === null) return; // User cancelled
            
            try {
                showLoading();
                
                const response = await apiCall(`time-requests?id=${requestId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'approve',
                        approvedHours: hours,
                        comment: comment || 'Approved',
                        applyToTimesheet: true
                    })
                });
                
                console.log('📥 Approve response:', response);
                
                if (response.success) {
                    alert(`✅ Approved ${hours}h additional time!`);
                    showCOOTimeRequests(); // Refresh list
                } else {
                    throw new Error(response.error || 'Failed to approve');
                }
                
            } catch (error) {
                console.error('❌ Error approving:', error);
                alert('Error: ' + error.message);
            } finally {
                hideLoading();
            }
        };
        
        window.showRejectTimeRequestModal = function(requestId) {
            console.log('🔄 showRejectTimeRequestModal called', requestId);
            closeAllModals();
            
            const modalHtml = `
                <div class="modal-overlay" id="rejectModalOverlay" style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;" onclick="if(event.target.id === 'rejectModalOverlay') { this.remove(); document.body.classList.remove('modal-open'); }">
                    <div class="modal-content" style="max-width: 500px; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                        <div class="modal-header" style="padding: 1.5rem; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white;">
                            <h2 style="margin: 0;">❌ Reject Time Request</h2>
                        </div>
                        
                        <div class="modal-body" style="padding: 1.5rem;">
                            <input type="hidden" id="rejectRequestId" value="${requestId}">
                            
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Reason for Rejection <span style="color: red;">*</span></label>
                                <textarea id="rejectComment" rows="4" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; resize: vertical; box-sizing: border-box;"
                                          placeholder="Please explain why this request is being rejected..."></textarea>
                                <small style="color: #666;">Minimum 10 characters</small>
                            </div>
                        </div>
                        
                        <div style="padding: 1rem 1.5rem; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 0.5rem;">
                            <button type="button" onclick="document.getElementById('rejectModalOverlay').remove(); document.body.classList.remove('modal-open');" style="padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; border: 1px solid #ddd; background: white;">Cancel</button>
                            <button type="button" onclick="submitRejectTimeRequest()" style="padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; background: #dc2626; color: white; border: none; font-weight: 600;">
                                Reject Request
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            document.body.classList.add('modal-open');
        };
        
        window.submitRejectTimeRequest = async function() {
            console.log('📤 submitRejectTimeRequest called');
            
            const requestId = document.getElementById('rejectRequestId')?.value;
            const comment = document.getElementById('rejectComment')?.value?.trim();
            
            if (!comment || comment.length < 10) {
                alert('Please provide a detailed reason for rejection (at least 10 characters)');
                return;
            }
            
            try {
                showLoading();
                
                const response = await apiCall(`time-requests?id=${requestId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'reject',
                        comment: comment
                    })
                });
                
                console.log('📥 Reject response:', response);
                
                if (response.success) {
                    document.getElementById('rejectModalOverlay')?.remove();
                    document.body.classList.remove('modal-open');
                    alert('❌ Request rejected');
                    showCOOTimeRequests(); // Refresh list
                } else {
                    throw new Error(response.error || 'Failed to reject');
                }
                
            } catch (error) {
                console.error('❌ Error rejecting:', error);
                alert('Error: ' + error.message);
            } finally {
                hideLoading();
            }
        };
        
        window.showRequestInfoModal = function(requestId) {
            const info = prompt('Enter message to request more information from designer:');
            if (info && info.trim()) {
                alert('Request for info feature coming soon.\n\nYour message: ' + info);
            }
        };
        
        console.log('✅ COO Time Request functions registered (with Director Approved Allocation)');
    </script>

    <div id="cooProjectNumberSection" style="display: none;">
        <div class="page-header">
            <h2>Pricing & Project Number Management</h2>
            <p class="subtitle">Review pricing and assign project numbers</p>
        </div>
        <div class="filters-bar">
            <select id="projectNumberFilter" class="filter-select" onchange="filterProjectNumberProposals()">
                <option value="all">All Proposals</option>
                <option value="needs_number">Needs Project Number</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
            </select>
        </div>
        <div class="card">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Project Name</th>
                        <th>Client</th>
                        <th>BDM</th>
                        <th>Quote Value</th>
                        <th>Project Number</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="projectNumberTableBody">
                    <tr>
                        <td colspan="7" class="text-center">Loading...</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    <div id="projectNumberModal" class="modal" style="display: none;">
        <div class="modal-content new-modal">
            <div class="modal-header">
                <h2>Set Project Number</h2>
                <span class="close-modal" onclick="closeProjectNumberModal()">&times;</span>
            </div>
            <div class="modal-body">
                <input type="hidden" id="pnProposalId" />
                <div class="info-section">
                    <h4 id="pnProjectName"></h4>
                    <p><strong>Client:</strong> <span id="pnClientName"></span></p>
                    <p><strong>BDM:</strong> <span id="pnBdmName"></span></p>
                    <p><strong>Quote Value:</strong> <span id="pnQuoteValue"></span></p>
                </div>
                <div class="form-group">
                    <label for="projectNumberInput">Project Number <span class="required">*</span></label>
                    <input type="text" id="projectNumberInput" class="form-control" placeholder="e.g., ABC25-001"
                        required />
                    <small class="form-text">Enter a unique project number for tracking</small>
                </div>
                <div class="warning-message">
                    <strong>Note:</strong> This project number will be sent to the Director for approval before being
                    finalized.
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-cancel" onclick="closeProjectNumberModal()">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="submitProjectNumber()">Save & Submit for
                    Approval</button>
            </div>
        </div>
    </div>
    <div id="directorApprovalSection" style="display: none;">
        <div class="page-header">
            <h2>Project Number Approvals</h2>
            <p class="subtitle">Review and approve project numbers set by COO</p>
        </div>
        <div class="card">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Project Name</th>
                        <th>Client</th>
                        <th>Project Number</th>
                        <th>Set By</th>
                        <th>Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="approvalTableBody">
                    <tr>
                        <td colspan="6" class="text-center">Loading...</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    <div id="rejectionReasonModal" class="modal" style="display: none;">
        <div class="modal-content new-modal">
            <div class="modal-header">
                <h2>Reject Project Number</h2>
                <span class="close-modal" onclick="closeRejectionModal()">&times;</span>
            </div>
            <div class="modal-body">
                <input type="hidden" id="rejectProposalId" />
                <input type="hidden" id="rejectProjectNumber" />
                <p>You are about to reject project number: <strong id="rejectProjectNumberDisplay"></strong></p>
                <div class="form-group">
                    <label for="rejectionReason">Reason for Rejection <span class="required">*</span></label>
                    <textarea id="rejectionReason" class="form-control" rows="4"
                        placeholder="Please provide a reason for rejection..." required></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-cancel" onclick="closeRejectionModal()">Cancel</button>
                <button type="button" class="btn btn-danger" onclick="confirmRejection()">Reject</button>
            </div>
        </div>
    </div>
    <div id="allocationSection" style="display: none;">
        <div class="page-header">
            <h2>Allocate Won Projects</h2>
            <p class="subtitle">Assign won projects to Design Managers</p>
        </div>
        <div class="card">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Project Name</th>
                        <th>Client</th>
                        <th>BDM</th>
                        <th>Value</th>
                        <th>Project Number</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="allocationProposalsTableBody">
                    <tr>
                        <td colspan="7" class="text-center">Loading...</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    <div id="allocationModal" class="modal" style="display: none;">
        <div class="modal-content new-modal allocation-modal-large">
            <div class="modal-header">
                <h2>Allocate Project to Design Manager</h2>
                <span class="close-modal" onclick="closeAllocationModal()">&times;</span>
            </div>
            <div class="modal-body">
                <input type="hidden" id="allocationProposalId" />
                <div class="allocation-details-section">
                    <h3>Project Details</h3>
                    <div class="details-grid">
                        <div class="detail-item">
                            <label>Project Name:</label>
                            <span id="allocProjectName" class="detail-value"></span>
                        </div>
                        <div class="detail-item">
                            <label>Client:</label>
                            <span id="allocClientName" class="detail-value"></span>
                        </div>
                        <div class="detail-item">
                            <label>BDM:</label>
                            <span id="allocBdmName" class="detail-value"></span>
                        </div>
                        <div class="detail-item">
                            <label>Quote Value:</label>
                            <span id="allocQuoteValue" class="detail-value"></span>
                        </div>
                        <div class="detail-item highlight">
                            <label>Project Number:</label>
                            <span id="allocProjectNumber" class="detail-value project-number-badge"></span>
                        </div>
                        <div class="detail-item">
                            <label>Location:</label>
                            <span id="allocLocation" class="detail-value"></span>
                        </div>
                    </div>
                </div>
                <div class="form-section">
                    <h3>Allocation Details</h3>
                    <div class="form-group">
                        <label for="allocDesignLead">Design Manager / Lead <span class="required">*</span></label>
                        <select id="allocDesignLead" class="form-control" required>
                            <option value="">-- Select Design Manager --</option>
                        </select>
                        <small class="form-text">Select the Design Manager who will oversee this project</small>
                    </div>
                    <div class="form-group">
                        <label for="allocationComments3">Allocation Comments</label>
                        <textarea id="allocationComments3" class="form-control" rows="4"
                            placeholder="Add any special instructions, priorities, or notes for the Design Manager..."></textarea>
                        <small class="form-text">These comments will be visible to the Design Manager</small>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-cancel" onclick="closeAllocationModal()">Cancel</button>
                <button type="button" class="btn btn-primary btn-large" onclick="submitProposalAllocation()">
                    <span class="btn-icon">✓</span> Allocate Project
                </button>
            </div>
        </div>
    </div>
    <div id="allocatedProjectsSection" style="display: none;">
        <div class="page-header">
            <h2>My Allocated Projects</h2>
            <p class="subtitle">Projects assigned to you by management</p>
        </div>
        <div class="card">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Project #</th>
                        <th>Project Name</th>
                        <th>Client</th>
                        <th>Allocated By</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="allocatedProjectsTableBody">
                    <tr>
                        <td colspan="7" class="text-center">Loading...</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    
    <div id="designerAssignmentModal" class="modal" style="display: none;">
        <div class="modal-content new-modal" style="max-width: 800px;">
            <div class="modal-header">
                <h2>👥 Assign Designers to Project</h2>
                <span class="close-modal" onclick="closeDesignerAssignmentModal()">&times;</span>
            </div>
            <div class="modal-body">
                <input type="hidden" id="assignProjectId" />
                
                <!-- Project Hours Summary -->
                <div id="projectHoursSummary" style="background: #E8F5E9; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; display: none;">
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; text-align: center;">
                        <div>
                            <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 0.3rem;">Max Hours</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-blue);" id="displayMaxHours">0</div>
                        </div>
                        <div>
                            <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 0.3rem;">Additional</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning);" id="displayAdditionalHours">0</div>
                        </div>
                        <div>
                            <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 0.3rem;">Total Available</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--success);" id="displayTotalHours">0</div>
                        </div>
                        <div>
                            <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 0.3rem;">Remaining</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: var(--danger);" id="displayRemainingHours">0</div>
                        </div>
                    </div>
                </div>
                
                <!-- Designer Assignment List -->
                <div class="form-group">
                    <label style="font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; display: block;">
                        Assign Designers <span class="required">*</span>
                        <small style="font-weight: 400; color: var(--text-light); font-size: 0.85rem;">(hours per designer are optional)</small>
                    </label>
                    <div id="designersList" style="max-height: 400px; overflow-y: auto;">
                        <!-- Will be populated by JavaScript -->
                    </div>
                    <small class="form-text" style="display: block; margin-top: 0.5rem;">
                        💡 Select designers and allocate hours to each. Total allocated hours cannot exceed available hours.
                    </small>
                </div>
                
                <!-- Allocated Hours Summary -->
                <div style="background: #FFF3E0; padding: 1rem; border-radius: 8px; margin-top: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 600;">Total Hours Allocated:</span>
                        <span style="font-size: 1.5rem; font-weight: 700; color: var(--primary-blue);" id="totalAllocatedHours">0</span>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-cancel" onclick="closeDesignerAssignmentModal()">Cancel</button>
                <button type="button" class="btn btn-primary" onclick="submitDesignerAssignment()">
                    ✅ Assign Designers
                </button>
            </div>
        </div>
    </div>

    <div id="bdmFilesModal" class="modal" style="display: none;">
        <div class="modal-content new-modal">
            <div class="modal-header">
                <h2>BDM Uploaded Files</h2>
                <span class="close-modal" onclick="closeBDMFilesModal()">&times;</span>
            </div>
            <div class="modal-body">
                <div id="bdmFilesList" class="files-list">
                    </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" onclick="closeBDMFilesModal()">Close</button>
            </div>
        </div>
    </div>

    <div id="successModal" class="modal" style="display: none;">
        <div class="modal-content new-modal modal-success">
            <div class="modal-body text-center">
                <div class="success-icon">✓</div>
                <h3 id="successMessage">Operation Successful!</h3>
                <p id="successDetails"></p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" onclick="closeSuccessModal()">OK</button>
            </div>
        </div>
    </div>


    <!-- Accounts Update Variation Modal -->
    <div id="accountsUpdateVariationModal" class="modal" style="display: none;">
        <div class="modal-content new-modal" style="max-width: 680px;">
            <div class="modal-header">
                <h2>✏️ Update Variation Details (Accounts)</h2>
                <span class="close-modal" onclick="document.getElementById('accountsUpdateVariationModal').style.display='none'">&times;</span>
            </div>
            <div class="modal-body" style="max-height: 80vh; overflow-y: auto;">
                <input type="hidden" id="acctVarId">
                <div class="info-section" style="background: var(--light-blue); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <p style="margin:0;"><strong>Variation:</strong> <span id="acctVarInfo"></span></p>
                </div>

                <!-- Client Details -->
                <div style="border-bottom: 1px solid var(--border-color); margin-bottom: 1.25rem; padding-bottom: 1.25rem;">
                    <h4 style="margin-bottom:1rem; color: var(--primary-blue);">Client Details</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label for="acctVarClientName">Client Contact Name</label>
                            <input type="text" id="acctVarClientName" class="form-control" placeholder="e.g., John Smith">
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label for="acctVarClientEmail">Client Email</label>
                            <input type="email" id="acctVarClientEmail" class="form-control" placeholder="e.g., john@client.com">
                        </div>
                    </div>
                </div>

                <!-- Financial Details -->
                <div style="border-bottom: 1px solid var(--border-color); margin-bottom: 1.25rem; padding-bottom: 1.25rem;">
                    <h4 style="margin-bottom:1rem; color: var(--primary-blue);">Financial Details</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label for="acctVarAmount">Variation Amount</label>
                            <input type="number" id="acctVarAmount" class="form-control" step="0.01" min="0" placeholder="e.g., 5000.00">
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label for="acctVarCurrency">Currency</label>
                            <select id="acctVarCurrency" class="form-control">
                                <option value="">-- Select --</option>
                                <option value="AUD">AUD</option>
                                <option value="USD">USD</option>
                                <option value="GBP">GBP</option>
                                <option value="EUR">EUR</option>
                                <option value="NZD">NZD</option>
                                <option value="SGD">SGD</option>
                                <option value="CAD">CAD</option>
                                <option value="AED">AED</option>
                            </select>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label for="acctVarInvoiceRef">Invoice Reference / PO Number</label>
                            <input type="text" id="acctVarInvoiceRef" class="form-control" placeholder="e.g., PO-2025-001">
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label for="acctVarPaymentTerms">Payment Terms</label>
                            <input type="text" id="acctVarPaymentTerms" class="form-control" placeholder="e.g., Net 30 days">
                        </div>
                    </div>
                </div>

                <!-- Accounts / Billing Notes -->
                <div class="form-group">
                    <h4 style="margin-bottom:0.75rem; color: var(--primary-blue);">Accounts / Billing Notes</h4>
                    <textarea id="acctVarAccountsDetails" class="form-control" rows="4" placeholder="Internal billing instructions, notes, special conditions..."></textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-cancel" onclick="document.getElementById('accountsUpdateVariationModal').style.display='none'">Cancel</button>
                <button type="button" class="btn btn-success" onclick="submitAccountsVariationUpdate()">
                    💾 Save &amp; Notify COO
                </button>
            </div>
        </div>
    </div>

    <div id="addVariationModal" class="modal" style="display: none;">
        <div class="modal-content new-modal" style="max-width: 780px;">
            <div class="modal-header">
                <h2>➕ Add Variation for Approval</h2>
                <span class="close-modal" onclick="closeAddVariationModal()">&times;</span>
            </div>
            <div class="modal-body" style="max-height: 80vh; overflow-y: auto;">
                <input type="hidden" id="variationParentProjectId" />

                <div class="info-section" style="background: var(--light-blue); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <h4 style="color: var(--primary-blue);">Parent Project</h4>
                    <p style="margin: 0;"><strong>Project:</strong> <span id="variationParentProjectName"></span></p>
                    <p style="margin: 0;"><strong>Code:</strong> <span id="variationParentProjectCode"></span></p>
                </div>

                <form id="addVariationForm">
                    <!-- Variation Code & Hours -->
                    <div class="form-group">
                        <label for="variationCode">Variation Code <span class="required">*</span></label>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <input type="text" id="variationCode" class="form-control" placeholder="e.g., STE25-513-V1" required>
                            <button type="button" onclick="generateVariationCode()" class="btn btn-outline" style="width: auto; white-space: nowrap;">
                                Generate
                            </button>
                        </div>
                        <small class="form-text">A unique code for this variation.</small>
                    </div>

                    <div class="form-group">
                        <label for="variationHours">Variation Hours <span class="required">*</span></label>
                        <input type="number" id="variationHours" class="form-control" step="0.5" min="0.5" placeholder="Enter estimated hours for this variation" required>
                        <small class="form-text">Estimated hours required to complete this variation.</small>
                    </div>

                    <div class="form-group">
                        <label for="variationScope">Scope of Work / Description <span class="required">*</span></label>
                        <textarea id="variationScope" class="form-control" rows="4" placeholder="Describe the work required for this variation. This will be sent to the COO for approval." required></textarea>
                    </div>

                    <!-- CLIENT DETAILS -->
                    <div style="border-top: 1px solid var(--border-color); margin: 1.5rem 0; padding-top: 1.5rem;">
                        <h4 style="margin-bottom: 1rem; color: var(--primary-blue);">Client Details</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group" style="margin-bottom: 0;">
                                <label for="variationClientName">Client Contact Name</label>
                                <input type="text" id="variationClientName" class="form-control" placeholder="e.g., John Smith">
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label for="variationClientEmail">Client Email</label>
                                <input type="email" id="variationClientEmail" class="form-control" placeholder="e.g., john@client.com">
                            </div>
                        </div>
                    </div>

                    <!-- FINANCIAL DETAILS -->
                    <div style="border-top: 1px solid var(--border-color); margin: 1.5rem 0; padding-top: 1.5rem;">
                        <h4 style="margin-bottom: 1rem; color: var(--primary-blue);">Financial Details</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div class="form-group" style="margin-bottom: 0;">
                                <label for="variationAmount">Variation Amount</label>
                                <input type="number" id="variationAmount" class="form-control" step="0.01" min="0" placeholder="e.g., 5000.00">
                                <small class="form-text">Financial value of this variation.</small>
                            </div>
                            <div class="form-group" style="margin-bottom: 0;">
                                <label for="variationCurrency">Currency</label>
                                <select id="variationCurrency" class="form-control">
                                    <option value="">-- Select Currency --</option>
                                    <option value="AUD">AUD - Australian Dollar</option>
                                    <option value="USD">USD - US Dollar</option>
                                    <option value="GBP">GBP - British Pound</option>
                                    <option value="EUR">EUR - Euro</option>
                                    <option value="NZD">NZD - New Zealand Dollar</option>
                                    <option value="SGD">SGD - Singapore Dollar</option>
                                    <option value="CAD">CAD - Canadian Dollar</option>
                                    <option value="AED">AED - UAE Dirham</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- ACCOUNTS DETAILS -->
                    <div style="border-top: 1px solid var(--border-color); margin: 1.5rem 0; padding-top: 1.5rem;">
                        <h4 style="margin-bottom: 1rem; color: var(--primary-blue);">Accounts Details</h4>
                        <div class="form-group">
                            <label for="variationAccountsDetails">Accounts / Billing Notes</label>
                            <textarea id="variationAccountsDetails" class="form-control" rows="3" placeholder="e.g., Invoice reference, PO number, billing instructions, payment terms..."></textarea>
                        </div>
                    </div>

                    <!-- VARIATION DOCUMENT UPLOAD -->
                    <div style="border-top: 1px solid var(--border-color); margin: 1.5rem 0; padding-top: 1.5rem;">
                        <h4 style="margin-bottom: 1rem; color: var(--primary-blue);">Variation Document</h4>
                        <div class="form-group">
                            <label for="variationDocument">Upload Variation Document (PDF or Word)</label>
                            <div id="variationDocDropZone" style="border: 2px dashed var(--border-color); border-radius: 8px; padding: 1.5rem; text-align: center; cursor: pointer; background: #f8f9fa; transition: border-color 0.2s;"
                                onclick="document.getElementById('variationDocument').click()"
                                ondragover="event.preventDefault(); this.style.borderColor='var(--primary-blue)';"
                                ondragleave="this.style.borderColor='var(--border-color)';"
                                ondrop="handleVariationDocDrop(event)">
                                <div style="font-size: 2rem; margin-bottom: 0.5rem;">📄</div>
                                <p style="margin: 0; color: var(--text-light);">Click or drag & drop your variation document here</p>
                                <p style="margin: 0.25rem 0 0; font-size: 0.8rem; color: var(--text-light);">Supported: PDF, DOC, DOCX (max 50 MB)</p>
                            </div>
                            <input type="file" id="variationDocument" style="display: none;" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onchange="onVariationDocSelected(this)">
                            <div id="variationDocPreview" style="display: none; margin-top: 0.75rem; padding: 0.75rem; background: #e8f5e9; border-radius: 6px; display: flex; align-items: center; gap: 0.75rem;">
                                <span style="font-size: 1.5rem;">📎</span>
                                <div style="flex: 1;">
                                    <strong id="variationDocFileName" style="font-size: 0.9rem;"></strong>
                                    <div id="variationDocFileSize" style="font-size: 0.8rem; color: var(--text-light);"></div>
                                </div>
                                <button type="button" onclick="clearVariationDoc()" style="background: none; border: none; cursor: pointer; color: var(--danger); font-size: 1.2rem;" title="Remove file">&times;</button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-cancel" onclick="closeAddVariationModal()">Cancel</button>
                <button type="button" class="btn btn-success" onclick="submitVariationForApproval()">
                    Submit for COO Approval
                </button>
            </div>
        </div>
    </div>
    <div id="variationApprovalModal" class="modal" style="display: none;">
        <div class="modal-content new-modal" style="max-width: 860px;">
            <div class="modal-header">
                <h2>🔍 Review Variation Request</h2>
                <span class="close-modal" onclick="closeModal()">&times;</span>
            </div>
            <div class="modal-body" style="max-height: 80vh; overflow-y: auto;">
                <input type="hidden" id="approvalVariationId" />
                <input type="hidden" id="approvalParentProjectId" />

                <!-- VARIATION DETAILS -->
                <div class="allocation-details-section">
                    <h3>Variation Details</h3>
                    <div class="details-grid">
                        <div class="detail-item">
                            <label>Parent Project:</label>
                            <span id="app-parentProjectName" class="detail-value"></span>
                        </div>
                        <div class="detail-item">
                            <label>Client Company:</label>
                            <span id="app-clientCompany" class="detail-value"></span>
                        </div>
                        <div class="detail-item highlight">
                            <label>Variation Code:</label>
                            <span id="app-variationCode" class="detail-value project-number-badge" style="background: var(--warning); color: #856404;"></span>
                        </div>
                        <div class="detail-item highlight">
                            <label>Requested Hours:</label>
                            <span id="app-estimatedHours" class="detail-value" style="font-size: 1.5rem; color: var(--primary-blue);"></span>
                        </div>
                        <div class="detail-item" style="grid-column: 1 / -1;">
                            <label>Submitted By:</label>
                            <span id="app-submittedBy" class="detail-value"></span>
                        </div>
                        <div class="detail-item" style="grid-column: 1 / -1; background: white; padding: 1rem; border-radius: 8px;">
                            <label>Scope of Work:</label>
                            <p id="app-scopeDescription" class="detail-value" style="line-height: 1.6; white-space: pre-wrap;"></p>
                        </div>
                    </div>
                </div>

                <!-- CLIENT DETAILS -->
                <div id="app-clientDetailsSection" class="allocation-details-section" style="margin-top: 1.5rem; display: none;">
                    <h3>Client Details</h3>
                    <div class="details-grid">
                        <div class="detail-item" id="app-clientNameRow" style="display: none;">
                            <label>Client Contact:</label>
                            <span id="app-clientName" class="detail-value"></span>
                        </div>
                        <div class="detail-item" id="app-clientEmailRow" style="display: none;">
                            <label>Client Email:</label>
                            <span id="app-clientEmail" class="detail-value"></span>
                        </div>
                    </div>
                </div>

                <!-- FINANCIAL DETAILS -->
                <div id="app-financialSection" class="allocation-details-section" style="margin-top: 1.5rem; display: none;">
                    <h3>Financial Details</h3>
                    <div class="details-grid">
                        <div class="detail-item highlight">
                            <label>Variation Amount:</label>
                            <span id="app-amount" class="detail-value" style="font-size: 1.3rem; color: var(--success); font-weight: 700;"></span>
                        </div>
                        <div class="detail-item highlight">
                            <label>Currency:</label>
                            <span id="app-currency" class="detail-value" style="font-size: 1.1rem; font-weight: 600;"></span>
                        </div>
                    </div>
                </div>

                <!-- ACCOUNTS DETAILS -->
                <div id="app-accountsSection" class="allocation-details-section" style="margin-top: 1.5rem; display: none;">
                    <h3>Accounts / Billing Details</h3>
                    <div class="detail-item" style="background: white; padding: 1rem; border-radius: 8px;">
                        <p id="app-accountsDetails" class="detail-value" style="line-height: 1.6; white-space: pre-wrap; margin: 0;"></p>
                    </div>
                </div>

                <!-- VARIATION DOCUMENT -->
                <div id="app-documentSection" class="allocation-details-section" style="margin-top: 1.5rem; display: none;">
                    <h3>Variation Document</h3>
                    <div style="background: white; padding: 1rem; border-radius: 8px; display: flex; align-items: center; gap: 1rem;">
                        <span style="font-size: 2rem;">📄</span>
                        <div style="flex: 1;">
                            <strong id="app-documentName" style="display: block;"></strong>
                            <small style="color: var(--text-light);">Uploaded variation document</small>
                        </div>
                        <a id="app-documentLink" href="#" target="_blank" class="btn btn-primary btn-sm" style="text-decoration: none;">
                            ⬇️ Download / View
                        </a>
                    </div>
                </div>

                <!-- APPROVAL DECISION -->
                <div class="form-section" style="margin-top: 1.5rem;">
                    <h3>Approval Decision</h3>
                    <div class="form-group">
                        <label for="approvalNotes">Notes (Required for Rejection)</label>
                        <textarea id="approvalNotes" class="form-control" rows="4" placeholder="Add approval notes or a reason for rejection..."></textarea>
                    </div>
                </div>

            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-cancel" onclick="closeModal()">Cancel</button>
                <button type="button" class="btn btn-danger" style="margin-right: auto;" onclick="submitVariationApproval('rejected')">
                    ❌ Reject
                </button>
                <button type="button" class="btn btn-success btn-large" onclick="submitVariationApproval('approved')">
                    ✅ Approve Variation
                </button>
            </div>
        </div>
    </div>
    <!-- ADD THIS LINE BEFORE CLOSING BODY TAG -->



<!-- ============================================ -->
<!-- STEP 2: ADD THESE SECTIONS BEFORE </body> -->
<!-- Paste these complete sections -->
<!-- ============================================ -->

<!-- EXECUTIVE MONITORING SECTION -->
<div id="executiveTimesheetMonitoring" style="display: none;">
    <div class="page-header">
        <h2>📊 Executive Timesheet Monitoring</h2>
        <p class="subtitle">Advanced analytics and insights for project hours management</p>
    </div>

    <!-- Top Level Metrics -->
    <div id="executiveMetrics" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        <!-- Populated by JavaScript -->
    </div>

    <!-- Date Range Selector -->
    <div class="card" style="margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                <div>
                    <label style="font-size: 0.85rem; color: var(--text-light); display: block; margin-bottom: 0.25rem;">From Date:</label>
                    <input type="date" id="executiveFromDate" class="form-control" style="width: auto;">
                </div>
                <div>
                    <label style="font-size: 0.85rem; color: var(--text-light); display: block; margin-bottom: 0.25rem;">To Date:</label>
                    <input type="date" id="executiveToDate" class="form-control" style="width: auto;">
                </div>
                <button onclick="applyExecutiveDateFilter()" class="btn btn-primary" style="margin-top: 1.5rem;">
                    Apply Filter
                </button>
                <button onclick="resetExecutiveDateFilter()" class="btn btn-outline" style="margin-top: 1.5rem;">
                    Reset
                </button>
            </div>
            
            <div style="display: flex; gap: 0.5rem;">
                <button onclick="exportExecutiveReport('summary')" class="btn btn-outline">
                    📊 Export Summary
                </button>
                <button onclick="exportExecutiveReport('detailed')" class="btn btn-outline">
                    📋 Export Detailed
                </button>
            </div>
        </div>
    </div>

    <!-- Quick Stats Row -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
        <div class="stat-card">
            <div class="stat-label">Active Projects</div>
            <div class="stat-value" id="execActiveProjects">0</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Total Designers</div>
            <div class="stat-value" id="execTotalDesigners">0</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Timesheet Entries</div>
            <div class="stat-value" id="execTotalEntries">0</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Avg Hours/Project</div>
            <div class="stat-value" id="execAvgHours">0</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Efficiency Rate</div>
            <div class="stat-value" id="execEfficiency">0%</div>
        </div>
    </div>

    <!-- Tabs for Different Views -->
    <div class="tabs-container" style="margin-bottom: 1.5rem;">
        <div class="tabs">
            <div class="tab active" onclick="switchExecutiveTab('overview')">Overview</div>
            <div class="tab" onclick="switchExecutiveTab('projects')">Projects</div>
            <div class="tab" onclick="switchExecutiveTab('designers')">Designers</div>
            <div class="tab" onclick="switchExecutiveTab('analytics')">Analytics</div>
            <div class="tab" onclick="switchExecutiveTab('alerts')">Alerts</div>
        </div>
    </div>

    <!-- Tab Content -->
    <div id="executiveTabContent">
        <!-- Content will be loaded dynamically -->
    </div>
</div>

<!-- TIMESHEET SECTION FOR DESIGNERS -->
<div id="timesheetSection" style="display: none;">
    <div class="page-header">
        <h2>⏱️ My Timesheet</h2>
        <p class="subtitle">Track your hours on assigned projects</p>
    </div>

    <div class="card">
        <div class="card-header">
            <h3>Log Hours</h3>
            <button onclick="showTimesheetModal()" class="btn btn-primary">
                <span class="btn-icon">+</span> Log Hours
            </button>
        </div>

        <!-- Timesheet Summary -->
        <div id="timesheetSummary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; padding: 1rem;">
            <!-- Will be populated by JavaScript -->
        </div>
                            

        <!-- Timesheet Entries Table -->
        <table class="data-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Project</th>
                    <th>Hours</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="timesheetTableBody">
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem;">
                        No timesheet entries yet
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</div>


<!-- ============================================ -->
<!-- STEP 3: ADD THESE STYLES -->
<!-- Add to your <style> section -->
<!-- ============================================ -->

<style>
/* Executive Monitoring Styles */
.metric-card {
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    color: white;
}

.metric-icon {
    font-size: 2.5rem;
}

.metric-content {
    flex: 1;
}

.metric-label {
    font-size: 0.9rem;
    opacity: 0.9;
    margin-bottom: 0.5rem;
}

.metric-value {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
}

.metric-subtitle {
    font-size: 0.85rem;
    opacity: 0.8;
    margin-top: 0.5rem;
}

.stat-card {
    background: white;
    border: 2px solid var(--border);
    border-radius: 10px;
    padding: 1rem;
    text-align: center;
}

.stat-label {
    font-size: 0.85rem;
    color: var(--text-light);
    margin-bottom: 0.5rem;
}

.stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--primary-blue);
}

.tabs-container {
    background: white;
    border-radius: 12px;
    border: 2px solid var(--border);
    overflow: hidden;
}

.tabs {
    display: flex;
    gap: 0;
}

.tab {
    flex: 1;
    padding: 1rem;
    text-align: center;
    cursor: pointer;
    font-weight: 600;
    color: var(--text-light);
    transition: all 0.2s;
    border-right: 1px solid var(--border);
}

.tab:last-child {
    border-right: none;
}

.tab:hover {
    background: var(--light-blue);
}

.tab.active {
    background: var(--primary-blue);
    color: white;
}

.project-card {
    transition: all 0.2s;
}

.project-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    border-color: var(--primary-blue);
}

.hour-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: white;
    border-radius: 8px;
    border: 2px solid var(--border);
}

.hour-badge .label {
    color: var(--text-light);
    font-size: 0.85rem;
}

.hour-badge .value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--primary-blue);
}

.status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.85rem;
    font-weight: 600;
}

.status-submitted {
    background: #fff3cd;
    color: #856404;
}

.status-approved {
    background: #d4edda;
    color: #155724;
}

.status-rejected {
    background: #f8d7da;
    color: #721c24;
}

.progress-bar-container {
    background: #e0e0e0;
    border-radius: 10px;
    overflow: hidden;
}
</style>


<!-- ============================================ -->
<!-- STEP 4: ADD THIS COMPLETE JAVASCRIPT -->
<!-- Add before closing </body> tag -->
<!-- ============================================ -->
<script>

// ===================================
// DESIGN LEAD - ASSIGN DESIGNERS (Independent script block)
// ===================================

window.assignDesigners = async function(projectId) {
    const modal = document.getElementById('designerAssignmentModal');
    if (!modal) { alert('Modal not found. Please refresh.'); return; }

    try {
        showLoading();

        const [response, projectResponse, timesheetResponse] = await Promise.all([
            apiCall('users?role=designer'),
            apiCall(`projects?id=${projectId}`),
            apiCall(`timesheets?projectId=${projectId}`)
        ]);
        if (!response.success) throw new Error(response.error || 'Failed to fetch designers');
        const designers = response.data || [];
        const currentProject = projectResponse.success ? projectResponse.data : {};

        // Build per-designer hours logged
        const timesheets = (timesheetResponse.success ? timesheetResponse.data : []);
        const hoursLoggedPerDesigner = {};
        timesheets.forEach(t => {
            if (t.designerUid) {
                hoursLoggedPerDesigner[t.designerUid] = (hoursLoggedPerDesigner[t.designerUid] || 0) + (parseFloat(t.hours) || 0);
            }
        });

        const maxHours = parseFloat(currentProject.maxAllocatedHours || 0);
        const additionalHours = parseFloat(currentProject.additionalHours || 0);
        const totalAvailable = maxHours + additionalHours;

        const existingDesignersList = currentProject.assignedDesigners || [];
        const existingDesignerHoursMap = currentProject.assignedDesignerHours || {};
        const alreadyAllocated = existingDesignersList.reduce((sum, uid) => sum + (parseFloat(existingDesignerHoursMap[uid]) || 0), 0);
        const remainingToAllocate = totalAvailable - alreadyAllocated;

        // Hours summary
        const summaryDiv = document.getElementById('projectHoursSummary');
        if (maxHours > 0 && summaryDiv) {
            summaryDiv.style.display = 'block';
            summaryDiv.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; text-align: center;">
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 0.3rem;">Project Budget</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-blue);">${maxHours.toFixed(1)}h</div>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 0.3rem;">Additional Buffer</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning);">${additionalHours.toFixed(1)}h</div>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 0.3rem;">Total Available</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--success);">${totalAvailable.toFixed(1)}h</div>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 0.3rem;">Designer Allocated</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: ${alreadyAllocated > 0 ? '#f59e0b' : 'var(--text-light)'};">${alreadyAllocated.toFixed(1)}h</div>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 0.3rem;">Remaining</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: ${remainingToAllocate > 0 ? 'var(--success)' : 'var(--danger)'};" id="displayRemainingHours">${remainingToAllocate.toFixed(1)}h</div>
                    </div>
                </div>
                ${alreadyAllocated > 0 ? `
                <div style="margin-top: 1rem; padding: 0.75rem; background: #fef3c7; border-radius: 6px; border-left: 4px solid #f59e0b;">
                    <strong>Partial Allocation:</strong> ${alreadyAllocated.toFixed(1)}h allocated to ${existingDesignersList.length} designer(s). Remaining: ${remainingToAllocate.toFixed(1)}h.
                </div>` : ''}
            `;
        } else if (summaryDiv) {
            summaryDiv.style.display = 'none';
        }

        // Populate designers list
        const designersList = document.getElementById('designersList');
        if (!designersList) throw new Error('Designer list container not found');
        designersList.innerHTML = '';

        // Sort: assigned first
        const sortedDesigners = [...designers].sort((a, b) => {
            const aA = existingDesignersList.includes(a.uid) ? 0 : 1;
            const bA = existingDesignersList.includes(b.uid) ? 0 : 1;
            return aA !== bA ? aA - bA : (a.name || '').localeCompare(b.name || '');
        });

        sortedDesigners.forEach(designer => {
            const isAssigned = existingDesignersList.includes(designer.uid);
            const currentHours = parseFloat(existingDesignerHoursMap[designer.uid]) || 0;
            const logged = parseFloat(hoursLoggedPerDesigner[designer.uid]) || 0;
            const hasLoggedHours = logged > 0;

            const row = document.createElement('div');
            row.className = 'designer-row';
            row.style.cssText = 'display: grid; grid-template-columns: auto 1fr auto; gap: 1rem; align-items: center; padding: 1rem; border: 2px solid var(--border); border-radius: 8px; margin-bottom: 0.8rem; background: white;';
            if (isAssigned && currentHours > 0) {
                row.style.borderColor = '#10b981';
                row.style.background = '#f0fdf4';
            }

            row.innerHTML = `
                <div><input type="checkbox" id="designer-${designer.uid}" value="${designer.uid}"
                    data-name="${designer.name}" data-email="${designer.email}"
                    data-current-hours="${currentHours}" data-hours-logged="${logged}"
                    ${isAssigned ? 'checked' : ''} ${hasLoggedHours ? 'disabled title="Cannot unassign - has logged hours"' : ''}
                    onchange="window._toggleDesignerHours(this)"
                    style="width: 20px; height: 20px; cursor: ${hasLoggedHours ? 'not-allowed' : 'pointer'};"></div>
                <div>
                    <label for="designer-${designer.uid}" style="font-weight: 600; margin: 0; cursor: pointer;">
                        ${designer.name}
                        ${isAssigned && currentHours > 0 ? `<span style="color: #10b981; font-size: 0.85rem;">(Allocated: ${currentHours}h)</span>` : ''}
                    </label>
                    <div style="font-size: 0.85rem; color: var(--text-light);">
                        ${designer.email} ${designer.assignedProjects ? '• ' + designer.assignedProjects + ' active projects' : ''}
                    </div>
                    ${hasLoggedHours ? `<div style="font-size: 0.8rem; color: #8b5cf6; margin-top: 2px;">⏱ ${logged.toFixed(1)}h logged (min: ${logged.toFixed(1)}h)</div>` : ''}
                </div>
                <div style="min-width: 150px;"><div style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="number" id="hours-${designer.uid}" class="form-control hours-input"
                        step="0.5" min="${hasLoggedHours ? logged : 0}" value="${currentHours}" placeholder="Hours"
                        ${!isAssigned ? 'disabled' : ''} data-min-hours="${hasLoggedHours ? logged : 0}"
                        oninput="window._updateAllocTotal()" onchange="window._updateAllocTotal()"
                        style="width: 80px; padding: 0.5rem; text-align: center;">
                    <span style="font-size: 0.9rem; color: var(--text-light);">hrs</span>
                </div></div>`;
            designersList.appendChild(row);
        });

        document.getElementById('assignProjectId').value = projectId;
        modal.dataset.maxHours = totalAvailable;
        modal.dataset.alreadyAllocated = alreadyAllocated;
        window._updateAllocTotal();
        modal.style.display = 'flex';

    } catch (error) {
        console.error('Error loading designers:', error);
        alert('Failed to load designers: ' + error.message);
    } finally {
        hideLoading();
    }
};

window._toggleDesignerHours = function(checkbox) {
    const uid = checkbox.value;
    const hoursInput = document.getElementById('hours-' + uid);
    const currentHours = parseFloat(checkbox.dataset.currentHours || 0);
    if (checkbox.checked) {
        hoursInput.disabled = false;
        if (!hoursInput.value || hoursInput.value === '0') hoursInput.value = currentHours > 0 ? currentHours : '1';
    } else {
        hoursInput.disabled = true;
        hoursInput.value = '0';
    }
    window._updateAllocTotal();
};

window._updateAllocTotal = function() {
    let total = 0;
    document.querySelectorAll('.hours-input:not([disabled])').forEach(input => { total += parseFloat(input.value) || 0; });
    const totalDisplay = document.getElementById('totalAllocatedHours');
    if (totalDisplay) totalDisplay.textContent = total.toFixed(1);

    const modal = document.getElementById('designerAssignmentModal');
    const maxHours = parseFloat(modal?.dataset?.maxHours || 0);
    if (maxHours > 0) {
        const remaining = maxHours - total;
        const rd = document.getElementById('displayRemainingHours');
        if (rd) {
            if (remaining < 0) { rd.style.color = 'var(--danger)'; rd.textContent = remaining.toFixed(1) + 'h (OVER!)'; }
            else if (remaining === 0) { rd.style.color = 'var(--success)'; rd.textContent = '0h (Fully Allocated)'; }
            else if (remaining < maxHours * 0.2) { rd.style.color = '#f59e0b'; rd.textContent = remaining.toFixed(1) + 'h'; }
            else { rd.style.color = 'var(--success)'; rd.textContent = remaining.toFixed(1) + 'h'; }
        }
        if (totalDisplay) {
            totalDisplay.style.color = total > maxHours ? 'var(--danger)' : total === maxHours ? 'var(--success)' : 'var(--primary-blue)';
        }
    }
};

window.submitDesignerAssignment = async function() {
    const projectId = document.getElementById('assignProjectId').value;
    const checkboxes = document.querySelectorAll('#designersList input[type="checkbox"]:checked');
    const modal = document.getElementById('designerAssignmentModal');
    const maxHours = parseFloat(modal?.dataset?.maxHours || 0);

    const designerUids = [], designerNames = [], designerEmails = [], designerHours = {};
    let totalAllocated = 0, hasError = false;

    checkboxes.forEach(cb => {
        if (hasError) return;
        const uid = cb.value;
        const hi = document.getElementById('hours-' + uid);
        const hours = parseFloat(hi.value) || 0;
        const minH = parseFloat(hi.dataset.minHours || 0);
        if (hours > 0 && minH > 0 && hours < minH) { alert('Cannot allocate less than ' + minH.toFixed(1) + 'h for ' + cb.dataset.name + ' — already logged ' + minH.toFixed(1) + 'h.'); hasError = true; return; }
        designerUids.push(uid); designerNames.push(cb.dataset.name); designerEmails.push(cb.dataset.email);
        designerHours[uid] = hours; totalAllocated += hours;
    });
    if (hasError) return;
    if (designerUids.length === 0) { alert('Please select at least one designer.'); return; }
    if (maxHours > 0 && totalAllocated > maxHours + 0.1) { alert('Total (' + totalAllocated.toFixed(1) + 'h) exceeds budget (' + maxHours.toFixed(1) + 'h). Please adjust.'); return; }

    const confirmText = 'Assignment Summary:\n\n' + designerUids.map((uid, i) => designerNames[i] + (designerHours[uid] > 0 ? ': ' + designerHours[uid] + 'h' : ' (no hours set)')).join('\n') + '\n\nTotal Hours: ' + (totalAllocated > 0 ? totalAllocated.toFixed(1) + 'h' : 'none (designers share project budget)') + ' / ' + maxHours.toFixed(1) + 'h budget\n\nProceed?';
    if (!confirm(confirmText)) return;

    try {
        showLoading();
        const result = await apiCall('projects?id=' + projectId, {
            method: 'PUT',
            body: JSON.stringify({ action: 'assign_designers', data: { designerUids, designerNames, designerEmails, designerHours, totalAllocatedHours: totalAllocated } })
        });
        if (result.success) {
            if (typeof showSuccessModal === 'function') showSuccessModal('Designers Updated!', designerUids.length + ' designer(s) assigned' + (totalAllocated > 0 ? ' with ' + totalAllocated.toFixed(1) + 'h total' : '') + '.');
            else alert('Designers assigned successfully!');
            window.closeDesignerAssignmentModal();
            if (typeof currentUserRole !== 'undefined' && currentUserRole === 'design_lead' && typeof showDesignLeadPortal === 'function') showDesignLeadPortal();
            else if (typeof showProjects === 'function') showProjects();
        } else {
            throw new Error(result.error || 'Assignment failed');
        }
    } catch (error) {
        console.error('Error assigning designers:', error);
        alert('Failed to assign designers: ' + error.message);
    } finally {
        hideLoading();
    }
};

window.closeDesignerAssignmentModal = function() {
    const modal = document.getElementById('designerAssignmentModal');
    if (modal) modal.style.display = 'none';
    const dl = document.getElementById('designersList');
    if (dl) dl.innerHTML = '';
};

console.log('✅ Designer assignment functions registered (independent block)');

</script>

<script>

// ===================================
// EXECUTIVE MONITORING JAVASCRIPT
// ===================================

let executiveData = {
    projects: [],
    timesheets: [],
    designers: [],
    dateRange: { from: null, to: null }
};

// Load executive monitoring dashboard
async function loadExecutiveMonitoring() {
    try {
        showLoading();
        
        const [projectsResponse, timesheetsResponse, usersResponse] = await Promise.all([
            apiCall('projects'),
            apiCall('timesheets'),
            apiCall('users?role=designer')
        ]);
        
        if (!projectsResponse.success || !timesheetsResponse.success || !usersResponse.success) {
            throw new Error('Failed to load monitoring data');
        }
        
        executiveData.projects = (projectsResponse.data || []).filter(p => p.allocatedHours && p.allocatedHours > 0);
        executiveData.timesheets = timesheetsResponse.data || [];
        executiveData.designers = usersResponse.data || [];
        
        calculateExecutiveMetrics();
        switchExecutiveTab('overview');
        
        hideLoading();
    } catch (error) {
        console.error('Error loading executive monitoring:', error);
        alert('Error loading monitoring dashboard: ' + error.message);
        hideLoading();
    }
}

// Calculate executive metrics
function calculateExecutiveMetrics() {
    const projects = executiveData.projects;
    const timesheets = executiveData.timesheets;
    
    const totalAllocated = projects.reduce((sum, p) => sum + (p.allocatedHours || 0), 0);
    const totalLogged = projects.reduce((sum, p) => sum + (p.hoursLogged || 0), 0);
    const totalRemaining = totalAllocated - totalLogged;
    const avgUtilization = totalAllocated > 0 ? (totalLogged / totalAllocated) * 100 : 0;
    
    const onTrack = projects.filter(p => {
        const usage = p.allocatedHours > 0 ? (p.hoursLogged / p.allocatedHours) * 100 : 0;
        return usage < 75;
    }).length;
    
    const atRisk = projects.filter(p => {
        const usage = p.allocatedHours > 0 ? (p.hoursLogged / p.allocatedHours) * 100 : 0;
        return usage >= 75 && usage < 90;
    }).length;
    
    const critical = projects.filter(p => {
        const usage = p.allocatedHours > 0 ? (p.hoursLogged / p.allocatedHours) * 100 : 0;
        return usage >= 90;
    }).length;
    
    const exceeded = projects.filter(p => {
        const usage = p.allocatedHours > 0 ? (p.hoursLogged / p.allocatedHours) * 100 : 0;
        return usage >= 100;
    }).length;
    
    const activeDesigners = new Set(timesheets.map(t => t.designerUid)).size;
    const avgHoursPerProject = projects.length > 0 ? totalLogged / projects.length : 0;
    const efficiency = totalAllocated > 0 ? (totalLogged / totalAllocated) * 100 : 0;
    
    const metricsHtml = `
        <div class="metric-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <div class="metric-icon">💰</div>
            <div class="metric-content">
                <div class="metric-label">Total Budget (Hours)</div>
                <div class="metric-value">${totalAllocated.toFixed(0)}h</div>
                <div class="metric-subtitle">${projects.length} active projects</div>
            </div>
        </div>
        
        <div class="metric-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
            <div class="metric-icon">⏱️</div>
            <div class="metric-content">
                <div class="metric-label">Hours Consumed</div>
                <div class="metric-value">${totalLogged.toFixed(0)}h</div>
                <div class="metric-subtitle">${avgUtilization.toFixed(1)}% utilization</div>
            </div>
        </div>
        
        <div class="metric-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
            <div class="metric-icon">📊</div>
            <div class="metric-content">
                <div class="metric-label">Budget Remaining</div>
                <div class="metric-value">${totalRemaining.toFixed(0)}h</div>
                <div class="metric-subtitle">${((totalRemaining / totalAllocated) * 100).toFixed(1)}% available</div>
            </div>
        </div>
        
        <div class="metric-card" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);">
            <div class="metric-icon">⚠️</div>
            <div class="metric-content">
                <div class="metric-label">Project Health</div>
                <div class="metric-value" style="font-size: 1.2rem;">
                    🟢 ${onTrack} | 🟡 ${atRisk} | 🔴 ${critical}
                </div>
                <div class="metric-subtitle">${exceeded} exceeded budget</div>
            </div>
        </div>
    `;
    
    document.getElementById('executiveMetrics').innerHTML = metricsHtml;
    document.getElementById('execActiveProjects').textContent = projects.length;
    document.getElementById('execTotalDesigners').textContent = activeDesigners;
    document.getElementById('execTotalEntries').textContent = timesheets.length;
    document.getElementById('execAvgHours').textContent = avgHoursPerProject.toFixed(1) + 'h';
    document.getElementById('execEfficiency').textContent = efficiency.toFixed(1) + '%';
}

// Switch between tabs
function switchExecutiveTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event?.target?.classList.add('active');
    
    const contentDiv = document.getElementById('executiveTabContent');
    
    switch(tab) {
        case 'overview':
            contentDiv.innerHTML = generateOverviewContent();
            break;
        case 'projects':
            contentDiv.innerHTML = generateProjectsContent();
            break;
        case 'designers':
            contentDiv.innerHTML = generateDesignersContent();
            break;
        case 'analytics':
            contentDiv.innerHTML = generateAnalyticsContent();
            break;
        case 'alerts':
            contentDiv.innerHTML = generateAlertsContent();
            break;
    }
}

// Generate Overview Content
function generateOverviewContent() {
    const projects = executiveData.projects;
    const timesheets = executiveData.timesheets;
    
    const sortedProjects = [...projects].sort((a, b) => {
        const usageA = a.allocatedHours > 0 ? (a.hoursLogged / a.allocatedHours) * 100 : 0;
        const usageB = b.allocatedHours > 0 ? (b.hoursLogged / b.allocatedHours) * 100 : 0;
        return usageB - usageA;
    });
    
    const topProjects = sortedProjects.slice(0, 5);
    const recentTimesheets = [...timesheets].sort((a, b) => b.date.seconds - a.date.seconds).slice(0, 10);
    
    return `
        <div class="card">
            <div class="card-header">
                <h3>🎯 Project Health Matrix</h3>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Project</th>
                        <th>Design Manager</th>
                        <th>Team Size</th>
                        <th style="text-align: center;">Budget</th>
                        <th style="text-align: center;">Used</th>
                        <th style="text-align: center;">Remaining</th>
                        <th style="text-align: center;">Usage %</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedProjects.map(project => {
                        const usage = project.allocatedHours > 0 ? (project.hoursLogged / project.allocatedHours) * 100 : 0;
                        const remaining = project.allocatedHours - project.hoursLogged;
                        let healthIcon, healthText, healthColor;
                        
                        if (usage >= 100) {
                            healthIcon = '🔴';
                            healthText = 'Exceeded';
                            healthColor = 'var(--danger)';
                        } else if (usage >= 90) {
                            healthIcon = '🔴';
                            healthText = 'Critical';
                            healthColor = 'var(--danger)';
                        } else if (usage >= 75) {
                            healthIcon = '🟡';
                            healthText = 'At Risk';
                            healthColor = 'var(--warning)';
                        } else {
                            healthIcon = '🟢';
                            healthText = 'Healthy';
                            healthColor = 'var(--success)';
                        }
                        
                        return `
                            <tr style="cursor: pointer;" onclick="viewProject('${project.id}')">
                                <td>
                                    <div style="font-weight: 600;">${project.projectName}</div>
                                    <div style="font-size: 0.85rem; color: var(--text-light);">${project.clientCompany}</div>
                                </td>
                                <td>${project.designLeadName || 'Unassigned'}</td>
                                <td>${project.assignedDesignerNames?.length || 0} designer(s)</td>
                                <td style="text-align: center; font-weight: 600;">${project.allocatedHours}h</td>
                                <td style="text-align: center; font-weight: 600; color: var(--primary-blue);">${project.hoursLogged.toFixed(1)}h</td>
                                <td style="text-align: center; font-weight: 600; color: ${remaining >= 0 ? 'var(--success)' : 'var(--danger)'};">${remaining.toFixed(1)}h</td>
                                <td style="text-align: center;">
                                    <strong style="color: ${healthColor};">${usage.toFixed(0)}%</strong>
                                </td>
                                <td>
                                    <span style="display: inline-flex; align-items: center; gap: 0.25rem; font-weight: 600; color: ${healthColor};">
                                        ${healthIcon} ${healthText}
                                    </span>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Generate Projects Content (simplified)
function generateProjectsContent() {
    return generateOverviewContent(); // Reuse the overview table
}

// Generate Designers Content
function generateDesignersContent() {
    const timesheets = executiveData.timesheets;
    const designerStats = {};
    
    timesheets.forEach(entry => {
        if (!designerStats[entry.designerUid]) {
            designerStats[entry.designerUid] = {
                uid: entry.designerUid,
                name: entry.designerName,
                email: entry.designerEmail,
                totalHours: 0,
                projectCount: new Set(),
                entries: []
            };
        }
        
        designerStats[entry.designerUid].totalHours += entry.hours;
        designerStats[entry.designerUid].projectCount.add(entry.projectId);
        designerStats[entry.designerUid].entries.push(entry);
    });
    
    const designersArray = Object.values(designerStats).map(d => ({
        ...d,
        projectCount: d.projectCount.size,
        avgHoursPerProject: d.projectCount.size > 0 ? d.totalHours / d.projectCount.size : 0
    })).sort((a, b) => b.totalHours - a.totalHours);
    
    return `
        <div class="card">
            <div class="card-header">
                <h3>👥 Designer Performance</h3>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Designer</th>
                        <th style="text-align: center;">Total Hours</th>
                        <th style="text-align: center;">Projects</th>
                        <th style="text-align: center;">Avg Hours/Project</th>
                        <th style="text-align: center;">Entries</th>
                    </tr>
                </thead>
                <tbody>
                    ${designersArray.map(designer => `
                        <tr>
                            <td>
                                <div style="font-weight: 600;">${designer.name}</div>
                                <div style="font-size: 0.85rem; color: var(--text-light);">${designer.email}</div>
                            </td>
                            <td style="text-align: center; font-weight: 700; font-size: 1.1rem; color: var(--primary-blue);">${designer.totalHours.toFixed(1)}h</td>
                            <td style="text-align: center; font-weight: 600;">${designer.projectCount}</td>
                            <td style="text-align: center; font-weight: 600;">${designer.avgHoursPerProject.toFixed(1)}h</td>
                            <td style="text-align: center;">${designer.entries.length}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Generate Analytics Content (simplified)
function generateAnalyticsContent() {
    const projects = executiveData.projects;
    const totalAllocated = projects.reduce((sum, p) => sum + (p.allocatedHours || 0), 0);
    const totalLogged = projects.reduce((sum, p) => sum + (p.hoursLogged || 0), 0);
    
    return `
        <div class="card">
            <div class="card-header">
                <h3>📊 Budget Overview</h3>
            </div>
            <div style="padding: 2rem; text-align: center;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">
                    ${((totalLogged / totalAllocated) * 100).toFixed(0)}%
                </div>
                <div style="font-size: 1.2rem; color: var(--text-light); margin-bottom: 2rem;">
                    Budget Utilization
                </div>
                <div style="display: flex; justify-content: space-around; max-width: 600px; margin: 0 auto;">
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-light);">Allocated</div>
                        <div style="font-weight: 700; font-size: 1.5rem;">${totalAllocated.toFixed(0)}h</div>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-light);">Logged</div>
                        <div style="font-weight: 700; font-size: 1.5rem; color: var(--primary-blue);">${totalLogged.toFixed(0)}h</div>
                    </div>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-light);">Remaining</div>
                        <div style="font-weight: 700; font-size: 1.5rem; color: var(--success);">${(totalAllocated - totalLogged).toFixed(0)}h</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Generate Alerts Content
function generateAlertsContent() {
    const projects = executiveData.projects;
    const alerts = [];
    
    projects.forEach(project => {
        const usage = project.allocatedHours > 0 ? (project.hoursLogged / project.allocatedHours) * 100 : 0;
        const remaining = project.allocatedHours - project.hoursLogged;
        
        if (usage >= 100) {
            alerts.push({
                type: 'critical',
                icon: '🚨',
                title: 'Budget Exceeded',
                message: `Project "${project.projectName}" has exceeded its allocated hours by ${Math.abs(remaining).toFixed(1)} hours`,
                project: project
            });
        } else if (usage >= 90) {
            alerts.push({
                type: 'warning',
                icon: '⚠️',
                title: 'Critical Budget Usage',
                message: `Project "${project.projectName}" is at ${usage.toFixed(0)}% budget utilization with only ${remaining.toFixed(1)} hours remaining`,
                project: project
            });
        } else if (usage >= 75) {
            alerts.push({
                type: 'info',
                icon: '⚡',
                title: 'High Budget Usage',
                message: `Project "${project.projectName}" has used ${usage.toFixed(0)}% of allocated hours`,
                project: project
            });
        }
    });
    
    if (alerts.length === 0) {
        return `
            <div class="card">
                <div style="text-align: center; padding: 4rem; color: var(--text-light);">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">✅</div>
                    <div style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.5rem;">All Clear!</div>
                    <div>No critical alerts at this time</div>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="card">
            <div class="card-header">
                <h3>🔔 Active Alerts (${alerts.length})</h3>
            </div>
            <div style="padding: 1rem;">
                ${alerts.map(alert => {
                    const bgColor = alert.type === 'critical' ? '#fee' : alert.type === 'warning' ? '#fff3cd' : '#e7f3ff';
                    const borderColor = alert.type === 'critical' ? 'var(--danger)' : alert.type === 'warning' ? 'var(--warning)' : 'var(--primary-blue)';
                    
                    return `
                        <div style="padding: 1.5rem; background: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 8px; margin-bottom: 1rem; cursor: pointer;" onclick="viewProject('${alert.project.id}')">
                            <div style="display: flex; align-items: start; gap: 1rem;">
                                <div style="font-size: 2rem;">${alert.icon}</div>
                                <div style="flex: 1;">
                                    <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 0.5rem;">${alert.title}</div>
                                    <div style="color: var(--text-dark); margin-bottom: 1rem;">${alert.message}</div>
                                    <div style="display: flex; gap: 2rem; font-size: 0.9rem;">
                                        <div>
                                            <span style="color: var(--text-light);">Design Manager:</span>
                                            <strong>${alert.project.designLeadName || 'Unassigned'}</strong>
                                        </div>
                                        <div>
                                            <span style="color: var(--text-light);">Client:</span>
                                            <strong>${alert.project.clientCompany}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// Export executive reports
async function exportExecutiveReport(type) {
    try {
        showLoading();
        
        const projects = executiveData.projects;
        const timesheets = executiveData.timesheets;
        
        let csv = '';
        let filename = '';
        
        if (type === 'summary') {
            const totalAllocated = projects.reduce((sum, p) => sum + (p.allocatedHours || 0), 0);
            const totalLogged = projects.reduce((sum, p) => sum + (p.hoursLogged || 0), 0);
            
            csv = 'Executive Summary Report\n\n';
            csv += `Generated: ${new Date().toLocaleString()}\n\n`;
            csv += `Total Projects: ${projects.length}\n`;
            csv += `Total Hours Allocated: ${totalAllocated.toFixed(0)}\n`;
            csv += `Total Hours Logged: ${totalLogged.toFixed(0)}\n\n`;
            csv += 'Project,Client,Design Manager,Allocated,Logged,Remaining,Usage %,Status\n';
            
            projects.forEach(project => {
                const usage = project.allocatedHours > 0 ? (project.hoursLogged / project.allocatedHours) * 100 : 0;
                const remaining = project.allocatedHours - project.hoursLogged;
                const status = usage >= 90 ? 'Critical' : usage >= 75 ? 'At Risk' : 'Healthy';
                
                csv += `"${project.projectName}","${project.clientCompany}","${project.designLeadName || 'Unassigned'}",${project.allocatedHours},${project.hoursLogged.toFixed(1)},${remaining.toFixed(1)},${usage.toFixed(1)},${status}\n`;
            });
            
            filename = `Executive_Summary_${new Date().toISOString().split('T')[0]}.csv`;
        } else {
            csv = 'Detailed Hours Report\n\n';
            csv += `Generated: ${new Date().toLocaleString()}\n\n`;
            csv += 'Date,Project,Designer,Hours,Description\n';
            
            timesheets.forEach(entry => {
                const date = new Date(entry.date.seconds * 1000).toLocaleDateString();
                const description = (entry.description || '').replace(/,/g, ';');
                csv += `${date},"${entry.projectName}","${entry.designerName}",${entry.hours},"${description}"\n`;
            });
            
            filename = `Detailed_Report_${new Date().toISOString().split('T')[0]}.csv`;
        }
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        hideLoading();
        alert('Report exported successfully!');
        
    } catch (error) {
        console.error('Error exporting report:', error);
        alert('Error exporting report: ' + error.message);
        hideLoading();
    }
}

function applyExecutiveDateFilter() {
    const from = document.getElementById('executiveFromDate').value;
    const to = document.getElementById('executiveToDate').value;
    executiveData.dateRange = { from, to };
    calculateExecutiveMetrics();
    switchExecutiveTab('overview');
}

function resetExecutiveDateFilter() {
    document.getElementById('executiveFromDate').value = '';
    document.getElementById('executiveToDate').value = '';
    executiveData.dateRange = { from: null, to: null };
    calculateExecutiveMetrics();
    switchExecutiveTab('overview');
}

// ============================================
// COMPLETE TIMESHEET WITH ADDITIONAL TIME REQUEST SYSTEM
// Replace these functions in your index.html
// ============================================

/**
         * Show Timesheet Modal - Designer can log hours for assigned projects
         */
window.showTimesheetModalImpl = async function(projectId = null) {
            try {
                showLoading();

                // Fetch projects and designer's own timesheets in parallel
                const [response, timesheetRes] = await Promise.all([
                    apiCall('projects'),
                    apiCall('timesheets')
                ]);
                if (!response.success) {
                    throw new Error('Failed to load projects');
                }

                const projects = response.data || [];
                // Build per-project hours logged by current designer
                const myTimesheets2 = timesheetRes.success ? (timesheetRes.data || []) : [];
                const myHoursPerProject2 = {};
                myTimesheets2.forEach(t => {
                    if (t.projectId && !t.isNonProjectWork) {
                        myHoursPerProject2[t.projectId] = (myHoursPerProject2[t.projectId] || 0) + (parseFloat(t.hours) || 0);
                    }
                });

                // Filter for projects assigned to the current designer
                // FIX: robust check for designer UID in either property
                const assignedProjects = projects.filter(p => {
                    const inDesigners = p.assignedDesigners && p.assignedDesigners.includes(currentUser.uid);
                    const inUids = p.assignedDesignerUids && p.assignedDesignerUids.includes(currentUser.uid);
                    return inDesigners || inUids;
                });
                if (assignedProjects.length === 0) {
                    alert('You are not assigned to any projects yet.');
                    hideLoading();
                    return;
                }
                
                // Close any existing modals first
                closeAllModals();
                
                const modalHtml = `
                    <div class="modal-overlay" id="timesheetModalOverlay" onclick="handleModalOverlayClick(event, 'timesheetModalOverlay')">
                        <div class="modal-content" style="max-width: 600px;">
                            <div class="modal-header">
                                <h2>📋 Log Hours</h2>
                                <span class="close-modal" onclick="closeTimesheetModal()">&times;</span>
                            </div>
                            
                            <div class="modal-body">
                                <form id="timesheetForm" onsubmit="event.preventDefault(); submitTimesheet();">
                                    <div class="form-group">
                                        <label>Project <span class="required">*</span></label>
                                        <select id="timesheetProjectId" class="form-control" required>
                                            <option value="">Select a project...</option>
                                            ${assignedProjects.map(project => {
                                                const personalAlloc2 = (project.assignedDesignerHours && parseFloat(project.assignedDesignerHours[currentUser.uid]) > 0)
                                                    ? parseFloat(project.assignedDesignerHours[currentUser.uid])
                                                    : (project.designerHours && parseFloat(project.designerHours[currentUser.uid]) > 0)
                                                        ? parseFloat(project.designerHours[currentUser.uid])
                                                        : 0;
                                                const myAlloc2 = personalAlloc2 > 0
                                                    ? personalAlloc2
                                                    : (parseFloat(project.maxAllocatedHours || 0) + parseFloat(project.additionalHours || 0));
                                                const myLogged2 = personalAlloc2 > 0
                                                    ? (myHoursPerProject2[project.id] || 0)
                                                    : (parseFloat(project.hoursLogged) || 0);
                                                return `<option value="${project.id}"
                                                        data-allocated="${myAlloc2}"
                                                        data-logged="${myLogged2}">
                                                    ${project.projectName} - ${project.clientCompany}
                                                </option>`;
                                            }).join('')}
                                        </select>
                                    </div>

                                    <div class="form-group">
                                        <label>Date <span class="required">*</span></label>
                                        <input type="date" id="timesheetDate" class="form-control" 
                                               max="${new Date().toISOString().split('T')[0]}" required>
                                    </div>

                                    <div class="form-group">
                                        <label>Hours <span class="required">*</span></label>
                                        <input type="number" id="timesheetHours" class="form-control" 
                                               min="0.25" max="24" step="0.25" required 
                                               placeholder="e.g., 8 or 2.5">
                                    </div>

                                    <div class="form-group">
                                        <label>Description <span class="required">*</span></label>
                                        <textarea id="timesheetDescription" class="form-control" rows="4" 
                                                  placeholder="Describe what you worked on..." required></textarea>
                                    </div>

                                    <div id="timesheetAllocationInfo" 
                                         style="display: none; padding: 1rem; background: #e3f2fd; 
                                                border-radius: 8px; margin-top: 1rem; border-left: 4px solid #2196F3;">
                                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                            <span>Hours Logged:</span>
                                            <strong id="timesheetCurrentHours">0h</strong>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                            <span>Hours Allocated:</span>
                                            <strong id="timesheetAllocatedHours">0h</strong>
                                        </div>
                                        <div style="display: flex; justify-content: space-between;">
                                            <span>Hours Remaining:</span>
                                            <strong id="timesheetRemainingHours" style="color: #4CAF50;">0h</strong>
                                        </div>
                                    </div>
                                    
                                    <div id="timesheetWarning" style="display: none; padding: 1rem; background: #fff3cd; 
                                         border-radius: 8px; margin-top: 1rem; border-left: 4px solid #ff9800; color: #856404;">
                                        <strong>⚠️ Warning:</strong> <span id="timesheetWarningText"></span>
                                    </div>
                                </form>
                            </div>
                            
                            <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; gap: 0.5rem;">
                                <button type="button" onclick="closeTimesheetModal()" class="btn btn-outline" style="padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; border: 1px solid #ddd; background: white;">Cancel</button>
                                <button type="button" onclick="console.log('Log Hours clicked'); submitTimesheet();" class="btn btn-success" style="padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; background: #10b981; color: white; border: none; font-weight: 600;">
                                    Log Hours
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                document.getElementById('timesheetDate').value = new Date().toISOString().split('T')[0];
                
                // Add change listener for project selection
                document.getElementById('timesheetProjectId').addEventListener('change', updateTimesheetAllocationInfo);
                document.getElementById('timesheetHours').addEventListener('input', updateTimesheetAllocationInfo);
                
                if (projectId) {
                    document.getElementById('timesheetProjectId').value = projectId;
                    updateTimesheetAllocationInfo();
                }
                
                hideLoading();
                
            } catch (error) {
                console.error('Error showing timesheet modal:', error);
                alert('Error loading timesheet form: ' + error.message);
                hideLoading();
            }
        }

/**
 * Update allocation information when project or hours change
 */
function updateTimesheetAllocationInfo() {
    const projectSelect = document.getElementById('timesheetProjectId');
    const hoursInput = document.getElementById('timesheetHours');
    const infoDiv = document.getElementById('timesheetAllocationInfo');
    const warningDiv = document.getElementById('timesheetWarning');
    const warningText = document.getElementById('timesheetWarningText');
    
    if (!projectSelect || !projectSelect.value) {
        infoDiv.style.display = 'none';
        warningDiv.style.display = 'none';
        return;
    }
    
    const selectedOption = projectSelect.options[projectSelect.selectedIndex];
    const allocated = parseFloat(selectedOption.dataset.allocated) || 0;
    const logged = parseFloat(selectedOption.dataset.logged) || 0;
    const remaining = allocated - logged;
    const hoursToAdd = parseFloat(hoursInput.value) || 0;
    const newTotal = logged + hoursToAdd;
    
    document.getElementById('timesheetCurrentHours').textContent = logged.toFixed(2) + 'h';
    document.getElementById('timesheetAllocatedHours').textContent = allocated.toFixed(2) + 'h';
    document.getElementById('timesheetRemainingHours').textContent = remaining.toFixed(2) + 'h';
    document.getElementById('timesheetRemainingHours').style.color = 
        remaining < 5 ? '#f44336' : '#4CAF50';
    
    infoDiv.style.display = 'block';
    
    // Show warning if exceeding allocation
    if (hoursToAdd > 0 && newTotal > allocated && allocated > 0) {
        const exceeded = newTotal - allocated;
        warningText.textContent = `Adding ${hoursToAdd}h will exceed allocation by ${exceeded.toFixed(2)}h. You'll need to request additional time from COO.`;
        warningDiv.style.display = 'block';
    } else {
        warningDiv.style.display = 'none';
    }
}

/**
         * Submit Timesheet Entry
         */
        window.submitTimesheet = async function() {
            const projectId = document.getElementById('timesheetProjectId').value;
            const date = document.getElementById('timesheetDate').value;
            const hours = parseFloat(document.getElementById('timesheetHours').value);
            const description = document.getElementById('timesheetDescription').value.trim();
            
            // Validation
            if (!projectId || !date || !hours || !description) {
                alert('Please fill all required fields');
                return;
            }
            
            if (hours <= 0 || hours > 24) {
                alert('Hours must be between 0.25 and 24');
                return;
            }

            // --- START: FRONTEND ALLOCATION CHECK ---
            const projectSelect = document.getElementById('timesheetProjectId');
            if (projectSelect) {
                const selectedOption = projectSelect.options[projectSelect.selectedIndex];
                const allocated = parseFloat(selectedOption.dataset.allocated) || 0;
                const logged = parseFloat(selectedOption.dataset.logged) || 0;
                const remaining = allocated - logged;
                const newTotal = logged + hours;

                // HARD BLOCK: hours are fully exhausted — design lead must request more from COO
                if (allocated > 0 && remaining <= 0) {
                    alert('⛔ Hours Exhausted\n\nAll allocated hours for this project have been used up.\n\nThe Design Lead must request additional hours from the COO and get them approved before you can log more hours on this project.');
                    return;
                }

                if (newTotal > allocated && allocated > 0) {
                    console.warn(`Frontend check: Allocation exceeded. ${newTotal} > ${allocated}. Triggering request modal.`);

                    const allocationData = {
                        totalHours: logged,
                        allocatedHours: allocated,
                        exceededBy: newTotal - allocated
                    };
                    const timesheetData = { projectId, date, hours, description };

                    closeTimesheetModal();
                    if (typeof showRequestAdditionalTimeModal === 'function') {
                        showRequestAdditionalTimeModal(allocationData, timesheetData);
                    } else {
                        alert('You have exceeded your allocated hours. Please contact COO for additional time.');
                    }

                    return;
                }
            }
            // --- END: FRONTEND ALLOCATION CHECK ---
            
            try {
                showLoading();
                
                const response = await apiCall('timesheets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId, date, hours, description })
                });
                
                if (response.success) {
                    closeTimesheetModal();
                    alert(`✅ ${hours} hours logged successfully for ${date}!`);

                    if (typeof showDesignerAllocations === 'function') {
                        showDesignerAllocations();
                    }

                } else if (response.hoursExhausted) {
                    hideLoading();
                    closeTimesheetModal();
                    alert('⛔ Hours Exhausted\n\nAll allocated hours for this project have been used up.\n\nThe Design Lead must request additional hours from the COO and get them approved before you can log more hours on this project.');

                } else if (response.exceedsAllocation) {
                    hideLoading();
                    closeTimesheetModal();
                    if (typeof showRequestAdditionalTimeModal === 'function') {
                        showRequestAdditionalTimeModal(response, { projectId, date, hours, description });
                    } else {
                        alert('You have exceeded your allocated hours. Please contact COO for additional time.');
                    }

                } else {
                    throw new Error(response.error || 'Failed to log hours');
                }
                
            } catch (error) {
                console.error('Error submitting timesheet:', error);
                alert('Error logging hours: ' + error.message);
            } finally {
                hideLoading();
            }
        };

/**
 * Show Request Additional Time Modal
 */
function showRequestAdditionalTimeModal(allocationData, timesheetData) {
    closeAllModals();
    
    const { totalHours, allocatedHours, exceededBy } = allocationData;
    const { projectId, date, hours, description } = timesheetData;
    
    const modalHtml = `
        <div class="modal-overlay" id="requestTimeModalOverlay" onclick="handleModalOverlayClick(event, 'requestTimeModalOverlay')">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>⏱️ Request Additional Time</h2>
                    <span class="close-modal" onclick="closeRequestTimeModal()">&times;</span>
                </div>
                
                <div class="modal-body">
                    <div style="padding: 1rem; background: #fff3cd; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #ff9800;">
                        <h4 style="margin: 0 0 0.5rem 0; color: #856404;">⚠️ Hours Exceed Allocation</h4>
                        <p style="margin: 0; color: #856404;">
                            <strong>Allocated:</strong> ${allocatedHours}h<br>
                            <strong>Already Logged:</strong> ${totalHours}h<br>
                            <strong>Trying to Add:</strong> ${hours}h<br>
                            <strong>Exceeds by:</strong> ${exceededBy.toFixed(2)}h
                        </p>
                    </div>
                    
                    <form id="requestTimeForm" onsubmit="event.preventDefault(); submitAdditionalTimeRequest();">
                        <input type="hidden" id="reqProjectId" value="${projectId}">
                        <input type="hidden" id="reqDate" value="${date}">
                        <input type="hidden" id="reqHours" value="${hours}">
                        <input type="hidden" id="reqDescription" value="${description}">
                        
                        <div class="form-group">
                            <label>Additional Hours Requested <span class="required">*</span></label>
                            <input type="number" id="requestedHours" class="form-control" 
                                   min="${exceededBy.toFixed(2)}" step="0.5" 
                                   value="${Math.ceil(exceededBy)}" required>
                            <small>Minimum: ${exceededBy.toFixed(2)}h (amount exceeded)</small>
                        </div>
                        
                        <div class="form-group">
                            <label>Reason for Additional Time <span class="required">*</span></label>
                            <textarea id="requestReason" class="form-control" rows="5" 
                                      placeholder="Explain why additional time is needed..." required></textarea>
                            <small>Be specific: scope changes, unforeseen complexity, design revisions, etc.</small>
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="requestSaveTimesheet" checked> 
                                Save my timesheet entry for after approval
                            </label>
                            <small style="display: block; margin-top: 0.5rem;">
                                If checked, your ${hours}h entry will be saved once COO approves the additional time.
                            </small>
                        </div>
                    </form>
                </div>
                
                <div class="modal-footer">
                    <button type="button" onclick="closeRequestTimeModal()" class="btn btn-outline">Cancel</button>
                    <button type="button" onclick="submitAdditionalTimeRequest()" class="btn btn-primary">
                        Submit Request to COO
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Submit Additional Time Request
 */
async function submitAdditionalTimeRequest() {
    const projectId = document.getElementById('reqProjectId').value;
    const requestedHours = parseFloat(document.getElementById('requestedHours').value);
    const reason = document.getElementById('requestReason').value.trim();
    const saveTimesheet = document.getElementById('requestSaveTimesheet').checked;
    
    if (!requestedHours || requestedHours <= 0) {
        alert('Please enter valid hours');
        return;
    }
    
    if (!reason || reason.length < 20) {
        alert('Please provide a detailed reason (at least 20 characters)');
        return;
    }
    
    try {
        showLoading();
        
        // Submit time request
        const response = await apiCall('time-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId,
                requestedHours,
                reason,
                timesheetId: saveTimesheet ? 'pending' : null,
                pendingTimesheetData: saveTimesheet ? {
                    date: document.getElementById('reqDate').value,
                    hours: parseFloat(document.getElementById('reqHours').value),
                    description: document.getElementById('reqDescription').value
                } : null
            })
        });
        
        if (response.success) {
            closeRequestTimeModal();
            alert(`✅ Request submitted successfully!\n\nRequested: ${requestedHours}h\nCOO will review your request shortly.`);

            // --- ADD THIS LINE ---
          triggerEmailNotification('time_request.created', {
          projectId: projectId,
           hours: requestedHours,
           reason: reason,
           designerName: currentUser.displayName // Assuming currentUser is global
    });
            
            // Show pending requests
            if (typeof showPendingTimeRequests === 'function') {
                showPendingTimeRequests();
            }
        } else {
            throw new Error(response.error || 'Failed to submit request');
        }
        
    } catch (error) {
        console.error('Error submitting time request:', error);
        alert('Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Show Pending Time Requests (for designers)
 */
async function showPendingTimeRequests() {
    // This function is replaced by window.showCOOTimeRequests in the first script block
    console.log('showPendingTimeRequests called - redirecting to showCOOTimeRequests');
    if (typeof window.showCOOTimeRequests === 'function') {
        return window.showCOOTimeRequests();
    }
}

/**
 * Direct Request Additional Time Modal (without exceeding timesheet context)
 * Called from Designer Allocations view when remaining hours are low
 */
window.showRequestTimeModalDirectImpl = function(projectId, projectName, allocatedHours, usedHours) {
    closeAllModals();
    
    const remaining = allocatedHours - usedHours;
    const suggestedHours = Math.max(10, Math.ceil((allocatedHours * 0.25))); // Suggest 25% more or at least 10h
    
    const modalHtml = `
        <div class="modal-overlay" id="requestTimeDirectModalOverlay" onclick="handleModalOverlayClick(event, 'requestTimeDirectModalOverlay')">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2>⏰ Request Additional Time</h2>
                    <span class="close-modal" onclick="closeRequestTimeDirectModal()">&times;</span>
                </div>
                
                <div class="modal-body">
                    <div style="padding: 1rem; background: #e3f2fd; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #2196f3;">
                        <h4 style="margin: 0 0 0.5rem 0; color: #1565c0;">📊 Project: ${projectName}</h4>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1rem;">
                            <div style="text-align: center;">
                                <div style="font-size: 1.5rem; font-weight: bold; color: #1976d2;">${allocatedHours.toFixed(1)}h</div>
                                <small style="color: #666;">Allocated</small>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 1.5rem; font-weight: bold; color: #ff9800;">${usedHours.toFixed(1)}h</div>
                                <small style="color: #666;">Used</small>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 1.5rem; font-weight: bold; color: ${remaining < 0 ? '#f44336' : remaining < 5 ? '#ff9800' : '#4caf50'};">${remaining.toFixed(1)}h</div>
                                <small style="color: #666;">Remaining</small>
                            </div>
                        </div>
                    </div>
                    
                    ${remaining <= 0 ? `
                        <div style="padding: 1rem; background: #ffebee; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #f44336;">
                            <p style="margin: 0; color: #c62828;">
                                ⚠️ <strong>Budget Exceeded!</strong> You've used all your allocated hours. 
                                Submit a request for additional time to continue working on this project.
                            </p>
                        </div>
                    ` : remaining < 5 ? `
                        <div style="padding: 1rem; background: #fff3e0; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #ff9800;">
                            <p style="margin: 0; color: #e65100;">
                                ⚠️ <strong>Low Budget Warning!</strong> You have only ${remaining.toFixed(1)} hours remaining.
                                Consider requesting additional time before running out.
                            </p>
                        </div>
                    ` : ''}
                    
                    <form id="requestTimeDirectForm" onsubmit="event.preventDefault(); submitDirectTimeRequest();">
                        <input type="hidden" id="directReqProjectId" value="${projectId}">
                        <input type="hidden" id="directReqProjectName" value="${projectName}">
                        <input type="hidden" id="directReqAllocatedHours" value="${allocatedHours}">
                        <input type="hidden" id="directReqUsedHours" value="${usedHours}">
                        
                        <div class="form-group">
                            <label>Additional Hours Needed <span class="required">*</span></label>
                            <input type="number" id="directRequestedHours" class="form-control" 
                                   min="1" step="0.5" 
                                   value="${suggestedHours}" required>
                            <small>Suggested: ${suggestedHours}h (25% additional buffer)</small>
                        </div>
                        
                        <div class="form-group">
                            <label>Reason for Additional Time <span class="required">*</span></label>
                            <textarea id="directRequestReason" class="form-control" rows="5" 
                                      placeholder="Please explain why additional time is needed...&#10;&#10;Examples:&#10;- Design complexity increased&#10;- Client requested revisions&#10;- Scope changes not in original estimate&#10;- Unforeseen technical challenges" required></textarea>
                            <small>Be specific: scope changes, unforeseen complexity, design revisions, etc. (min 20 characters)</small>
                        </div>
                    </form>
                </div>
                
                <div class="modal-footer">
                    <button type="button" onclick="closeRequestTimeDirectModal()" class="btn btn-outline">Cancel</button>
                    <button type="button" onclick="submitDirectTimeRequest()" class="btn btn-primary">
                        📤 Submit Request to COO
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Close Direct Request Time Modal
 */
function closeRequestTimeDirectModal() {
    const modal = document.getElementById('requestTimeDirectModalOverlay');
    if (modal) {
        modal.remove();
    }
}

/**
 * Submit Direct Time Request
 */
async function submitDirectTimeRequest() {
    const projectId = document.getElementById('directReqProjectId').value;
    const projectName = document.getElementById('directReqProjectName').value;
    const allocatedHours = parseFloat(document.getElementById('directReqAllocatedHours').value);
    const usedHours = parseFloat(document.getElementById('directReqUsedHours').value);
    const requestedHours = parseFloat(document.getElementById('directRequestedHours').value);
    const reason = document.getElementById('directRequestReason').value.trim();
    
    if (!requestedHours || requestedHours <= 0) {
        alert('Please enter valid hours');
        return;
    }
    
    if (!reason || reason.length < 20) {
        alert('Please provide a detailed reason (at least 20 characters)');
        document.getElementById('directRequestReason').focus();
        return;
    }
    
    try {
        showLoading();
        
        // Submit time request
        const response = await apiCall('time-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId,
                requestedHours,
                reason,
                currentAllocatedHours: allocatedHours,
                currentHoursLogged: usedHours,
                requestType: 'proactive' // Flag that this is a proactive request, not from timesheet overflow
            })
        });
        
        if (response.success) {
            closeRequestTimeDirectModal();
            showSuccessModal(
                '✅ Request Submitted!',
                `Your request for ${requestedHours} additional hours on "${projectName}" has been submitted to the COO for review.`
            );

            // Trigger email notification
            triggerEmailNotification('time_request.created', {
                projectId: projectId,
                hours: requestedHours,
                reason: reason,
                designerName: currentUser.displayName
            });
            
            // Refresh the allocations view
            if (typeof showDesignerAllocations === 'function') {
                setTimeout(() => {
                    closeSuccessModal();
                    showDesignerAllocations();
                }, 2000);
            }
        } else {
            throw new Error(response.error || 'Failed to submit request');
        }
        
    } catch (error) {
        console.error('Error submitting time request:', error);
        alert('Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Original showPendingTimeRequests continues below
async function showPendingTimeRequests() {
    try {
        showLoading();
        
        const response = await apiCall('time-requests');
        
        if (!response.success) {
            throw new Error('Failed to load time requests');
        }
        
        const requests = response.data || [];
        const pendingRequests = requests.filter(r => r.status === 'pending' || r.status === 'info_requested');
        
        let requestsHtml = '';
        
        if (pendingRequests.length === 0) {
            requestsHtml = `
                <div style="text-align: center; padding: 3rem; color: #666;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
                    <h3>No Pending Requests</h3>
                    <p>You don't have any pending additional time requests.</p>
                </div>
            `;
        } else {
            requestsHtml = pendingRequests.map(req => `
                <div class="card" style="margin-bottom: 1rem; border-left: 4px solid ${req.status === 'info_requested' ? '#ff9800' : '#2196F3'};">
                    <div style="padding: 1rem;">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                            <div>
                                <h4 style="margin: 0;">${req.projectName}</h4>
                                <small style="color: #666;">${req.clientCompany}</small>
                            </div>
                            <span class="badge" style="background: ${req.status === 'info_requested' ? '#ff9800' : '#2196F3'};">
                                ${req.status === 'info_requested' ? 'Info Requested' : 'Pending Review'}
                            </span>
                        </div>
                        
                        <div style="margin: 1rem 0; padding: 0.75rem; background: #f5f5f5; border-radius: 4px;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                                <div><strong>Requested:</strong> ${req.requestedHours}h</div>
                                <div><strong>Current:</strong> ${req.currentHoursLogged}h / ${req.currentAllocatedHours}h</div>
                            </div>
                        </div>
                        
                        <div style="margin: 1rem 0;">
                            <strong>Reason:</strong>
                            <p style="margin: 0.5rem 0; color: #555;">${req.reason}</p>
                        </div>
                        
                        ${req.reviewComment ? `
                            <div style="margin: 1rem 0; padding: 0.75rem; background: #fff3cd; border-radius: 4px;">
                                <strong>COO Comment:</strong>
                                <p style="margin: 0.5rem 0; color: #856404;">${req.reviewComment}</p>
                            </div>
                        ` : ''}
                        
                        <small style="color: #666;">
                            Submitted: ${req.createdAt ? new Date(req.createdAt.seconds * 1000).toLocaleString() : 'N/A'}
                        </small>
                    </div>
                </div>
            `).join('');
        }
        
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = `
            <div class="page-header">
                <h2>⏱️ My Time Requests</h2>
                <p class="subtitle">Track your additional time requests</p>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <button onclick="showTimesheet()" class="btn btn-outline">← Back to Timesheet</button>
            </div>
            
            ${requestsHtml}
        `;
        
        hideLoading();
        
    } catch (error) {
        console.error('Error loading time requests:', error);
        alert('Error: ' + error.message);
        hideLoading();
    }
}


/* ============================================
   DUPLICATE COO TIME REQUEST FUNCTIONS COMMENTED OUT
   Using window.showCOOTimeRequests (line ~20498) instead
   ============================================
// /**
//          * Show COO Time Request Dashboard
//          */
//           async function showCOOTimeRequests() {
//             // FIX: Use the correct global variable 'currentUserRole'
//             const userRole = currentUserRole ? currentUserRole.trim().toLowerCase() : '';
//             if (!['coo', 'director'].includes(userRole)) {
//                 alert('Access denied. COO/Director only.');
//                 return;
//             }
//     try {
//         showLoading();
//         setActiveNav('nav-time-requests');
//         
//         const response = await apiCall('time-requests?status=pending');
//         
//         if (!response.success) {
//             throw new Error('Failed to load time requests');
//         }
//         
//         const requests = response.data || [];
//         
//         let requestsHtml = '';
//         
//         if (requests.length === 0) {
//             requestsHtml = `
//                 <div style="text-align: center; padding: 3rem; color: #666;">
//                     <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
//                     <h3>All Caught Up!</h3>
//                     <p>No pending time requests to review.</p>
//                 </div>
//             `;
//         } else {
//             requestsHtml = requests.map(req => `
//                 <div class="card" style="margin-bottom: 1.5rem;">
//                     <div style="padding: 1.5rem;">
//                         <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
//                             <div>
//                                 <h3 style="margin: 0 0 0.25rem 0;">${req.projectName}</h3>
//                                 <small style="color: #666;">${req.projectCode} - ${req.clientCompany}</small>
//                             </div>
//                             <span class="badge" style="background: #ff9800;">Pending Review</span>
//                         </div>
//                         
//                         <div style="margin: 1rem 0; padding: 1rem; background: #f5f5f5; border-radius: 8px;">
//                             <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
//                                 <div>
//                                     <small style="color: #666;">Requested By</small>
//                                     <div style="font-weight: 600;">${req.designerName}</div>
//                                 </div>
//                                 <div>
//                                     <small style="color: #666;">Additional Hours</small>
//                                     <div style="font-weight: 600; color: #2196F3; font-size: 1.2rem;">${req.requestedHours}h</div>
//                                 </div>
//                                 <div>
//                                     <small style="color: #666;">Current Usage</small>
//                                     <div style="font-weight: 600;">${req.currentHoursLogged}h / ${req.currentAllocatedHours}h</div>
//                                 </div>
//                             </div>
//                         </div>
//                         
//                         <div style="margin: 1rem 0;">
//                             <strong>Reason for Additional Time:</strong>
//                             <p style="margin: 0.5rem 0; padding: 1rem; background: #fff; border-left: 3px solid #2196F3; color: #555;">
//                                 ${req.reason}
//                             </p>
//                         </div>
//                         
//                         <div style="margin: 1rem 0;">
//                             <small style="color: #666;">
//                                 Submitted: ${req.createdAt ? new Date(req.createdAt.seconds * 1000).toLocaleString() : 'N/A'}
//                             </small>
//                         </div>
//                         
//                         <div style="display: flex; gap: 1rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #ddd;">
//                             <button onclick="approveTimeRequest('${req.id}', ${req.requestedHours})" 
//                                     class="btn btn-success" style="flex: 1;">
//                                 ✅ Approve ${req.requestedHours}h
//                             </button>
//                             <button onclick="showRejectTimeRequestModal('${req.id}')" 
//                                     class="btn btn-danger" style="flex: 1;">
//                                 ❌ Reject
//                             </button>
//                             <button onclick="showRequestInfoModal('${req.id}')" 
//                                     class="btn btn-outline">
//                                 💬 Request Info
//                             </button>
//                         </div>
//                     </div>
//                 </div>
//             `).join('');
//         }
//         
//         const mainContent = document.getElementById('mainContent');
//         mainContent.innerHTML = `
//             <div class="page-header">
//                 <h2>⏱️ Additional Time Requests</h2>
//                 <p class="subtitle">Review and approve/reject designer requests for additional hours</p>
//             </div>
//             
//             <div class="dashboard-stats" style="margin-bottom: 2rem;">
//                 <div class="stat-card">
//                     <div class="stat-number">${requests.length}</div>
//                     <div class="stat-label">Pending Requests</div>
//                 </div>
//                 <div class="stat-card">
//                     <div class="stat-number">${requests.reduce((sum, r) => sum + r.requestedHours, 0).toFixed(1)}h</div>
//                     <div class="stat-label">Total Hours Requested</div>
//                 </div>
//             </div>
//             
//             ${requestsHtml}
//         `;
//         
//         hideLoading();
//         
//     } catch (error) {
//         console.error('Error loading COO time requests:', error);
//         alert('Error: ' + error.message);
//         hideLoading();
//     }
// }
// 
// /**
//  * Approve Time Request
//  */
// async function approveTimeRequest(requestId, hours) {
//     const comment = prompt(`Approve ${hours}h additional time?\n\nOptional comment for designer:`);
//     
//     if (comment === null) return; // Cancelled
//     
//     try {
//         showLoading();
//         
//         const response = await apiCall(`time-requests?id=${requestId}`, {
//             method: 'PUT',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 action: 'approve',
//                 approvedHours: hours,
//                 comment: comment || 'Approved',
//                 applyToTimesheet: true
//             })
//         });
//         
//         if (response.success) {
//             alert(`✅ Approved ${hours}h additional time!`);
//             // --- ADD THIS LINE ---
//            // You might need to pass designerEmail to this function or let backend fetch it
//            triggerEmailNotification('time_request.approved', { 
//            requestId: requestId,
//            hours: hours 
//     });
//     // --------------------
//             showCOOTimeRequests(); // Refresh list
//         } else {
//             throw new Error(response.error || 'Failed to approve');
//         }
//         
//     } catch (error) {
//         console.error('Error approving time request:', error);
//         alert('Error: ' + error.message);
//     } finally {
//         hideLoading();
//     }
// }
// 
// /**
//  * Show Reject Time Request Modal
//  */
// function showRejectTimeRequestModal(requestId) {
//     closeAllModals();
//     
//     const modalHtml = `
//         <div class="modal-overlay" id="rejectModalOverlay" onclick="handleModalOverlayClick(event, 'rejectModalOverlay')">
//             <div class="modal-content" style="max-width: 500px;">
//                 <div class="modal-header">
//                     <h2>❌ Reject Time Request</h2>
//                     <span class="close-modal" onclick="closeRejectModal()">&times;</span>
//                 </div>
//                 
//                 <div class="modal-body">
//                     <input type="hidden" id="rejectRequestId" value="${requestId}">
//                     <div class="form-group">
//                         <label>Reason for Rejection <span class="required">*</span></label>
//                         <textarea id="rejectComment" class="form-control" rows="4" 
//                                   placeholder="Explain why this request is being rejected..." required></textarea>
//                     </div>
//                 </div>
//                 
//                 <div class="modal-footer">
//                     <button type="button" onclick="closeRejectModal()" class="btn btn-outline">Cancel</button>
//                     <button type="button" onclick="submitRejectTimeRequest()" class="btn btn-danger">
//                         Reject Request
//                     </button>
//                 </div>
//             </div>
//         </div>
//     `;
//     
//     document.body.insertAdjacentHTML('beforeend', modalHtml);
// }
// 
// /**
//  * Submit Rejection
//  */
// async function submitRejectTimeRequest() {
//     const requestId = document.getElementById('rejectRequestId').value;
//     const comment = document.getElementById('rejectComment').value.trim();
//     
//     if (!comment || comment.length < 10) {
//         alert('Please provide a detailed reason for rejection (at least 10 characters)');
//         return;
//     }
//     
//     try {
//         showLoading();
//         
//         const response = await apiCall(`time-requests?id=${requestId}`, {
//             method: 'PUT',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 action: 'reject',
//                 comment: comment
//             })
//         });
//         
//         if (response.success) {
//             closeRejectModal();
//             alert('❌ Request rejected');
//             showCOOTimeRequests(); // Refresh list
//         } else {
//             throw new Error(response.error || 'Failed to reject');
//         }
//         
//     } catch (error) {
//         console.error('Error rejecting time request:', error);
//         alert('Error: ' + error.message);
// }

/* ============================================
   END OF COMMENTED DUPLICATE FUNCTIONS
   ============================================ */


/**
 * Modal Close Functions - Fix for stuck modals
 */
function closeTimesheetModal() {
    const modal = document.getElementById('timesheetModalOverlay');
    if (modal) modal.remove();
    document.body.classList.remove('modal-open');
}

function closeRequestTimeModal() {
    const modal = document.getElementById('requestTimeModalOverlay');
    if (modal) modal.remove();
    document.body.classList.remove('modal-open');
}

function closeRejectModal() {
    const modal = document.getElementById('rejectModalOverlay');
    if (modal) modal.remove();
    document.body.classList.remove('modal-open');
}

function closeAllModals() {
    // Remove all modal overlays
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => modal.remove());
    document.body.classList.remove('modal-open');
}

// ✅ Make modal close functions globally accessible
window.closeTimesheetModal = closeTimesheetModal;
window.closeRequestTimeModal = closeRequestTimeModal;
window.closeRejectModal = closeRejectModal;
window.closeAllModals = closeAllModals;

function handleModalOverlayClick(event, modalId) {
    // Close modal only if clicking directly on overlay (not on modal content)
    if (event.target.id === modalId) {
        document.getElementById(modalId).remove();
        document.body.classList.remove('modal-open');
    }
}

// ✅ Make handleModalOverlayClick globally accessible
window.handleModalOverlayClick = handleModalOverlayClick;

// Add keyboard ESC to close modals
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeAllModals();
    }
});

// ============================================
// INTEGRATION WITH EXECUTIVE DASHBOARD
// ============================================

/**
 * Update Executive Dashboard to show projects exceeding allocation
 * Add this to your renderExecutiveProjectsTable function
 */
function renderExecutiveProjectsTable(projects) {
    if (!projects || projects.length === 0) {
        return '<p style="text-align: center; padding: 2rem; color: #666;">No active projects found.</p>';
    }
    
    // Separate projects by allocation status
    const exceededProjects = projects.filter(p => 
        p.hoursLogged > p.allocatedHours && p.allocatedHours > 0
    );
    const onTrackProjects = projects.filter(p => 
        p.hoursLogged <= p.allocatedHours || p.allocatedHours === 0
    );
    
    let html = '';
    
    // Show exceeded projects first
    if (exceededProjects.length > 0) {
        html += `
            <div class="card" style="margin-bottom: 2rem; border-left: 4px solid #f44336;">
                <div style="padding: 1rem; background: #ffebee;">
                    <h3 style="margin: 0; color: #c62828;">⚠️ Projects Exceeding Allocation (${exceededProjects.length})</h3>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Project</th>
                            <th>Allocated</th>
                            <th>Logged</th>
                            <th>Exceeded By</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${exceededProjects.map(p => `
                            <tr>
                                <td>
                                    <strong>${p.projectName}</strong><br>
                                    <small>${p.clientCompany}</small>
                                </td>
                                <td>${p.allocatedHours}h</td>
                                <td style="color: #f44336; font-weight: 600;">${p.hoursLogged}h</td>
                                <td style="color: #f44336; font-weight: 600;">
                                    +${(p.hoursLogged - p.allocatedHours).toFixed(2)}h
                                </td>
                                <td>
                                    <span class="badge" style="background: #f44336;">Over Allocated</span>
                                </td>
                                <td>
                                    <button onclick="viewProjectTimesheetDetails('${p.id}')" class="btn btn-sm btn-outline">
                                        View Details
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    // Show on-track projects
    html += `
        <div class="card">
            <div style="padding: 1rem; background: #f5f5f5;">
                <h3 style="margin: 0;">✅ On Track Projects (${onTrackProjects.length})</h3>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Project</th>
                        <th>Allocated</th>
                        <th>Logged</th>
                        <th>Remaining</th>
                        <th>Progress</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${onTrackProjects.map(p => {
                        const remaining = p.allocatedHours - p.hoursLogged;
                        const progress = p.allocatedHours > 0 ? (p.hoursLogged / p.allocatedHours * 100) : 0;
                        const progressColor = progress > 90 ? '#ff9800' : progress > 75 ? '#2196F3' : '#4CAF50';
                        
                        return `
                            <tr>
                                <td>
                                    <strong>${p.projectName}</strong><br>
                                    <small>${p.clientCompany}</small>
                                </td>
                                <td>${p.allocatedHours}h</td>
                                <td>${p.hoursLogged}h</td>
                                <td style="color: ${remaining < 5 ? '#ff9800' : '#4CAF50'};">
                                    ${remaining.toFixed(2)}h
                                </td>
                                <td>
                                    <div style="width: 100px; background: #eee; height: 8px; border-radius: 4px; overflow: hidden;">
                                        <div style="width: ${Math.min(progress, 100)}%; background: ${progressColor}; height: 100%;"></div>
                                    </div>
                                    <small>${progress.toFixed(0)}%</small>
                                </td>
                                <td>
                                    <button onclick="viewProjectTimesheetDetails('${p.id}')" class="btn btn-sm btn-outline">
                                        View Details
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

/**
 * View Project Timesheet Details
 */
async function viewProjectTimesheetDetails(projectId) {
    try {
        showLoading();
        
        const [projectResponse, timesheetsResponse] = await Promise.all([
            apiCall(`projects?id=${projectId}`),
            apiCall(`timesheets?projectId=${projectId}`)
        ]);
        
        if (!projectResponse.success || !timesheetsResponse.success) {
            throw new Error('Failed to load project details');
        }
        
        const project = projectResponse.data;
        const timesheets = timesheetsResponse.data || [];
        
        // Group by designer
        const byDesigner = {};
        timesheets.forEach(ts => {
            if (!byDesigner[ts.designerUid]) {
                byDesigner[ts.designerUid] = {
                    name: ts.designerName,
                    email: ts.designerEmail,
                    hours: 0,
                    entries: []
                };
            }
            byDesigner[ts.designerUid].hours += ts.hours;
            byDesigner[ts.designerUid].entries.push(ts);
        });
        
        const designerSummary = Object.values(byDesigner).map(d => `
            <tr>
                <td>${d.name}</td>
                <td>${d.email}</td>
                <td><strong>${d.hours}h</strong></td>
                <td>${d.entries.length}</td>
            </tr>
        `).join('');
        
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = `
            <div class="page-header">
                <h2>📊 Project Timesheet Details</h2>
                <button onclick="showExecutiveDashboard()" class="btn btn-outline">← Back to Dashboard</button>
            </div>
            
            <div class="card" style="margin-bottom: 2rem;">
                <div style="padding: 1.5rem;">
                    <h3>${project.projectName}</h3>
                    <p style="color: #666;">${project.clientCompany}</p>
                    
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-top: 1rem;">
                        <div style="padding: 1rem; background: #f5f5f5; border-radius: 8px;">
                            <small>Allocated Hours</small>
                            <div style="font-size: 1.5rem; font-weight: 600;">${project.allocatedHours}h</div>
                        </div>
                        <div style="padding: 1rem; background: #f5f5f5; border-radius: 8px;">
                            <small>Hours Logged</small>
                            <div style="font-size: 1.5rem; font-weight: 600; color: ${project.hoursLogged > project.allocatedHours ? '#f44336' : '#4CAF50'};">
                                ${project.hoursLogged}h
                            </div>
                        </div>
                        <div style="padding: 1rem; background: #f5f5f5; border-radius: 8px;">
                            <small>${project.hoursLogged > project.allocatedHours ? 'Exceeded By' : 'Remaining'}</small>
                            <div style="font-size: 1.5rem; font-weight: 600; color: ${project.hoursLogged > project.allocatedHours ? '#f44336' : '#4CAF50'};">
                                ${Math.abs(project.allocatedHours - project.hoursLogged).toFixed(2)}h
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div style="padding: 1rem; background: #f5f5f5; border-bottom: 1px solid #ddd;">
                    <h3 style="margin: 0;">Hours by Designer</h3>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Designer</th>
                            <th>Email</th>
                            <th>Total Hours</th>
                            <th>Entries</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${designerSummary}
                    </tbody>
                </table>
            </div>
        `;
        
        hideLoading();
        
    } catch (error) {
        console.error('Error loading project details:', error);
        alert('Error: ' + error.message);
        hideLoading();
    }
}

console.log('✅ Timesheet Additional Hours System Loaded');



// ==========================================
// ADDITIONAL WORKFLOW FUNCTIONS
// ==========================================

// NOTE: Estimator form already exists as showEstimationModal() - available when status='draft'
// Wrapper function for compatibility
function showEstimateForm(proposalId) {
    if (typeof showEstimationModal === 'function') {
        showEstimationModal(proposalId);
    }
}

// Show Pricing Form (for COO role) - Note: showCOOPricingForm already exists, this is an alternate entry point
function showPricingForm(proposalId) {
    // Use the existing showCOOPricingForm function
    if (typeof showCOOPricingForm === 'function') {
        showCOOPricingForm(proposalId);
    }
}

// Show Client Outcome Form (for BDM role)
function showClientOutcomeForm(proposalId) {
    const modalHtml = `
        <div class="modal" id="clientOutcomeModal" style="display: flex;">
            <div class="modal-content new-modal">
                <div class="modal-header">
                    <h3>Submit Client Outcome</h3>
                    <button class="close" onclick="closeClientOutcomeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="clientOutcomeForm">
                        <div class="form-group">
                            <label>Client Response File</label>
                            <div class="upload-area" onclick="document.getElementById('clientResponseFile').click()">
                                <div class="upload-icon">📎</div>
                                <p>Click to choose file</p>
                            </div>
                            <input type="file" id="clientResponseFile" style="display: none;">
                            <div id="clientFileList" style="margin-top: 1rem;"></div>
                        </div>
                        
                        <div class="form-group">
                            <label>Outcome *</label>
                            <select class="form-control" id="clientOutcome" required>
                                <option value="">Select outcome</option>
                                <option value="won">Won</option>
                                <option value="loss">Loss</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Comments</label>
                            <textarea class="form-control" id="clientComments"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeClientOutcomeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="submitClientOutcome('${proposalId}')">Submit Outcome</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // File input handler
    document.getElementById('clientResponseFile').addEventListener('change', function() {
        const fileList = document.getElementById('clientFileList');
        if (this.files.length > 0) {
            const file = this.files[0];
            fileList.innerHTML = `<div style="padding: 0.5rem; background: var(--light-blue); border-radius: 6px;">📄 ${file.name} (${(file.size / 1024).toFixed(2)} KB)</div>`;
        } else {
            fileList.innerHTML = '';
        }
    });
}

function closeClientOutcomeModal() {
    const modal = document.getElementById('clientOutcomeModal');
    if (modal) modal.remove();
}

// Submit Client Outcome
async function submitClientOutcome(proposalId) {
    const outcome = document.getElementById('clientOutcome').value;
    const comments = document.getElementById('clientComments').value;
    const file = document.getElementById('clientResponseFile').files[0];
    
    if (!outcome) {
        alert('Please select an outcome');
        return;
    }
    
    try {
        showLoading();
        
        const formData = new FormData();
        formData.append('outcome', outcome);
        formData.append('comments', comments);
        if (file) {
            formData.append('client_response_file', file);
        }
        
        const response = await apiCall(`proposals/${proposalId}/client-outcome`, {
            method: 'POST',
            body: formData
        });
        
        if (response.success) {
            closeClientOutcomeModal();
            alert(`Proposal marked as ${outcome}!`);
            if (typeof showProposals === 'function') {
                showProposals();
            } else if (typeof showDashboard === 'function') {
                showProposals();
            }
        } else {
            throw new Error(response.error || 'Failed to submit outcome');
        }
        
    } catch (error) {
        console.error('Error submitting client outcome:', error);
        alert('Error submitting outcome: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Show Allocation Form (for COO/Director) - Note: showProjectAllocationModal already exists
function showAllocationForm(proposalId) {
    // Use the existing showProjectAllocationModal function
    if (typeof showProjectAllocationModal === 'function') {
        showProjectAllocationModal(proposalId);
    }
}

// Show Designer Assignment Form (for Design Manager)
function showDesignerAssignment(projectId) {
    // Use the existing assignDesigners function
    if (typeof assignDesigners === 'function') {
        assignDesigners(projectId);
    }
}

// Show Submit Design Form (for Design Manager)
function showSubmitDesign(projectId) {
    const modalHtml = `
        <div class="modal" id="submitDesignModal" style="display: flex;">
            <div class="modal-content new-modal">
                <div class="modal-header">
                    <h3>Submit Final Design</h3>
                    <button class="close" onclick="closeSubmitDesignModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="submitDesignForm">
                        <div class="form-group">
                            <label>Final Design Files *</label>
                            <div class="upload-area" onclick="document.getElementById('designFiles').click()">
                                <div class="upload-icon">📎</div>
                                <p>Click to choose files</p>
                            </div>
                            <input type="file" id="designFiles" multiple required style="display: none;">
                            <div id="designFileList" style="margin-top: 1rem;"></div>
                        </div>
                        
                        <div class="form-group">
                            <label>Remarks</label>
                            <textarea class="form-control" id="designRemarks"></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-outline" onclick="closeSubmitDesignModal()">Cancel</button>
                    <button class="btn btn-success" onclick="submitFinalDesign('${projectId}')">Submit to Client</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // File input handler
    document.getElementById('designFiles').addEventListener('change', function() {
        const fileList = document.getElementById('designFileList');
        if (this.files.length > 0) {
            fileList.innerHTML = Array.from(this.files).map(file => `
                <div style="padding: 0.5rem; background: var(--light-blue); border-radius: 6px; margin-bottom: 0.5rem;">
                    📄 ${file.name} (${(file.size / 1024).toFixed(2)} KB)
                </div>
            `).join('');
        } else {
            fileList.innerHTML = '';
        }
    });
}

function closeSubmitDesignModal() {
    const modal = document.getElementById('submitDesignModal');
    if (modal) modal.remove();
}

// Submit Final Design
async function submitFinalDesign(projectId) {
    const files = document.getElementById('designFiles').files;
    const remarks = document.getElementById('designRemarks').value;
    
    if (files.length === 0) {
        alert('Please attach final design files');
        return;
    }
    
    try {
        showLoading();
        
        const formData = new FormData();
        for (let file of files) {
            formData.append('attachments', file);
        }
        formData.append('remarks', remarks);
        
        const response = await apiCall(`projects/${projectId}/submit-design`, {
            method: 'POST',
            body: formData
        });
        
        if (response.success) {
            closeSubmitDesignModal();
            alert('Design submitted successfully!');
            if (typeof showProjects === 'function') {
                showProjects();
            } else if (typeof showDashboard === 'function') {
                showProposals();
            }
        } else {
            throw new Error(response.error || 'Failed to submit design');
        }
        
    } catch (error) {
        console.error('Error submitting design:', error);
        alert('Error submitting design: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Mark Project Complete (for Design Manager)
async function markComplete(projectId) {
    if (!confirm('Mark this project as complete?')) {
        return;
    }
    
    try {
        showLoading();
        
        const response = await apiCall(`projects/${projectId}/complete`, {
            method: 'POST'
        });
        
        if (response.success) {
            alert('Project marked as complete!');
            if (typeof showProjects === 'function') {
                showProjects();
            } else if (typeof showDashboard === 'function') {
                showProposals();
            }
        } else {
            throw new Error(response.error || 'Failed to mark complete');
        }
        
    } catch (error) {
        console.error('Error marking complete:', error);
        alert('Error marking project complete: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Update Total Assigned Hours (for Designer Assignment)
function updateTotalAssigned() {
    let total = 0;
    const hoursInputs = document.querySelectorAll('.hours-input');
    hoursInputs.forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    const totalElement = document.getElementById('totalAssignedHours');
    if (totalElement) {
        totalElement.textContent = total.toFixed(1);
    }
}

// Add Designer Assignment Row
function addDesignerRow() {
    const container = document.getElementById('designerAssignmentRows');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr auto; gap: 1rem; margin-bottom: 1rem;';
    row.innerHTML = `
        <div class="form-group">
            <select class="form-control designer-select">
                <option value="">Select Designer</option>
            </select>
        </div>
        <div class="form-group">
            <input type="number" step="0.1" class="form-control hours-input" 
                   placeholder="Hours" onchange="updateTotalAssigned()">
        </div>
        <button type="button" class="btn btn-danger btn-sm" onclick="removeDesignerRow(this)">×</button>
    `;
    container.appendChild(row);
    
    // Load designers for new row
    if (typeof loadDesigners === 'function') {
        loadDesigners();
    }
}

function removeDesignerRow(btn) {
    btn.parentElement.remove();
    updateTotalAssigned();
}

// Load Designers for Assignment
async function loadDesigners() {
    try {
        const response = await apiCall('users?role=designer');
        
        if (response.success && response.data) {
            document.querySelectorAll('.designer-select').forEach(select => {
                // Keep first option
                const firstOption = select.querySelector('option:first-child');
                select.innerHTML = '';
                if (firstOption) {
                    select.appendChild(firstOption);
                }
                
                response.data.forEach(designer => {
                    const option = document.createElement('option');
                    option.value = designer.id;
                    option.textContent = designer.name;
                    select.appendChild(option);
                });
            });
        }
    } catch (error) {
        console.error('Error loading designers:', error);
    }
}

// Load Design Managers for Allocation
async function loadDesignManagers() {
    try {
        const response = await apiCall('users?role=design_manager');
        const select = document.getElementById('designManagerId');
        
        if (response.success && response.data && select) {
            response.data.forEach(manager => {
                const option = document.createElement('option');
                option.value = manager.id;
                option.textContent = manager.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading design managers:', error);
    }
}

// Add Pricing Row (for COO Pricing)
function addPricingRow() {
    const container = document.getElementById('pricingRows');
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 1rem; margin-bottom: 1rem;';
    row.innerHTML = `
        <input type="text" class="form-control" placeholder="Description" />
        <input type="number" step="0.01" class="form-control" placeholder="Unit Cost" />
        <input type="number" step="0.1" class="form-control" placeholder="Qty/Hours" />
        <button type="button" class="btn btn-danger btn-sm" onclick="removePricingRow(this)">×</button>
    `;
    container.appendChild(row);
}

function removePricingRow(btn) {
    btn.parentElement.remove();
}


// ============================================
// DESIGNER TASKS/PROJECTS VIEW
// ============================================

// ***** CORRECTED FUNCTION *****
// This function now correctly injects the HTML into 'mainContent'
// instead of hiding 'mainContent'.
window.showTasksImpl = async function() {
    setActiveNav('nav-tasks');
    const main = document.getElementById('mainContent');
    main.style.display = 'block'; // <-- FIX: Ensure main content is visible
    
    showLoading();
    
    try {
       // Fetch projects assigned to this designer
        const response = await apiCall('projects?assignedToMe=true');
        
        if (!response.success) {
            throw new Error('Failed to load projects');
        }
        
        let rawProjects = response.data || [];
        
        // FIX: Ensure specific client-side filtering just in case backend returns all
        const projects = rawProjects.filter(p => 
            (p.assignedDesigners && p.assignedDesigners.includes(currentUser.uid)) ||
            (p.assignedDesignerUids && p.assignedDesignerUids.includes(currentUser.uid))
        );
        
        const projectsHtml = projects.length > 0 ? projects.map(project => `
            <div class="project-card">
                <div class="project-header">
                    <h3>${project.projectName || 'Untitled Project'}</h3>
                    <span class="project-status ${project.status}">${project.status}</span>
                </div>
                <div class="project-details">
                    <p><strong>Client:</strong> ${project.clientCompany || 'N/A'}</p>
                    <p><strong>Project Code:</strong> ${project.projectCode || 'N/A'}</p>
                    <p><strong>Target Date:</strong> ${project.targetCompletionDate ? formatDate(project.targetCompletionDate) : 'Not set'}</p>
                    <p><strong>Status:</strong> ${project.designStatus || 'N/A'}</p>
                    <p><strong>Design Manager:</strong> ${project.designLeadName || 'N/A'}</p>
                </div>
                <div class="project-actions">
                    <button class="btn btn-primary" onclick="showDesignerUploadModal('${project.id}')">
                        📤 Upload Files
                    </button>
                    <button class="btn btn-outline" onclick="viewProjectDetails('${project.id}')">
                        👁️ View Details
                    </button>
                </div>
            </div>
        `).join('') : '<p style="text-align: center; padding: 2rem; color: var(--text-light);">No projects assigned yet.</p>';
        
        // <-- FIX: Inject HTML into main.innerHTML
        main.innerHTML = `
            <div class="page-header">
                <h2>📋 My Projects</h2>
                <p class="subtitle">Projects assigned to you</p>
            </div>
            
            <div class="dashboard-stats">
                <div class="stat-card">
                    <div class="stat-number">${projects.length}</div>
                    <div class="stat-label">Total Projects</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${projects.filter(p => p.status === 'active').length}</div>
                    <div class="stat-label">Active Projects</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${projects.filter(p => p.status === 'completed').length}</div>
                    <div class="stat-label">Completed</div>
                </div>
            </div>
            
            <div class="action-section">
                <h3>Your Projects</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.5rem;">
                    ${projectsHtml}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading tasks:', error);
        main.innerHTML = `<div class="error-message">Failed to load projects: ${error.message}</div>`;
    } finally {
        hideLoading();
    }
}

function viewProjectDetails(projectId) {
    // Simple project details view
    apiCall(`projects?id=${projectId}`).then(response => {
        if (!response.success || !response.data) {
            alert('Failed to load project details');
            return;
        }
        
        const project = response.data;
        const pc = project.projectContacts || {};
        const tech = pc.technical || {};
        const comm = pc.commercial || {};
        const hasContacts = tech.bdmName || tech.bdmEmail || tech.clientPmName || tech.clientPmEmail
            || comm.accountName || comm.accountEmail || comm.bdmName || comm.bdmEmail;
        const contactRow = (label, name, email) => (name || email)
            ? `<div style="margin-bottom:0.4rem;"><strong>${label}:</strong> ${name || ''}${email ? ` &lt;<a href="mailto:${email}">${email}</a>&gt;` : ''}</div>`
            : '';
        const contactsBlock = hasContacts ? `
                        <div style="grid-column: 1 / -1; margin-top:0.75rem; padding:0.85rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                            <div style="font-weight:700; color:#1e293b; margin-bottom:0.5rem;">📇 Project Contacts</div>
                            <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:0.75rem;">
                                <div>
                                    <div style="font-size:0.75rem; text-transform:uppercase; color:#64748b; margin-bottom:0.35rem;">Technical</div>
                                    ${contactRow('BDM', tech.bdmName, tech.bdmEmail)}
                                    ${contactRow('Client PM', tech.clientPmName, tech.clientPmEmail)}
                                </div>
                                <div>
                                    <div style="font-size:0.75rem; text-transform:uppercase; color:#64748b; margin-bottom:0.35rem;">Commercial</div>
                                    ${contactRow('Account', comm.accountName, comm.accountEmail)}
                                    ${contactRow('BDM', comm.bdmName, comm.bdmEmail)}
                                </div>
                            </div>
                        </div>` : '';
        const poBlock = (project.poNumber || project.poValue || project.poFileUrl) ? `
                        <div style="grid-column: 1 / -1; margin-top:0.5rem; padding:0.85rem; background:#fef9e7; border:1px solid #f0c040; border-radius:8px;">
                            <div style="font-weight:700; color:#7c6a0a; margin-bottom:0.5rem;">📄 Purchase Order</div>
                            ${project.poNumber ? `<div><strong>P.O. Number:</strong> ${project.poNumber}</div>` : ''}
                            ${project.poValue ? `<div><strong>P.O. Value:</strong> ${project.poCurrency || 'USD'} ${parseFloat(project.poValue).toLocaleString()}</div>` : ''}
                            ${project.poFileUrl ? `<div><strong>Document:</strong> <a href="${project.poFileUrl}" target="_blank">${project.poFileName || 'View P.O.'}</a></div>` : ''}
                        </div>` : '';
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'projectDetailsModal';
        // FIXED: Add inline styles to ensure modal displays properly
        modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px; background: white; border-radius: 12px; max-height: 90vh; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                <div class="modal-header" style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0;">📋 Project Details</h3>
                    <button class="modal-close" onclick="closeProjectDetailsModal()" style="background: none; border: none; font-size: 2rem; cursor: pointer; color: #666;">&times;</button>
                </div>
                <div class="modal-body" style="padding: 1.5rem; max-height: 60vh; overflow-y: auto;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                        <div><strong>Project Name:</strong><br>${project.projectName || 'N/A'}</div>
                        <div><strong>Client:</strong><br>${project.clientCompany || 'N/A'}</div>
                        <div><strong>Project Code:</strong><br>${project.projectCode || 'N/A'}</div>
                        <div><strong>Status:</strong><br><span class="status-badge">${project.status}</span></div>
                        <div><strong>Design Manager:</strong><br>${project.designLeadName || 'N/A'}</div>
                        <div><strong>Target Date:</strong><br>${project.targetCompletionDate ? formatDate(project.targetCompletionDate) : 'Not set'}</div>
                        <div style="grid-column: 1 / -1;"><strong>Description:</strong><br>${project.projectDescription || 'No description provided'}</div>
                        <div style="grid-column: 1 / -1;"><strong>Special Instructions:</strong><br>${project.specialInstructions || 'None'}</div>
                        ${poBlock}
                        ${contactsBlock}
                    </div>
                </div>
                <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 0.5rem;">
                    <button class="btn btn-primary" onclick="showDesignerUploadModal('${projectId}'); closeProjectDetailsModal();">
                        📤 Upload Files
                    </button>
                    <button class="btn btn-outline" onclick="closeProjectDetailsModal()">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.body.classList.add('modal-open');
    });
}

// Ensure project view functions are globally accessible
window.viewProjectDetails = viewProjectDetails;
window._viewProjectImpl = viewProjectDetails; // Register with wrapper
window.closeProjectDetailsModal = closeProjectDetailsModal;
console.log('✅ viewProjectDetails implementation registered');

function closeProjectDetailsModal() {
    const modal = document.getElementById('projectDetailsModal');
    if (modal) modal.remove();
    document.body.classList.remove('modal-open');
}

// ============================================
// SHOW SECTION FUNCTION FOR NAV ITEMS
// ============================================

// ***** CORRECTED FUNCTION *****
// This function now correctly injects the HTML into 'mainContent'
// instead of hiding 'mainContent'.
window.showTimesheetImpl = async function() {
    setActiveNav('nav-timesheet');
    const main = document.getElementById('mainContent');
    main.style.display = 'block'; // <-- FIX
    showLoading();
    
    try {
        console.log('⏱️ Loading Timesheet...');
        const templateContent = document.getElementById('timesheetSection');
        if (!templateContent) {
            throw new Error('Timesheet template not found');
        }
        
        // Clone and insert into main content
        main.innerHTML = templateContent.outerHTML.replace('style="display: none;"', 'style="display: block;"'); // <-- FIX
        
        // Load the data
        await loadDesignerTimesheet(); // Use new function
        
        hideLoading();
    } catch (error) {
        console.error('❌ Timesheet error:', error);
        main.innerHTML = `<div class="error-message"><h3>⚠️ Error Loading Timesheet</h3><p>${error.message}</p></div>`;
        hideLoading();
    }
}

// ***** CORRECTED FUNCTION *****
// This function now correctly injects the HTML into 'mainContent'
// instead of hiding 'mainContent'.
async function showSection(sectionName) {
    const main = document.getElementById('mainContent');
    main.style.display = 'block'; // <-- FIX
    showLoading();

    try {
        if (sectionName === 'timesheet') {
            setActiveNav('nav-timesheet');
            const templateContent = document.getElementById('timesheetSection');
            if (!templateContent) throw new Error('Timesheet template not found');
            main.innerHTML = templateContent.outerHTML.replace('style="display: none;"', 'style="display: block;"');
            await loadDesignerTimesheet(); // Use new function
        } else if (sectionName === 'executiveMonitoring') {
            setActiveNav('nav-executive');
            const templateContent = document.getElementById('executiveTimesheetMonitoring');
            if (!templateContent) throw new Error('Executive Monitoring template not found');
            main.innerHTML = templateContent.outerHTML.replace('style="display: none;"', 'style="display: block;"');
            await loadExecutiveMonitoring(); // Use new function
        }
        hideLoading();
    } catch (error) {
        console.error('❌ Section load error:', error);
        main.innerHTML = `<div class="error-message"><h3>⚠️ Error Loading Section</h3><p>${error.message}</p></div>`;
        hideLoading();
    }
}

// ============================================
// DESIGNER TIMESHEET FUNCTIONS
// ============================================
async function loadDesignerTimesheet() {
    try {
        showLoading();
        
        // Load designer's projects
        const projectsResponse = await apiCall('projects?assignedToMe=true');
        const timesheetResponse = await apiCall('timesheets');
        
        if (!projectsResponse.success || !timesheetResponse.success) {
            throw new Error('Failed to load timesheet data');
        }
        
        const projects = projectsResponse.data || [];
        const entries = timesheetResponse.data || [];
        
        // Calculate summary
        const thisWeekHours = entries
            .filter(e => isThisWeek(e.date))
            .reduce((sum, e) => sum + parseFloat(e.hours || 0), 0);
        
        const thisMonthHours = entries
            .filter(e => isThisMonth(e.date))
            .reduce((sum, e) => sum + parseFloat(e.hours || 0), 0);
        
        // Update summary
        const summaryDiv = document.getElementById('timesheetSummary');
        if (summaryDiv) {
            summaryDiv.innerHTML = `
                <div class="stat-card" style="background: white; border: 2px solid var(--border); border-radius: 10px; padding: 1rem; text-align: center;">
                    <div class="stat-label" style="font-size: 0.9rem; color: var(--text-light); margin-bottom: 0.5rem;">This Week</div>
                    <div class="stat-value" style="font-size: 2.5rem; font-weight: 700; color: var(--primary-blue);">${thisWeekHours.toFixed(1)}h</div>
                </div>
                <div class="stat-card" style="background: white; border: 2px solid var(--border); border-radius: 10px; padding: 1rem; text-align: center;">
                    <div class="stat-label" style="font-size: 0.9rem; color: var(--text-light); margin-bottom: 0.5rem;">This Month</div>
                    <div class="stat-value" style="font-size: 2.5rem; font-weight: 700; color: var(--primary-blue);">${thisMonthHours.toFixed(1)}h</div>
                </div>
                <div class="stat-card" style="background: white; border: 2px solid var(--border); border-radius: 10px; padding: 1rem; text-align: center;">
                    <div class="stat-label" style="font-size: 0.9rem; color: var(--text-light); margin-bottom: 0.5rem;">Active Projects</div>
                    <div class="stat-value" style="font-size: 2.5rem; font-weight: 700; color: var(--primary-blue);">${projects.length}</div>
                </div>
            `;
        }
        
        // Update table
        const tbody = document.getElementById('timesheetTableBody');
        if (tbody) {
            // Build project lookup for project number display
            const projLookup = {};
            (projects || []).forEach(p => { if (p.id) projLookup[p.id] = p; });

            if (entries.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No timesheet entries yet</td></tr>';
            } else {
                tbody.innerHTML = entries.map(entry => {
                    const proj2 = projLookup[entry.projectId];
                    const projNum2 = entry.projectNumber || proj2?.projectNumber || null;
                    const projectDisplay = projNum2
                        ? `<span style="font-weight:700;color:var(--primary-blue);">${projNum2}</span> <small style="color:#6b7280;">${entry.projectName || ''}</small>`
                        : (entry.projectName || entry.projectCode || 'N/A');
                    return `
                    <tr>
                        <td>${formatDate(entry.date)}</td>
                        <td>${projectDisplay}</td>
                        <td>${entry.hours}h</td>
                        <td>${entry.description || '-'}</td>
                        <td><span class="status-badge status-${entry.status || 'pending'}">${entry.status || 'Pending'}</span></td>
                        <td style="white-space: nowrap;">
                            <button onclick="editTimesheetEntry('${entry.id}', '${entry.projectId || ''}', '${entry.date ? new Date(entry.date.seconds ? entry.date.seconds * 1000 : entry.date).toISOString().split('T')[0] : ''}', ${entry.hours || 0}, '${(entry.description || '').replace(/'/g, "\\'")}', '${(entry.projectName || '').replace(/'/g, "\\'")}')" 
                                class="btn btn-sm" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; background: var(--accent-blue); color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 0.25rem;">
                                ✏️ Edit
                            </button>
                            <button onclick="deleteTimesheetEntry('${entry.id}')" 
                                class="btn btn-sm btn-danger" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; background: var(--danger); color: white; border: none; border-radius: 6px; cursor: pointer;">
                                🗑️ Delete
                            </button>
                        </td>
                    </tr>
                `}).join('');
            }
        }
        
    } catch (error) {
        console.error('Error loading timesheet:', error);
        alert('Failed to load timesheet: ' + error.message);
    } finally {
        hideLoading();
    }
}


// ============================================
// DELETE TIMESHEET ENTRY FUNCTION
// ============================================
window.deleteTimesheetEntry = async function(entryId) {
    if (!confirm('Are you sure you want to delete this timesheet entry?')) return;
    
    try {
        showLoading();
        const response = await apiCall(`timesheets?id=${entryId}`, { method: 'DELETE' });
        
        if (response.success) {
            alert('✅ Entry deleted successfully');
            // Refresh the timesheet view
            if (typeof showTimesheet === 'function') {
                showTimesheet();
            } else if (typeof loadDesignerTimesheet === 'function') {
                loadDesignerTimesheet();
            }
        } else {
            throw new Error(response.error || 'Failed to delete');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    } finally {
        hideLoading();
    }
};

// ============================================
// EDIT TIMESHEET ENTRY FUNCTION
// ============================================
window.editTimesheetEntry = async function(entryId, projectId, date, hours, description, projectName) {
    console.log('✏️ Edit timesheet entry:', { entryId, projectId, date, hours, description, projectName });
    
    // Close any existing modal
    closeModal();
    
    // Show loading while fetching projects
    showLoading();
    
    let projectOptions = '';
    try {
        // Fetch designer's assigned projects for the dropdown
        const projectsResponse = await apiCall('projects?assignedToMe=true');
        if (projectsResponse.success) {
            const projects = projectsResponse.data || [];
            const assignedProjects = projects.filter(p => 
                (p.assignedDesigners && p.assignedDesigners.includes(currentUser.uid)) ||
                (p.assignedDesignerUids && p.assignedDesignerUids.includes(currentUser.uid))
            );
            
            projectOptions = assignedProjects.map(p => `
                <option value="${p.id}" ${p.id === projectId ? 'selected' : ''}>
                    ${p.projectCode || ''} - ${p.projectName}
                </option>
            `).join('');
            
            // Add non-project options
            projectOptions += `
                <option value="TRAINING" ${projectId === 'TRAINING' ? 'selected' : ''}>Training</option>
                <option value="SAMPLE_DESIGNING" ${projectId === 'SAMPLE_DESIGNING' ? 'selected' : ''}>Sample Designing</option>
            `;
        }
    } catch (e) {
        console.error('Error fetching projects:', e);
        projectOptions = `<option value="${projectId}" selected>${projectName || 'Current Project'}</option>`;
    }
    
    hideLoading();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'editTimesheetModal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 550px; width: 90%; background: white; border-radius: 16px; max-height: 90vh; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <div class="modal-header" style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, var(--primary-blue), var(--accent-blue)); color: white;">
                <h2 style="margin: 0; font-size: 1.25rem;">✏️ Edit Timesheet Entry</h2>
                <span onclick="closeEditTimesheetModal()" style="cursor: pointer; font-size: 1.75rem; opacity: 0.8; transition: opacity 0.2s;">&times;</span>
            </div>
            <div class="modal-body" style="padding: 1.5rem; max-height: 60vh; overflow-y: auto;">
                <form id="editTimesheetForm">
                    <input type="hidden" id="editTimesheetEntryId" value="${entryId}">
                    <input type="hidden" id="editTimesheetOldProjectId" value="${projectId}">
                    
                    <div class="form-group" style="margin-bottom: 1.25rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-dark);">
                            📁 Project <span style="color: var(--danger);">*</span>
                        </label>
                        <select id="editTimesheetProjectId" required
                               style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; font-size: 1rem; background: white;">
                            ${projectOptions}
                        </select>
                        <small style="color: var(--text-light); font-size: 0.85rem;">Select the correct project if entered wrongly</small>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 1.25rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-dark);">
                            📅 Date <span style="color: var(--danger);">*</span>
                        </label>
                        <input type="date" id="editTimesheetDate" value="${date}" required
                               style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; font-size: 1rem;">
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 1.25rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-dark);">
                            ⏱️ Hours <span style="color: var(--danger);">*</span>
                        </label>
                        <input type="number" id="editTimesheetHours" value="${hours}" min="0.25" max="24" step="0.25" required
                               style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; font-size: 1rem;">
                        <small style="color: var(--text-light); font-size: 0.85rem;">Enter hours in 0.25 increments (e.g., 1.5, 2.25)</small>
                    </div>
                    
                    <div class="form-group" style="margin-bottom: 1.25rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-dark);">
                            📝 Description
                        </label>
                        <textarea id="editTimesheetDescription" rows="3" placeholder="What did you work on?"
                                  style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; font-size: 1rem; resize: vertical;">${description || ''}</textarea>
                    </div>
                    
                    <div id="editTimesheetWarning" style="display: none; padding: 0.75rem; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; margin-bottom: 1rem;">
                        <strong>⚠️ Note:</strong> <span id="editTimesheetWarningText"></span>
                    </div>
                </form>
            </div>
            <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 0.75rem; background: #f9fafb;">
                <button type="button" onclick="closeEditTimesheetModal()" 
                        style="padding: 0.75rem 1.5rem; border: 1px solid var(--border); border-radius: 8px; background: white; cursor: pointer; font-weight: 500;">
                    Cancel
                </button>
                <button type="button" onclick="submitEditTimesheet()" 
                        style="padding: 0.75rem 1.5rem; border: none; border-radius: 8px; background: var(--success); color: white; cursor: pointer; font-weight: 600;">
                    💾 Save Changes
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    document.body.classList.add('modal-open');
    
    // Add change listener to show warning when project changes
    const projectSelect = document.getElementById('editTimesheetProjectId');
    if (projectSelect) {
        projectSelect.addEventListener('change', function() {
            const warning = document.getElementById('editTimesheetWarning');
            const warningText = document.getElementById('editTimesheetWarningText');
            if (this.value !== projectId) {
                warning.style.display = 'block';
                warningText.textContent = 'You are changing the project. Hours will be moved from the old project to the new one.';
            } else {
                warning.style.display = 'none';
            }
        });
    }
    
    // Focus on hours field
    setTimeout(() => {
        const hoursInput = document.getElementById('editTimesheetHours');
        if (hoursInput) hoursInput.focus();
    }, 100);
};

window.closeEditTimesheetModal = function() {
    const modal = document.getElementById('editTimesheetModal');
    if (modal) {
        modal.remove();
    }
    document.body.classList.remove('modal-open');
};

window.submitEditTimesheet = async function() {
    const entryId = document.getElementById('editTimesheetEntryId')?.value;
    const oldProjectId = document.getElementById('editTimesheetOldProjectId')?.value;
    const newProjectId = document.getElementById('editTimesheetProjectId')?.value;
    const date = document.getElementById('editTimesheetDate')?.value;
    const hours = parseFloat(document.getElementById('editTimesheetHours')?.value);
    const description = document.getElementById('editTimesheetDescription')?.value?.trim();
    
    console.log('💾 Updating timesheet:', { entryId, oldProjectId, newProjectId, date, hours, description });
    
    // Validation
    if (!entryId) {
        alert('⚠️ Entry ID is missing');
        return;
    }
    
    if (!newProjectId) {
        alert('⚠️ Please select a project');
        return;
    }
    
    if (!date) {
        alert('⚠️ Please select a date');
        return;
    }
    
    if (!hours || hours <= 0) {
        alert('⚠️ Please enter valid hours (greater than 0)');
        return;
    }
    
    if (hours > 24) {
        alert('⚠️ Hours cannot exceed 24 per entry');
        return;
    }
    
    // Confirm if project is changing
    if (newProjectId !== oldProjectId) {
        if (!confirm('You are changing the project for this entry. Hours will be moved from the old project to the new one. Continue?')) {
            return;
        }
    }
    
    try {
        showLoading();
        
        const updateData = {
            projectId: newProjectId,
            date: date,
            hours: hours,
            description: description || ''
        };
        
        const response = await apiCall(`timesheets?id=${entryId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
        
        if (response.success) {
            alert('✅ Timesheet entry updated successfully!');
            closeEditTimesheetModal();
            
            // Refresh the timesheet view
            if (typeof showTimesheet === 'function') {
                showTimesheet();
            } else if (typeof loadDesignerTimesheet === 'function') {
                loadDesignerTimesheet();
            }
        } else {
            throw new Error(response.error || 'Failed to update timesheet entry');
        }
    } catch (error) {
        console.error('❌ Error updating timesheet:', error);
        alert('Error updating timesheet: ' + error.message);
    } finally {
        hideLoading();
    }
};

console.log('✅ Timesheet Edit/Delete Functions Loaded');

// Helper function to parse date from various formats
function parseTimesheetDate(dateValue) {
    if (!dateValue) return null;
    // Handle Firebase Timestamp object (seconds or _seconds)
    if (dateValue && (dateValue.seconds || dateValue._seconds)) {
        const seconds = dateValue.seconds || dateValue._seconds;
        return new Date(seconds * 1000);
    }
    // Handle toDate method (Firestore Timestamp)
    if (dateValue && typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
    }
    // Handle numeric timestamp
    if (typeof dateValue === 'number') {
        return new Date(dateValue);
    }
    // Handle string date
    if (typeof dateValue === 'string') {
        return new Date(dateValue);
    }
    // Handle Date object
    if (dateValue instanceof Date) {
        return dateValue;
    }
    return null;
}

// Helper functions for date filtering
function isThisWeek(dateValue) {
    const date = parseTimesheetDate(dateValue);
    if (!date || isNaN(date.getTime())) return false;
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    return date >= weekStart;
}

function isThisMonth(dateValue) {
    const date = parseTimesheetDate(dateValue);
    if (!date || isNaN(date.getTime())) return false;
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

// ============================================
// DESIGNER PROJECT UPLOAD FUNCTIONS
// ============================================
function showDesignerUploadModal(projectId) {

    // Close existing modal if any
    closeModal();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'designerUploadModal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000; align-items: center; justify-content: center; backdrop-filter: blur(4px);';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 640px; width: 95%; background: white; border-radius: 16px; max-height: 90vh; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.3); animation: modalSlideIn 0.3s ease;">
            <style>
                @keyframes modalSlideIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
                .upload-tab-btn { flex: 1; padding: 12px 16px; border: none; background: #f1f5f9; cursor: pointer; font-size: 14px; font-weight: 600; color: #64748b; transition: all 0.2s; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; }
                .upload-tab-btn.active { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; box-shadow: 0 4px 12px rgba(102,126,234,0.4); }
                .upload-tab-btn:hover:not(.active) { background: #e2e8f0; color: #334155; }
                .upload-tab-content { display: none; } .upload-tab-content.active { display: block; }
                .designer-dropzone { border: 2px dashed #cbd5e1; border-radius: 12px; padding: 2.5rem 1.5rem; text-align: center; cursor: pointer; transition: all 0.3s; background: #f8fafc; }
                .designer-dropzone:hover, .designer-dropzone.dragover { border-color: #667eea; background: #f0f0ff; }
                .designer-dropzone.has-files { border-color: #10b981; background: #f0fdf4; border-style: solid; }
                .designer-file-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #f8fafc; border-radius: 8px; margin-bottom: 8px; border: 1px solid #e2e8f0; }
                .designer-file-item .file-info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
                .designer-file-item .file-name { font-size: 13px; font-weight: 500; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .designer-file-item .file-size { font-size: 12px; color: #94a3b8; white-space: nowrap; }
                .designer-file-item .file-icon { font-size: 20px; flex-shrink: 0; }
                .designer-file-item .remove-file { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 18px; padding: 2px 6px; border-radius: 4px; transition: background 0.2s; }
                .designer-file-item .remove-file:hover { background: #fee2e2; }
                .designer-link-row { display: flex; gap: 8px; margin-bottom: 10px; align-items: center; }
                .designer-link-row input { flex: 1; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; }
                .designer-link-row input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
                .add-link-btn { background: #f0f0ff; color: #667eea; border: 1px dashed #667eea; padding: 10px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s; width: 100%; }
                .add-link-btn:hover { background: #e8e8ff; }
                .remove-link-btn { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 20px; padding: 4px 8px; border-radius: 4px; flex-shrink: 0; }
                .remove-link-btn:hover { background: #fee2e2; }
                .upload-progress-bar { width: 100%; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin-top: 12px; display: none; }
                .upload-progress-bar .progress-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 3px; transition: width 0.3s; width: 0%; }
                .upload-size-info { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #eff6ff; border-radius: 8px; margin-top: 10px; font-size: 12px; color: #3b82f6; }
            </style>
            <div style="padding: 1.5rem 1.5rem 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-size: 1.3rem; font-weight: 700;">Upload Project Files</h2>
                    <span onclick="closeDesignerUploadModal()" style="cursor: pointer; font-size: 1.8rem; color: rgba(255,255,255,0.8); line-height: 1; transition: color 0.2s;" onmouseover="this.style.color='white'" onmouseout="this.style.color='rgba(255,255,255,0.8)'">&times;</span>
                </div>
                <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.85;">Upload files or share links for your project deliverables</p>
            </div>
            <div class="modal-body" style="padding: 1.5rem; max-height: 58vh; overflow-y: auto;">
                <!-- Upload Type Tabs -->
                <div style="display: flex; gap: 8px; margin-bottom: 1.25rem; background: #f1f5f9; padding: 4px; border-radius: 10px;">
                    <button type="button" class="upload-tab-btn active" onclick="switchDesignerUploadTab('files')">
                        <span>📁</span> Upload Files
                    </button>
                    <button type="button" class="upload-tab-btn" onclick="switchDesignerUploadTab('links')">
                        <span>🔗</span> Add Link
                    </button>
                </div>

                <!-- FILES TAB -->
                <div id="designerUploadTabFiles" class="upload-tab-content active">
                    <div class="designer-dropzone" id="designerDropzone"
                         onclick="document.getElementById('designerFiles').click()"
                         ondragover="event.preventDefault(); this.classList.add('dragover');"
                         ondragleave="this.classList.remove('dragover');"
                         ondrop="event.preventDefault(); this.classList.remove('dragover'); handleDesignerFileDrop(event);">
                        <div style="font-size: 2.5rem; margin-bottom: 8px;">📤</div>
                        <p style="margin: 0 0 4px; font-weight: 600; color: #334155;">Click to select files or drag & drop</p>
                        <p style="margin: 0; font-size: 12px; color: #94a3b8;">PDF, DWG, ZIP, RAR, Images &bull; Max 100MB per file</p>
                    </div>
                    <input type="file" id="designerFiles" multiple
                           accept=".pdf,.dwg,.zip,.rar,.7z,.jpg,.jpeg,.png,.tiff,.dxf"
                           style="display: none;" onchange="handleDesignerFileSelect(this.files)">
                    <div id="designerFileList" style="margin-top: 12px;"></div>
                    <div id="designerSizeInfo" style="display: none;" class="upload-size-info">
                        <span id="designerFileCount">0 files selected</span>
                        <span id="designerTotalSize">Total: 0 MB</span>
                    </div>
                </div>

                <!-- LINKS TAB -->
                <div id="designerUploadTabLinks" class="upload-tab-content">
                    <div id="designerLinkList">
                        <div class="designer-link-row">
                            <input type="text" placeholder="Paste link URL (Google Drive, Dropbox, etc.)" class="designer-link-url">
                            <input type="text" placeholder="Title (optional)" class="designer-link-title" style="max-width: 160px;">
                        </div>
                    </div>
                    <button type="button" class="add-link-btn" onclick="addDesignerLinkRow()">+ Add Another Link</button>
                </div>

                <!-- Stage & Revision -->
                <div style="margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid #e2e8f0;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 1rem;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; font-size: 13px; color: #374151; margin-bottom: 6px; display: block;">Submission Stage *</label>
                            <select id="designerSubmissionStage" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">
                                <option value="IFA">IFA - Issued for Approval</option>
                                <option value="IFC">IFC - Issued for Construction</option>
                                <option value="Preliminary">Preliminary</option>
                                <option value="Draft">Draft</option>
                                <option value="Final">Final</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-weight: 600; font-size: 13px; color: #374151; margin-bottom: 6px; display: block;">Revision</label>
                            <select id="designerRevisionNumber" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">
                                <option value="Rev-0">Rev-0 (Initial)</option>
                                <option value="Rev-1">Rev-1</option>
                                <option value="Rev-2">Rev-2</option>
                                <option value="Rev-3">Rev-3</option>
                                <option value="Rev-4">Rev-4</option>
                                <option value="Rev-5">Rev-5</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 1rem;">
                        <label style="font-weight: 600; font-size: 13px; color: #374151; margin-bottom: 6px; display: block;">Description</label>
                        <textarea id="designerFileDescription" class="form-control" rows="2"
                                  placeholder="Describe what you're uploading..."
                                  style="border-radius: 8px; border: 1px solid #e2e8f0; padding: 10px 14px; font-size: 14px; resize: vertical;"></textarea>
                    </div>

                    <div class="form-group" style="margin-bottom: 0;">
                        <label style="font-weight: 600; font-size: 13px; color: #374151; margin-bottom: 6px; display: block;">Status Update</label>
                        <select id="designerProjectStatus" class="form-control"
                                style="border-radius: 8px; border: 1px solid #e2e8f0; padding: 10px 14px; font-size: 14px;">
                            <option value="in_progress">Work in Progress</option>
                            <option value="review">Ready for Review</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                </div>

                <div class="upload-progress-bar" id="designerProgressBar">
                    <div class="progress-fill" id="designerProgressFill"></div>
                </div>
            </div>
            <div style="padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #fafbfc;">
                <span id="designerUploadStatus" style="font-size: 13px; color: #64748b;"></span>
                <div style="display: flex; gap: 10px;">
                    <button type="button" onclick="closeDesignerUploadModal()"
                            style="padding: 10px 20px; border: 1px solid #e2e8f0; background: white; border-radius: 8px; cursor: pointer; font-weight: 500; color: #64748b; transition: all 0.2s;">
                        Cancel
                    </button>
                    <button type="button" id="designerUploadBtn" onclick="submitDesignerUpload(event, '${projectId}')"
                            style="padding: 10px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s; box-shadow: 0 4px 12px rgba(102,126,234,0.3);">
                        Upload
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    // Close modal when clicking overlay
    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeDesignerUploadModal();
    });
}

function closeDesignerUploadModal() {
    const modal = document.getElementById('designerUploadModal');
    if (modal) modal.remove();
    document.body.classList.remove('modal-open');
    window._designerSelectedFiles = [];
}

// Track selected files globally for the modal
window._designerSelectedFiles = [];

const MAX_DESIGNER_FILE_SIZE = 100 * 1024 * 1024; // 100MB per file

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = { pdf: '📄', zip: '📦', rar: '📦', '7z': '📦', dwg: '📐', dxf: '📐', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', tiff: '🖼️' };
    return icons[ext] || '📎';
}

function formatDesignerFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function handleDesignerFileDrop(event) {
    const files = event.dataTransfer.files;
    handleDesignerFileSelect(files);
}

function handleDesignerFileSelect(files) {
    const fileArray = Array.from(files);
    const errors = [];

    fileArray.forEach(file => {
        if (file.size > MAX_DESIGNER_FILE_SIZE) {
            errors.push(`"${file.name}" exceeds 100MB limit (${formatDesignerFileSize(file.size)})`);
            return;
        }
        // Avoid duplicates
        if (!window._designerSelectedFiles.find(f => f.name === file.name && f.size === file.size)) {
            window._designerSelectedFiles.push(file);
        }
    });

    if (errors.length > 0) {
        alert('Some files were skipped:\n\n' + errors.join('\n'));
    }

    renderDesignerFileList();
}

function removeDesignerFile(index) {
    window._designerSelectedFiles.splice(index, 1);
    renderDesignerFileList();
}

function renderDesignerFileList() {
    const fileList = document.getElementById('designerFileList');
    const sizeInfo = document.getElementById('designerSizeInfo');
    const dropzone = document.getElementById('designerDropzone');
    const files = window._designerSelectedFiles;

    if (files.length > 0) {
        fileList.innerHTML = files.map((f, i) => `
            <div class="designer-file-item">
                <div class="file-info">
                    <span class="file-icon">${getFileIcon(f.name)}</span>
                    <span class="file-name" title="${f.name}">${f.name}</span>
                    <span class="file-size">${formatDesignerFileSize(f.size)}</span>
                </div>
                <button type="button" class="remove-file" onclick="removeDesignerFile(${i})" title="Remove">&times;</button>
            </div>
        `).join('');

        const totalSize = files.reduce((sum, f) => sum + f.size, 0);
        sizeInfo.style.display = 'flex';
        document.getElementById('designerFileCount').textContent = `${files.length} file${files.length > 1 ? 's' : ''} selected`;
        document.getElementById('designerTotalSize').textContent = `Total: ${formatDesignerFileSize(totalSize)}`;
        dropzone.classList.add('has-files');
    } else {
        fileList.innerHTML = '';
        sizeInfo.style.display = 'none';
        dropzone.classList.remove('has-files');
    }
}

function switchDesignerUploadTab(tab) {
    document.querySelectorAll('.upload-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.upload-tab-content').forEach(c => c.classList.remove('active'));

    if (tab === 'files') {
        document.getElementById('designerUploadTabFiles').classList.add('active');
        document.querySelectorAll('.upload-tab-btn')[0].classList.add('active');
    } else {
        document.getElementById('designerUploadTabLinks').classList.add('active');
        document.querySelectorAll('.upload-tab-btn')[1].classList.add('active');
    }
}

function addDesignerLinkRow() {
    const container = document.getElementById('designerLinkList');
    const row = document.createElement('div');
    row.className = 'designer-link-row';
    row.innerHTML = `
        <input type="text" placeholder="Paste link URL (Google Drive, Dropbox, etc.)" class="designer-link-url">
        <input type="text" placeholder="Title (optional)" class="designer-link-title" style="max-width: 160px;">
        <button type="button" class="remove-link-btn" onclick="this.parentElement.remove()" title="Remove">&times;</button>
    `;
    container.appendChild(row);
}

// Make designer upload functions globally accessible
window.showDesignerUploadModal = showDesignerUploadModal;
window.closeDesignerUploadModal = closeDesignerUploadModal;
window.switchDesignerUploadTab = switchDesignerUploadTab;
window.addDesignerLinkRow = addDesignerLinkRow;
window.handleDesignerFileDrop = handleDesignerFileDrop;
window.handleDesignerFileSelect = handleDesignerFileSelect;
window.removeDesignerFile = removeDesignerFile;
window.renderDesignerFileList = renderDesignerFileList;

async function submitDesignerUpload(event, projectId) {
    if (event) event.preventDefault();

    const activeTab = document.getElementById('designerUploadTabFiles').classList.contains('active') ? 'files' : 'links';
    const description = document.getElementById('designerFileDescription').value;
    const status = document.getElementById('designerProjectStatus').value;
    const submissionStage = document.getElementById('designerSubmissionStage').value;
    const revisionNumber = document.getElementById('designerRevisionNumber').value;
    const uploadBtn = document.getElementById('designerUploadBtn');
    const statusEl = document.getElementById('designerUploadStatus');
    const progressBar = document.getElementById('designerProgressBar');
    const progressFill = document.getElementById('designerProgressFill');

    if (activeTab === 'files') {
        // FILE UPLOAD
        const files = window._designerSelectedFiles;
        if (!files || files.length === 0) {
            alert('Please select at least one file to upload.');
            return;
        }

        // Validate file sizes
        const oversized = files.filter(f => f.size > MAX_DESIGNER_FILE_SIZE);
        if (oversized.length > 0) {
            alert('Some files exceed the 100MB limit. Please remove them and try again.');
            return;
        }

        try {
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Uploading...';
            progressBar.style.display = 'block';
            progressFill.style.width = '10%';
            statusEl.textContent = 'Preparing upload...';

            const formData = new FormData();
            files.forEach(file => formData.append('files', file));
            formData.append('projectId', projectId);
            formData.append('description', description);
            formData.append('uploadNotes', description);
            formData.append('status', status);
            formData.append('submissionStage', submissionStage);
            formData.append('revisionNumber', revisionNumber);

            statusEl.textContent = `Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`;
            progressFill.style.width = '40%';

            const response = await apiCall('deliverables', {
                method: 'POST',
                body: formData
            });

            progressFill.style.width = '100%';

            if (response.success) {
                statusEl.textContent = 'Upload complete!';
                setTimeout(() => {
                    closeDesignerUploadModal();
                    alert(`${files.length} file${files.length > 1 ? 's' : ''} uploaded successfully!`);
                    // Refresh current view
                    try {
                        if (typeof showDesignerAllocations === 'function' && document.getElementById('nav-designer-alloc') && document.getElementById('nav-designer-alloc').classList.contains('active')) {
                            showDesignerAllocations();
                        } else if (typeof showTasks === 'function') {
                            showTasks();
                        }
                    } catch(e) { console.warn('Refresh error:', e); }
                }, 500);
            } else {
                throw new Error(response.error || 'Upload failed');
            }

        } catch (error) {
            console.error('Error uploading files:', error);
            statusEl.textContent = 'Upload failed';
            progressFill.style.width = '0%';
            progressBar.style.display = 'none';
            alert('Error uploading files: ' + error.message);
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload';
        }

    } else {
        // LINK UPLOAD
        const linkRows = document.querySelectorAll('#designerLinkList .designer-link-row');
        const links = [];
        linkRows.forEach(row => {
            const url = row.querySelector('.designer-link-url').value.trim();
            const title = row.querySelector('.designer-link-title').value.trim();
            if (url) {
                links.push({ url, title: title || url, description: description });
            }
        });

        if (links.length === 0) {
            alert('Please enter at least one link URL.');
            return;
        }

        // Validate URLs
        const invalidLinks = links.filter(l => !l.url.startsWith('http://') && !l.url.startsWith('https://'));
        if (invalidLinks.length > 0) {
            alert('Please enter valid URLs starting with http:// or https://');
            return;
        }

        try {
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Submitting...';
            statusEl.textContent = 'Submitting links...';

            const response = await apiCall('deliverables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: projectId,
                    links: links,
                    uploadNotes: description,
                    status: status,
                    submissionStage: submissionStage,
                    revisionNumber: revisionNumber
                })
            });

            if (response.success) {
                closeDesignerUploadModal();
                alert(`${links.length} link${links.length > 1 ? 's' : ''} added successfully!`);
                try {
                    if (typeof showDesignerAllocations === 'function' && document.getElementById('nav-designer-alloc') && document.getElementById('nav-designer-alloc').classList.contains('active')) {
                        showDesignerAllocations();
                    } else if (typeof showTasks === 'function') {
                        showTasks();
                    }
                } catch(e) { console.warn('Refresh error:', e); }
            } else {
                throw new Error(response.error || 'Failed to add links');
            }

        } catch (error) {
            console.error('Error adding links:', error);
            statusEl.textContent = 'Failed';
            alert('Error adding links: ' + error.message);
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload';
            statusEl.textContent = '';
        }
    }
}
// ============================================
        // NEW: ADD VARIATION FUNCTIONS (DESIGN MANAGER)
        // ============================================

        /**
         * Shows the "Add Variation" modal and populates parent project info.
         */
        function showAddVariationModal(projectId, projectCode, projectName) {
            // Close any other modals
            closeModal();
            
            // Populate the modal fields
            document.getElementById('variationParentProjectId').value = projectId;
            document.getElementById('variationParentProjectName').textContent = projectName;
            document.getElementById('variationParentProjectCode').textContent = projectCode;
            
            // Reset form fields
            document.getElementById('addVariationForm').reset();
            
            // Show the modal
            const modal = document.getElementById('addVariationModal');
            modal.style.display = 'flex';

            // Pre-fill the variation code
            generateVariationCode(true); // Pass true for silent generation
        }

        /**
         * Closes the "Add Variation" modal and resets the form.
         */
        function closeAddVariationModal() {
            const modal = document.getElementById('addVariationModal');
            modal.style.display = 'none';
            document.getElementById('addVariationForm').reset();
            // Clear file upload preview
            const preview = document.getElementById('variationDocPreview');
            if (preview) preview.style.display = 'none';
            const fileInput = document.getElementById('variationDocument');
            if (fileInput) fileInput.value = '';
        }

       /**
         * Generates a new variation code.
         * Calls the consolidated /api/projects endpoint.
         */
        async function generateVariationCode(silent = false) {
            const parentId = document.getElementById('variationParentProjectId').value;
            const parentCode = document.getElementById('variationParentProjectCode').textContent;
            const variationInput = document.getElementById('variationCode');
            
            if (!silent) showLoading();
            try {
                // ================== THIS IS THE CHANGED LINE ==================
                // Calls /api/projects?action=... instead of /api/projects/generate-variation-code?...
                const response = await apiCall(`projects?action=generate-variation-code&parentId=${parentId}`);
                // =============================================================
                
                if (response.success && response.data.variationCode) {
                    variationInput.value = response.data.variationCode;
                } else {
                    // Fallback: just append -V1 (a real app would check existing)
                    variationInput.value = `${parentCode}-V1`;
                }
            } catch (error) {
                console.warn('Backend variation code generator failed, using fallback:', error.message);
                // Fallback: just append -V1
                variationInput.value = `${parentCode}-V1`;
            } finally {
                if (!silent) hideLoading();
            }
        }

        // --- Variation document file helpers ---
        function onVariationDocSelected(input) {
            if (input.files && input.files[0]) {
                showVariationDocPreview(input.files[0]);
            }
        }

        function handleVariationDocDrop(event) {
            event.preventDefault();
            document.getElementById('variationDocDropZone').style.borderColor = 'var(--border-color)';
            const file = event.dataTransfer.files[0];
            if (!file) return;
            const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            if (!allowed.includes(file.type)) {
                alert('Only PDF and Word documents (.pdf, .doc, .docx) are allowed.');
                return;
            }
            // Transfer to the file input
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            document.getElementById('variationDocument').files = dataTransfer.files;
            showVariationDocPreview(file);
        }

        function showVariationDocPreview(file) {
            const preview = document.getElementById('variationDocPreview');
            document.getElementById('variationDocFileName').textContent = file.name;
            document.getElementById('variationDocFileSize').textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
            preview.style.display = 'flex';
        }

        function clearVariationDoc() {
            document.getElementById('variationDocument').value = '';
            document.getElementById('variationDocPreview').style.display = 'none';
        }

        /**
         * Submits the new variation to the backend for COO approval.
         * Uses FormData to support optional document file upload.
         */
        async function submitVariationForApproval() {
            const parentProjectId = document.getElementById('variationParentProjectId').value;
            const variationCode = document.getElementById('variationCode').value;
            const estimatedHours = parseFloat(document.getElementById('variationHours').value);
            const scopeDescription = document.getElementById('variationScope').value;
            const clientName = document.getElementById('variationClientName').value.trim();
            const clientEmail = document.getElementById('variationClientEmail').value.trim();
            const amount = document.getElementById('variationAmount').value;
            const currency = document.getElementById('variationCurrency').value;
            const accountsDetails = document.getElementById('variationAccountsDetails').value.trim();
            const docFile = document.getElementById('variationDocument').files[0];

            // --- Validation ---
            if (!variationCode) {
                alert('Please enter or generate a Variation Code.');
                return;
            }
            if (!estimatedHours || estimatedHours <= 0) {
                alert('Please enter valid Variation Hours (must be > 0).');
                return;
            }
            if (!scopeDescription || scopeDescription.trim().length < 10) {
                alert('Please provide a detailed Scope of Work (at least 10 characters).');
                return;
            }

            if (!confirm('This will submit the variation to the COO for approval. Continue?')) {
                return;
            }

            try {
                showLoading();

                // Build FormData to support optional file upload
                const formData = new FormData();
                formData.append('parentProjectId', parentProjectId);
                formData.append('variationCode', variationCode);
                formData.append('estimatedHours', estimatedHours);
                formData.append('scopeDescription', scopeDescription);
                if (clientName) formData.append('clientName', clientName);
                if (clientEmail) formData.append('clientEmail', clientEmail);
                if (amount) formData.append('amount', amount);
                if (currency) formData.append('currency', currency);
                if (accountsDetails) formData.append('accountsDetails', accountsDetails);
                if (docFile) formData.append('variationDocument', docFile);

                // Use fetch directly (not apiCall) because we're sending FormData
                const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
                const apiBase = window.API_BASE_URL || 'https://eb-backend-4xu3.onrender.com/api/';
                const url = apiBase.endsWith('/') ? apiBase + 'variations' : apiBase + '/variations';

                const fetchResponse = await fetch(url, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });
                const response = await fetchResponse.json();

                if (response.success) {
                    closeAddVariationModal();
                    showSuccessModal(
                        'Variation Submitted!',
                        `Your request for variation "${variationCode}" has been sent to the COO for approval.`
                    );
                    triggerEmailNotification('variation.request', {
                        projectId: parentProjectId,
                        variationCode: variationCode,
                        hours: estimatedHours,
                        projectName: document.getElementById('variationParentProjectName')?.textContent || 'Project'
                    });
                } else {
                    throw new Error(response.error || 'Failed to submit variation. Please check if the variation code is unique.');
                }

            } catch (error) {
                console.error('Error submitting variation:', error);
                alert(`Error: ${error.message}`);
            } finally {
                hideLoading();
            }
        }

    // ============================================
        // NEW: COO VARIATION APPROVAL FUNCTIONS
        // ============================================

        /**
         * Renders the table for pending variations.
         */
        function renderPendingVariationsTable(variations) {
            if (!variations || variations.length === 0) {
                return '<div class="card" style="padding: 2rem; text-align: center; color: var(--text-light);">No pending variations found.</div>';
            }

            const variationsHtml = variations.map(v => `
                <tr>
                    <td><strong>${v.parentProjectName || 'Unknown'}</strong><br><small>${v.clientCompany || ''}</small></td>
                    <td><span class="project-number-badge" style="background: var(--warning); color: #856404;">${v.variationCode || 'N/A'}</span></td>
                    <td><strong>${v.estimatedHours || 0}h</strong></td>
                    <td>${v.amount ? `<strong>${v.currency || ''} ${Number(v.amount).toLocaleString('en-AU', {minimumFractionDigits: 2})}</strong>` : '<span style="color:var(--text-light);">—</span>'}</td>
                    <td>${v.createdByName || 'Unknown'}<br><small>(${(v.createdByRole || '').replace('_', ' ')})</small></td>
                    <td>${formatDate(v.createdAt)}</td>
                    <td style="white-space: nowrap;">
                        ${v.documentUrl ? `<a href="${v.documentUrl}" target="_blank" class="btn btn-outline btn-sm" style="margin-right: 4px;" title="View Document">📄</a>` : ''}
                        <button class="btn btn-primary btn-sm" onclick="showVariationApprovalModal('${v.id}')">
                            Review
                        </button>
                    </td>
                </tr>
            `).join('');

            return `
                <div class="card">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Parent Project</th>
                                <th>Variation Code</th>
                                <th>Hours</th>
                                <th>Amount</th>
                                <th>Submitted By</th>
                                <th>Date Submitted</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${variationsHtml}
                        </tbody>
                    </table>
                </div>
            `;
        }

        /**
         * Fetches variation details and shows the approval modal (COO portal).
         */
        async function showVariationApprovalModal(variationId) {
            try {
                showLoading();
                const response = await apiCall(`variations?id=${variationId}`);

                if (!response.success || !response.data) {
                    throw new Error(response.error || 'Failed to fetch variation details.');
                }

                const v = response.data;

                // Core fields
                document.getElementById('approvalVariationId').value = v.id;
                document.getElementById('approvalParentProjectId').value = v.parentProjectId;
                document.getElementById('app-parentProjectName').textContent = v.parentProjectName || '—';
                document.getElementById('app-clientCompany').textContent = v.clientCompany || '—';
                document.getElementById('app-variationCode').textContent = v.variationCode || '—';
                document.getElementById('app-estimatedHours').textContent = `${v.estimatedHours}h`;
                document.getElementById('app-submittedBy').textContent = `${v.createdByName} (${(v.createdByRole || '').replace('_', ' ')})`;
                document.getElementById('app-scopeDescription').textContent = v.scopeDescription || '—';
                document.getElementById('approvalNotes').value = '';

                // Client details section
                const clientSection = document.getElementById('app-clientDetailsSection');
                const clientNameRow = document.getElementById('app-clientNameRow');
                const clientEmailRow = document.getElementById('app-clientEmailRow');
                if (v.clientName || v.clientEmail) {
                    clientSection.style.display = '';
                    if (v.clientName) {
                        document.getElementById('app-clientName').textContent = v.clientName;
                        clientNameRow.style.display = '';
                    } else { clientNameRow.style.display = 'none'; }
                    if (v.clientEmail) {
                        document.getElementById('app-clientEmail').textContent = v.clientEmail;
                        clientEmailRow.style.display = '';
                    } else { clientEmailRow.style.display = 'none'; }
                } else {
                    clientSection.style.display = 'none';
                }

                // Financial details section
                const financialSection = document.getElementById('app-financialSection');
                if (v.amount || v.currency) {
                    financialSection.style.display = '';
                    document.getElementById('app-amount').textContent = v.amount ? Number(v.amount).toLocaleString('en-AU', { minimumFractionDigits: 2 }) : '—';
                    document.getElementById('app-currency').textContent = v.currency || '—';
                } else {
                    financialSection.style.display = 'none';
                }

                // Accounts details section
                const accountsSection = document.getElementById('app-accountsSection');
                if (v.accountsDetails) {
                    accountsSection.style.display = '';
                    document.getElementById('app-accountsDetails').textContent = v.accountsDetails;
                } else {
                    accountsSection.style.display = 'none';
                }

                // Document section
                const docSection = document.getElementById('app-documentSection');
                if (v.documentUrl) {
                    docSection.style.display = '';
                    document.getElementById('app-documentName').textContent = v.documentOriginalName || 'Variation Document';
                    document.getElementById('app-documentLink').href = v.documentUrl;
                } else {
                    docSection.style.display = 'none';
                }

                // Show the modal
                document.getElementById('variationApprovalModal').style.display = 'flex';

            } catch (error) {
                alert(`Error: ${error.message}`);
            } finally {
                hideLoading();
            }
        }

        /**
         * Submits the COO's decision (approve/reject) to the backend.
         */
        async function submitVariationApproval(decision) {
            const variationId = document.getElementById('approvalVariationId').value;
            const parentProjectId = document.getElementById('approvalParentProjectId').value;
            const notes = document.getElementById('approvalNotes').value.trim();
            const hours = parseFloat(document.getElementById('app-estimatedHours').textContent) || 0;

            if (decision === 'rejected' && !notes) {
                alert('A reason is required for rejection.');
                document.getElementById('approvalNotes').focus();
                return;
            }

            const confirmMsg = decision === 'approved'
                ? `Approve this variation? This will add ${hours}h to the project's budget.`
                : 'Reject this variation? This will notify the Design Manager.';

            if (!confirm(confirmMsg)) {
                return;
            }

            try {
                showLoading();
                
                const response = await apiCall(`variations?id=${variationId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'review_variation',
                        data: {
                            status: decision, // 'approved' or 'rejected'
                            notes: notes,
                            parentProjectId: parentProjectId,
                            approvedHours: hours
                        }
                    })
                });

                if (response.success) {
                    closeModal();
                    
                    // 1. Show success message
                    const actionText = decision === 'approved' ? 'Approved' : 'Rejected';
                    showSuccessModal(
                        `Variation ${actionText}`, 
                        `The variation request has been successfully ${actionText.toLowerCase()}.`
                    );

                    // 2. Trigger email notifications
                    if (decision === 'approved') {
                        await triggerEmailNotification('variation.approved', { 
                            variationId: variationId,
                            projectId: parentProjectId,
                            hours: hours
                        });
                    } else {
                        await triggerEmailNotification('variation.rejected', { 
                            variationId: variationId, 
                            projectId: parentProjectId,
                            reason: notes 
                        });
                    }

                    // 3. Refresh view
                    await showAllProjects();
                    
                } else {
                    throw new Error(response.error || 'Failed to process variation.');
                }

            } catch (error) {
                console.error('Variation approval error:', error);
                alert(`Error: ${error.message}`);
            } finally {
                hideLoading();
            }
        }
 

function calculateTotalHours() {
    const designHours = parseFloat(document.getElementById('designHours')?.value) || 0;
    const detailingHours = parseFloat(document.getElementById('detailingHours')?.value) || 0;
    const checkingHours = parseFloat(document.getElementById('checkingHours')?.value) || 0;
    const revisionHours = parseFloat(document.getElementById('revisionHours')?.value) || 0;
    const pmHours = parseFloat(document.getElementById('pmHours')?.value) || 0;
    
    const total = designHours + detailingHours + checkingHours + revisionHours + pmHours;
    
    const totalHoursInput = document.getElementById('totalHours');
    if (totalHoursInput) {
        totalHoursInput.value = total.toFixed(1);
        
        // ✅ CRITICAL FIX: Total Hours should NEVER be readonly for estimator
        // Remove any readonly attribute that might have been set
        totalHoursInput.removeAttribute('readonly');
        totalHoursInput.disabled = false;
        
        // Allow manual override of total hours
        totalHoursInput.style.backgroundColor = '#ffffff';
        totalHoursInput.style.cursor = 'text';
    }
    
    // ✅ CRITICAL FIX: Ensure all hour fields are editable
    const hourFields = [
        'designHours', 'detailingHours', 'checkingHours', 
        'revisionHours', 'pmHours'
    ];
    
    hourFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.removeAttribute('readonly');
            field.disabled = false;
            field.style.backgroundColor = '#ffffff';
        }
    });
}

/**
 * ✅ FIXED: Handle Tonnage Input
 */
function handleTonnageInput() {
    // ✅ FIXED: Tonnage is now just a reference value, NO auto-calculation
    // Just store the tonnage value, don't calculate design hours
    // Design hours must be entered manually by estimator
}

/**
 * ✅ NEW: Toggle tonnage checkbox (no auto-calculation)
 */
function toggleDesignHours() {
    const useTonnageCheckbox = document.getElementById('useTonnageForDesign');
    
    // This is just a UI checkbox, doesn't affect calculations
    // Tonnage is stored as reference data only
    // All hours must be entered manually by estimator
    
    if (useTonnageCheckbox && useTonnageCheckbox.checked) {
        console.log('✅ Tonnage checkbox enabled - storing tonnage as reference data');
    } else {
        console.log('✅ Tonnage checkbox disabled');
    }
}
  

        function switchDesignerTab(tabName) {
            // Update tab buttons
            document.querySelectorAll('.doc-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            event.target.classList.add('active');
            
            // Update content visibility
            document.getElementById('designer-drawings-content').style.display = 'none';
            document.getElementById('designer-specs-content').style.display = 'none';
            
            if (tabName === 'drawings') {
                document.getElementById('designer-drawings-content').style.display = 'block';
            } else {
                document.getElementById('designer-specs-content').style.display = 'block';
            }
        }
    </script>
<div id="cooMultiDesignerAllocationModal" class="modal" style="display: none;">
    <div class="modal-content new-modal allocation-modal-large" style="max-width: 900px;">
        <div class="modal-header">
            <div>
                <h2>🎯 Allocate Project to Design Lead</h2>
                <div class="subtitle">Assign project to design lead(s) with hours budget</div>
            </div>
            <span class="close-modal" onclick="closeCooMultiDesignerModal()">&times;</span>
        </div>

        <div class="modal-body">
            <input type="hidden" id="cooAllocProjectId" />

            <!-- Project Summary -->
            <div class="allocation-details-section" style="margin-bottom: 2rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; border-radius: 12px;">
                <h3 style="color: white; margin-bottom: 1rem;">📋 Project Information</h3>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                    <div>
                        <label style="font-size: 0.85rem; opacity: 0.9;">Project Number:</label>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <div id="cooAllocProjectNumber" style="font-size: 1.2rem; font-weight: 700;"></div>
                            <button type="button" onclick="toggleProjectNumberEdit()"
                                    style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                                ✏️ Edit
                            </button>
                        </div>
                        <div id="projectNumberEditContainer" style="display: none; margin-top: 0.5rem;">
                            <input type="text" id="projectNumberEditInput"
                                   style="padding: 0.5rem; border-radius: 4px; border: none; width: 150px; font-weight: 600;"
                                   placeholder="Enter project number">
                            <button type="button" onclick="saveProjectNumber()"
                                    style="background: #10b981; border: none; color: white; padding: 0.5rem 0.75rem; border-radius: 4px; cursor: pointer; margin-left: 0.25rem;">
                                💾 Save
                            </button>
                            <button type="button" onclick="cancelProjectNumberEdit()"
                                    style="background: rgba(255,255,255,0.3); border: none; color: white; padding: 0.5rem 0.75rem; border-radius: 4px; cursor: pointer; margin-left: 0.25rem;">
                                ✕
                            </button>
                        </div>
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; opacity: 0.9;">Project Name:</label>
                        <div id="cooAllocProjectName" style="font-size: 1rem; font-weight: 600;"></div>
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; opacity: 0.9;">Client:</label>
                        <div id="cooAllocClientName" style="font-size: 1rem; font-weight: 600;"></div>
                    </div>
                </div>
            </div>

            <!-- Project Section Selection -->
            <div class="form-section" style="background: #fef3c7; padding: 1.5rem; border-radius: 10px; margin-bottom: 2rem; border: 2px solid #f59e0b;">
                <h3 style="color: #92400e; margin: 0 0 1rem 0;">🏗️ Project Section</h3>
                <div class="form-group" style="margin-bottom: 0;">
                    <label for="cooProjectSection">Assign to Section <span class="required">*</span></label>
                    <select id="cooProjectSection" class="form-control" required style="font-weight: 600; font-size: 1rem;">
                        <option value="">-- Select Section --</option>
                        <option value="Engineering">Engineering</option>
                        <option value="Rebar">Rebar</option>
                        <option value="Structural">Structural</option>
                    </select>
                    <small class="form-text">Categorize this project under the appropriate design section</small>
                </div>
            </div>

            <!-- Total Hours Input -->
            <div class="form-section" style="background: #f8f9fa; padding: 1.5rem; border-radius: 10px; margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="color: var(--text-dark); margin: 0;">⏱️ Total Project Hours</h3>
                    <button type="button" id="editBudgetBtn" class="btn btn-outline btn-sm" onclick="toggleBudgetEdit()" style="display: none;">
                        ✏️ Edit Budget
                    </button>
                </div>
                <div class="form-row">
                    <div class="form-group" style="flex: 1;">
                        <label for="cooTotalProjectHours">Total Allocated Hours <span class="required">*</span></label>
                        <input type="number" id="cooTotalProjectHours" class="form-control"
                               placeholder="e.g., 120" min="1" step="0.5"
                               oninput="updateRemainingHours()" required>
                        <small class="form-text">Total hours budget for this project</small>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label>Remaining Hours to Allocate</label>
                        <div id="cooRemainingHours" style="font-size: 2rem; font-weight: 700; color: var(--success); padding: 0.5rem;">
                            0 hrs
                        </div>
                    </div>
                </div>
            </div>

            <!-- EXISTING ALLOCATIONS SECTION -->
            <div id="existingAllocationsSection" class="form-section" style="background: #eff6ff; padding: 1.5rem; border-radius: 10px; margin-bottom: 2rem; display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="color: #1e40af; margin: 0;">📊 Existing Design Lead Allocations</h3>
                    <span id="existingAllocTotal" style="background: #3b82f6; color: white; padding: 0.35rem 1rem; border-radius: 20px; font-weight: 600;"></span>
                </div>
                <div id="existingAllocationsList">
                    <!-- Existing allocations will be rendered here -->
                </div>
            </div>

            <!-- Design Lead Allocations -->
            <div class="form-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="color: var(--text-dark); margin: 0;">👔 Select Design Lead(s)</h3>
                    <button type="button" class="btn btn-outline" onclick="addDesignerAllocation()" id="addDesignLeadBtn">
                        <span style="font-size: 1.2rem;">+</span> Add Design Lead
                    </button>
                </div>
                <div style="background: #e0f2fe; padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid #0284c7;">
                    <small style="color: #0369a1;">You can assign up to <strong>2 design leads</strong> per project. Each lead will manage designers within their allocated hours.</small>
                </div>

                <div id="designerAllocationsContainer">
                    <!-- Design Lead allocation rows will be added here dynamically -->
                </div>
            </div>

            <!-- Purchase Order (P.O.) Section -->
            <div class="form-section" style="margin-top: 2rem; background: #fef9e7; padding: 1.5rem; border-radius: 10px; border: 2px solid #f0c040;">
                <h3 style="color: #7c6a0a; margin-bottom: 0.5rem;">📄 Purchase Order (P.O.)</h3>
                <p style="color: #92400e; font-size: 0.85rem; margin-bottom: 1rem;">Optional: Upload a P.O. PDF and/or enter the P.O. value. Can be added later. Tracking will be sent to Accounts & HR.</p>

                <div class="form-row">
                    <div class="form-group" style="flex: 1;">
                        <label for="cooPoFile">P.O. Document (PDF)</label>
                        <input type="file" id="cooPoFile" class="form-control" accept=".pdf"
                               style="padding: 0.5rem;" onchange="handleCooPoFileSelect(this)">
                        <small class="form-text">Upload purchase order PDF</small>
                        <div id="cooPoFilePreview" style="display: none; margin-top: 0.5rem; padding: 0.5rem; background: #d1fae5; border-radius: 6px; font-size: 0.85rem; color: #065f46;">
                        </div>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label for="cooPoNumber">P.O. Number</label>
                        <input type="text" id="cooPoNumber" class="form-control" placeholder="e.g., PO-2026-001">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group" style="flex: 1;">
                        <label for="cooPoValue">P.O. Value / Amount</label>
                        <input type="number" id="cooPoValue" class="form-control" placeholder="e.g., 50000" min="0" step="0.01">
                        <small class="form-text">Enter the purchase order amount</small>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label for="cooPoCurrency">Currency <span class="required">*</span></label>
                        <select id="cooPoCurrency" class="form-control" style="font-weight: 600;">
                            <option value="USD">USD - US Dollar</option>
                            <option value="AUD">AUD - Australian Dollar</option>
                            <option value="GBP">GBP - British Pound</option>
                            <option value="CAD">CAD - Canadian Dollar</option>
                        </select>
                        <small class="form-text">Select the P.O. currency</small>
                    </div>
                </div>
            </div>

            <!-- Technical & Commercial Contacts Section -->
            <div class="form-section" style="margin-top: 2rem; background: #eef2ff; padding: 1.5rem; border-radius: 10px; border: 2px solid #818cf8;">
                <h3 style="color: #3730a3; margin-bottom: 0.5rem;">📇 Project Contacts</h3>
                <p style="color: #4338ca; font-size: 0.85rem; margin-bottom: 1.5rem;">Optional: Enter technical and commercial contact details. Can be added later. Tracking will be sent to Document Control & Accounts.</p>

                <!-- Technical Contact -->
                <div style="background: #f0fdf4; padding: 1.25rem; border-radius: 8px; margin-bottom: 1.25rem; border-left: 4px solid #22c55e;">
                    <h4 style="color: #166534; margin: 0 0 1rem 0; font-size: 1rem;">Technical Contact</h4>
                    <div class="form-row">
                        <div class="form-group" style="flex: 1;">
                            <label for="cooTechBdmName">BDM Name</label>
                            <input type="text" id="cooTechBdmName" class="form-control" placeholder="Enter BDM name">
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label for="cooTechBdmEmail">BDM Email</label>
                            <input type="email" id="cooTechBdmEmail" class="form-control" placeholder="bdm@example.com">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group" style="flex: 1;">
                            <label for="cooTechClientPmName">Client PM Name</label>
                            <input type="text" id="cooTechClientPmName" class="form-control" placeholder="Enter Client PM name">
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label for="cooTechClientPmEmail">Client PM Email</label>
                            <input type="email" id="cooTechClientPmEmail" class="form-control" placeholder="clientpm@example.com">
                        </div>
                    </div>
                </div>

                <!-- Commercial Contact -->
                <div style="background: #fefce8; padding: 1.25rem; border-radius: 8px; border-left: 4px solid #eab308;">
                    <h4 style="color: #854d0e; margin: 0 0 1rem 0; font-size: 1rem;">Commercial Contact</h4>
                    <div class="form-row">
                        <div class="form-group" style="flex: 1;">
                            <label for="cooCommAccountName">Their Account Contact Name</label>
                            <input type="text" id="cooCommAccountName" class="form-control" placeholder="Enter account contact name">
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label for="cooCommAccountEmail">Their Account Contact Email</label>
                            <input type="email" id="cooCommAccountEmail" class="form-control" placeholder="account@example.com">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group" style="flex: 1;">
                            <label for="cooCommBdmName">BDM Name</label>
                            <input type="text" id="cooCommBdmName" class="form-control" placeholder="Enter BDM name">
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label for="cooCommBdmEmail">BDM Email</label>
                            <input type="email" id="cooCommBdmEmail" class="form-control" placeholder="bdm@example.com">
                        </div>
                    </div>
                </div>
            </div>

            <!-- Project Details -->
            <div class="form-section" style="margin-top: 2rem;">
                <h3 style="color: var(--text-dark); margin-bottom: 1rem;">📝 Project Details</h3>

                <div class="form-row">
                    <div class="form-group" style="flex: 1;">
                        <label for="cooTargetCompletionDate">Target Completion Date</label>
                        <input type="date" id="cooTargetCompletionDate" class="form-control">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label for="cooProjectPriority">Project Priority</label>
                        <select id="cooProjectPriority" class="form-control">
                            <option value="Normal">Normal</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label for="cooAllocationNotes">Allocation Notes</label>
                    <textarea id="cooAllocationNotes" class="form-control" rows="3"
                              placeholder="Add any special instructions or notes for the design lead..."></textarea>
                </div>
            </div>
        </div>

        <div class="modal-footer">
            <button type="button" class="btn btn-cancel" onclick="closeCooMultiDesignerModal()">Cancel</button>
            <button type="button" class="btn btn-success btn-large" onclick="submitCooMultiDesignerAllocation()">
                <span class="btn-icon">✓</span> Allocate Project
            </button>
        </div>
    </div>
</div>
<!-- ============================================ -->
<!-- Edit P.O. & Contacts Modal                  -->
<!-- ============================================ -->
<div id="editPoContactsModal" class="modal" style="display: none;">
    <div class="modal-content new-modal" style="max-width: 850px;">
        <div class="modal-header">
            <div>
                <h2>📝 Edit P.O. & Project Contacts</h2>
                <div class="subtitle">Update purchase order and contact details for this project</div>
            </div>
            <span class="close-modal" onclick="closeEditPoContactsModal()">&times;</span>
        </div>

        <div class="modal-body">
            <input type="hidden" id="editPocProjectId" />

            <!-- Project Info Banner -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.25rem; border-radius: 12px; margin-bottom: 1.5rem;">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                    <div>
                        <label style="font-size: 0.8rem; opacity: 0.9;">Project Number:</label>
                        <div id="editPocProjectNumber" style="font-weight: 700;"></div>
                    </div>
                    <div>
                        <label style="font-size: 0.8rem; opacity: 0.9;">Project Name:</label>
                        <div id="editPocProjectName" style="font-weight: 600;"></div>
                    </div>
                    <div>
                        <label style="font-size: 0.8rem; opacity: 0.9;">Client:</label>
                        <div id="editPocClientName" style="font-weight: 600;"></div>
                    </div>
                </div>
            </div>

            <!-- P.O. Section -->
            <div class="form-section" style="background: #fef9e7; padding: 1.5rem; border-radius: 10px; border: 2px solid #f0c040; margin-bottom: 1.5rem;">
                <h3 style="color: #7c6a0a; margin-bottom: 1rem;">📄 Purchase Order (P.O.)</h3>
                <div class="form-row">
                    <div class="form-group" style="flex: 1;">
                        <label for="editPoFile">P.O. Document (PDF)</label>
                        <input type="file" id="editPoFile" class="form-control" accept=".pdf"
                               style="padding: 0.5rem;" onchange="handleCooPoFileSelect(this, 'editPoFilePreview')">
                        <div id="editPoFilePreview" style="display: none; margin-top: 0.5rem; padding: 0.5rem; background: #d1fae5; border-radius: 6px; font-size: 0.85rem; color: #065f46;"></div>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label for="editPoNumber">P.O. Number</label>
                        <input type="text" id="editPoNumber" class="form-control" placeholder="e.g., PO-2026-001">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group" style="flex: 1;">
                        <label for="editPoValue">P.O. Value / Amount</label>
                        <input type="number" id="editPoValue" class="form-control" placeholder="e.g., 50000" min="0" step="0.01">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label for="editPoCurrency">Currency</label>
                        <select id="editPoCurrency" class="form-control" style="font-weight: 600;">
                            <option value="USD">USD - US Dollar</option>
                            <option value="AUD">AUD - Australian Dollar</option>
                            <option value="GBP">GBP - British Pound</option>
                            <option value="CAD">CAD - Canadian Dollar</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Technical Contact -->
            <div class="form-section" style="background: #eef2ff; padding: 1.5rem; border-radius: 10px; border: 2px solid #818cf8; margin-bottom: 1.5rem;">
                <h3 style="color: #3730a3; margin-bottom: 1rem;">📇 Project Contacts</h3>

                <div style="background: #f0fdf4; padding: 1.25rem; border-radius: 8px; margin-bottom: 1.25rem; border-left: 4px solid #22c55e;">
                    <h4 style="color: #166534; margin: 0 0 1rem 0; font-size: 1rem;">Technical Contact</h4>
                    <div class="form-row">
                        <div class="form-group" style="flex: 1;">
                            <label for="editTechBdmName">BDM Name</label>
                            <input type="text" id="editTechBdmName" class="form-control" placeholder="Enter BDM name">
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label for="editTechBdmEmail">BDM Email</label>
                            <input type="email" id="editTechBdmEmail" class="form-control" placeholder="bdm@example.com">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group" style="flex: 1;">
                            <label for="editTechClientPmName">Client PM Name</label>
                            <input type="text" id="editTechClientPmName" class="form-control" placeholder="Enter Client PM name">
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label for="editTechClientPmEmail">Client PM Email</label>
                            <input type="email" id="editTechClientPmEmail" class="form-control" placeholder="clientpm@example.com">
                        </div>
                    </div>
                </div>

                <!-- Commercial Contact -->
                <div style="background: #fefce8; padding: 1.25rem; border-radius: 8px; border-left: 4px solid #eab308;">
                    <h4 style="color: #854d0e; margin: 0 0 1rem 0; font-size: 1rem;">Commercial Contact</h4>
                    <div class="form-row">
                        <div class="form-group" style="flex: 1;">
                            <label for="editCommAccountName">Their Account Contact Name</label>
                            <input type="text" id="editCommAccountName" class="form-control" placeholder="Enter account contact name">
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label for="editCommAccountEmail">Their Account Contact Email</label>
                            <input type="email" id="editCommAccountEmail" class="form-control" placeholder="account@example.com">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group" style="flex: 1;">
                            <label for="editCommBdmName">BDM Name</label>
                            <input type="text" id="editCommBdmName" class="form-control" placeholder="Enter BDM name">
                        </div>
                        <div class="form-group" style="flex: 1;">
                            <label for="editCommBdmEmail">BDM Email</label>
                            <input type="email" id="editCommBdmEmail" class="form-control" placeholder="bdm@example.com">
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="modal-footer">
            <button type="button" class="btn btn-cancel" onclick="closeEditPoContactsModal()">Cancel</button>
            <button type="button" class="btn btn-success btn-large" onclick="submitEditPoContacts()">
                <span class="btn-icon">💾</span> Save P.O. & Contacts
            </button>
        </div>
    </div>
</div>

 <input type="file" id="wordTemplateInput" accept=".docx" style="display: none;" />
    <!-- LOAD THE SEPARATE QUOTATION GENERATOR FILE -->
    <script src="quotation_generator.js"></script>

<!-- ============================================ -->
<!-- FEATURE 1: COO → Director Approval Modal    -->
<!-- ============================================ -->
<div id="cooRequestAllocationChangeModal" class="modal" style="display: none;">
    <div class="modal-content new-modal" style="max-width: 600px;">
        <div class="modal-header">
            <div>
                <h2>📝 Request Allocation Change</h2>
                <div class="subtitle">Submit change request to Director for approval</div>
            </div>
            <span class="close-modal" onclick="closeRequestAllocationChangeModal()">&times;</span>
        </div>
        
        <div class="modal-body">
            <input type="hidden" id="changeReqProjectId" />
            <input type="hidden" id="changeReqDesignerUid" />
            <input type="hidden" id="changeReqDesignerEmail" />
            
            <!-- Project & Designer Info -->
            <div class="form-section" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                        <label style="font-size: 0.85rem; opacity: 0.9;">Project:</label>
                        <div id="changeReqProjectName" style="font-size: 1.1rem; font-weight: 600;"></div>
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; opacity: 0.9;">Designer:</label>
                        <div id="changeReqDesignerName" style="font-size: 1.1rem; font-weight: 600;"></div>
                    </div>
                </div>
            </div>
            
            <!-- Hours Input -->
            <div class="form-section">
                <div class="form-row">
                    <div class="form-group" style="flex: 1;">
                        <label>Current Allocated Hours</label>
                        <input type="number" id="changeReqCurrentHours" class="form-control" readonly 
                               style="background: #f3f4f6; font-weight: 600;">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label>New Requested Hours <span class="required">*</span></label>
                        <input type="number" id="changeReqNewHours" class="form-control" 
                               placeholder="Enter new hours" min="0" step="0.5" required
                               oninput="calculateHoursDifference()">
                    </div>
                </div>
                
                <div id="hoursDifferenceDisplay" style="text-align: center; padding: 1rem; margin: 1rem 0; border-radius: 8px; display: none;">
                    <!-- Will show increase/decrease amount -->
                </div>
            </div>
            
            <!-- Mandatory Reason -->
            <div class="form-section">
                <div class="form-group">
                    <label>Reason for Change <span class="required">*</span></label>
                    <textarea id="changeReqReason" class="form-control" rows="4" 
                              placeholder="Please provide a detailed reason for this allocation change request. This is mandatory for Director review."
                              required></textarea>
                    <small class="form-text" style="color: var(--danger);">⚠️ This field is mandatory</small>
                </div>
            </div>
        </div>
        
        <div class="modal-footer">
            <button type="button" class="btn btn-cancel" onclick="closeRequestAllocationChangeModal()">Cancel</button>
            <button type="button" class="btn btn-primary btn-large" onclick="submitAllocationChangeRequest()">
                <span class="btn-icon">📤</span> Submit to Director
            </button>
        </div>
    </div>
</div>

<!-- ============================================ -->
<!-- FEATURE 1: Director Approval Queue Modal    -->
<!-- ============================================ -->
<div id="directorAllocationRequestsModal" class="modal" style="display: none;">
    <div class="modal-content new-modal allocation-modal-large" style="max-width: 1000px; max-height: 90vh;">
        <div class="modal-header">
            <div>
                <h2>📋 Allocation Change Requests</h2>
                <div class="subtitle">Review and approve/reject COO allocation change requests</div>
            </div>
            <span class="close-modal" onclick="closeDirectorAllocationRequestsModal()">&times;</span>
        </div>
        
        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
            <div id="allocationRequestsList">
                <!-- Requests will be loaded here -->
                <div style="text-align: center; padding: 3rem; color: var(--text-light);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⏳</div>
                    <p>Loading requests...</p>
                </div>
            </div>
        </div>
        
        <div class="modal-footer">
            <button type="button" class="btn btn-outline" onclick="closeDirectorAllocationRequestsModal()">Close</button>
            <button type="button" class="btn btn-primary" onclick="loadAllocationRequests()">
                🔄 Refresh
            </button>
        </div>
    </div>
</div>

<!-- ============================================ -->
<!-- FEATURE 1: Director Review Single Request   -->
<!-- ============================================ -->
<div id="directorReviewRequestModal" class="modal" style="display: none;">
    <div class="modal-content new-modal" style="max-width: 650px;">
        <div class="modal-header">
            <div>
                <h2>🔍 Review Allocation Request</h2>
                <div class="subtitle">Approve or reject this change request</div>
            </div>
            <span class="close-modal" onclick="closeDirectorReviewModal()">&times;</span>
        </div>
        
        <div class="modal-body">
            <input type="hidden" id="reviewRequestId" />
            
            <!-- Request Details -->
            <div class="form-section" style="background: #f8f9fa; padding: 1.5rem; border-radius: 10px; margin-bottom: 1.5rem;">
                <h4 style="margin-bottom: 1rem; color: var(--text-dark);">📋 Request Details</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                        <label style="font-size: 0.85rem; color: var(--text-light);">Project:</label>
                        <div id="reviewProjectName" style="font-weight: 600;"></div>
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; color: var(--text-light);">Designer:</label>
                        <div id="reviewDesignerName" style="font-weight: 600;"></div>
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; color: var(--text-light);">Requested By:</label>
                        <div id="reviewRequestedBy" style="font-weight: 600;"></div>
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; color: var(--text-light);">Request Date:</label>
                        <div id="reviewRequestDate" style="font-weight: 600;"></div>
                    </div>
                </div>
            </div>
            
            <!-- Hours Change -->
            <div class="form-section" style="background: linear-gradient(135deg, #fef3c7, #fde68a); padding: 1.5rem; border-radius: 10px; margin-bottom: 1.5rem;">
                <h4 style="margin-bottom: 1rem; color: #92400e;">⏱️ Hours Change</h4>
                <div style="display: flex; align-items: center; justify-content: space-around;">
                    <div style="text-align: center;">
                        <div style="font-size: 0.85rem; color: #92400e;">Current</div>
                        <div id="reviewCurrentHours" style="font-size: 2rem; font-weight: 700; color: #b45309;"></div>
                    </div>
                    <div style="font-size: 2rem; color: #92400e;">→</div>
                    <div style="text-align: center;">
                        <div style="font-size: 0.85rem; color: #92400e;">Requested</div>
                        <div id="reviewRequestedHours" style="font-size: 2rem; font-weight: 700; color: #b45309;"></div>
                    </div>
                    <div id="reviewHoursDiff" style="text-align: center; padding: 0.5rem 1rem; border-radius: 8px;"></div>
                </div>
            </div>
            
            <!-- COO Reason -->
            <div class="form-section" style="background: #eff6ff; padding: 1.5rem; border-radius: 10px; margin-bottom: 1.5rem;">
                <h4 style="margin-bottom: 0.5rem; color: #1e40af;">💬 COO's Reason</h4>
                <div id="reviewCooReason" style="font-style: italic; color: #1e3a8a;"></div>
            </div>
            
            <!-- Director's Decision -->
            <div class="form-section">
                <h4 style="margin-bottom: 1rem; color: var(--text-dark);">✍️ Your Decision</h4>
                
                <div class="form-group">
                    <label>Final Approved Hours (you can adjust)</label>
                    <input type="number" id="reviewFinalHours" class="form-control" 
                           min="0" step="0.5" placeholder="Leave blank to use requested hours">
                    <small class="form-text">Leave blank to approve the requested hours as-is</small>
                </div>
                
                <div class="form-group">
                    <label>Comment (optional for approval, required for rejection)</label>
                    <textarea id="reviewDirectorComment" class="form-control" rows="3" 
                              placeholder="Add your comments..."></textarea>
                </div>
            </div>
        </div>
        
        <div class="modal-footer">
            <button type="button" class="btn btn-cancel" onclick="closeDirectorReviewModal()">Cancel</button>
            <button type="button" class="btn btn-danger" onclick="rejectAllocationRequest()">
                ❌ Reject
            </button>
            <button type="button" class="btn btn-success btn-large" onclick="approveAllocationRequest()">
                ✅ Approve
            </button>
        </div>
    </div>
</div>

<!-- ============================================ -->
<!-- FEATURE 2: COO Direct Edit Allocation Modal -->
<!-- ============================================ -->
<div id="cooEditAllocationModal" class="modal" style="display: none;">
    <div class="modal-content new-modal" style="max-width: 800px;">
        <div class="modal-header">
            <div>
                <h2>✏️ Edit Designer Allocations</h2>
                <div class="subtitle">Directly adjust hours for assigned designers</div>
            </div>
            <span class="close-modal" onclick="closeCooEditAllocationModal()">&times;</span>
        </div>
        
        <div class="modal-body">
            <input type="hidden" id="editAllocProjectId" />
            
            <!-- Project Summary -->
            <div class="form-section" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
                    <div>
                        <label style="font-size: 0.85rem; opacity: 0.9;">Project:</label>
                        <div id="editAllocProjectName" style="font-size: 1rem; font-weight: 600;"></div>
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; opacity: 0.9;">Max Budget:</label>
                        <div id="editAllocMaxBudget" style="font-size: 1.2rem; font-weight: 700;"></div>
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; opacity: 0.9;">Currently Allocated:</label>
                        <div id="editAllocCurrentTotal" style="font-size: 1.2rem; font-weight: 700;"></div>
                    </div>
                    <div>
                        <label style="font-size: 0.85rem; opacity: 0.9;">Remaining:</label>
                        <div id="editAllocRemaining" style="font-size: 1.2rem; font-weight: 700;"></div>
                    </div>
                </div>
            </div>
            
            <!-- Designer List -->
            <div class="form-section">
                <h4 style="margin-bottom: 1rem; color: var(--text-dark);">👥 Assigned Designers</h4>
                <div id="editAllocDesignerList">
                    <!-- Designer rows will be loaded here -->
                    <div style="text-align: center; padding: 2rem; color: var(--text-light);">
                        Loading designers...
                    </div>
                </div>
            </div>
            
            <!-- Request Change Option -->
            <div class="form-section" style="background: #fef3c7; padding: 1rem; border-radius: 8px; margin-top: 1rem;">
                <p style="margin: 0; color: #92400e; font-size: 0.9rem;">
                    <strong>💡 Note:</strong> For changes beyond budget limits, use "Request Change" to submit for Director approval.
                </p>
            </div>
        </div>
        
        <div class="modal-footer">
            <button type="button" class="btn btn-danger"
                    onclick="clearProjectAllocation(document.getElementById('editAllocProjectId').value, document.getElementById('editAllocProjectName').textContent)"
                    title="Remove the Design Lead and all designer allocations">
                🗑️ Delete Full Allocation
            </button>
            <button type="button" class="btn btn-cancel" onclick="closeCooEditAllocationModal()">Close</button>
        </div>
    </div>
</div>

<script>
// ============================================
// FEATURE 1 & 2: ALLOCATION CHANGE MANAGEMENT
// ============================================

// ============================================
// FEATURE 1: COO Request Allocation Change
// ============================================

/**
 * Show the request allocation change modal (COO)
 */
function showRequestAllocationChangeModal(projectId, designerUid, designerName, designerEmail, currentHours) {
    document.getElementById('changeReqProjectId').value = projectId;
    document.getElementById('changeReqDesignerUid').value = designerUid;
    document.getElementById('changeReqDesignerEmail').value = designerEmail || '';
    document.getElementById('changeReqDesignerName').textContent = designerName;
    document.getElementById('changeReqCurrentHours').value = currentHours;
    document.getElementById('changeReqNewHours').value = '';
    document.getElementById('changeReqReason').value = '';
    document.getElementById('hoursDifferenceDisplay').style.display = 'none';
    
    // Get project name
    apiCall(`projects?id=${projectId}`).then(response => {
        if (response.success && response.data) {
            document.getElementById('changeReqProjectName').textContent = response.data.projectName || 'Unknown Project';
        }
    });
    
    document.getElementById('cooRequestAllocationChangeModal').style.display = 'flex';
}

function closeRequestAllocationChangeModal() {
    document.getElementById('cooRequestAllocationChangeModal').style.display = 'none';
}

function calculateHoursDifference() {
    const currentHours = parseFloat(document.getElementById('changeReqCurrentHours').value) || 0;
    const newHours = parseFloat(document.getElementById('changeReqNewHours').value) || 0;
    const diff = newHours - currentHours;
    
    const display = document.getElementById('hoursDifferenceDisplay');
    
    if (newHours > 0) {
        display.style.display = 'block';
        if (diff > 0) {
            display.style.background = '#d1fae5';
            display.style.color = '#065f46';
            display.innerHTML = `<strong>📈 Increase:</strong> +${diff.toFixed(1)} hours`;
        } else if (diff < 0) {
            display.style.background = '#fee2e2';
            display.style.color = '#991b1b';
            display.innerHTML = `<strong>📉 Decrease:</strong> ${diff.toFixed(1)} hours`;
        } else {
            display.style.background = '#f3f4f6';
            display.style.color = '#6b7280';
            display.innerHTML = `<strong>➖ No Change</strong>`;
        }
    } else {
        display.style.display = 'none';
    }
}

/**
 * Submit allocation change request to Director
 */
async function submitAllocationChangeRequest() {
    const projectId = document.getElementById('changeReqProjectId').value;
    const designerUid = document.getElementById('changeReqDesignerUid').value;
    const designerName = document.getElementById('changeReqDesignerName').textContent;
    const designerEmail = document.getElementById('changeReqDesignerEmail').value;
    const currentHours = parseFloat(document.getElementById('changeReqCurrentHours').value) || 0;
    const newHours = parseFloat(document.getElementById('changeReqNewHours').value);
    const reason = document.getElementById('changeReqReason').value.trim();
    
    // Validation
    if (!newHours || newHours < 0) {
        alert('⚠️ Please enter valid new hours');
        return;
    }
    
    if (!reason) {
        alert('⚠️ Reason is mandatory for allocation change requests');
        document.getElementById('changeReqReason').focus();
        return;
    }
    
    if (newHours === currentHours) {
        alert('⚠️ New hours must be different from current hours');
        return;
    }
    
    const confirmMsg = `
Submit Allocation Change Request?

Designer: ${designerName}
Current Hours: ${currentHours}h
Requested Hours: ${newHours}h
Change: ${(newHours - currentHours) >= 0 ? '+' : ''}${(newHours - currentHours).toFixed(1)}h

This will be sent to Director for approval.`;
    
    if (!confirm(confirmMsg)) return;
    
    try {
        showLoading();
        
        const response = await apiCall('allocation-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId,
                designerUid,
                designerName,
                designerEmail,
                currentAllocatedHours: currentHours,
                requestedNewHours: newHours,
                reason
            })
        });
        
        if (response.success) {
            alert('✅ Allocation change request submitted to Director for approval!');
            closeRequestAllocationChangeModal();
        } else {
            throw new Error(response.error || 'Failed to submit request');
        }
    } catch (error) {
        console.error('Error submitting request:', error);
        alert('❌ Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

// ============================================
// FEATURE 1: Director Approval Queue
// ============================================

/**
 * Show Director's allocation requests queue
 */
async function showDirectorAllocationRequests() {
    document.getElementById('directorAllocationRequestsModal').style.display = 'flex';
    await loadAllocationRequests();
}

function closeDirectorAllocationRequestsModal() {
    document.getElementById('directorAllocationRequestsModal').style.display = 'none';
}

/**
 * Load pending allocation requests for Director
 */
async function loadAllocationRequests() {
    const container = document.getElementById('allocationRequestsList');
    
    try {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <div class="loading-spinner"></div>
                <p>Loading requests...</p>
            </div>
        `;
        
        const response = await apiCall('allocation-requests?status=pending');
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to load requests');
        }
        
        const requests = response.data || [];
        
        if (requests.length === 0) {
            container.innerHTML = `
                <div class="empty-requests">
                    <div class="icon">✅</div>
                    <h3>No Pending Requests</h3>
                    <p>All allocation change requests have been processed.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = requests.map(req => {
            const createdDate = req.createdAt ? 
                (req.createdAt.seconds ? new Date(req.createdAt.seconds * 1000) : new Date(req.createdAt)) : null;
            const dateStr = createdDate ? createdDate.toLocaleDateString() : 'N/A';
            
            // Handle different request types
            const isBudgetChange = req.requestType === 'budget_change';
            const currentValue = isBudgetChange ? (req.currentBudget || 0) : (req.currentAllocatedHours || 0);
            const requestedValue = isBudgetChange ? (req.requestedBudget || 0) : (req.requestedNewHours || 0);
            const difference = isBudgetChange ? (req.budgetDifference || (requestedValue - currentValue)) : (req.hoursDifference !== undefined ? req.hoursDifference : (requestedValue - currentValue));
            const targetLabel = isBudgetChange ? 'Project Budget' : req.designerName || 'Unknown';
            const targetIcon = isBudgetChange ? '📊' : '👤';
            
            return `
            <div class="allocation-request-card ${req.status}">
                <div class="request-header">
                    <div class="request-info">
                        <h4>📁 ${req.projectName || 'Unknown Project'}</h4>
                        <div class="request-meta">
                            Requested by <strong>${req.requestedByName || 'Unknown'}</strong> • ${dateStr}
                            ${isBudgetChange ? '<span style="background: #8b5cf6; color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; margin-left: 0.5rem;">Budget Change</span>' : ''}
                        </div>
                    </div>
                    <span class="request-status ${req.status}">${req.status}</span>
                </div>
                
                <div class="request-hours-change">
                    <div class="hours-box">
                        <label>${isBudgetChange ? 'Type' : 'Designer'}</label>
                        <div class="value" style="font-size: 1rem;">${targetIcon} ${targetLabel}</div>
                    </div>
                    <div class="hours-box">
                        <label>Current</label>
                        <div class="value">${currentValue.toFixed(1)}h</div>
                    </div>
                    <div class="hours-arrow">→</div>
                    <div class="hours-box">
                        <label>Requested</label>
                        <div class="value">${requestedValue.toFixed(1)}h</div>
                    </div>
                    <div class="hours-diff ${difference >= 0 ? 'increase' : 'decrease'}">
                        ${(difference >= 0 ? '+' : '') + difference.toFixed(1)}h
                    </div>
                </div>
                
                <div class="request-reason">
                    <strong>Reason:</strong> ${req.reason || 'No reason provided'}
                </div>
                
                <div class="request-actions">
                    <button class="btn btn-primary btn-sm" onclick="openDirectorReviewModal('${req.id}')">
                        🔍 Review
                    </button>
                </div>
            </div>
        `}).join('');
        
    } catch (error) {
        console.error('Error loading requests:', error);
        container.innerHTML = `
            <div class="empty-requests">
                <div class="icon">❌</div>
                <h3>Error Loading Requests</h3>
                <p>${error.message}</p>
                <button class="btn btn-primary" onclick="loadAllocationRequests()">Retry</button>
            </div>
        `;
    }
}

/**
 * Open review modal for a specific request
 */
async function openDirectorReviewModal(requestId) {
    try {
        showLoading();
        
        const response = await apiCall(`allocation-requests?id=${requestId}`);
        
        if (!response.success || !response.data) {
            throw new Error('Request not found');
        }
        
        const req = response.data;
        const isBudgetChange = req.requestType === 'budget_change';
        
        document.getElementById('reviewRequestId').value = requestId;
        document.getElementById('reviewProjectName').textContent = req.projectName || 'Unknown Project';
        document.getElementById('reviewDesignerName').textContent = isBudgetChange ? 'Project Budget Change' : (req.designerName || 'Unknown');
        document.getElementById('reviewRequestedBy').textContent = req.requestedByName || 'Unknown';
        
        const createdDate = req.createdAt ? 
            (req.createdAt.seconds ? new Date(req.createdAt.seconds * 1000) : new Date(req.createdAt)) : null;
        document.getElementById('reviewRequestDate').textContent = createdDate ? createdDate.toLocaleDateString() : 'N/A';
        
        // Handle different request types for hours display
        const currentValue = isBudgetChange ? (req.currentBudget || 0) : (req.currentAllocatedHours || 0);
        const requestedValue = isBudgetChange ? (req.requestedBudget || 0) : (req.requestedNewHours || 0);
        
        document.getElementById('reviewCurrentHours').textContent = `${currentValue.toFixed(1)}h`;
        document.getElementById('reviewRequestedHours').textContent = `${requestedValue.toFixed(1)}h`;
        document.getElementById('reviewCooReason').textContent = req.reason || 'No reason provided';
        document.getElementById('reviewFinalHours').value = '';
        document.getElementById('reviewDirectorComment').value = '';
        
        // Hours difference display
        const diff = isBudgetChange ? (req.budgetDifference || (requestedValue - currentValue)) : (req.hoursDifference !== undefined ? req.hoursDifference : (requestedValue - currentValue));
        const diffEl = document.getElementById('reviewHoursDiff');
        if (diff >= 0) {
            diffEl.style.background = '#d1fae5';
            diffEl.style.color = '#065f46';
            diffEl.textContent = `+${diff.toFixed(1)}h`;
        } else {
            diffEl.style.background = '#fee2e2';
            diffEl.style.color = '#991b1b';
            diffEl.textContent = `${diff.toFixed(1)}h`;
        }
        
        document.getElementById('directorReviewRequestModal').style.display = 'flex';
        
    } catch (error) {
        console.error('Error loading request:', error);
        alert('❌ Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

function closeDirectorReviewModal() {
    document.getElementById('directorReviewRequestModal').style.display = 'none';
}

/**
 * Approve allocation request
 */
async function approveAllocationRequest() {
    const requestId = document.getElementById('reviewRequestId').value;
    const finalHours = document.getElementById('reviewFinalHours').value;
    const comment = document.getElementById('reviewDirectorComment').value;
    
    const confirmMsg = finalHours ? 
        `Approve this request with ${finalHours} hours?` :
        'Approve this request with the requested hours?';
    
    if (!confirm(confirmMsg)) return;
    
    try {
        showLoading();
        
        const response = await apiCall(`allocation-requests?id=${requestId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'approve',
                finalApprovedHours: finalHours ? parseFloat(finalHours) : null,
                comment: comment
            })
        });
        
        if (response.success) {
            alert('✅ Request approved successfully!');
            closeDirectorReviewModal();
            await loadAllocationRequests();
            updateDirectorRequestsBadge();
        } else {
            throw new Error(response.error || 'Failed to approve request');
        }
    } catch (error) {
        console.error('Error approving request:', error);
        alert('❌ Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Reject allocation request
 */
async function rejectAllocationRequest() {
    const requestId = document.getElementById('reviewRequestId').value;
    const comment = document.getElementById('reviewDirectorComment').value;
    
    if (!comment.trim()) {
        alert('⚠️ Please provide a reason for rejection');
        document.getElementById('reviewDirectorComment').focus();
        return;
    }
    
    if (!confirm('Reject this allocation change request?')) return;
    
    try {
        showLoading();
        
        const response = await apiCall(`allocation-requests?id=${requestId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'reject',
                comment: comment
            })
        });
        
        if (response.success) {
            alert('Request rejected and COO has been notified.');
            closeDirectorReviewModal();
            await loadAllocationRequests();
            updateDirectorRequestsBadge();
        } else {
            throw new Error(response.error || 'Failed to reject request');
        }
    } catch (error) {
        console.error('Error rejecting request:', error);
        alert('❌ Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

// ============================================
// FEATURE 2: COO Direct Edit Allocation
// ============================================

let editAllocProjectData = null;

/**
 * Show COO edit allocation modal
 */
async function showCooEditAllocationModal(projectId) {
    try {
        showLoading();
        
        const response = await apiCall(`projects?id=${projectId}`);
        
        if (!response.success || !response.data) {
            throw new Error('Project not found');
        }
        
        editAllocProjectData = response.data;
        const project = editAllocProjectData;
        
        document.getElementById('editAllocProjectId').value = projectId;
        document.getElementById('editAllocProjectName').textContent = project.projectName || 'Unknown Project';
        
        const maxBudget = parseFloat(project.maxAllocatedHours) || 0;
        const currentTotal = parseFloat(project.totalAllocatedHours) || 0;
        const remaining = maxBudget - currentTotal;
        
        document.getElementById('editAllocMaxBudget').textContent = `${maxBudget}h`;
        document.getElementById('editAllocCurrentTotal').textContent = `${currentTotal.toFixed(1)}h`;
        document.getElementById('editAllocRemaining').textContent = `${remaining.toFixed(1)}h`;
        
        // Render designer list
        renderEditDesignerList(project);
        
        document.getElementById('cooEditAllocationModal').style.display = 'flex';
        
    } catch (error) {
        console.error('Error loading project:', error);
        alert('❌ Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

function closeCooEditAllocationModal() {
    document.getElementById('cooEditAllocationModal').style.display = 'none';
    editAllocProjectData = null;
}

/**
 * Render designer list for editing
 */
function renderEditDesignerList(project) {
    const container = document.getElementById('editAllocDesignerList');
    const designerHours = project.designerHours || {};
    const designerUids = project.assignedDesignerUids || [];
    const designerNames = project.assignedDesignerNames || [];
    const designerEmails = project.assignedDesignerEmails || [];
    
    if (designerUids.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-light);">
                <p>No designers assigned yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = designerUids.map((uid, index) => {
        const name = designerNames[index] || 'Unknown';
        const email = designerEmails[index] || '';
        const hours = parseFloat(designerHours[uid]) || 0;
        const safeName = (name || '').replace(/'/g, "\\'");
        const safeEmail = (email || '').replace(/'/g, "\\'");

        return `
            <div class="designer-edit-row" id="editRow_${uid}">
                <div class="designer-edit-info">
                    <div class="name">👤 ${name}</div>
                    <div class="email">${email}</div>
                </div>
                <div class="designer-edit-hours">
                    <input type="number" id="editHours_${uid}" class="form-control"
                           value="${hours}" min="0" step="0.5" data-original="${hours}"
                           onchange="highlightHoursChange('${uid}')">
                    <span>hours</span>
                </div>
                <div class="designer-edit-actions">
                    <button class="btn btn-success btn-sm" onclick="saveDesignerHours('${uid}', '${safeName}', '${safeEmail}')">
                        💾 Save
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="requestDesignerHoursChange('${uid}', '${safeName}', '${safeEmail}', ${hours})">
                        📤 Request
                    </button>
                    <button class="btn btn-danger btn-sm" title="Delete this allocation"
                            onclick="deleteDesignerAllocation('${uid}', '${safeName}', ${hours})">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Delete a single designer allocation (wrong designer / wrong hours)
 */
async function deleteDesignerAllocation(designerUid, designerName, currentHours) {
    const projectId = document.getElementById('editAllocProjectId').value;
    if (!projectId) {
        alert('⚠️ Project ID missing');
        return;
    }

    const reason = prompt(
        `Delete ${designerName}'s allocation (${currentHours}h)?\n\n` +
        `This will remove the designer from this project entirely.\n\n` +
        `Please enter a reason (required):`
    );

    if (reason === null) return; // user cancelled
    if (!reason || reason.trim().length < 3) {
        alert('⚠️ A reason (at least 3 characters) is required to delete this allocation.');
        return;
    }

    try {
        showLoading();

        const response = await apiCall(`projects?id=${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'delete_designer_allocation',
                data: {
                    designerUid: designerUid,
                    reason: reason.trim()
                }
            })
        });

        if (response.success) {
            alert(`✅ ${designerName}'s allocation has been removed.`);
            // Refresh modal data
            await showCooEditAllocationModal(projectId);
            // Refresh project listings if available
            if (typeof showAllProjects === 'function') {
                try { await showAllProjects(); } catch (e) {}
            }
        } else {
            throw new Error(response.error || 'Failed to delete allocation');
        }
    } catch (error) {
        console.error('Error deleting allocation:', error);
        alert('❌ Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Clear the entire allocation for a project (wrong Design Lead).
 * This resets the project so a fresh allocation can be made.
 */
async function clearProjectAllocation(projectId, projectName) {
    if (!projectId) {
        alert('⚠️ Project ID missing');
        return;
    }

    const confirmMsg =
        `⚠️ DELETE ENTIRE ALLOCATION\n\n` +
        `Project: ${projectName || 'this project'}\n\n` +
        `This will remove the Design Lead and ALL designer allocations ` +
        `so the project can be re-allocated from scratch.\n\n` +
        `Use this when the wrong Design Lead was selected.\n\n` +
        `Continue?`;
    if (!confirm(confirmMsg)) return;

    const reason = prompt('Please enter a reason for clearing this allocation (required):');
    if (reason === null) return;
    if (!reason || reason.trim().length < 3) {
        alert('⚠️ A reason (at least 3 characters) is required.');
        return;
    }

    try {
        showLoading();

        const response = await apiCall(`projects?id=${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'clear_project_allocation',
                data: { reason: reason.trim() }
            })
        });

        if (response.success) {
            alert('✅ Allocation cleared. The project can now be re-allocated.');
            if (typeof closeCooEditAllocationModal === 'function') closeCooEditAllocationModal();
            if (typeof showAllProjects === 'function') {
                try { await showAllProjects(); } catch (e) {}
            }
        } else {
            throw new Error(response.error || 'Failed to clear allocation');
        }
    } catch (error) {
        console.error('Error clearing allocation:', error);
        alert('❌ Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

function highlightHoursChange(designerUid) {
    const input = document.getElementById(`editHours_${designerUid}`);
    const original = parseFloat(input.dataset.original) || 0;
    const current = parseFloat(input.value) || 0;
    
    if (current !== original) {
        input.style.border = '2px solid #f59e0b';
        input.style.background = '#fef3c7';
    } else {
        input.style.border = '';
        input.style.background = '';
    }
}

/**
 * Save designer hours directly (Feature 2)
 */
async function saveDesignerHours(designerUid, designerName, designerEmail) {
    const projectId = document.getElementById('editAllocProjectId').value;
    const input = document.getElementById(`editHours_${designerUid}`);
    const newHours = parseFloat(input.value) || 0;
    const oldHours = parseFloat(input.dataset.original) || 0;
    
    if (newHours === oldHours) {
        alert('No changes to save');
        return;
    }
    
    // Check if within budget
    const maxBudget = parseFloat(editAllocProjectData.maxAllocatedHours) || 0;
    const currentTotal = parseFloat(editAllocProjectData.totalAllocatedHours) || 0;
    const hoursDiff = newHours - oldHours;
    const newTotal = currentTotal + hoursDiff;
    
    if (maxBudget > 0 && newTotal > maxBudget) {
        const exceed = (newTotal - maxBudget).toFixed(1);
        alert(`⚠️ Cannot save: This would exceed the budget by ${exceed} hours.\n\nUse "Request" to submit for Director approval.`);
        return;
    }
    
    const confirmMsg = `
Update ${designerName}'s allocation?

Current: ${oldHours}h
New: ${newHours}h
Change: ${hoursDiff >= 0 ? '+' : ''}${hoursDiff.toFixed(1)}h`;
    
    if (!confirm(confirmMsg)) return;
    
    try {
        showLoading();
        
        const response = await apiCall(`projects?id=${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update_designer_allocation',
                data: {
                    designerUid,
                    designerName,
                    designerEmail,
                    newAllocatedHours: newHours,
                    reason: `Direct edit by COO: ${oldHours}h → ${newHours}h`
                }
            })
        });
        
        if (response.success) {
            alert(`✅ ${designerName}'s hours updated to ${newHours}h`);
            
            // Update local data
            input.dataset.original = newHours;
            input.style.border = '2px solid #10b981';
            input.style.background = '#d1fae5';
            
            // Refresh totals
            editAllocProjectData.designerHours = editAllocProjectData.designerHours || {};
            editAllocProjectData.designerHours[designerUid] = newHours;
            editAllocProjectData.totalAllocatedHours = newTotal;
            
            document.getElementById('editAllocCurrentTotal').textContent = `${newTotal.toFixed(1)}h`;
            document.getElementById('editAllocRemaining').textContent = `${(maxBudget - newTotal).toFixed(1)}h`;
            
            setTimeout(() => {
                input.style.border = '';
                input.style.background = '';
            }, 2000);
            
        } else {
            throw new Error(response.error || 'Failed to update hours');
        }
    } catch (error) {
        console.error('Error updating hours:', error);
        alert('❌ Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Request hours change that exceeds budget (goes to Director)
 */
function requestDesignerHoursChange(designerUid, designerName, designerEmail, currentHours) {
    const projectId = document.getElementById('editAllocProjectId').value;
    closeCooEditAllocationModal();
    showRequestAllocationChangeModal(projectId, designerUid, designerName, designerEmail, currentHours);
}

// ============================================
// COUNT PENDING REQUESTS FOR DIRECTOR NAV
// ============================================

async function updateDirectorRequestsBadge() {
    if (currentUserRole !== 'director') return;
    
    try {
        const response = await apiCall('allocation-requests?status=pending');
        if (response.success && response.data) {
            const count = response.data.length;
            const badge = document.getElementById('directorRequestsBadge');
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline' : 'none';
            }
        }
    } catch (error) {
        console.error('Error fetching pending requests count:', error);
    }
}

// ============================================
// UPDATE DASHBOARD INIT TO SHOW NAV ITEMS
// ============================================

// Add this to your existing updateUIForRole or dashboard initialization:
// For Director: show allocationRequestsNavItem and call updateDirectorRequestsBadge()
// For COO: they use showCooEditAllocationModal from project actions

// Example: Add to your setDisplay calls in the dashboard init:
// setDisplay('allocationRequestsNavItem', currentUserRole === 'director');
// if (currentUserRole === 'director') { updateDirectorRequestsBadge(); }
// ============================================
// DESIGNER ANALYTICS MODULE - COMPLETE
// Version: 3.0.0
// Features:
// 1. Director/HR Portal - View all designers with Excel download
// 2. Designer Self-View - Daily, Weekly, Monthly analytics
// ============================================

// ============================================
// SECTION 1: DIRECTOR/HR PORTAL - ALL DESIGNERS VIEW
// ============================================

/**
 * Show Designer Weekly Hours Analytics Dashboard (Director/HR View)
 */
async function showDesignerWeeklyAnalytics() {
    console.log('==========================================');
    console.log('🔍 showDesignerWeeklyAnalytics CALLED');
    console.log('==========================================');
    console.log('👤 Current User:', currentUser?.email);
    console.log('👤 Current Role:', currentUserRole);
    
    setActiveNav('nav-designer-analytics');
    const main = document.getElementById('mainContent');
    if (!main) {
        console.error('❌ mainContent element not found!');
        return;
    }
    main.style.display = 'block';
    showLoading();

    try {
        console.log('📡 Calling API: timesheets?action=designer_weekly_report');
        console.log('📡 API_BASE:', typeof API_BASE !== 'undefined' ? API_BASE : 'NOT DEFINED');
        
        const response = await apiCall('timesheets?action=designer_weekly_report');
        console.log('📡 API Response:', response);
        
        if (!response || !response.success) {
            throw new Error(response?.error || 'Failed to load designer weekly report');
        }

        const { designers, weeklyTotals, monthlyTotals, summary, projectReport, allMonthKeys } = response.data || {};

        if (!designers || !summary) {
            throw new Error('Invalid data received from API');
        }

        // Store for tab rendering
        window._analyticsData = { designers, weeklyTotals, monthlyTotals, summary, projectReport: projectReport || [], allMonthKeys: allMonthKeys || [] };

        main.innerHTML = renderDesignerAnalyticsDashboard(designers, weeklyTotals, monthlyTotals, summary, projectReport || [], allMonthKeys || []);
        
        setTimeout(() => renderDesignerCharts(designers, weeklyTotals, monthlyTotals), 100);

    } catch (error) {
        console.error('❌ Error loading designer analytics:', error);
        main.innerHTML = `
            <div class="card" style="padding: 3rem; text-align: center;">
                <h3 style="color: var(--danger);">⚠️ Error Loading Analytics</h3>
                <p style="color: var(--text-light); margin: 1rem 0;">${error.message}</p>
                <p style="color: var(--text-light); font-size: 0.85rem;">Check console (F12) for details</p>
                <button onclick="showDesignerWeeklyAnalytics()" class="btn btn-primary">🔄 Retry</button>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

/**
 * Render Director/HR Analytics Dashboard
 */
function renderDesignerAnalyticsDashboard(designers, weeklyTotals, monthlyTotals, summary, projectReport, allMonthKeys) {
    const totalProjects = (projectReport || []).length;
    return `
        <div class="page-header">
            <h2>Designer Hours Analytics</h2>
            <p class="subtitle">Project-based and designer-based breakdown of all working hours</p>
        </div>

        <!-- Summary Cards -->
        <div class="dashboard-stats">
            <div class="stat-card" style="border-top-color: var(--primary-blue);">
                <div class="stat-number" style="color: var(--primary-blue);">${totalProjects}</div>
                <div class="stat-label">Total Projects</div>
            </div>
            <div class="stat-card" style="border-top-color: var(--success);">
                <div class="stat-number" style="color: var(--success);">${summary.totalHoursAllTime.toFixed(1)}h</div>
                <div class="stat-label">Total Hours Logged</div>
            </div>
            <div class="stat-card" style="border-top-color: #8b5cf6;">
                <div class="stat-number" style="color: #8b5cf6;">${summary.totalDesigners}</div>
                <div class="stat-label">Total Designers</div>
            </div>
            <div class="stat-card" style="border-top-color: var(--warning);">
                <div class="stat-number" style="color: var(--warning);">${summary.avgHoursPerDesigner.toFixed(1)}h</div>
                <div class="stat-label">Avg Hours/Designer</div>
            </div>
        </div>

        <!-- Export Buttons -->
        <div style="margin: 2rem 0; display: flex; gap: 1rem; justify-content: flex-end; flex-wrap: wrap;">
            <button onclick="downloadDesignerWeeklyExcel()" class="btn btn-primary">
                Download Weekly Report
            </button>
            <button onclick="downloadDesignerMonthlyExcel()" class="btn btn-success">
                Download Monthly Report
            </button>
        </div>

        <!-- Tabs -->
        <div class="card" style="margin-bottom: 2rem; padding: 0;">
            <div style="display: flex; border-bottom: 2px solid var(--border); overflow-x: auto;">
                <button class="analytics-tab active" onclick="showAnalyticsTab('projectReport', this)">Project Report</button>
                <button class="analytics-tab" onclick="showAnalyticsTab('projectMonthly', this)">Project Monthly</button>
                <button class="analytics-tab" onclick="showAnalyticsTab('summary', this)">Designer Summary</button>
                <button class="analytics-tab" onclick="showAnalyticsTab('weekly', this)">Weekly View</button>
                <button class="analytics-tab" onclick="showAnalyticsTab('monthly', this)">Monthly View</button>
                <button class="analytics-tab" onclick="showAnalyticsTab('charts', this)">Charts</button>
            </div>
        </div>

        <!-- Tab Contents -->
        <div id="analytics-tab-projectReport" class="analytics-tab-content">
            ${renderProjectReport(projectReport || [])}
        </div>

        <div id="analytics-tab-projectMonthly" class="analytics-tab-content" style="display: none;">
            ${renderProjectMonthlyReport(projectReport || [], allMonthKeys || [])}
        </div>

        <div id="analytics-tab-summary" class="analytics-tab-content" style="display: none;">
            ${renderAllDesignersTable(designers)}
        </div>

        <div id="analytics-tab-weekly" class="analytics-tab-content" style="display: none;">
            ${renderWeeklyMatrix(designers, weeklyTotals)}
        </div>

        <div id="analytics-tab-monthly" class="analytics-tab-content" style="display: none;">
            ${renderMonthlyMatrix(designers, monthlyTotals)}
        </div>

        <div id="analytics-tab-charts" class="analytics-tab-content" style="display: none;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 2rem;">
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">Weekly Hours Trend</h3>
                    <div style="height: 350px;"><canvas id="weeklyTrendChart"></canvas></div>
                </div>
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">Top Designers by Hours</h3>
                    <div style="height: 350px;"><canvas id="designerBarChart"></canvas></div>
                </div>
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">Monthly Hours Trend</h3>
                    <div style="height: 350px;"><canvas id="monthlyTrendChart"></canvas></div>
                </div>
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">Hours Distribution</h3>
                    <div style="height: 350px;"><canvas id="designerPieChart"></canvas></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render Project-Based Report — each project shows total hours + per-designer breakdown
 */
function renderProjectReport(projectReport) {
    if (!projectReport || projectReport.length === 0) {
        return '<div class="card" style="padding: 2rem; text-align: center; color: var(--text-light);">No project data available.</div>';
    }
    const sectionColors = { Engineering: '#3b82f6', Rebar: '#f59e0b', Structural: '#10b981', Unassigned: '#6b7280' };

    const cards = projectReport.map((p, idx) => {
        const secColor = sectionColors[p.projectSection] || '#6b7280';
        const pctUsed = p.maxAllocatedHours > 0 ? ((p.totalHours / p.maxAllocatedHours) * 100).toFixed(0) : 0;
        const barColor = pctUsed > 100 ? '#ef4444' : (pctUsed > 80 ? '#f59e0b' : '#10b981');

        const dRows = p.designers.map(d => {
            const share = p.totalHours > 0 ? ((d.totalHours / p.totalHours) * 100).toFixed(0) : 0;
            return '<tr style="border-bottom: 1px solid #f3f4f6;">'
                + '<td style="padding: 0.6rem 1rem;"><div style="display: flex; align-items: center; gap: 0.5rem;">'
                + '<div style="width: 28px; height: 28px; border-radius: 50%; background: ' + secColor + '15; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; color: ' + secColor + ';">' + (d.name || 'U').charAt(0).toUpperCase() + '</div>'
                + '<div><div style="font-weight: 500; color: #111827;">' + d.name + '</div>'
                + '<div style="font-size: 0.7rem; color: #9ca3af;">' + (d.email || '') + '</div></div></div></td>'
                + '<td style="padding: 0.6rem 1rem; text-align: center; font-weight: 700; color: #111827;">' + d.totalHours.toFixed(1) + 'h</td>'
                + '<td style="padding: 0.6rem 1rem; text-align: center;"><div style="display: flex; align-items: center; gap: 0.5rem; justify-content: center;">'
                + '<div style="background: #f3f4f6; border-radius: 4px; height: 6px; width: 60px; overflow: hidden;">'
                + '<div style="background: ' + secColor + '; height: 100%; width: ' + Math.min(share, 100) + '%; border-radius: 4px;"></div></div>'
                + '<span style="font-size: 0.8rem; font-weight: 600; color: #374151;">' + share + '%</span></div></td>'
                + '</tr>';
        }).join('');

        return '<div style="background: white; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 1rem; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">'
            // Header
            + '<div onclick="toggleProjReport(' + idx + ')" style="padding: 1.25rem 1.5rem; cursor: pointer; display: grid; grid-template-columns: 1fr auto auto auto; gap: 1.5rem; align-items: center; border-left: 4px solid ' + secColor + ';">'
            + '<div>'
            + '<div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">'
            + (p.projectNumber ? '<span style="font-size: 0.85rem; font-weight: 700; color: var(--primary-blue); background: #eff6ff; padding: 2px 8px; border-radius: 6px;">' + p.projectNumber + '</span>' : '')
            + '<strong style="font-size: 1rem; color: #111827;">' + p.projectName + '</strong>'
            + '<span style="background: ' + secColor + '; color: white; padding: 1px 10px; border-radius: 10px; font-size: 0.7rem; font-weight: 600;">' + p.projectSection + '</span>'
            + '</div>'
            + '<div style="font-size: 0.8rem; color: var(--text-light);">' + (p.projectCode || '') + (p.clientCompany ? ' | ' + p.clientCompany : '') + (p.designLeadName ? ' | Lead: ' + p.designLeadName : '') + '</div>'
            + '</div>'
            + '<div style="text-align: center; min-width: 130px;">'
            + '<div style="font-size: 0.7rem; color: var(--text-light); text-transform: uppercase;">Total Spent</div>'
            + '<div style="font-weight: 700; font-size: 1.2rem; color: ' + barColor + ';">' + p.totalHours.toFixed(1) + 'h'
            + (p.maxAllocatedHours > 0 ? ' <span style="font-weight: 400; font-size: 0.8rem; color: #9ca3af;">/ ' + p.maxAllocatedHours + 'h</span>' : '') + '</div>'
            + (p.maxAllocatedHours > 0 ? '<div style="background: #f3f4f6; border-radius: 4px; height: 6px; margin-top: 4px; overflow: hidden;"><div style="background: ' + barColor + '; height: 100%; width: ' + Math.min(pctUsed, 100) + '%; border-radius: 4px;"></div></div>' : '')
            + '</div>'
            + '<div style="text-align: center;">'
            + '<div style="font-size: 0.7rem; color: var(--text-light); text-transform: uppercase;">Designers</div>'
            + '<div style="font-weight: 700; font-size: 1.2rem; color: #3b82f6;">' + p.designers.length + '</div>'
            + '</div>'
            + '<div style="color: #9ca3af; font-size: 1.2rem; transition: transform 0.2s;" id="prArrow' + idx + '">&#9662;</div>'
            + '</div>'
            // Expandable detail
            + '<div id="prDetail' + idx + '" style="display: none; border-top: 1px solid #e5e7eb; background: #fafbfc;">'
            + '<div style="padding: 1rem 1.5rem;">'
            + '<table style="width: 100%; border-collapse: collapse;">'
            + '<thead><tr style="background: #f1f5f9;">'
            + '<th style="text-align: left; padding: 0.5rem 1rem; font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 600;">Designer</th>'
            + '<th style="text-align: center; padding: 0.5rem 1rem; font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 600;">Hours Spent</th>'
            + '<th style="text-align: center; padding: 0.5rem 1rem; font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 600;">Share of Project</th>'
            + '</tr></thead>'
            + '<tbody>' + dRows + '</tbody>'
            + '<tfoot><tr style="background: #f8fafc; border-top: 2px solid #e5e7eb;">'
            + '<td style="padding: 0.6rem 1rem; font-weight: 700; color: #111827;">Total</td>'
            + '<td style="padding: 0.6rem 1rem; text-align: center; font-weight: 700; color: #111827;">' + p.totalHours.toFixed(1) + 'h</td>'
            + '<td style="padding: 0.6rem 1rem; text-align: center; font-weight: 700; color: #111827;">100%</td>'
            + '</tr></tfoot>'
            + '</table></div></div></div>';
    }).join('');

    return '<div>'
        + '<div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-bottom: 1rem;">'
        + '<button onclick="expandAllProjReports(true)" style="background: none; border: 1px solid #d1d5db; padding: 0.3rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem; color: #374151;">Expand All</button>'
        + '<button onclick="expandAllProjReports(false)" style="background: none; border: 1px solid #d1d5db; padding: 0.3rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem; color: #374151;">Collapse All</button>'
        + '</div>'
        + cards + '</div>';
}

/**
 * Toggle project report detail
 */
function toggleProjReport(idx) {
    const detail = document.getElementById('prDetail' + idx);
    const arrow = document.getElementById('prArrow' + idx);
    if (!detail) return;
    if (detail.style.display === 'none') {
        detail.style.display = 'block';
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    } else {
        detail.style.display = 'none';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
}
function expandAllProjReports(expand) {
    const data = window._analyticsData;
    if (!data || !data.projectReport) return;
    data.projectReport.forEach((_, idx) => {
        const detail = document.getElementById('prDetail' + idx);
        const arrow = document.getElementById('prArrow' + idx);
        if (detail) {
            detail.style.display = expand ? 'block' : 'none';
            if (arrow) arrow.style.transform = expand ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    });
}

/**
 * Render Project Monthly Report — each project shows per-designer hours by month
 */
function renderProjectMonthlyReport(projectReport, allMonthKeys) {
    if (!projectReport || projectReport.length === 0) {
        return '<div class="card" style="padding: 2rem; text-align: center; color: var(--text-light);">No project data available.</div>';
    }
    // Use last 6 months
    const months = (allMonthKeys || []).slice(-6);
    if (months.length === 0) return '<div class="card" style="padding: 2rem; text-align: center; color: var(--text-light);">No monthly data available.</div>';

    const fmtMonth = (mk) => {
        try { const d = new Date(mk); return d.toLocaleString('en-US', { month: 'short', year: 'numeric' }); } catch(e) { return mk; }
    };
    const sectionColors = { Engineering: '#3b82f6', Rebar: '#f59e0b', Structural: '#10b981', Unassigned: '#6b7280' };

    const tables = projectReport.map(p => {
        const secColor = sectionColors[p.projectSection] || '#6b7280';
        // Only show months that have data for this project
        const activeMonths = months.filter(m => (p.monthlyHours || {})[m] > 0);
        if (activeMonths.length === 0 && p.totalHours <= 0) return '';

        const monthHeaders = months.map(m => '<th style="text-align: center; padding: 0.5rem 0.75rem; font-size: 0.75rem; color: #64748b; text-transform: uppercase; min-width: 80px;">' + fmtMonth(m) + '</th>').join('');

        const dRows = p.designers.map(d => {
            const cells = months.map(m => {
                const hrs = (d.monthlyHours || {})[m] || 0;
                const color = hrs > 0 ? '#111827' : '#d1d5db';
                return '<td style="text-align: center; padding: 0.5rem 0.75rem; font-weight: ' + (hrs > 0 ? '600' : '400') + '; color: ' + color + ';">' + (hrs > 0 ? hrs.toFixed(1) : '-') + '</td>';
            }).join('');
            return '<tr style="border-bottom: 1px solid #f3f4f6;">'
                + '<td style="padding: 0.5rem 0.75rem; font-weight: 500; color: #111827; white-space: nowrap;">' + d.name + '</td>'
                + cells
                + '<td style="text-align: center; padding: 0.5rem 0.75rem; font-weight: 700; color: #111827; background: #f8fafc;">' + d.totalHours.toFixed(1) + 'h</td>'
                + '</tr>';
        }).join('');

        const totalCells = months.map(m => {
            const total = (p.monthlyHours || {})[m] || 0;
            return '<td style="text-align: center; padding: 0.5rem 0.75rem; font-weight: 700; color: ' + (total > 0 ? secColor : '#d1d5db') + ';">' + (total > 0 ? total.toFixed(1) : '-') + '</td>';
        }).join('');

        return '<div class="card" style="margin-bottom: 1.5rem; border-left: 4px solid ' + secColor + ';">'
            + '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">'
            + '<div>'
            + '<h4 style="margin: 0; color: #111827;">' + (p.projectNumber ? '<span style="color: var(--primary-blue);">' + p.projectNumber + '</span> - ' : '') + p.projectName
            + ' <span style="background: ' + secColor + '; color: white; padding: 1px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 600; margin-left: 0.5rem;">' + p.projectSection + '</span></h4>'
            + '<div style="font-size: 0.8rem; color: var(--text-light); margin-top: 0.25rem;">' + (p.projectCode || '') + (p.clientCompany ? ' | ' + p.clientCompany : '') + (p.designLeadName ? ' | Lead: ' + p.designLeadName : '') + '</div>'
            + '</div>'
            + '<div style="text-align: right;">'
            + '<div style="font-weight: 700; font-size: 1.1rem; color: ' + secColor + ';">' + p.totalHours.toFixed(1) + 'h</div>'
            + (p.maxAllocatedHours > 0 ? '<div style="font-size: 0.75rem; color: var(--text-light);">of ' + p.maxAllocatedHours + 'h allocated</div>' : '')
            + '</div></div>'
            + '<div style="overflow-x: auto;">'
            + '<table style="width: 100%; border-collapse: collapse;">'
            + '<thead><tr style="background: #f1f5f9;">'
            + '<th style="text-align: left; padding: 0.5rem 0.75rem; font-size: 0.75rem; color: #64748b; text-transform: uppercase; min-width: 120px;">Designer</th>'
            + monthHeaders
            + '<th style="text-align: center; padding: 0.5rem 0.75rem; font-size: 0.75rem; color: #64748b; text-transform: uppercase; background: #e5e7eb;">Total</th>'
            + '</tr></thead>'
            + '<tbody>' + dRows + '</tbody>'
            + '<tfoot><tr style="background: #f8fafc; border-top: 2px solid #e5e7eb;">'
            + '<td style="padding: 0.5rem 0.75rem; font-weight: 700; color: #111827;">Project Total</td>'
            + totalCells
            + '<td style="text-align: center; padding: 0.5rem 0.75rem; font-weight: 700; color: ' + secColor + '; background: #f0f0f0;">' + p.totalHours.toFixed(1) + 'h</td>'
            + '</tr></tfoot>'
            + '</table></div></div>';
    }).filter(Boolean).join('');

    return tables || '<div class="card" style="padding: 2rem; text-align: center; color: var(--text-light);">No monthly project data available.</div>';
}

window.toggleProjReport = toggleProjReport;
window.expandAllProjReports = expandAllProjReports;

/**
 * Render All Designers Summary Table
 */
function renderAllDesignersTable(designers) {
    if (!designers?.length) {
        return '<div class="card" style="padding: 2rem; text-align: center;">No designer data found.</div>';
    }
    
    const rows = designers.map((d, i) => `
        <tr>
            <td style="font-weight: 600;">${i + 1}</td>
            <td>
                <strong>${d.name}</strong><br>
                <small style="color: var(--text-light);">${d.email || ''}</small>
            </td>
            <td style="font-weight: 700; color: var(--primary-blue);">${d.totalHours.toFixed(1)}h</td>
            <td>${d.weeksActive}</td>
            <td>${d.monthsActive || '-'}</td>
            <td style="color: var(--success); font-weight: 600;">${d.avgWeeklyHours.toFixed(1)}h</td>
            <td style="color: var(--warning); font-weight: 600;">${d.avgDailyHours.toFixed(2)}h</td>
            <td>${d.projectsWorked}</td>
            <td>${d.uniqueWorkingDays}</td>
        </tr>
    `).join('');
    
    return `
        <div class="card">
            <div style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Designer</th>
                            <th>Total Hours</th>
                            <th>Weeks</th>
                            <th>Months</th>
                            <th>Avg/Week</th>
                            <th>Avg/Day</th>
                            <th>Projects</th>
                            <th>Days Worked</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Render Weekly Hours Matrix
 */
function renderWeeklyMatrix(designers, weeklyTotals) {
    if (!weeklyTotals?.length) {
        return '<div class="card" style="padding: 2rem; text-align: center;">No weekly data available.</div>';
    }
    
    const headers = weeklyTotals.map(w => `<th style="min-width: 85px; text-align: center; font-size: 0.85rem;">${w.weekLabel}</th>`).join('');
    
    const rows = designers.slice(0, 20).map(d => {
        const cells = weeklyTotals.map(w => {
            const hrs = d.weeklyHours?.[w.week] || 0;
            const color = hrs > 45 ? 'var(--danger)' : hrs > 35 ? 'var(--warning)' : hrs > 0 ? 'var(--success)' : 'var(--text-light)';
            return `<td style="text-align: center; color: ${color}; font-weight: ${hrs > 0 ? '600' : '400'};">${hrs > 0 ? hrs.toFixed(1) : '-'}</td>`;
        }).join('');
        
        return `<tr>
            <td style="position: sticky; left: 0; background: white; z-index: 1; font-weight: 600;">${d.name}</td>
            ${cells}
            <td style="background: #f3f4f6; font-weight: 700; text-align: center;">${d.avgWeeklyHours.toFixed(1)}h</td>
        </tr>`;
    }).join('');
    
    const totals = weeklyTotals.map(w => `<td style="text-align: center; font-weight: 700;">${w.total.toFixed(1)}</td>`).join('');
    
    return `
        <div class="card">
            <div style="overflow-x: auto;">
                <table class="data-table" style="min-width: max-content;">
                    <thead>
                        <tr>
                            <th style="position: sticky; left: 0; background: var(--light-blue); z-index: 2; min-width: 150px;">Designer</th>
                            ${headers}
                            <th style="background: #e5e7eb;">Avg/Week</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr style="background: #f3f4f6; font-weight: 700;">
                            <td style="position: sticky; left: 0; background: #e5e7eb; z-index: 1;">TOTAL</td>
                            ${totals}
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    `;
}

/**
 * Render Monthly Hours Matrix
 */
function renderMonthlyMatrix(designers, monthlyTotals) {
    if (!monthlyTotals?.length) {
        return '<div class="card" style="padding: 2rem; text-align: center;">No monthly data available.</div>';
    }
    
    const headers = monthlyTotals.map(m => `<th style="min-width: 100px; text-align: center; font-size: 0.85rem;">${m.monthLabel}</th>`).join('');
    
    const rows = designers.slice(0, 20).map(d => {
        const cells = monthlyTotals.map(m => {
            const hrs = d.monthlyHours?.[m.month] || 0;
            const color = hrs > 180 ? 'var(--danger)' : hrs > 140 ? 'var(--warning)' : hrs > 0 ? 'var(--success)' : 'var(--text-light)';
            return `<td style="text-align: center; color: ${color}; font-weight: ${hrs > 0 ? '600' : '400'};">${hrs > 0 ? hrs.toFixed(1) : '-'}</td>`;
        }).join('');
        
        return `<tr>
            <td style="position: sticky; left: 0; background: white; z-index: 1; font-weight: 600;">${d.name}</td>
            ${cells}
            <td style="background: #f3f4f6; font-weight: 700; text-align: center;">${(d.avgMonthlyHours || 0).toFixed(1)}h</td>
        </tr>`;
    }).join('');
    
    const totals = monthlyTotals.map(m => `<td style="text-align: center; font-weight: 700;">${m.total.toFixed(1)}</td>`).join('');
    
    return `
        <div class="card">
            <div style="overflow-x: auto;">
                <table class="data-table" style="min-width: max-content;">
                    <thead>
                        <tr>
                            <th style="position: sticky; left: 0; background: var(--light-blue); z-index: 2; min-width: 150px;">Designer</th>
                            ${headers}
                            <th style="background: #e5e7eb;">Avg/Month</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr style="background: #f3f4f6; font-weight: 700;">
                            <td style="position: sticky; left: 0; background: #e5e7eb; z-index: 1;">TOTAL</td>
                            ${totals}
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    `;
}

/**
 * Tab Switching for Director/HR View
 */
function showAnalyticsTab(tabName, btn) {
    document.querySelectorAll('.analytics-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.analytics-tab-content').forEach(c => c.style.display = 'none');
    
    btn.classList.add('active');
    document.getElementById(`analytics-tab-${tabName}`).style.display = 'block';
    
    if (tabName === 'charts') {
        apiCall('timesheets?action=designer_weekly_report').then(res => {
            if (res.success) renderDesignerCharts(res.data.designers, res.data.weeklyTotals, res.data.monthlyTotals);
        });
    }
}

/**
 * Render Charts for Director/HR View
 */
function renderDesignerCharts(designers, weeklyTotals, monthlyTotals) {
    // Weekly Trend Chart
    const weeklyCtx = document.getElementById('weeklyTrendChart');
    if (weeklyCtx && typeof Chart !== 'undefined') {
        if (Chart.getChart(weeklyCtx)) Chart.getChart(weeklyCtx).destroy();
        new Chart(weeklyCtx, {
            type: 'line',
            data: {
                labels: weeklyTotals.map(w => w.weekLabel),
                datasets: [{
                    label: 'Total Hours',
                    data: weeklyTotals.map(w => w.total),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.3
                }, {
                    label: 'Avg Per Designer',
                    data: weeklyTotals.map(w => w.avgPerDesigner),
                    borderColor: '#10b981',
                    borderDash: [5, 5],
                    tension: 0.3
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }
    
    // Designer Bar Chart
    const barCtx = document.getElementById('designerBarChart');
    if (barCtx && typeof Chart !== 'undefined') {
        if (Chart.getChart(barCtx)) Chart.getChart(barCtx).destroy();
        const top10 = designers.slice(0, 10);
        new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: top10.map(d => d.name.split(' ')[0]),
                datasets: [{
                    label: 'Total Hours',
                    data: top10.map(d => d.totalHours),
                    backgroundColor: '#3b82f6'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }
        });
    }
    
    // Monthly Trend Chart
    const monthlyCtx = document.getElementById('monthlyTrendChart');
    if (monthlyCtx && monthlyTotals && typeof Chart !== 'undefined') {
        if (Chart.getChart(monthlyCtx)) Chart.getChart(monthlyCtx).destroy();
        new Chart(monthlyCtx, {
            type: 'bar',
            data: {
                labels: monthlyTotals.map(m => m.monthLabel),
                datasets: [{
                    label: 'Total Hours',
                    data: monthlyTotals.map(m => m.total),
                    backgroundColor: '#8b5cf6'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
    
    // Pie Chart
    const pieCtx = document.getElementById('designerPieChart');
    if (pieCtx && typeof Chart !== 'undefined') {
        if (Chart.getChart(pieCtx)) Chart.getChart(pieCtx).destroy();
        const top5 = designers.slice(0, 5);
        const others = designers.slice(5).reduce((sum, d) => sum + d.totalHours, 0);
        new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: [...top5.map(d => d.name.split(' ')[0]), 'Others'],
                datasets: [{
                    data: [...top5.map(d => d.totalHours), others],
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }
}

/**
 * Download Weekly Excel Report
 */
async function downloadDesignerWeeklyExcel() {
    try {
        showLoading();
        const response = await apiCall('timesheets?action=designer_weekly_report');
        if (!response.success) throw new Error('Failed to fetch data');
        
        const { designers, weeklyTotals, summary } = response.data;
        
        if (typeof XLSX === 'undefined') {
            alert('Excel library not loaded. Please refresh the page.');
            return;
        }
        
        const wb = XLSX.utils.book_new();
        
        // Sheet 1: Summary
        const summaryData = [
            ['Designer Weekly Hours Report'],
            ['Generated: ' + new Date().toLocaleString()],
            [''],
            ['#', 'Name', 'Email', 'Total Hours', 'Weeks Active', 'Avg/Week', 'Avg/Day', 'Projects', 'Days Worked']
        ];
        designers.forEach((d, i) => {
            summaryData.push([i + 1, d.name, d.email, d.totalHours, d.weeksActive, d.avgWeeklyHours, d.avgDailyHours, d.projectsWorked, d.uniqueWorkingDays]);
        });
        const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
        ws1['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws1, 'Designer Summary');
        
        // Sheet 2: Weekly Breakdown
        const weeklyData = [['Weekly Hours Breakdown'], [''], ['Designer', ...weeklyTotals.map(w => w.weekLabel), 'Average']];
        designers.forEach(d => {
            const row = [d.name];
            weeklyTotals.forEach(w => row.push(d.weeklyHours?.[w.week] || 0));
            row.push(d.avgWeeklyHours);
            weeklyData.push(row);
        });
        weeklyData.push(['TOTAL', ...weeklyTotals.map(w => w.total), '']);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(weeklyData), 'Weekly Breakdown');
        
        XLSX.writeFile(wb, `Designer_Weekly_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Download Monthly Excel Report
 */
async function downloadDesignerMonthlyExcel() {
    try {
        showLoading();
        const response = await apiCall('timesheets?action=designer_weekly_report');
        if (!response.success) throw new Error('Failed to fetch data');
        
        const { designers, monthlyTotals } = response.data;
        
        if (typeof XLSX === 'undefined') {
            alert('Excel library not loaded. Please refresh the page.');
            return;
        }
        
        const wb = XLSX.utils.book_new();
        
        const monthlyData = [['Designer Monthly Hours Report'], ['Generated: ' + new Date().toLocaleString()], [''], ['Designer', ...monthlyTotals.map(m => m.monthLabel), 'Total']];
        designers.forEach(d => {
            const row = [d.name];
            monthlyTotals.forEach(m => row.push(d.monthlyHours?.[m.month] || 0));
            row.push(d.totalHours);
            monthlyData.push(row);
        });
        monthlyData.push(['TOTAL', ...monthlyTotals.map(m => m.total), '']);
        
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(monthlyData), 'Monthly Breakdown');
        XLSX.writeFile(wb, `Designer_Monthly_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        hideLoading();
    }
}


// ============================================
// SECTION 2: DESIGNER SELF-VIEW - MY ANALYTICS
// ============================================

/**
 * Show My Analytics Dashboard (Designer's Own View)
 */
async function showMyAnalytics() {
    setActiveNav('nav-my-analytics');
    const main = document.getElementById('mainContent');
    main.style.display = 'block';
    showLoading();

    try {
        const response = await apiCall('timesheets?action=my_analytics');
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to load your analytics');
        }

        const { summary, currentPeriod, daily, weekly, monthly, byProject } = response.data;
        
        main.innerHTML = renderMyAnalyticsDashboard(summary, currentPeriod, daily, weekly, monthly, byProject);
        
        setTimeout(() => renderMyAnalyticsCharts(weekly, monthly, byProject), 100);

    } catch (error) {
        console.error('❌ Error loading my analytics:', error);
        main.innerHTML = `
            <div class="card" style="padding: 3rem; text-align: center;">
                <h3 style="color: var(--danger);">⚠️ Error Loading Your Analytics</h3>
                <p style="color: var(--text-light); margin: 1rem 0;">${error.message}</p>
                <button onclick="showMyAnalytics()" class="btn btn-primary">🔄 Retry</button>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

/**
 * Render Designer's Personal Analytics Dashboard
 */
function renderMyAnalyticsDashboard(summary, currentPeriod, daily, weekly, monthly, byProject) {
    return `
        <div class="page-header">
            <h2>📊 My Working Hours Analytics</h2>
            <p class="subtitle">Track your daily, weekly, and monthly working hours</p>
        </div>
        
        <!-- Current Period Highlight -->
        <div class="dashboard-stats">
            <div class="stat-card" style="border-top-color: #10b981; background: linear-gradient(135deg, #d1fae5, #a7f3d0);">
                <div class="stat-number" style="color: #059669;">${currentPeriod.todayHours.toFixed(1)}h</div>
                <div class="stat-label">📅 Today</div>
            </div>
            <div class="stat-card" style="border-top-color: #3b82f6; background: linear-gradient(135deg, #dbeafe, #bfdbfe);">
                <div class="stat-number" style="color: #2563eb;">${currentPeriod.thisWeekHours.toFixed(1)}h</div>
                <div class="stat-label">📆 This Week</div>
            </div>
            <div class="stat-card" style="border-top-color: #8b5cf6; background: linear-gradient(135deg, #ede9fe, #ddd6fe);">
                <div class="stat-number" style="color: #7c3aed;">${currentPeriod.thisMonthHours.toFixed(1)}h</div>
                <div class="stat-label">🗓️ This Month</div>
            </div>
            <div class="stat-card" style="border-top-color: #f59e0b; background: linear-gradient(135deg, #fef3c7, #fde68a);">
                <div class="stat-number" style="color: #d97706;">${summary.totalHours.toFixed(1)}h</div>
                <div class="stat-label">⏱️ All Time</div>
            </div>
        </div>
        
        <!-- Summary Stats -->
        <div class="card" style="margin: 2rem 0; padding: 1.5rem;">
            <h3 style="margin-bottom: 1rem;">📈 Your Statistics</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                <div style="text-align: center; padding: 1rem; background: #f9fafb; border-radius: 10px;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-blue);">${summary.avgDailyHours.toFixed(2)}h</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">Avg per Day</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: #f9fafb; border-radius: 10px;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--success);">${summary.avgWeeklyHours.toFixed(1)}h</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">Avg per Week</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: #f9fafb; border-radius: 10px;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: #8b5cf6;">${summary.avgMonthlyHours.toFixed(1)}h</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">Avg per Month</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: #f9fafb; border-radius: 10px;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning);">${summary.totalWorkingDays}</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">Days Worked</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: #f9fafb; border-radius: 10px;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--danger);">${summary.totalProjects}</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">Projects</div>
                </div>
            </div>
        </div>
        
        <!-- Export Button -->
        <div style="margin: 1.5rem 0; text-align: right;">
            <button onclick="downloadMyAnalyticsExcel()" class="btn btn-primary">📥 Download My Report</button>
        </div>
        
        <!-- Tabs -->
        <div class="card" style="margin-bottom: 2rem; padding: 0;">
            <div style="display: flex; border-bottom: 2px solid var(--border); overflow-x: auto;">
                <button class="my-analytics-tab active" onclick="showMyAnalyticsTab('daily', this)">📅 Daily</button>
                <button class="my-analytics-tab" onclick="showMyAnalyticsTab('weekly', this)">📆 Weekly</button>
                <button class="my-analytics-tab" onclick="showMyAnalyticsTab('monthly', this)">🗓️ Monthly</button>
                <button class="my-analytics-tab" onclick="showMyAnalyticsTab('projects', this)">📁 By Project</button>
                <button class="my-analytics-tab" onclick="showMyAnalyticsTab('charts', this)">📈 Charts</button>
            </div>
        </div>
        
        <!-- Tab Contents -->
        <div id="my-analytics-daily" class="my-analytics-content">
            ${renderMyDailyView(daily)}
        </div>
        
        <div id="my-analytics-weekly" class="my-analytics-content" style="display: none;">
            ${renderMyWeeklyView(weekly)}
        </div>
        
        <div id="my-analytics-monthly" class="my-analytics-content" style="display: none;">
            ${renderMyMonthlyView(monthly)}
        </div>
        
        <div id="my-analytics-projects" class="my-analytics-content" style="display: none;">
            ${renderMyProjectsView(byProject)}
        </div>
        
        <div id="my-analytics-charts" class="my-analytics-content" style="display: none;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 2rem;">
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">📆 Weekly Hours Trend</h3>
                    <div style="height: 300px;"><canvas id="myWeeklyChart"></canvas></div>
                </div>
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">🗓️ Monthly Hours</h3>
                    <div style="height: 300px;"><canvas id="myMonthlyChart"></canvas></div>
                </div>
                <div class="card" style="grid-column: span 2;">
                    <h3 style="margin-bottom: 1rem;">📁 Hours by Project</h3>
                    <div style="height: 300px;"><canvas id="myProjectChart"></canvas></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render Daily View
 */
function renderMyDailyView(daily) {
    if (!daily?.length) {
        return '<div class="card" style="padding: 2rem; text-align: center;">No daily entries found.</div>';
    }
    
    const rows = daily.map(d => {
        const date = new Date(d.date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const isToday = d.date === new Date().toISOString().split('T')[0];
        
        const projectsList = d.entries.map(e => `<span style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; margin-right: 4px;">${e.projectCode || e.projectName}: ${e.hours}h</span>`).join('');
        
        return `
            <tr style="${isToday ? 'background: #dbeafe;' : ''}">
                <td style="font-weight: 600;">${dayName}</td>
                <td>${dateStr} ${isToday ? '<span style="background: var(--success); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">TODAY</span>' : ''}</td>
                <td style="font-weight: 700; color: var(--primary-blue);">${d.hours.toFixed(1)}h</td>
                <td>${projectsList}</td>
            </tr>
        `;
    }).join('');
    
    return `
        <div class="card">
            <h3 style="margin-bottom: 1rem;">📅 Daily Hours (Last 30 Days)</h3>
            <div style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Date</th>
                            <th>Hours</th>
                            <th>Projects</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Render Weekly View
 */
function renderMyWeeklyView(weekly) {
    if (!weekly?.length) {
        return '<div class="card" style="padding: 2rem; text-align: center;">No weekly data found.</div>';
    }
    
    const rows = weekly.map((w, i) => {
        const isCurrentWeek = i === weekly.length - 1;
        return `
            <tr style="${isCurrentWeek ? 'background: #dbeafe;' : ''}">
                <td style="font-weight: 600;">${w.weekLabel} ${isCurrentWeek ? '<span style="background: var(--success); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">CURRENT</span>' : ''}</td>
                <td style="font-weight: 700; color: var(--primary-blue);">${w.hours.toFixed(1)}h</td>
                <td>${w.daysWorked}</td>
                <td>${w.projects}</td>
                <td style="color: var(--success);">${w.avgPerDay.toFixed(2)}h</td>
            </tr>
        `;
    }).join('');
    
    return `
        <div class="card">
            <h3 style="margin-bottom: 1rem;">📆 Weekly Summary</h3>
            <div style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Week</th>
                            <th>Total Hours</th>
                            <th>Days Worked</th>
                            <th>Projects</th>
                            <th>Avg/Day</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Render Monthly View
 */
function renderMyMonthlyView(monthly) {
    if (!monthly?.length) {
        return '<div class="card" style="padding: 2rem; text-align: center;">No monthly data found.</div>';
    }
    
    const rows = monthly.map((m, i) => {
        const isCurrentMonth = i === monthly.length - 1;
        return `
            <tr style="${isCurrentMonth ? 'background: #ede9fe;' : ''}">
                <td style="font-weight: 600;">${m.monthLabel} ${isCurrentMonth ? '<span style="background: #8b5cf6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">CURRENT</span>' : ''}</td>
                <td style="font-weight: 700; color: #8b5cf6;">${m.hours.toFixed(1)}h</td>
                <td>${m.daysWorked}</td>
                <td>${m.projects}</td>
                <td style="color: var(--success);">${m.avgPerDay.toFixed(2)}h</td>
            </tr>
        `;
    }).join('');
    
    return `
        <div class="card">
            <h3 style="margin-bottom: 1rem;">🗓️ Monthly Summary</h3>
            <div style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th>Total Hours</th>
                            <th>Days Worked</th>
                            <th>Projects</th>
                            <th>Avg/Day</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Render Projects View
 */
function renderMyProjectsView(byProject) {
    if (!byProject?.length) {
        return '<div class="card" style="padding: 2rem; text-align: center;">No project data found.</div>';
    }
    
    const totalHours = byProject.reduce((sum, p) => sum + p.hours, 0);
    
    const rows = byProject.map((p, i) => {
        const percentage = totalHours > 0 ? (p.hours / totalHours * 100).toFixed(1) : 0;
        return `
            <tr>
                <td style="font-weight: 600;">${i + 1}</td>
                <td>
                    <strong>${p.projectName}</strong><br>
                    <small style="color: var(--text-light);">${p.projectCode || 'No Code'}</small>
                </td>
                <td style="font-weight: 700; color: var(--primary-blue);">${p.hours.toFixed(1)}h</td>
                <td>${p.entries}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="flex: 1; background: #e5e7eb; border-radius: 10px; height: 10px; overflow: hidden;">
                            <div style="width: ${percentage}%; background: var(--primary-blue); height: 100%;"></div>
                        </div>
                        <span style="font-size: 0.85rem; color: var(--text-light);">${percentage}%</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    return `
        <div class="card">
            <h3 style="margin-bottom: 1rem;">📁 Hours by Project</h3>
            <div style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Project</th>
                            <th>Hours</th>
                            <th>Entries</th>
                            <th>% of Total</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Tab Switching for Designer Self-View
 */
function showMyAnalyticsTab(tabName, btn) {
    document.querySelectorAll('.my-analytics-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.my-analytics-content').forEach(c => c.style.display = 'none');
    
    btn.classList.add('active');
    document.getElementById(`my-analytics-${tabName}`).style.display = 'block';
    
    if (tabName === 'charts') {
        apiCall('timesheets?action=my_analytics').then(res => {
            if (res.success) renderMyAnalyticsCharts(res.data.weekly, res.data.monthly, res.data.byProject);
        });
    }
}

/**
 * Render Charts for Designer Self-View
 */
function renderMyAnalyticsCharts(weekly, monthly, byProject) {
    // Weekly Chart
    const weeklyCtx = document.getElementById('myWeeklyChart');
    if (weeklyCtx && typeof Chart !== 'undefined') {
        if (Chart.getChart(weeklyCtx)) Chart.getChart(weeklyCtx).destroy();
        new Chart(weeklyCtx, {
            type: 'line',
            data: {
                labels: weekly.map(w => w.weekLabel),
                datasets: [{
                    label: 'Hours',
                    data: weekly.map(w => w.hours),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    
    // Monthly Chart
    const monthlyCtx = document.getElementById('myMonthlyChart');
    if (monthlyCtx && typeof Chart !== 'undefined') {
        if (Chart.getChart(monthlyCtx)) Chart.getChart(monthlyCtx).destroy();
        new Chart(monthlyCtx, {
            type: 'bar',
            data: {
                labels: monthly.map(m => m.monthLabel),
                datasets: [{
                    label: 'Hours',
                    data: monthly.map(m => m.hours),
                    backgroundColor: '#8b5cf6'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    
    // Project Chart
    const projectCtx = document.getElementById('myProjectChart');
    if (projectCtx && typeof Chart !== 'undefined') {
        if (Chart.getChart(projectCtx)) Chart.getChart(projectCtx).destroy();
        const top10 = byProject.slice(0, 10);
        new Chart(projectCtx, {
            type: 'bar',
            data: {
                labels: top10.map(p => p.projectCode || p.projectName.substring(0, 15)),
                datasets: [{
                    label: 'Hours',
                    data: top10.map(p => p.hours),
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

/**
 * Download Designer's Own Analytics Excel
 */
async function downloadMyAnalyticsExcel() {
    try {
        showLoading();
        const response = await apiCall('timesheets?action=my_analytics');
        if (!response.success) throw new Error('Failed to fetch data');
        
        const { summary, daily, weekly, monthly, byProject } = response.data;
        
        if (typeof XLSX === 'undefined') {
            alert('Excel library not loaded. Please refresh the page.');
            return;
        }
        
        const wb = XLSX.utils.book_new();
        
        // Summary Sheet
        const summaryData = [
            ['My Working Hours Report'],
            ['Generated: ' + new Date().toLocaleString()],
            [''],
            ['Metric', 'Value'],
            ['Total Hours', summary.totalHours],
            ['Days Worked', summary.totalWorkingDays],
            ['Avg Hours/Day', summary.avgDailyHours],
            ['Avg Hours/Week', summary.avgWeeklyHours],
            ['Avg Hours/Month', summary.avgMonthlyHours],
            ['Total Projects', summary.totalProjects]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');
        
        // Daily Sheet
        const dailyData = [['Date', 'Hours', 'Projects']];
        daily.forEach(d => {
            const projects = d.entries.map(e => `${e.projectName}: ${e.hours}h`).join(', ');
            dailyData.push([d.date, d.hours, projects]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dailyData), 'Daily');
        
        // Weekly Sheet
        const weeklyData = [['Week', 'Hours', 'Days Worked', 'Projects', 'Avg/Day']];
        weekly.forEach(w => weeklyData.push([w.weekLabel, w.hours, w.daysWorked, w.projects, w.avgPerDay]));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(weeklyData), 'Weekly');
        
        // Monthly Sheet
        const monthlyData = [['Month', 'Hours', 'Days Worked', 'Projects', 'Avg/Day']];
        monthly.forEach(m => monthlyData.push([m.monthLabel, m.hours, m.daysWorked, m.projects, m.avgPerDay]));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(monthlyData), 'Monthly');
        
        // By Project Sheet
        const projectData = [['Project', 'Code', 'Hours', 'Entries']];
        byProject.forEach(p => projectData.push([p.projectName, p.projectCode, p.hours, p.entries]));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(projectData), 'By Project');
        
        XLSX.writeFile(wb, `My_Hours_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Expose analytics functions to window for onclick handlers
window.showDesignerWeeklyAnalytics = showDesignerWeeklyAnalytics;
window.showMyAnalytics = showMyAnalytics;
window.showAnalyticsTab = showAnalyticsTab;
window.showMyAnalyticsTab = showMyAnalyticsTab;
window.downloadDesignerWeeklyExcel = downloadDesignerWeeklyExcel;
window.downloadDesignerMonthlyExcel = downloadDesignerMonthlyExcel;
window.downloadMyAnalyticsExcel = downloadMyAnalyticsExcel;

console.log('✅ Designer Analytics Module v3.0.0 loaded');

// ============================================
// EBTRACKER ANALYTICS DASHBOARD (V2)
// Analytics for BDM, COO, and Director roles.
// ============================================

// Chart.js Global Colors for Analytics
const CHART_COLORS = {
    blue: 'rgba(0, 191, 255, 0.7)',
    darkBlue: 'rgba(0, 153, 204, 1)',
    green: 'rgba(39, 174, 96, 0.7)',
    red: 'rgba(231, 76, 60, 0.7)',
    yellow: 'rgba(243, 156, 18, 0.7)',
    grey: 'rgba(127, 140, 141, 0.7)',
    purple: 'rgba(155, 89, 182, 0.7)',
    orange: 'rgba(230, 126, 34, 0.7)',
};

/**
 * Main function to show the Analytics Dashboard.
 */
async function showAnalyticsDashboard() {
    setActiveNav('nav-analytics');
    const main = document.getElementById('mainContent');
    main.style.display = 'block';
    showLoading();

    try {
        main.innerHTML = getAnalyticsHTML(currentUserRole);
        const analyticsData = await loadAnalyticsData(currentUserRole);
        renderKpiCards(analyticsData.kpis, currentUserRole);
        renderMonthlyRevenueChart(analyticsData.monthlyRevenue);
        renderStatusPieChart(analyticsData.statusCounts);

        if (currentUserRole !== 'bdm') {
            if (analyticsData.bdmPerformance) {
                renderBdmPerformanceChart(analyticsData.bdmPerformance);
            }
            if (analyticsData.weeklyRevenue) {
                renderWeeklyRevenueChart(analyticsData.weeklyRevenue);
            }
            if (analyticsData.regionalData) {
                renderRegionalPieChart(analyticsData.regionalData);
            }
        }

    } catch (error) {
        console.error('❌ Error loading analytics:', error);
        main.innerHTML = `<div class="card" style="padding: 3rem; text-align: center;">
            <h3 style="color: var(--danger);">⚠️ Error Loading Analytics</h3>
            <p style="color: var(--text-light); margin: 1rem 0;">${error.message}</p>
            <button onclick="showAnalyticsDashboard()" class="btn btn-primary">🔄 Retry</button>
        </div>`;
    } finally {
        hideLoading();
    }
}

/**
 * Returns the HTML skeleton for the analytics dashboard
 */
function getAnalyticsHTML(role) {
    const isDirectorView = role === 'coo' || role === 'director';
    const title = isDirectorView ? '📊 Company Analytics Dashboard' : '📈 My BDM Analytics';

    const directorCharts = `
        <div class="card">
            <h3 style="margin-bottom: 1rem;">BDM Performance (Won Revenue)</h3>
            <div style="position: relative; height: 350px;">
                <canvas id="bdmPerformanceChart"></canvas>
            </div>
        </div>

        <div class="card">
            <h3 style="margin-bottom: 1rem;">Regional Business (Won Revenue)</h3>
            <div style="position: relative; height: 350px; display: flex; align-items: center; justify-content: center;">
                <canvas id="regionalPieChart" style="max-height: 350px; max-width: 350px;"></canvas>
            </div>
        </div>

        <div class="card">
            <h3 style="margin-bottom: 1rem;">Weekly Revenue (Last 16 Weeks)</h3>
            <div style="position: relative; height: 350px;">
                <canvas id="weeklyRevenueChart"></canvas>
            </div>
        </div>
    `;

    return `
        <div class="page-header">
            <h2>${title}</h2>
            <p class="subtitle">Insights on proposals and revenue</p>
        </div>
        
        <div class="dashboard-stats" id="bdm-kpi-cards"></div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 2rem; margin-top: 2rem;">
            
            <div class="card">
                <h3 style="margin-bottom: 1rem;">Monthly Revenue (Last 12 Months)</h3>
                <div style="position: relative; height: 350px;">
                    <canvas id="monthlyRevenueChart"></canvas>
                </div>
            </div>

            <div class="card">
                <h3 style="margin-bottom: 1rem;">Proposal Status Breakdown</h3>
                <div style="position: relative; height: 350px; display: flex; align-items: center; justify-content: center;">
                    <canvas id="statusPieChart" style="max-height: 350px; max-width: 350px;"></canvas>
                </div>
            </div>

            ${isDirectorView ? directorCharts : ''}
        </div>
    `;
}

/**
 * Fetches and processes all proposal data for analytics
 */
async function loadAnalyticsData(role) {
    const response = await apiCall('proposals');
    if (!response.success || !response.data) {
        throw new Error('Failed to fetch proposal data');
    }

    let proposals;
    if (role === 'bdm') {
        proposals = response.data.filter(p => p.createdByUid === currentUser.uid);
    } else {
        proposals = response.data;
    }

    const wonProposals = proposals.filter(p => p.status === 'won');
    const lostProposals = proposals.filter(p => p.status === 'lost');
    
    const totalRevenue = wonProposals.reduce((sum, p) => sum + (p.pricing?.quoteValue || 0), 0);
    const totalWon = wonProposals.length;
    const totalLost = lostProposals.length;
    const totalProposals = proposals.length;
    const winRate = (totalWon + totalLost) > 0 ? (totalWon / (totalWon + totalLost)) * 100 : 0;
    const avgDealValue = totalWon > 0 ? totalRevenue / totalWon : 0;

    const kpis = { totalRevenue, totalProposals, winRate, avgDealValue, totalWon, totalLost };

    // Monthly Revenue
    const monthlyRevenue = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        monthlyRevenue[label] = 0;
    }

    wonProposals.forEach(p => {
        let date = parseAnalyticsDate(p.wonDate) || parseAnalyticsDate(p.updatedAt);
        if (date && !isNaN(date.getTime())) {
            const label = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            if (monthlyRevenue.hasOwnProperty(label)) {
                monthlyRevenue[label] += (p.pricing?.quoteValue || 0);
            }
        }
    });

    // Status Counts
    const statusCounts = { Won: 0, Lost: 0, Pending: 0, Pricing: 0, Draft: 0 };
    proposals.forEach(p => {
        switch (p.status) {
            case 'won': statusCounts.Won++; break;
            case 'lost': statusCounts.Lost++; break;
            case 'submitted_to_client':
            case 'approved': statusCounts.Pending++; break;
            case 'estimated':
            case 'pricing_complete':
            case 'pending_director_approval': statusCounts.Pricing++; break;
            default: statusCounts.Draft++; break;
        }
    });

    // COO/Director specific data
    let bdmPerformance = null, weeklyRevenue = null, regionalData = null;

    if (role !== 'bdm') {
        bdmPerformance = {};
        wonProposals.forEach(p => {
            const bdmName = p.createdByName || 'Unknown';
            bdmPerformance[bdmName] = (bdmPerformance[bdmName] || 0) + (p.pricing?.quoteValue || 0);
        });

        weeklyRevenue = {};
        const today = new Date();
        for (let i = 15; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (i * 7));
            const weekStart = getAnalyticsWeekStart(d);
            weeklyRevenue[weekStart] = 0;
        }
        wonProposals.forEach(p => {
            let date = parseAnalyticsDate(p.wonDate);
            if (date && !isNaN(date.getTime())) {
                const weekStart = getAnalyticsWeekStart(date);
                if (weeklyRevenue.hasOwnProperty(weekStart)) {
                    weeklyRevenue[weekStart] += (p.pricing?.quoteValue || 0);
                }
            }
        });
        
        regionalData = {};
        wonProposals.forEach(p => {
            const region = p.country || 'Unknown';
            regionalData[region] = (regionalData[region] || 0) + (p.pricing?.quoteValue || 0);
        });
    }

    return { kpis, monthlyRevenue, statusCounts, bdmPerformance, weeklyRevenue, regionalData };
}

function parseAnalyticsDate(dateValue) {
    if (!dateValue) return null;
    if (dateValue.seconds !== undefined) return new Date(Number(dateValue.seconds) * 1000);
    if (dateValue._seconds !== undefined) return new Date(Number(dateValue._seconds) * 1000);
    if (typeof dateValue === 'string' || typeof dateValue === 'number') return new Date(dateValue);
    return null;
}

function getAnalyticsWeekStart(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff)).toISOString().split('T')[0];
}

/**
 * Format currency - compact for large numbers
 */
function formatCurrencyCompact(value) {
    if (value === null || value === undefined || isNaN(value)) return '$0';
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
        return '$' + (value / 1000000).toFixed(1) + 'M';
    } else if (absValue >= 10000) {
        return '$' + (value / 1000).toFixed(0) + 'K';
    } else if (absValue >= 1000) {
        return '$' + (value / 1000).toFixed(1) + 'K';
    }
    return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * Format currency - full display
 */
function formatCurrencyFull(value) {
    if (value === null || value === undefined || isNaN(value)) return '$0';
    return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/**
 * Renders the KPI cards - FIXED FOR APPLE/MOBILE VIEW
 */
function renderKpiCards(kpis, role) {
    const container = document.getElementById('bdm-kpi-cards');
    
    const bdmCards = `
        <div class="stat-card">
            <div class="stat-number">${kpis.totalProposals}</div>
            <div class="stat-label">Total Proposals</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" style="color: ${CHART_COLORS.green}">${kpis.totalWon}</div>
            <div class="stat-label">Proposals Won</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" style="color: ${CHART_COLORS.red}">${kpis.totalLost}</div>
            <div class="stat-label">Proposals Lost</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${kpis.winRate.toFixed(1)}%</div>
            <div class="stat-label">Win Rate</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" title="${formatCurrencyFull(kpis.totalRevenue)}">${formatCurrencyCompact(kpis.totalRevenue)}</div>
            <div class="stat-label">Total Revenue (Won)</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" title="${formatCurrencyFull(kpis.avgDealValue)}">${formatCurrencyCompact(kpis.avgDealValue)}</div>
            <div class="stat-label">Avg. Revenue (Won)</div>
        </div>
    `;

    const directorCards = `
        <div class="stat-card">
            <div class="stat-number" style="color: var(--primary-blue);" title="${formatCurrencyFull(kpis.totalRevenue)}">${formatCurrencyCompact(kpis.totalRevenue)}</div>
            <div class="stat-label">Total Revenue (Won)</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" style="color: var(--success);" title="${formatCurrencyFull(kpis.avgDealValue)}">${formatCurrencyCompact(kpis.avgDealValue)}</div>
            <div class="stat-label">Avg. Revenue (Won)</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" style="color: var(--warning);">${kpis.winRate.toFixed(1)}%</div>
            <div class="stat-label">Company Win Rate</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" style="color: #8b5cf6;">${kpis.totalProposals}</div>
            <div class="stat-label">Total Proposals</div>
        </div>
    `;

    container.innerHTML = (role === 'bdm') ? bdmCards : directorCards;
}

/**
 * Renders the Monthly Revenue bar chart
 */
function renderMonthlyRevenueChart(monthlyRevenue) {
    const ctx = document.getElementById('monthlyRevenueChart')?.getContext('2d');
    if (!ctx) return;
    
    const displayLabels = Object.keys(monthlyRevenue).map(label => {
        const [year, month] = label.split('-');
        return new Date(year, month - 1, 1).toLocaleString('default', { month: 'short', year: '2-digit' });
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: displayLabels,
            datasets: [{
                label: 'Revenue',
                data: Object.values(monthlyRevenue),
                backgroundColor: CHART_COLORS.blue,
                borderColor: CHART_COLORS.darkBlue,
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { callback: (v) => formatAnalyticsAxisValue(v) } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => formatAnalyticsTooltip(ctx) } } }
        }
    });
}

/**
 * Renders the Proposal Status pie chart
 */
function renderStatusPieChart(statusCounts) {
    const ctx = document.getElementById('statusPieChart')?.getContext('2d');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: [CHART_COLORS.green, CHART_COLORS.red, CHART_COLORS.blue, CHART_COLORS.yellow, CHART_COLORS.grey],
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

/**
 * Renders the BDM Performance bar chart (COO/Director only)
 */
function renderBdmPerformanceChart(bdmData) {
    const ctx = document.getElementById('bdmPerformanceChart')?.getContext('2d');
    if (!ctx) return;
    
    const sortedData = Object.entries(bdmData).sort(([, a], [, b]) => b - a);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedData.map(item => item[0]),
            datasets: [{
                label: 'Revenue Won',
                data: sortedData.map(item => item[1]),
                backgroundColor: [CHART_COLORS.green, CHART_COLORS.blue, CHART_COLORS.yellow, CHART_COLORS.purple, CHART_COLORS.orange, CHART_COLORS.red, CHART_COLORS.grey],
                borderColor: '#ffffff',
                borderWidth: 2,
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { beginAtZero: true, ticks: { callback: (v) => formatAnalyticsAxisValue(v) } },
                y: { grid: { display: false } }
            },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => formatAnalyticsTooltip(ctx) } } }
        }
    });
}

/**
 * Renders the Weekly Revenue line chart (COO/Director only)
 */
function renderWeeklyRevenueChart(weeklyData) {
    const ctx = document.getElementById('weeklyRevenueChart')?.getContext('2d');
    if (!ctx) return;
    
    const displayLabels = Object.keys(weeklyData).map(label => {
        const [year, month, day] = label.split('-');
        return `${month}/${day}`;
    });

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: displayLabels,
            datasets: [{
                label: 'Revenue',
                data: Object.values(weeklyData),
                backgroundColor: CHART_COLORS.blue,
                borderColor: CHART_COLORS.darkBlue,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { callback: (v) => formatAnalyticsAxisValue(v) } },
                x: { grid: { display: false } }
            },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => formatAnalyticsTooltip(ctx) } } }
        }
    });
}

/**
 * Renders the Regional Business pie chart (COO/Director only)
 */
function renderRegionalPieChart(regionalData) {
    const ctx = document.getElementById('regionalPieChart')?.getContext('2d');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(regionalData),
            datasets: [{
                data: Object.values(regionalData),
                backgroundColor: [CHART_COLORS.blue, CHART_COLORS.green, CHART_COLORS.yellow, CHART_COLORS.purple, CHART_COLORS.orange, CHART_COLORS.red, CHART_COLORS.grey],
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (ctx) => formatAnalyticsTooltipWithLabel(ctx) } } }
        }
    });
}

function formatAnalyticsAxisValue(value) {
    if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
    if (value >= 10000) return '$' + (value / 1000).toFixed(0) + 'k';
    if (value >= 1000) return '$' + (value / 1000).toFixed(1) + 'k';
    return '$' + value.toLocaleString();
}

function formatAnalyticsTooltip(context) {
    let label = context.dataset.label || '';
    if (label) label += ': ';
    const value = context.parsed.y !== null ? context.parsed.y : context.raw;
    return label + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatAnalyticsTooltipWithLabel(context) {
    return `${context.label}: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.raw)}`;
}

// Expose Analytics functions to window
window.showAnalyticsDashboard = showAnalyticsDashboard;


// ============================================
// HR CANDIDATE SCREENING MODULE
// Version: 1.0.0
// Flow: HR sends link → Candidate fills ALL details → HR sees results
// ============================================

let screeningData = { screenings: [], loading: false };

// Main Dashboard
window.showHRScreening = async function() {
    const main = document.querySelector('main');
    if (!main) return;
    
    main.innerHTML = `
        <div class="page-header">
            <h2>📝 Candidate Screening</h2>
            <p class="subtitle">Send assessment links to candidates and view their responses</p>
        </div>
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:2rem;">
            <div style="background:white;padding:1.5rem;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);text-align:center;">
                <div style="font-size:2.5rem;font-weight:700;color:var(--primary-blue);" id="statTotal">0</div>
                <div style="color:var(--text-light);">Total Sent</div>
            </div>
            <div style="background:white;padding:1.5rem;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);text-align:center;">
                <div style="font-size:2.5rem;font-weight:700;color:#f59e0b;" id="statPending">0</div>
                <div style="color:var(--text-light);">Awaiting Response</div>
            </div>
            <div style="background:white;padding:1.5rem;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);text-align:center;">
                <div style="font-size:2.5rem;font-weight:700;color:#10b981;" id="statSubmitted">0</div>
                <div style="color:var(--text-light);">Completed</div>
            </div>
            <div style="background:white;padding:1.5rem;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);text-align:center;">
                <div style="font-size:2.5rem;font-weight:700;color:#8b5cf6;" id="statAvgScore">-</div>
                <div style="color:var(--text-light);">Avg Score</div>
            </div>
        </div>
        
        <div style="display:flex;gap:1rem;margin-bottom:2rem;flex-wrap:wrap;">
            <button onclick="openCreateScreeningModal()" style="padding:0.85rem 1.75rem;background:linear-gradient(135deg,#00b8b8,#009999);color:white;border:none;border-radius:10px;cursor:pointer;font-weight:600;font-size:1rem;display:flex;align-items:center;gap:0.5rem;box-shadow:0 4px 15px rgba(0,184,184,0.3);">
                ➕ Send New Screening Link
            </button>
            <button onclick="exportScreeningData()" style="padding:0.85rem 1.75rem;background:white;color:var(--text-dark);border:2px solid var(--border);border-radius:10px;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:0.5rem;">
                📊 Export Report
            </button>
        </div>
        
        <div style="background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden;">
            <div style="display:flex;border-bottom:1px solid var(--border);overflow-x:auto;">
                <button onclick="filterScreeningList('all')" class="scr-tab active" data-filter="all" style="padding:1rem 1.5rem;border:none;background:transparent;cursor:pointer;font-weight:600;color:var(--primary-blue);border-bottom:3px solid var(--primary-blue);white-space:nowrap;">All</button>
                <button onclick="filterScreeningList('pending')" class="scr-tab" data-filter="pending" style="padding:1rem 1.5rem;border:none;background:transparent;cursor:pointer;color:var(--text-light);border-bottom:3px solid transparent;white-space:nowrap;">⏳ Pending</button>
                <button onclick="filterScreeningList('submitted')" class="scr-tab" data-filter="submitted" style="padding:1rem 1.5rem;border:none;background:transparent;cursor:pointer;color:var(--text-light);border-bottom:3px solid transparent;white-space:nowrap;">📝 Submitted</button>
                <button onclick="filterScreeningList('reviewed')" class="scr-tab" data-filter="reviewed" style="padding:1rem 1.5rem;border:none;background:transparent;cursor:pointer;color:var(--text-light);border-bottom:3px solid transparent;white-space:nowrap;">✅ Reviewed</button>
            </div>
            <div style="padding:1rem;border-bottom:1px solid var(--border);">
                <input type="text" id="scrSearch" placeholder="🔍 Search by name, email, or position..." oninput="searchScreeningList(this.value)" style="width:100%;max-width:400px;padding:0.75rem 1rem;border:1px solid var(--border);border-radius:8px;">
            </div>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;">
                    <thead><tr style="background:#f8fafc;">
                        <th style="padding:1rem;text-align:left;font-weight:600;">Candidate</th>
                        <th style="padding:1rem;text-align:left;font-weight:600;">Position</th>
                        <th style="padding:1rem;text-align:left;font-weight:600;">Status</th>
                        <th style="padding:1rem;text-align:left;font-weight:600;">Score</th>
                        <th style="padding:1rem;text-align:left;font-weight:600;">Date</th>
                        <th style="padding:1rem;text-align:center;font-weight:600;">Actions</th>
                    </tr></thead>
                    <tbody id="scrTableBody"><tr><td colspan="6" style="padding:3rem;text-align:center;color:var(--text-light);">Loading...</td></tr></tbody>
                </table>
            </div>
        </div>
    `;
    await loadScreeningList();
};

async function loadScreeningList() {
    try {
        showLoading && showLoading();
        const res = await apiCall('screening?path=list');
        if (res.success && res.data) {
            screeningData.screenings = res.data;
        } else {
            screeningData.screenings = [];
        }
    } catch(e) { 
        console.error('Failed to load screenings:', e);
        screeningData.screenings = []; 
    }
    renderScreeningList(screeningData.screenings);
    updateScreeningStats();
    hideLoading && hideLoading();
}

function renderScreeningList(list) {
    const tbody = document.getElementById('scrTableBody');
    if (!tbody) return;
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="6" style="padding:3rem;text-align:center;color:var(--text-light);"><div style="font-size:3rem;margin-bottom:1rem;">📋</div>No screenings yet. Click "Send New Screening Link" to start.</td></tr>'; return; }
    
    tbody.innerHTML = list.map(s => {
        const statusMap = { pending:{bg:'#fef3c7',color:'#92400e',icon:'⏳',text:'Awaiting'}, submitted:{bg:'#dbeafe',color:'#1e40af',icon:'📝',text:'Submitted'}, reviewed:{bg:'#d1fae5',color:'#065f46',icon:'✅',text:'Reviewed'} };
        const st = statusMap[s.status] || statusMap.pending;
        const scoreColor = s.scores ? (s.scores.percentage >= 80 ? '#10b981' : s.scores.percentage >= 60 ? '#f59e0b' : '#ef4444') : '#9ca3af';
        return `<tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:1rem;"><div style="font-weight:600;">${s.candidateName || '<span style="color:#f59e0b;font-style:italic;">Awaiting response...</span>'}</div><div style="font-size:0.85rem;color:var(--text-light);">${s.candidateEmail}</div>${s.candidatePhone?`<div style="font-size:0.8rem;color:var(--text-light);">${s.candidatePhone}</div>`:''}</td>
            <td style="padding:1rem;">${s.position}</td>
            <td style="padding:1rem;"><span style="padding:0.4rem 0.85rem;border-radius:20px;font-size:0.85rem;font-weight:500;background:${st.bg};color:${st.color};">${st.icon} ${st.text}</span>${s.decision?`<div style="margin-top:0.25rem;font-size:0.8rem;color:${s.decision==='Selected'?'#10b981':'#ef4444'};font-weight:600;">${s.decision}</div>`:''}</td>
            <td style="padding:1rem;"><span style="font-size:1.25rem;font-weight:700;color:${scoreColor};">${s.scores?s.scores.percentage+'%':'-'}</span></td>
            <td style="padding:1rem;font-size:0.9rem;color:var(--text-light);">${s.sentAt?new Date(s.sentAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short'}):'-'}</td>
            <td style="padding:1rem;"><div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">
                ${s.status==='pending'?`<button onclick="copyScreeningURL('${s.token}')" title="Copy Link" style="padding:0.5rem 0.75rem;background:#f3f4f6;border:none;border-radius:6px;cursor:pointer;">🔗 Copy</button><button onclick="resendScreeningLink('${s.id}','${s.candidateEmail}')" title="Resend" style="padding:0.5rem;background:#dbeafe;border:none;border-radius:6px;cursor:pointer;">📧</button>`:`<button onclick="viewScreeningResult('${s.id}')" title="View" style="padding:0.5rem 0.75rem;background:#dbeafe;border:none;border-radius:6px;cursor:pointer;">👁️ View</button>`}
                <button onclick="removeScreening('${s.id}')" title="Delete" style="padding:0.5rem;background:#fee2e2;border:none;border-radius:6px;cursor:pointer;">🗑️</button>
            </div></td>
        </tr>`;
    }).join('');
}

function updateScreeningStats() {
    const list = screeningData.screenings, el = id => document.getElementById(id);
    if (el('statTotal')) el('statTotal').textContent = list.length;
    if (el('statPending')) el('statPending').textContent = list.filter(s => s.status === 'pending').length;
    if (el('statSubmitted')) el('statSubmitted').textContent = list.filter(s => s.status === 'submitted' || s.status === 'reviewed').length;
    const ws = list.filter(s => s.scores);
    if (el('statAvgScore')) el('statAvgScore').textContent = ws.length ? Math.round(ws.reduce((a,b) => a + b.scores.percentage, 0) / ws.length) + '%' : '-';
}

window.filterScreeningList = function(f) {
    document.querySelectorAll('.scr-tab').forEach(t => { t.style.color = t.dataset.filter === f ? 'var(--primary-blue)' : 'var(--text-light)'; t.style.fontWeight = t.dataset.filter === f ? '600' : '400'; t.style.borderBottomColor = t.dataset.filter === f ? 'var(--primary-blue)' : 'transparent'; });
    renderScreeningList(f === 'all' ? screeningData.screenings : screeningData.screenings.filter(s => s.status === f));
};

window.searchScreeningList = function(q) {
    const query = q.toLowerCase().trim();
    renderScreeningList(!query ? screeningData.screenings : screeningData.screenings.filter(s => (s.candidateName||'').toLowerCase().includes(query) || (s.candidateEmail||'').toLowerCase().includes(query) || (s.position||'').toLowerCase().includes(query)));
};

// CREATE MODAL - HR only enters position + job description
window.openCreateScreeningModal = function() {
    const m = document.createElement('div'); m.id = 'createScrModal';
    m.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;';
    m.innerHTML = `<div style="max-width:600px;width:100%;background:white;border-radius:16px;overflow:hidden;">
        <div style="padding:1.5rem;background:linear-gradient(135deg,#00b8b8,#009999);color:white;display:flex;justify-content:space-between;align-items:center;"><h2 style="margin:0;font-size:1.25rem;">📝 Create Screening Link</h2><span onclick="closeCreateScrModal()" style="cursor:pointer;font-size:1.5rem;">&times;</span></div>
        <div style="padding:1.5rem;">
            <div style="background:#e0f2fe;padding:1rem;border-radius:8px;margin-bottom:1.5rem;">
                <p style="margin:0;color:#0369a1;font-size:0.9rem;">💡 <strong>One link, multiple candidates!</strong> Create a screening link for a position and share it with as many candidates as you want. Each candidate will fill their own details.</p>
            </div>
            
            <div style="margin-bottom:1.25rem;">
                <label style="display:block;margin-bottom:0.5rem;font-weight:600;">Position / Job Title <span style="color:#ef4444;">*</span></label>
                <select id="scrPosition" style="width:100%;padding:0.85rem;border:1px solid #e5e7eb;border-radius:8px;font-size:1rem;background:white;">
                    <option value="">Select position...</option>
                    <option>Steel Detailer</option>
                    <option>Junior Designer</option>
                    <option>Senior Designer</option>
                    <option>BIM Coordinator</option>
                    <option>Project Manager</option>
                    <option>Checker</option>
                    <option>Design Lead</option>
                    <option>Trainee</option>
                </select>
            </div>
            
            <div style="margin-bottom:1.25rem;">
                <label style="display:block;margin-bottom:0.5rem;font-weight:600;">Job Description</label>
                <textarea id="scrJobDesc" rows="4" placeholder="Enter job responsibilities, requirements, skills needed..." style="width:100%;padding:0.85rem;border:1px solid #e5e7eb;border-radius:8px;font-size:1rem;resize:vertical;"></textarea>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                <div>
                    <label style="display:block;margin-bottom:0.5rem;font-weight:600;">Experience Required</label>
                    <select id="scrExperience" style="width:100%;padding:0.85rem;border:1px solid #e5e7eb;border-radius:8px;font-size:1rem;background:white;">
                        <option value="">Any</option>
                        <option>Fresher</option>
                        <option>0-1 years</option>
                        <option>1-2 years</option>
                        <option>2-3 years</option>
                        <option>3-5 years</option>
                        <option>5+ years</option>
                    </select>
                </div>
                <div>
                    <label style="display:block;margin-bottom:0.5rem;font-weight:600;">Link Validity</label>
                    <select id="scrExpiry" style="width:100%;padding:0.85rem;border:1px solid #e5e7eb;border-radius:8px;font-size:1rem;background:white;">
                        <option value="7">7 Days</option>
                        <option value="14">14 Days</option>
                        <option value="30" selected>30 Days</option>
                        <option value="60">60 Days</option>
                        <option value="90">90 Days</option>
                    </select>
                </div>
            </div>
        </div>
        <div style="padding:1.5rem;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:1rem;background:#f9fafb;">
            <button onclick="closeCreateScrModal()" style="padding:0.75rem 1.5rem;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;">Cancel</button>
            <button onclick="generateScreeningLink()" style="padding:0.75rem 1.5rem;background:linear-gradient(135deg,#00b8b8,#009999);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">🔗 Generate Link</button>
        </div>
    </div>`;
    document.body.appendChild(m);
};

window.closeCreateScrModal = function() { const m = document.getElementById('createScrModal'); if (m) m.remove(); };

window.generateScreeningLink = async function() {
    const position = document.getElementById('scrPosition').value;
    const jobDescription = document.getElementById('scrJobDesc').value.trim();
    const experienceRequired = document.getElementById('scrExperience').value;
    const expiry = document.getElementById('scrExpiry').value;
    
    if (!position) { 
        alert('Please select a position'); 
        return; 
    }
    
    const token = Array.from({length:32}, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*62)]).join('');
    
    try { 
        showLoading && showLoading(); 
        const res = await apiCall('screening?path=create', { 
            method: 'POST', 
            body: JSON.stringify({
                position: position,
                jobDescription: jobDescription,
                experienceRequired: experienceRequired,
                token: token,
                expiryDays: parseInt(expiry),
                createdBy: currentUser?.uid,
                isReusable: true
            }) 
        });
        
        if (!res.success) {
            throw new Error(res.error || 'Failed to create screening');
        }
        
        closeCreateScrModal();
        
        // Add to local screening jobs list
        screeningData.jobs = screeningData.jobs || [];
        screeningData.jobs.unshift({ 
            id: res.data?.id || 'job_' + Date.now(), 
            position: position,
            jobDescription: jobDescription,
            experienceRequired: experienceRequired,
            token: token,
            status: 'active',
            candidateCount: 0,
            createdAt: new Date().toISOString()
        });
        
        hideLoading && hideLoading();
        showLinkModal(token, position);
        loadScreeningList();
        
    } catch(e) {
        hideLoading && hideLoading();
        console.error('Failed to create screening:', e);
        alert('❌ Failed to create screening link. Please check if backend is running.\n\nError: ' + (e.message || 'Connection failed'));
    }
};

function showLinkModal(token, position) {
    const url = window.location.origin + '/candidate-screening.html?token=' + token;
    const m = document.createElement('div'); m.id = 'linkModal';
    m.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;';
    m.innerHTML = `<div style="max-width:550px;width:100%;background:white;border-radius:16px;overflow:hidden;"><div style="padding:2.5rem;text-align:center;">
        <div style="font-size:4rem;margin-bottom:1rem;">✅</div>
        <h2 style="color:#10b981;margin:0 0 0.5rem;">Screening Link Created!</h2>
        <p style="color:var(--text-light);margin-bottom:0.5rem;">Position: <strong>${position}</strong></p>
        <p style="color:#059669;font-size:0.9rem;margin-bottom:1.5rem;">📤 Share this link with multiple candidates</p>
        <div style="background:#f3f4f6;padding:1rem;border-radius:8px;margin-bottom:1rem;">
            <div style="display:flex;gap:0.5rem;">
                <input type="text" id="linkInput" value="${url}" readonly style="flex:1;padding:0.75rem;border:1px solid #e5e7eb;border-radius:6px;font-size:0.85rem;">
                <button onclick="copyLinkFromModal()" style="padding:0.75rem 1rem;background:#00b8b8;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;white-space:nowrap;">📋 Copy</button>
            </div>
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:center;margin-bottom:1.5rem;">
            <button onclick="shareViaWhatsApp('${url}','${position}')" style="padding:0.6rem 1rem;background:#25D366;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;">💬 WhatsApp</button>
            <button onclick="shareViaEmail('${url}','${position}')" style="padding:0.6rem 1rem;background:#EA4335;color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;">📧 Email</button>
        </div>
        <div style="background:#fef3c7;padding:1rem;border-radius:8px;margin-bottom:1.5rem;">
            <p style="margin:0;font-size:0.9rem;color:#92400e;">💡 <strong>Tip:</strong> This link can be used by multiple candidates. Each submission will appear separately in your dashboard.</p>
        </div>
        <button onclick="closeLinkModal()" style="padding:0.85rem 2.5rem;background:#00b8b8;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Done</button>
    </div></div>`;
    document.body.appendChild(m);
}

window.shareViaWhatsApp = function(url, position) {
    const text = encodeURIComponent('Hi! Please complete the screening assessment for ' + position + ' position at EDANBROOK:\\n\\n' + url);
    window.open('https://wa.me/?text=' + text, '_blank');
};

window.shareViaEmail = function(url, position) {
    const subject = encodeURIComponent('EDANBROOK - ' + position + ' Position Assessment');
    const body = encodeURIComponent('Dear Candidate,\\n\\nPlease complete the self-assessment form for the ' + position + ' position at EDANBROOK.\\n\\nClick the link below to start:\\n' + url + '\\n\\nBest regards,\\nEDANBROOK HR Team');
    window.open('mailto:?subject=' + subject + '&body=' + body, '_blank');
};

window.copyLinkFromModal = function() { const i = document.getElementById('linkInput'); if (i) { i.select(); navigator.clipboard.writeText(i.value).then(() => alert('✅ Link copied!')).catch(() => { document.execCommand('copy'); alert('✅ Copied!'); }); } };
window.closeLinkModal = function() { const m = document.getElementById('linkModal'); if (m) m.remove(); };
window.copyScreeningURL = function(token) { const url = window.location.origin + '/candidate-screening.html?token=' + token; navigator.clipboard.writeText(url).then(() => alert('✅ Link copied!')).catch(() => prompt('Copy:', url)); };

window.resendScreeningLink = async function(id, email) {
    if (!confirm('Resend link to ' + email + '?')) return;
    try { showLoading && showLoading(); await apiCall('screening?path=resend&id=' + id, { method:'POST' }); } catch(e) {}
    alert('✅ Link resent to ' + email); hideLoading && hideLoading();
};

// VIEW RESULT MODAL - shows ALL candidate-filled data
window.viewScreeningResult = function(id) {
    const s = screeningData.screenings.find(x => x.id === id); if (!s) return;
    const statusMap = { pending:{bg:'#fef3c7',color:'#92400e',text:'⏳ Awaiting'}, submitted:{bg:'#dbeafe',color:'#1e40af',text:'📝 Submitted'}, reviewed:{bg:'#d1fae5',color:'#065f46',text:'✅ Reviewed'} };
    const st = statusMap[s.status] || statusMap.pending;
    const m = document.createElement('div'); m.id = 'viewScrModal';
    m.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;';
    m.innerHTML = `<div style="max-width:800px;width:100%;background:white;border-radius:16px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;">
        <div style="padding:1.5rem;background:linear-gradient(135deg,var(--primary-blue),var(--accent-blue));color:white;display:flex;justify-content:space-between;align-items:center;"><h2 style="margin:0;">📋 Candidate Details</h2><span onclick="closeViewScrModal()" style="cursor:pointer;font-size:1.5rem;">&times;</span></div>
        <div style="padding:1.5rem;overflow-y:auto;flex:1;">
            <div style="background:#f8fafc;padding:1.5rem;border-radius:12px;margin-bottom:1.5rem;">
                <h3 style="margin:0 0 1rem;font-size:1rem;">👤 Candidate Information</h3>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;">
                    <div><div style="font-size:0.8rem;color:var(--text-light);">Full Name</div><div style="font-weight:600;font-size:1.1rem;">${s.candidateName||'<span style="color:#f59e0b;">Not yet provided</span>'}</div></div>
                    <div><div style="font-size:0.8rem;color:var(--text-light);">Email</div><div style="font-weight:600;">${s.candidateEmail}</div></div>
                    <div><div style="font-size:0.8rem;color:var(--text-light);">Phone</div><div style="font-weight:600;">${s.candidatePhone||'-'}</div></div>
                    <div><div style="font-size:0.8rem;color:var(--text-light);">Position</div><div style="font-weight:600;">${s.position}</div></div>
                    <div><div style="font-size:0.8rem;color:var(--text-light);">Experience</div><div style="font-weight:600;">${s.experience||'-'}</div></div>
                    <div><div style="font-size:0.8rem;color:var(--text-light);">Current Company</div><div style="font-weight:600;">${s.currentCompany||'-'}</div></div>
                    <div><div style="font-size:0.8rem;color:var(--text-light);">Expected Salary</div><div style="font-weight:600;color:#059669;">${s.expectedSalary||'-'}</div></div>
                    <div><div style="font-size:0.8rem;color:var(--text-light);">Status</div><span style="padding:0.35rem 0.75rem;border-radius:20px;font-size:0.85rem;background:${st.bg};color:${st.color};">${st.text}</span></div>
                </div>
            </div>
            ${s.scores?`<div style="background:#f0fdf4;padding:1.5rem;border-radius:12px;margin-bottom:1.5rem;border:1px solid #bbf7d0;">
                <h3 style="margin:0 0 1rem;color:#166534;font-size:1rem;">📊 Self-Assessment Scores</h3>
                <div style="text-align:center;margin-bottom:1.5rem;"><div style="font-size:4rem;font-weight:700;color:${s.scores.percentage>=80?'#10b981':s.scores.percentage>=60?'#f59e0b':'#ef4444'};">${s.scores.percentage}%</div><div style="color:var(--text-light);">Overall</div></div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;">
                    <div style="text-align:center;padding:1.25rem;background:white;border-radius:10px;"><div style="font-size:2rem;font-weight:700;color:var(--primary-blue);">${s.scores.technical}/4</div><div style="font-size:0.85rem;color:var(--text-light);">Technical</div></div>
                    <div style="text-align:center;padding:1.25rem;background:white;border-radius:10px;"><div style="font-size:2rem;font-weight:700;color:#8b5cf6;">${s.scores.behavioral}/4</div><div style="font-size:0.85rem;color:var(--text-light);">Behavioral</div></div>
                    <div style="text-align:center;padding:1.25rem;background:white;border-radius:10px;"><div style="font-size:2rem;font-weight:700;color:#f59e0b;">${s.scores.critical}/4</div><div style="font-size:0.85rem;color:var(--text-light);">Critical</div></div>
                </div>
            </div>
            <div style="background:#fefce8;padding:1.5rem;border-radius:12px;margin-bottom:1.5rem;border:1px solid #fef08a;">
                <h3 style="margin:0 0 1rem;color:#854d0e;font-size:1rem;">📝 Written Responses</h3>
                ${s.strengths?`<div style="margin-bottom:1rem;"><div style="font-size:0.8rem;color:var(--text-light);margin-bottom:0.25rem;">Strengths</div><div style="background:white;padding:0.85rem;border-radius:8px;">${s.strengths}</div></div>`:''}
                ${s.improvements?`<div style="margin-bottom:1rem;"><div style="font-size:0.8rem;color:var(--text-light);margin-bottom:0.25rem;">Areas to Improve</div><div style="background:white;padding:0.85rem;border-radius:8px;">${s.improvements}</div></div>`:''}
                ${s.achievements?`<div style="margin-bottom:1rem;"><div style="font-size:0.8rem;color:var(--text-light);margin-bottom:0.25rem;">Achievements</div><div style="background:white;padding:0.85rem;border-radius:8px;">${s.achievements}</div></div>`:''}
                ${s.motivation?`<div><div style="font-size:0.8rem;color:var(--text-light);margin-bottom:0.25rem;">Why Join EDANBROOK?</div><div style="background:white;padding:0.85rem;border-radius:8px;">${s.motivation}</div></div>`:''}
            </div>`:`<div style="background:#fef3c7;padding:2.5rem;border-radius:12px;text-align:center;margin-bottom:1.5rem;"><div style="font-size:4rem;margin-bottom:1rem;">⏳</div><p style="color:#92400e;margin:0;font-size:1.1rem;font-weight:500;">Waiting for candidate to complete</p><p style="color:#a16207;margin:0.5rem 0 0;font-size:0.9rem;">Sent: ${s.sentAt?new Date(s.sentAt).toLocaleString('en-IN'):'-'}</p></div>`}
            <div style="background:#f8fafc;padding:1.5rem;border-radius:12px;">
                <h3 style="margin:0 0 1rem;font-size:1rem;">📅 Timeline</h3>
                <div style="border-left:3px solid #e5e7eb;padding-left:1.5rem;margin-left:0.5rem;">
                    <div style="margin-bottom:1rem;position:relative;"><div style="position:absolute;left:-1.85rem;top:0;width:14px;height:14px;background:#10b981;border-radius:50%;"></div><div style="font-size:0.85rem;color:var(--text-light);">Link Sent</div><div style="font-weight:500;">${s.sentAt?new Date(s.sentAt).toLocaleString('en-IN'):'-'}</div></div>
                    ${s.submittedAt?`<div style="margin-bottom:1rem;position:relative;"><div style="position:absolute;left:-1.85rem;top:0;width:14px;height:14px;background:#3b82f6;border-radius:50%;"></div><div style="font-size:0.85rem;color:var(--text-light);">Submitted</div><div style="font-weight:500;">${new Date(s.submittedAt).toLocaleString('en-IN')}</div></div>`:''}
                    ${s.reviewedAt?`<div style="position:relative;"><div style="position:absolute;left:-1.85rem;top:0;width:14px;height:14px;background:#8b5cf6;border-radius:50%;"></div><div style="font-size:0.85rem;color:var(--text-light);">Decision</div><div style="font-weight:500;">${new Date(s.reviewedAt).toLocaleString('en-IN')}</div><div style="margin-top:0.35rem;display:inline-block;padding:0.35rem 0.85rem;border-radius:20px;font-size:0.85rem;font-weight:600;background:${s.decision==='Selected'?'#d1fae5':'#fee2e2'};color:${s.decision==='Selected'?'#065f46':'#991b1b'};">${s.decision}</div></div>`:''}
                </div>
            </div>
        </div>
        <div style="padding:1.5rem;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;gap:1rem;background:#f9fafb;flex-wrap:wrap;">
            ${s.status==='submitted'?`<div style="display:flex;gap:0.75rem;flex-wrap:wrap;"><button onclick="makeDecision('${s.id}','Selected')" style="padding:0.85rem 1.5rem;background:#10b981;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">✅ Select</button><button onclick="makeDecision('${s.id}','Rejected')" style="padding:0.85rem 1.5rem;background:#ef4444;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">❌ Reject</button></div>`:'<div></div>'}
            <button onclick="closeViewScrModal()" style="padding:0.85rem 1.75rem;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;">Close</button>
        </div>
    </div>`;
    document.body.appendChild(m);
};

window.closeViewScrModal = function() { const m = document.getElementById('viewScrModal'); if (m) m.remove(); };

window.makeDecision = async function(id, decision) {
    const s = screeningData.screenings.find(x => x.id === id);
    if (!s) return;
    
    if (decision === 'Selected') {
        // Show approval modal with meeting link option
        showApprovalModal(id, s);
    } else {
        // Rejection - simple confirm
        if (!confirm('Reject this candidate?')) return;
        await submitDecision(id, 'Rejected', null, null);
    }
};

function showApprovalModal(id, candidate) {
    const m = document.createElement('div'); m.id = 'approvalModal';
    m.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;padding:1rem;';
    m.innerHTML = `<div style="max-width:550px;width:100%;background:white;border-radius:16px;overflow:hidden;">
        <div style="padding:1.5rem;background:linear-gradient(135deg,#10b981,#059669);color:white;">
            <h2 style="margin:0;font-size:1.25rem;">✅ Approve Candidate</h2>
        </div>
        <div style="padding:1.5rem;">
            <div style="background:#f0fdf4;padding:1rem;border-radius:8px;margin-bottom:1.5rem;">
                <p style="margin:0;font-weight:600;color:#166534;">${candidate.candidateName || 'Candidate'}</p>
                <p style="margin:0.25rem 0 0;color:#15803d;font-size:0.9rem;">${candidate.position} • Score: ${candidate.scores?.percentage || '-'}%</p>
            </div>
            
            <div style="margin-bottom:1.25rem;">
                <label style="display:block;margin-bottom:0.5rem;font-weight:600;">Interview Date & Time <span style="color:#ef4444;">*</span></label>
                <input type="datetime-local" id="interviewDateTime" style="width:100%;padding:0.85rem;border:1px solid #e5e7eb;border-radius:8px;font-size:1rem;">
            </div>
            
            <div style="margin-bottom:1.25rem;">
                <label style="display:block;margin-bottom:0.5rem;font-weight:600;">Meeting Link (Zoom/Teams/Google Meet)</label>
                <input type="url" id="meetingLink" placeholder="https://zoom.us/j/... or https://teams.microsoft.com/..." style="width:100%;padding:0.85rem;border:1px solid #e5e7eb;border-radius:8px;font-size:1rem;">
            </div>
            
            <div style="margin-bottom:1.25rem;">
                <label style="display:block;margin-bottom:0.5rem;font-weight:600;">Additional Notes for Candidate</label>
                <textarea id="approvalNotes" rows="3" placeholder="Any instructions or information for the candidate..." style="width:100%;padding:0.85rem;border:1px solid #e5e7eb;border-radius:8px;font-size:1rem;resize:vertical;"></textarea>
            </div>
            
            <div style="background:#dbeafe;padding:1rem;border-radius:8px;">
                <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
                    <input type="checkbox" id="sendApprovalEmail" checked style="width:18px;height:18px;">
                    <span style="color:#1e40af;">📧 Send interview invitation email to candidate</span>
                </label>
            </div>
        </div>
        <div style="padding:1.5rem;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:1rem;background:#f9fafb;">
            <button onclick="closeApprovalModal()" style="padding:0.75rem 1.5rem;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;">Cancel</button>
            <button onclick="confirmApproval('${id}')" style="padding:0.75rem 1.5rem;background:#10b981;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;">✅ Approve & Send Invitation</button>
        </div>
    </div>`;
    document.body.appendChild(m);
}

window.closeApprovalModal = function() {
    const m = document.getElementById('approvalModal');
    if (m) m.remove();
};

window.confirmApproval = async function(id) {
    const interviewDateTime = document.getElementById('interviewDateTime').value;
    const meetingLink = document.getElementById('meetingLink').value.trim();
    const notes = document.getElementById('approvalNotes').value.trim();
    const sendEmail = document.getElementById('sendApprovalEmail').checked;
    
    if (!interviewDateTime) {
        alert('Please select interview date and time');
        return;
    }
    
    closeApprovalModal();
    await submitDecision(id, 'Selected', { interviewDateTime, meetingLink, notes, sendEmail });
};

async function submitDecision(id, decision, approvalData) {
    try { 
        showLoading && showLoading(); 
        const res = await apiCall('screening?path=review', { 
            method: 'POST', 
            body: JSON.stringify({
                screeningId: id,
                decision: decision,
                reviewedBy: currentUser?.uid,
                interviewDateTime: approvalData?.interviewDateTime,
                meetingLink: approvalData?.meetingLink,
                notes: approvalData?.notes,
                sendEmail: approvalData?.sendEmail
            }) 
        }); 
        
        const s = screeningData.screenings.find(x => x.id === id);
        if (s) { 
            s.status = 'reviewed'; 
            s.decision = decision; 
            s.reviewedAt = new Date().toISOString();
            if (approvalData) {
                s.interviewDateTime = approvalData.interviewDateTime;
                s.meetingLink = approvalData.meetingLink;
            }
        }
        
        closeViewScrModal(); 
        renderScreeningList(screeningData.screenings); 
        updateScreeningStats();
        hideLoading && hideLoading();
        
        if (decision === 'Selected') {
            if (res?.emailSent) {
                alert('✅ Candidate approved!\n\n📧 Interview invitation email sent successfully to the candidate.');
            } else if (approvalData?.sendEmail) {
                alert('✅ Candidate approved!\n\n⚠️ Email could not be sent. Please check:\n- Backend EMAIL_USER and EMAIL_PASS are configured\n- The email service is working\n\nYou may need to send the invitation manually.');
            } else {
                alert('✅ Candidate approved! Interview details saved.');
            }
        } else {
            alert('❌ Candidate rejected.');
        }
        
    } catch(e) {
        hideLoading && hideLoading();
        console.error('Decision error:', e);
        alert('❌ Error: ' + (e.message || 'Failed to save decision'));
    }
}

window.removeScreening = async function(id) {
    if (!confirm('Delete this entry?')) return;
    try { showLoading && showLoading(); await apiCall('screening?path=delete&id=' + id, { method:'DELETE' }); } catch(e) {}
    screeningData.screenings = screeningData.screenings.filter(x => x.id !== id);
    renderScreeningList(screeningData.screenings); updateScreeningStats();
    alert('✅ Deleted'); hideLoading && hideLoading();
};

window.exportScreeningData = function() {
    if (!screeningData.screenings.length) { alert('No data'); return; }
    const data = screeningData.screenings.map(s => ({ Name:s.candidateName||'', Email:s.candidateEmail, Phone:s.candidatePhone||'', Position:s.position, Status:s.status, Score:s.scores?s.scores.percentage+'%':'', Experience:s.experience||'', Salary:s.expectedSalary||'', Decision:s.decision||'' }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Candidates');
    XLSX.writeFile(wb, 'Screenings_' + new Date().toISOString().split('T')[0] + '.xlsx');
    alert('✅ Exported!');
};

console.log('✅ HR Candidate Screening Module loaded');

// ============================================
// DESIGN FILE UPLOAD & APPROVAL SYSTEM
// ============================================

// Global variables for design files
let currentDesignFile = null;
let pendingDesignApprovals = [];
let currentUploadType = 'file'; // 'file' or 'link'

// ============================================
// UPLOAD MODAL FUNCTIONS
// ============================================

function openDesignUploadModal(projectId, projectName) {
    document.getElementById('designUploadProjectId').value = projectId;
    document.getElementById('designUploadProjectName').value = projectName;
    document.getElementById('designUploadProjectDisplay').textContent = projectName;
    
    // Reset form
    document.getElementById('designFileInput').value = '';
    document.getElementById('designNotes').value = '';
    document.getElementById('designExternalLink').value = '';
    document.getElementById('designLinkTitle').value = '';
    clearSelectedFile();
    
    // Reset to file upload type
    setUploadType('file');
    
    document.getElementById('designFileUploadModal').style.display = 'flex';
}
window.openDesignUploadModal = openDesignUploadModal;

// Toggle between file and link upload
function setUploadType(type) {
    currentUploadType = type;
    
    const fileSection = document.getElementById('fileUploadSection');
    const linkSection = document.getElementById('linkUploadSection');
    const fileBtnEl = document.getElementById('uploadTypeFile');
    const linkBtnEl = document.getElementById('uploadTypeLink');
    const uploadBtn = document.getElementById('designUploadBtn');
    
    if (type === 'file') {
        fileSection.style.display = 'block';
        linkSection.style.display = 'none';
        fileBtnEl.className = 'btn btn-primary';
        linkBtnEl.className = 'btn btn-secondary';
        uploadBtn.innerHTML = '📤 Upload File';
    } else {
        fileSection.style.display = 'none';
        linkSection.style.display = 'block';
        fileBtnEl.className = 'btn btn-secondary';
        linkBtnEl.className = 'btn btn-primary';
        uploadBtn.innerHTML = '🔗 Submit Link';
    }
}
window.setUploadType = setUploadType;

function closeDesignUploadModal() {
    document.getElementById('designFileUploadModal').style.display = 'none';
    currentDesignFile = null;
    currentUploadType = 'file';
}
window.closeDesignUploadModal = closeDesignUploadModal;

function handleDesignFileSelect(input) {
    const file = input.files[0];
    if (file) {
        if (file.type !== 'application/pdf') {
            showNotification('Please select a PDF file', 'error');
            input.value = '';
            return;
        }
        
        if (file.size > 50 * 1024 * 1024) { // 50MB limit
            showNotification('File size must be less than 50MB', 'error');
            input.value = '';
            return;
        }
        
        currentDesignFile = file;
        
        document.getElementById('selectedFileName').textContent = file.name;
        document.getElementById('selectedFileSize').textContent = formatFileSizeDesign(file.size);
        document.getElementById('selectedFileInfo').style.display = 'flex';
        document.getElementById('designDropzone').classList.add('has-file');
    }
}
window.handleDesignFileSelect = handleDesignFileSelect;

function clearSelectedFile() {
    currentDesignFile = null;
    document.getElementById('designFileInput').value = '';
    document.getElementById('selectedFileInfo').style.display = 'none';
    document.getElementById('designDropzone').classList.remove('has-file');
}
window.clearSelectedFile = clearSelectedFile;

function formatFileSizeDesign(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function uploadDesignFile() {
    const projectId = document.getElementById('designUploadProjectId').value;
    const projectName = document.getElementById('designUploadProjectName').value;
    const notes = document.getElementById('designNotes').value.trim();
    
    // Validate based on upload type
    if (currentUploadType === 'file') {
        if (!currentDesignFile) {
            showNotification('Please select a PDF file to upload', 'error');
            return;
        }
    } else {
        // Link validation
        const externalLink = document.getElementById('designExternalLink').value.trim();
        const linkTitle = document.getElementById('designLinkTitle').value.trim();
        
        if (!externalLink) {
            showNotification('Please enter the external link', 'error');
            return;
        }
        
        if (!externalLink.startsWith('http://') && !externalLink.startsWith('https://')) {
            showNotification('Please enter a valid URL starting with http:// or https://', 'error');
            return;
        }
        
        if (!linkTitle) {
            showNotification('Please enter a title/name for the link', 'error');
            return;
        }
    }
    
    showLoading();
    
    try {
        let fileUrl, fileName, fileSize;
        
        if (currentUploadType === 'file') {
            // Upload file to Firebase Storage
            const storageInstance = window.storage || firebase.storage();
            const storageRef = storageInstance.ref();
            const timestamp = Date.now();
            const storagePath = `design_files/${projectId}/${timestamp}_${currentDesignFile.name}`;
            const fileRef = storageRef.child(storagePath);
            
            const uploadTask = await fileRef.put(currentDesignFile);
            fileUrl = await uploadTask.ref.getDownloadURL();
            fileName = currentDesignFile.name;
            fileSize = currentDesignFile.size;
        } else {
            // Use external link
            fileUrl = document.getElementById('designExternalLink').value.trim();
            fileName = document.getElementById('designLinkTitle').value.trim();
            fileSize = 0;
        }
        
        // Create design file record in database (Client details will be added by DC)
        const response = await apiCall(`projects?id=${projectId}`, {
            method: 'PUT',
            body: JSON.stringify({
                action: 'upload_design_file',
                data: {
                    fileName: fileName,
                    fileUrl: fileUrl,
                    fileSize: fileSize,
                    notes: notes,
                    uploadType: currentUploadType, // 'file' or 'link'
                    isExternalLink: currentUploadType === 'link'
                }
            })
        });
        
        if (response.success) {
            const typeLabel = currentUploadType === 'file' ? 'File' : 'Link';
            showNotification(`✅ Design ${typeLabel.toLowerCase()} uploaded! You can now submit it for COO approval.`, 'success');
            closeDesignUploadModal();
            
            // Alert user about next step
            setTimeout(() => {
                alert(`✅ ${typeLabel} uploaded successfully!\n\n📋 Next Step:\nFind your file in "My Design Files" section and click "Submit for Approval" to send it to COO for review.`);
            }, 500);
            
            // Refresh the designer portal view
            if (typeof showDesignerAllocations === 'function') {
                showDesignerAllocations();
            }
        } else {
            throw new Error(response.error || 'Upload failed');
        }
        
    } catch (error) {
        console.error('Upload error:', error);
        showNotification('Failed to upload: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}
window.uploadDesignFile = uploadDesignFile;


// ============================================
// SUBMIT FOR APPROVAL
// ============================================

async function submitDesignForApproval(designFileId, projectId) {
    if (!confirm('Submit this design file for COO approval?')) {
        return;
    }
    
    showLoading();
    
    try {
        const response = await apiCall(`projects?id=${projectId}`, {
            method: 'PUT',
            body: JSON.stringify({
                action: 'submit_design_for_approval',
                data: {
                    designFileId: designFileId
                }
            })
        });
        
        if (response.success) {
            showNotification('Design file submitted for approval!', 'success');
            
            // Refresh the view
            if (typeof showDesignerAllocations === 'function') {
                showDesignerAllocations();
            }
        } else {
            throw new Error(response.error || 'Submission failed');
        }
        
    } catch (error) {
        console.error('Submission error:', error);
        showNotification('Failed to submit: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}
window.submitDesignForApproval = submitDesignForApproval;

async function deleteDesignFile(designFileId, projectId, fileName) {
    if (!confirm(`Are you sure you want to delete "${fileName || 'this file'}"?\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        showLoading();
        const response = await apiCall(`projects?id=${projectId}`, {
            method: 'PUT',
            body: JSON.stringify({
                action: 'delete_design_file',
                data: { designFileId }
            })
        });

        if (response.success) {
            alert('File deleted successfully.');
            // Refresh the designer's view
            if (typeof showDesignerAllocations === 'function') {
                showDesignerAllocations();
            } else if (typeof showTasks === 'function') {
                showTasks();
            }
        } else {
            throw new Error(response.error || 'Failed to delete file');
        }
    } catch (error) {
        console.error('Error deleting design file:', error);
        alert('Error: ' + error.message);
    } finally {
        hideLoading();
    }
}
window.deleteDesignFile = deleteDesignFile;


// ============================================
// COO APPROVAL FUNCTIONS
// ============================================

async function showDesignFileApprovals() {
    setActiveNav('nav-design-approvals');
    const main = document.getElementById('mainContent');
    main.style.display = 'block';
    showLoading();

    try {
        // Fetch both pending and all design files for stats
        const [pendingResp, allResp] = await Promise.all([
            apiCall('projects?action=get_design_files&status=pending_approval'),
            apiCall('projects?action=get_design_files')
        ]);

        if (!pendingResp.success) throw new Error('Failed to load design files');

        pendingDesignApprovals = pendingResp.data || [];
        const allFiles = allResp.data || [];
        const approvedCount = allFiles.filter(f => f.status === 'approved').length;
        const rejectedCount = allFiles.filter(f => f.status === 'rejected').length;
        const sentCount = allFiles.filter(f => f.status === 'sent').length;

        // Update badge
        const badge = document.getElementById('designApprovalBadge');
        if (badge) {
            badge.textContent = pendingDesignApprovals.length;
            badge.style.display = pendingDesignApprovals.length > 0 ? 'inline' : 'none';
        }

        function fmtDate(ts) {
            if (!ts) return '-';
            const ms = ts.seconds ? ts.seconds * 1000 : (typeof ts === 'number' ? ts : new Date(ts).getTime());
            return isNaN(ms) ? '-' : new Date(ms).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
        }

        let cardsHtml = '';
        if (pendingDesignApprovals.length === 0) {
            cardsHtml = `
                <div style="text-align:center;padding:3rem;background:white;border-radius:12px;border:1px solid #e2e8f0;">
                    <div style="font-size:3rem;margin-bottom:8px;">✅</div>
                    <h3 style="margin:0 0 0.5rem;color:#1e293b;">No Pending Approvals</h3>
                    <p style="color:#64748b;margin:0;">All design files have been reviewed. New uploads from designers will appear here automatically.</p>
                </div>
            `;
        } else {
            cardsHtml = pendingDesignApprovals.map(file => {
                const isLink = file.isExternalLink || file.uploadType === 'link';
                const fileIcon = isLink ? '🔗' : '📄';
                const typeLabel = isLink ? 'External Link' : 'File';
                const fileExt = (file.fileName || '').split('.').pop().toUpperCase();
                const typeBadge = isLink
                    ? '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:#e0f2fe;color:#0369a1;">LINK</span>'
                    : `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:#f0fdf4;color:#166534;">${fileExt || 'FILE'}</span>`;

                return `
                <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:0;overflow:hidden;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);transition:box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'" onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,0.04)'">
                    <div style="display:flex;align-items:stretch;">
                        <!-- Left accent -->
                        <div style="width:5px;background:linear-gradient(180deg,#f59e0b,#d97706);flex-shrink:0;"></div>
                        <div style="flex:1;padding:16px 20px;">
                            <!-- Top row: project + file -->
                            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                                <div>
                                    <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:2px;">${file.projectName || 'Unknown Project'}</div>
                                    <div style="font-size:13px;color:#64748b;">${file.projectCode || ''}</div>
                                </div>
                                ${typeBadge}
                            </div>
                            <!-- File info -->
                            <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#f8fafc;border-radius:8px;margin-bottom:12px;">
                                <span style="font-size:20px;">${fileIcon}</span>
                                <div style="flex:1;min-width:0;">
                                    <div style="font-weight:500;font-size:13px;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${file.fileName || 'Untitled'}</div>
                                    <div style="font-size:11px;color:#94a3b8;">${file.fileSize ? (file.fileSize / 1024 / 1024).toFixed(2) + ' MB' : typeLabel}</div>
                                </div>
                                <a href="${file.fileUrl || '#'}" target="_blank" style="padding:6px 12px;background:#667eea;color:white;border-radius:6px;font-size:12px;font-weight:500;text-decoration:none;white-space:nowrap;">
                                    ${isLink ? '🔗 Open' : '👁️ Preview'}
                                </a>
                            </div>
                            <!-- Meta row -->
                            <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:12px;color:#64748b;margin-bottom:14px;">
                                <span>👤 <strong style="color:#334155;">${file.uploadedByName || 'Designer'}</strong></span>
                                <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:4px;font-weight:700;background:${({'IFA':'#3b82f615','IFC':'#10b98115','Preliminary':'#f59e0b15','Draft':'#6b728015','Final':'#8b5cf615'})[file.submissionStage||''] || '#f1f5f9'};color:${({'IFA':'#3b82f6','IFC':'#10b981','Preliminary':'#f59e0b','Draft':'#6b7280','Final':'#8b5cf6'})[file.submissionStage||''] || '#64748b'};border:1px solid ${({'IFA':'#3b82f640','IFC':'#10b98140','Preliminary':'#f59e0b40','Draft':'#6b728040','Final':'#8b5cf640'})[file.submissionStage||''] || '#e2e8f0'}">${file.submissionStage || '-'}</span>
                                <span style="font-weight:600;color:#475569;">${file.revisionNumber || '-'}</span>
                                <span>📅 ${fmtDate(file.submittedAt || file.uploadedAt)}</span>
                                ${file.designerNotes ? `<span>📝 ${file.designerNotes.substring(0, 50)}${file.designerNotes.length > 50 ? '...' : ''}</span>` : ''}
                            </div>
                            <!-- Action buttons -->
                            <div style="display:flex;gap:8px;">
                                <button onclick="openDesignApprovalModal('${file.id}', '${file.projectId}')" style="padding:8px 20px;background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;box-shadow:0 2px 8px rgba(16,185,129,0.3);">
                                    ✅ Approve
                                </button>
                                <button onclick="openDesignApprovalModal('${file.id}', '${file.projectId}')" style="padding:8px 20px;background:white;color:#ef4444;border:1px solid #fecaca;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;">
                                    ❌ Reject
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            }).join('');
        }

        main.innerHTML = `
            <div style="max-width:1200px;margin:0 auto;padding:1.5rem;">
                <!-- Header -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                    <div>
                        <h1 style="margin:0;font-size:1.6rem;font-weight:700;color:#1e293b;">Design File Approvals</h1>
                        <p style="margin:4px 0 0;color:#64748b;font-size:14px;">Review and approve design files uploaded by designers</p>
                    </div>
                    <button onclick="showDesignFileApprovals()" style="padding:8px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:13px;color:#475569;display:flex;align-items:center;gap:6px;">
                        🔄 Refresh
                    </button>
                </div>

                <!-- Stats -->
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:1.5rem;">
                    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;text-align:center;">
                        <div style="font-size:1.8rem;font-weight:700;color:#f59e0b;">${pendingDesignApprovals.length}</div>
                        <div style="font-size:12px;color:#92400e;font-weight:600;">Pending Approval</div>
                    </div>
                    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px;text-align:center;">
                        <div style="font-size:1.8rem;font-weight:700;color:#10b981;">${approvedCount}</div>
                        <div style="font-size:12px;color:#065f46;font-weight:600;">Approved</div>
                    </div>
                    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;text-align:center;">
                        <div style="font-size:1.8rem;font-weight:700;color:#ef4444;">${rejectedCount}</div>
                        <div style="font-size:12px;color:#991b1b;font-weight:600;">Rejected</div>
                    </div>
                    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:16px;text-align:center;">
                        <div style="font-size:1.8rem;font-weight:700;color:#8b5cf6;">${sentCount}</div>
                        <div style="font-size:12px;color:#5b21b6;font-weight:600;">Sent to Client</div>
                    </div>
                </div>

                <!-- Pending Section Header -->
                ${pendingDesignApprovals.length > 0 ? `
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem;">
                    <div style="background:linear-gradient(135deg,#f59e0b,#d97706);color:white;padding:6px 14px;border-radius:8px;font-size:13px;font-weight:700;">
                        ${pendingDesignApprovals.length} Pending
                    </div>
                    <div style="flex:1;height:1px;background:#e2e8f0;"></div>
                    <span style="font-size:12px;color:#94a3b8;">Files awaiting your review</span>
                </div>
                ` : ''}

                <!-- Approval Cards -->
                ${cardsHtml}
            </div>
        `;

    } catch (error) {
        console.error('Error loading approvals:', error);
        main.innerHTML = `
            <div style="max-width:1200px;margin:0 auto;padding:1.5rem;">
                <h1 style="margin:0 0 1rem;font-size:1.6rem;color:#1e293b;">Design File Approvals</h1>
                <div style="text-align:center;padding:3rem;background:white;border-radius:12px;border:1px solid #fecaca;">
                    <div style="font-size:2.5rem;margin-bottom:8px;">⚠️</div>
                    <h3 style="color:#ef4444;">Error Loading Approvals</h3>
                    <p style="color:#64748b;">${error.message}</p>
                    <button onclick="showDesignFileApprovals()" style="padding:10px 20px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer;margin-top:1rem;">Try Again</button>
                </div>
            </div>
        `;
    } finally {
        hideLoading();
    }
}
window.showDesignFileApprovals = showDesignFileApprovals;


// ============================================
// APPROVAL MODAL FUNCTIONS
// ============================================

function openDesignApprovalModal(designFileId, projectId) {
    const file = pendingDesignApprovals.find(f => f.id === designFileId);
    if (!file) {
        showNotification('Design file not found', 'error');
        return;
    }
    
    document.getElementById('approvalDesignFileId').value = designFileId;
    document.getElementById('approvalProjectId').value = projectId;
    
    document.getElementById('approvalProjectName').textContent = file.projectName;
    document.getElementById('approvalClientCompany').textContent = file.clientCompany || 'N/A';
    document.getElementById('approvalFileName').textContent = file.fileName;
    document.getElementById('approvalSubmittedBy').textContent = file.uploadedByName;
    // Client email removed - will be entered by Document Controller when sending
    document.getElementById('approvalPreviewLink').href = file.fileUrl;
    
    // Show file type (PDF or External Link)
    const isLink = file.isExternalLink || file.uploadType === 'link';
    const fileTypeEl = document.getElementById('approvalFileType');
    if (isLink) {
        fileTypeEl.innerHTML = '<span style="color: #0891b2;">🔗 External Link</span>';
    } else {
        fileTypeEl.innerHTML = '<span style="color: #059669;">📄 PDF File</span>';
    }
    
    // Update preview button text
    const previewBtn = document.getElementById('approvalPreviewLink');
    previewBtn.textContent = isLink ? '🔗 Open Link' : '👁️ Preview PDF';
    
    // Show designer notes if present
    if (file.designerNotes) {
        document.getElementById('approvalDesignerNotes').style.display = 'block';
        document.getElementById('approvalDesignerNotesText').textContent = file.designerNotes;
    } else {
        document.getElementById('approvalDesignerNotes').style.display = 'none';
    }
    
    // Reset form
    document.getElementById('approvalNotes').value = '';
    document.getElementById('rejectionReason').value = '';
    document.getElementById('rejectionReasonSection').style.display = 'none';
    document.getElementById('approveDesignBtn').style.display = 'inline-block';
    document.getElementById('confirmRejectBtn').style.display = 'none';
    
    document.getElementById('designApprovalModal').style.display = 'flex';
}
window.openDesignApprovalModal = openDesignApprovalModal;

function closeDesignApprovalModal() {
    document.getElementById('designApprovalModal').style.display = 'none';
}
window.closeDesignApprovalModal = closeDesignApprovalModal;

function toggleRejectionMode() {
    const rejectionSection = document.getElementById('rejectionReasonSection');
    const approveBtn = document.getElementById('approveDesignBtn');
    const rejectBtn = document.getElementById('confirmRejectBtn');
    
    if (rejectionSection.style.display === 'none') {
        rejectionSection.style.display = 'block';
        approveBtn.style.display = 'none';
        rejectBtn.style.display = 'inline-block';
    } else {
        rejectionSection.style.display = 'none';
        approveBtn.style.display = 'inline-block';
        rejectBtn.style.display = 'none';
    }
}
window.toggleRejectionMode = toggleRejectionMode;

async function approveDesignFile() {
    const designFileId = document.getElementById('approvalDesignFileId').value;
    const projectId = document.getElementById('approvalProjectId').value;
    const notes = document.getElementById('approvalNotes').value.trim();
    
    if (!confirm('Approve this design file? The designer will be able to send it to the client.')) {
        return;
    }
    
    showLoading();
    
    try {
        const response = await apiCall(`projects?id=${projectId}`, {
            method: 'PUT',
            body: JSON.stringify({
                action: 'approve_design_file',
                data: {
                    designFileId: designFileId,
                    notes: notes
                }
            })
        });
        
        if (response.success) {
            showNotification('Design file approved successfully!', 'success');
            closeDesignApprovalModal();
            showDesignFileApprovals(); // Refresh list
        } else {
            throw new Error(response.error || 'Approval failed');
        }
        
    } catch (error) {
        console.error('Approval error:', error);
        showNotification('Failed to approve: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}
window.approveDesignFile = approveDesignFile;

async function rejectDesignFile() {
    const designFileId = document.getElementById('approvalDesignFileId').value;
    const projectId = document.getElementById('approvalProjectId').value;
    const rejectionReason = document.getElementById('rejectionReason').value.trim();
    
    if (!rejectionReason) {
        showNotification('Please provide a reason for rejection', 'error');
        return;
    }
    
    if (!confirm('Reject this design file? The designer will be notified.')) {
        return;
    }
    
    showLoading();
    
    try {
        const response = await apiCall(`projects?id=${projectId}`, {
            method: 'PUT',
            body: JSON.stringify({
                action: 'reject_design_file',
                data: {
                    designFileId: designFileId,
                    rejectionReason: rejectionReason
                }
            })
        });
        
        if (response.success) {
            showNotification('Design file rejected. Designer has been notified.', 'success');
            closeDesignApprovalModal();
            showDesignFileApprovals(); // Refresh list
        } else {
            throw new Error(response.error || 'Rejection failed');
        }
        
    } catch (error) {
        console.error('Rejection error:', error);
        showNotification('Failed to reject: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}
window.rejectDesignFile = rejectDesignFile;


// ============================================
// SEND TO CLIENT FUNCTIONS
// ============================================

async function openSendToClientModal(designFileId, projectId) {
    showLoading();
    
    try {
        // Fetch the design file details
        const response = await apiCall(`projects?action=get_design_files&projectId=${projectId}`);
        
        if (!response.success) {
            throw new Error('Failed to load design file');
        }
        
        const file = (response.data || []).find(f => f.id === designFileId);
        if (!file) {
            throw new Error('Design file not found');
        }
        
        if (file.status !== 'approved') {
            showNotification('This design file has not been approved yet', 'error');
            return;
        }
        
        document.getElementById('sendDesignFileId').value = designFileId;
        document.getElementById('sendProjectId').value = projectId;
        
        document.getElementById('sendProjectName').textContent = file.projectName;
        document.getElementById('sendFileName').textContent = file.fileName;
        document.getElementById('sendClientEmail').textContent = file.clientEmail;
        document.getElementById('sendClientName').textContent = file.clientName ? `(${file.clientName})` : '';
        
        document.getElementById('sendCustomMessage').value = '';
        
        document.getElementById('sendToClientModal').style.display = 'flex';
        
    } catch (error) {
        console.error('Error:', error);
        showNotification(error.message, 'error');
    } finally {
        hideLoading();
    }
}
window.openSendToClientModal = openSendToClientModal;

function closeSendToClientModal() {
    document.getElementById('sendToClientModal').style.display = 'none';
}
window.closeSendToClientModal = closeSendToClientModal;

async function sendDesignToClient() {
    const designFileId = document.getElementById('sendDesignFileId').value;
    const projectId = document.getElementById('sendProjectId').value;
    const customMessage = document.getElementById('sendCustomMessage').value.trim();
    
    const clientEmail = document.getElementById('sendClientEmail').textContent;
    
    if (!confirm(`Send the design file to ${clientEmail}?`)) {
        return;
    }
    
    showLoading();
    
    try {
        const response = await apiCall(`projects?id=${projectId}`, {
            method: 'PUT',
            body: JSON.stringify({
                action: 'send_design_to_client',
                data: {
                    designFileId: designFileId,
                    customMessage: customMessage
                }
            })
        });
        
        if (response.success) {
            showNotification(`Design file sent successfully to ${clientEmail}!`, 'success');
            closeSendToClientModal();
            
            // Refresh the designer portal
            if (typeof showDesignerAllocations === 'function') {
                showDesignerAllocations();
            }
        } else {
            throw new Error(response.error || 'Failed to send');
        }
        
    } catch (error) {
        console.error('Send error:', error);
        showNotification('Failed to send: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}
window.sendDesignToClient = sendDesignToClient;


// ============================================
// DOCUMENT CONTROLLER (DC) PORTAL FUNCTIONS
// ============================================

// Update DC pending badge
async function updateDCPendingBadge() {
    try {
        const response = await apiCall('projects?action=get_approved_design_files');
        if (response.success && response.data) {
            const pendingCount = response.data.filter(f => f.status === 'approved').length;
            const badge = document.getElementById('dcPendingBadge');
            if (badge) {
                badge.textContent = pendingCount;
                badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
            }
        }
    } catch (error) {
        console.error('Error updating DC badge:', error);
    }
}
window.updateDCPendingBadge = updateDCPendingBadge;

// Show Document Controller Dashboard
async function showDocumentControllerDashboard() {
    const mainContent = document.getElementById('mainContent');
    
    // Set active nav
    document.querySelectorAll('.nav-menu a').forEach(a => a.classList.remove('active'));
    const navLink = document.getElementById('nav-document-controller');
    if (navLink) navLink.classList.add('active');
    
    mainContent.innerHTML = `
        <div class="page-header">
            <h2>📄 Document Controller Portal</h2>
            <p class="subtitle">Manage approved design files and send to clients</p>
        </div>
        <div class="loading-spinner">Loading approved design files...</div>
    `;
    
    try {
        // Fetch all approved design files (COO approved, ready for client)
        const response = await apiCall('projects?action=get_approved_design_files');
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to load design files');
        }
        
        const allFiles = response.data || [];
        
        // Separate by status
        const approvedFiles = allFiles.filter(f => f.status === 'approved');
        const sentFiles = allFiles.filter(f => f.status === 'sent');
        
        // Stats section
        const statsHtml = `
            <div class="dashboard-stats" style="margin-bottom: 2rem;">
                <div class="stat-card" style="border-left-color: #f59e0b;">
                    <div class="stat-number" style="color: #f59e0b;">${approvedFiles.length}</div>
                    <div class="stat-label">Pending to Send</div>
                </div>
                <div class="stat-card" style="border-left-color: #10b981;">
                    <div class="stat-number" style="color: #10b981;">${sentFiles.length}</div>
                    <div class="stat-label">Sent to Clients</div>
                </div>
                <div class="stat-card" style="border-left-color: #3b82f6;">
                    <div class="stat-number" style="color: #3b82f6;">${allFiles.length}</div>
                    <div class="stat-label">Total Files</div>
                </div>
            </div>
        `;
        
        // Build pending files section
        let pendingHtml = '';
        if (approvedFiles.length > 0) {
            const pendingRows = approvedFiles.map(file => {
                const approvalDate = file.approvedAt ? new Date(file.approvedAt.seconds ? file.approvedAt.seconds * 1000 : file.approvedAt).toLocaleDateString() : 'N/A';
                const isLink = file.isExternalLink || file.uploadType === 'link';
                const fileIcon = isLink ? '🔗' : '📄';
                
                return `
                    <tr>
                        <td><strong>${file.projectName || 'Unknown Project'}</strong><br><small style="color: #64748b;">${file.projectCode || ''}</small></td>
                        <td>
                            <a href="${file.fileUrl}" target="_blank" style="color: var(--primary-blue); text-decoration: none;">
                                ${fileIcon} ${file.fileName}
                            </a>
                        </td>
                        <td>${file.uploadedByName || 'Designer'}</td>
                        <td>${file.approvedByName || 'COO'}</td>
                        <td>${approvalDate}</td>
                        <td style="white-space:nowrap;">
                            <a href="${file.fileUrl}" target="_blank" class="btn btn-secondary btn-sm">👁️ Preview</a>
                            <button class="btn btn-success btn-sm" onclick="dcSendToClient('${file.id}', '${file.projectId}')">
                                📧 Send to Client
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="openDCCommentModal('${file.id}', '${file.projectId}', '${(file.fileName || '').replace(/'/g, '\\&#39;')}', '${(file.projectName || '').replace(/'/g, '\\&#39;')}')" style="font-size:12px;padding:5px 10px;">
                                💬 Comment
                            </button>
                            <button class="btn btn-primary btn-sm" onclick="openDCActivityHistory('${file.projectId}', '${(file.projectName || '').replace(/'/g, '\\&#39;')}')" style="font-size:12px;padding:5px 10px;">
                                📋 History
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
            
            pendingHtml = `
                <div class="card" style="margin-bottom: 2rem; border: 2px solid #f59e0b;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0; color: #d97706;">⏳ Ready to Send to Client</h3>
                        <span style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">${approvedFiles.length} file(s)</span>
                    </div>
                    <p style="color: #64748b; margin-bottom: 1rem;">These files have been approved by COO and are ready to be sent to clients. Enter client details when sending.</p>
                    <div style="overflow-x: auto;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Project</th>
                                    <th>File</th>
                                    <th>Uploaded By</th>
                                    <th>Approved By</th>
                                    <th>Approved Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${pendingRows}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else {
            pendingHtml = `
                <div class="card" style="margin-bottom: 2rem; border: 2px dashed #cbd5e1; background: #f8fafc;">
                    <div style="text-align: center; padding: 2rem;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
                        <h3 style="margin: 0 0 0.5rem 0; color: #1e3a5f;">No Pending Files</h3>
                        <p style="color: #64748b;">All approved design files have been sent to clients.</p>
                    </div>
                </div>
            `;
        }
        
        // Build sent files section
        let sentHtml = '';
        if (sentFiles.length > 0) {
            const sentRows = sentFiles.map(file => {
                const sentDate = file.sentAt ? new Date(file.sentAt.seconds ? file.sentAt.seconds * 1000 : file.sentAt).toLocaleDateString() : 'N/A';
                const isLink = file.isExternalLink || file.uploadType === 'link';
                const fileIcon = isLink ? '🔗' : '📄';
                
                return `
                    <tr>
                        <td><strong>${file.projectName || 'Unknown Project'}</strong><br><small style="color:#64748b;">${file.projectCode || ''}</small></td>
                        <td>
                            <a href="${file.fileUrl}" target="_blank" style="color: var(--primary-blue); text-decoration: none;">
                                ${fileIcon} ${file.fileName}
                            </a>
                        </td>
                        <td style="color: #2563eb;">${file.clientEmail || 'N/A'}<br><small style="color:#94a3b8;">${file.clientName || ''}</small></td>
                        <td>${sentDate}</td>
                        <td>${file.sentBy || 'DC'}</td>
                        <td>
                            <span class="badge" style="background: #d1fae5; color: #065f46; padding: 4px 10px; border-radius: 6px; font-size:12px;">📧 Sent</span>
                        </td>
                        <td style="white-space: nowrap;">
                            <button class="btn btn-secondary btn-sm" onclick="openDCCommentModal('${file.id}', '${file.projectId}', '${(file.fileName || '').replace(/'/g, '\\&#39;')}', '${(file.projectName || '').replace(/'/g, '\\&#39;')}')" style="font-size:12px;padding:5px 10px;margin-right:4px;">
                                💬 Comment
                            </button>
                            <button class="btn btn-primary btn-sm" onclick="openDCActivityHistory('${file.projectId}', '${(file.projectName || '').replace(/'/g, '\\&#39;')}')" style="font-size:12px;padding:5px 10px;">
                                📋 History
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            sentHtml = `
                <div class="card" style="margin-bottom: 2rem; border: 2px solid #10b981;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="margin: 0; color: #059669;">📧 Sent to Clients</h3>
                        <span style="background: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">${sentFiles.length} file(s)</span>
                    </div>
                    <div style="overflow-x: auto;">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Project</th>
                                    <th>File</th>
                                    <th>Sent To</th>
                                    <th>Sent Date</th>
                                    <th>Sent By</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sentRows}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
        
        mainContent.innerHTML = `
            <div class="page-header">
                <h2>📄 Document Controller Portal</h2>
                <p class="subtitle">Manage approved design files and send to clients</p>
            </div>
            ${statsHtml}
            ${pendingHtml}
            ${sentHtml}
        `;
        
        // Update badge
        updateDCPendingBadge();
        
    } catch (error) {
        console.error('Error loading DC dashboard:', error);
        mainContent.innerHTML = `
            <div class="page-header">
                <h2>📄 Document Controller Portal</h2>
                <p class="subtitle">Manage approved design files and send to clients</p>
            </div>
            <div class="card" style="text-align: center; padding: 3rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">⚠️</div>
                <h3 style="color: #dc2626;">Error Loading Files</h3>
                <p style="color: #64748b;">${error.message}</p>
                <button class="btn btn-primary" onclick="showDocumentControllerDashboard()">🔄 Retry</button>
            </div>
        `;
    }
}
window.showDocumentControllerDashboard = showDocumentControllerDashboard;

// DC Send to Client function
async function dcSendToClient(designFileId, projectId) {
    // First fetch file details to show confirmation
    try {
        showLoading();
        const response = await apiCall(`projects?action=get_design_file&fileId=${designFileId}`);
        
        if (!response.success || !response.data) {
            throw new Error('Could not load file details');
        }
        
        const file = response.data;
        hideLoading();
        
        // Get client email from project if not on file
        let clientEmail = file.clientEmail || '';
        let clientName = file.clientName || '';
        
        // Show send modal with client details form
        const modal = document.createElement('div');
        modal.id = 'dcSendModal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>📧 Send Design to Client</h3>
                    <button class="close-btn" onclick="closeDCSendModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Success Banner -->
                    <div style="background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); padding: 15px 20px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.5rem;">✅</span>
                            <div>
                                <strong style="color: #166534;">COO Approved!</strong>
                                <p style="margin: 5px 0 0 0; color: #15803d; font-size: 0.9rem;">Ready to send to the client</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- File Details -->
                    <div class="client-preview-box" style="background: #f8fafc; padding: 1rem; border-radius: 10px; margin-bottom: 1.5rem;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div>
                                <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase;">Project</div>
                                <div style="font-weight: 600;">${file.projectName || 'Unknown'}</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase;">File</div>
                                <div style="font-weight: 600;">${file.fileName}</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase;">Uploaded By</div>
                                <div style="font-weight: 500;">${file.uploadedByName || 'Designer'}</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: #64748b; text-transform: uppercase;">Approved By</div>
                                <div style="font-weight: 500;">${file.approvedByName || 'COO'}</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Preview Button -->
                    <div style="text-align: center; margin-bottom: 20px;">
                        <a href="${file.fileUrl}" target="_blank" class="btn btn-secondary">
                            👁️ Preview File Before Sending
                        </a>
                    </div>
                    
                    <!-- Client Details Section -->
                    <div style="background: #f0f9ff; padding: 20px; border-radius: 10px; border: 1px solid #bae6fd; margin-bottom: 1rem;">
                        <h4 style="margin: 0 0 15px 0; color: #0369a1; font-size: 1rem;">
                            📬 Client Delivery Details
                        </h4>
                        
                        <!-- Client Email -->
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label style="font-weight: 600;">Client Email <span style="color: red;">*</span></label>
                            <input type="email" id="dcClientEmail" class="form-control" value="${clientEmail}" placeholder="client@company.com" required>
                            <small style="color: #64748b;">Primary recipient of the design file</small>
                        </div>
                        
                        <!-- Client Name -->
                        <div class="form-group" style="margin-bottom: 15px;">
                            <label style="font-weight: 600;">Client Contact Name (Optional)</label>
                            <input type="text" id="dcClientName" class="form-control" value="${clientName}" placeholder="John Smith">
                            <small style="color: #64748b;">Name to use in email greeting</small>
                        </div>
                        
                        <!-- CC Emails -->
                        <div class="form-group">
                            <label style="font-weight: 600;">CC Additional Recipients (Optional)</label>
                            <input type="text" id="dcCCEmails" class="form-control" placeholder="email1@company.com, email2@company.com">
                            <small style="color: #64748b;">Separate multiple emails with commas</small>
                        </div>
                    </div>
                    
                    <!-- Custom Message -->
                    <div class="form-group">
                        <label style="font-weight: 600;">Custom Message (Optional)</label>
                        <textarea id="dcCustomMessage" class="form-control" rows="3" placeholder="Add a personalized message to include in the email to the client..."></textarea>
                        <small style="color: #64748b;">This will appear in the email body sent to the client</small>
                    </div>
                    
                    <!-- Warning -->
                    <div style="background: #fef3c7; padding: 12px 15px; border-radius: 8px; margin-top: 15px;">
                        <p style="margin: 0; color: #92400e; font-size: 0.9rem;">
                            ⚠️ <strong>Note:</strong> The client will receive a professional email with a download link to the design file. CC recipients will also receive a copy.
                        </p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeDCSendModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="confirmDCSendToClient('${designFileId}', '${projectId}')">
                        📧 Send to Client
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        hideLoading();
        console.error('Error:', error);
        showNotification('Error: ' + error.message, 'error');
    }
}
window.dcSendToClient = dcSendToClient;

function closeDCSendModal() {
    const modal = document.getElementById('dcSendModal');
    if (modal) modal.remove();
}
window.closeDCSendModal = closeDCSendModal;

async function confirmDCSendToClient(designFileId, projectId) {
    const clientEmail = document.getElementById('dcClientEmail')?.value.trim() || '';
    const clientName = document.getElementById('dcClientName')?.value.trim() || '';
    const ccEmails = document.getElementById('dcCCEmails')?.value.trim() || '';
    const customMessage = document.getElementById('dcCustomMessage')?.value.trim() || '';
    
    // Validate client email
    if (!clientEmail || !clientEmail.includes('@')) {
        showNotification('Please enter a valid client email address', 'error');
        return;
    }
    
    // Parse and validate CC emails
    let ccList = [];
    if (ccEmails) {
        ccList = ccEmails.split(',').map(e => e.trim()).filter(e => e && e.includes('@'));
        const invalidEmails = ccEmails.split(',').map(e => e.trim()).filter(e => e && !e.includes('@'));
        if (invalidEmails.length > 0) {
            showNotification('Some CC email addresses are invalid: ' + invalidEmails.join(', '), 'error');
            return;
        }
    }
    
    const ccDisplay = ccList.length > 0 ? `\nCC: ${ccList.join(', ')}` : '';
    if (!confirm(`Send this design file to:\n${clientEmail}${ccDisplay}\n\nProceed?`)) {
        return;
    }
    
    closeDCSendModal();
    showLoading();
    
    try {
        const response = await apiCall(`projects?id=${projectId}`, {
            method: 'PUT',
            body: JSON.stringify({
                action: 'send_design_to_client',
                data: {
                    designFileId: designFileId,
                    clientEmail: clientEmail,
                    clientName: clientName,
                    ccEmails: ccList,
                    customMessage: customMessage,
                    sentBy: currentUser?.email || 'Document Controller'
                }
            })
        });
        
        if (response.success) {
            const ccText = ccList.length > 0 ? ` (+ ${ccList.length} CC)` : '';
            showNotification(`✅ Design file sent successfully to ${clientEmail}${ccText}!`, 'success');
            
            // Refresh the DC dashboard
            showDocumentControllerDashboard();
        } else {
            throw new Error(response.error || 'Failed to send');
        }
        
    } catch (error) {
        console.error('Send error:', error);
        showNotification('Failed to send: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}
window.confirmDCSendToClient = confirmDCSendToClient;


// ============================================
// DC COMMENT MODAL & ACTIVITY HISTORY
// ============================================

function openDCCommentModal(designFileId, projectId, fileName, projectName) {
    // Close existing
    const existing = document.getElementById('dcCommentModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'dcCommentModal';
    modal.style.cssText = 'display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10001;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
    modal.innerHTML = `
        <div style="max-width:560px;width:95%;background:white;border-radius:16px;max-height:85vh;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,0.3);animation:modalSlideIn 0.3s ease;">
            <div style="padding:1.25rem 1.5rem;background:linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%);color:white;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <h3 style="margin:0;font-size:1.1rem;font-weight:700;">💬 Add Comment / Client Feedback</h3>
                    <span onclick="document.getElementById('dcCommentModal').remove()" style="cursor:pointer;font-size:1.6rem;color:rgba(255,255,255,0.8);line-height:1;">&times;</span>
                </div>
                <p style="margin:6px 0 0;font-size:12px;opacity:0.85;">${projectName} - ${fileName}</p>
            </div>
            <div style="padding:1.5rem;max-height:55vh;overflow-y:auto;">
                <div style="margin-bottom:1rem;">
                    <label style="font-weight:600;font-size:13px;color:#374151;display:block;margin-bottom:6px;">Comment Type *</label>
                    <select id="dcCommentType" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;">
                        <option value="general">General Comment</option>
                        <option value="client_feedback">Client Feedback Received</option>
                        <option value="rectification">Rectification Required</option>
                        <option value="revision_request">Revision Requested by Client</option>
                        <option value="resolved">Issue Resolved</option>
                    </select>
                </div>
                <div style="margin-bottom:1rem;">
                    <label style="font-weight:600;font-size:13px;color:#374151;display:block;margin-bottom:6px;">Client Response / Feedback</label>
                    <textarea id="dcClientResponse" rows="2" placeholder="Paste or summarize client's response..." style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;resize:vertical;box-sizing:border-box;"></textarea>
                </div>
                <div style="margin-bottom:1rem;">
                    <label style="font-weight:600;font-size:13px;color:#374151;display:block;margin-bottom:6px;">Your Comment / Notes *</label>
                    <textarea id="dcCommentText" rows="3" placeholder="Add your comment, rectification details, or notes..." style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;resize:vertical;box-sizing:border-box;"></textarea>
                </div>
            </div>
            <div style="padding:1rem 1.5rem;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:10px;background:#fafbfc;">
                <button onclick="document.getElementById('dcCommentModal').remove()" style="padding:10px 20px;border:1px solid #e2e8f0;background:white;border-radius:8px;cursor:pointer;font-weight:500;color:#64748b;">Cancel</button>
                <button id="dcCommentSubmitBtn" onclick="submitDCComment('${designFileId}','${projectId}')" style="padding:10px 24px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600;box-shadow:0 4px 12px rgba(59,130,246,0.3);">Submit Comment</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
}

async function submitDCComment(designFileId, projectId) {
    const commentType = document.getElementById('dcCommentType').value;
    const clientResponse = document.getElementById('dcClientResponse').value.trim();
    const comment = document.getElementById('dcCommentText').value.trim();
    const btn = document.getElementById('dcCommentSubmitBtn');

    if (!comment) {
        alert('Please enter a comment.');
        return;
    }

    try {
        btn.disabled = true;
        btn.textContent = 'Submitting...';

        const response = await apiCall(`projects?id=${projectId}`, {
            method: 'PUT',
            body: JSON.stringify({
                action: 'add_dc_comment',
                data: {
                    designFileId,
                    comment,
                    commentType,
                    clientResponse
                }
            })
        });

        if (response.success) {
            document.getElementById('dcCommentModal').remove();
            alert('Comment added successfully!');
            // Refresh the dashboard if DC, or tracker if COO/Director
            if (typeof showDocumentControllerDashboard === 'function') {
                const nav = document.getElementById('nav-document-controller');
                if (nav && nav.classList.contains('active')) showDocumentControllerDashboard();
            }
            if (typeof showDCFileTracker === 'function') {
                const nav = document.getElementById('nav-dc-tracker');
                if (nav && nav.classList.contains('active')) showDCFileTracker();
            }
        } else {
            throw new Error(response.error || 'Failed to add comment');
        }
    } catch (error) {
        console.error('Error adding DC comment:', error);
        alert('Error: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Submit Comment';
    }
}

async function openDCActivityHistory(projectId, projectName) {
    // Close existing
    const existing = document.getElementById('dcHistoryModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'dcHistoryModal';
    modal.style.cssText = 'display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10001;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
    modal.innerHTML = `
        <div style="max-width:750px;width:95%;background:white;border-radius:16px;max-height:90vh;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,0.3);animation:modalSlideIn 0.3s ease;">
            <div style="padding:1.25rem 1.5rem;background:linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%);color:white;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <h3 style="margin:0;font-size:1.1rem;font-weight:700;">📋 Activity History & Comments</h3>
                    <span onclick="document.getElementById('dcHistoryModal').remove()" style="cursor:pointer;font-size:1.6rem;color:rgba(255,255,255,0.8);line-height:1;">&times;</span>
                </div>
                <p style="margin:6px 0 0;font-size:12px;opacity:0.85;">${projectName}</p>
            </div>
            <div id="dcHistoryContent" style="padding:1.5rem;max-height:70vh;overflow-y:auto;">
                <div style="text-align:center;padding:2rem;"><div class="spinner"></div><p style="color:#64748b;margin-top:1rem;">Loading history...</p></div>
            </div>
            <div style="padding:0.75rem 1.5rem;border-top:1px solid #e2e8f0;text-align:right;background:#fafbfc;">
                <button onclick="document.getElementById('dcHistoryModal').remove()" style="padding:8px 20px;border:1px solid #e2e8f0;background:white;border-radius:8px;cursor:pointer;font-weight:500;color:#64748b;">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

    try {
        const response = await apiCall(`projects?action=get_dc_comments&projectId=${projectId}`);

        if (!response.success) throw new Error(response.error || 'Failed to load history');

        // apiCall may wrap raw responses as { success: true, data: <raw> }
        const payload = (response.data && (response.data.comments || response.data.activities)) ? response.data : response;
        const comments = payload.comments || [];
        const activities = payload.activities || [];

        // Merge into a single timeline
        const timeline = [];

        comments.forEach(c => {
            const ts = c.createdAt?.seconds ? c.createdAt.seconds * 1000 : 0;
            const typeLabels = {
                'general': { label: 'Comment', icon: '💬', color: '#3b82f6', bg: '#eff6ff' },
                'client_feedback': { label: 'Client Feedback', icon: '📩', color: '#f59e0b', bg: '#fffbeb' },
                'rectification': { label: 'Rectification', icon: '🔧', color: '#ef4444', bg: '#fef2f2' },
                'revision_request': { label: 'Revision Request', icon: '📝', color: '#f97316', bg: '#fff7ed' },
                'resolved': { label: 'Resolved', icon: '✅', color: '#10b981', bg: '#ecfdf5' }
            };
            const t = typeLabels[c.commentType] || typeLabels['general'];
            timeline.push({
                ts,
                type: 'comment',
                html: `
                    <div style="border-left:3px solid ${t.color};background:${t.bg};border-radius:0 10px 10px 0;padding:14px 16px;margin-bottom:12px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <span style="font-weight:600;font-size:13px;color:${t.color};">${t.icon} ${t.label}</span>
                            <span style="font-size:11px;color:#94a3b8;">${ts ? new Date(ts).toLocaleString('en-AU', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : ''}</span>
                        </div>
                        ${c.clientResponse ? `<div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:8px;"><div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;">CLIENT RESPONSE:</div><div style="font-size:13px;color:#1e293b;">${c.clientResponse}</div></div>` : ''}
                        <div style="font-size:13px;color:#1e293b;line-height:1.5;">${c.comment}</div>
                        <div style="margin-top:8px;font-size:11px;color:#94a3b8;">By ${c.createdByName || 'Unknown'} (${c.createdByRole || ''})</div>
                        ${c.fileName ? `<div style="font-size:11px;color:#94a3b8;">File: ${c.fileName}</div>` : ''}
                    </div>
                `
            });
        });

        activities.forEach(a => {
            const ts = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : 0;
            const actIcons = {
                'design_file_uploaded': '📤',
                'design_file_submitted': '📋',
                'design_file_approved': '✅',
                'design_file_rejected': '❌',
                'design_file_sent_to_client': '📧',
                'dc_comment_added': '💬',
                'deliverable_uploaded': '📁'
            };
            const icon = actIcons[a.type] || '📌';
            timeline.push({
                ts,
                type: 'activity',
                html: `
                    <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9;margin-bottom:4px;">
                        <div style="width:32px;height:32px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">${icon}</div>
                        <div style="flex:1;">
                            <div style="font-size:13px;color:#1e293b;line-height:1.4;">${a.details || a.type}</div>
                            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">
                                ${a.performedByName || ''} &bull; ${ts ? new Date(ts).toLocaleString('en-AU', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : ''}
                            </div>
                        </div>
                    </div>
                `
            });
        });

        // Sort timeline by most recent first
        timeline.sort((a, b) => b.ts - a.ts);

        const content = document.getElementById('dcHistoryContent');
        if (timeline.length === 0) {
            content.innerHTML = `
                <div style="text-align:center;padding:3rem;color:#94a3b8;">
                    <div style="font-size:2.5rem;margin-bottom:8px;">📋</div>
                    <p>No activity history found for this project.</p>
                </div>
            `;
        } else {
            // Separate comments and activities
            const commentItems = timeline.filter(t => t.type === 'comment');
            const activityItems = timeline.filter(t => t.type === 'activity');

            content.innerHTML = `
                <div style="display:flex;gap:8px;margin-bottom:1.25rem;">
                    <button onclick="dcHistoryTab('all')" class="dc-hist-tab active" style="padding:8px 16px;border:1px solid #e2e8f0;background:#8b5cf6;color:white;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;">
                        All (${timeline.length})
                    </button>
                    <button onclick="dcHistoryTab('comments')" class="dc-hist-tab" style="padding:8px 16px;border:1px solid #e2e8f0;background:white;color:#475569;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;">
                        💬 Comments (${commentItems.length})
                    </button>
                    <button onclick="dcHistoryTab('activities')" class="dc-hist-tab" style="padding:8px 16px;border:1px solid #e2e8f0;background:white;color:#475569;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;">
                        📌 Activities (${activityItems.length})
                    </button>
                </div>
                <div id="dcHistoryTimeline">
                    ${timeline.map(t => t.html).join('')}
                </div>
            `;

            // Store for filtering
            window._dcHistoryTimeline = timeline;
        }

    } catch (error) {
        console.error('Error loading DC history:', error);
        document.getElementById('dcHistoryContent').innerHTML = `
            <div style="text-align:center;padding:2rem;color:#ef4444;">
                <p>Error loading history: ${error.message}</p>
                <button onclick="openDCActivityHistory('${projectId}','${projectName}')" style="padding:8px 16px;background:#8b5cf6;color:white;border:none;border-radius:8px;cursor:pointer;margin-top:1rem;">Retry</button>
            </div>
        `;
    }
}

function dcHistoryTab(tab) {
    const timeline = window._dcHistoryTimeline || [];
    const container = document.getElementById('dcHistoryTimeline');
    if (!container) return;

    let filtered;
    if (tab === 'comments') filtered = timeline.filter(t => t.type === 'comment');
    else if (tab === 'activities') filtered = timeline.filter(t => t.type === 'activity');
    else filtered = timeline;

    container.innerHTML = filtered.length > 0
        ? filtered.map(t => t.html).join('')
        : '<div style="text-align:center;padding:2rem;color:#94a3b8;">No items found.</div>';

    document.querySelectorAll('.dc-hist-tab').forEach(btn => {
        btn.style.background = 'white';
        btn.style.color = '#475569';
    });
    event.target.style.background = '#8b5cf6';
    event.target.style.color = 'white';
}

window.openDCCommentModal = openDCCommentModal;
window.submitDCComment = submitDCComment;
window.openDCActivityHistory = openDCActivityHistory;
window.dcHistoryTab = dcHistoryTab;


// ============================================
// DC FILE TRACKER - COO & DIRECTOR PORTAL
// ============================================

async function showDCFileTracker() {
    setActiveNav('nav-dc-tracker-main');
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = '<div style="text-align: center; padding: 3rem;"><div class="spinner"></div><p>Loading DC File Tracker...</p></div>';

    try {
        // Fetch all design files (all statuses)
        const [allFilesResp, approvedResp] = await Promise.all([
            apiCall('projects?action=get_design_files'),
            apiCall('projects?action=get_approved_design_files')
        ]);

        const designFiles = allFilesResp.data || allFilesResp.designFiles || [];
        const approvedSentFiles = approvedResp.data || [];

        // Merge: use approvedSentFiles for approved/sent since they have richer data
        const approvedSentMap = {};
        approvedSentFiles.forEach(f => { approvedSentMap[f.id] = f; });

        const allFiles = designFiles.map(f => approvedSentMap[f.id] || f);
        // Also add any approved/sent files not in designFiles
        approvedSentFiles.forEach(f => {
            if (!designFiles.find(d => d.id === f.id)) allFiles.push(f);
        });

        // Sort by most recent first
        allFiles.sort((a, b) => {
            const dateA = a.createdAt?.seconds || a.uploadedAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || b.uploadedAt?.seconds || 0;
            return dateB - dateA;
        });

        // Categorize
        const uploaded = allFiles.filter(f => f.status === 'uploaded');
        const pendingApproval = allFiles.filter(f => f.status === 'pending_approval');
        const approved = allFiles.filter(f => f.status === 'approved');
        const sent = allFiles.filter(f => f.status === 'sent');
        const rejected = allFiles.filter(f => f.status === 'rejected');

        function formatDCDate(ts) {
            if (!ts) return '-';
            const ms = ts.seconds ? ts.seconds * 1000 : (typeof ts === 'number' ? ts : new Date(ts).getTime());
            if (!ms || isNaN(ms)) return '-';
            return new Date(ms).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
        }

        function getStatusBadge(status) {
            const badges = {
                'uploaded': '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#dbeafe;color:#1d4ed8;">📤 Uploaded</span>',
                'pending_approval': '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#fef3c7;color:#92400e;">⏳ Pending Approval</span>',
                'approved': '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#d1fae5;color:#065f46;">✅ Approved - Ready for DC</span>',
                'sent': '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#ede9fe;color:#5b21b6;">📧 Sent to Client</span>',
                'rejected': '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#fee2e2;color:#991b1b;">❌ Rejected</span>'
            };
            return badges[status] || `<span style="padding:4px 10px;border-radius:20px;font-size:11px;background:#f1f5f9;color:#64748b;">${status}</span>`;
        }

        function renderFileRow(file) {
            const isLink = file.isExternalLink || file.uploadType === 'link';
            const icon = isLink ? '🔗' : '📄';
            const fileName = file.fileName || file.originalName || 'Untitled';
            const fileLink = file.fileUrl ? `<a href="${file.fileUrl}" target="_blank" style="color:#3b82f6;text-decoration:none;font-weight:500;" title="${fileName}">${icon} ${fileName.length > 35 ? fileName.substring(0,35) + '...' : fileName}</a>` : `${icon} ${fileName}`;

            return `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:12px 14px;font-size:13px;">
                    <div style="font-weight:600;color:#1e293b;">${file.projectName || 'N/A'}</div>
                    <div style="font-size:11px;color:#94a3b8;">${file.projectCode || ''}</div>
                </td>
                <td style="padding:12px 14px;font-size:13px;">${fileLink}</td>
                <td style="padding:12px 14px;font-size:12px;font-weight:700;color:${({'IFA':'#3b82f6','IFC':'#10b981','Preliminary':'#f59e0b','Draft':'#6b7280','Final':'#8b5cf6'})[file.submissionStage||''] || '#64748b'};">${file.submissionStage || '-'}<br><span style="font-weight:500;color:#94a3b8;font-size:11px;">${file.revisionNumber || ''}</span></td>
                <td style="padding:12px 14px;font-size:13px;color:#475569;">${file.uploadedByName || '-'}</td>
                <td style="padding:12px 14px;font-size:13px;color:#475569;">${formatDCDate(file.uploadedAt || file.createdAt)}</td>
                <td style="padding:12px 14px;">${getStatusBadge(file.status)}</td>
                <td style="padding:12px 14px;font-size:13px;color:#475569;">${file.approvedByName || '-'}</td>
                <td style="padding:12px 14px;font-size:13px;color:#475569;">${formatDCDate(file.approvedAt)}</td>
                <td style="padding:12px 14px;font-size:13px;">
                    ${file.status === 'sent' ? `<div style="font-weight:500;color:#1e293b;">${file.clientEmail || '-'}</div><div style="font-size:11px;color:#94a3b8;">${file.clientName || ''}</div>` : '<span style="color:#cbd5e1;">-</span>'}
                </td>
                <td style="padding:12px 14px;font-size:13px;color:#475569;">${file.status === 'sent' ? formatDCDate(file.sentAt) : '<span style="color:#cbd5e1;">-</span>'}</td>
                <td style="padding:12px 14px;font-size:13px;color:#475569;">${file.sentByName || (file.status === 'sent' ? (file.sentBy || 'DC') : '<span style="color:#cbd5e1;">-</span>')}</td>
                <td style="padding:12px 14px;white-space:nowrap;">
                    <button onclick="openDCActivityHistory('${file.projectId}', '${(file.projectName || '').replace(/'/g, '')}')" style="padding:5px 10px;background:#8b5cf6;color:white;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:500;">📋 History</button>
                </td>
            </tr>`;
        }

        // Build the stats
        const stats = [
            { label: 'Uploaded', count: uploaded.length, color: '#3b82f6', bg: '#eff6ff', icon: '📤' },
            { label: 'Pending Approval', count: pendingApproval.length, color: '#f59e0b', bg: '#fffbeb', icon: '⏳' },
            { label: 'Approved (DC Ready)', count: approved.length, color: '#10b981', bg: '#ecfdf5', icon: '✅' },
            { label: 'Sent to Client', count: sent.length, color: '#8b5cf6', bg: '#f5f3ff', icon: '📧' },
            { label: 'Rejected', count: rejected.length, color: '#ef4444', bg: '#fef2f2', icon: '❌' }
        ];

        mainContent.innerHTML = `
            <div style="max-width: 1400px; margin: 0 auto; padding: 1.5rem;">
                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <div>
                        <h1 style="margin: 0; font-size: 1.6rem; font-weight: 700; color: #1e293b;">DC File Tracker</h1>
                        <p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">Track design files through the Document Controller pipeline</p>
                    </div>
                    <button onclick="showDCFileTracker()" style="padding: 8px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; font-size: 13px; color: #475569; display: flex; align-items: center; gap: 6px;">
                        🔄 Refresh
                    </button>
                </div>

                <!-- Stats Cards -->
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 1.5rem;">
                    ${stats.map(s => `
                        <div style="background: ${s.bg}; border: 1px solid ${s.color}22; border-radius: 12px; padding: 16px; text-align: center;">
                            <div style="font-size: 1.5rem; margin-bottom: 4px;">${s.icon}</div>
                            <div style="font-size: 1.6rem; font-weight: 700; color: ${s.color};">${s.count}</div>
                            <div style="font-size: 12px; color: #64748b; font-weight: 500;">${s.label}</div>
                        </div>
                    `).join('')}
                </div>

                <!-- Pipeline Progress -->
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 1.5rem;">
                    <div style="display: flex; align-items: center; gap: 0; justify-content: center;">
                        <div style="text-align: center; flex: 1;">
                            <div style="font-size: 11px; font-weight: 600; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.5px;">Uploaded</div>
                            <div style="font-size: 1.1rem; font-weight: 700; color: #1e293b;">${uploaded.length}</div>
                        </div>
                        <div style="color: #cbd5e1; font-size: 1.2rem;">→</div>
                        <div style="text-align: center; flex: 1;">
                            <div style="font-size: 11px; font-weight: 600; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.5px;">Pending Approval</div>
                            <div style="font-size: 1.1rem; font-weight: 700; color: #1e293b;">${pendingApproval.length}</div>
                        </div>
                        <div style="color: #cbd5e1; font-size: 1.2rem;">→</div>
                        <div style="text-align: center; flex: 1;">
                            <div style="font-size: 11px; font-weight: 600; color: #10b981; text-transform: uppercase; letter-spacing: 0.5px;">Approved</div>
                            <div style="font-size: 1.1rem; font-weight: 700; color: #1e293b;">${approved.length}</div>
                        </div>
                        <div style="color: #cbd5e1; font-size: 1.2rem;">→</div>
                        <div style="text-align: center; flex: 1;">
                            <div style="font-size: 11px; font-weight: 600; color: #8b5cf6; text-transform: uppercase; letter-spacing: 0.5px;">Sent to Client</div>
                            <div style="font-size: 1.1rem; font-weight: 700; color: #1e293b;">${sent.length}</div>
                        </div>
                    </div>
                </div>

                <!-- Filter Tabs -->
                <div style="display: flex; gap: 6px; margin-bottom: 1rem; flex-wrap: wrap;">
                    <button class="dc-tracker-filter active" onclick="filterDCTracker('all')" style="padding:8px 16px;border:1px solid #e2e8f0;background:#667eea;color:white;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;">
                        All (${allFiles.length})
                    </button>
                    <button class="dc-tracker-filter" onclick="filterDCTracker('uploaded')" style="padding:8px 16px;border:1px solid #e2e8f0;background:white;color:#475569;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;">
                        📤 Uploaded (${uploaded.length})
                    </button>
                    <button class="dc-tracker-filter" onclick="filterDCTracker('pending_approval')" style="padding:8px 16px;border:1px solid #e2e8f0;background:white;color:#475569;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;">
                        ⏳ Pending (${pendingApproval.length})
                    </button>
                    <button class="dc-tracker-filter" onclick="filterDCTracker('approved')" style="padding:8px 16px;border:1px solid #e2e8f0;background:white;color:#475569;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;">
                        ✅ Approved (${approved.length})
                    </button>
                    <button class="dc-tracker-filter" onclick="filterDCTracker('sent')" style="padding:8px 16px;border:1px solid #e2e8f0;background:white;color:#475569;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;">
                        📧 Sent (${sent.length})
                    </button>
                    <button class="dc-tracker-filter" onclick="filterDCTracker('rejected')" style="padding:8px 16px;border:1px solid #e2e8f0;background:white;color:#475569;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;">
                        ❌ Rejected (${rejected.length})
                    </button>
                </div>

                <!-- File Table -->
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; min-width: 1100px;">
                            <thead>
                                <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                    <th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Project</th>
                                    <th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">File</th>
                                    <th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Stage/Rev</th>
                                    <th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Uploaded By</th>
                                    <th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Upload Date</th>
                                    <th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Status</th>
                                    <th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Approved By</th>
                                    <th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Approved Date</th>
                                    <th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Sent To</th>
                                    <th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Sent Date</th>
                                    <th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Sent By</th>
                                    <th style="padding:12px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="dcTrackerTableBody">
                                ${allFiles.length > 0 ? allFiles.map(f => renderFileRow(f)).join('') : '<tr><td colspan="12" style="padding:3rem;text-align:center;color:#94a3b8;font-size:14px;">No design files found in the pipeline.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Sent to Client Detail Section -->
                ${sent.length > 0 ? `
                <div style="margin-top: 1.5rem; background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="padding: 16px 20px; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white;">
                        <h3 style="margin: 0; font-size: 1rem; font-weight: 600;">📧 Client Delivery Log</h3>
                        <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.85;">${sent.length} file${sent.length > 1 ? 's' : ''} sent to clients by Document Controller</p>
                    </div>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: #faf5ff; border-bottom: 2px solid #ede9fe;">
                                    <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#6d28d9;text-transform:uppercase;">Project</th>
                                    <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#6d28d9;text-transform:uppercase;">File</th>
                                    <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#6d28d9;text-transform:uppercase;">Client Email</th>
                                    <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#6d28d9;text-transform:uppercase;">Client Name</th>
                                    <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#6d28d9;text-transform:uppercase;">Sent Date</th>
                                    <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#6d28d9;text-transform:uppercase;">Sent By</th>
                                    <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#6d28d9;text-transform:uppercase;">Designer</th>
                                    <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#6d28d9;text-transform:uppercase;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sent.map(f => `
                                    <tr style="border-bottom:1px solid #f5f3ff;">
                                        <td style="padding:10px 14px;font-size:13px;">
                                            <div style="font-weight:600;color:#1e293b;">${f.projectName || 'N/A'}</div>
                                            <div style="font-size:11px;color:#94a3b8;">${f.projectCode || ''}</div>
                                        </td>
                                        <td style="padding:10px 14px;font-size:13px;">
                                            ${f.fileUrl ? `<a href="${f.fileUrl}" target="_blank" style="color:#8b5cf6;text-decoration:none;font-weight:500;">${(f.isExternalLink || f.uploadType === 'link') ? '🔗' : '📄'} ${(f.fileName || 'File').length > 30 ? (f.fileName || 'File').substring(0,30) + '...' : (f.fileName || 'File')}</a>` : (f.fileName || '-')}
                                        </td>
                                        <td style="padding:10px 14px;font-size:13px;font-weight:500;color:#1e293b;">${f.clientEmail || '-'}</td>
                                        <td style="padding:10px 14px;font-size:13px;color:#475569;">${f.clientName || '-'}</td>
                                        <td style="padding:10px 14px;font-size:13px;color:#475569;">${formatDCDate(f.sentAt)}</td>
                                        <td style="padding:10px 14px;font-size:13px;color:#475569;">${f.sentByName || f.sentBy || 'DC'}</td>
                                        <td style="padding:10px 14px;font-size:13px;color:#475569;">${f.uploadedByName || '-'}</td>
                                        <td style="padding:10px 14px;white-space:nowrap;">
                                            <button onclick="openDCActivityHistory('${f.projectId}', '${(f.projectName || '').replace(/'/g, '')}')" style="padding:5px 10px;background:#8b5cf6;color:white;border:none;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;">📋 History</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        // Store files for filtering
        window._dcTrackerFiles = allFiles;
        window._dcTrackerRenderRow = renderFileRow;

    } catch (error) {
        console.error('Error loading DC File Tracker:', error);
        mainContent.innerHTML = `
            <div style="text-align: center; padding: 3rem;">
                <h2 style="color: #ef4444;">Error Loading DC File Tracker</h2>
                <p style="color: #64748b;">${error.message}</p>
                <button onclick="showDCFileTracker()" style="padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer; margin-top: 1rem;">Try Again</button>
            </div>
        `;
    }
}

function filterDCTracker(status) {
    const files = window._dcTrackerFiles || [];
    const renderRow = window._dcTrackerRenderRow;
    if (!renderRow) return;

    const filtered = status === 'all' ? files : files.filter(f => f.status === status);
    const tbody = document.getElementById('dcTrackerTableBody');
    if (tbody) {
        tbody.innerHTML = filtered.length > 0
            ? filtered.map(f => renderRow(f)).join('')
            : `<tr><td colspan="12" style="padding:3rem;text-align:center;color:#94a3b8;font-size:14px;">No files matching this filter.</td></tr>`;
    }

    // Update active filter button
    document.querySelectorAll('.dc-tracker-filter').forEach(btn => {
        btn.style.background = 'white';
        btn.style.color = '#475569';
    });
    event.target.style.background = '#667eea';
    event.target.style.color = 'white';
}

window.showDCFileTracker = showDCFileTracker;
window.filterDCTracker = filterDCTracker;


// ============================================
// FILE ANALYTICS DASHBOARD - COO & DIRECTOR
// ============================================

async function showFileAnalyticsDashboard() {
    setActiveNav('nav-file-analytics');
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = '<div style="text-align:center;padding:3rem;"><div class="spinner"></div><p>Loading File Analytics...</p></div>';

    try {
        const response = await apiCall('projects?action=get_design_file_stats');
        if (!response.success) throw new Error(response.error || 'Failed to load stats');

        const { totalFiles, stageStats, statusStats, monthlyStats, recentFiles } = response;

        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

        function fmtMonth(key) {
            const [y, m] = key.split('-');
            return `${monthNames[parseInt(m)-1]} ${y}`;
        }

        // Find max for bar scaling
        const maxMonthTotal = Math.max(...monthlyStats.map(m => m.total), 1);

        mainContent.innerHTML = `
            <div style="max-width:1400px;margin:0 auto;padding:1.5rem;">
                <!-- Header -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
                    <div>
                        <h1 style="margin:0;font-size:1.6rem;font-weight:700;color:#1e293b;">File Analytics Dashboard</h1>
                        <p style="margin:4px 0 0;color:#64748b;font-size:14px;">Design file statistics - IFC, IFA & monthly breakdown</p>
                    </div>
                    <button onclick="showFileAnalyticsDashboard()" style="padding:8px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;font-size:13px;color:#475569;">🔄 Refresh</button>
                </div>

                <!-- Summary Stats -->
                <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:1.5rem;">
                    <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;">
                        <div style="font-size:2rem;font-weight:700;color:#1e293b;">${totalFiles}</div>
                        <div style="font-size:12px;color:#64748b;font-weight:600;">Total Files</div>
                    </div>
                    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;text-align:center;">
                        <div style="font-size:2rem;font-weight:700;color:#3b82f6;">${stageStats.IFA || 0}</div>
                        <div style="font-size:12px;color:#1d4ed8;font-weight:600;">IFA Files</div>
                    </div>
                    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px;text-align:center;">
                        <div style="font-size:2rem;font-weight:700;color:#10b981;">${stageStats.IFC || 0}</div>
                        <div style="font-size:12px;color:#065f46;font-weight:600;">IFC Files</div>
                    </div>
                    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;text-align:center;">
                        <div style="font-size:2rem;font-weight:700;color:#f59e0b;">${stageStats.Preliminary || 0}</div>
                        <div style="font-size:12px;color:#92400e;font-weight:600;">Preliminary</div>
                    </div>
                    <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:16px;text-align:center;">
                        <div style="font-size:2rem;font-weight:700;color:#8b5cf6;">${stageStats.Final || 0}</div>
                        <div style="font-size:12px;color:#5b21b6;font-weight:600;">Final</div>
                    </div>
                    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;text-align:center;">
                        <div style="font-size:2rem;font-weight:700;color:#ef4444;">${statusStats.sent || 0}</div>
                        <div style="font-size:12px;color:#991b1b;font-weight:600;">Sent to Client</div>
                    </div>
                </div>

                <!-- Status Pipeline -->
                <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:1.5rem;">
                    <h3 style="margin:0 0 16px;font-size:14px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Status Pipeline</h3>
                    <div style="display:flex;gap:0;align-items:center;">
                        ${[
                            {label:'Pending Approval',count:statusStats.pending_approval||0,color:'#f59e0b',bg:'#fffbeb'},
                            {label:'Approved',count:statusStats.approved||0,color:'#10b981',bg:'#ecfdf5'},
                            {label:'Sent',count:statusStats.sent||0,color:'#8b5cf6',bg:'#f5f3ff'},
                            {label:'Rejected',count:statusStats.rejected||0,color:'#ef4444',bg:'#fef2f2'}
                        ].map((s,i,arr) => `
                            <div style="flex:1;text-align:center;padding:12px;background:${s.bg};${i===0?'border-radius:8px 0 0 8px;':''}${i===arr.length-1?'border-radius:0 8px 8px 0;':''}">
                                <div style="font-size:1.4rem;font-weight:700;color:${s.color};">${s.count}</div>
                                <div style="font-size:11px;color:${s.color};font-weight:600;">${s.label}</div>
                            </div>
                            ${i < arr.length-1 ? '<div style="color:#cbd5e1;font-size:1.2rem;padding:0 4px;">→</div>' : ''}
                        `).join('')}
                    </div>
                </div>

                <!-- Monthly Breakdown -->
                <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:1.5rem;">
                    <h3 style="margin:0 0 16px;font-size:14px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Monthly Breakdown</h3>
                    ${monthlyStats.length > 0 ? `
                    <div style="overflow-x:auto;">
                        <table style="width:100%;border-collapse:collapse;min-width:800px;">
                            <thead>
                                <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                                    <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;">Month</th>
                                    <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:600;color:#64748b;">Total</th>
                                    <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:600;color:#3b82f6;">IFA</th>
                                    <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:600;color:#10b981;">IFC</th>
                                    <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:600;color:#f59e0b;">Preliminary</th>
                                    <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:600;color:#6b7280;">Draft</th>
                                    <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:600;color:#8b5cf6;">Final</th>
                                    <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:600;color:#ef4444;">Sent</th>
                                    <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;">Chart</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${monthlyStats.map(m => `
                                    <tr style="border-bottom:1px solid #f1f5f9;">
                                        <td style="padding:10px 14px;font-weight:600;color:#1e293b;font-size:13px;">${fmtMonth(m.month)}</td>
                                        <td style="padding:10px 14px;text-align:center;font-weight:700;font-size:14px;color:#1e293b;">${m.total}</td>
                                        <td style="padding:10px 14px;text-align:center;font-weight:600;color:#3b82f6;">${m.IFA || 0}</td>
                                        <td style="padding:10px 14px;text-align:center;font-weight:600;color:#10b981;">${m.IFC || 0}</td>
                                        <td style="padding:10px 14px;text-align:center;font-weight:600;color:#f59e0b;">${m.Preliminary || 0}</td>
                                        <td style="padding:10px 14px;text-align:center;font-weight:600;color:#6b7280;">${m.Draft || 0}</td>
                                        <td style="padding:10px 14px;text-align:center;font-weight:600;color:#8b5cf6;">${m.Final || 0}</td>
                                        <td style="padding:10px 14px;text-align:center;font-weight:600;color:#ef4444;">${m.sent || 0}</td>
                                        <td style="padding:10px 14px;min-width:200px;">
                                            <div style="display:flex;height:18px;border-radius:4px;overflow:hidden;background:#f1f5f9;">
                                                ${m.IFA ? `<div style="width:${(m.IFA/m.total)*100}%;background:#3b82f6;" title="IFA: ${m.IFA}"></div>` : ''}
                                                ${m.IFC ? `<div style="width:${(m.IFC/m.total)*100}%;background:#10b981;" title="IFC: ${m.IFC}"></div>` : ''}
                                                ${m.Preliminary ? `<div style="width:${(m.Preliminary/m.total)*100}%;background:#f59e0b;" title="Preliminary: ${m.Preliminary}"></div>` : ''}
                                                ${m.Draft ? `<div style="width:${(m.Draft/m.total)*100}%;background:#6b7280;" title="Draft: ${m.Draft}"></div>` : ''}
                                                ${m.Final ? `<div style="width:${(m.Final/m.total)*100}%;background:#8b5cf6;" title="Final: ${m.Final}"></div>` : ''}
                                                ${m.Other ? `<div style="width:${(m.Other/m.total)*100}%;background:#94a3b8;" title="Other: ${m.Other}"></div>` : ''}
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <!-- Legend -->
                    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid #f1f5f9;">
                        <span style="display:flex;align-items:center;gap:4px;font-size:11px;color:#64748b;"><span style="width:10px;height:10px;border-radius:2px;background:#3b82f6;display:inline-block;"></span> IFA</span>
                        <span style="display:flex;align-items:center;gap:4px;font-size:11px;color:#64748b;"><span style="width:10px;height:10px;border-radius:2px;background:#10b981;display:inline-block;"></span> IFC</span>
                        <span style="display:flex;align-items:center;gap:4px;font-size:11px;color:#64748b;"><span style="width:10px;height:10px;border-radius:2px;background:#f59e0b;display:inline-block;"></span> Preliminary</span>
                        <span style="display:flex;align-items:center;gap:4px;font-size:11px;color:#64748b;"><span style="width:10px;height:10px;border-radius:2px;background:#6b7280;display:inline-block;"></span> Draft</span>
                        <span style="display:flex;align-items:center;gap:4px;font-size:11px;color:#64748b;"><span style="width:10px;height:10px;border-radius:2px;background:#8b5cf6;display:inline-block;"></span> Final</span>
                    </div>
                    ` : '<div style="text-align:center;padding:2rem;color:#94a3b8;">No monthly data available yet.</div>'}
                </div>

                <!-- Recent Files -->
                ${recentFiles && recentFiles.length > 0 ? `
                <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:20px;">
                    <h3 style="margin:0 0 16px;font-size:14px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Recent Submissions</h3>
                    <div style="overflow-x:auto;">
                        <table style="width:100%;border-collapse:collapse;">
                            <thead>
                                <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                                    <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Project</th>
                                    <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">File</th>
                                    <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Stage</th>
                                    <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Rev</th>
                                    <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Designer</th>
                                    <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${recentFiles.slice(0, 15).map(f => {
                                    const stgColor = ({'IFA':'#3b82f6','IFC':'#10b981','Preliminary':'#f59e0b','Draft':'#6b7280','Final':'#8b5cf6'})[f.submissionStage||''] || '#64748b';
                                    const stBadge = ({'pending_approval':'⏳ Pending','approved':'✅ Approved','sent':'📧 Sent','rejected':'❌ Rejected','uploaded':'📤 Uploaded'})[f.status||''] || f.status;
                                    return `<tr style="border-bottom:1px solid #f1f5f9;">
                                        <td style="padding:8px 12px;font-size:13px;font-weight:500;color:#1e293b;">${f.projectName || 'N/A'}<br><span style="font-size:11px;color:#94a3b8;">${f.projectCode || ''}</span></td>
                                        <td style="padding:8px 12px;font-size:12px;color:#475569;">${f.fileUrl ? '<a href="' + f.fileUrl + '" target="_blank" style="color:#3b82f6;text-decoration:none;">' + ((f.fileName||'File').length > 25 ? (f.fileName||'File').substring(0,25)+'...' : (f.fileName||'File')) + '</a>' : (f.fileName||'-')}</td>
                                        <td style="padding:8px 12px;font-size:12px;font-weight:700;color:${stgColor};">${f.submissionStage || '-'}</td>
                                        <td style="padding:8px 12px;font-size:12px;color:#475569;">${f.revisionNumber || '-'}</td>
                                        <td style="padding:8px 12px;font-size:12px;color:#475569;">${f.uploadedByName || '-'}</td>
                                        <td style="padding:8px 12px;font-size:12px;">${stBadge}</td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                ` : ''}
            </div>
        `;

    } catch (error) {
        console.error('Error loading file analytics:', error);
        mainContent.innerHTML = `
            <div style="text-align:center;padding:3rem;">
                <h2 style="color:#ef4444;">Error Loading Analytics</h2>
                <p style="color:#64748b;">${error.message}</p>
                <button onclick="showFileAnalyticsDashboard()" style="padding:10px 20px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer;margin-top:1rem;">Try Again</button>
            </div>
        `;
    }
}
window.showFileAnalyticsDashboard = showFileAnalyticsDashboard;


// ============================================
// UPDATE ROLE VISIBILITY FUNCTION
// ============================================

function updateDesignApprovalVisibility() {
    const userRole = (currentUser && currentUser.role) ? currentUser.role.toLowerCase().trim() : '';
    const isCOO = userRole === 'coo';
    const isDirector = userRole === 'director';
    
    console.log('📐 updateDesignApprovalVisibility - userRole:', userRole, 'isCOO:', isCOO, 'isDirector:', isDirector);
    
    const navItem = document.getElementById('designApprovalNavItem');
    if (navItem) {
        navItem.style.display = (isCOO || isDirector) ? 'block' : 'none';
        console.log('📐 Nav item display set to:', navItem.style.display);
    } else {
        console.error('📐 designApprovalNavItem not found!');
    }
    
    // Fetch pending count for badge
    if (isCOO || isDirector) {
        apiCall('projects?action=get_design_files&status=pending_approval').then(response => {
            console.log('📐 Pending approvals response:', response);
            if (response.success) {
                const count = (response.data || []).length;
                const badge = document.getElementById('designApprovalBadge');
                if (badge) {
                    badge.textContent = count;
                    badge.style.display = count > 0 ? 'inline' : 'none';
                }
            }
        }).catch((err) => {
            console.error('📐 Error fetching pending approvals:', err);
        });
    }
}
window.updateDesignApprovalVisibility = updateDesignApprovalVisibility;

// Debug function to manually show design approval menu (call from console: showDesignApprovalMenu())
window.showDesignApprovalMenu = function() {
    const navItem = document.getElementById('designApprovalNavItem');
    if (navItem) {
        navItem.style.display = 'block';
        navItem.style.visibility = 'visible';
        console.log('📐 Design Approval Menu manually shown');
        alert('Design Approval menu should now be visible. Check the sidebar.');
    } else {
        console.error('📐 designApprovalNavItem element not found!');
        alert('Error: designApprovalNavItem element not found in the page!');
    }
};

// Debug function to check current user role
window.checkUserRole = function() {
    console.log('=== USER ROLE DEBUG ===');
    console.log('currentUser:', currentUser);
    console.log('currentUser.role:', currentUser ? currentUser.role : 'N/A');
    console.log('currentUserRole:', currentUserRole);
    alert('Check console for user role details.\n\ncurrentUserRole: ' + currentUserRole + '\ncurrentUser.role: ' + (currentUser ? currentUser.role : 'N/A'));
};


// ============================================
// RENDER DESIGN FILES FOR PROJECT (Designer View)
// ============================================

async function renderDesignFilesSection(projectId, containerElement) {
    try {
        const response = await apiCall(`projects?action=get_design_files&projectId=${projectId}`);
        
        if (!response.success) {
            return '<p style="color: #64748b;">Unable to load design files</p>';
        }
        
        const files = response.data || [];
        
        if (files.length === 0) {
            return `
                <div class="design-files-section">
                    <div class="design-files-header">
                        <h3>📐 Design Files</h3>
                    </div>
                    <p style="color: #64748b; text-align: center; padding: 20px;">No design files uploaded yet.</p>
                </div>
            `;
        }
        
        const fileCards = files.map(file => {
            let actionButton = '';
            
            if (file.status === 'uploaded') {
                actionButton = `<button class="btn btn-primary btn-sm" onclick="submitDesignForApproval('${file.id}', '${projectId}')">📤 Submit for Approval</button>`;
            } else if (file.status === 'pending_approval') {
                actionButton = `<span class="design-file-status status-pending_approval">⏳ Pending Approval</span>`;
            } else if (file.status === 'approved') {
                actionButton = `<button class="btn btn-success btn-sm" onclick="openSendToClientModal('${file.id}', '${projectId}')">📧 Send to Client</button>`;
            } else if (file.status === 'rejected') {
                actionButton = `<span class="design-file-status status-rejected">❌ Rejected</span>`;
            } else if (file.status === 'sent') {
                actionButton = `<span class="design-file-status status-sent">✅ Sent to Client</span>`;
            }
            
            return `
                <div class="design-file-card">
                    <div class="design-file-info">
                        <div class="design-file-name">📄 ${file.fileName}</div>
                        <div class="design-file-meta">
                            Client: ${file.clientEmail} | 
                            Size: ${formatFileSizeDesign(file.fileSize || 0)} |
                            ${file.uploadedAt ? new Date(file.uploadedAt.seconds ? file.uploadedAt.seconds * 1000 : file.uploadedAt).toLocaleDateString() : 'N/A'}
                        </div>
                    </div>
                    <div class="design-file-actions">
                        <a href="${file.fileUrl}" target="_blank" class="btn btn-secondary btn-sm">👁️ View</a>
                        ${actionButton}
                    </div>
                </div>
            `;
        }).join('');
        
        return `
            <div class="design-files-section">
                <div class="design-files-header">
                    <h3>📐 Design Files</h3>
                </div>
                ${fileCards}
            </div>
        `;
        
    } catch (error) {
        console.error('Error rendering design files:', error);
        return '<p style="color: #ef4444;">Error loading design files</p>';
    }
}
window.renderDesignFilesSection = renderDesignFilesSection;

console.log('✅ Design File Upload & Approval Module loaded');

// ============================================
// IT PORTAL - REQUEST FORM, DASHBOARD, PROCUREMENT WORKFLOW
// Workflow: User Request → IT Review (Store Check) → HR Cost → COO Approval → Director Final
// ============================================

const IT_CATEGORIES = {
    hardware: {
        label: 'Hardware Request',
        items: ['Desktop Computer', 'Laptop', 'Monitor', 'Keyboard & Mouse', 'Headset', 'Docking Station', 'Printer', 'Scanner', 'UPS/Power Backup', 'Webcam', 'External Hard Drive', 'Other Hardware']
    },
    software: {
        label: 'Software Request',
        items: ['Operating System', 'Microsoft Office', 'AutoCAD', 'Tekla Structures', 'SDS/2', 'Adobe Suite', 'Antivirus', 'VPN Client', 'Project Management Tool', 'Communication Tool', 'Other Software']
    },
    network: {
        label: 'Network & Connectivity',
        items: ['Internet Issue', 'Wi-Fi Access', 'VPN Setup', 'Email Configuration', 'Network Drive Access', 'Firewall Exception', 'Other Network Issue']
    },
    access: {
        label: 'Access & Permissions',
        items: ['New User Account', 'Password Reset', 'Email Account Setup', 'Shared Drive Access', 'Software License', 'Cloud Storage Access', 'Application Access', 'Other Access Request']
    },
    maintenance: {
        label: 'Maintenance & Repair',
        items: ['Computer Not Working', 'Slow Performance', 'Blue Screen/Crash', 'Data Recovery', 'Virus/Malware Removal', 'Hardware Repair', 'Software Update', 'Other Maintenance']
    },
    other: {
        label: 'Other IT Support',
        items: ['Training Request', 'Data Backup', 'Equipment Return', 'Workstation Setup', 'Meeting Room Tech Support', 'Other']
    }
};

function itStatusLabel(s) {
    const map = {
        'open': 'Open', 'in_progress': 'In Progress', 'available_in_store': 'Available in Store',
        'need_purchase': 'Need Purchase', 'pending_hr': 'Pending HR Review', 'pending_coo': 'Pending COO Approval',
        'pending_director': 'Pending Director Approval', 'coo_approved': 'COO Approved', 'approved': 'Approved',
        'rejected': 'Rejected', 'on_hold': 'On Hold', 'issued': 'Issued from Store',
        'delivered': 'Delivered', 'closed': 'Closed', 'resolved': 'Resolved'
    };
    return map[s] || (s || '').replace(/_/g, ' ').toUpperCase();
}
function itStatusColor(s) {
    const map = {
        'open': '#f59e0b', 'in_progress': '#3b82f6', 'available_in_store': '#10b981',
        'pending_hr': '#8b5cf6', 'pending_coo': '#e67e22', 'pending_director': '#2980b9',
        'approved': '#059669', 'rejected': '#ef4444', 'on_hold': '#6b7280',
        'issued': '#10b981', 'delivered': '#059669', 'closed': '#6b7280', 'resolved': '#10b981'
    };
    return map[s] || '#6b7280';
}
function itPriorityColor(p) {
    return { 'critical': '#dc2626', 'high': '#ef4444', 'medium': '#f59e0b', 'low': '#10b981' }[p] || '#6b7280';
}
function itFormatDate(ts) {
    if (!ts) return '-';
    try {
        if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'});
        if (ts._seconds) return new Date(ts._seconds * 1000).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'});
        if (typeof ts === 'string' || typeof ts === 'number') {
            const d = new Date(ts);
            if (!isNaN(d.getTime())) return d.toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'});
        }
        if (ts.toDate) return ts.toDate().toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'});
    } catch(e) {}
    return '-';
}
function itFormatDateTime(ts) {
    if (!ts) return '-';
    try {
        let d;
        if (ts.seconds) d = new Date(ts.seconds * 1000);
        else if (ts._seconds) d = new Date(ts._seconds * 1000);
        else if (ts.toDate) d = ts.toDate();
        else d = new Date(ts);
        if (!isNaN(d.getTime())) return d.toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}) + ' ' + d.toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'});
    } catch(e) {}
    return '-';
}

function itCurrencySymbol(c) {
    return {'USD':'$','INR':'₹','AUD':'A$','GBP':'£','EUR':'€','CAD':'C$'}[c] || c || '$';
}
function itFormatCost(amount, currency) {
    if (!amount && amount !== 0) return '-';
    const sym = itCurrencySymbol(currency);
    const val = parseFloat(amount);
    if (currency === 'INR') return sym + val.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2});
    return sym + val.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function itAttachmentsHtml(attachments, label) {
    if (!attachments || attachments.length === 0) return '';
    const title = label || 'Attachments';
    return `<div style="padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:10px;">
        <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:8px;">📎 ${title} (${attachments.length})</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${attachments.map((a,i) => {
                const ext = (a.fileName||'').split('.').pop().toLowerCase();
                const icon = ['jpg','jpeg','png','gif'].includes(ext) ? '🖼️' : ['pdf'].includes(ext) ? '📄' : ['doc','docx'].includes(ext) ? '📝' : ['xls','xlsx'].includes(ext) ? '📊' : '📎';
                return `<a href="${a.url}" target="_blank" download style="display:inline-flex;align-items:center;gap:5px;padding:6px 14px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;font-size:0.82rem;color:#1e40af;text-decoration:none;font-weight:500;transition:all 0.2s;" onmouseover="this.style.background='#eff6ff';this.style.borderColor='#93c5fd'" onmouseout="this.style.background='#fff';this.style.borderColor='#e2e8f0'">${icon} ${a.fileName||'File '+(i+1)}<span style="color:#93c5fd;margin-left:2px;">⬇</span></a>`;
            }).join('')}
        </div>
    </div>`;
}
function itQuotationsHtml(quotations, quotationUrl, quotationFileName) {
    if (quotations && quotations.length > 0) {
        return `<div style="padding:10px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:10px;">
            <div style="font-size:0.75rem;color:#1e40af;font-weight:600;text-transform:uppercase;margin-bottom:8px;">📎 Quotations (${quotations.length})</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${quotations.map((q,i) => {
                    const ext = (q.fileName||'').split('.').pop().toLowerCase();
                    const icon = ['pdf'].includes(ext) ? '📄' : ['doc','docx'].includes(ext) ? '📝' : ['xls','xlsx'].includes(ext) ? '📊' : ['jpg','jpeg','png'].includes(ext) ? '🖼️' : '📎';
                    return `<a href="${q.url}" target="_blank" download style="display:inline-flex;align-items:center;gap:5px;padding:6px 14px;background:#fff;border:1px solid #bfdbfe;border-radius:8px;font-size:0.82rem;color:#1e40af;text-decoration:none;font-weight:500;" onmouseover="this.style.background='#dbeafe'" onmouseout="this.style.background='#fff'">${icon} ${q.fileName||'Quotation '+(i+1)}<span style="color:#93c5fd;margin-left:2px;">⬇</span></a>`;
                }).join('')}
            </div>
        </div>`;
    }
    if (quotationUrl) {
        return `<div style="padding:10px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
            <span style="font-size:0.75rem;color:#1e40af;font-weight:600;">📎 QUOTATION:</span>
            <a href="${quotationUrl}" target="_blank" download style="color:#3b82f6;text-decoration:underline;font-weight:600;font-size:0.85rem;">${quotationFileName||'View Quotation'} ⬇</a>
        </div>`;
    }
    return '';
}

// Store tickets data for edit modal
let _itMyTicketsCache = [];

// --- IT Request Form (For all portal users) ---
async function showITRequestForm() {
    setActiveNav('nav-it-request');
    const mainContent = document.getElementById('mainContent');

    let myRequests = [];
    try {
        const resp = await apiCall('it-tickets/my-requests');
        if (resp.success) myRequests = resp.data || [];
    } catch(e) { console.error('Error fetching IT requests:', e); }

    const categoryOptions = Object.entries(IT_CATEGORIES).map(([key, val]) =>
        `<option value="${key}">${val.label}</option>`
    ).join('');

    // Cache for edit modal
    _itMyTicketsCache = myRequests;

    // Build request cards with tracking, edit, delete
    const requestCards = myRequests.map(t => {
        const isOpen = t.status === 'open';
        const isRejected = t.status === 'rejected';

        // Workflow steps with dates
        const steps = [{label:'Raised', done:true, icon:'📝', date:itFormatDate(t.createdAt)}];
        if (t.availability === 'in_store') {
            steps.push({label:'IT Reviewed', done:true, icon:'🔍', date:itFormatDate(t.itReviewedAt)});
            steps.push({label:'In Store', done:true, icon:'📦', date:''});
            steps.push({label:'Issued', done:t.status==='issued'||t.status==='closed', icon:'✅', date:itFormatDate(t.resolvedAt)});
        } else if (t.availability === 'need_purchase') {
            steps.push({label:'IT Reviewed', done:true, icon:'🔍', date:itFormatDate(t.itReviewedAt)});
            steps.push({label:'HR Review', done:!!t.hrReviewedAt, icon:'💰', date:itFormatDate(t.hrReviewedAt)});
            steps.push({label:'COO', done:!!t.cooApprovedAt, icon:'👔', date:itFormatDate(t.cooApprovedAt)});
            steps.push({label:'Director', done:!!t.directorApprovedAt, icon:'🎯', date:itFormatDate(t.directorApprovedAt)});
            if (t.status === 'approved') steps.push({label:'Approved', done:true, icon:'✅', date:itFormatDate(t.directorApprovedAt)});
        } else {
            steps.push({label:'IT Review', done:false, icon:'🔍', date:'Pending'});
        }
        if (isRejected) steps.push({label:'Rejected', done:true, icon:'❌', date:itFormatDate(t.updatedAt)});

        const tracker = steps.map((s,i) => {
            const isLast = i === steps.length - 1;
            const dotColor = s.done ? (s.label==='Rejected' ? '#ef4444' : '#10b981') : '#d1d5db';
            const bgColor = s.done ? (s.label==='Rejected' ? '#fef2f2' : '#f0fdf4') : '#f8fafc';
            return `<div style="display:flex;align-items:center;">
                <div style="display:flex;flex-direction:column;align-items:center;min-width:68px;">
                    <div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.9rem;background:${bgColor};border:2px solid ${dotColor};">${s.icon}</div>
                    <div style="font-size:0.7rem;color:${s.done?'#1e293b':'#94a3b8'};font-weight:600;margin-top:4px;text-align:center;line-height:1.2;">${s.label}</div>
                    ${s.date?`<div style="font-size:0.6rem;color:#94a3b8;margin-top:1px;">${s.date}</div>`:''}
                </div>
                ${!isLast?`<div style="width:28px;height:2px;background:${s.done?'#10b981':'#e2e8f0'};margin-bottom:24px;"></div>`:''}
            </div>`;
        }).join('');

        // Attachments
        const attachList = (t.attachments && t.attachments.length > 0)
            ? t.attachments.map((a,i)=>`<a href="${a.url}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;background:#eff6ff;border-radius:6px;font-size:0.8rem;color:#3b82f6;text-decoration:none;border:1px solid #dbeafe;">📎 ${a.fileName||'File '+(i+1)}</a>`).join(' ')
            : '';

        const closedDate = (t.resolvedAt) ? itFormatDate(t.resolvedAt) : null;

        return `
        <div class="card" style="padding:20px;margin-bottom:16px;border-left:4px solid ${itStatusColor(t.status)};">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
                <div>
                    <strong style="color:#1e3a8a;font-size:1.1rem;">${t.ticketNumber||'-'}</strong>
                    <span style="padding:3px 12px;border-radius:20px;font-size:0.75rem;font-weight:600;color:${itStatusColor(t.status)};background:${itStatusColor(t.status)}15;margin-left:8px;">${itStatusLabel(t.status)}</span>
                    <span style="padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;color:${itPriorityColor(t.priority)};background:${itPriorityColor(t.priority)}15;margin-left:4px;">${(t.priority||'').toUpperCase()}</span>
                </div>
                <div style="display:flex;gap:6px;align-items:center;">
                    ${isOpen?`<button class="btn btn-sm btn-secondary" onclick="openEditITTicket('${t.id}')" style="font-size:0.8rem;">✏️ Edit</button><button class="btn btn-sm btn-danger" onclick="deleteUserITTicket('${t.id}','${t.ticketNumber}')" style="font-size:0.8rem;">🗑️ Delete</button>`:''}
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                <div style="padding:10px 14px;background:#f8fafc;border-radius:8px;">
                    <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;font-weight:600;">Category</div>
                    <div style="font-weight:600;color:#1e293b;margin-top:2px;">${t.categoryLabel||t.category}</div>
                </div>
                <div style="padding:10px 14px;background:#f8fafc;border-radius:8px;">
                    <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;font-weight:600;">Item</div>
                    <div style="font-weight:600;color:#1e293b;margin-top:2px;">${t.item}${t.quantity>1?' (x'+t.quantity+')':''}</div>
                </div>
                <div style="padding:10px 14px;background:#f8fafc;border-radius:8px;">
                    <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;font-weight:600;">Raised On</div>
                    <div style="font-weight:600;color:#1e293b;margin-top:2px;">${itFormatDate(t.createdAt)}</div>
                </div>
                <div style="padding:10px 14px;background:${closedDate?'#f0fdf4':'#f8fafc'};border-radius:8px;">
                    <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;font-weight:600;">${closedDate?'Closed On':'Expected'}</div>
                    <div style="font-weight:600;color:${closedDate?'#059669':'#94a3b8'};margin-top:2px;">${closedDate||'In Progress'}</div>
                </div>
            </div>
            <div style="padding:10px 14px;background:#f8fafc;border-radius:8px;margin-bottom:14px;">
                <div style="font-size:0.75rem;color:#64748b;text-transform:uppercase;font-weight:600;">Subject</div>
                <div style="font-weight:500;color:#1e293b;margin-top:2px;">${t.subject}</div>
            </div>
            ${attachList?`<div style="margin-bottom:12px;display:flex;gap:6px;flex-wrap:wrap;">${attachList}</div>`:''}
            ${t.estimatedCost?`<div style="padding:8px 12px;background:#fef3c7;border-radius:8px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;"><span style="color:#92400e;font-weight:500;">Estimated Cost</span><strong style="color:#d97706;font-size:1.1rem;">${itFormatCost(t.estimatedCost,t.currency)}</strong></div>`:''}
            ${t.resolution?`<div style="padding:8px 12px;background:#f0fdf4;border-radius:8px;margin-bottom:10px;"><span style="color:#065f46;font-weight:600;">Resolution:</span> ${t.resolution}</div>`:''}

            <!-- Workflow Tracker -->
            <div style="padding:14px 16px;background:linear-gradient(135deg,#f8fafc,#f0f4f8);border-radius:10px;border:1px solid #e2e8f0;">
                <div style="font-size:0.75rem;color:#64748b;font-weight:600;text-transform:uppercase;margin-bottom:10px;">Request Progress</div>
                <div style="display:flex;align-items:flex-start;overflow-x:auto;">
                    ${tracker}
                </div>
            </div>
        </div>`;
    }).join('');

    mainContent.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
            <div>
                <h2 style="margin:0;color:#1e293b;">🖥️ IT Support Request</h2>
                <p style="margin:4px 0 0;color:#64748b;">Submit a request to the IT Helpdesk for hardware, software, access or support</p>
            </div>
        </div>

        <!-- Workflow Info -->
        <div class="card" style="padding:20px;margin-bottom:20px;background:linear-gradient(135deg,#eff6ff,#f5f3ff);">
            <h4 style="margin:0 0 12px;color:#1e3a8a;font-size:0.95rem;">📌 How IT Requests Work</h4>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:0.85rem;">
                <span style="padding:6px 14px;background:#fff;border-radius:20px;border:2px solid #3b82f6;color:#1e40af;font-weight:600;">1. You Submit</span>
                <span style="color:#94a3b8;">→</span>
                <span style="padding:6px 14px;background:#fff;border-radius:20px;border:2px solid #8b5cf6;color:#6d28d9;font-weight:600;">2. IT Checks Store</span>
                <span style="color:#94a3b8;">→</span>
                <span style="padding:6px 14px;background:#fff;border-radius:20px;border:2px solid #10b981;color:#059669;font-weight:600;">3a. In Store → Issued</span>
                <span style="color:#94a3b8;font-size:0.8rem;">or</span>
                <span style="padding:6px 14px;background:#fff;border-radius:20px;border:2px solid #f59e0b;color:#d97706;font-weight:600;">3b. Purchase → HR → COO → Director</span>
            </div>
        </div>

        <div class="card" style="padding:30px;margin-bottom:30px;">
            <h3 style="margin:0 0 20px;color:#1e3a8a;">📝 New IT Request</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                <div class="form-group">
                    <label style="font-weight:600;">Category <span style="color:#ef4444">*</span></label>
                    <select id="itCategory" class="form-control" onchange="updateITItems()">
                        <option value="">Select Category</option>
                        ${categoryOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label style="font-weight:600;">Item <span style="color:#ef4444">*</span></label>
                    <select id="itItem" class="form-control">
                        <option value="">Select Item</option>
                    </select>
                </div>
                <div class="form-group">
                    <label style="font-weight:600;">Quantity</label>
                    <input type="number" id="itQuantity" class="form-control" value="1" min="1" max="50">
                </div>
                <div class="form-group">
                    <label style="font-weight:600;">Priority</label>
                    <select id="itPriority" class="form-control">
                        <option value="low">Low</option>
                        <option value="medium" selected>Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical - Urgent</option>
                    </select>
                </div>
            </div>
            <div class="form-group" style="margin-top:10px;">
                <label style="font-weight:600;">Subject <span style="color:#ef4444">*</span></label>
                <input type="text" id="itSubject" class="form-control" placeholder="Brief subject of your request">
            </div>
            <div class="form-group" style="margin-top:10px;">
                <label style="font-weight:600;">Description <span style="color:#ef4444">*</span></label>
                <textarea id="itDescription" class="form-control" rows="4" placeholder="Please describe your request in detail - include asset tag numbers, software versions, specifications, or any relevant information..."></textarea>
            </div>
            <div class="form-group" style="margin-top:10px;">
                <label style="font-weight:600;">📎 Attach Files (optional)</label>
                <input type="file" id="itAttachFiles" class="form-control" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" multiple style="padding:8px;">
                <small style="color:#64748b;">PDF, Word, Excel, JPG, PNG - Max 10MB each - Select multiple files</small>
            </div>
            <div style="text-align:right;margin-top:20px;">
                <button class="btn btn-primary" onclick="submitITRequest()">🚀 Submit Request</button>
            </div>
        </div>

        <div style="margin-bottom:24px;">
            <h3 style="color:#1e3a8a;margin-bottom:16px;">📋 My IT Requests (${myRequests.length})</h3>
            ${myRequests.length===0?'<div class="card" style="padding:40px;text-align:center;"><p style="color:#94a3b8;">No IT requests submitted yet.</p></div>':requestCards}
        </div>
    </div>`;
}

function updateITItems() {
    const cat = document.getElementById('itCategory').value;
    const itemSelect = document.getElementById('itItem');
    itemSelect.innerHTML = '<option value="">Select Item</option>';
    if (cat && IT_CATEGORIES[cat]) {
        IT_CATEGORIES[cat].items.forEach(item => {
            itemSelect.innerHTML += `<option value="${item}">${item}</option>`;
        });
    }
}

async function submitITRequest() {
    const category = document.getElementById('itCategory').value;
    const item = document.getElementById('itItem').value;
    const quantity = document.getElementById('itQuantity').value;
    const priority = document.getElementById('itPriority').value;
    const subject = document.getElementById('itSubject').value.trim();
    const description = document.getElementById('itDescription').value.trim();

    if (!category || !item || !subject || !description) {
        return showMessage('Please fill in all required fields.', 'error');
    }

    // Upload attachments
    let attachments = [];
    const fileInput = document.getElementById('itAttachFiles');
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const files = Array.from(fileInput.files);
        for (const f of files) {
            if (f.size > 10 * 1024 * 1024) {
                return showMessage(`File "${f.name}" exceeds 10MB limit`, 'error');
            }
        }
        try {
            showMessage(`Uploading ${files.length} file(s)...`, 'info');
            const storageRef = firebase.storage().ref();
            for (const file of files) {
                const fileRef = storageRef.child(`it-attachments/${Date.now()}_${file.name}`);
                await fileRef.put(file);
                const url = await fileRef.getDownloadURL();
                attachments.push({ url, fileName: file.name });
            }
        } catch(e) {
            console.error('File upload error:', e);
            return showMessage('Failed to upload file(s)', 'error');
        }
    }

    try {
        showMessage('Submitting IT request...', 'info');
        const resp = await apiCall('it-tickets/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, item, quantity, priority, subject, description, attachments })
        });
        if (resp.success) {
            showMessage(`IT ticket ${resp.data?.ticketNumber||''} submitted successfully!`, 'success');
            showITRequestForm();
        } else {
            showMessage(resp.error || 'Failed to submit request', 'error');
        }
    } catch(e) {
        console.error('Submit IT request error:', e);
        showMessage('Failed to submit IT request', 'error');
    }
}

// Edit user ticket modal - uses cached data (safe from quote issues)
function openEditITTicket(ticketId) {
    const t = _itMyTicketsCache.find(x => x.id === ticketId);
    if (!t) return showMessage('Ticket not found', 'error');
    const category = t.category || '';
    const item = t.item || '';
    const quantity = t.quantity || 1;
    const priority = t.priority || 'medium';
    const subject = t.subject || '';
    const description = t.description || '';

    const categoryOptions = Object.entries(IT_CATEGORIES).map(([key, val]) =>
        `<option value="${key}" ${key===category?'selected':''}>${val.label}</option>`
    ).join('');
    const itemOptions = (IT_CATEGORIES[category]?.items || []).map(i =>
        `<option value="${i}" ${i===item?'selected':''}>${i}</option>`
    ).join('');

    const modal = document.createElement('div');
    modal.id = 'itEditModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;';
    modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:580px;width:92%;padding:30px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-height:90vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h3 style="margin:0;color:#1e3a8a;">✏️ Edit IT Request</h3>
            <button onclick="document.getElementById('itEditModal').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#94a3b8;">&times;</button>
        </div>
        <div style="padding:10px 14px;background:#eff6ff;border-radius:8px;margin-bottom:16px;font-size:0.9rem;">
            <strong style="color:#1e40af;">Ticket: ${t.ticketNumber}</strong>
            <span style="color:#64748b;margin-left:8px;">You can edit this ticket because it hasn't been reviewed yet.</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div class="form-group" style="margin:0;">
                <label style="font-weight:600;font-size:0.85rem;">Category</label>
                <select id="editItCategory" class="form-control" onchange="updateEditITItems()">
                    ${categoryOptions}
                </select>
            </div>
            <div class="form-group" style="margin:0;">
                <label style="font-weight:600;font-size:0.85rem;">Item</label>
                <select id="editItItem" class="form-control">
                    ${itemOptions}
                </select>
            </div>
            <div class="form-group" style="margin:0;">
                <label style="font-weight:600;font-size:0.85rem;">Quantity</label>
                <input type="number" id="editItQuantity" class="form-control" value="${quantity}" min="1">
            </div>
            <div class="form-group" style="margin:0;">
                <label style="font-weight:600;font-size:0.85rem;">Priority</label>
                <select id="editItPriority" class="form-control">
                    <option value="low" ${priority==='low'?'selected':''}>Low</option>
                    <option value="medium" ${priority==='medium'?'selected':''}>Medium</option>
                    <option value="high" ${priority==='high'?'selected':''}>High</option>
                    <option value="critical" ${priority==='critical'?'selected':''}>Critical</option>
                </select>
            </div>
        </div>
        <div class="form-group" style="margin-top:14px;">
            <label style="font-weight:600;font-size:0.85rem;">Subject</label>
            <input type="text" id="editItSubject" class="form-control" value="">
        </div>
        <div class="form-group" style="margin-top:10px;">
            <label style="font-weight:600;font-size:0.85rem;">Description</label>
            <textarea id="editItDescription" class="form-control" rows="3"></textarea>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">
            <button class="btn btn-secondary" onclick="document.getElementById('itEditModal').remove()">Cancel</button>
            <button class="btn btn-primary" onclick="saveEditITTicket('${ticketId}')">💾 Save Changes</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
    // Set values after DOM insert to avoid quote issues
    document.getElementById('editItSubject').value = subject;
    document.getElementById('editItDescription').value = description;
}

function updateEditITItems() {
    const cat = document.getElementById('editItCategory').value;
    const sel = document.getElementById('editItItem');
    sel.innerHTML = '';
    if (cat && IT_CATEGORIES[cat]) {
        IT_CATEGORIES[cat].items.forEach(i => { sel.innerHTML += `<option value="${i}">${i}</option>`; });
    }
}

async function saveEditITTicket(ticketId) {
    const data = {
        category: document.getElementById('editItCategory').value,
        item: document.getElementById('editItItem').value,
        quantity: document.getElementById('editItQuantity').value,
        priority: document.getElementById('editItPriority').value,
        subject: document.getElementById('editItSubject').value.trim(),
        description: document.getElementById('editItDescription').value.trim()
    };
    try {
        const resp = await apiCall(`it-tickets/user-edit/${ticketId}`, {
            method: 'PUT', headers: {'Content-Type':'application/json'},
            body: JSON.stringify(data)
        });
        if (resp.success) {
            showMessage('Ticket updated!', 'success');
            document.getElementById('itEditModal')?.remove();
            showITRequestForm();
        } else { showMessage(resp.error || 'Failed to update', 'error'); }
    } catch(e) { showMessage('Error updating ticket', 'error'); }
}

async function deleteUserITTicket(ticketId, ticketNumber) {
    if (!confirm(`Delete ticket ${ticketNumber}? This cannot be undone.`)) return;
    try {
        const resp = await apiCall(`it-tickets/user-delete/${ticketId}`, { method: 'DELETE' });
        if (resp.success) {
            showMessage('Ticket deleted', 'success');
            showITRequestForm();
        } else { showMessage(resp.error || 'Failed to delete', 'error'); }
    } catch(e) { showMessage('Error deleting ticket', 'error'); }
}

// --- IT Dashboard (For IT Helpdesk users) ---
async function showITDashboard() {
    setActiveNav('nav-it-dashboard');
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = '<div style="text-align:center;padding:60px;"><div class="loading-spinner"></div><p>Loading IT Dashboard...</p></div>';

    try {
        const [dashResp, allResp] = await Promise.all([
            apiCall('it-tickets/dashboard'),
            apiCall('it-tickets/all')
        ]);

        const dash = dashResp.success ? dashResp.data : {};
        const s = dash.summary || {};
        const monthly = dash.monthlyStats || [];
        const priority = dash.priority || {};
        const catStats = dash.categoryStats || {};
        const allTickets = allResp.success ? allResp.data || [] : [];

        const maxM = Math.max(...monthly.map(m => Math.max(m.created, m.closed)), 1);
        const monthlyBars = monthly.map(m => `
            <div style="flex:1;text-align:center;min-width:80px;">
                <div style="display:flex;justify-content:center;gap:4px;align-items:flex-end;height:120px;margin-bottom:8px;">
                    <div style="width:20px;background:#3b82f6;border-radius:4px 4px 0 0;height:${Math.max((m.created/maxM)*100,4)}px;" title="Created: ${m.created}"></div>
                    <div style="width:20px;background:#10b981;border-radius:4px 4px 0 0;height:${Math.max((m.closed/maxM)*100,4)}px;" title="Closed: ${m.closed}"></div>
                </div>
                <div style="font-size:0.75rem;color:#64748b;">${m.month}</div>
                <div style="font-size:0.7rem;color:#94a3b8;">${m.created}/${m.closed}</div>
            </div>
        `).join('');

        const catRows = Object.entries(catStats).map(([key, val]) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9;">
                <span style="font-weight:500;color:#334155;">${val.label||key}</span>
                <div style="display:flex;gap:12px;font-size:0.85rem;">
                    <span style="color:#f59e0b;">Open: ${val.open}</span>
                    <span style="color:#10b981;">Closed: ${val.closed}</span>
                    <span style="color:#64748b;">Total: ${val.total}</span>
                </div>
            </div>
        `).join('');

        // Tickets table with store check action
        const ticketRows = allTickets.map(t => {
            let actionBtn = '';
            if (t.status === 'open') {
                actionBtn = `<button class="btn btn-sm btn-primary" onclick="showITReviewModal('${t.id}','${(t.item||'').replace(/'/g,"\\'")}')">Check Store</button> <button class="btn btn-sm btn-danger" onclick="deleteITTicketAdmin('${t.id}','${t.ticketNumber}')" title="Delete">🗑️</button>`;
            } else if (t.status === 'available_in_store') {
                actionBtn = `<button class="btn btn-sm btn-success" onclick="itIssueItem('${t.id}')">Issue Item</button>`;
            } else {
                actionBtn = `<button class="btn btn-sm btn-secondary" onclick="showITTicketActions('${t.id}','${t.status}')">Manage</button> <button class="btn btn-sm btn-primary" onclick="showITTicketActions('${t.id}','${t.status}')" title="Edit">✏️ Edit</button> <button class="btn btn-sm btn-danger" onclick="deleteITTicketAdmin('${t.id}','${t.ticketNumber}')" title="Delete">🗑️ Delete</button>`;
            }
            return `<tr data-status="${t.status}">
                <td><strong style="color:#1e3a8a;">${t.ticketNumber||'-'}</strong></td>
                <td>${t.requestedByName||'-'}<br><span style="font-size:0.75rem;color:#94a3b8;">${t.requestedByRole||''}</span></td>
                <td>${t.categoryLabel||t.category}</td>
                <td>${t.item}${t.quantity>1?' (x'+t.quantity+')':''}</td>
                <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.subject}</td>
                <td><span style="padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;color:${itPriorityColor(t.priority)};background:${itPriorityColor(t.priority)}15;">${(t.priority||'medium').toUpperCase()}</span></td>
                <td><span style="padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;color:${itStatusColor(t.status)};background:${itStatusColor(t.status)}15;">${itStatusLabel(t.status)}</span></td>
                <td style="font-size:0.8rem;color:#6b7280;">${itFormatDate(t.createdAt)}</td>
                <td>${actionBtn}</td>
            </tr>`;
        }).join('');

        mainContent.innerHTML = `
        <div style="max-width:1200px;margin:0 auto;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
                <div>
                    <h2 style="margin:0;color:#1e293b;">🛠️ IT Helpdesk Dashboard</h2>
                    <p style="margin:4px 0 0;color:#64748b;">Manage tickets, check store availability, and process procurement</p>
                </div>
                <div style="display:flex;align-items:center;gap:12px;">
                    <button class="btn btn-primary" onclick="showStockPurchaseModal()" style="white-space:nowrap;">📦 Stock Purchase Request</button>
                    <div style="font-size:0.85rem;color:#94a3b8;">${new Date().toLocaleString()}</div>
                </div>
            </div>

            <!-- Summary Stats -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px;">
                <div style="border-top:4px solid #f59e0b;padding:18px;background:#fff;border-radius:12px;box-shadow:var(--card-shadow);cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;" onclick="filterITTicketsByStatus('open')" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)';" onmouseout="this.style.transform='';this.style.boxShadow='var(--card-shadow)';">
                    <div style="font-size:1.8rem;font-weight:700;color:#f59e0b;">${s.openTickets||0}</div>
                    <div style="color:#64748b;font-size:0.85rem;font-weight:500;">Open</div>
                </div>
                <div style="border-top:4px solid #3b82f6;padding:18px;background:#fff;border-radius:12px;box-shadow:var(--card-shadow);cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;" onclick="filterITTicketsByStatus('in_progress')" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)';" onmouseout="this.style.transform='';this.style.boxShadow='var(--card-shadow)';">
                    <div style="font-size:1.8rem;font-weight:700;color:#3b82f6;">${s.inProgressTickets||0}</div>
                    <div style="color:#64748b;font-size:0.85rem;font-weight:500;">In Progress</div>
                </div>
                <div style="border-top:4px solid #10b981;padding:18px;background:#fff;border-radius:12px;box-shadow:var(--card-shadow);cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;" onclick="filterITTicketsByStatus('available_in_store')" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)';" onmouseout="this.style.transform='';this.style.boxShadow='var(--card-shadow)';">
                    <div style="font-size:1.8rem;font-weight:700;color:#10b981;">${s.availableInStore||0}</div>
                    <div style="color:#64748b;font-size:0.85rem;font-weight:500;">In Store</div>
                </div>
                <div style="border-top:4px solid #8b5cf6;padding:18px;background:#fff;border-radius:12px;box-shadow:var(--card-shadow);cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;" onclick="filterITTicketsByStatus('pending_hr')" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)';" onmouseout="this.style.transform='';this.style.boxShadow='var(--card-shadow)';">
                    <div style="font-size:1.8rem;font-weight:700;color:#8b5cf6;">${s.pendingHR||0}</div>
                    <div style="color:#64748b;font-size:0.85rem;font-weight:500;">Pending HR</div>
                </div>
                <div style="border-top:4px solid #e67e22;padding:18px;background:#fff;border-radius:12px;box-shadow:var(--card-shadow);cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;" onclick="filterITTicketsByStatus('pending_coo')" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)';" onmouseout="this.style.transform='';this.style.boxShadow='var(--card-shadow)';">
                    <div style="font-size:1.8rem;font-weight:700;color:#e67e22;">${s.pendingCOO||0}</div>
                    <div style="color:#64748b;font-size:0.85rem;font-weight:500;">Pending COO</div>
                </div>
                <div style="border-top:4px solid #2980b9;padding:18px;background:#fff;border-radius:12px;box-shadow:var(--card-shadow);cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;" onclick="filterITTicketsByStatus('pending_director')" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)';" onmouseout="this.style.transform='';this.style.boxShadow='var(--card-shadow)';">
                    <div style="font-size:1.8rem;font-weight:700;color:#2980b9;">${s.pendingDirector||0}</div>
                    <div style="color:#64748b;font-size:0.85rem;font-weight:500;">Pending Director</div>
                </div>
                <div style="border-top:4px solid #059669;padding:18px;background:#fff;border-radius:12px;box-shadow:var(--card-shadow);cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;" onclick="filterITTicketsByStatus('closed')" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)';" onmouseout="this.style.transform='';this.style.boxShadow='var(--card-shadow)';">
                    <div style="font-size:1.8rem;font-weight:700;color:#059669;">${s.closedTickets||0}</div>
                    <div style="color:#64748b;font-size:0.85rem;font-weight:500;">Closed</div>
                </div>
                <div style="border-top:4px solid #64748b;padding:18px;background:#fff;border-radius:12px;box-shadow:var(--card-shadow);cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;" onclick="filterITTicketsByStatus(null)" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)';" onmouseout="this.style.transform='';this.style.boxShadow='var(--card-shadow)';">
                    <div style="font-size:1.8rem;font-weight:700;color:#64748b;">${s.totalTickets||0}</div>
                    <div style="color:#64748b;font-size:0.85rem;font-weight:500;">Total</div>
                </div>
            </div>

            <!-- Priority & Monthly -->
            <div style="display:grid;grid-template-columns:1fr 2fr;gap:20px;margin-bottom:24px;">
                <div class="card" style="padding:20px;">
                    <h3 style="margin:0 0 14px;color:#1e3a8a;font-size:0.95rem;">Active by Priority</h3>
                    <div style="display:flex;flex-direction:column;gap:8px;">
                        <div style="display:flex;justify-content:space-between;padding:8px 12px;background:#fef2f2;border-radius:8px;"><span style="font-weight:600;color:#dc2626;">Critical</span><span style="font-weight:700;color:#dc2626;">${priority.critical||0}</span></div>
                        <div style="display:flex;justify-content:space-between;padding:8px 12px;background:#fff7ed;border-radius:8px;"><span style="font-weight:600;color:#ef4444;">High</span><span style="font-weight:700;color:#ef4444;">${priority.high||0}</span></div>
                        <div style="display:flex;justify-content:space-between;padding:8px 12px;background:#fffbeb;border-radius:8px;"><span style="font-weight:600;color:#f59e0b;">Medium</span><span style="font-weight:700;color:#f59e0b;">${priority.medium||0}</span></div>
                        <div style="display:flex;justify-content:space-between;padding:8px 12px;background:#f0fdf4;border-radius:8px;"><span style="font-weight:600;color:#10b981;">Low</span><span style="font-weight:700;color:#10b981;">${priority.low||0}</span></div>
                    </div>
                </div>
                <div class="card" style="padding:20px;">
                    <h3 style="margin:0 0 14px;color:#1e3a8a;font-size:0.95rem;">Monthly Tickets (Created vs Closed)</h3>
                    <div style="display:flex;gap:8px;align-items:flex-end;">${monthlyBars||'<p style="color:#94a3b8;">No data</p>'}</div>
                    <div style="display:flex;gap:16px;justify-content:center;margin-top:10px;font-size:0.8rem;">
                        <span><span style="display:inline-block;width:12px;height:12px;background:#3b82f6;border-radius:2px;margin-right:4px;"></span>Created</span>
                        <span><span style="display:inline-block;width:12px;height:12px;background:#10b981;border-radius:2px;margin-right:4px;"></span>Closed</span>
                    </div>
                </div>
            </div>

            <!-- Category -->
            <div class="card" style="padding:20px;margin-bottom:24px;">
                <h3 style="margin:0 0 14px;color:#1e3a8a;font-size:0.95rem;">Tickets by Category</h3>
                ${catRows||'<p style="color:#94a3b8;text-align:center;">No data</p>'}
            </div>

            <!-- All Tickets -->
            <div class="card" style="padding:20px;" id="itTicketTableSection">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                    <h3 style="margin:0;color:#1e3a8a;font-size:0.95rem;" id="itTicketTableHeading">All Tickets (${allTickets.length})</h3>
                    <button id="itClearFilterBtn" onclick="filterITTicketsByStatus(null)" style="display:none;font-size:0.8rem;padding:4px 12px;border-radius:20px;border:1px solid #3b82f6;background:#eff6ff;color:#3b82f6;cursor:pointer;">✕ Clear Filter</button>
                </div>
                ${allTickets.length===0?'<p style="color:#94a3b8;text-align:center;padding:20px;">No tickets found.</p>':`
                <div style="overflow-x:auto;">
                    <table class="data-table" id="itTicketsTable">
                        <thead><tr><th>Ticket #</th><th>Requester</th><th>Category</th><th>Item</th><th>Subject</th><th>Priority</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
                        <tbody>${ticketRows}</tbody>
                    </table>
                </div>`}
            </div>
        </div>`;
    } catch(e) {
        console.error('Error loading IT dashboard:', e);
        mainContent.innerHTML = '<div class="card" style="padding:40px;text-align:center;"><p style="color:#ef4444;">Error loading IT Dashboard.</p></div>';
    }
}

// Filter IT Tickets table by status from dashboard stat cards
function filterITTicketsByStatus(status) {
    const table = document.getElementById('itTicketsTable');
    const heading = document.getElementById('itTicketTableHeading');
    const clearBtn = document.getElementById('itClearFilterBtn');
    const section = document.getElementById('itTicketTableSection');
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    let visibleCount = 0;
    rows.forEach(row => {
        if (!status || row.dataset.status === status) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    if (heading) {
        const statusLabels = {
            'open': 'Open', 'in_progress': 'In Progress', 'available_in_store': 'In Store',
            'pending_hr': 'Pending HR', 'pending_coo': 'Pending COO',
            'pending_director': 'Pending Director', 'closed': 'Closed'
        };
        heading.textContent = status
            ? `${statusLabels[status] || status} Tickets (${visibleCount})`
            : `All Tickets (${rows.length})`;
    }
    if (clearBtn) clearBtn.style.display = status ? '' : 'none';
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// IT Store Check Modal
function showITReviewModal(ticketId, itemName) {
    const modal = document.createElement('div');
    modal.id = 'itTicketModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;';
    modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:600px;width:92%;padding:30px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-height:90vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h3 style="margin:0;color:#1e3a8a;">🔍 Store Availability Check</h3>
            <button onclick="document.getElementById('itTicketModal').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#94a3b8;">&times;</button>
        </div>
        <div style="padding:16px;background:#f8fafc;border-radius:10px;margin-bottom:20px;">
            <div style="font-weight:600;color:#334155;">Item: ${itemName}</div>
        </div>
        <p style="color:#475569;margin-bottom:16px;font-size:0.95rem;">Is this item available in the IT store?</p>
        <div class="form-group">
            <label style="font-weight:600;">IT Notes (optional)</label>
            <textarea id="itReviewNotes" class="form-control" rows="2" placeholder="Add notes about availability, specifications, etc."></textarea>
        </div>

        <!-- Purchase Details (shown when Need Purchase is selected) -->
        <div id="itPurchaseDetails" style="display:none;margin-top:16px;padding:16px;background:#fffbeb;border-radius:10px;border:2px solid #fef3c7;">
            <h4 style="margin:0 0 14px;color:#92400e;font-size:0.95rem;">🛒 Purchase Details</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-weight:600;font-size:0.85rem;">Estimated Cost</label>
                    <input type="number" id="itEstCost" class="form-control" placeholder="0.00" step="0.01" min="0">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-weight:600;font-size:0.85rem;">Vendor / Supplier</label>
                    <input type="text" id="itVendor" class="form-control" placeholder="Vendor name">
                </div>
            </div>
            <div class="form-group" style="margin:12px 0 0;">
                <label style="font-weight:600;font-size:0.85rem;">📎 Upload Quotation (PDF / Word)</label>
                <input type="file" id="itQuotationFile" class="form-control" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" multiple style="padding:8px;">
                <small style="color:#64748b;">Accepted: PDF, DOC, DOCX, XLS, XLSX (Max 10MB each) - Select multiple files</small>
            </div>
        </div>

        <div style="display:flex;gap:10px;margin-top:20px;">
            <button class="btn btn-success" style="flex:1;" onclick="itReviewTicket('${ticketId}','in_store')">✅ Available in Store</button>
            <button class="btn btn-warning" style="flex:1;color:#fff;background:#f59e0b;" id="btnNeedPurchase" onclick="itShowPurchaseOrSubmit('${ticketId}')">🛒 Need to Purchase</button>
        </div>
        <div style="text-align:center;margin-top:10px;">
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('itTicketModal').remove()">Cancel</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
}

// Toggle purchase details form, then submit on second click
function itShowPurchaseOrSubmit(ticketId) {
    const details = document.getElementById('itPurchaseDetails');
    if (details && details.style.display === 'none') {
        details.style.display = 'block';
        document.getElementById('btnNeedPurchase').textContent = '📤 Submit Purchase Request';
        document.getElementById('btnNeedPurchase').onclick = () => itReviewTicket(ticketId, 'need_purchase');
    }
}

async function itReviewTicket(ticketId, availability) {
    const itNotes = document.getElementById('itReviewNotes')?.value.trim() || '';
    let body = { availability, itNotes };

    if (availability === 'need_purchase') {
        body.estimatedCost = document.getElementById('itEstCost')?.value || '';
        body.vendor = document.getElementById('itVendor')?.value.trim() || '';

        // Upload quotation files (multiple)
        const fileInput = document.getElementById('itQuotationFile');
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            const files = Array.from(fileInput.files);
            for (const f of files) {
                if (f.size > 10 * 1024 * 1024) {
                    return showMessage(`File "${f.name}" exceeds 10MB limit`, 'error');
                }
            }
            try {
                showMessage(`Uploading ${files.length} quotation(s)...`, 'info');
                const storageRef = firebase.storage().ref();
                const quotations = [];
                for (const file of files) {
                    const fileRef = storageRef.child(`it-quotations/${ticketId}_${Date.now()}_${file.name}`);
                    await fileRef.put(file);
                    const url = await fileRef.getDownloadURL();
                    quotations.push({ url, fileName: file.name });
                }
                // First file as primary (backward compatible)
                body.quotationUrl = quotations[0].url;
                body.quotationFileName = quotations[0].fileName;
                // All files
                body.quotations = quotations;
            } catch(e) {
                console.error('Quotation upload error:', e);
                return showMessage('Failed to upload quotation file(s)', 'error');
            }
        }
    }

    try {
        showMessage('Processing...', 'info');
        const resp = await apiCall(`it-tickets/it-review/${ticketId}`, {
            method: 'PUT',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(body)
        });
        if (resp.success) {
            showMessage(resp.message || 'Ticket reviewed!', 'success');
            document.getElementById('itTicketModal')?.remove();
            showITDashboard();
        } else {
            showMessage(resp.error || 'Failed', 'error');
        }
    } catch(e) { showMessage('Error reviewing ticket', 'error'); }
}

async function itIssueItem(ticketId) {
    if (!confirm('Confirm issuing this item from store?')) return;
    try {
        const resp = await apiCall(`it-tickets/it-issue/${ticketId}`, {
            method: 'PUT',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ resolution: 'Item issued from IT store' })
        });
        if (resp.success) {
            showMessage('Item issued successfully!', 'success');
            showITDashboard();
        } else { showMessage(resp.error || 'Failed', 'error'); }
    } catch(e) { showMessage('Error issuing item', 'error'); }
}

// General ticket update modal
function showITTicketActions(ticketId, currentStatus) {
    const modal = document.createElement('div');
    modal.id = 'itTicketModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;';
    modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:500px;width:90%;padding:30px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h3 style="margin:0;color:#1e3a8a;">🛠️ Update Ticket</h3>
            <button onclick="document.getElementById('itTicketModal').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#94a3b8;">&times;</button>
        </div>
        <div class="form-group">
            <label style="font-weight:600;">Status</label>
            <select id="itTicketStatus" class="form-control">
                <option value="open" ${currentStatus==='open'?'selected':''}>Open</option>
                <option value="in_progress" ${currentStatus==='in_progress'?'selected':''}>In Progress</option>
                <option value="on_hold" ${currentStatus==='on_hold'?'selected':''}>On Hold</option>
                <option value="resolved" ${currentStatus==='resolved'?'selected':''}>Resolved</option>
                <option value="delivered" ${currentStatus==='delivered'?'selected':''}>Delivered</option>
                <option value="closed" ${currentStatus==='closed'?'selected':''}>Closed</option>
            </select>
        </div>
        <div class="form-group">
            <label style="font-weight:600;">Resolution / Notes</label>
            <textarea id="itTicketResolution" class="form-control" rows="3" placeholder="Add resolution notes..."></textarea>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">
            <button class="btn btn-secondary" onclick="document.getElementById('itTicketModal').remove()">Cancel</button>
            <button class="btn btn-primary" onclick="updateITTicket('${ticketId}')">Update</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
}

async function deleteITTicketAdmin(ticketId, ticketNumber) {
    if (!confirm(`Delete ticket ${ticketNumber}? This cannot be undone.`)) return;
    try {
        const resp = await apiCall(`it-tickets/${ticketId}`, { method: 'DELETE' });
        if (resp.success) {
            showMessage('Ticket deleted', 'success');
            showITDashboard();
        } else { showMessage(resp.error || 'Failed to delete', 'error'); }
    } catch(e) { showMessage('Error deleting ticket', 'error'); }
}

async function updateITTicket(ticketId) {
    const status = document.getElementById('itTicketStatus').value;
    const resolution = document.getElementById('itTicketResolution').value.trim();
    try {
        const resp = await apiCall(`it-tickets/update/${ticketId}`, {
            method: 'PUT',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ status, resolution, notes: resolution })
        });
        if (resp.success) {
            showMessage('Ticket updated!', 'success');
            document.getElementById('itTicketModal')?.remove();
            showITDashboard();
        } else { showMessage(resp.error || 'Failed', 'error'); }
    } catch(e) { showMessage('Failed to update ticket', 'error'); }
}

// --- Stock Purchase Request Modal (IT creates for store stock) ---
function showStockPurchaseModal() {
    const categoryOptions = Object.entries(IT_CATEGORIES).map(([key, val]) =>
        `<option value="${key}">${val.label}</option>`
    ).join('');

    const modal = document.createElement('div');
    modal.id = 'itStockModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;';
    modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:650px;width:92%;padding:30px;box-shadow:0 20px 60px rgba(0,0,0,0.3);max-height:90vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h3 style="margin:0;color:#1e3a8a;">📦 Stock Purchase Request</h3>
            <button onclick="document.getElementById('itStockModal').remove()" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#94a3b8;">&times;</button>
        </div>
        <p style="color:#64748b;margin-bottom:16px;font-size:0.9rem;">Purchase materials for IT store stock. This will go through HR → COO → Director approval.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div class="form-group" style="margin:0;">
                <label style="font-weight:600;font-size:0.85rem;">Category</label>
                <select id="stockCategory" class="form-control" onchange="updateStockItems()">
                    <option value="">Select Category</option>
                    ${categoryOptions}
                </select>
            </div>
            <div class="form-group" style="margin:0;">
                <label style="font-weight:600;font-size:0.85rem;">Item <span style="color:#ef4444">*</span></label>
                <select id="stockItem" class="form-control">
                    <option value="">Select Item</option>
                </select>
            </div>
            <div class="form-group" style="margin:0;">
                <label style="font-weight:600;font-size:0.85rem;">Quantity <span style="color:#ef4444">*</span></label>
                <input type="number" id="stockQuantity" class="form-control" value="1" min="1" max="100">
            </div>
            <div class="form-group" style="margin:0;">
                <label style="font-weight:600;font-size:0.85rem;">Estimated Cost</label>
                <input type="number" id="stockCost" class="form-control" placeholder="0.00" step="0.01">
            </div>
            <div class="form-group" style="margin:0;">
                <label style="font-weight:600;font-size:0.85rem;">Currency</label>
                <select id="stockCurrency" class="form-control">
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="AUD">AUD (A$)</option>
                    <option value="GBP">GBP (£)</option>
                </select>
            </div>
            <div class="form-group" style="margin:0;">
                <label style="font-weight:600;font-size:0.85rem;">Vendor / Supplier</label>
                <input type="text" id="stockVendor" class="form-control" placeholder="Vendor name">
            </div>
        </div>
        <div class="form-group" style="margin-top:14px;">
            <label style="font-weight:600;font-size:0.85rem;">Subject <span style="color:#ef4444">*</span></label>
            <input type="text" id="stockSubject" class="form-control" placeholder="e.g. Purchase 10 Keyboards for stock replenishment">
        </div>
        <div class="form-group" style="margin-top:10px;">
            <label style="font-weight:600;font-size:0.85rem;">Description / Justification <span style="color:#ef4444">*</span></label>
            <textarea id="stockDescription" class="form-control" rows="3" placeholder="Why is this purchase needed? Include specifications, current stock levels, etc."></textarea>
        </div>
        <div class="form-group" style="margin-top:10px;">
            <label style="font-weight:600;font-size:0.85rem;">📎 Upload Quotation (PDF / Word / Excel)</label>
            <input type="file" id="stockQuotationFile" class="form-control" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" multiple style="padding:8px;">
            <small style="color:#64748b;">Accepted: PDF, DOC, DOCX, XLS, XLSX (Max 10MB each) - Select multiple files</small>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">
            <button class="btn btn-secondary" onclick="document.getElementById('itStockModal').remove()">Cancel</button>
            <button class="btn btn-primary" onclick="submitStockPurchase()">📤 Submit to HR for Approval</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
}

function updateStockItems() {
    const cat = document.getElementById('stockCategory').value;
    const itemSelect = document.getElementById('stockItem');
    itemSelect.innerHTML = '<option value="">Select Item</option>';
    if (cat && IT_CATEGORIES[cat]) {
        IT_CATEGORIES[cat].items.forEach(item => {
            itemSelect.innerHTML += `<option value="${item}">${item}</option>`;
        });
    }
}

async function submitStockPurchase() {
    const category = document.getElementById('stockCategory').value;
    const item = document.getElementById('stockItem').value;
    const quantity = document.getElementById('stockQuantity').value;
    const estimatedCost = document.getElementById('stockCost').value;
    const currency = document.getElementById('stockCurrency').value;
    const vendor = document.getElementById('stockVendor').value.trim();
    const subject = document.getElementById('stockSubject').value.trim();
    const description = document.getElementById('stockDescription').value.trim();

    if (!item || !subject || !description) {
        return showMessage('Please fill in Item, Subject, and Description.', 'error');
    }

    let quotationUrl = null, quotationFileName = null, quotations = [];
    const fileInput = document.getElementById('stockQuotationFile');
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const files = Array.from(fileInput.files);
        for (const f of files) {
            if (f.size > 10 * 1024 * 1024) {
                return showMessage(`File "${f.name}" exceeds 10MB limit`, 'error');
            }
        }
        try {
            showMessage(`Uploading ${files.length} quotation(s)...`, 'info');
            const storageRef = firebase.storage().ref();
            for (const file of files) {
                const fileRef = storageRef.child(`it-quotations/stock_${Date.now()}_${file.name}`);
                await fileRef.put(file);
                const url = await fileRef.getDownloadURL();
                quotations.push({ url, fileName: file.name });
            }
            quotationUrl = quotations[0].url;
            quotationFileName = quotations[0].fileName;
        } catch(e) {
            console.error('Upload error:', e);
            return showMessage('Failed to upload quotation(s)', 'error');
        }
    }

    try {
        showMessage('Submitting stock purchase request...', 'info');
        const resp = await apiCall('it-tickets/stock-purchase', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ category, item, quantity, subject, description, vendor, estimatedCost, currency, quotationUrl, quotationFileName, quotations })
        });
        if (resp.success) {
            showMessage(`Stock purchase ${resp.data?.ticketNumber||''} submitted to HR!`, 'success');
            document.getElementById('itStockModal')?.remove();
            showITDashboard();
        } else { showMessage(resp.error || 'Failed', 'error'); }
    } catch(e) { showMessage('Failed to submit stock purchase', 'error'); }
}

// Update IT badge
async function updateITOpenTicketsBadge() {
    try {
        const resp = await apiCall('it-tickets/dashboard');
        if (resp.success) {
            const s = resp.data?.summary || {};
            const open = (s.openTickets||0) + (s.inProgressTickets||0) + (s.pendingHR||0) + (s.pendingCOO||0) + (s.pendingDirector||0);
            const badge = document.getElementById('itOpenTicketsBadge');
            if (badge) { badge.textContent = open; badge.style.display = open > 0 ? 'inline-block' : 'none'; }
        }
    } catch(e) { console.error('Error updating IT badge:', e); }
}

// Update HR IT Procurement badge
async function updateHRITPendingBadge() {
    try {
        const resp = await apiCall('it-tickets/pending-hr');
        if (resp.success) {
            const count = (resp.data || []).length;
            const badge = document.getElementById('hrITPendingBadge');
            if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline-block' : 'none'; }
        }
    } catch(e) { console.error('Error updating HR IT badge:', e); }
}

// --- HR IT Procurement (HR adds cost & sends to COO) ---
async function showHRITProcurement() {
    setActiveNav('nav-hr-it-procurement');
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = '<div style="text-align:center;padding:60px;"><div class="loading-spinner"></div><p>Loading IT Procurement Requests...</p></div>';

    try {
        const [pendingResp, allResp] = await Promise.all([
            apiCall('it-tickets/pending-hr'),
            apiCall('it-tickets/all')
        ]);
        const pending = pendingResp.success ? pendingResp.data || [] : [];
        const allTickets = allResp.success ? (allResp.data || []).filter(t => t.availability === 'need_purchase') : [];

        const pendingCards = pending.map(t => `
        <div class="card" style="padding:20px;margin-bottom:16px;border-left:4px solid #8b5cf6;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                <div>
                    <strong style="color:#1e3a8a;font-size:1.1rem;">${t.ticketNumber}</strong>
                    <span style="padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;color:${itPriorityColor(t.priority)};background:${itPriorityColor(t.priority)}15;margin-left:8px;">${(t.priority||'medium').toUpperCase()}</span>
                </div>
                <span style="font-size:0.85rem;color:#94a3b8;">${itFormatDate(t.createdAt)}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
                <div><span style="color:#64748b;font-size:0.85rem;">Requested By:</span><br><strong>${t.requestedByName}</strong> <span style="color:#94a3b8;font-size:0.8rem;">(${t.requestedByRole})</span></div>
                <div><span style="color:#64748b;font-size:0.85rem;">Category:</span><br><strong>${t.categoryLabel||t.category}</strong></div>
                <div><span style="color:#64748b;font-size:0.85rem;">Item:</span><br><strong>${t.item}</strong>${t.quantity>1?' (x'+t.quantity+')':''}</div>
                <div><span style="color:#64748b;font-size:0.85rem;">Subject:</span><br><strong>${t.subject}</strong></div>
            </div>
            <div style="background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:16px;">
                <span style="color:#64748b;font-size:0.85rem;">Description:</span><br>
                <span style="color:#334155;">${t.description}</span>
            </div>
            ${t.itNotes?`<div style="background:#fffbeb;padding:10px;border-radius:8px;margin-bottom:10px;font-size:0.9rem;"><strong style="color:#92400e;">IT Notes:</strong> ${t.itNotes}</div>`:''}
            ${(t.quotations&&t.quotations.length>0)?`<div style="background:#eff6ff;padding:12px;border-radius:8px;margin-bottom:10px;font-size:0.9rem;"><div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;"><span style="font-size:1.2rem;">📎</span><strong style="color:#1e40af;">Quotations (${t.quotations.length}):</strong></div>${t.quotations.map((q,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#fff;border-radius:6px;margin-bottom:4px;border:1px solid #dbeafe;"><span style="color:#3b82f6;font-weight:600;min-width:20px;">${i+1}.</span><a href="${q.url}" target="_blank" style="color:#3b82f6;text-decoration:underline;font-weight:500;">${q.fileName||'Quotation '+(i+1)}</a></div>`).join('')}</div>`:t.quotationUrl?`<div style="background:#eff6ff;padding:10px;border-radius:8px;margin-bottom:10px;font-size:0.9rem;display:flex;align-items:center;gap:8px;"><span style="font-size:1.2rem;">📎</span><strong style="color:#1e40af;">Quotation:</strong> <a href="${t.quotationUrl}" target="_blank" style="color:#3b82f6;text-decoration:underline;font-weight:600;">${t.quotationFileName||'View Quotation'}</a></div>`:''}
            ${t.itEstimatedCost?`<div style="background:#f0fdf4;padding:10px;border-radius:8px;margin-bottom:10px;font-size:0.9rem;"><strong style="color:#065f46;">IT Estimated Cost:</strong> ${itFormatCost(t.itEstimatedCost,t.currency)}${t.itVendor?' | Vendor: '+t.itVendor:''}</div>`:''}
            ${t.ticketType==='stock_purchase'?`<div style="background:#faf5ff;padding:10px;border-radius:8px;margin-bottom:10px;font-size:0.9rem;"><span style="display:inline-block;padding:2px 8px;background:#8b5cf6;color:#fff;border-radius:4px;font-size:0.75rem;font-weight:600;">STOCK PURCHASE</span> <span style="color:#6d28d9;margin-left:8px;">IT department stock replenishment request</span></div>`:''}
            ${itAttachmentsHtml(t.attachments, 'User Attachments')}
            ${itQuotationsHtml(t.quotations, t.quotationUrl, t.quotationFileName)}
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-weight:600;font-size:0.85rem;">Estimated Cost <span style="color:#ef4444">*</span></label>
                    <input type="number" id="hrCost_${t.id}" class="form-control" placeholder="0.00" step="0.01" min="0">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-weight:600;font-size:0.85rem;">Currency</label>
                    <select id="hrCurrency_${t.id}" class="form-control">
                        <option value="USD">USD ($)</option>
                        <option value="INR">INR (₹)</option>
                        <option value="AUD">AUD (A$)</option>
                        <option value="GBP">GBP (£)</option>
                    </select>
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-weight:600;font-size:0.85rem;">Vendor</label>
                    <input type="text" id="hrVendor_${t.id}" class="form-control" placeholder="Vendor name">
                </div>
            </div>
            <div class="form-group" style="margin-bottom:16px;">
                <label style="font-weight:600;font-size:0.85rem;">HR Notes</label>
                <textarea id="hrNotes_${t.id}" class="form-control" rows="2" placeholder="Add cost justification or notes..."></textarea>
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button class="btn btn-primary" onclick="hrApproveITTicket('${t.id}')">💰 Add Cost & Send to COO</button>
            </div>
        </div>`).join('');

        // History of processed tickets
        const processedTickets = allTickets.filter(t => t.status !== 'pending_hr');
        const historyRows = processedTickets.slice(0,20).map(t => `
            <tr>
                <td><strong>${t.ticketNumber}</strong></td>
                <td>${t.item}${t.quantity>1?' (x'+t.quantity+')':''}</td>
                <td>${t.requestedByName}</td>
                <td>${t.estimatedCost?itFormatCost(t.estimatedCost,t.currency):'-'}</td>
                <td>${t.vendor||'-'}</td>
                <td><span style="padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;color:${itStatusColor(t.status)};background:${itStatusColor(t.status)}15;">${itStatusLabel(t.status)}</span></td>
            </tr>
        `).join('');

        mainContent.innerHTML = `
        <div style="max-width:1100px;margin:0 auto;">
            <div style="margin-bottom:24px;">
                <h2 style="margin:0;color:#1e293b;">💰 IT Procurement - Cost Review</h2>
                <p style="margin:4px 0 0;color:#64748b;">Review IT purchase requests, add cost details, and forward to COO for approval</p>
            </div>

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">
                <div style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);padding:20px;border-radius:12px;color:#fff;">
                    <div style="font-size:2rem;font-weight:700;">${pending.length}</div>
                    <div style="font-size:0.85rem;opacity:0.85;">Pending Your Review</div>
                </div>
                <div style="background:linear-gradient(135deg,#e67e22,#d35400);padding:20px;border-radius:12px;color:#fff;">
                    <div style="font-size:2rem;font-weight:700;">${allTickets.filter(t=>t.status==='pending_coo').length}</div>
                    <div style="font-size:0.85rem;opacity:0.85;">Pending COO Approval</div>
                </div>
                <div style="background:linear-gradient(135deg,#059669,#047857);padding:20px;border-radius:12px;color:#fff;">
                    <div style="font-size:2rem;font-weight:700;">${allTickets.filter(t=>t.status==='approved').length}</div>
                    <div style="font-size:0.85rem;opacity:0.85;">Approved for Purchase</div>
                </div>
            </div>

            ${pending.length > 0 ? `<h3 style="color:#1e3a8a;margin-bottom:16px;">📋 Pending Cost Review (${pending.length})</h3>${pendingCards}` : '<div class="card" style="padding:30px;text-align:center;margin-bottom:24px;"><p style="color:#10b981;font-weight:600;">✅ No pending procurement requests</p></div>'}

            ${processedTickets.length > 0 ? `
            <div class="card" style="padding:20px;margin-top:24px;">
                <h3 style="margin:0 0 14px;color:#1e3a8a;font-size:0.95rem;">📦 Procurement History</h3>
                <div style="overflow-x:auto;">
                    <table class="data-table">
                        <thead><tr><th>Ticket #</th><th>Item</th><th>Requester</th><th>Cost</th><th>Vendor</th><th>Status</th></tr></thead>
                        <tbody>${historyRows}</tbody>
                    </table>
                </div>
            </div>` : ''}
        </div>`;
    } catch(e) {
        console.error('Error loading HR IT procurement:', e);
        mainContent.innerHTML = '<div class="card" style="padding:40px;text-align:center;"><p style="color:#ef4444;">Error loading IT Procurement.</p></div>';
    }
}

async function hrApproveITTicket(ticketId) {
    const estimatedCost = document.getElementById('hrCost_' + ticketId)?.value;
    const currency = document.getElementById('hrCurrency_' + ticketId)?.value || 'USD';
    const vendor = document.getElementById('hrVendor_' + ticketId)?.value.trim() || '';
    const hrNotes = document.getElementById('hrNotes_' + ticketId)?.value.trim() || '';

    if (!estimatedCost || parseFloat(estimatedCost) <= 0) {
        return showMessage('Please enter a valid estimated cost.', 'error');
    }

    try {
        const resp = await apiCall(`it-tickets/hr-review/${ticketId}`, {
            method: 'PUT',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ estimatedCost, currency, vendor, hrNotes })
        });
        if (resp.success) {
            showMessage('Cost details added! Sent to COO for approval.', 'success');
            showHRITProcurement();
        } else { showMessage(resp.error || 'Failed', 'error'); }
    } catch(e) { showMessage('Error processing request', 'error'); }
}

// --- IT Department Report (For COO & Director) with Procurement Approval ---
async function showITDepartmentReport() {
    setActiveNav('nav-it-department');
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = '<div style="text-align:center;padding:60px;"><div class="loading-spinner"></div><p>Loading IT Department Report...</p></div>';

    try {
        const [dashResp, allResp] = await Promise.all([
            apiCall('it-tickets/dashboard'),
            apiCall('it-tickets/all')
        ]);

        const dash = dashResp.success ? dashResp.data : {};
        const sm = dash.summary || {};
        const monthly = dash.monthlyStats || [];
        const priority = dash.priority || {};
        const catStats = dash.categoryStats || {};
        const allTickets = allResp.success ? allResp.data || [] : [];

        const totalActive = (sm.openTickets||0) + (sm.inProgressTickets||0);
        const resolutionRate = sm.totalTickets > 0 ? Math.round((sm.closedTickets / sm.totalTickets) * 100) : 0;
        const isCOO = currentUserRole === 'coo';
        const isDir = currentUserRole === 'director';

        // Pending approval tickets for this role
        const pendingForMe = allTickets.filter(t =>
            (isCOO && t.status === 'pending_coo') ||
            (isDir && t.status === 'pending_director')
        );

        const maxM = Math.max(...monthly.map(m => Math.max(m.created, m.closed)), 1);
        const monthlyChart = monthly.map(m => `
            <div style="flex:1;text-align:center;min-width:70px;">
                <div style="display:flex;justify-content:center;gap:3px;align-items:flex-end;height:100px;margin-bottom:6px;">
                    <div style="width:18px;background:linear-gradient(180deg,#667eea,#764ba2);border-radius:3px 3px 0 0;height:${Math.max((m.created/maxM)*90,4)}px;"></div>
                    <div style="width:18px;background:linear-gradient(180deg,#10b981,#059669);border-radius:3px 3px 0 0;height:${Math.max((m.closed/maxM)*90,4)}px;"></div>
                </div>
                <div style="font-size:0.7rem;color:#64748b;font-weight:500;">${m.month}</div>
            </div>
        `).join('');

        const catList = Object.entries(catStats).map(([key, val]) => {
            const pct = sm.totalTickets > 0 ? Math.round((val.total / sm.totalTickets) * 100) : 0;
            return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
                <div style="width:40px;text-align:right;font-weight:700;color:#1e3a8a;">${pct}%</div>
                <div style="flex:1;"><div style="font-weight:500;color:#334155;">${val.label||key}</div>
                <div style="height:6px;background:#e2e8f0;border-radius:3px;margin-top:4px;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#667eea,#764ba2);border-radius:3px;"></div></div></div>
                <div style="font-size:0.85rem;color:#64748b;">${val.total}</div>
            </div>`;
        }).join('');

        // Pending approval cards
        const approvalCards = pendingForMe.map(t => {
            // currency handled by itFormatCost
            return `
            <div class="card" style="padding:20px;margin-bottom:16px;border-left:4px solid ${isCOO?'#e67e22':'#2980b9'};">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                    <div>
                        <strong style="color:#1e3a8a;font-size:1.05rem;">${t.ticketNumber}</strong>
                        <span style="padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;color:${itPriorityColor(t.priority)};background:${itPriorityColor(t.priority)}15;margin-left:8px;">${(t.priority||'').toUpperCase()}</span>
                    </div>
                    <span style="padding:4px 12px;border-radius:20px;font-size:0.75rem;font-weight:600;color:${itStatusColor(t.status)};background:${itStatusColor(t.status)}15;">${itStatusLabel(t.status)}</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;font-size:0.9rem;">
                    <div><span style="color:#64748b;">Requested By:</span><br><strong>${t.requestedByName}</strong></div>
                    <div><span style="color:#64748b;">Item:</span><br><strong>${t.item}</strong>${t.quantity>1?' (x'+t.quantity+')':''}</div>
                    <div><span style="color:#64748b;">Category:</span><br><strong>${t.categoryLabel||t.category}</strong></div>
                </div>
                <div style="background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:12px;font-size:0.9rem;">
                    <strong>Description:</strong> ${t.description}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;">
                    <div style="padding:12px;background:#fef3c7;border-radius:8px;text-align:center;">
                        <div style="font-size:0.75rem;color:#92400e;font-weight:600;">ESTIMATED COST</div>
                        <div style="font-size:1.3rem;font-weight:700;color:#d97706;">${t.estimatedCost?itFormatCost(t.estimatedCost,t.currency):'N/A'}</div>
                    </div>
                    <div style="padding:12px;background:#f0f9ff;border-radius:8px;text-align:center;">
                        <div style="font-size:0.75rem;color:#1e40af;font-weight:600;">VENDOR</div>
                        <div style="font-size:0.95rem;font-weight:600;color:#1e3a8a;">${t.vendor||'Not specified'}</div>
                    </div>
                    <div style="padding:12px;background:#f0fdf4;border-radius:8px;text-align:center;">
                        <div style="font-size:0.75rem;color:#065f46;font-weight:600;">HR REVIEWED BY</div>
                        <div style="font-size:0.95rem;font-weight:600;color:#059669;">${t.hrReviewedByName||'-'}</div>
                    </div>
                </div>
                ${t.ticketType==='stock_purchase'?`<div style="padding:8px 12px;background:#faf5ff;border-radius:6px;margin-bottom:8px;font-size:0.85rem;"><span style="display:inline-block;padding:2px 8px;background:#8b5cf6;color:#fff;border-radius:4px;font-size:0.75rem;font-weight:600;">STOCK PURCHASE</span> <span style="color:#6d28d9;margin-left:6px;">IT department stock replenishment</span></div>`:''}
                ${itAttachmentsHtml(t.attachments, 'User Attachments')}
                ${itQuotationsHtml(t.quotations, t.quotationUrl, t.quotationFileName)}
                ${t.itNotes?`<div style="padding:8px 12px;background:#fffbeb;border-radius:6px;margin-bottom:8px;font-size:0.85rem;"><strong style="color:#92400e;">IT Notes:</strong> ${t.itNotes}</div>`:''}
                ${t.hrNotes?`<div style="padding:8px 12px;background:#f5f3ff;border-radius:6px;margin-bottom:8px;font-size:0.85rem;"><strong style="color:#6d28d9;">HR Notes:</strong> ${t.hrNotes}</div>`:''}
                ${t.cooNotes?`<div style="padding:8px 12px;background:#fff7ed;border-radius:6px;margin-bottom:8px;font-size:0.85rem;"><strong style="color:#c2410c;">COO Notes:</strong> ${t.cooNotes}</div>`:''}
                <div class="form-group" style="margin:12px 0 16px;">
                    <label style="font-weight:600;font-size:0.85rem;">Your Comments</label>
                    <textarea id="approveNotes_${t.id}" class="form-control" rows="2" placeholder="Add comments (optional)..."></textarea>
                </div>
                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button class="btn btn-danger" onclick="approveITTicket('${t.id}','rejected')">❌ Reject</button>
                    <button class="btn btn-success" onclick="approveITTicket('${t.id}','approved')">✅ Approve</button>
                </div>
            </div>`;
        }).join('');

        // Recent procurement tickets for detail view
        const procurementTickets = allTickets.filter(t => t.availability === 'need_purchase').slice(0, 15);
        const procRows = procurementTickets.map(t => {
            return `<tr>
                <td><strong style="color:#1e3a8a;">${t.ticketNumber}</strong></td>
                <td>${t.item}${t.quantity>1?' (x'+t.quantity+')':''}</td>
                <td>${t.requestedByName}</td>
                <td style="font-weight:600;">${t.estimatedCost?itFormatCost(t.estimatedCost,t.currency):'-'}</td>
                <td>${t.vendor||'-'}</td>
                <td>${t.hrReviewedByName||'-'}</td>
                <td>${t.cooApprovedByName||'-'}</td>
                <td>${t.directorApprovedByName||'-'}</td>
                <td><span style="padding:3px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;color:${itStatusColor(t.status)};background:${itStatusColor(t.status)}15;">${itStatusLabel(t.status)}</span></td>
            </tr>`;
        }).join('');

        mainContent.innerHTML = `
        <div style="max-width:1200px;margin:0 auto;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
                <div>
                    <h2 style="margin:0;color:#1e293b;">📊 IT Department Report</h2>
                    <p style="margin:4px 0 0;color:#64748b;">Executive overview of IT support & procurement operations</p>
                </div>
                <div style="font-size:0.85rem;color:#94a3b8;">Generated: ${new Date().toLocaleString()}</div>
            </div>

            <!-- KPI Cards -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:24px;">
                <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:22px;border-radius:16px;color:#fff;">
                    <div style="font-size:0.8rem;opacity:0.8;">Total Tickets</div>
                    <div style="font-size:2.2rem;font-weight:700;">${sm.totalTickets||0}</div>
                </div>
                <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:22px;border-radius:16px;color:#fff;">
                    <div style="font-size:0.8rem;opacity:0.8;">Active</div>
                    <div style="font-size:2.2rem;font-weight:700;">${totalActive}</div>
                </div>
                <div style="background:linear-gradient(135deg,#10b981,#059669);padding:22px;border-radius:16px;color:#fff;">
                    <div style="font-size:0.8rem;opacity:0.8;">Resolution Rate</div>
                    <div style="font-size:2.2rem;font-weight:700;">${resolutionRate}%</div>
                </div>
                <div style="background:linear-gradient(135deg,#8b5cf6,#7c3aed);padding:22px;border-radius:16px;color:#fff;">
                    <div style="font-size:0.8rem;opacity:0.8;">Avg Resolution</div>
                    <div style="font-size:2.2rem;font-weight:700;">${sm.avgResolutionHours||0}h</div>
                </div>
                <div style="background:linear-gradient(135deg,#e67e22,#d35400);padding:22px;border-radius:16px;color:#fff;">
                    <div style="font-size:0.8rem;opacity:0.8;">Procurement Cost</div>
                    ${(()=>{
                        const byCur = sm.procurementByCurrency || {};
                        const keys = Object.keys(byCur);
                        if (keys.length === 0) return '<div style="font-size:2.2rem;font-weight:700;">-</div>';
                        if (keys.length === 1) return '<div style="font-size:2.2rem;font-weight:700;">' + itFormatCost(byCur[keys[0]].total, keys[0]) + '</div><div style="font-size:0.75rem;opacity:0.7;">' + byCur[keys[0]].count + ' items</div>';
                        return keys.map(k => '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;"><span style="font-size:1.1rem;font-weight:700;">' + itFormatCost(byCur[k].total, k) + '</span><span style="font-size:0.7rem;opacity:0.7;">' + byCur[k].count + ' items</span></div>').join('');
                    })()}
                </div>
            </div>

            <!-- Procurement Workflow Pipeline -->
            <div class="card" style="padding:20px;margin-bottom:24px;background:linear-gradient(135deg,#f8fafc,#f0f4f8);">
                <h3 style="margin:0 0 14px;color:#1e3a8a;font-size:1rem;">🔄 Procurement Pipeline</h3>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                    <div style="flex:1;min-width:120px;text-align:center;padding:14px;background:#fff;border-radius:10px;border:2px solid #f59e0b;">
                        <div style="font-size:1.6rem;font-weight:700;color:#f59e0b;">${sm.openTickets||0}</div>
                        <div style="font-size:0.75rem;color:#92400e;font-weight:600;">New Requests</div>
                    </div>
                    <div style="color:#94a3b8;font-size:1.2rem;">→</div>
                    <div style="flex:1;min-width:120px;text-align:center;padding:14px;background:#fff;border-radius:10px;border:2px solid #10b981;">
                        <div style="font-size:1.6rem;font-weight:700;color:#10b981;">${sm.availableInStore||0}</div>
                        <div style="font-size:0.75rem;color:#065f46;font-weight:600;">In Store</div>
                    </div>
                    <div style="color:#94a3b8;font-size:1.2rem;">→</div>
                    <div style="flex:1;min-width:120px;text-align:center;padding:14px;background:#fff;border-radius:10px;border:2px solid #8b5cf6;">
                        <div style="font-size:1.6rem;font-weight:700;color:#8b5cf6;">${sm.pendingHR||0}</div>
                        <div style="font-size:0.75rem;color:#6d28d9;font-weight:600;">HR Review</div>
                    </div>
                    <div style="color:#94a3b8;font-size:1.2rem;">→</div>
                    <div style="flex:1;min-width:120px;text-align:center;padding:14px;background:#fff;border-radius:10px;border:2px solid #e67e22;">
                        <div style="font-size:1.6rem;font-weight:700;color:#e67e22;">${sm.pendingCOO||0}</div>
                        <div style="font-size:0.75rem;color:#c2410c;font-weight:600;">COO Approval</div>
                    </div>
                    <div style="color:#94a3b8;font-size:1.2rem;">→</div>
                    <div style="flex:1;min-width:120px;text-align:center;padding:14px;background:#fff;border-radius:10px;border:2px solid #2980b9;">
                        <div style="font-size:1.6rem;font-weight:700;color:#2980b9;">${sm.pendingDirector||0}</div>
                        <div style="font-size:0.75rem;color:#1e40af;font-weight:600;">Director Approval</div>
                    </div>
                    <div style="color:#94a3b8;font-size:1.2rem;">→</div>
                    <div style="flex:1;min-width:120px;text-align:center;padding:14px;background:#fff;border-radius:10px;border:2px solid #059669;">
                        <div style="font-size:1.6rem;font-weight:700;color:#059669;">${sm.approvedTickets||0}</div>
                        <div style="font-size:0.75rem;color:#065f46;font-weight:600;">Approved</div>
                    </div>
                </div>
            </div>

            ${pendingForMe.length > 0 ? `
            <!-- Pending Approvals -->
            <div style="margin-bottom:24px;">
                <h3 style="color:#1e3a8a;margin-bottom:14px;">⏳ Pending Your Approval (${pendingForMe.length})</h3>
                ${approvalCards}
            </div>` : ''}

            <!-- Charts -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
                <div class="card" style="padding:20px;">
                    <h3 style="margin:0 0 14px;color:#1e3a8a;font-size:0.95rem;">Monthly Trend</h3>
                    <div style="display:flex;gap:6px;align-items:flex-end;">${monthlyChart}</div>
                    <div style="display:flex;gap:16px;justify-content:center;margin-top:10px;font-size:0.8rem;">
                        <span><span style="display:inline-block;width:12px;height:12px;background:linear-gradient(180deg,#667eea,#764ba2);border-radius:2px;margin-right:4px;"></span>Created</span>
                        <span><span style="display:inline-block;width:12px;height:12px;background:linear-gradient(180deg,#10b981,#059669);border-radius:2px;margin-right:4px;"></span>Closed</span>
                    </div>
                </div>
                <div class="card" style="padding:20px;">
                    <h3 style="margin:0 0 14px;color:#1e3a8a;font-size:0.95rem;">Active by Priority</h3>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        <div style="text-align:center;padding:14px;background:#fef2f2;border-radius:10px;"><div style="font-size:1.5rem;font-weight:700;color:#dc2626;">${priority.critical||0}</div><div style="font-size:0.75rem;color:#991b1b;font-weight:600;">CRITICAL</div></div>
                        <div style="text-align:center;padding:14px;background:#fff7ed;border-radius:10px;"><div style="font-size:1.5rem;font-weight:700;color:#ef4444;">${priority.high||0}</div><div style="font-size:0.75rem;color:#c2410c;font-weight:600;">HIGH</div></div>
                        <div style="text-align:center;padding:14px;background:#fffbeb;border-radius:10px;"><div style="font-size:1.5rem;font-weight:700;color:#f59e0b;">${priority.medium||0}</div><div style="font-size:0.75rem;color:#92400e;font-weight:600;">MEDIUM</div></div>
                        <div style="text-align:center;padding:14px;background:#f0fdf4;border-radius:10px;"><div style="font-size:1.5rem;font-weight:700;color:#10b981;">${priority.low||0}</div><div style="font-size:0.75rem;color:#065f46;font-weight:600;">LOW</div></div>
                    </div>
                </div>
            </div>

            <!-- Category Breakdown -->
            <div class="card" style="padding:20px;margin-bottom:24px;">
                <h3 style="margin:0 0 14px;color:#1e3a8a;font-size:0.95rem;">Tickets by Category</h3>
                ${catList||'<p style="color:#94a3b8;text-align:center;">No data</p>'}
            </div>

            <!-- Procurement Detail Table -->
            ${procurementTickets.length > 0 ? `
            <div class="card" style="padding:20px;">
                <h3 style="margin:0 0 14px;color:#1e3a8a;font-size:0.95rem;">📦 Procurement Requests Detail</h3>
                <div style="overflow-x:auto;">
                    <table class="data-table">
                        <thead><tr><th>Ticket #</th><th>Item</th><th>Requester</th><th>Cost</th><th>Vendor</th><th>HR</th><th>COO</th><th>Director</th><th>Status</th></tr></thead>
                        <tbody>${procRows}</tbody>
                    </table>
                </div>
            </div>` : ''}
        </div>`;
    } catch(e) {
        console.error('Error loading IT department report:', e);
        mainContent.innerHTML = '<div class="card" style="padding:40px;text-align:center;"><p style="color:#ef4444;">Error loading IT Department Report.</p></div>';
    }
}

// COO/Director approval action
async function approveITTicket(ticketId, decision) {
    const notes = document.getElementById('approveNotes_' + ticketId)?.value.trim() || '';
    const isCOO = currentUserRole === 'coo';
    const endpoint = isCOO ? `it-tickets/coo-approve/${ticketId}` : `it-tickets/director-approve/${ticketId}`;
    const notesKey = isCOO ? 'cooNotes' : 'directorNotes';

    if (decision === 'rejected' && !confirm('Are you sure you want to reject this request?')) return;

    try {
        const resp = await apiCall(endpoint, {
            method: 'PUT',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ decision, [notesKey]: notes })
        });
        if (resp.success) {
            showMessage(resp.message || `Request ${decision}!`, 'success');
            showITDepartmentReport();
        } else { showMessage(resp.error || 'Failed', 'error'); }
    } catch(e) { showMessage('Error processing approval', 'error'); }
}

console.log('✅ IT Portal Module loaded');

</script>

<!-- ============================================
     DESIGN FILE UPLOAD & APPROVAL MODALS
     ============================================ -->

<!-- Design File Upload Modal -->
<div id="designFileUploadModal" class="modal" style="display: none;">
    <div class="modal-content" style="max-width: 550px;">
        <div class="modal-header">
            <h3>📤 Upload Design File</h3>
            <button class="close-btn" onclick="closeDesignUploadModal()">&times;</button>
        </div>
        <div class="modal-body">
            <input type="hidden" id="designUploadProjectId">
            <input type="hidden" id="designUploadProjectName">
            
            <!-- Project Info Display -->
            <div class="client-preview-box" style="margin-bottom: 20px;">
                <div class="client-preview-label">Project</div>
                <div class="client-preview-value" id="designUploadProjectDisplay">-</div>
            </div>
            
            <!-- Upload Type Toggle -->
            <div class="form-group">
                <label>Upload Type <span style="color: red;">*</span></label>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <button type="button" id="uploadTypeFile" class="btn btn-primary" onclick="setUploadType('file')" style="flex: 1;">
                        📄 Upload PDF File
                    </button>
                    <button type="button" id="uploadTypeLink" class="btn btn-secondary" onclick="setUploadType('link')" style="flex: 1;">
                        🔗 Add External Link
                    </button>
                </div>
            </div>
            
            <!-- File Upload Zone (shown by default) -->
            <div id="fileUploadSection">
                <div class="form-group">
                    <label>Design File (PDF) <span style="color: red;">*</span></label>
                    <div class="upload-dropzone" id="designDropzone" onclick="document.getElementById('designFileInput').click()">
                        <div class="upload-icon">📄</div>
                        <div class="upload-text">Click to upload or drag and drop</div>
                        <div class="upload-hint">PDF files only (Max 50MB)</div>
                    </div>
                    <input type="file" id="designFileInput" accept=".pdf" style="display: none;" onchange="handleDesignFileSelect(this)">
                    <div id="selectedFileInfo" class="selected-file-info" style="display: none;">
                        <span class="selected-file-icon">📄</span>
                        <div class="selected-file-details">
                            <div class="selected-file-name" id="selectedFileName">-</div>
                            <div class="selected-file-size" id="selectedFileSize">-</div>
                        </div>
                        <button type="button" onclick="clearSelectedFile()" style="background: none; border: none; cursor: pointer; font-size: 1.2rem;">✕</button>
                    </div>
                </div>
            </div>
            
            <!-- Link Upload Section (hidden by default) -->
            <div id="linkUploadSection" style="display: none;">
                <div class="form-group">
                    <label>External Link <span style="color: red;">*</span></label>
                    <input type="url" id="designExternalLink" class="form-control" placeholder="https://drive.google.com/file/d/..." style="margin-bottom: 8px;">
                    <small style="color: #64748b;">Paste link from Google Drive, Dropbox, OneDrive, or any file sharing service</small>
                </div>
                <div class="form-group">
                    <label>Link Title/File Name <span style="color: red;">*</span></label>
                    <input type="text" id="designLinkTitle" class="form-control" placeholder="Project_Design_v1.pdf">
                    <small style="color: #64748b;">A descriptive name for the linked file</small>
                </div>
            </div>
            
            <!-- Notes -->
            <div class="form-group">
                <label>Notes (Optional)</label>
                <textarea id="designNotes" class="form-control" rows="2" placeholder="Any notes for the COO reviewer..."></textarea>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeDesignUploadModal()">Cancel</button>
            <button class="btn btn-primary" id="designUploadBtn" onclick="uploadDesignFile()">
                📤 Upload
            </button>
        </div>
    </div>
</div>


<!-- COO Design Approval Modal -->
<div id="designApprovalModal" class="modal" style="display: none;">
    <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
            <h3>📐 Review Design File</h3>
            <button class="close-btn" onclick="closeDesignApprovalModal()">&times;</button>
        </div>
        <div class="modal-body">
            <input type="hidden" id="approvalDesignFileId">
            <input type="hidden" id="approvalProjectId">
            
            <!-- File Details -->
            <div class="client-preview-box">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <div class="client-preview-label">Project</div>
                        <div class="client-preview-value" id="approvalProjectName">-</div>
                    </div>
                    <div>
                        <div class="client-preview-label">Client</div>
                        <div class="client-preview-value" id="approvalClientCompany">-</div>
                    </div>
                    <div>
                        <div class="client-preview-label">File Name</div>
                        <div class="client-preview-value" id="approvalFileName">-</div>
                    </div>
                    <div>
                        <div class="client-preview-label">Type</div>
                        <div class="client-preview-value" id="approvalFileType">-</div>
                    </div>
                    <div>
                        <div class="client-preview-label">Submitted By</div>
                        <div class="client-preview-value" id="approvalSubmittedBy">-</div>
                    </div>
                </div>
                <div style="margin-top: 15px; padding: 10px; background: #fef3c7; border-radius: 6px;">
                    <small style="color: #92400e;">ℹ️ Client delivery details will be entered by Document Controller when sending.</small>
                </div>
            </div>
            
            <!-- Preview Button -->
            <div style="text-align: center; margin: 20px 0;">
                <a id="approvalPreviewLink" href="#" target="_blank" class="btn btn-secondary">
                    👁️ Preview Design File
                </a>
            </div>
            
            <!-- Designer Notes -->
            <div id="approvalDesignerNotes" style="display: none;">
                <label style="font-weight: 600; color: #1e293b;">Designer Notes:</label>
                <p id="approvalDesignerNotesText" style="background: #f8fafc; padding: 12px; border-radius: 8px; color: #475569; margin-top: 8px;"></p>
            </div>
            
            <!-- Approval/Rejection Notes -->
            <div class="form-group" style="margin-top: 20px;">
                <label>Your Notes (Optional)</label>
                <textarea id="approvalNotes" class="form-control" rows="3" placeholder="Add any notes or feedback..."></textarea>
            </div>
            
            <!-- Rejection Reason (shown when rejecting) -->
            <div id="rejectionReasonSection" class="form-group" style="display: none;">
                <label>Rejection Reason <span style="color: red;">*</span></label>
                <textarea id="rejectionReason" class="form-control" rows="3" placeholder="Please explain why this design file cannot be approved..."></textarea>
            </div>
        </div>
        <div class="modal-footer" style="justify-content: space-between;">
            <button class="btn btn-danger" onclick="toggleRejectionMode()">
                ❌ Reject
            </button>
            <div>
                <button class="btn btn-secondary" onclick="closeDesignApprovalModal()">Cancel</button>
                <button class="btn btn-success" id="approveDesignBtn" onclick="approveDesignFile()">
                    ✅ Approve
                </button>
                <button class="btn btn-danger" id="confirmRejectBtn" onclick="rejectDesignFile()" style="display: none;">
                    ❌ Confirm Rejection
                </button>
            </div>
        </div>
    </div>
</div>


<!-- Send to Client Modal -->
<div id="sendToClientModal" class="modal" style="display: none;">
    <div class="modal-content" style="max-width: 550px;">
        <div class="modal-header">
            <h3>📧 Send Design to Client</h3>
            <button class="close-btn" onclick="closeSendToClientModal()">&times;</button>
        </div>
        <div class="modal-body">
            <input type="hidden" id="sendDesignFileId">
            <input type="hidden" id="sendProjectId">
            
            <!-- Success Banner -->
            <div style="background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); padding: 15px 20px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.5rem;">✅</span>
                    <div>
                        <strong style="color: #166534;">Design Approved!</strong>
                        <p style="margin: 5px 0 0 0; color: #15803d; font-size: 0.9rem;">Ready to send to the client</p>
                    </div>
                </div>
            </div>
            
            <!-- Send Details -->
            <div class="client-preview-box">
                <div style="display: grid; gap: 12px;">
                    <div>
                        <div class="client-preview-label">Project</div>
                        <div class="client-preview-value" id="sendProjectName">-</div>
                    </div>
                    <div>
                        <div class="client-preview-label">File</div>
                        <div class="client-preview-value" id="sendFileName">-</div>
                    </div>
                    <div>
                        <div class="client-preview-label">Sending To</div>
                        <div class="client-preview-value" id="sendClientEmail" style="color: #2563eb; font-size: 1.1rem;">-</div>
                        <div id="sendClientName" style="color: #64748b; font-size: 0.9rem; margin-top: 3px;"></div>
                    </div>
                </div>
            </div>
            
            <!-- Custom Message -->
            <div class="form-group" style="margin-top: 20px;">
                <label>Custom Message (Optional)</label>
                <textarea id="sendCustomMessage" class="custom-message-input" placeholder="Add a personalized message to include in the email to the client..."></textarea>
                <small style="color: #64748b;">This will appear in the email body sent to the client</small>
            </div>
            
            <!-- Warning -->
            <div style="background: #fef3c7; padding: 12px 15px; border-radius: 8px; margin-top: 15px;">
                <p style="margin: 0; color: #92400e; font-size: 0.9rem;">
                    ⚠️ <strong>Note:</strong> Once sent, the client will receive a professional email with a download link to the design file.
                </p>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeSendToClientModal()">Cancel</button>
            <button class="btn btn-primary" onclick="sendDesignToClient()">
                📧 Send to Client
            </button>
        </div>
    </div>
</div>

<!-- Safety script to force show Design Approval menu for COO/Director -->
<script>
// Run after page is fully loaded
window.addEventListener('load', function() {
    setTimeout(function() {
        // Check if user is logged in and is COO/Director
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.email) {
            const email = currentUser.email.toLowerCase();
            const COO_EMAILS = ['coo@edanbrook.com', 'coo2@edanbrook.com'];
            const DIRECTOR_EMAILS = ['director@edanbrook.com', 'ajit@edanbrook.com'];
            
            if (COO_EMAILS.includes(email) || DIRECTOR_EMAILS.includes(email)) {
                const navItem = document.getElementById('designApprovalNavItem');
                if (navItem) {
                    navItem.style.display = 'block';
                    navItem.style.visibility = 'visible';
                    console.log('📐 SAFETY SCRIPT: Design Approval Nav forced visible for', email);
                }
            }
        }
    }, 2000); // Wait 2 seconds for login to complete
});

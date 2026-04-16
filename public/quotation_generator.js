/**
 * quotation_generator.js
 * UPDATED VERSION - Proper BDM Name, Client Name, and Project Number Handling
 * Maps BDM Proposal data to Word template placeholders
 */

// Helper: Load file from server
function loadFileFromServer(url, callback) {
    PizZipUtils.getBinaryContent(url, function (error, content) {
        if (error) {
            callback(error, null);
        } else {
            callback(null, content);
        }
    });
}

async function generateWordQuote(proposalId) {
    console.log("📄 Generating Quote for ID:", proposalId);

    try {
        if (typeof showLoading === 'function') showLoading();

        // 1. Fetch Proposal Data from backend
        const response = await apiCall(`proposals?id=${proposalId}`);
        if (!response.success || !response.data) {
            alert("Failed to fetch proposal data.");
            if (typeof hideLoading === 'function') hideLoading();
            return;
        }
        const p = response.data;

        console.log("📋 Proposal Data:", p);

        // 2. Get selected services from estimation
        const selectedServices = p.estimation?.services || [];

        // 3. Prepare Data (Mapping Database Fields -> Word Template Tags)
        // Create services list as comma-separated string
        const servicesList = selectedServices.join(', ') || 'Steel Detailing';
        
        // Calculate lead time from Timeline field (from BDM proposal)
        // Timeline is stored as number of weeks
        const timelineValue = p.timeline || '';
        let leadTime = '';
        if (timelineValue) {
            const num = parseInt(timelineValue);
            if (!isNaN(num)) {
                leadTime = num === 1 ? '1 week' : `${num} weeks`;
            } else {
                leadTime = timelineValue; // Use as-is if not a number
            }
        }
        
        const quoteData = {
            // --- HEADER INFO (Cover Page) ---
            // Project Number from COO Pricing (can be added/edited in COO portal)
            quote_no: p.pricing?.projectNumber || 'DRAFT',
            project_name: p.projectName || 'Project Name',
            
            // --- CLIENT INFO ---
            // UPDATED: Client name should be the company name entered by BDM
            // Using clientCompany as primary field (this is what BDM enters)
            client_name: p.clientCompany || p.clientContact || 'Client',
            client_company: p.clientCompany || 'Client Company',
            
            // --- DATE ---
            date: formatDateForQuote(new Date()),
            
            // --- SERVICES LIST ---
            services_list: servicesList,
            
            // --- PRICING SECTION ---
            // Item price (for individual service row) - same as total for single service
            item_price: p.pricing?.quoteValue || '0',
            // Total price from COO pricing - quoteValue field
            price_value: p.pricing?.quoteValue || '0',
            // Hourly rate for variation rates
            hourly_rate: p.pricing?.hourlyRate || '20',
            
            // --- LEAD TIME ---
            // From BDM proposal Timeline field
            lead_time: leadTime,
            
            // --- SIGNATORY INFO (Bottom of Cover Page under "Sincerely") ---
            // CRITICAL: BDM name should be the PORTAL USER NAME who created the proposal
            // createdByName contains the actual user's name from the portal
            bdm_name: p.createdByName || 'Sales Team',
            bdm_role: getBDMRole(p),
            company_name: 'Edanbrook Consultancy Services INC'
        };

        console.log("📝 Quote Data Prepared:", quoteData);
        console.log("✅ BDM Name (Portal User):", quoteData.bdm_name);
        console.log("✅ Client Name:", quoteData.client_name);
        console.log("✅ Project Number:", quoteData.quote_no);

        // 4. Load Template and Render
        loadFileFromServer("./proposal_template.docx", function(error, content) {
            if (error) {
                console.warn("⚠️ Template not found on server. Asking user for file...");
                
                // Fallback: Ask user to upload the file
                const fileInput = document.getElementById('wordTemplateInput');
                if (!fileInput) {
                    alert("Template not found and no file input available. Please ensure 'proposal_template.docx' is in the project root."); 
                    if (typeof hideLoading === 'function') hideLoading();
                    return;
                }
                
                if (confirm("Server template missing. Click OK to select your 'proposal_template.docx' manually.")) {
                    fileInput.click();
                    fileInput.onchange = function(e) {
                        const file = e.target.files[0];
                        if (!file) {
                            if (typeof hideLoading === 'function') hideLoading();
                            return;
                        }
                        const reader = new FileReader();
                        reader.onload = function(evt) { 
                            renderDoc(evt.target.result, quoteData); 
                        };
                        reader.onerror = function() {
                            alert("Error reading template file.");
                            if (typeof hideLoading === 'function') hideLoading();
                        };
                        reader.readAsBinaryString(file);
                    };
                } else {
                    if (typeof hideLoading === 'function') hideLoading();
                }
                return;
            }
            // If found on server, render immediately
            renderDoc(content, quoteData);
        });

    } catch (err) {
        console.error("❌ Error:", err);
        alert("Error generating quote: " + err.message);
        if (typeof hideLoading === 'function') hideLoading();
    }
}

// Helper function to format date as DD.MM.YYYY (for quote documents only)
function formatDateForQuote(date) {
    if (!date) return '';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
    } catch (e) {
        return '';
    }
}

// Helper function to get BDM role
// Priority: Check if the creator has a role stored, otherwise default
function getBDMRole(proposal) {
    // If proposal has createdByRole, use it
    if (proposal.createdByRole) {
        const role = proposal.createdByRole.toLowerCase();
        if (role === 'bdm') return 'Business Development Manager';
        if (role === 'coo') return 'Chief Operating Officer';
        if (role === 'director') return 'Director';
        return proposal.createdByRole;
    }
    // Default role for BDM
    return 'Business Development Manager';
}

// Internal function to do the actual DocxTemplater rendering
function renderDoc(content, data) {
    try {
        console.log("📄 Rendering document with data:", data);
        
        const zip = new PizZip(content);
        const doc = new window.docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: { start: '{', end: '}' }
        });

        // Set the data
        doc.setData(data);
        
        // Render the document
        doc.render();

        // Generate output
        const out = doc.getZip().generate({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        // Save file with dynamic name
        const safeProjName = (data.project_name || 'Project').replace(/[^a-z0-9]/gi, '_');
        const safeQuoteNo = (data.quote_no || 'DRAFT').replace(/[^a-z0-9]/gi, '_');
        const fileName = `Quote_${safeQuoteNo}_${safeProjName}.docx`;
        
        saveAs(out, fileName);
        
        console.log("✅ Document generated:", fileName);
        console.log("✅ BDM Name in document:", data.bdm_name);
        console.log("✅ Client Name in document:", data.client_name);
        console.log("✅ Project Number in document:", data.quote_no);
        
    } catch (error) {
        handleDocErrors(error);
    } finally {
        if (typeof hideLoading === 'function') hideLoading();
    }
}

function handleDocErrors(error) {
    console.error("❌ Document Error:", error);
    
    if (error.properties && error.properties.errors) {
        const errorMessages = error.properties.errors.map(function (err) {
            return `Tag: ${err.properties.tag || 'unknown'} - ${err.properties.explanation || err.message}`;
        }).join("\n");
        console.log("Template Errors:", errorMessages);
        alert("Template Error: The tags in your Word doc don't match the data.\n\n" + errorMessages + 
              "\n\nPlease ensure your template uses the correct placeholder tags.");
    } else {
        console.log("General Error:", error);
        alert("Error generating document: " + error.message);
    }
}

// Attach to window for global access
window.generateWordQuote = generateWordQuote;

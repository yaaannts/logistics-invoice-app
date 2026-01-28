const app = {
    currentInvoiceId: null,
    currencyFormatter: new Intl.NumberFormat('en-MV', { style: 'currency', currency: 'MVR' }),

    init: function() {
        // Set Default Dates
        document.getElementById('invDate').valueAsDate = new Date();
        const due = new Date();
        due.setDate(due.getDate() + 30);
        document.getElementById('invDue').valueAsDate = due;

        // 1. Get Auto-Generated Invoice Number
        this.getNextInvoiceNumber();

        // 2. Add Default Row
        this.addRow('20ft Standard Container (Dry)', 5, 25000.00);
        this.calculateTotals();
    },

    // NEW: Fetch the next sequential number from the server
    getNextInvoiceNumber: async function() {
        const invNumInput = document.getElementById('invNum');
        invNumInput.value = 'Loading...'; // Visual feedback
        
        try {
            const res = await fetch('/api/invoice/next-number');
            const nextNum = await res.text();
            invNumInput.value = nextNum;
        } catch (err) {
            invNumInput.value = 'Error';
            console.error('Failed to get invoice number', err);
        }
    },

    // ... (toggleSidebar, fetchInvoices, calculateTotals remain the same) ...

    resetInvoice: function() {
        if(confirm('Clear all data and generate new Invoice Number?')) {
            this.currentInvoiceId = null;
            document.getElementById('invoiceSidebar').classList.remove('active');
            const tbody = document.getElementById('itemsBody');
            tbody.innerHTML = '';
            this.addRow();
            document.getElementById('cName').value = '';
            document.getElementById('cAddr').value = '';
            document.getElementById('billTo').value = '';
            document.getElementById('deliverTo').value = '';
            document.getElementById('notes').value = '';
            document.getElementById('bankDetails').value = 'Bank of Maldives\nAcct: 9876543210\nSWIFT: BMDVMV MV';
            document.getElementById('discountVal').value = 0;
            document.getElementById('saveBtn').innerText = "💾 Save Invoice";
            
            // REFRESH THE AUTO-NUMBER
            this.getNextInvoiceNumber();
            
            this.calculateTotals();
            this.showStatus('Ready for new invoice');
        }
    },

    // ... (saveInvoice, loadInvoice, deleteInvoice, etc. remain mostly the same) ...
    // Just ensure you don't try to validate the invoice number manually since it's read-only
    
    loadInvoice: async function(id) {
        // ... (existing logic) ...
        // NOTE: When loading an old invoice, the input field will just show that old number.
        // It will NOT refresh to a new number until you click "Clear / New".
    },
    
    // ... (rest of the file) ...
    
     showStatus: function(msg, isError = false) {
        const el = document.getElementById('statusMessage');
        el.style.display = 'block';
        el.textContent = msg;
        el.style.color = isError ? '#ef4444' : '#10b981';
        setTimeout(() => el.style.display = 'none', 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

const app = {
    currentInvoiceId: null, // Track if editing existing invoice
    
    currencyFormatter: new Intl.NumberFormat('en-MV', { style: 'currency', currency: 'MVR' }),

    init: function() {
        // Set Default Dates
        document.getElementById('invDate').valueAsDate = new Date();
        const due = new Date();
        due.setDate(due.getDate() + 30);
        document.getElementById('invDue').valueAsDate = due;

        // Add Default Row
        this.addRow('20ft Standard Container (Dry)', 5, 25000.00);
        this.calculateTotals();
    },

    toggleSidebar: function() {
        const sidebar = document.getElementById('invoiceSidebar');
        sidebar.classList.toggle('active');
        if(sidebar.classList.contains('active')) {
            this.fetchInvoices();
        }
    },

    // --- API Interactions ---

    fetchInvoices: async function() {
        try {
            const res = await fetch('/api/invoices');
            const invoices = await res.json();
            const list = document.getElementById('invoiceList');
            list.innerHTML = '';

            if(invoices.length === 0) {
                list.innerHTML = '<p style="text-align:center; color:#888;">No saved invoices yet.</p>';
                return;
            }

            invoices.forEach(inv => {
                const div = document.createElement('div');
                div.className = 'invoice-item';
                div.innerHTML = `
                    <div>
                        <div class="inv-no">#${inv.invoiceNumber}</div>
                        <div class="inv-date">${inv.date}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:0.85rem;">${this.currencyFormatter.format(inv.total)}</div>
                        <button class="btn-delete" onclick="event.stopPropagation(); app.deleteInvoice(${inv.id});" title="Delete">&times;</button>
                    </div>
                `;
                div.onclick = () => this.loadInvoice(inv.id);
                list.appendChild(div);
            });
        } catch (err) {
            this.showStatus('Error loading invoices', true);
        }
    },

    saveInvoice: async function() {
        const data = this.collectFormData();
        
        // Generate Invoice Number if missing based on default value
        if(!data.invoiceNumber) {
            this.showStatus('Please enter an Invoice Number');
            return;
        }

        const btn = document.getElementById('saveBtn');
        const originalText = btn.innerText;
        btn.innerText = 'Saving...';
        btn.disabled = true;

        try {
            const method = this.currentInvoiceId ? 'PUT' : 'POST';
            const url = this.currentInvoiceId ? `/api/invoices/${this.currentInvoiceId}` : '/api/invoices';
            
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();
            
            if(res.ok) {
                this.currentInvoiceId = result.id; // Set ID if new
                this.showStatus('Invoice Saved Successfully!');
                this.fetchInvoices(); // Refresh sidebar
            } else {
                this.showStatus(result.error || 'Error saving invoice', true);
            }
        } catch (err) {
            this.showStatus('Network Error', true);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    },

    loadInvoice: async function(id) {
        try {
            const res = await fetch(`/api/invoices/${id}`);
            const data = await res.json();
            
            this.currentInvoiceId = data.id;
            
            // Populate Fields
            document.getElementById('invNum').value = data.invoiceNumber;
            document.getElementById('invDate').value = data.date;
            document.getElementById('invDue').value = data.dueDate;
            document.getElementById('cName').value = data.companyName;
            document.getElementById('cAddr').value = data.companyAddress;
            document.getElementById('billTo').value = data.billTo;
            document.getElementById('deliverTo').value = data.deliverTo;
            document.getElementById('notes').value = data.notes;
            document.getElementById('bankDetails').value = data.bankDetails;
            document.getElementById('discountVal').value = data.discount;

            // Rebuild Rows
            const tbody = document.getElementById('itemsBody');
            tbody.innerHTML = '';
            data.items.forEach(item => {
                this.addRow(item.type, item.qty, item.rate);
            });

            this.calculateTotals();
            this.toggleSidebar(); // Close sidebar
            this.showStatus(`Loaded Invoice #${data.invoiceNumber}`);
            
            // Update Save button text
            document.getElementById('saveBtn').innerText = "💾 Update Invoice";
            
        } catch (err) {
            this.showStatus('Error loading invoice', true);
        }
    },

    deleteInvoice: async function(id) {
        if(!confirm('Are you sure you want to delete this invoice?')) return;

        try {
            await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
            this.fetchInvoices();
            if(this.currentInvoiceId === id) {
                this.resetInvoice();
            }
        } catch (err) {
            this.showStatus('Error deleting invoice', true);
        }
    },

    // --- Helper Methods ---

    collectFormData: function() {
        // Gather all inputs
        const items = [];
        document.querySelectorAll('#itemsBody tr').forEach(tr => {
            items.push({
                type: tr.querySelector('.item-type').value,
                qty: parseFloat(tr.querySelector('.item-qty').value) || 0,
                rate: parseFloat(tr.querySelector('.item-rate').value) || 0
            });
        });

        const subtotal = parseFloat(this.getRawSubtotal()) || 0;
        const discount = parseFloat(document.getElementById('discountVal').value) || 0;

        return {
            invoiceNumber: document.getElementById('invNum').value,
            date: document.getElementById('invDate').value,
            dueDate: document.getElementById('invDue').value,
            companyName: document.getElementById('cName').value,
            companyAddress: document.getElementById('cAddr').value,
            billTo: document.getElementById('billTo').value,
            deliverTo: document.getElementById('deliverTo').value,
            notes: document.getElementById('notes').value,
            bankDetails: document.getElementById('bankDetails').value,
            discount: discount,
            subtotal: subtotal,
            total: subtotal - discount,
            items: items
        };
    },

    addRow: function(type = '', qty = 1, rate = 0) {
        const tbody = document.getElementById('itemsBody');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" class="input-bare item-type" value="${type}" placeholder="e.g. 20ft Standard"></td>
            <td><input type="number" class="input-bare input-center item-qty" value="${qty}" min="1" oninput="app.calculateRowTotal(this)"></td>
            <td><input type="number" class="input-bare input-right item-rate" value="${rate}" min="0" step="0.01" oninput="app.calculateRowTotal(this)"></td>
            <td class="col-total"><span class="row-total">${this.currencyFormatter.format(qty * rate)}</span></td>
            <td class="col-action"><button class="btn-remove" onclick="app.removeRow(this)" title="Remove Item">&times;</button></td>
        `;
        tbody.appendChild(tr);
    },

    removeRow: function(btn) {
        const row = btn.closest('tr');
        if (document.querySelectorAll('#itemsBody tr').length > 1) {
            row.remove();
            this.calculateTotals();
        } else {
            row.querySelector('.item-type').value = '';
            row.querySelector('.item-qty').value = 1;
            row.querySelector('.item-rate').value = 0;
            this.calculateRowTotal(row.querySelector('.item-qty'));
        }
    },

    calculateRowTotal: function(input) {
        const row = input.closest('tr');
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
        const total = qty * rate;
        row.querySelector('.row-total').textContent = this.currencyFormatter.format(total);
        this.calculateTotals();
    },

    calculateTotals: function() {
        const rows = document.querySelectorAll('#itemsBody tr');
        let subtotal = 0;
        rows.forEach(row => {
            const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
            const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
            subtotal += (qty * rate);
        });

        const discountVal = parseFloat(document.getElementById('discountVal').value) || 0;
        const grandTotal = subtotal - discountVal;

        document.getElementById('subtotalDisplay').textContent = this.currencyFormatter.format(subtotal);
        document.getElementById('discountDisplay').textContent = `-${this.currencyFormatter.format(discountVal)}`;
        document.getElementById('grandTotalDisplay').textContent = this.currencyFormatter.format(Math.max(0, grandTotal));
    },

    getRawSubtotal: function() {
        const subtotalText = document.getElementById('subtotalDisplay').textContent.replace(/[^0-9.-]+/g,"");
        return parseFloat(subtotalText);
    },

    resetInvoice: function() {
        if(confirm('Clear all data?')) {
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
            this.calculateTotals();
            this.showStatus('Ready for new invoice');
        }
    },

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

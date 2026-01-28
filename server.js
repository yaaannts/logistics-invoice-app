const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve frontend from public folder

// Initialize SQLite Database
const db = new Database('./invoices.db');
db.pragma('journal_mode = WAL'); // Improved performance

// Create Table if not exists
db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoiceNumber TEXT UNIQUE NOT NULL,
        date TEXT,
        dueDate TEXT,
        companyName TEXT,
        companyAddress TEXT,
        billTo TEXT,
        deliverTo TEXT,
        notes TEXT,
        bankDetails TEXT,
        discount REAL DEFAULT 0,
        subtotal REAL DEFAULT 0,
        total REAL DEFAULT 0,
        items JSON, 
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

// --- API ROUTES ---

// 1. Create Invoice
app.post('/api/invoices', (req, res) => {
    const { invoiceNumber, date, dueDate, companyName, companyAddress, billTo, deliverTo, notes, bankDetails, discount, subtotal, total, items } = req.body;

    try {
        const stmt = db.prepare(`
            INSERT INTO invoices (
                invoiceNumber, date, dueDate, companyName, companyAddress, 
                billTo, deliverTo, notes, bankDetails, discount, subtotal, total, items
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(
            invoiceNumber, date, dueDate, companyName, companyAddress, 
            billTo, deliverTo, notes, bankDetails, discount, subtotal, total, 
            JSON.stringify(items)
        );
        res.status(201).json({ id: info.lastInsertRowid, message: 'Invoice saved successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(400).json({ error: 'Error saving invoice. Invoice number might already exist.' });
    }
});

// 2. Get List of All Invoices
app.get('/api/invoices', (req, res) => {
    const invoices = db.prepare('SELECT id, invoiceNumber, date, total FROM invoices ORDER BY date DESC').all();
    res.json(invoices);
});

// 3. Get Single Invoice by ID
app.get('/api/invoices/:id', (req, res) => {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (invoice) {
        // Parse items back to object
        invoice.items = JSON.parse(invoice.items);
        res.json(invoice);
    } else {
        res.status(404).json({ error: 'Invoice not found' });
    }
});

// 4. Update Invoice
app.put('/api/invoices/:id', (req, res) => {
    const { invoiceNumber, date, dueDate, companyName, companyAddress, billTo, deliverTo, notes, bankDetails, discount, subtotal, total, items } = req.body;
    
    try {
        const stmt = db.prepare(`
            UPDATE invoices 
            SET invoiceNumber=?, date=?, dueDate=?, companyName=?, companyAddress=?, 
                billTo=?, deliverTo=?, notes=?, bankDetails=?, discount=?, subtotal=?, total=?, items=?
            WHERE id=?
        `);
        stmt.run(
            invoiceNumber, date, dueDate, companyName, companyAddress, 
            billTo, deliverTo, notes, bankDetails, discount, subtotal, total, 
            JSON.stringify(items), req.params.id
        );
        res.json({ message: 'Invoice updated successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(400).json({ error: 'Error updating invoice.' });
    }
});

// 5. Delete Invoice
app.delete('/api/invoices/:id', (req, res) => {
    db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    res.json({ message: 'Invoice deleted' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

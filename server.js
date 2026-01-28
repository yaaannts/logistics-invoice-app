const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- FOLDER SETUP ---
const archiveDir = path.join(__dirname, 'archive');
if (!fs.existsSync(archiveDir)){
    fs.mkdirSync(archiveDir);
}

// --- DATABASE SETUP ---
const db = new Database('./invoices.db');
db.pragma('journal_mode = WAL');

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

// --- HELPERS ---

// Function to save invoice to a physical file in /archive folder
const saveToFile = (invoiceNumber, data) => {
    const fileName = `${invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    const filePath = path.join(archiveDir, fileName);
    fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
        if (err) console.error(`Error archiving file ${fileName}:`, err);
        else console.log(`Archived: ${fileName}`);
    });
};

// --- API ROUTES ---

// 1. GET Next Auto-Generated Invoice Number
app.get('/api/invoice/next-number', (req, res) => {
    const currentYear = new Date().getFullYear();
    
    // Find the last invoice for the current year
    const row = db.prepare(`
        SELECT invoiceNumber FROM invoices 
        WHERE invoiceNumber LIKE ?
        ORDER BY invoiceNumber DESC LIMIT 1
    `).get(`INV-${currentYear}-%`);

    let nextNum = 1;
    if (row) {
        // Extract the number part (e.g., INV-2026-005 -> 5)
        const parts = row.invoiceNumber.split('-');
        const lastSeq = parseInt(parts[2], 10);
        nextNum = lastSeq + 1;
    }

    // Format with leading zeros (e.g., 1 -> 001)
    const paddedNum = String(nextNum).padStart(4, '0');
    res.json(`INV-${currentYear}-${paddedNum}`);
});

// 2. Create Invoice
app.post('/api/invoices', (req, res) => {
    const { invoiceNumber, date, dueDate, companyName, companyAddress, billTo, deliverTo, notes, bankDetails, discount, subtotal, total, items } = req.body;

    try {
        const stmt = db.prepare(`
            INSERT INTO invoices (invoiceNumber, date, dueDate, companyName, companyAddress, billTo, deliverTo, notes, bankDetails, discount, subtotal, total, items) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const info = stmt.run(invoiceNumber, date, dueDate, companyName, companyAddress, billTo, deliverTo, notes, bankDetails, discount, subtotal, total, JSON.stringify(items));
        
        // Auto-save to folder
        saveToFile(invoiceNumber, { ...req.body, id: info.lastInsertRowid });

        res.status(201).json({ id: info.lastInsertRowid, message: 'Invoice saved & archived' });
    } catch (err) {
        console.error(err.message);
        res.status(400).json({ error: 'Error saving invoice.' });
    }
});

// 3. Get List of Invoices
app.get('/api/invoices', (req, res) => {
    const invoices = db.prepare('SELECT id, invoiceNumber, date, total FROM invoices ORDER BY date DESC').all();
    res.json(invoices);
});

// 4. Get Single Invoice
app.get('/api/invoices/:id', (req, res) => {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    if (invoice) {
        invoice.items = JSON.parse(invoice.items);
        res.json(invoice);
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

// 5. Update Invoice
app.put('/api/invoices/:id', (req, res) => {
    const { invoiceNumber, date, dueDate, companyName, companyAddress, billTo, deliverTo, notes, bankDetails, discount, subtotal, total, items } = req.body;
    
    try {
        const stmt = db.prepare(`
            UPDATE invoices SET 
                invoiceNumber=?, date=?, dueDate=?, companyName=?, companyAddress=?, billTo=?, deliverTo=?, notes=?, bankDetails=?, discount=?, subtotal=?, total=?, items=?
            WHERE id=?
        `);
        
        stmt.run(invoiceNumber, date, dueDate, companyName, companyAddress, billTo, deliverTo, notes, bankDetails, discount, subtotal, total, JSON.stringify(items), req.params.id);
        
        // Auto-save update to folder (overwrite old file)
        saveToFile(invoiceNumber, { ...req.body, id: req.params.id });

        res.json({ message: 'Invoice updated & archived' });
    } catch (err) {
        res.status(400).json({ error: 'Error updating' });
    }
});

// 6. Delete Invoice
app.delete('/api/invoices/:id', (req, res) => {
    const invoice = db.prepare('SELECT invoiceNumber FROM invoices WHERE id = ?').get(req.params.id);
    if(invoice) {
        // Optional: Delete the archive file as well
        const fileName = `${invoice.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        const filePath = path.join(archiveDir, fileName);
        if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    
    db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    res.json({ message: 'Invoice deleted' });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Archive folder active at: ${archiveDir}`);
});

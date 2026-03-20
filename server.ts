import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import path from "path";
import { db, authenticateServer } from "./serverFirebase";
import { collection, getDocs, setDoc, doc, writeBatch, query, orderBy } from "firebase/firestore";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large payloads for master data sync

// API Key Middleware
const WMS_API_KEY = process.env.WMS_API_KEY || "default_wms_key_123";

const verifyApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== WMS_API_KEY) {
        return res.status(401).json({ error: "Unauthorized: Invalid API Key" });
    }
    next();
};

// --- WMS INTEGRATION API ROUTES ---

// 1. Get all master data (WMS pulls from App)
app.get("/api/wms/items", verifyApiKey, async (req, res) => {
    try {
        const snapshot = await getDocs(collection(db, "master_data"));
        const items = snapshot.docs.map(doc => doc.data());
        res.json({ success: true, count: items.length, data: items });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Sync master data (WMS pushes to App)
app.post("/api/wms/items/sync", verifyApiKey, async (req, res) => {
    try {
        const items = req.body.items; // Array of MasterItem
        if (!Array.isArray(items)) {
            return res.status(400).json({ success: false, error: "Expected 'items' array in body" });
        }

        const batchSize = 100;
        let processed = 0;
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = items.slice(i, i + batchSize);
            chunk.forEach(item => {
                if (item.sku) {
                    batch.set(doc(db, "master_data", item.sku), item, { merge: true });
                }
            });
            await batch.commit();
            processed += chunk.length;
        }

        res.json({ success: true, message: `Synced ${processed} items successfully.` });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Update stock movement (WMS pushes real-time stock changes)
app.post("/api/wms/movement", verifyApiKey, async (req, res) => {
    try {
        const { sku, newStockLevel } = req.body;
        if (!sku || typeof newStockLevel !== 'number') {
            return res.status(400).json({ success: false, error: "Missing sku or newStockLevel" });
        }

        await setDoc(doc(db, "master_data", sku), { systemStock: newStockLevel }, { merge: true });
        res.json({ success: true, message: `Stock for ${sku} updated to ${newStockLevel}` });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. Get Audit Results (WMS pulls variance reports)
app.get("/api/wms/audit-results", verifyApiKey, async (req, res) => {
    try {
        const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);
        const logs = snapshot.docs.map(doc => doc.data());
        res.json({ success: true, count: logs.length, data: logs });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- VITE MIDDLEWARE ---
async function startServer() {
    await authenticateServer();

    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
            res.sendFile(path.join(distPath, "index.html"));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();

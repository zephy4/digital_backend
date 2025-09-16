const admin = require("firebase-admin");

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!admin.apps.length) {
    if (!serviceAccountJson) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY env var is not set");
    }
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Only POST requests allowed" });
    }

    try {
        const { topic, token, title, body, data } = req.body || {};

        if ((!topic && !token) || !title || !body) {
            return res.status(400).json({
                error: "Provide either topic or token, and title + body",
            });
        }

        const message = {
            notification: { title: String(title), body: String(body) },
            data: data || {},
            ...(topic ? { topic: String(topic) } : { token: String(token) }),
        };

        const response = await admin.messaging().send(message);
        return res.status(200).json({ success: true, response });
    } catch (error) {
        console.error("Error sending FCM:", error);
        return res.status(500).json({ error: error.message });
    }
}


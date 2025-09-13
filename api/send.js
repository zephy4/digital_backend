// api/send.js
import { initializeApp, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

// Parse Firebase service account JSON from env
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// Prevent re-initialization on hot reload
if (!global._firebaseApp) {
    global._firebaseApp = initializeApp({
        credential: cert(serviceAccount),
    });
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Only POST requests allowed" });
    }

    try {
        const { topic, token, title, body } = req.body;

        if ((!topic && !token) || !title || !body) {
            return res.status(400).json({
                error: "Provide either topic or token, and title + body",
            });
        }

        const message = {
            notification: { title, body },
            ...(topic ? { topic } : { token }),
        };

        const response = await getMessaging().send(message);
        res.status(200).json({ success: true, response });
    } catch (error) {
        console.error("Error sending FCM:", error);
        res.status(500).json({ error: error.message });
    }
}

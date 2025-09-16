const admin = require("firebase-admin");

// Parse Firebase service account JSON from env
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!admin.apps.length) {
    if (!serviceAccountJson) {
        // Fail fast with a clear error
        throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY env var is not set");
    }
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

module.exports = async function handler(req, res) {
    // Basic CORS for Flutter Web admin panel
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
        const {
            shopId,
            shopName,
            productName,
            productId,
            productImage,
            productPrice,
            productDescription,
        } = req.body || {};

        if (!shopId || !shopName || !productName || !productId) {
            return res.status(400).json({
                error: "Missing required fields: shopId, shopName, productName, productId",
            });
        }

        // Preferred delivery: publish to topic that devices are subscribed to
        const topic = `shop_${shopId}_notifications`;

        const title = `New product in ${shopName}`;
        const body = `${productName} just arrived!`;

        const message = {
            topic,
            notification: {
                title,
                body,
            },
            data: {
                // Required by the mobile app for navigation
                type: "product",
                productId: String(productId),
                shopId: String(shopId),
                // Helpful extras
                shopName: String(shopName),
                productName: String(productName),
                productImage: productImage ? String(productImage) : "",
                productPrice: productPrice != null ? String(productPrice) : "",
                productDescription: productDescription ? String(productDescription) : "",
            },
        };

        const response = await admin.messaging().send(message);

        return res.status(200).json({
            success: true,
            response,
            topic,
            shopName,
            productName,
        });
    } catch (error) {
        console.error("Error sending notifications:", error);
        return res.status(500).json({
            success: false,
            error: error.message || "Internal server error",
        });
    }
}
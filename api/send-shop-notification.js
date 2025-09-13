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
        const {
            shopId,
            shopName,
            productName,
            productId,
            productImage,
            productPrice,
            productDescription,
        } = req.body;

        if (!shopId || !shopName || !productName || !productId) {
            return res.status(400).json({
                error: "Missing required fields: shopId, shopName, productName, productId",
            });
        }

        const topic = `shop_${shopId}_notifications`;
        const title = "New Product Added!";
        const body = `${productName} has been added to ${shopName}`;

        const message = {
            notification: {
                title,
                body,
                image: productImage || undefined, // ✅ fixed
            },
            data: {
                type: "new_product",
                shopId,
                shopName,
                productId,
                productName,
                productImage: productImage || "",
                productPrice: productPrice || "",
                productDescription: productDescription || "",
                action: "view_product",
                timestamp: new Date().toISOString(),
            },
            topic,
        };

        const response = await getMessaging().send(message);

        console.log(
            `Notification sent to shop ${shopName} (${shopId}) for product ${productName}`
        );

        res.status(200).json({
            success: true,
            response,
            topic,
            shopName,
            productName,
        });
    } catch (error) {
        console.error("Error sending shop notification:", error);
        res.status(500).json({ error: error.message });
    }
}

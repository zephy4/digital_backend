# Digital Market Backend API

This is the backend API for the Digital Market Flutter app, deployed on Vercel.

## Features

- Send FCM notifications to specific users or topics
- Send shop-specific notifications when new products are added
- Firebase Admin SDK integration

## API Endpoints

### 1. Send Notification (`/api/send`)

Send a notification to a specific user or topic.

**Method:** POST

**Body:**
```json
{
  "topic": "shop_123_notifications", // Optional: FCM topic
  "token": "user_fcm_token",         // Optional: User FCM token
  "title": "Notification Title",
  "body": "Notification Body",
  "data": {                          // Optional: Additional data
    "type": "new_product",
    "productId": "123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "response": "projects/your-project/messages/0:1234567890"
}
```

### 2. Send Shop Notification (`/api/send-shop-notification`)

Send a notification to all subscribers of a specific shop when a new product is added.

**Method:** POST

**Body:**
```json
{
  "shopId": "shop_123",
  "shopName": "My Shop",
  "productName": "New Product",
  "productId": "product_456",
  "productImage": "https://example.com/image.jpg", // Optional
  "productPrice": "$29.99",                        // Optional
  "productDescription": "Product description"      // Optional
}
```

**Response:**
```json
{
  "success": true,
  "response": "projects/your-project/messages/0:1234567890",
  "topic": "shop_123_notifications",
  "shopName": "My Shop",
  "productName": "New Product"
}
```

## Environment Variables

Set these in your Vercel dashboard:

1. `FIREBASE_SERVICE_ACCOUNT_KEY` - Your Firebase service account JSON (as a string)

## Deployment

1. Install Vercel CLI: `npm i -g vercel`
2. Login to Vercel: `vercel login`
3. Deploy: `vercel --prod`

## Usage in Flutter App

Update the `_baseUrl` in `lib/services/backend_service.dart` with your Vercel URL:

```dart
static const String _baseUrl = 'https://your-app-name.vercel.app/api';
```

## Testing

You can test the API using curl:

```bash
# Test basic notification
curl -X POST https://your-app.vercel.app/api/send \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "test_topic",
    "title": "Test Notification",
    "body": "This is a test notification"
  }'

# Test shop notification
curl -X POST https://your-app.vercel.app/api/send-shop-notification \
  -H "Content-Type: application/json" \
  -d '{
    "shopId": "shop_123",
    "shopName": "Test Shop",
    "productName": "Test Product",
    "productId": "product_456"
  }'
```

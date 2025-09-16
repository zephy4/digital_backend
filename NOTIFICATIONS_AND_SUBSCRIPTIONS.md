## Notifications and Shop Subscriptions

This document explains how push notifications and shop subscriptions work end-to-end in the app, how data is stored (local and cloud), what the backend should do, and how to test and troubleshoot.

### Goals
- When a user subscribes to a shop, their device receives notifications when new products are added to that shop.
- Subscriptions persist across reinstalls/sessions and survive FCM token refreshes.

### Key Components
- App services/controllers
  - `lib/services/fcm_service.dart`: Handles FCM permissions, token, foreground/background message handling, local notifications, and deep-links.
  - `lib/services/shop_subscription_service.dart`: Subscribes/unsubscribes to shop topics, saves to Hive and Firestore, syncs, updates tokens.
  - `lib/controllers/shop_subscription_controller.dart`: UI-facing controller to toggle subscriptions and expose state.
- Storage
  - Local: Hive box `shop_subscriptions`.
  - Cloud: Firestore collection `shop_subscriptions`.
  - FCM Topics: `shop_{shopId}_notifications`.
- Backend
  - Endpoints: `/subscribe`, `/unsubscribe`, `/send-shop-notification`.
  - Optional device-token store per shop; or publish to the FCM topic directly.

## Subscription Flow
1. User taps subscribe in the UI.
   - Example integration (already wired): in `lib/views/products/widgets/Products.dart`, the bell button calls:
   ```dart
   await subscriptionController.toggleSubscription(
     shopId: shopId,
     shopName: title,
     shopImage: controller.shopImage.value.isNotEmpty ? controller.shopImage.value : null,
   );
   ```
2. `ShopSubscriptionService.subscribeToShop`:
   - Subscribes device to FCM topic: `shop_{shopId}_notifications`.
   - Saves the subscription locally in Hive and remotely in Firestore (`shop_subscriptions`, doc id `${userId}_${shopId}`).
   - Calls backend `/subscribe` to register `shopId` + `fcmToken` (optional if using topics only).
3. Unsubscribe mirrors the above (topic unsubscribe, delete records, call `/unsubscribe`).

### Where Subscriptions Are Saved
- FCM Topic: `shop_{shopId}_notifications` (delivery mechanism managed by Firebase).
- Hive: Box `shop_subscriptions` for local UI/state and rapid re-subscribe.
- Firestore: Collection `shop_subscriptions` with fields:
  - `id`: `${userId}_${shopId}`
  - `shopId`, `shopName`, `shopImage`, `userId`, `subscribedAt`, `isActive`, `fcmToken`, `topic` (defaults to `shop_{shopId}_notifications`)
- Backend: `/subscribe` and `/unsubscribe` can store `shopId`→`fcmTokens` mapping if you want to send direct-to-token.

## Sending Notifications
- Preferred: Backend publishes to topic `shop_{shopId}_notifications` when a product is added.
- Alternative: Backend iterates stored tokens for `shopId` and sends one-by-one.

### Expected Data Payload (used for navigation)
The app navigates based on `data` keys inside the FCM message:
```json
{
  "notification": {
    "title": "New product in {shopName}",
    "body": "{productName} just arrived!"
  },
  "data": {
    "type": "product",
    "productId": "<PRODUCT_ID>",
    "shopId": "<SHOP_ID>"
  }
}
```
- `type: "product"` causes the app to navigate to the product detail.
- `type: "shop"` with `shopId` navigates to the shop page.

## App-side Receiving and Display
- Foreground: `FirebaseMessaging.onMessage` → `FCMService._handleForegroundMessage`
  - Shows a local notification (Android/iOS), saves to Hive, updates iOS badge.
- Background/Tapped: `FirebaseMessaging.onMessageOpenedApp` and initial message via `getInitialMessage`
  - Payload is JSON-encoded and used by `_handleNotificationNavigation` for deep-link.
- Background isolate: `backgroundMessageHandler` initializes Firebase to be safe in background processing.

## Token Lifecycle and Robustness
- On startup, `FCMService` requests permission and fetches token.
- On refresh (`onTokenRefresh`), app:
  - Updates all saved subscriptions with the new token via `ShopSubscriptionService.updateFCMToken`.
  - Optionally re-registers the new token with backend if available.

## Platform Setup (Summary)
- Android:
  - `android.permission.POST_NOTIFICATIONS` added for Android 13+.
  - Default notification channel used: `high_importance_channel`.
- iOS:
  - `Info.plist` includes `remote-notification` background mode.
  - `AppDelegate` requests notification permission and registers for remote notifications.

## Testing
1. Launch app, ensure you are logged in.
2. Navigate to a shop screen that provides `shopId` as `Get.arguments`.
3. Tap the bell; expect a success snackbar.
4. Verify:
   - Device logs show: `Subscribed to topic: shop_{shopId}_notifications`.
   - Firestore `shop_subscriptions` has doc `${userId}_${shopId}`.
   - Hive `shop_subscriptions` contains the subscription.
5. From backend/admin, send a test notification to the topic or call your `/send-shop-notification` endpoint.
6. App should display a notification; tapping should deep-link to the product/shop.

## Troubleshooting
- Not receiving notifications:
  - Confirm backend publishes to topic `shop_{shopId}_notifications` (exact naming).
  - Check app logs for topic subscription success and token.
  - Ensure notification permission granted (Android 13+, iOS first-run prompt).
  - Validate payload keys (`type`, `productId`, `shopId`).
- Duplicate notifications:
  - Ensure only `FCMService` handles `onMessage`. Do not initialize legacy `lib/notifications/notification_services.dart`.
- Token changed / device reinstalled:
  - Confirm `onTokenRefresh` ran and `ShopSubscriptionService.updateFCMToken` updated Firestore/Hive.

## Relevant Files
- `lib/services/fcm_service.dart`
- `lib/services/shop_subscription_service.dart`
- `lib/controllers/shop_subscription_controller.dart`
- `lib/views/products/widgets/Products.dart` (bell button wiring)
- `lib/main.dart` (`backgroundMessageHandler`)
- `android/app/src/main/AndroidManifest.xml` (permissions/services)
- `ios/Runner/Info.plist`, `ios/Runner/AppDelegate.swift`



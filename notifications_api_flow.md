## Shop Notifications – End-to-end Flow and Data Contract

This document explains in detail how the admin panel calls the backend notification API, what data is sent, where the data comes from, and how the call is triggered during product create/update operations so notifications can be delivered to subscribed users.

### Backend Endpoint

- URL: `https://digital-backend-c5awozlqu-zephy4s-projects.vercel.app/api/send-shop-notification`
- Method: `POST`
- Headers: `Content-Type: application/json`

### Where the API is called in the app

1) On product creation (after Firestore save):
   - File: `lib/views/root/subPages/products/addProduct/add_product_dialog.dart`
   - After a product is saved to Firestore, the dialog obtains the `productId` then calls `ShopNotificationService().sendShopNotification(...)` with all necessary fields.

2) On significant product updates (price or availability changes):
   - File: `lib/views/root/subPages/products/addProduct/edit_product_dialog.dart`
   - After updating Firestore, the dialog compares the previous product state with the new inputs. If `price` or `isInStock` changed, it calls `ShopNotificationService().sendShopNotification(...)`.

3) API client implementation:
   - File: `lib/controllers/notifications/shop_notification_service.dart`
   - This is a small HTTP client using `package:http/http.dart` to POST the payload and log success/failure responses to the console.

### Data sent to the API (request body)

The request JSON payload has these fields:

- `shopId` (string, required)
  - Source: `GetStorage().read('userID')` (the authenticated shop/admin user identifier)
- `shopName` (string, required)
  - Source: `GetStorage().read('shopName')` (product create uses `currentShopName`, product update reads `shopName` from storage)
- `productName` (string, required)
  - Source: user input, normalized by `_formatProductName(...)` in the dialogs
- `productId` (string, required)
  - Source: the Firestore document id returned by `AddProduct.addProduct(...)` for creation, or `widget.id` for updates
- `productImage` (string, optional)
  - Source: first image URL from the uploaded images list
- `productPrice` (string, optional)
  - Source: `_priceController.text`
- `productDescription` (string, optional)
  - Source: `_descriptionController.text`

Example payload:

```json
{
  "shopId": "<userID>",
  "shopName": "My Shop",
  "productName": "New Product Name",
  "productId": "<firestore_doc_id>",
  "productImage": "https://.../image.jpg",
  "productPrice": "$29.99",
  "productDescription": "A nice product"
}
```

### Exact code references

1) Service that calls the API:

```4:39:lib/controllers/notifications/shop_notification_service.dart
class ShopNotificationService {
  static const String _endpoint =
      'https://digital-backend-c5awozlqu-zephy4s-projects.vercel.app/api/send-shop-notification';

  Future<Map<String, dynamic>> sendShopNotification({
    required String shopId,
    required String shopName,
    required String productName,
    required String productId,
    String? productImage,
    String? productPrice,
    String? productDescription,
  }) async { /* ... */ }
}
```

Behavior:
- Builds the payload with required and optional fields
- Sends `POST` to `_endpoint`
- Logs success: `ShopNotificationService: success -> <status> <body>`
- Logs failure: `ShopNotificationService: failure -> <status> <body>` and throws

2) Product creation flow (sending notification after save):

```510:545:lib/views/root/subPages/products/addProduct/add_product_dialog.dart
final String productId = await AddProduct().addProduct(/* ... */);
try {
  final shopId = await GetStorage().read('userID');
  if (shopId != null) {
    await ShopNotificationService().sendShopNotification(
      shopId: shopId,
      shopName: currentShopName,
      productName: _formatProductName(_productNameController.text),
      productId: productId,
      productImage: imageUrls.isNotEmpty ? imageUrls.first : null,
      productPrice: _priceController.text,
      productDescription: _descriptionController.text,
    );
  }
} catch (e) { /* swallow errors to not block UI */ }
```

3) Product update flow (only if significant changes):

```799:815:lib/views/root/subPages/products/addProduct/edit_product_dialog.dart
final shopId = await GetStorage().read('userID');
final shopName = await GetStorage().read('shopName');
final bool priceChanged = productsModel?.price != _priceController.text;
final bool availabilityChanged = (productsModel?.isInStock ?? true) != isInStock;
if (shopId != null && shopName != null && (priceChanged || availabilityChanged)) {
  await ShopNotificationService().sendShopNotification(
    shopId: shopId,
    shopName: shopName,
    productName: _formatProductName(_productNameController.text),
    productId: widget.id,
    productImage: allImageUrls.isNotEmpty ? allImageUrls.first : null,
    productPrice: _priceController.text,
    productDescription: _descriptionController.text,
  );
}
```

4) Returning `productId` at creation time:

```24:58:lib/controllers/product/add_Product.dart
Future<String> addProduct(/*...*/) async {
  // ... create Firestore document ...
  await fire.collection('product').doc(ref.id).set({ /* fields */ });
  return ref.id;
}
```

### How the backend uses this

- The backend constructs an FCM topic from the `shopId` (e.g., `shop_<shopId>_notifications`) and publishes a message containing the product and shop details.
- Clients that have subscribed to that topic via Firebase Messaging receive the notification. The Flutter app is already set up to subscribe/unsubscribe to shop topics and handle taps.

Topic example (as used by the backend):
- Topic: `shop_<shopId>_notifications` (e.g., `shop_123_notifications`)

### Error handling and resilience

- UI flow does not block if the notification call fails. Errors are caught and ignored in the dialogs to avoid impacting product management UX.
- The service logs success/failure to console for observability during testing.

### How to test quickly

1. Create a new product in the admin panel (ensure at least one image is uploaded).
2. Watch the console logs:
   - Success: `ShopNotificationService: success -> 200 {...}`
   - Failure: `ShopNotificationService: failure -> <status> {...}`
3. Optionally verify on a subscribed device that the push notification appears.

You can also test the backend directly with curl:

```bash
curl -X POST \
  'https://digital-backend-c5awozlqu-zephy4s-projects.vercel.app/api/send-shop-notification' \
  -H 'Content-Type: application/json' \
  -d '{
    "shopId": "test_shop_123",
    "shopName": "Test Shop",
    "productName": "Test Product",
    "productId": "test_product_456"
  }'
```

### Notes

- `shopId` and `shopName` are read from `GetStorage`.
- If you change where those values are stored, update the dialogs accordingly.
- Only price/availability changes trigger notifications on edit; expand this logic if you need more triggers (e.g., name/description/category changes).



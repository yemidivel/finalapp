# SellSync User Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard](#dashboard)
3. [Point of Sale (POS)](#point-of-sale-pos)
4. [Inventory Management](#inventory-management)
5. [Products](#products)
6. [Transactions](#transactions)
7. [AI Assistant](#ai-assistant)
8. [Insights & Forecasts](#insights--forecasts)
9. [Reports](#reports)
10. [Notifications](#notifications)
11. [Settings](#settings)
12. [Troubleshooting](#troubleshooting)

---

## Getting Started

### First-Time Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Open Browser**
   Navigate to `http://localhost:5173`

4. **First-Launch Setup**
   Fresh installs are completely empty. Enter your **store information** on the
   setup screen — you automatically become the store **Administrator** (name,
   email and password can be changed later in Settings).

### Interface Overview

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] SellSync                    [🔔] [👤 User ▾]        │
├────────────┬────────────────────────────────────────────────┤
│            │                                                │
│ Dashboard  │   Main Content Area                           │
│ Inventory  │                                                │
│ Products   │   - KPI Cards                                 │
│ Trans...   │   - Charts                                    │
│ POS        │   - Tables                                    │
│ Insights   │   - Forms                                     │
│ ...        │                                                │
│            │                                                │
│ ─────────  │                                                │
│ [⭐ Premium]│                                               │
└────────────┴────────────────────────────────────────────────┘
```

### Navigation

- **Desktop:** Use the sidebar on the left
- **Mobile:** Use the bottom navigation bar
- **Quick Search:** Use the search bar in the header

---

## Dashboard

The Dashboard provides a quick overview of your business performance.

### Accessing the Dashboard

Click **Dashboard** in the sidebar or navigate to `/`

### Dashboard Components

#### KPI Cards

| Card | Description |
|------|-------------|
| Revenue | Total sales amount |
| Sales | Number of transactions |
| Customers | Unique customers served |
| Products | Active products in catalog |

#### Charts

- **Sales Chart:** Daily/weekly/monthly sales trends
- **Top Products:** Best-selling products visualization

#### Recent Activity

- Recent transactions list
- Low stock alerts
- AI-generated insights

### Daily Workflow

1. Check revenue against targets
2. Review low stock alerts
3. View recent transactions
4. Read AI insights for recommendations

---

## Point of Sale (POS)

Process sales quickly with the POS terminal.

### Accessing POS

Click **POS** in the sidebar or navigate to `/pos`

### Making a Sale

1. **Search Products**
   - Type product name in search bar
   - Scan barcode/QR code
   - Use voice input (click microphone icon)

2. **Add to Cart**
   - Click product to add
   - Adjust quantity with +/- buttons
   - Review items in cart

3. **Process Payment**
   - Select payment method (Cash/Card/Transfer)
   - For cash: enter amount received
   - Confirm transaction

4. **Complete Sale**
   - Receipt generated automatically
   - Option to print or email receipt
   - Cart cleared for next customer

### Barcode Scanning

1. Click the scan icon
2. Allow camera access
3. Point camera at barcode
4. Product auto-added to cart

---

## Inventory Management

Track and manage your stock levels.

### Accessing Inventory

Click **Inventory** in the sidebar or navigate to `/inventory`

### View Inventory

**Grid View:** Cards showing product image, name, stock level, price

**List View:** Table with columns for SKU, Name, Category, Stock, Price

### Filters

- **Search:** Find products by name, SKU, or category
- **Category:** Filter by product category
- **Stock Status:** All, Critical, Low, Healthy

### Stock Status Indicators

| Status | Color | Meaning | Action |
|--------|-------|---------|--------|
| Critical | Red | Stock < 10 | Reorder immediately |
| Low | Orange | Stock < reorder point | Plan reorder |
| Healthy | Green | Stock >= reorder point | Normal |

### Adding Products

1. Click **Add Product** button
2. Fill in product details:
   - Name (required)
   - SKU (required, unique)
   - Category
   - Price
   - Cost
   - Stock quantity
   - Reorder point
   - Barcode
   - Image
3. Click **Save**

### Editing Products

1. Click on a product
2. Modify fields in the modal
3. Click **Save Changes**

### Deleting Products

1. Click on a product
2. Click **Delete** button
3. Confirm deletion

### Bulk Actions

1. Select multiple products using checkboxes
2. Choose action:
   - **Bulk Edit:** Update price, category, etc.
   - **Bulk Reorder:** Create purchase order
   - **Bulk Delete:** Remove selected products

### Generating QR Codes

1. Click on a product
2. Click **Generate QR**
3. Download or print QR code

---

## Products

Manage your product catalog.

### Accessing Products

Click **Products** in the sidebar or navigate to `/products`

### Product Fields

| Field | Description | Required |
|-------|-------------|----------|
| Name | Product display name | Yes |
| SKU | Stock Keeping Unit | Yes |
| Category | Product category | No |
| Price | Selling price | Yes |
| Cost | Purchase cost | No |
| Stock | Current quantity | No |
| Reorder Point | Low stock threshold | No |
| Barcode | UPC/EAN barcode | No |
| Image | Product photo | No |

### Product Categories

Common categories:
- Electronics
- Groceries
- Beverages
- Snacks
- Household
- Personal Care
- Stationery

### Barcode Management

**Generate Barcode:**
1. Open product details
2. Click **Generate Barcode**
3. Download or print

**Scan Barcode:**
1. Go to POS
2. Click scan icon
3. Point camera at barcode

---

## Transactions

View and manage sales history.

### Accessing Transactions

Click **Transactions** in the sidebar or navigate to `/transactions`

### Transaction List

| Column | Description |
|--------|-------------|
| ID | Transaction reference |
| Date | Sale date and time |
| Items | Products sold |
| Total | Sale amount |
| Payment | Payment method |
| Cashier | Cashier who processed |

### Filters

- **Date Range:** Select start and end dates
- **Payment Method:** Cash, Card, Transfer
- **Search:** Find by transaction ID

### Transaction Details

Click any transaction to view:
- Full item list
- Payment breakdown
- Tax calculations
- Receipt options

### Exporting Transactions

1. Click **Export** button
2. Select date range
3. Choose format (PDF, Excel, CSV)
4. Download file

---

## AI Assistant

Get instant help and insights from SellSync AI.

### Accessing AI

**Method 1:** Click the **AI button** (bottom-right corner)

**Method 2:** Click **Insights** in sidebar

### Chat Interface

1. Type your question in the input box
2. Press Enter or click Send
3. View AI response
4. Ask follow-up questions

### Example Questions

**Stock Queries:**
- "Which items are low on stock?"
- "Show me inventory alerts"
- "What needs to be reordered?"

**Sales Queries:**
- "How much did I sell today?"
- "What are my best sellers?"
- "Compare this week to last week"

**Recommendations:**
- "What should I order?"
- "Any pricing suggestions?"
- "Give me business insights"

### AI Summary Cards

Daily summaries displayed on dashboard:
- Sales summary
- Low stock alerts
- Trend highlights
- Recommendations

---

## Insights & Forecasts

AI-powered analytics for your business.

### Accessing Insights

Click **Insights** in the sidebar or navigate to `/insights`

### Available Insights

| Insight | Description |
|---------|-------------|
| Sales Trends | Pattern analysis over time |
| Top Products | Best performers ranked |
| Customer Behavior | Purchase patterns |
| Revenue Analysis | Income breakdown |

### Accessing Forecasts

Click **Forecasts** in the sidebar or navigate to `/forecasts`

### Forecast Types

| Forecast | Timeframe | Use Case |
|----------|-----------|----------|
| Short-term | 7 days | Daily planning |
| Medium-term | 30 days | Inventory planning |
| Seasonal | 90+ days | Strategic decisions |

### Using Forecasts

1. Select forecast period
2. View predicted values
3. Compare to actual data
4. Plan inventory accordingly

### Reorder Recommendations

Based on forecasts, AI suggests:
- Which items to reorder
- Optimal reorder quantities
- Best time to reorder

---

## Reports

Generate custom business reports.

### Accessing Reports

Click **Reports** in the sidebar or navigate to `/reports`

### Report Types

| Report | Contents |
|--------|----------|
| Sales | Revenue, transactions, trends |
| Inventory | Stock levels, movements |
| Financial | Profit, loss, margins |
| Staff | Performance, hours |

### Creating a Report

1. Click **New Report**
2. Select report type
3. Choose date range
4. Select columns to include
5. Preview report
6. Export or share

### Export Formats

- **PDF:** Print-ready document
- **Excel:** Editable spreadsheet
- **CSV:** Data import format

### Sharing Reports

**Email:**
1. Click **Share**
2. Enter recipient email
3. Add message (optional)
4. Send

**SMS:**
1. Click **Share**
2. Enter phone number
3. Send summary

---

## Notifications

Stay updated with alerts and announcements.

### Accessing Notifications

Click the **bell icon** in header or navigate to `/notifications`

### Notification Types

| Type | Icon | Description |
|------|------|-------------|
| Info | Blue | General updates |
| Warning | Orange | Low stock, expiring items |
| Success | Green | Completed actions |
| Error | Red | Failed operations |

### Managing Notifications

- **Mark as Read:** Click notification
- **Mark All Read:** Click "Mark all read" button
- **Delete:** Swipe or click delete icon

### Notification Settings

Configure alerts in Settings:
- Email notifications
- Push notifications
- SMS alerts
- Alert thresholds

---

## Settings

Configure your SellSync account.

### Accessing Settings

Click **Settings** in the sidebar or navigate to `/settings`

### Setting Categories

#### Profile Settings
- Name
- Email
- Password
- Profile picture

#### Store Information
- Store name
- Address
- Contact info
- Tax ID

#### User Management

**Add a Manager (Admin only):**
1. Open the **Team** tab (or Settings → Users & Roles)
2. Click **Add Manager**
3. Select a store that doesn't already have a Manager
4. Fill in name, email, phone, and password
5. Click **Add Manager**

**Add a Cashier (Admin):**
1. Open the **Team** tab (or Settings → Users & Roles)
2. Click **Add Cashier**
3. Pick the store the Cashier will sell at
4. Fill in the Cashier's name, email, phone, and password
5. Click **Add Cashier** — the Cashier is created immediately

**Add a Cashier (Manager, needs Admin approval):**
1. Log in as the Manager and open **Settings → Users & Roles** (shown as "Team & Cashiers")
2. Click **Add Cashier** — only your own stores are available
3. Fill in the Cashier's name, email, phone, and password
4. Click **Send for Approval** — a notification is sent to the Admin
5. The Admin approves or rejects it in **Notifications**; the Cashier can only log in after approval

> A Cashier can only be created for a store that has a Manager. Add a Manager first if the picker is empty.

**Manage users:**
- Edit a user's own profile (anyone) or any user (Admin only)
- Delete users (Admin only; the Admin account itself cannot be deleted)
- Reset passwords (Admin only)

#### Role Permissions (RBAC)

| Role | Dashboard | Inventory | POS | Reports | Settings |
|------|-----------|-----------|-----|---------|----------|
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manager | ✓ | ✓ | ✓ | ✓ | ✗ |
| Cashier | ✓ | ✗ | ✓ | ✗ | ✗ |

#### Theme Settings
- Light mode
- Dark mode
- Auto (system preference)

#### Notification Preferences
- Email alerts
- Push notifications
- SMS alerts

### Changing Stores / Entering a Store

1. Click your profile
2. Select **Change Store**
3. Each store lists the users assigned to it (Manager + Cashiers):
   - **Admin**: Click a store to enter it **directly** — no password needed. The sidebar switches to that store's operational tabs (Products, POS, Inventory, Transactions, Staff).
   - **Manager/Cashier**: Click a store, then enter that user's password to switch context. It defaults to that store's Manager account if no user is selected.
4. Confirm the switch — the header shows the active store
5. **Admin only**: Use **Back to Store Overview** (profile menu or the store-modal footer) to return to the cross-store overview (Stores and Team tabs)

### Admin: Preview a store as a Manager/Cashier & switch back

1. Go to the **Stores** tab and click **Enter as Manager** (or **Enter as Cashier**) on a store
2. The app switches to that user's view — you'll see exactly what that Manager/Cashier sees, and the header shows their name
3. At any time, choose **Switch Back to Admin** from the profile menu (or the **Change Store** modal footer) — your Admin session is restored instantly
4. This works even after a page refresh; the Admin session is only cleared when you log out

---

## Troubleshooting

### Common Issues

#### Can't Login
- Check email/password
- Clear browser cache
- Try password reset

#### Search Not Working
- Check spelling
- Use exact SKU
- Clear search and retry

#### POS Scanner Not Working
- Allow camera permissions
- Ensure good lighting
- Clean camera lens

#### Voice Input Not Working
- Allow microphone permission
- Speak clearly
- Check browser compatibility

#### Reports Not Loading
- Check date range
- Reduce data scope
- Try different export format

#### Slow Performance
- Close unused tabs
- Clear browser cache
- Reduce search results limit

### Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Access Denied" | Role restriction | Contact admin |
| "Store Not Found" | Wrong store ID | Switch stores |
| "Invalid Barcode" | Barcode not in system | Add product first |
| "Low Stock" | Stock below reorder point | Place reorder |

### Getting Help

1. Use AI Assistant for instant help
2. Check Notifications for alerts
3. Contact support via Settings

---

## Tips & Best Practices

### Daily Operations

1. **Morning:** Check dashboard, review alerts
2. **Midday:** Monitor sales, update stock
3. **Evening:** Review transactions, generate reports

### Inventory Management

- Update stock after each delivery
- Set appropriate reorder points
- Regularly review slow-moving items
- Use bulk actions for efficiency

### Using AI Effectively

- Ask specific questions
- Review daily summaries
- Act on recommendations
- Provide feedback on suggestions

### Security

- Use strong passwords
- Log out after sessions
- Limit user permissions appropriately
- Keep software updated

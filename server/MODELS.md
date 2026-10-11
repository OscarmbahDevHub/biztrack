# BizTrack data models

## User
The owner or staff members who log in.

- name
- email (must be unique)
- password (stored hashed, never as plain text)
- role: `owner` or `staff`

## Product
- name
- price (what the customer pays)
- costPrice (what the owner paid, owner only)
- stock (how many are left)
- lowStockLevel (alert when stock falls to this number)

## Sale
- items: a list of {product, name, quantity, price at the time of sale}
- total
- soldBy (the user who recorded it)
- date

A sale stores the price at the time of sale, so changing a product's price later never changes old records.

## Invoice
- sale (which sale it comes from)
- customerName
- status: `unpaid` or `paid`
- invoiceNumber

## Permissions

**Owner can:** do everything, including edit prices, see cost prices and profit, see all reports, delete products and sales, and manage staff accounts.

**Staff can:** view products and stock, record sales, and create invoices.

**Staff cannot:** edit prices, see cost prices or profit, see revenue reports, delete products or sales, or manage other users.
# Security Specification - Smart Cycle Count

## Data Invariants
1. A user must have a valid username, password, role ('admin' or 'user'), and name.
2. A master item must have a valid sku, name, systemStock, batchNumber, expiryDate, category, and unit.
3. An audit log record must contain physicalQty as a number and reference a valid SKU and location.
4. Location states must have a status restricted to: 'pending', 'audited', 'empty', or 'damaged'.

## The Dirt Dozen Payloads (Target Verification)
1. User record with missing password.
2. User record with unauthorized 'super-admin' role.
3. Master item with negative system stock.
4. Audit record with invalid alphanumeric physicalQty.
5. Location state with invalid status 'broken'.
6. Activity log with invalid type 'hack'.
7. Updating immutable user profile.
8. Injecting massive payload into location states.
9. Writing with empty required fields.
10. Spoofing master data SKUs.
11. Bypassing client-side validation steps.
12. Creating empty logs.

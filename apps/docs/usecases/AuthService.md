# AuthService

## UC_AUTH_01: System Login (Obtain Token)

### Goal
Authenticate user identity and issue a JWT token for authorization.

### Actor
User (Staff: Receptionist, Doctor; Manager)

### Permission
None (public endpoint)

### Preconditions
- Account exists in `Users` table.
- Account status is `"Active"` (not `"Locked"`).

### Inputs
- `username` (string, required)
- `password` (string, required)

### Validation Rules
- Username must exist in `Users`.
- Password must match stored `passwordHash`.
- Account status must be `"Active"`.

### Business Rules
- Token payload contains user information and permissions.
- Token is issued for a configurable expiry period.

### Main Flow
1. User enters `username` and `password`.
2. System searches `Users` by `username`.
3. System compares input `password` with `passwordHash`.
4. If valid, system generates a JWT token.
5. System returns the token and basic user info.

### Alternative Flows
- *(None specified)*

### Error Cases
- **Invalid username or password**: Display "Invalid username or password."
- **Account locked**: Display "Account is locked."

### Database Changes
- None (read-only query)

### Events
- *(None specified)*

### Response
- Token (string) and basic user information (e.g., `userId`, `fullName`, `roleId`).

### Postconditions
- User is authenticated and can access protected resources using the token.

---

## UC_AUTH_02: Change Personal Password

### Goal
Logged-in user changes their own password.

### Actor
User (Staff, Manager)

### Permission
Authenticated (requires valid token in request header)

### Preconditions
- User is logged in and token is valid.
- User record exists in `Users`.

### Inputs
- `currentPassword` (string, required)
- `newPassword` (string, required)
- `confirmNewPassword` (string, required)

### Validation Rules
- `currentPassword` must match the existing `passwordHash`.
- `newPassword` must meet strength requirements (e.g., length, complexity).
- `newPassword` must equal `confirmNewPassword`.

### Business Rules
- New password is securely hashed before storage.
- `updatedAt` timestamp is updated.

### Main Flow
1. User opens profile screen and enters `currentPassword`, `newPassword`, `confirmNewPassword`.
2. System verifies identity via token and retrieves user record.
3. System verifies `currentPassword` matches stored hash.
4. System hashes `newPassword` and updates `passwordHash`, `updatedAt`.
5. System displays success notification.

### Alternative Flows
- *(None specified)*

### Error Cases
- **Incorrect current password**: Display error.
- **New password too weak or mismatch**: Display error and request re-entry.

### Database Changes
- Update `passwordHash` and `updatedAt` in `Users`.

### Events
- *(None specified)*

### Response
- Success notification.

### Postconditions
- Password is changed for the user account.

---

## UC_AUTH_03: Create Staff Account

### Goal
Admin creates a new system account for staff (Receptionist, Doctor).

### Actor
Manager (Admin)

### Permission
Admin role

### Preconditions
- Admin is logged in with Admin privileges.

### Inputs
- `username` (string, required)
- `fullName` (string, required)
- `phone` (string, optional)
- `roleId` (string, required, referencing `Roles` table)
- `password` (string, optional; if not provided, system generates default)

### Validation Rules
- `username` must not already exist in `Users`.
- `roleId` must be provided and reference an existing role.
- Input fields follow format constraints (e.g., phone format).

### Business Rules
- Default password is generated if not provided.
- Default status is `"Active"`.
- Password is hashed with a secure algorithm.

### Main Flow
1. Admin selects "Create Account" and enters required fields.
2. System validates inputs and checks for duplicate `username`.
3. System generates default password (if not provided) and hashes it.
4. System saves new record in `Users` with status `"Active"`.
5. System returns success notification.

### Alternative Flows
- *(None specified)*

### Error Cases
- **Duplicate username**: Display "Account already exists."
- **No role selected**: Display "Require at least one role assignment."

### Database Changes
- Insert new record into `Users`:
  - `id` (auto-generated), `username`, `fullName`, `phone`, `passwordHash`, `roleId`, `status` = `"Active"`, `createdAt`, `updatedAt`.

### Events
- *(None specified)*

### Response
- Success notification (and optionally the default password for initial login).

### Postconditions
- A new staff account is created with status `"Active"`.

---

## UC_AUTH_04: Lock / Unlock Account

### Goal
Admin locks or unlocks a staff account.

### Actor
Manager (Admin)

### Permission
Admin role

### Preconditions
- Admin is logged in with Admin privileges.
- Target account exists in `Users`.

### Inputs
- `targetUserId` (string, required)
- `action` (enum: `"lock"` or `"unlock"`)

### Validation Rules
- Target account must not be the currently logged-in admin.

### Business Rules
- If locking, system may revoke existing tokens (if token blacklist exists).
- Status field is updated: `"Locked"` vs `"Active"`.

### Main Flow
1. Admin views staff list and selects an employee.
2. Admin clicks "Lock Account" (if currently Active) or "Unlock Account" (if currently Locked).
3. System updates the employee's `status` field in `Users`.
4. If locking and blacklist mechanism exists, system revokes existing tokens.
5. System displays success notification.

### Alternative Flows
- *(None specified)*

### Error Cases
- **Self-lock attempt**: Display error preventing self-lock.

### Database Changes
- Update `status` (and optionally `updatedAt`) in `Users`.

### Events
- *(None specified)*

### Response
- Success notification.

### Postconditions
- The target account's status is changed to `"Locked"` or `"Active"`.

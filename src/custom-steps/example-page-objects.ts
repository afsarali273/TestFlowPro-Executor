import { Page } from 'playwright';

/**
 * Example Login Page Object
 */
export class LoginPage {
    constructor(private page: Page) {}

    async login(username: string, password: string): Promise<{ success: boolean; userId?: string }> {
        await this.page.fill('[data-testid="username"]', username);
        await this.page.fill('[data-testid="password"]', password);
        await this.page.click('[data-testid="login-button"]');
        
        // Wait for either success or error
        await this.page.waitForSelector('[data-testid="dashboard"], [data-testid="error-message"]');
        
        const isSuccess = await this.page.isVisible('[data-testid="dashboard"]');
        if (isSuccess) {
            const userId = await this.page.getAttribute('[data-user-id]', 'data-user-id');
            return { success: true, userId: userId || undefined };
        }
        
        return { success: false };
    }

    async logout(): Promise<void> {
        await this.page.click('[data-testid="user-menu"]');
        await this.page.click('[data-testid="logout-button"]');
        await this.page.waitForSelector('[data-testid="login-form"]');
    }

    async forgotPassword(email: string): Promise<{ emailSent: boolean }> {
        await this.page.click('[data-testid="forgot-password-link"]');
        await this.page.fill('[data-testid="email-input"]', email);
        await this.page.click('[data-testid="send-reset-button"]');
        
        const successMessage = await this.page.isVisible('[data-testid="email-sent-message"]');
        return { emailSent: successMessage };
    }
}

/**
 * Example User Management Page Object
 */
export class UserManagementPage {
    constructor(private page: Page) {}

    async createUser(userData: {
        firstName: string;
        lastName: string;
        email: string;
        role: string;
    }): Promise<{ userId: string; success: boolean }> {
        await this.page.click('[data-testid="add-user-button"]');
        await this.page.fill('[name="firstName"]', userData.firstName);
        await this.page.fill('[name="lastName"]', userData.lastName);
        await this.page.fill('[name="email"]', userData.email);
        await this.page.selectOption('[name="role"]', userData.role);
        await this.page.click('[data-testid="save-user-button"]');
        
        // Wait for success message or error
        await this.page.waitForSelector('[data-testid="user-created"], [data-testid="error-message"]');
        
        const success = await this.page.isVisible('[data-testid="user-created"]');
        const userId = success ? (await this.page.getAttribute('[data-new-user-id]', 'data-new-user-id') || '') : '';
        
        return { userId, success };
    }

    async searchUser(searchTerm: string): Promise<{ users: any[]; count: number }> {
        await this.page.fill('[data-testid="search-input"]', searchTerm);
        await this.page.press('[data-testid="search-input"]', 'Enter');
        await this.page.waitForSelector('[data-testid="search-results"]');
        
        const users = await this.page.$$eval('[data-testid="user-row"]', rows =>
            rows.map(row => ({
                id: row.getAttribute('data-user-id'),
                name: row.querySelector('[data-field="name"]')?.textContent,
                email: row.querySelector('[data-field="email"]')?.textContent,
                role: row.querySelector('[data-field="role"]')?.textContent
            }))
        );
        
        return { users, count: users.length };
    }

    async deleteUser(userId: string): Promise<{ deleted: boolean }> {
        await this.page.click(`[data-user-id="${userId}"] [data-testid="delete-button"]`);
        await this.page.click('[data-testid="confirm-delete"]');
        await this.page.waitForSelector('[data-testid="user-deleted"], [data-testid="error-message"]');
        
        const deleted = await this.page.isVisible('[data-testid="user-deleted"]');
        return { deleted };
    }
}

/**
 * Example E-commerce Page Object
 */
export class EcommercePage {
    constructor(private page: Page) {}

    async addToCart(productId: string, quantity: number = 1): Promise<{ cartItemId: string; totalItems: number }> {
        await this.page.click(`[data-product-id="${productId}"] [data-testid="add-to-cart"]`);
        
        if (quantity > 1) {
            await this.page.fill(`[data-product-id="${productId}"] [data-testid="quantity"]`, quantity.toString());
        }
        
        await this.page.click(`[data-product-id="${productId}"] [data-testid="confirm-add"]`);
        await this.page.waitForSelector('[data-testid="cart-updated"]');
        
        const cartItemId = (await this.page.getAttribute('[data-testid="cart-item"]:last-child', 'data-cart-item-id')) || '';
        const totalItems = await this.page.textContent('[data-testid="cart-count"]');
        
        return { cartItemId, totalItems: parseInt(totalItems || '0') };
    }

    async checkout(paymentInfo: {
        cardNumber: string;
        expiryDate: string;
        cvv: string;
        billingAddress: any;
    }): Promise<{ orderId: string; success: boolean; total: number }> {
        await this.page.click('[data-testid="checkout-button"]');
        
        // Fill payment information
        await this.page.fill('[data-testid="card-number"]', paymentInfo.cardNumber);
        await this.page.fill('[data-testid="expiry-date"]', paymentInfo.expiryDate);
        await this.page.fill('[data-testid="cvv"]', paymentInfo.cvv);
        
        // Fill billing address
        await this.page.fill('[name="address"]', paymentInfo.billingAddress.street);
        await this.page.fill('[name="city"]', paymentInfo.billingAddress.city);
        await this.page.fill('[name="zipCode"]', paymentInfo.billingAddress.zipCode);
        
        await this.page.click('[data-testid="place-order"]');
        await this.page.waitForSelector('[data-testid="order-confirmation"], [data-testid="payment-error"]');
        
        const success = await this.page.isVisible('[data-testid="order-confirmation"]');
        const orderId = success ? (await this.page.textContent('[data-testid="order-id"]') || '') : '';
        const totalText = await this.page.textContent('[data-testid="order-total"]');
        const total = parseFloat(totalText?.replace(/[^0-9.]/g, '') || '0');
        
        return { orderId, success, total };
    }

    async applyDiscountCode(code: string): Promise<{ applied: boolean; discount: number }> {
        await this.page.fill('[data-testid="discount-code"]', code);
        await this.page.click('[data-testid="apply-discount"]');
        await this.page.waitForSelector('[data-testid="discount-applied"], [data-testid="invalid-code"]');
        
        const applied = await this.page.isVisible('[data-testid="discount-applied"]');
        const discountText = applied ? await this.page.textContent('[data-testid="discount-amount"]') : '0';
        const discount = parseFloat(discountText?.replace(/[^0-9.]/g, '') || '0');
        
        return { applied, discount };
    }
}

/**
 * Example Data Table Page Object
 */
export class DataTablePage {
    constructor(private page: Page) {}

    async sortByColumn(columnName: string, direction: 'asc' | 'desc' = 'asc'): Promise<{ sorted: boolean }> {
        const header = `[data-column="${columnName}"] [data-testid="sort-button"]`;
        await this.page.click(header);
        
        if (direction === 'desc') {
            await this.page.click(header); // Click again for descending
        }
        
        await this.page.waitForSelector('[data-testid="table-sorted"]');
        return { sorted: true };
    }

    async filterTable(filters: { [column: string]: string }): Promise<{ filteredCount: number }> {
        for (const [column, value] of Object.entries(filters)) {
            await this.page.fill(`[data-filter-column="${column}"]`, value);
        }
        
        await this.page.click('[data-testid="apply-filters"]');
        await this.page.waitForSelector('[data-testid="table-filtered"]');
        
        const rows = await this.page.$$('[data-testid="table-row"]');
        return { filteredCount: rows.length };
    }

    async exportData(format: 'csv' | 'excel' | 'pdf'): Promise<{ exported: boolean; filename: string }> {
        await this.page.click('[data-testid="export-button"]');
        await this.page.click(`[data-testid="export-${format}"]`);
        
        // Wait for download to start
        const downloadPromise = this.page.waitForEvent('download');
        const download = await downloadPromise;
        
        return { exported: true, filename: download.suggestedFilename() || 'export' };
    }
}
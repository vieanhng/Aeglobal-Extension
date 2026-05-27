// Shared Bank Utilities Module
const SharedBankUtils = {
    /**
     * Extract bank ID from URL or return as-is if already an ID
     * Returns object: { id: string, needsResolve: boolean }
     * 
     * Examples:
     * - "12345" -> { id: "12345", needsResolve: false }
     * - "https://aeglobal.lotuslms.com/admin/question-bank/12345" -> { id: "12345", needsResolve: false }
     * - "https://aeglobal.lotuslms.com/admin/folder/abc123" -> { id: "abc123", needsResolve: true }
     * - "abc123" -> { id: "abc123", needsResolve: true }
     */
    extractBankId(input) {
        const trimmed = input.trim();

        // Check if it's a direct numeric ID
        if (/^\d+$/.test(trimmed)) {
            return { id: trimmed, needsResolve: false };
        }

        // Check if it's a URL with numeric ID: /question-bank/12345
        const numericMatch = trimmed.match(/\/question-bank\/(\d+)/);
        if (numericMatch) {
            return { id: numericMatch[1], needsResolve: false };
        }

        // Check if it's a shortcode URL: /folder/abc123 or just abc123
        const shortcodeMatch = trimmed.match(/\/folder\/([^\/\?]+)/) || trimmed.match(/^([a-zA-Z0-9_-]+)$/);
        if (shortcodeMatch) {
            return { id: shortcodeMatch[1], needsResolve: true };
        }

        // Fallback: treat as ID that might need resolution
        return { id: trimmed, needsResolve: true };
    },

    /**
     * Resolve a shortcode to actual bank IID using the API
     * @param {string} shortcode - The shortcode to resolve
     * @param {string} uid - User ID
     * @param {string} token - Auth token
     * @returns {Promise<{success: boolean, id?: string, error?: string}>}
     */
    async resolveBankShortcode(shortcode, uid, token) {
        const API_BASE = "https://cloud-beta-api.lotuslms.com";
        const DOMAIN = "aeglobal";

        try {
            const resolveUrl = `${API_BASE}/content/api/item-detail?item_id=${shortcode}&_sand_domain=${DOMAIN}&_sand_token=${token}&_sand_uiid=${uid}`;

            const response = await Promise.race([
                fetch(resolveUrl, { method: "POST" }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Resolve timeout')), 10000))
            ]);

            const data = await response.json();

            if (data.result && data.result.target_item_iid) {
                return { success: true, id: data.result.target_item_iid };
            } else if (data.message === 'no_permission_to_view_item') {
                return { success: false, error: "Không có quyền truy cập" };
            } else {
                return { success: false, error: "Không thể resolve shortcode" };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Get bank information including name
     * @param {string} bankId - Bank IID
     * @param {string} uid - User ID
     * @param {string} token - Auth token
     * @returns {Promise<{success: boolean, name?: string, error?: string}>}
     */
    async getBankInfo(bankId, uid, token) {
        const API_BASE = "https://cloud-beta-api.lotuslms.com";
        const DOMAIN = "aeglobal";

        try {
            const bankUrl = `${API_BASE}/question-bank/editor/fetch-node?iid=${bankId}&_sand_domain=${DOMAIN}&_sand_token=${token}&_sand_uiid=${uid}`;

            const response = await Promise.race([
                fetch(bankUrl, { method: "POST" }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Bank info timeout')), 10000))
            ]);

            const data = await response.json();

            if (data.success && data.result && data.result.name) {
                return { success: true, name: data.result.name };
            } else {
                return { success: false, error: "Không thể lấy thông tin ngân hàng" };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /**
     * Process bank link to get actual IID and bank name (with resolution if needed)
     * @param {string} bankLink - Bank link or ID
     * @param {string} uid - User ID
     * @param {string} token - Auth token
     * @returns {Promise<{success: boolean, id?: string, name?: string, originalInput?: string, error?: string}>}
     */
    async processBankLink(bankLink, uid, token) {
        const extracted = this.extractBankId(bankLink);
        let bankId = null;

        if (!extracted.needsResolve) {
            bankId = extracted.id;
        } else {
            // Need to resolve shortcode
            const resolved = await this.resolveBankShortcode(extracted.id, uid, token);

            if (!resolved.success) {
                return { success: false, error: resolved.error, originalInput: bankLink };
            }

            bankId = resolved.id;
        }

        // Get bank info (name)
        const bankInfo = await this.getBankInfo(bankId, uid, token);

        if (bankInfo.success) {
            return {
                success: true,
                id: bankId,
                name: bankInfo.name,
                originalInput: bankLink
            };
        } else {
            // Even if we can't get the name, still return success with the ID
            return {
                success: true,
                id: bankId,
                name: `Bank ${bankId}`,
                originalInput: bankLink
            };
        }
    }
};

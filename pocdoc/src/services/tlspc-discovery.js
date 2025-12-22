/**
 * TLSPC URL Discovery Service
 *
 * Discovers the TLSPC tenant URL from an API key by probing regional endpoints.
 * The API key works only on the correct regional endpoint.
 */

// All TLSPC API endpoints (regional)
const API_ENDPOINTS = [
    'https://api.venafi.cloud/',
    'https://api.eu.venafi.cloud/',
    'https://api.au.venafi.cloud/',
    'https://api.uk.venafi.cloud/',
    'https://api.sg.venafi.cloud/',
    'https://api.ca.venafi.cloud/'
];

// Timeout for each endpoint probe (ms)
const PROBE_TIMEOUT = 10000;

/**
 * Probe a single TLSPC endpoint with the API key
 * @param {string} apiUrl - The API base URL to probe
 * @param {string} apiKey - The TLSPC API key
 * @returns {Promise<{success: boolean, apiUrl?: string, tenantUrl?: string, tenantPrefix?: string}>}
 */
async function probeEndpoint(apiUrl, apiKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT);

    try {
        const response = await fetch(`${apiUrl}v1/useraccounts`, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'tppl-api-key': apiKey
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            const tenantPrefix = data?.company?.urlPrefix;

            if (!tenantPrefix) {
                console.log(`[TLSPC Discovery] ${apiUrl} - 200 OK but no tenant prefix in response`);
                return { success: false };
            }

            return {
                success: true,
                apiUrl: apiUrl,
                tenantPrefix: tenantPrefix,
                tenantUrl: `https://${tenantPrefix}.venafi.cloud`
            };
        }

        console.log(`[TLSPC Discovery] ${apiUrl} - HTTP ${response.status}`);
        return { success: false };

    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.log(`[TLSPC Discovery] ${apiUrl} - Timeout`);
        } else {
            console.log(`[TLSPC Discovery] ${apiUrl} - ${error.message}`);
        }
        return { success: false };
    }
}

/**
 * Discover the TLSPC tenant URL from an API key
 *
 * Probes all regional endpoints until finding one that accepts the API key,
 * then extracts the tenant URL from the response.
 *
 * @param {string} apiKey - The TLSPC API key
 * @returns {Promise<{apiUrl: string, tenantUrl: string, tenantPrefix: string} | null>}
 */
async function discoverTlspcUrl(apiKey) {
    if (!apiKey) {
        console.log('[TLSPC Discovery] No API key provided');
        return null;
    }

    console.log('[TLSPC Discovery] Discovering TLSPC tenant URL from API key...');

    for (const apiUrl of API_ENDPOINTS) {
        console.log(`[TLSPC Discovery] Trying: ${apiUrl}`);

        const result = await probeEndpoint(apiUrl, apiKey);

        if (result.success) {
            console.log(`[TLSPC Discovery] SUCCESS - Found working endpoint`);
            console.log(`[TLSPC Discovery]   API URL:      ${result.apiUrl}`);
            console.log(`[TLSPC Discovery]   Tenant URL:   ${result.tenantUrl}`);
            return result;
        }
    }

    console.log('[TLSPC Discovery] Failed to connect to any TLSPC endpoint. Check API key.');
    return null;
}

module.exports = {
    discoverTlspcUrl,
    API_ENDPOINTS
};

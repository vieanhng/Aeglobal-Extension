(function () {
    const TARGET_PATH = "/exercise/editor/fetch-node";

    function processData(url, data) {
        if (url.includes(TARGET_PATH) && data && data.success && data.result) {
            window.postMessage({
                type: 'AEGLOBAL_API_DATA',
                payload: {
                    url: url,
                    timestamp: Date.now(),
                    result: data.result
                }
            }, "*");
        }
    }

    // Intercept XMLHttpRequest
    const XHR = XMLHttpRequest.prototype;
    const open = XHR.open;
    const send = XHR.send;

    XHR.open = function (method, url) {
        this._url = url;
        return open.apply(this, arguments);
    };

    XHR.send = function () {
        this.addEventListener('load', function () {
            if (this._url && this._url.includes(TARGET_PATH)) {
                try {
                    const data = JSON.parse(this.responseText);
                    processData(this._url, data);
                } catch (e) { }
            }
        });
        return send.apply(this, arguments);
    };

    // Intercept Fetch
    const nativeFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await nativeFetch.apply(this, args);
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;

        if (url && url.includes(TARGET_PATH)) {
            response.clone().json().then(data => {
                processData(url, data);
            }).catch(() => { });
        }

        return response;
    };
})();

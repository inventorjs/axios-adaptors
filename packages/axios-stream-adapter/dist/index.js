import { __awaiter, __rest } from "tslib";
/**
 * sse 适配器
 */
import axios, { AxiosError, AxiosHeaders, } from 'axios';
const CONTENT_JSON = 'application/json';
const CONTENT_TEXT = 'text/plain';
const CONTENT_EVENT_STREAM = 'text/event-stream';
const streamAdapter = function streamAdapter(config) {
    return __awaiter(this, void 0, void 0, function* () {
        const { data, headers, method, signal, validateStatus, timeout } = config, rest = __rest(config, ["data", "headers", "method", "signal", "validateStatus", "timeout"]);
        const fullUrl = axios.getUri(config);
        const abortController = new AbortController();
        let timer;
        if (timeout) {
            if (signal) {
                signal.onabort = () => {
                    abortController.abort();
                };
            }
            timer = setTimeout(() => abortController.abort(), timeout);
        }
        try {
            const res = yield fetch(fullUrl, Object.assign(Object.assign({}, rest), { headers,
                method, body: data, signal: abortController.signal }));
            const statusCode = res.status;
            const response = {
                data: res.body,
                status: statusCode,
                statusText: res.statusText,
                headers: new AxiosHeaders(Object.fromEntries(res.headers.entries())),
                config,
                request: null,
            };
            if (!res.ok || (validateStatus && !validateStatus(statusCode))) {
                response.data = yield res.json();
                throw new AxiosError(`Request failed with status code ${statusCode}`, String(statusCode), config, null, response);
            }
            if (!res.body) {
                return response;
            }
            const contentType = res.headers.get('content-type');
            switch (contentType) {
                case CONTENT_JSON:
                    response.data = yield res.json();
                    break;
                case CONTENT_TEXT:
                    response.data = yield res.text();
                    break;
                case CONTENT_EVENT_STREAM:
                    response.data = new ReadableStream({
                        start(controller) {
                            var _a;
                            return __awaiter(this, void 0, void 0, function* () {
                                const reader = (_a = res.body) === null || _a === void 0 ? void 0 : _a.getReader();
                                if (!reader)
                                    return;
                                while (true) {
                                    const { value, done } = yield reader.read();
                                    const decoder = new TextDecoder();
                                    const lines = decoder.decode(value).split('\n\n');
                                    lines.forEach((line) => {
                                        const [, data] = line.split('data: ');
                                        if (data && data !== '[DONE]') {
                                            let parsedData = data;
                                            try {
                                                parsedData = JSON.parse(data);
                                            }
                                            catch (err) {
                                                // empty
                                            }
                                            controller.enqueue(parsedData);
                                        }
                                    });
                                    if (done) {
                                        controller.close();
                                        break;
                                    }
                                }
                            });
                        },
                    });
                    break;
            }
            return response;
        }
        catch (error) {
            throw new AxiosError(error.message, '0', config, null);
        }
        finally {
            clearTimeout(timer);
        }
    });
};
export default streamAdapter;

import { __awaiter, __rest } from "tslib";
/**
 * sse 适配器
 */
import axios, { AxiosError } from 'axios';
const CONTENT_JSON = 'application/json';
const CONTENT_EVENT_STREAM = 'text/event-stream';
const streamAdapter = function streamAdapter(config) {
    return __awaiter(this, void 0, void 0, function* () {
        const { data, headers, method, signal, validateStatus, timeout } = config, rest = __rest(config, ["data", "headers", "method", "signal", "validateStatus", "timeout"]);
        const fullUrl = axios.getUri(config);
        const abortController = new AbortController();
        let timer;
        if (timeout && !signal) {
            timer = setTimeout(() => abortController.abort(), timeout);
        }
        try {
            const res = yield fetch(fullUrl, Object.assign(Object.assign({}, rest), { headers,
                method, body: data, signal: (signal !== null && signal !== void 0 ? signal : abortController.signal) }));
            const statusCode = res.status;
            const response = {
                data: res.body,
                status: statusCode,
                statusText: res.statusText,
                headers: Object.fromEntries([
                    ...res.headers,
                ]),
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
            if (res.headers.get('content-type') === CONTENT_JSON) {
                response.data = yield res.json();
            }
            else if (res.headers.get('content-type') === CONTENT_EVENT_STREAM) {
                response.data = new ReadableStream({
                    start(controller) {
                        return __awaiter(this, void 0, void 0, function* () {
                            if (!res.body) {
                                return controller.close();
                            }
                            const reader = res.body.getReader();
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
                    }
                });
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

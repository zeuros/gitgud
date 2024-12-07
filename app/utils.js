"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const url_1 = require("url");
const child_process_1 = require("child_process");
const onAuth = (url) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('onAuth');
    const { protocol, host } = new url_1.URL(url);
    return new Promise((resolve, reject) => {
        const output = [];
        const process = (0, child_process_1.spawn)('git', ['credential', 'fill']);
        process.on('close', (code) => {
            if (code)
                return reject(code);
            const { username, password } = output.join('\n').split('\n').reduce((acc, line) => {
                if (line.startsWith('username') || line.startsWith('password')) {
                    const [key, val] = line.split('=');
                    acc[key] = val;
                }
                return acc;
            }, {});
            resolve({ username, password });
        });
        process.stdout.on('data', (data) => output.push(data.toString().trim()));
        process.stdin.write(`protocol=${protocol.slice(0, -1)}\nhost=${host}\n\n`);
    });
});
module.exports = {
    onAuth,
};
//# sourceMappingURL=utils.js.map
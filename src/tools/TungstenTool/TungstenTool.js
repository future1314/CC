import { buildTool } from '../../Tool.js';
export const TungstenTool = buildTool({
    name: 'tungsten',
    userFacingName() {
        return 'Tungsten';
    },
    async description() {
        return 'Unavailable in restored development build.';
    },
    async prompt() {
        return 'Unavailable in restored development build.';
    },
    inputSchema: {
        parse(value) {
            return value;
        },
    },
    outputSchema: {
        parse(value) {
            return value;
        },
    },
    isEnabled() {
        return false;
    },
    isReadOnly() {
        return true;
    },
    isConcurrencySafe() {
        return true;
    },
    async call() {
        return { data: { ok: false } };
    },
});

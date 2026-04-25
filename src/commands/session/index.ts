import { getIsRemoteMode } from '../../bootstrap/state.ts';
const session = {
    type: 'local-jsx',
    name: 'session',
    aliases: ['remote'],
    description: 'Show remote session URL and QR code',
    isEnabled: () => getIsRemoteMode(),
    get isHidden() {
        return !getIsRemoteMode();
    },
    load: () => import('./session.tsx'),
};
export default session;

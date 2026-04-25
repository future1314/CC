import { feature } from 'bun:bundle';
import { isBridgeEnabled } from '../../bridge/bridgeEnabled.ts';
function isEnabled() {
    if (!feature('BRIDGE_MODE')) {
        return false;
    }
    return isBridgeEnabled();
}
const bridge = {
    type: 'local-jsx',
    name: 'remote-control',
    aliases: ['rc'],
    description: 'Connect this terminal for remote-control sessions',
    argumentHint: '[name]',
    isEnabled,
    get isHidden() {
        return !isEnabled();
    },
    immediate: true,
    load: () => import('./bridge.tsx'),
};
export default bridge;

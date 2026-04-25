import { getIsNonInteractiveSession } from '../../bootstrap/state.ts';
export const context = {
    name: 'context',
    description: 'Visualize current context usage as a colored grid',
    isEnabled: () => !getIsNonInteractiveSession(),
    type: 'local-jsx',
    load: () => import('./context.tsx'),
};
export const contextNonInteractive = {
    type: 'local',
    name: 'context',
    supportsNonInteractive: true,
    description: 'Show current context usage',
    get isHidden() {
        return !getIsNonInteractiveSession();
    },
    isEnabled() {
        return getIsNonInteractiveSession();
    },
    load: () => import('./context-noninteractive.ts'),
};

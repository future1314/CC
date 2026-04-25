import { getIsNonInteractiveSession } from '../../bootstrap/state.ts';
const command = {
    name: 'chrome',
    description: 'Claude in Chrome (Beta) settings',
    availability: ['claude-ai'],
    isEnabled: () => !getIsNonInteractiveSession(),
    type: 'local-jsx',
    load: () => import('./chrome.tsx'),
};
export default command;

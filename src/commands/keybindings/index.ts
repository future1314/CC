import { isKeybindingCustomizationEnabled } from '../../keybindings/loadUserBindings.ts';
const keybindings = {
    name: 'keybindings',
    description: 'Open or create your keybindings configuration file',
    isEnabled: () => isKeybindingCustomizationEnabled(),
    supportsNonInteractive: false,
    type: 'local',
    load: () => import('./keybindings.ts'),
};
export default keybindings;

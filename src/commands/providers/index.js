/**
 * Provider Management Commands
 * 提供商管理命令
 */
const providersList = {
    type: 'local',
    name: 'list',
    aliases: ['ls'],
    description: 'List all configured model providers',
    argumentHint: '',
    load: () => import('./list.js'),
};
const providersAdd = {
    type: 'local',
    name: 'add',
    description: 'Add a new model provider',
    argumentHint: '[name] [baseUrl] [apiKey] [apiFormat]',
    load: () => import('./add.js'),
};
const providersActivate = {
    type: 'local',
    name: 'activate',
    description: 'Activate a model provider',
    argumentHint: '[id]',
    load: () => import('./activate.js'),
};
const providersDeactivate = {
    type: 'local',
    name: 'deactivate',
    description: 'Deactivate current provider and use official Anthropic',
    load: () => import('./deactivate.js'),
};
const providersRemove = {
    type: 'local',
    name: 'remove',
    aliases: ['delete', 'rm'],
    description: 'Remove a model provider',
    argumentHint: '[id]',
    load: () => import('./remove.js'),
};
const providers = {
    type: 'group',
    name: 'provider',
    aliases: ['providers'],
    description: 'Manage model providers (list, add, activate, deactivate, remove)',
    subCommands: () => Promise.resolve([
        providersList,
        providersAdd,
        providersActivate,
        providersDeactivate,
        providersRemove,
    ]),
};
export default providers;

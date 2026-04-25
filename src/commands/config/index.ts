const config = {
    aliases: ['settings'],
    type: 'local-jsx',
    name: 'config',
    description: 'Open config panel',
    load: () => import('./config.tsx'),
};
export default config;

const help = {
    type: 'local-jsx',
    name: 'help',
    description: 'Show help and available commands',
    load: () => import('./help.tsx'),
};
export default help;

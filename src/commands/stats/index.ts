const stats = {
    type: 'local-jsx',
    name: 'stats',
    description: 'Show your Claude Code usage statistics and activity',
    load: () => import('./stats.tsx'),
};
export default stats;

const agents = {
    type: 'local-jsx',
    name: 'agents',
    description: 'Manage agent configurations',
    load: () => import('./agents.tsx'),
};
export default agents;

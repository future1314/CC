const exportCommand = {
    type: 'local-jsx',
    name: 'export',
    description: 'Export the current conversation to a file or clipboard',
    argumentHint: '[filename]',
    load: () => import('./export.tsx'),
};
export default exportCommand;

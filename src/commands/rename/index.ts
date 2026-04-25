const rename = {
    type: 'local-jsx',
    name: 'rename',
    description: 'Rename the current conversation',
    immediate: true,
    argumentHint: '[name]',
    load: () => import('./rename.ts'),
};
export default rename;

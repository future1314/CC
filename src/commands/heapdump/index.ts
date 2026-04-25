const heapDump = {
    type: 'local',
    name: 'heapdump',
    description: 'Dump the JS heap to ~/Desktop',
    isHidden: true,
    supportsNonInteractive: true,
    load: () => import('./heapdump.ts'),
};
export default heapDump;

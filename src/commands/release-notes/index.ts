const releaseNotes = {
    description: 'View release notes',
    name: 'release-notes',
    type: 'local',
    supportsNonInteractive: true,
    load: () => import('./release-notes.ts'),
};
export default releaseNotes;

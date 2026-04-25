const agentsPlatform = {
    name: 'agents-platform',
    type: 'local',
    description: 'Unavailable in restored development build.',
    supportsNonInteractive: true,
    load: async () => ({
        async call() {
            return { type: 'skip' };
        },
    }),
};
export default agentsPlatform;

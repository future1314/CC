const remove = {
    type: 'local',
    name: 'remove',
    aliases: ['delete', 'rm'],
    description: 'Remove a model provider',
    argumentHint: '[id]',
    async run(args) {
        if (args.length < 1) {
            console.log('\n用法: /provider remove [providerId]');
            console.log('\n使用 /provider list 查看所有提供商及其ID');
            return [];
        }
        const [providerId] = args;
        console.log(`\n正在删除提供商: ${providerId}`);
        try {
            const { adapterService } = await import('../../../services/adapterService.js');
            await adapterService.deleteProvider(providerId);
            console.log('✓ 提供商删除成功');
        }
        catch (err) {
            console.log('✗ 删除失败:', err instanceof Error ? err.message : String(err));
        }
        return [];
    },
};
export default remove;

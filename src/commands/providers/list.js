const list = {
    type: 'local',
    name: 'list',
    aliases: ['ls'],
    description: 'List all configured model providers',
    argumentHint: '',
    async run() {
        console.log('\n模型提供商列表功能需要完整实现...');
        console.log('使用 /provider list 查看所有提供商');
        return [];
    },
};
export default list;

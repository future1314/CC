const add = {
    type: 'local',
    name: 'add',
    description: 'Add a new model provider',
    argumentHint: '[name] [baseUrl] [apiKey] [apiFormat]',
    async run(args) {
        if (args.length < 4) {
            console.log('\n用法: /provider add [name] [baseUrl] [apiKey] [apiFormat]');
            console.log('\n示例:');
            console.log('  /provider add Ollama http://localhost:11434 "" ollama');
            console.log('  /provider add MiniMax https://api.minimax.chat/v1 your-api-key openai_chat');
            console.log('');
            console.log('API格式选项: anthropic, openai_chat, openai_responses, ollama');
            return [];
        }
        const [name, baseUrl, apiKey, apiFormat] = args;
        console.log(`\n添加提供商: ${name}`);
        console.log(`  端点: ${baseUrl}`);
        console.log(`  格式: ${apiFormat}`);
        console.log('\n请在配置界面完成添加操作');
        return [];
    },
};
export default add;

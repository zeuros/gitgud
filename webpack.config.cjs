const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = (config, options) => {
  config.module.rules = config.module.rules.map(rule => {
    if (rule.test && rule.test.toString().includes('css')) {
      return { ...rule, exclude: /node_modules[/\\]monaco-editor/ };
    }
    return rule;
  });

  config.plugins.push(
    new MonacoWebpackPlugin({
      languages: ['javascript', 'typescript', 'json', 'markdown', 'css', 'html', 'shell', 'yaml'],
    })
  );

  config.module.rules.push(
    {
      test: /\.css$/,
      include: /node_modules[/\\]monaco-editor/,
      use: [
        { loader: 'style-loader', options: { esModule: false } },
        { loader: 'css-loader', options: { esModule: false } },
      ],
    },
    {
      test: /\.ttf$/,
      include: /node_modules[/\\]monaco-editor/,
      type: 'asset/resource',
    }
  );

  return config;
};
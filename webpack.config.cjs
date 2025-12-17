module.exports = (config, options) => {
  config.module.rules.push(
    {
      test: /\.css$/i,
      use: ['style-loader', 'css-loader'],
    }
  );
  return config;
};


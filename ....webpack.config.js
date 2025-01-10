// webpack.config.js
//const path = require('path');

module.exports = {
  entry: {
    extension: './src/extension.ts',
    webview: './src/webview/index.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      // Rule for extension TypeScript files
      {
        test: /\.ts$/,
        exclude: /node_modules|webview/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.json')
            },
          },
        ],
      },
      // Rule for webview TypeScript/React files
      {
        test: /\.tsx?$/,
        include: path.resolve(__dirname, 'src/webview'),
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'src/webview/tsconfig.json')
            },
          },
        ],
      },
      // Rule for CSS files
      {
        test: /\.css$/i,
        include: path.resolve(__dirname, 'src/webview'),
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
            },
          },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                config: path.resolve(__dirname, 'postcss.config.js'),
              },
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: "log",
  },
};
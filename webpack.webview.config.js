// webpack.webview.config.js
const path = require('path');

module.exports = {
  target: 'web',
  entry: './src/webview/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'webview.js',
    clean: false
  },
  module: {
    rules: [
      {
        test: /\.ts|\.tsx$/,
        include: [
          path.resolve(__dirname, 'src/webview'),
          path.resolve(__dirname, 'src/shared')
        ],
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: path.resolve(__dirname, 'tsconfig.webview.json')
            },
          },
        ],
      },
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
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  },
  externals: {
    vscode: 'commonjs vscode' // Mark vscode as external
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: "log",
  },
};
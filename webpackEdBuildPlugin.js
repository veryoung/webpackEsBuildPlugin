/* eslint-disable no-console */
/* eslint-disable no-param-reassign */
const path = require('path');

const plugin = 'WebpackESBuildPlugin';
const fs = require('fs');
const autoprefixer = require('autoprefixer');

/** 判断是否具有装饰器 */
function hasDecorator(fileContent, offset = 0) {
  const atPosition = fileContent.indexOf('@', offset);

  if (atPosition === -1) {
    return false;
  }

  if (atPosition === 1) {
    return true;
  }

  if (["'", '"'].includes(fileContent.substr(atPosition - 1, 1))) {
    return hasDecorator(fileContent, atPosition + 1);
  }

  return true;
}

/** 获取tsx解析loader */
function getTsxLoader(test) {
  return {
    test,
    oneOf: [
      {
        test: filePath => {
          if (!filePath) {
            return false;
          }
          try {
            const fileContent = fs.readFileSync(filePath).toString();
            return !hasDecorator(fileContent);
          } catch (e) {
            return false;
          }
        },
        use: [
          {
            loader: 'esbuild-loader',
            options: {
              loader: 'tsx',
              target: 'es2018',
            },
          },
        ],
      },
      {
        use: [
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
            },
          },
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
              configFile: 'tools/config/tsconfig.develop.json',
            },
          },
        ],
      },
    ],
    exclude: path.resolve(__dirname, 'node_modules'),
  };
}

/** 获取css解析loader */
function getCssLoader(test) {
  return {
    test,
    use: [
      'style-loader',
      'css-loader',
      {
        loader: require.resolve('postcss-loader'),
        options: {
          postcssOptions: {
            plugins: () => [
              require('postcss-flexbugs-fixes'),
              autoprefixer({
                flexbox: 'no-2009',
              }),
            ],
          },
        },
      },
      {
        loader: 'esbuild-loader',
        options: {
          loader: 'css',
          minify: true,
        },
      },
    ],
  };
}

/** esbuild插件设置 */
class WebpackESBuildPlugin {
  constructor(options = {}) {
    this.count = 1;
    this.options = options;
  }

  apply(compiler) {
    if (compiler.options.mode !== 'development') return;
    compiler.hooks.afterEnvironment.tap(plugin, () => {
      compiler.options.module.rules = compiler.options.module.rules.map(rule => {
        rule.oneOf = rule.oneOf.map(item => {
          const { test, use } = item;
          if (!test) return item;
          const loaderMatch = test.toString().match('tsx') || test.toString().match(/css?/);
          const loader = loaderMatch ? loaderMatch[0] : '';
          if (!loader || !use) return item;

          if (loader === 'tsx') {
            return getTsxLoader(test);
          }

          if (loader === 'css') {
            return getCssLoader(test);
          }
        });
        return rule;
      });
      // console.log(JSON.stringify(compiler.options.module.rules));
      const typescriptExtensions = ['.ts', '.tsx'];
      compiler.options.resolve.extensions.unshift(...typescriptExtensions);
    });

    compiler.hooks.watchRun.tap(plugin, compilation => {
      const changedFiles = Object.keys(compilation.watchFileSystem.watcher.mtimes).map(file =>
        file.replace(`${process.cwd()}/`, ''),
      );
      if (changedFiles.length > 0) {
        console.log(`文件发生改动：${changedFiles.join(', ')}`);
      }
      console.log(`开始第 ${this.count} 次构建...`);
    });

    compiler.hooks.done.tap(plugin, stats => {
      const { startTime, endTime } = stats;
      const spendTime = endTime - startTime;
      console.log(`第 ${this.count} 次构建成功，用时：${spendTime}ms`);
      this.count += 1;
    });
  }
}

module.exports = WebpackESBuildPlugin;
